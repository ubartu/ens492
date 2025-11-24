import asyncio, aiohttp, async_timeout
import os, re, json, random
from bs4 import BeautifulSoup

# =======================
# 1) COURSE LIST EXPANDER
# =======================
def expand_course_list(course_defs):
    """
    course_defs: senin verdiğin formatta liste
    return: scraper'ın beklediği düz liste
    """
    expanded = []
    for c in course_defs:
        sc = c["sc"]
        cn = str(c["cn"])
        sections = c.get("sections", [])

        # sections boş veya ["0"] ise section paramı kullanma
        if not sections or (len(sections) == 1 and str(sections[0]) == "0"):
            expanded.append({"sc": sc, "cn": cn})
        else:
            for s in sections:
                expanded.append({"sc": sc, "cn": cn, "section": str(s)})
    return expanded


BASE_URL = "https://apps.sabanciuniv.edu/courses/syllabus/view.php"

# =======================
# 2) LOGIN COOKIE (PASTE)
# =======================
# DevTools -> Network -> view.php isteği -> Request Headers -> Cookie
COOKIE_STR = ""     # <-- buraya yapıştır
VIEW_MODE = "su" if COOKIE_STR.strip() else "public"


# -----------------------
# yardımcılar
# -----------------------
def make_params(term, sc, cn, section=None):
    params = {"term": term, "sc": sc, "cn": str(cn), "view": VIEW_MODE}
    if section and str(section) != "0":
        params["section"] = str(section)
    return params

def fname_base(term, sc, cn, section=None):
    return f"{term}_{sc}_{cn}" + (f"_{section}" if section else "")


# =====================================
# 3) PROGRAM REQUIREMENTS (TABLE PARSE)
# =====================================
def parse_program_requirements(soup: BeautifulSoup):
    pr_header = soup.find(string=re.compile(r"Program Requirements", re.I))
    if not pr_header:
        return []

    pr_table = pr_header.find_next("table")
    if not pr_table:
        return []

    rows = pr_table.find_all("tr")
    if len(rows) < 2:
        return []

    headers = [th.get_text(" ", strip=True).lower() for th in rows[0].find_all(["th", "td"])]

    results = []
    for r in rows[1:]:
        cells = [td.get_text(" ", strip=True) for td in r.find_all(["th", "td"])]
        if not cells:
            continue

        program_name = cells[0]

        def has_star(val):
            return "*" in val

        entry = {"program": program_name}

        for h, v in zip(headers[1:], cells[1:]):
            if "required" in h:
                entry["required"] = has_star(v)
            elif "core elective" in h:
                entry["core_elective"] = has_star(v)
            elif "area elective" in h:
                entry["area_elective"] = has_star(v)

        entry.setdefault("required", False)
        entry.setdefault("core_elective", False)
        entry.setdefault("area_elective", False)

        results.append(entry)

    return results


