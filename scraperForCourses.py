from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options


from webdriver_manager.chrome import ChromeDriverManager

from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time


# ---------------------------
# Selenium bootstrap
# ---------------------------s

def build_driver():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
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
    return driver


# ---------------------------
# Term range utilities
# ---------------------------

def term_text_to_key(term_text: str):
    """
    Convert 'Fall 2018-2019' / 'Spring 2025-2026' into a sortable numeric key.

    Fall 2018-2019  -> 20180
    Spring 2018-2019 -> 20181
    Summer 2018-2019 -> 20182
    """
    try:
        parts = term_text.split()
        if len(parts) < 2:
            return None

        season = parts[0]   # Fall / Spring / Summer
        years = parts[1]    # 2018-2019
        start_year = int(years.split('-')[0])

        season_order = {"Fall": 0, "Spring": 1, "Summer": 2}
        s_order = season_order.get(season, 9)

        return start_year * 10 + s_order
    except Exception:
        return None


LOWER_BOUND_KEY = term_text_to_key("Fall 2025-2026")
UPPER_BOUND_KEY = term_text_to_key("Spring 2025-2026")


def term_in_range(term_text: str) -> bool:
    """
    We only want Fall/Spring between Fall 2018-2019 and Spring 2025-2026.
    """
    key = term_text_to_key(term_text)
    if key is None:
        return False
    if key < LOWER_BOUND_KEY or key > UPPER_BOUND_KEY:
        return False

    season = term_text.split()[0]
    return season in ("Fall", "Spring")


# ---------------------------
# HTML parsing helpers
# ---------------------------

def extract_inline_block_courses(soup, anchor_name):
    """
    For sections like University Courses (UC_FENS) and Required Courses (BSCS_REQ),
    starting from <a name="...">, find the first table that has the header
    [Course, Name, ECTS Credits, SU Credits, Faculty] and extract rows.
    """
    anchor = soup.find("a", attrs={"name": anchor_name})
    if not anchor:
        return []

    current = anchor
    target_table = None
    expected_headers = {"Course", "Name", "ECTS Credits", "SU Credits", "Faculty"}

    while True:
        current = current.find_next("table")
        if not current:
            break

        header_cells = [th.get_text(strip=True) for th in current.find_all("th")]
        if expected_headers.issubset(set(header_cells)):
            target_table = current
            break

    if not target_table:
        return []

    tbody = target_table.find("tbody")
    if not tbody:
        return []

    data = []
    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 6:
            continue

        course_code = tds[1].get_text(strip=True)
        course_name = tds[2].get_text(strip=True)
        ects = tds[3].get_text(strip=True)
        su_credits = tds[4].get_text(strip=True)
        faculty = tds[5].get_text(strip=True)

        if not course_code:
            continue

        data.append({
            "course_code": course_code,
            "course_name": course_name,
            "ects": ects,
            "su_credits": su_credits,
            "faculty": faculty,
        })

    return data


def find_elective_link(soup, anchor_name, area_code):
    """
    For Core / Area / Free Electives:
    Starting from <a name="BSCS_CEL"> etc., locate the 'Click For ...' link
    whose href contains p_list_courses and P_AREA=area_code.
    """
    anchor = soup.find("a", attrs={"name": anchor_name})
    if not anchor:
        return None

    current = anchor
    while True:
        current = current.find_next("a")
        if not current:
            break
        href = current.get("href", "")
        if "p_list_courses" in href and f"P_AREA={area_code}" in href:
            return href

    return None


def extract_p_list_courses(driver, full_url):
    """
    Given a p_list_courses URL, navigate there with Selenium, then
    extract the course table (Course / Name / ECTS / SU Credits / Faculty).
    """
    driver.get(full_url)
    time.sleep(1)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    tables = soup.find_all("table")
    if not tables:
        return []

    expected_headers = {"Course", "Name", "ECTS Credits", "SU Credits", "Faculty"}
    target_table = None

    for table in tables:
        header_cells = [th.get_text(strip=True) for th in table.find_all("th")]
        if expected_headers.issubset(set(header_cells)):
            target_table = table
            break

    if not target_table:
        return []

    tbody = target_table.find("tbody")
    if not tbody:
        return []

    data = []
    for tr in tbody.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 6:
            continue

        course_code = tds[1].get_text(strip=True)
        course_name = tds[2].get_text(strip=True)
        ects = tds[3].get_text(strip=True)
        su_credits = tds[4].get_text(strip=True)
        faculty = tds[5].get_text(strip=True)

        if not course_code:
            continue

        data.append({
            "course_code": course_code,
            "course_name": course_name,
            "ects": ects,
            "su_credits": su_credits,
            "faculty": faculty,
        })

    return data
