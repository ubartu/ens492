from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import time

# --- UTILITIES ---

def term_key(term_name: str):
    """
    Convert a term name like 'Fall 2018-2019' or 'Spring 2025-2026'
    into an ordinal key we can compare for ranges.

    Example:
      Fall 2018-2019  -> 20180
      Spring 2018-2019 -> 20181
    """
    try:
        parts = term_name.split()
        if len(parts) < 2:
            return None

        season = parts[0]
        years = parts[1]  # '2018-2019'
        start_year = int(years.split('-')[0])

        season_order = {'Fall': 0, 'Spring': 1, 'Summer': 2}
        s_order = season_order.get(season, 9)

        return start_year * 10 + s_order
    except Exception:
        return None


LOWER_BOUND_KEY = term_key("Fall 2018-2019")
UPPER_BOUND_KEY = term_key("Spring 2025-2026")

# --- SETUP ---

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

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()),
                          options=chrome_options)

base_url = (
    "https://suis.sabanciuniv.edu/HbbmInst/"
    "SU_DEGREE.p_select_term?P_PROGRAM=BSCS&P_LANG=EN&P_LEVEL=UG"
)

driver.get(base_url)

# Wait until the term select is present
WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.NAME, "P_TERM")))

# Collect terms from the P_TERM select specifically (not all <option> on the page)
term_list = []
term_select = driver.find_element(By.NAME, "P_TERM")
for term in term_select.find_elements(By.TAG_NAME, "option"):
    term_value = term.get_attribute('value')
    term_name = term.text.strip()
    if term_value:
        term_list.append((term_name, term_value))

print(f"Found {len(term_list)} terms in dropdown.")

# --- SCRAPING: SUMMARY TABLE (t_mezuniyet) ---

summary_rows = []

for term_name, term_value in term_list:
    key = term_key(term_name)

    # Filter terms to the target range: Fall 2018-2019 .. Spring 2025-2026
    if key is None or key < LOWER_BOUND_KEY or key > UPPER_BOUND_KEY:
        print(f"Skipping term (out of range): {term_name}")
        continue

    print(f"\n Scraping SUMMARY table for term: {term_name}")

    # Reload base page each time to reset the form
    driver.get(base_url)
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "P_TERM")))

    # Select the relevant term by value
    term_select = driver.find_element(By.NAME, "P_TERM")
    for option in term_select.find_elements(By.TAG_NAME, "option"):
        if option.get_attribute("value") == term_value:
            option.click()
            break

    # Submit the form
    driver.find_element(By.NAME, "P_SUBMIT").click()

    # Wait for the summary table with class t_mezuniyet
    try:
        summary_table = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.t_mezuniyet"))
        )
    except Exception as e:
        print(f"   Could not find SUMMARY table for term {term_name}: {repr(e)}")
        continue

    # Rows are in <tbody> (there may be multiple <tbody>, but in your snippet there's one)
    tbodies = summary_table.find_elements(By.TAG_NAME, "tbody")
    if not tbodies:
        print(f"  ️ No <tbody> inside SUMMARY table for term {term_name}")
        continue

    body = tbodies[-1]  # use the last tbody where actual data rows live
    rows = body.find_elements(By.TAG_NAME, "tr")

    for row in rows:
        cells = row.find_elements(By.TAG_NAME, "td")
        if len(cells) < 4:
            continue

        course_category = cells[0].text.strip()
        min_ects = cells[1].text.strip()
        min_su = cells[2].text.strip()
        min_courses = cells[3].text.strip()

        # Push record
        summary_rows.append({
            "Term": term_name,
            "Course Category": course_category,
            "Min ECTS Credits": min_ects,
            "Min SU Credits": min_su,
            "Min Courses": min_courses,
        })

    # small pause to be polite
    time.sleep(1)

# --- SAVE OUTPUT ---

df_summary = pd.DataFrame(summary_rows)
df_summary.to_csv("bsCS_degree_summary_2018_2025.csv", index=False)

print("\nDONE! Degree requirement summary saved to 'bscs_degree_summary_2018_2025.csv'.")

driver.quit()