def parse_syllabus(html: str):
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n")
    text = re.sub(r"\n{2,}", "\n", text).strip()

    SECTION_ENDERS = [
        "Course Learning Outcomes",
        "Course Objective",
        "Course Materials",
        "Assessment",
        "Policies",
        "AI Policies",
        "Sustainable Development Goals",
        "Instructor(s) Information",
        "Program Requirements",
        "©"
    ]

    # --- helper: başlıklar arası blok çekme ---
    def block_between(start_label, end_labels):
        hay = "\n" + text + "\n"
        start = re.search(
            rf"\n\s*{re.escape(start_label)}\s*\n",
            hay,
            flags=re.IGNORECASE
        )
        if not start:
            return None

        start_idx = start.end() - 1  # ilk karakteri yutmasın

        end_idx = None
        for el in end_labels:
            m_end = re.search(
                rf"\n\s*{re.escape(el)}\b",
                text[start_idx:],
                flags=re.IGNORECASE
            )
            if m_end:
                cand = start_idx + m_end.start()
                if end_idx is None or cand < end_idx:
                    end_idx = cand

        block = text[start_idx:end_idx].strip() if end_idx else text[start_idx:].strip()
        return block if block else None

    def normalize_block(s):
        if not s:
            return None
        s = s.replace("\r\n", "\n").replace("\r", "\n")
        s = re.sub(r"[ \t]+\n", "\n", s)
        s = re.sub(r"\n{2,}", "\n\n", s)
        return s.strip() or None

    # JSON'da \n görünmesin diye multiline'ı tek satıra indir
    def collapse_ws(s):
        if not s:
            return None
        s = re.sub(r"[\r\n\t]+", " ", s)
        s = re.sub(r"\s{2,}", " ", s)
        return s.strip() or None

    def normalize_resources(s):
        s = normalize_block(s)
        if not s:
            return None

        raw_lines = [ln.strip() for ln in s.splitlines() if ln.strip()]

        # ---- CASE 1: Bullet YOK ----
        if "•" not in s:
            items = []
            cur = ""
            for ln in raw_lines:
                has_url = bool(re.search(r"https?://|www\.", ln, flags=re.I))
                looks_like_new = bool(re.match(r"^[A-Z0-9].{0,60}[–—-]\s*", ln))
                starts_dash = ln.startswith(("-", "–", "—"))

                new_item = (not cur) or has_url or looks_like_new or starts_dash

                if new_item:
                    if cur:
                        items.append(collapse_ws(cur))
                    cur = ln.lstrip("-–— ").strip()
                else:
                    cur += " " + ln

            if cur:
                items.append(collapse_ws(cur))

            return [i for i in items if i] or None

        # ---- CASE 2: Bullet VAR ----
        s = s.replace("•", "\n•")
        lines = [ln.strip() for ln in s.splitlines() if ln.strip()]

        bullets = []
        current = ""

        for ln in lines:
            if ln.startswith("•"):
                if current:
                    bullets.append(collapse_ws(current))
                current = ln[1:].strip()
            else:
                if current.endswith("-"):
                    current = current[:-1] + ln.strip()
                else:
                    current += " " + ln.strip()

        if current:
            bullets.append(collapse_ws(current))

        return [b for b in bullets if b] or None

    # -------------------
    # A) COURSE HEADER INFO
    # -------------------
    wanted_labels = {
        "faculty": "faculty",
        "semester": "semester",
        "course": "course",
        "classroom": "classroom",
        "level of course": "level_of_course",
        "course credits": "course_credits",
        "prerequisites": "prerequisites",
        "corequisites": "corequisites",
        "course type": "course_type",
    }

    course_info = {v: None for v in wanted_labels.values()}

    lines = [l.strip() for l in text.splitlines()]
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ":" in ln:
            left, right = ln.split(":", 1)
            key = left.strip().lower()
            if key in wanted_labels:
                val = right.strip()
                if not val:
                    j = i + 1
                    while j < len(lines) and not lines[j]:
                        j += 1
                    val = lines[j] if j < len(lines) else None
                    i = j
                course_info[wanted_labels[key]] = val
        i += 1

    # -------------------
    # B) Catalog Course Description
    # -------------------
    catalog_desc = collapse_ws(
        normalize_block(block_between("Catalog Course Description", SECTION_ENDERS))
    )

    # -------------------
    # B2) Course Learning Outcomes
    # -------------------
    course_learning_outcomes = None

    lo_header = soup.find(string=re.compile(r"Course Learning Outcomes", re.I))
    if lo_header:
        lo_table = lo_header.find_next("table")
        if lo_table:
            outs = []
            for tr in lo_table.find_all("tr"):
                tds = [td.get_text(" ", strip=True) for td in tr.find_all(["td", "th"])]
                if len(tds) >= 2:
                    val = tds[-1].strip()
                    if val and "course learning outcomes" not in val.lower():
                        outs.append(collapse_ws(val))
            if outs:
                course_learning_outcomes = outs

    if not course_learning_outcomes:
        enders_wo_lo = [e for e in SECTION_ENDERS if e.lower() != "course learning outcomes"]
        lo_block = normalize_block(block_between("Course Learning Outcomes", enders_wo_lo))
        if lo_block:
            tmp = []
            for ln in lo_block.splitlines():
                ln = re.sub(r"^\d+\s*[\.\)]\s*", "", ln.strip())
                ln = re.sub(r"^[-•\u2022]\s*", "", ln)
                if ln:
                    tmp.append(collapse_ws(ln))
            course_learning_outcomes = [x for x in tmp if x] or None

    # -------------------
    # B3) Course Objective
    # -------------------
    enders_wo_obj = [e for e in SECTION_ENDERS if e.lower() != "course objective"]
    obj_raw = normalize_block(block_between("Course Objective", enders_wo_obj))

    course_objective = None
    if obj_raw:
        obj_lines = [l.strip() for l in obj_raw.splitlines() if l.strip()]
        bulletish = any(re.match(r"^[-•\u2022]\s*", l) for l in obj_lines)
        numbered = any(re.match(r"^\d+\s*[\.\)]\s*", l) for l in obj_lines)

        if bulletish or numbered:
            items = []
            for l in obj_lines:
                l = re.sub(r"^[-•\u2022]\s*", "", l)
                l = re.sub(r"^\d+\s*[\.\)]\s*", "", l)
                l = collapse_ws(l)
                if l:
                    items.append(l)
            course_objective = items or None
        else:
            course_objective = collapse_ws(obj_raw)

    # -------------------
    # C) Course Materials
    # -------------------
    resources = block_between("Resources:", ["Technology Requirements:"] + SECTION_ENDERS)
    tech_reqs = block_between("Technology Requirements:", SECTION_ENDERS)

    if resources:
        resources = re.split(
            r"(?:technology|echnology)\s+requirements\s*:?",
            resources,
            flags=re.IGNORECASE
        )[0].strip() or None

    if tech_reqs:
        if any(re.match(rf"^\s*{re.escape(e)}\b", tech_reqs, flags=re.IGNORECASE)
               for e in SECTION_ENDERS):
            tech_reqs = None
        elif "final grade for this course will be based on" in tech_reqs.lower():
            tech_reqs = None

    resources = normalize_resources(resources)
    tech_reqs = collapse_ws(normalize_block(tech_reqs))

    course_materials = {
        "resources": resources,
        "technology_requirements": tech_reqs
    }

    # -------------------
    # D) Assessment
    # -------------------
    assessment_percent = {}
    assess_header = soup.find(string=re.compile(r"Assessment", re.I))
    if assess_header:
        assess_table = assess_header.find_next("table")
        if assess_table:
            for tr in assess_table.find_all("tr"):
                tds = [td.get_text(" ", strip=True) for td in tr.find_all(["th", "td"])]
                if len(tds) >= 2:
                    name = tds[0].strip().lower()
                    perc_match = re.search(r"(\d+)\s*%", tds[1])
                    if perc_match:
                        assessment_percent[name] = int(perc_match.group(1))

    if not assessment_percent:
        assessment_block = block_between("Assessment", SECTION_ENDERS) or ""
        pairs = re.findall(
            r"(Final|Midterm|Quiz|Assignment|Project|Presentation|Lab|Group Project)\s+(\d+)\s*%",
            assessment_block,
            flags=re.IGNORECASE
        )
        for k, v in pairs:
            assessment_percent[k.lower()] = int(v)

        bonus = re.search(
            r"Participation\s*\(BONUS\)\s*:\s*(\d+)\s*%",
            assessment_block,
            flags=re.IGNORECASE
        )
        if bonus:
            assessment_percent["participation_bonus"] = int(bonus.group(1))

    # -------------------
    # E) Instructor(s) Information
    # -------------------
    instructors = []
    instr_block = block_between("Instructor(s) Information",
                               ["Course Information"] + SECTION_ENDERS)

    if instr_block:
        ilines = [l.strip() for l in instr_block.splitlines() if l.strip()]
        current_name = None
        i = 0
        while i < len(ilines):
            ln = ilines[i]
            if ":" not in ln and not ln.lower().startswith("instructor"):
                current_name = ln
                i += 1
                continue

            if re.match(r"e-?mail\s*:", ln, flags=re.IGNORECASE):
                after = ln.split(":", 1)[1].strip()
                if not after:
                    j = i + 1
                    while j < len(ilines) and not ilines[j]:
                        j += 1
                    after = ilines[j] if j < len(ilines) else None
                    i = j

                instructors.append({
                    "name": current_name,
                    "email": after or None
                })
                current_name = None
            i += 1

        if current_name and not any(x.get("name") == current_name for x in instructors):
            instructors.append({"name": current_name, "email": None})

    # -------------------
    # F) Program Requirements
    # -------------------
    program_requirements = parse_program_requirements(soup)

    return {
        "course_info": course_info,
        "instructors": instructors,
        "catalog_course_description": catalog_desc,
        "course_learning_outcomes": course_learning_outcomes,
        "course_objective": course_objective,
        "course_materials": course_materials,
        "assessment_percent": assessment_percent,
        "program_requirements": program_requirements
    }




