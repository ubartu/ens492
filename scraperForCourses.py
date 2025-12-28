from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, parse_qs
import time
import json
import os

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException


# ---------------------------
# Selenium bootstrap
# ---------------------------

def build_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--blink-settings=imagesEnabled=false")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-infobars")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    )
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options
    )
    driver.set_page_load_timeout(45)
    return driver


# ---------------------------
# Term range utilities
# ---------------------------

def term_text_to_key(term_text: str):
    """
    Convert 'Fall 2018-2019' / 'Spring 2025-2026' into a sortable numeric key.

    Fall 2018-2019   -> 20180
    Spring 2018-2019 -> 20181
    Summer 2018-2019 -> 20182
    """
    try:
        parts = term_text.split()
        if len(parts) < 2:
            return None

        season = parts[0]
        years = parts[1]
        start_year = int(years.split('-')[0])

        season_order = {"Fall": 0, "Spring": 1, "Summer": 2}
        s_order = season_order.get(season, 9)

        return start_year * 10 + s_order
    except Exception:
        return None


LOWER_BOUND_KEY = term_text_to_key("Fall 2020-2021")
UPPER_BOUND_KEY = term_text_to_key("Spring 2025-2026")


def term_in_range(term_text: str) -> bool:
    """
    We only want Fall/Spring between Fall 2020-2021 and Spring 2025-2026.
    """
    key = term_text_to_key(term_text)
    if key is None:
        return False
    if key < LOWER_BOUND_KEY or key > UPPER_BOUND_KEY:
        return False

    season = term_text.split()[0]
    return season in ("Fall", "Spring")


# ---------------------------
# Robust wait utilities
# ---------------------------

def wait_for_degree_detail_ready(driver, timeout=25):
    """
    Degree detail pages aren't always consistent.
    Consider page "ready" if any of these appear:
      - h3 'Admit Term'
      - UC_FENS anchor
      - SUMMARY header
    """
    def ready(d):
        probes = [
            "//h3[contains(., 'Admit Term')]",
            "//a[@name='UC_FENS']",
            "//h1[contains(., 'SUMMARY OF DEGREE REQUIREMENTS')]",
        ]
        return any(d.find_elements(By.XPATH, xp) for xp in probes)

    WebDriverWait(driver, timeout).until(ready)


def safe_text(driver, xpath: str) -> str:
    elems = driver.find_elements(By.XPATH, xpath)
    return elems[0].text.strip() if elems else ""


# ---------------------------
# Selenium parsing helpers
# ---------------------------

def extract_course_table_after_anchor(driver, anchor_name):
    """
    For anchors like UC_FENS, BSCS_REQ:
    Find the first following <table> that has headers:
      Course / Name / ECTS Credits / SU Credits / Faculty
    Then parse its tbody rows into normalized JSON objects.
    """
    try:
        driver.find_element(By.XPATH, f"//a[@name='{anchor_name}']")
    except Exception:
        return []

    # Find candidate tables after the anchor in DOM order
    tables = driver.find_elements(By.XPATH, f"//a[@name='{anchor_name}']/following::table")
    if not tables:
        return []

    expected = {"Course", "Name", "ECTS Credits", "SU Credits", "Faculty"}

    def table_headers(tbl):
        ths = tbl.find_elements(By.TAG_NAME, "th")
        return {t.text.strip() for t in ths if t.text.strip()}

    target = None
    for tbl in tables:
        if expected.issubset(table_headers(tbl)):
            target = tbl
            break

    if not target:
        return []

    rows = target.find_elements(By.XPATH, ".//tbody/tr")
    data = []

    for tr in rows:
        tds = tr.find_elements(By.TAG_NAME, "td")
        if len(tds) < 6:
            continue

        course_code = tds[1].text.strip()
        if not course_code:
            continue

        data.append({
            "course_code": course_code,
            "course_name": tds[2].text.strip(),
            "ects": tds[3].text.strip(),
            "su_credits": tds[4].text.strip(),
            "faculty": tds[5].text.strip(),
        })

    return data


def scrape_elective_pool_page(driver, url):
    """
    Parses SU_DEGREE.p_list_courses pages.
    IMPORTANT: These pages often contain multiple tables; first table is not guaranteed
    to be the course table. We select the table whose headers match the expected schema.
    """
    if not url:
        return []

    driver.get(url)

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.TAG_NAME, "table"))
    )

    # Use DOM-based selection by headers (not index-based)
    expected = {"Course", "Name", "ECTS Credits", "SU Credits", "Faculty"}
    tables = driver.find_elements(By.TAG_NAME, "table")

    def headers_of(tbl):
        ths = tbl.find_elements(By.TAG_NAME, "th")
        return {t.text.strip() for t in ths if t.text.strip()}

    target = None
    for tbl in tables:
        if expected.issubset(headers_of(tbl)):
            target = tbl
            break

    if not target:
        return []

    rows = target.find_elements(By.XPATH, ".//tbody/tr")
    electives = []

    for tr in rows:
        tds = tr.find_elements(By.TAG_NAME, "td")
        if len(tds) < 6:
            continue

        course_code = tds[1].text.strip()
        if not course_code:
            continue

        electives.append({
            "course_code": course_code,
            "course_name": tds[2].text.strip(),
            "ects": tds[3].text.strip(),
            "su_credits": tds[4].text.strip(),
            "faculty": tds[5].text.strip(),
        })

    return electives


