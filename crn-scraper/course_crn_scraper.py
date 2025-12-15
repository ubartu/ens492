from typing import List, Dict
import requests
import json
import sys
from bs4 import BeautifulSoup

BASE_URL = "https://suis.sabanciuniv.edu/prod"


def get_course_codes(term: int) -> List[str]:
    """
    Banner'dan bölüm kodlarını (SUBJ) çekiyor.
    """
    payload = {
        "p_calling_proc": "bwckschd.p_disp_dyn_sched",
        "p_term": term,
    }
    headers = {"Content-type": "application/x-www-form-urlencoded"}

    resp = requests.post(
        f"{BASE_URL}/bwckgens.p_proc_term_date",
        data=payload,
        headers=headers,
    )
    resp.raise_for_status()

    source = BeautifulSoup(resp.content, "html.parser")
    course_codes: List[str] = [opt.get("value") for opt in source.find_all("option")]

    # Sadece büyük harf ve harflerden oluşanları al
    course_codes = [code for code in course_codes if code and code.isupper() and code.isalpha()]

    # Banner'ın istediği gibi ilk elemana dummy
    course_codes.insert(0, "dummy")
    return course_codes


def get_courses_with_crn(term: int) -> List[Dict]:
    """
    Her ders için (isim, kod, CRN, grup) listesi döner.
    """
    codes = get_course_codes(term)

    payload = {
        "term_in": term,
        "sel_subj": codes,
        "sel_day": "dummy",
        "sel_schd": "dummy",
        "sel_insm": "dummy",
        "sel_camp": "dummy",
        "sel_levl": "dummy",
        "sel_sess": "dummy",
        "sel_instr": "dummy",
        "sel_ptrm": "dummy",
        "sel_attr": "dummy",
        "sel_crse": "",
        "sel_title": "",
        "sel_from_cred": "",
        "sel_to_cred": "",
        "begin_hh": "0",
        "begin_mi": "0",
        "begin_ap": "a",
        "end_hh": "0",
        "end_mi": "0",
        "end_ap": "a",
    }
    headers = {"Content-type": "application/x-www-form-urlencoded"}

    resp = requests.post(
        f"{BASE_URL}/bwckschd.p_get_crse_unsec",
        data=payload,
        headers=headers,
    )
    resp.raise_for_status()

    source = BeautifulSoup(resp.content, "html.parser")
    courses = source.find_all("th", attrs={"class": "ddlabel"})

    result: List[Dict] = []

    for course in courses:
        a = course.find("a")
        if not a:
            continue

        # Orijinal mantık: text'i '-' ile böl
        title_parts = [p.strip() for p in a.text.split("-")]

        if len(title_parts) < 3:
            continue

        # "name": title[0], "crn": title[-3], "code": title[-2], "group": title[-1]
        name = title_parts[0]
        crn = title_parts[-3]
        code = title_parts[-2]
        group = title_parts[-1]

        result.append(
            {
                "name": name,
                "code": code,
                "crn": crn,
                "group": group,
            }
        )

    return result


def write_crn_json(courses: List[Dict], filename: str = "crns.json") -> None:
    """
    CRN bilgilerini JSON'a yazar.
    """
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=2)