# -----------------------
# resume için okuma/yazma
# -----------------------
def load_done_set(manifest_path):
    done = set()
    if not os.path.exists(manifest_path):
        return done
    with open(manifest_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
                done.add(obj["key"])
            except:
                pass
    return done

def append_manifest(manifest_path, record):
    with open(manifest_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


# -----------------------
# async fetch + retry
# -----------------------
async def fetch_one(session, term, sc, cn, section=None, max_retry=4):
    params = make_params(term, sc, cn, section)
    for attempt in range(max_retry):
        try:
            async with async_timeout.timeout(20):
                async with session.get(BASE_URL, params=params) as r:
                    if r.status == 200:
                        return await r.text(), 200
                    if r.status in (429, 500, 502, 503, 504):
                        await asyncio.sleep((2 ** attempt) + random.random())
                        continue
                    return None, r.status
        except asyncio.TimeoutError:
            await asyncio.sleep((2 ** attempt) + random.random())
        except aiohttp.ClientError:
            await asyncio.sleep((2 ** attempt) + random.random())
    return None, "retry_exhausted"

async def worker(name, queue, session, term, out_json, manifest_path, done_set, sem):
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            return

        sc, cn, section = item["sc"], item["cn"], item.get("section")
        key = fname_base(term, sc, cn, section)
        if key in done_set:
            queue.task_done()
            continue

        async with sem:
            html, status = await fetch_one(session, term, sc, cn, section)

        if html:
            os.makedirs(out_json, exist_ok=True)

            base = fname_base(term, sc, cn, section)
            json_path = os.path.join(out_json, base + ".json")

            parsed = parse_syllabus(html)
            parsed.update({"term": term, "sc": sc, "cn": cn, "section": section, "key": key})

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)

            append_manifest(manifest_path, {"key": key, "status": "ok"})
            done_set.add(key)
            print(f"[OK] {base}")
        else:
            append_manifest(manifest_path, {"key": key, "status": status})
            print(f"[MISS] {key} status={status}")

        await asyncio.sleep(random.uniform(0.4, 0.9))
        queue.task_done()


async def scrape_all_async(courses, term="202501", concurrency=4, out_dir="syllabus_dump"):
    out_json = os.path.join(out_dir, "parsed_json")
    manifest_path = os.path.join(out_dir, "manifest.jsonl")
    os.makedirs(out_dir, exist_ok=True)

    done_set = load_done_set(manifest_path)

    queue = asyncio.Queue()
    for c in courses:
        await queue.put(c)

    sem = asyncio.Semaphore(concurrency)

    headers = {"User-Agent": "SU-syllabus-scraper/1.0 (academic use)"}
    if COOKIE_STR.strip():
        headers["Cookie"] = COOKIE_STR.strip()

    timeout = aiohttp.ClientTimeout(total=30)

    async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
        workers = [
            asyncio.create_task(
                worker(f"W{i}", queue, session, term, out_json, manifest_path, done_set, sem)
            )
            for i in range(concurrency)
        ]

        await queue.join()

        for _ in workers:
            await queue.put(None)
        await asyncio.gather(*workers)

    return len(done_set)

def expand_course_list(course_defs):
    expanded = []
    for c in course_defs:
        sc = c["sc"]
        cn = str(c["cn"])
        sections = c.get("sections", [])

        if not sections or (len(sections) == 1 and str(sections[0]) == "0"):
            expanded.append({"sc": sc, "cn": cn})
        else:
            for s in sections:
                expanded.append({"sc": sc, "cn": cn, "section": str(s)})
    return expanded


def load_and_expand(path="course_list.json"):
    with open(path, "r", encoding="utf-8") as f:
        course_defs = json.load(f)      # <-- uzun liste buradan geliyor

    courses = expand_course_list(course_defs)

    # opsiyonel: aynı ders/section duplikelerini temizle
    seen = set()
    uniq = []
    for c in courses:
        key = (c["sc"], c["cn"], c.get("section"))
        if key not in seen:
            seen.add(key)
            uniq.append(c)

    return uniq
# -----------------------
# ÖRNEK ÇALIŞTIRMA
# -----------------------
if __name__ == "__main__":
    courses = load_and_expand("course_list.json")

   
    asyncio.run(
        scrape_all_async(
            courses,
            term="202501",
            concurrency=4,        
            out_dir="syllabus_dump_202501"
        )
    )