# ---------------------------
# Page scraper
# ---------------------------

def scrape_current_degree_page(driver, fallback_term_text=None, fallback_term_value=None):
    """
    Scrapes a single SU_DEGREE.p_degree_detail page.
    Adds fallbacks for admit_term and program title to avoid NoSuchElement failures.
    """
    wait_for_degree_detail_ready(driver, timeout=25)

    admit_term_text = safe_text(driver, "//h3[contains(., 'Admit Term')]")
    admit_term = admit_term_text.replace("Admit Term:", "").strip() if admit_term_text else (fallback_term_text or "")

    program = safe_text(driver, "//h1[contains(., 'UNDERGRADUATE PROGRAM') or contains(., '(BSCS)')]")
    if not program:
        program = safe_text(driver, "(//h1)[1]")

    university_courses = extract_course_table_after_anchor(driver, "UC_FENS")
    required_courses = extract_course_table_after_anchor(driver, "BSCS_REQ")

    base_url = driver.current_url

    def resolve_href(fragment: str):
        try:
            link = driver.find_element(By.XPATH, f"//a[contains(@href, '{fragment}')]")
            href = link.get_attribute("href")
            return urljoin(base_url, href)
        except Exception:
            return None

    core_url = resolve_href("P_AREA=BSCS_CEL")
    area_url = resolve_href("P_AREA=BSCS_AEL")
    free_url = resolve_href("P_AREA=BSCS_FEL")

    core_electives = scrape_elective_pool_page(driver, core_url)
    area_electives = scrape_elective_pool_page(driver, area_url)
    free_electives = scrape_elective_pool_page(driver, free_url)

    return {
        "admit_term": admit_term,
        "program": program,
        "university_courses": university_courses,
        "required_courses": required_courses,
        "core_electives": core_electives,
        "area_electives": area_electives,
        "free_electives": free_electives,
        "first_admit_term_display": fallback_term_text or admit_term,
        "first_admit_term_value": fallback_term_value or "",
    }


# ---------------------------
# Main multi-term workflow
# ---------------------------

def scrape_all_terms():
    driver = build_driver()
    SELECT_URL = "https://suis.sabanciuniv.edu/prod/SU_DEGREE.p_select_term?P_PROGRAM=BSCS&P_LANG=EN&P_LEVEL=UG"

    try:
        driver.get(SELECT_URL)
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "P_TERM"))
        )

        select_elem = driver.find_element(By.NAME, "P_TERM")
        option_elems = select_elem.find_elements(By.TAG_NAME, "option")

        # capture (txt,val) as plain strings to avoid stale references
        term_entries = []
        for opt in option_elems:
            val = opt.get_attribute("value")
            txt = opt.text.strip()
            if not val:
                continue
            if not term_in_range(txt):
                continue
            term_entries.append((txt, val))

        all_term_data = []

        for term_text, term_value in term_entries:
            print(f"Processing FIRST ADMIT TERM: {term_text} ({term_value})")

            # reload selection page for a clean session state
            driver.get(SELECT_URL)
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.NAME, "P_TERM"))
            )

            select_elem = driver.find_element(By.NAME, "P_TERM")
            for o in select_elem.find_elements(By.TAG_NAME, "option"):
                if o.get_attribute("value") == term_value:
                    o.click()
                    break

            driver.find_element(By.NAME, "P_SUBMIT").click()

            # wait for degree page readiness (not just body)
            try:
                wait_for_degree_detail_ready(driver, timeout=25)
            except TimeoutException:
                all_term_data.append({
                    "admit_term": term_text,
                    "program": "",
                    "university_courses": [],
                    "required_courses": [],
                    "core_electives": [],
                    "area_electives": [],
                    "free_electives": [],
                    "first_admit_term_display": term_text,
                    "first_admit_term_value": term_value,
                    "error": f"Degree detail did not load. URL={driver.current_url}"
                })
                continue

            term_data = scrape_current_degree_page(
                driver,
                fallback_term_text=term_text,
                fallback_term_value=term_value
            )

            all_term_data.append(term_data)

        return all_term_data

    finally:
        driver.quit()


# ---------------------------
# CLI entry
# ---------------------------

if __name__ == "__main__":
    data = scrape_all_terms()

    output_dir = "./output"
    os.makedirs(output_dir, exist_ok=True)

    out_path = os.path.join(output_dir, "degree_requirements.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nJSON successfully exported to: {out_path}\n")