from selenium.webdriver.common.by import By

def extract_course_table_after_anchor(driver, anchor_name):
    """
    For anchors like UC_FENS, BSCS_REQ on the degree detail page:
    - Finds the anchor <a name="...">
    - Takes the SECOND following <table> (1st is description, 2nd is the course table)
    - Parses rows into [{course_code, course_name, ects, su_credits, faculty}, ...]
    """
    try:
        anchor = driver.find_element(By.XPATH, f"//a[@name='{anchor_name}']")
    except Exception:
        return []

    # Following tables: [0] = description table, [1] = actual course table
    tables = anchor.find_elements(By.XPATH, "ancestor::tr/following::table")
    if len(tables) < 2:
        return []

    table = tables[1]
    rows = table.find_elements(By.TAG_NAME, "tr")
    if len(rows) < 2:
        return []

    courses = []
    for row in rows[1:]:  # skip header
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 6:
            continue

        course_code = cells[1].text.strip()
        if not course_code:
            continue

        courses.append({
            "course_code": course_code,
            "course_name": cells[2].text.strip(),
            "ects": cells[3].text.strip(),
            "su_credits": cells[4].text.strip(),
            "faculty": cells[5].text.strip(),
        })

    return courses

from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def scrape_elective_pool_page(driver, url):
    """
    Generic parser for SU_DEGREE.p_list_courses pages:
    Expects first table to have header:
    (&nbsp;, Course, Name, ECTS Credits, SU Credits, Faculty)
    """
    if url is None:
        return []

    driver.get(url)
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.TAG_NAME, "table"))
    )

    tables = driver.find_elements(By.TAG_NAME, "table")
    if not tables:
        return []

    table = tables[0]
    rows = table.find_elements(By.TAG_NAME, "tr")
    if len(rows) < 2:
        return []

    electives = []
    for row in rows[1:]:
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 6:
            continue

        course_code = cells[1].text.strip()
        if not course_code:
            continue

        electives.append({
            "course_code": course_code,
            "course_name": cells[2].text.strip(),
            "ects": cells[3].text.strip(),
            "su_credits": cells[4].text.strip(),
            "faculty": cells[5].text.strip(),
        })

    return electives

def scrape_current_degree_page(driver):
    """
    Scrapes a single SU_DEGREE.p_degree_detail page into the JSON structure you showed.
    - University Courses
    - Required Courses
    - Core / Area / Free Electives (via p_list_courses pages)
    """
    # Admit term (e.g., "Admit Term: Spring 2025-2026")
    admit_term_text = driver.find_element(
        By.XPATH, "//h3[contains(., 'Admit Term')]"
    ).text.strip()
    admit_term = admit_term_text.replace("Admit Term:", "").strip()

    # Program title
    program = driver.find_element(
        By.XPATH,
        "//h1[contains(., 'COMPUTER SCIENCE') or contains(., 'COMPUTER SCIENCE AND ENGINEERING')]"
    ).text.strip()

    # On-page tables (University + Required)
    university_courses = extract_course_table_after_anchor(driver, "UC_FENS")
    required_courses = extract_course_table_after_anchor(driver, "BSCS_REQ")

    # Base URL for resolving relative links
    base_url = driver.current_url

    def resolve_href(fragment: str):
        """Find first <a> whose href contains fragment and return absolute URL."""
        try:
            link = driver.find_element(By.XPATH, f"//a[contains(@href, '{fragment}')]")
            href = link.get_attribute("href")
            return urljoin(base_url, href)
        except Exception:
            return None

    # Core / Area / Free electives → follow p_list_courses links
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

        term_entries = []
        for opt in option_elems:
            val = opt.get_attribute("value")
            txt = opt.text.strip()
            if not val:
                continue
            if not term_in_range(txt):  # your filter: Fall 2018-2019 → Spring 2025-2026
                continue
            term_entries.append((txt, val))

        all_term_data = []

        for term_text, term_value in term_entries:
            print(f"Processing FIRST ADMIT TERM: {term_text} ({term_value})")

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

            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            term_data = scrape_current_degree_page(driver)
            term_data["first_admit_term_display"] = term_text
            term_data["first_admit_term_value"] = term_value

            all_term_data.append(term_data)

        return all_term_data

    finally:
        driver.quit()





if __name__ == "__main__":
    data = scrape_all_terms()

    # ---- Save JSON output ----
    import json
    import os

    output_dir = "./output"
    os.makedirs(output_dir, exist_ok=True)

    out_path = os.path.join(output_dir, "degree_requirements.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n📁 JSON successfully exported to: {out_path}\n")
