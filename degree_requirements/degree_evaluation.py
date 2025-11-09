from typing import List, Dict, Any, Optional
import json
from pathlib import Path

# ---------------------------
# Helpers
# ---------------------------

def _num(x: Any) -> float:
    if x is None:
        return 0.0
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0


def _build_index(catalog: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    idx: Dict[str, Dict[str, Any]] = {}
    for row in catalog:
        major = str(row.get("Major", "")).strip().upper()
        code = str(row.get("Code", "")).strip().upper()
        if major and code:
            idx[f"{major}{code}"] = row
    return idx


# ---------------------------
# 1) Transcript -> Totals
# ---------------------------

def add_courses_to_totals(
    taken_codes: List[str],
    catalog: List[Dict[str, Any]],
) -> Dict[str, Any]:
    idx = _build_index(catalog)

    totals: Dict[str, Any] = {
        "total_credit": 0,
        "total_area": 0,
        "total_core": 0,
        "total_free": 0,
        "total_university": 0,
        "total_university_count": 0,
        "total_required": 0,
        "total_science_ects": 0.0,
        "total_engineering_ects": 0.0,
        "total_ects": 0.0,
        "faculty_counts": {"FENS": 0, "FASS": 0, "SBS": 0, "OTHER": 0},
        "math_count": 0,
        "taken_keys": set(),
        "unknown_codes": [],
    }

    for raw_code in taken_codes:
        key = str(raw_code).strip().upper()
        row = idx.get(key)
        if not row:
            totals["unknown_codes"].append(raw_code)
            continue

        credit = int(_num(row.get("SU_credit")))
        eng = _num(row.get("Engineering"))
        sci = _num(row.get("Basic_Science"))
        ects = _num(row.get("ECTS"))

        totals["total_credit"] += credit
        totals["total_engineering_ects"] += eng
        totals["total_science_ects"] += sci
        totals["total_ects"] += ects

        el_type = str(row.get("EL_Type", "")).strip().lower()
        if el_type == "free":
            totals["total_free"] += credit
        elif el_type == "area":
            totals["total_area"] += credit
        elif el_type == "core":
            totals["total_core"] += credit
        elif el_type == "university":
            totals["total_university"] += credit
            totals["total_university_count"] += 1
        elif el_type == "required":
            totals["total_required"] += credit

        faculty = str(row.get("Faculty", "")).strip().upper()
        if faculty in ("FENS", "FASS", "SBS"):
            totals["faculty_counts"][faculty] += 1
        else:
            totals["faculty_counts"]["OTHER"] += 1

        major = str(row.get("Major", "")).strip().upper()
        if major in {"MATH", "MAT"}:
            totals["math_count"] += 1

        totals["taken_keys"].add(key)

    return totals


# ---------------------------
# 2) Spillover
# ---------------------------

def _apply_spillover(
    missing_dict: Dict[str, int],  # şu anda eksik olan krediler
    have_dict: Dict[str, int],     # elimizde olan (raw)
    spillover_enabled: bool
) -> Dict[str, int]:
    """
    missing_dict: core/area/free için şu anda eksik miktar
    have_dict:    öğrencinin elindeki core/area/free kredileri
    Eğer spillover_enabled True ise:
      - core > 31 fazlası area eksikliğini azaltabilir
      - toplam area > 9 fazlası free eksikliğini azaltabilir
    """
    missing = dict(missing_dict)
    have = dict(have_dict)

    if not spillover_enabled:
        # Sadece negatif olmasın diye sıfıra sabitle
        for k in ("core", "area", "free"):
            missing[k] = max(0, missing.get(k, 0))
        return missing

    # core > 31 fazlası area'ya, toplam area > 9 fazlası free'ye
    CORE_MIN_FOR_SPILLOVER = 31
    AREA_MIN_FOR_SPILLOVER = 9

    # Core fazlasını hesapla ve önce area eksikliğini azalt
    core_surplus = max(0, have.get("core", 0) - CORE_MIN_FOR_SPILLOVER)
    if core_surplus > 0 and missing.get("area", 0) > 0:
        used = min(core_surplus, missing["area"])
        missing["area"] -= used
        core_surplus -= used

    # Toplam area (doğrudan area + core'dan kalan fazlalık) ile free eksikliğini azalt
    total_area_with_spill = have.get("area", 0) + core_surplus
    area_surplus = max(0, total_area_with_spill - AREA_MIN_FOR_SPILLOVER)
    if area_surplus > 0:
        missing["free"] = max(0, missing.get("free", 0) - area_surplus)

    # Negatif değerleri sıfıra sabitle
    for k in ("core", "area", "free"):
        missing[k] = max(0, missing.get(k, 0))

    return missing


# ---------------------------
# 3) Evaluate
# ---------------------------

def evaluate_against_rules(
    totals: Dict[str, Any],
    rules: Dict[str, Any],
    gpa: Optional[float] = None,
    shared_university_rules: Optional[Dict[str, Any]] = None
) -> tuple:
    # Mezuniyet durumu
    can_graduate = True
    blocking_reasons: List[str] = []

    # Eksik dersler
    missing_required_courses: List[str] = []
    missing_university_freshman_courses: List[str] = []
    missing_university_must_courses: List[str] = []
    missing_hum_any_courses: List[str] = []

    # Seçmeli dersler
    electives_required: Dict[str, int] = {}
    electives_missing: Dict[str, int] = {}
    electives_have_effective: Dict[str, int] = {}
    electives_spillover_enabled: bool = False

    # Fakülte gereksinimleri
    faculty_required: Dict[str, int] = {}
    faculty_have: Dict[str, int] = {}

    # ECTS gereksinimleri
    buckets_required: Dict[str, float] = {}
    buckets_have: Dict[str, float] = {}

    # Genel toplamlar
    overall_required: Dict[str, int] = {}
    overall_have: Dict[str, int] = {}

    # Bilinmeyen ders kodları
    unknown_codes = totals.get("unknown_codes", [])

    taken_set = totals.get("taken_keys", set())

    # GPA kontrolü
    if gpa is not None and gpa < 2.0:
        can_graduate = False
        blocking_reasons.append(f"GPA {gpa:.2f} (< 2.00)")

    # Zorunlu dersler (major)
    required_rules = rules.get("required", {}) or {}
    must_all = required_rules.get("must_all", []) or []
    missing_required_courses = [c for c in must_all if c.upper().strip() not in taken_set]
    if missing_required_courses:
        can_graduate = False
        blocking_reasons.append(f"Missing required courses: {', '.join(missing_required_courses)}")

    required_totals_cfg = required_rules.get("totals", {}) or {}
    req_min_courses = int(_num(required_totals_cfg.get("min_courses", 0)))
    req_min_su = int(_num(required_totals_cfg.get("min_su", 0)))
    required_taken_count = len(must_all) - len(missing_required_courses)
    if req_min_courses > 0 and required_taken_count < req_min_courses:
        can_graduate = False
        blocking_reasons.append(
            f"Required course count {required_taken_count}/{req_min_courses}"
        )
    if req_min_su > 0 and totals.get("total_required", 0) < req_min_su:
        can_graduate = False
        blocking_reasons.append(
            f"Required SU credits {totals.get('total_required', 0)}/{req_min_su}"
        )

    # Seçmeli dersler
    el = rules.get("electives", {}) or {}
    electives_required = {
        "core": int(_num(el.get("core_su", 0))),   # toplamda istenen minimum SU
        "area": int(_num(el.get("area_su", 0))),
        "free": int(_num(el.get("free_su", 0))),
    }
    electives_spillover_enabled = bool(el.get("spillover", False))

    electives_have_raw = {
        "core": int(totals.get("total_core", 0)),
        "area": int(totals.get("total_area", 0)),
        "free": int(totals.get("total_free", 0)),
    }

    # İlk eksik miktar (spillover öncesi)
    electives_missing_raw = {
        "core": max(0, electives_required["core"] - electives_have_raw["core"]),
        "area": max(0, electives_required["area"] - electives_have_raw["area"]),
        "free": max(0, electives_required["free"] - electives_have_raw["free"]),
    }

    # Spillover uygulandıktan sonra eksik miktar
    electives_missing = _apply_spillover(
        electives_missing_raw,
        electives_have_raw,
        electives_spillover_enabled
    )

    # Spillover sonrası “etkin” olarak sayılan krediler (raporlama için)
    if electives_spillover_enabled:
        CORE_MIN_FOR_SPILLOVER = 31
        AREA_MIN_FOR_SPILLOVER = 9

        core_surplus = max(0, electives_have_raw["core"] - CORE_MIN_FOR_SPILLOVER)
        total_area_with_spill = electives_have_raw["area"] + core_surplus
        electives_have_effective = {
            "core": electives_have_raw["core"],
            "area": min(AREA_MIN_FOR_SPILLOVER, total_area_with_spill),
            "free": electives_have_raw["free"] + max(0, total_area_with_spill - AREA_MIN_FOR_SPILLOVER),
        }
    else:
        electives_have_effective = dict(electives_have_raw)

    # Eğer herhangi bir eksik varsa, mezuniyeti blokla
    if sum(electives_missing.values()) > 0:
        can_graduate = False
        blocking_reasons.append(f"Electives missing: {electives_missing}")

    # Fakülte gereksinimleri
    fac_cfg = rules.get("faculty", {}) or {}
    _fc = totals.get("faculty_counts", {}) or {}

    faculty_required = {
        "min_count": int(_num(fac_cfg.get("min_count", 0))),
        "min_math": int(_num(fac_cfg.get("min_math", 0))),
        "min_fens": int(_num(fac_cfg.get("min_fens", 0))),
        "min_fass": int(_num(fac_cfg.get("min_fass", 0))),
        "min_sbs": int(_num(fac_cfg.get("min_sbs", 0))),
    }
    faculty_have = {
        "count": sum(_fc.values()),
        "math": totals.get("math_count", 0),
        "fens": _fc.get("FENS", 0),
        "fass": _fc.get("FASS", 0),
        "sbs": _fc.get("SBS", 0),
    }
    faculty_missing = {
        "count": max(0, faculty_required["min_count"] - faculty_have["count"]),
        "math": max(0, faculty_required["min_math"] - faculty_have["math"]),
        "fens": max(0, faculty_required["min_fens"] - faculty_have["fens"]),
        "fass": max(0, faculty_required["min_fass"] - faculty_have["fass"]),
        "sbs": max(0, faculty_required["min_sbs"] - faculty_have["sbs"]),
    }
    # Sıfır olanları mesajda göstermemek için filtreleyelim
    faculty_missing_filtered = {k: v for k, v in faculty_missing.items() if v > 0}
    if faculty_missing_filtered:
        can_graduate = False
        blocking_reasons.append(f"Faculty constraints missing: {faculty_missing_filtered}")

    # ECTS gereksinimleri
    b = rules.get("buckets", {}) or {}
    buckets_required = {
        "engineering_ects": _num(b.get("engineering_ects", 0)),
        "basic_science_ects": _num(b.get("basic_science_ects", 0)),
    }
    buckets_have = {
        "engineering_ects": totals.get("total_engineering_ects", 0.0),
        "basic_science_ects": totals.get("total_science_ects", 0.0),
    }
    buckets_missing = {
        "engineering_ects": max(0.0, buckets_required["engineering_ects"] - buckets_have["engineering_ects"]),
        "basic_science_ects": max(0.0, buckets_required["basic_science_ects"] - buckets_have["basic_science_ects"]),
    }
    if buckets_missing["engineering_ects"] > 0 or buckets_missing["basic_science_ects"] > 0:
        can_graduate = False
        blocking_reasons.append(f"ECTS buckets missing: {buckets_missing}")

    # UNIVERSITY (shared_university_rule.json)
    if shared_university_rules:
        uni_totals_cfg = shared_university_rules.get("totals", {}) or {}
        freshman_all = shared_university_rules.get("freshman_all", []) or []
        uni_must_all = shared_university_rules.get("must_all", []) or []
        hum_any_list = shared_university_rules.get("hum_any", []) or []

        missing_university_freshman_courses = [
            c for c in freshman_all if c.upper().strip() not in taken_set
        ]
        missing_university_must_courses = [
            c for c in uni_must_all if c.upper().strip() not in taken_set
        ]
        hum_any_taken = any(c.upper().strip() in taken_set for c in hum_any_list)
        missing_hum_any_courses = [] if hum_any_taken else hum_any_list[:]

        min_uni_courses = int(_num(uni_totals_cfg.get("min_courses", 0)))
        min_uni_su = int(_num(uni_totals_cfg.get("min_su", 0)))

        have_uni_courses = int(totals.get("total_university_count", 0))
        have_uni_su = int(totals.get("total_university", 0))

        need_uni_courses = max(0, min_uni_courses - have_uni_courses)
        need_uni_su = max(0, min_uni_su - have_uni_su)

        if (
            missing_university_freshman_courses
            or missing_university_must_courses
            or missing_hum_any_courses
            or need_uni_courses > 0
            or need_uni_su > 0
        ):
            can_graduate = False
            msgs: List[str] = []
            if missing_university_freshman_courses:
                msgs.append(f"University freshman missing: {', '.join(missing_university_freshman_courses)}")
            if missing_university_must_courses:
                msgs.append(f"University must_all missing: {', '.join(missing_university_must_courses)}")
            if missing_hum_any_courses:
                msgs.append(f"Take at least one of HUM-any: {', '.join(missing_hum_any_courses)}")
            if need_uni_courses > 0:
                msgs.append(f"University course count missing: need {need_uni_courses}")
            if need_uni_su > 0:
                msgs.append(f"University SU credits missing: need {need_uni_su}")
            blocking_reasons.append(" | ".join(msgs))

    # Genel toplamlar
    totals_required_cfg = rules.get("totals", {}) or {}
    overall_required = {
        "su": int(_num(totals_required_cfg.get("min_su", 0))),
        "ects": int(_num(totals_required_cfg.get("min_ects", 0))),
    }
    overall_have = {
        "su": int(totals.get("total_credit", 0)),
        "ects": int(_num(totals.get("total_ects", 0))),
    }
    overall_missing = {
        "su": max(0, overall_required["su"] - overall_have["su"]),
        "ects": max(0, overall_required["ects"] - overall_have["ects"]),
    }
    if overall_missing["su"] > 0 or overall_missing["ects"] > 0:
        can_graduate = False
        blocking_reasons.append(f"Overall totals missing: {overall_missing}")

    return (
       can_graduate,
        blocking_reasons,
        missing_required_courses,
        missing_university_freshman_courses,
        missing_university_must_courses,
        missing_hum_any_courses,
        electives_required,
        electives_missing,
        electives_have_effective,
        electives_spillover_enabled,
        faculty_required,
        faculty_have,
        faculty_missing,
        buckets_required,
        buckets_have,
        buckets_missing,
        overall_required,
        overall_have,
        overall_missing,
        unknown_codes,
    )


# ---------------------------
# 4) Major'a göre dosya yükleyici
# ---------------------------

def load_catalog_and_rules(base_dir: str, major: str) -> Dict[str, Any]:
    """
    major (CS, IE, EE, MAT, ME, BIO, ECON ...) için:
      - catalog/{MAJOR}.json
      - rules/{major_lower}_rule.json
    ve ortak:
      - rules/shared_university_rule.json

    Döndürür:
    {
      "catalog": [...],
      "rules": {...},
      "shared_university": {... or None}
    }
    """
    m_upper = major.strip().upper()
    m_lower = major.strip().lower()

    base = Path(base_dir)
    catalog_fp = base / "catalog" / f"{m_upper}.json"
    rules_fp = base / "rules" / f"{m_lower}_rule.json"
    shared_fp = base / "rules" / "shared_university_rule.json"

    with open(catalog_fp, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    with open(rules_fp, "r", encoding="utf-8") as f:
        rules = json.load(f)

    shared = None
    if shared_fp.exists():
        with open(shared_fp, "r", encoding="utf-8") as f:
            shared = json.load(f)

    return {"catalog": catalog, "rules": rules, "shared_university": shared}


def evaluate_to_dict(
    base_dir: str,
    major: str,
    taken_courses: List[str],
    gpa: Optional[float] = None
) -> Dict[str, Any]:
    data = load_catalog_and_rules(base_dir, major)
    catalog = data["catalog"]
    rules = data["rules"]
    shared_rules = data["shared_university"]

    totals = add_courses_to_totals(taken_courses, catalog)

    (
        can_graduate,
        blocking_reasons,
        missing_required_courses,
        missing_university_freshman_courses,
        missing_university_must_courses,
        missing_hum_any_courses,
        electives_required,
        electives_missing,
        electives_have_effective,
        electives_spillover_enabled,
        faculty_required,
        faculty_have,
        faculty_missing,
        buckets_required,
        buckets_have,
        buckets_missing,
        overall_required,
        overall_have,
        overall_missing,
        unknown_codes,
    ) = evaluate_against_rules(totals, rules, gpa=gpa, shared_university_rules=shared_rules)

    

    result = {
        "major": major,
        "gpa": gpa,
        "required courses": {
            "missing": missing_required_courses,
        },
        "university courses": {
            "missing_freshman": missing_university_freshman_courses,
            "missing_must": missing_university_must_courses,
            "missing_hum_any": missing_hum_any_courses,
        },
        "electives": {
            
            "have": electives_have_effective,
            "required": electives_required,
            "missing": electives_missing,
            
            
        },
        "buckets": {  #enginering and basic science ects
            "have": buckets_have,
            "required": buckets_required,
            "missing": buckets_missing,
        },
        "faculty": {
            "have": faculty_have,
            "required": faculty_required,
            "missing": faculty_missing,
        },
        "overall": {
            "have": overall_have,
            "required": overall_required,
            "missing": overall_missing,
        },
        "can_graduate": can_graduate,
    }
    return result


def evaluate_to_json(
    base_dir: str,
    major: str,
    taken_courses: List[str],
    gpa: Optional[float] = None,
    write_to: Optional[str] = None
) -> str:
    result = evaluate_to_dict(base_dir, major, taken_courses, gpa=gpa)
    s = json.dumps(result, ensure_ascii=False, indent=2)
    if write_to:
        Path(write_to).write_text(s, encoding="utf-8")
    return s


''' Sample json output:
{
  "major": "CS",
  "gpa": 3.0,
  "required courses": {
    "missing": [
      "CS308",
      "CS395",
      "MATH212"
    ]
  },
  "university courses": {
    "missing_freshman": [],
    "missing_must": [
      "PROJ201"
    ],
    "missing_hum_any": []
  },
  "electives": {
    "have": {
      "core": 12,
      "area": 9,
      "free": 6
    },
    "required": {
      "core": 27,
      "area": 9,
      "free": 15
    },
    "missing": {
      "core": 15,
      "area": 0,
      "free": 9
    }
  },
  "buckets": {
    "have": {
      "engineering_ects": 71.0,
      "basic_science_ects": 56.0
    },
    "required": {
      "engineering_ects": 90.0,
      "basic_science_ects": 60.0
    },
    "missing": {
      "engineering_ects": 19.0,
      "basic_science_ects": 4.0
    }
  },
  "faculty": {
    "have": {
      "count": 35,
      "math": 5,
      "fens": 22,
      "fass": 8,
      "sbs": 2
    },
    "required": {
      "min_count": 5,
      "min_math": 2,
      "min_fens": 3,
      "min_fass": 0,
      "min_sbs": 0
    },
    "missing": {
      "count": 0,
      "math": 0,
      "fens": 0,
      "fass": 0,
      "sbs": 0
    }
  },
  "overall": {
    "have": {
      "su": 99,
      "ects": 185
    },
    "required": {
      "su": 132,
      "ects": 240
    },
    "missing": {
      "su": 33,
      "ects": 55
    }
  },
  "can_graduate": false
}

'''