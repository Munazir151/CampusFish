import asyncio
import json
import re
from datetime import date, datetime, timedelta, timezone

import httpx

from .config import settings

CATEGORIES = [
    "EXAM_TIMETABLE",
    "FEE_OR_FORM_DEADLINE",
    "MAKEUP_OR_REVALUATION",
    "RESULT",
    "SCHOLARSHIP",
    "EDUCATION_LOAN",
    "INTERNSHIP",
    "JOB_OR_PLACEMENT",
    "COMPETITION",
    "RESEARCH_PROGRAMME",
    "STUDENT_WELFARE",
    "ACADEMIC_POLICY",
    "HOLIDAY_OR_GENERAL",
]

CATEGORY_LABELS = {
    "EXAM_TIMETABLE": "Examinations",
    "FEE_OR_FORM_DEADLINE": "Fees & applications",
    "MAKEUP_OR_REVALUATION": "Re-evaluation",
    "RESULT": "Results",
    "SCHOLARSHIP": "Scholarships",
    "EDUCATION_LOAN": "Education loans",
    "INTERNSHIP": "Internships",
    "JOB_OR_PLACEMENT": "Jobs & placements",
    "COMPETITION": "Competitions",
    "RESEARCH_PROGRAMME": "Research programmes",
    "STUDENT_WELFARE": "Student welfare",
    "ACADEMIC_POLICY": "Academic policy",
    "HOLIDAY_OR_GENERAL": "General notices",
}

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}
MONTH_RE = "(" + "|".join(sorted(MONTHS, key=len, reverse=True)) + ")"

DATE_PATTERNS = [
    re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),
    re.compile(r"\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b"),
    re.compile(r"\b(\d{1,2})[-](\d{1,2})[-](\d{4})\b"),
    re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+{MONTH_RE},?\s+(\d{{4}})\b", re.IGNORECASE),
    re.compile(rf"\b{MONTH_RE}\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})\b", re.IGNORECASE),
]

DEADLINE_KEYWORDS = [
    "last date", "last day", "deadline", "due date", "on or before",
    "submit on or before", "before", "latest by", "closing date",
    "apply by", "apply on or before", "remit", "payment on or before",
    "up to", "till",
]

BRANCH_ALIASES = {
    "CSE": ["cse", "computer science", "computer science and engineering"],
    "CSE-AIML": ["aiml", "ai & ml", "ai and ml", "artificial intelligence and machine learning", "ai/ml"],
    "AIML": ["aiml"],
    "AIDS": ["aids", "ai & ds", "artificial intelligence and data science"],
    "DS": ["data science"],
    "ISE": ["ise", "information science"],
    "IT": ["information technology"],
    "ECE": ["ece", "electronics and communication"],
    "EEE": ["eee", "electrical and electronics"],
    "MECH": ["mech", "mechanical"],
    "CIVIL": ["civil"],
    "AERO": ["aero", "aeronautical"],
    "AUTO": ["automobile"],
    "BIOTECH": ["biotech", "biotechnology"],
    "CHEM": ["chemical engineering"],
}

SCHEME_RE = re.compile(r"\b(20\d{2})\s*(?:-|–)?\s*(?:scheme|cbcs|regulation)\b", re.IGNORECASE)
SEM_RE = re.compile(
    r"\b(?:(\d)(?:st|nd|rd|th)?|(i{1,3}|iv|v|vi{0,3}|viii))\s*(?:sem|semester)\b",
    re.IGNORECASE,
)
SEM_WORDS = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8"}

OPPORTUNITY_CATEGORIES = {
    "SCHOLARSHIP", "EDUCATION_LOAN", "INTERNSHIP", "JOB_OR_PLACEMENT",
    "COMPETITION", "RESEARCH_PROGRAMME",
}

ELIGIBILITY_CATEGORY_PATTERNS = [
    ("SC", r"\bSC\b", 0),
    ("ST", r"\bST\b", 0),
    ("OBC", r"\bOBC\b", 0),
    ("EWS", r"\bEWS\b", 0),
    ("Minority", r"\bminorit(?:y|ies)\b", re.IGNORECASE),
    ("PwD", r"\bPwD\b|\bpersons? with disabilit(?:y|ies)\b|\bdivyang\b", re.IGNORECASE),
    ("General", r"\bgeneral category\b", re.IGNORECASE),
]

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands",
    "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
    "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
]

MONEY_RE = re.compile(
    r"(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|crores|thousand|k)?",
    re.IGNORECASE,
)
MONEY_WORD_RE = re.compile(r"\b([\d,]+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|crores)\b", re.IGNORECASE)
INCOME_WINDOW_RE = re.compile(r"(?:annual|family|parental|household)?\s*income[^\n]{0,120}", re.IGNORECASE)


def _safe_date(y: int, m: int, d: int) -> date | None:
    try:
        result = date(y, m, d)
    except ValueError:
        return None
    if not (2015 <= result.year <= 2035):
        return None
    return result


def find_dates(text: str) -> list[tuple[int, date]]:
    found: dict[tuple[int, date], None] = {}
    for pattern in DATE_PATTERNS:
        for match in pattern.finditer(text):
            groups = match.groups()
            parsed: date | None = None
            if pattern is DATE_PATTERNS[0]:
                parsed = _safe_date(int(groups[0]), int(groups[1]), int(groups[2]))
            elif pattern in (DATE_PATTERNS[1], DATE_PATTERNS[2]):
                parsed = _safe_date(int(groups[2]), int(groups[1]), int(groups[0]))
            elif pattern is DATE_PATTERNS[3]:
                parsed = _safe_date(int(groups[2]), MONTHS[groups[1].lower()], int(groups[0]))
            elif pattern is DATE_PATTERNS[4]:
                parsed = _safe_date(int(groups[2]), MONTHS[groups[0].lower()], int(groups[1]))
            if parsed:
                found[(match.start(), parsed)] = None
    return sorted(found.keys(), key=lambda item: item[0])


def parse_published_date(raw: str | None) -> str | None:
    if not raw:
        return None
    raw = str(raw).strip()
    dates = find_dates(raw)
    if dates:
        return dates[0][1].isoformat()
    if raw.lower() in {"today", "yesterday"}:
        delta = 0 if raw.lower() == "today" else 1
        return (datetime.now(timezone.utc).date() - timedelta(days=delta)).isoformat()
    return None


def extract_deadline(text: str) -> str | None:
    lowered = text.lower()
    candidates: list[date] = []
    for keyword in DEADLINE_KEYWORDS:
        for match in re.finditer(re.escape(keyword), lowered):
            window = text[match.end(): match.end() + 90]
            dates = find_dates(window)
            if dates:
                candidates.append(dates[0][1])
                break
    if candidates:
        return min(candidates).isoformat()

    all_dates = [d for _, d in find_dates(text)]
    if not all_dates:
        return None
    today = datetime.now(timezone.utc).date()
    upcoming = [d for d in all_dates if d >= today - timedelta(days=1)]
    return (min(upcoming) if upcoming else min(all_dates)).isoformat()


def extract_branches(text: str) -> list[str]:
    lowered = text.lower()
    found: list[str] = []
    for canonical, aliases in BRANCH_ALIASES.items():
        for alias in aliases:
            if re.search(rf"(?<![a-z]){re.escape(alias)}(?![a-z])", lowered):
                if canonical not in found:
                    found.append(canonical)
                break
    return found


def extract_semesters(text: str) -> list[str]:
    semesters: list[str] = []
    for match in SEM_RE.finditer(text):
        value = match.group(1) or SEM_WORDS.get((match.group(2) or "").lower())
        if value and value not in semesters:
            semesters.append(value)
    return semesters


def extract_schemes(text: str) -> list[str]:
    return sorted({m.group(1) for m in SCHEME_RE.finditer(text)})


def _amount_value(token: str, unit: str) -> int | None:
    try:
        value = float(str(token).replace(",", ""))
    except ValueError:
        return None
    multiplier = {
        "lakh": 100000, "lakhs": 100000, "lac": 100000, "lacs": 100000,
        "crore": 10000000, "crores": 10000000, "thousand": 1000, "k": 1000,
    }.get((unit or "").lower(), 1)
    amount = int(round(value * multiplier))
    return amount if 100 <= amount <= 10_000_000_000 else None


def _money_matches(text: str) -> list[tuple[int, tuple[int, int]]]:
    matches: list[tuple[int, tuple[int, int]]] = []
    seen_starts: set[int] = set()
    for pattern in (MONEY_RE, MONEY_WORD_RE):
        for match in pattern.finditer(text):
            start, end = match.span()
            # The currency pattern and the word pattern can capture the same amount
            # from different offsets; keep only the first overlapping match.
            if any(start < existing_end and existing_start < end for _, (existing_start, existing_end) in matches):
                continue
            value = _amount_value(match.group(1), match.group(2) or "")
            if value is None:
                continue
            matches.append((value, (start, end)))
            seen_starts.add(start)
    return sorted(matches, key=lambda item: item[1][0])


def _extract_eligibility_categories(text: str) -> list[str]:
    found = [
        label
        for label, pattern, flags in ELIGIBILITY_CATEGORY_PATTERNS
        if re.search(pattern, text, flags)
    ]
    return found


def _extract_domicile(text: str) -> str | None:
    if re.search(r"\ball[ -]india\b", text, re.IGNORECASE):
        return "All India"
    windows = [
        text[max(0, match.start() - 40): match.end() + 90]
        for match in re.finditer(r"domicile|resident|bonafide", text, re.IGNORECASE)
    ]
    for window in windows:
        for state in sorted(INDIAN_STATES, key=len, reverse=True):
            if re.search(rf"\b{re.escape(state)}\b", window, re.IGNORECASE):
                return state
    return None


def _extract_course_level(text: str) -> str | None:
    checks = [
        ("PhD", r"\bph\.?d\b|\bdoctor(?:al|ate)\b"),
        ("Postgraduate", r"\bpost[ -]?graduate\b|\bPG\b"),
        ("Undergraduate", r"\bunder[ -]?graduate\b|\bUG\b"),
        ("Diploma", r"\bdiploma\b|\bpolytechnic\b"),
        ("Class 12", r"\bclass\s*12\b|\b12th\b|\bhigher secondary\b"),
        ("Class 10", r"\bclass\s*10\b|\b10th\b|\bsecondary school\b"),
    ]
    for label, pattern in checks:
        if re.search(pattern, text, re.IGNORECASE):
            return label
    return None


def _extract_eligibility_notes(text: str) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])|\n+", text or "")
    picked = [
        sentence.strip()
        for sentence in sentences
        if re.search(r"eligib|income|domicile|category|age limit|marks", sentence, re.IGNORECASE)
    ]
    if not picked:
        return None
    return " ".join(picked[:2])[:280]


def extract_details(text: str, category: str) -> dict:
    """Extract only facts that are explicitly present in a scholarship/opportunity text."""
    if category not in OPPORTUNITY_CATEGORIES or not text:
        return {}

    money = _money_matches(text)
    income_match = INCOME_WINDOW_RE.search(text)
    income_value: int | None = None
    income_span: tuple[int, int] | None = None
    if income_match:
        for value, span in money:
            if income_match.start() <= span[0] < income_match.end():
                qualifier_text = text[income_match.start():span[0]].lower()
                if any(
                    marker in qualifier_text
                    for marker in (
                        "below", "less than", "not exceed", "exceed", "limit", "ceiling",
                        "up to", "upto", "not more than", "maximum", "under", "within",
                    )
                ):
                    income_value = value
                    income_span = span
                break

    # Only the first amount near "income" is the ceiling; a benefit amount later
    # in the same sentence remains a benefit.
    benefit_values = [value for value, span in money if span != income_span]

    details: dict = {}
    if benefit_values:
        details["amount_value"] = benefit_values[0]
        details["amount_text"] = f"₹{benefit_values[0]:,}"
    if income_value:
        details["income_ceiling"] = income_value

    categories = _extract_eligibility_categories(text)
    if categories:
        details["categories"] = categories
    domicile = _extract_domicile(text)
    if domicile:
        details["domicile"] = domicile
    course_level = _extract_course_level(text)
    if course_level:
        details["course_level"] = course_level
    notes = _extract_eligibility_notes(text)
    if notes:
        details["eligibility_notes"] = notes
    return details


def detect_category(text: str) -> str:
    lowered = text.lower()

    if any(k in lowered for k in (
        "revaluation", "re-evaluation", "challenge valuation", "make-up", "makeup",
        "supplementary", "backlog", "arrear", "photocopy of answer", "retotaling", "re-totaling",
    )):
        return "MAKEUP_OR_REVALUATION"

    if any(k in lowered for k in (
        "internship", "internships", "apprenticeship", "summer training", "industrial training",
        "internship programme", "internship program",
    )):
        return "INTERNSHIP"

    if any(k in lowered for k in (
        "placement", "placements", "campus recruitment", "campus drive", "job opening",
        "job opportunity", "job vacancy", "vacancies", "recruitment", "hiring", "walk-in",
        "walk in", "off-campus", "career opportunity", "employment opportunity",
    )):
        return "JOB_OR_PLACEMENT"

    if any(k in lowered for k in (
        "hackathon", "competition", "contest", "ideathon", "olympiad", "coding challenge",
        "innovation challenge", "startup challenge", "quiz",
    )):
        return "COMPETITION"

    if any(k in lowered for k in (
        "research programme", "research program", "research internship", "phd", "ph.d",
        "doctoral", "postdoctoral", "post-doctoral", "research associate",
        "junior research fellowship", "senior research fellowship", "jrf", "srf", "research scholar",
    )):
        return "RESEARCH_PROGRAMME"

    if any(k in lowered for k in (
        "scholarship", "fellowship", "stipend", "fee waiver", "fee concession",
        "financial assistance", "merit cum means", "merit-cum-means", "post matric",
        "post-matric", "pre matric", "pre-matric", "financial aid", "grant-in-aid",
    )):
        return "SCHOLARSHIP"

    if any(k in lowered for k in (
        "education loan", "educational loan", "student loan", "interest subsidy",
        "interest subvention", "moratorium", "collateral", "vidya lakshmi", "study loan",
        "loan scheme",
    )):
        return "EDUCATION_LOAN"

    if any(k in lowered for k in (
        "hostel", "health insurance", "medical insurance", "counselling", "counseling",
        "grievance", "ragging", "mental health", "wellness", "welfare",
        "student safety", "transport facility", "mess facility",
    )):
        return "STUDENT_WELFARE"

    if any(k in lowered for k in (
        "regulation", "ordinance", "policy", "amendment", "academic council", "syllabus",
        "curriculum", "credit system", "nep 2020", "statutes", "academic calendar", "revision of",
    )):
        return "ACADEMIC_POLICY"

    if any(k in lowered for k in ("result", "marks card", "grade card", "rank list")):
        return "RESULT"

    if any(k in lowered for k in (
        "time table", "timetable", "schedule of examination", "exam schedule", "date sheet",
        "examination programme", "exam programme", "time-table",
    )):
        return "EXAM_TIMETABLE"

    if any(k in lowered for k in (
        "fee", "fees", "challan", "registration", "application form", "apply online",
        "last date", "deadline", "remit", "payment",
    )):
        return "FEE_OR_FORM_DEADLINE"

    return "HOLIDAY_OR_GENERAL"


def demojibake(text: str) -> str:
    """Repair common UTF-8-read-as-CP1252 artefacts seen on university sites."""
    if not text:
        return text
    replacements = {
        "\u00e2\u0080\u0093": "-", "\u00e2\u0080\u0094": "-", "\u00e2\u0080\u0099": "'",
        "\u00e2\u0080\u009c": '"', "\u00e2\u0080\u009d": '"', "\u00e2\u0080\u00a6": "...",
        "\u00c2\u00a0": " ", "\u00e2": "-", "\u00c2": "",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def _clean_title(title: str) -> str:
    cleaned = re.sub(r"\s+", " ", demojibake(title or "")).strip()
    cleaned = re.sub(
        r"^(circular|notification|notice|time table|timetable|office order)\s*[-–:|]+\s*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip(" -–:|")


def build_summary(title: str, text: str, category: str) -> str:
    cleaned = _clean_title(title)
    if len(cleaned.split()) >= 6:
        words = cleaned.split()[:25]
        return " ".join(words).rstrip(".,;:") + ("..." if len(cleaned.split()) > 25 else "")
    if text:
        first = re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", text).strip())[0]
        if first and len(first.split()) >= 5:
            return " ".join(first.split()[:25])
    return CATEGORY_LABELS.get(category, "Notice")


def build_action(category: str, deadline: str | None) -> str | None:
    actions = {
        "FEE_OR_FORM_DEADLINE": "Pay the fee / submit the form",
        "MAKEUP_OR_REVALUATION": "Apply for make-up / revaluation",
        "EXAM_TIMETABLE": "Download the exam timetable",
        "RESULT": "Check your result",
        "SCHOLARSHIP": "Check eligibility and apply for the scholarship",
        "EDUCATION_LOAN": "Review the loan terms and apply",
        "INTERNSHIP": "Review the internship and apply",
        "JOB_OR_PLACEMENT": "Review the role and application steps",
        "COMPETITION": "Review the competition and register",
        "RESEARCH_PROGRAMME": "Review the programme and application requirements",
        "STUDENT_WELFARE": "Read the welfare notice and act if it applies",
        "ACADEMIC_POLICY": "Read the policy notice and check applicability",
    }
    action = actions.get(category)
    if action and deadline:
        action += f" by {deadline}"
    return action


def compute_urgency(category: str, deadline: str | None) -> str:
    today = datetime.now(timezone.utc).date()
    if deadline:
        try:
            days = (date.fromisoformat(deadline) - today).days
        except ValueError:
            days = None
        if days is not None:
            if days < 0:
                return "LOW"
            if days <= 5:
                return "HIGH"
            if days <= 14:
                return "MEDIUM"
            return "LOW" if category == "HOLIDAY_OR_GENERAL" else "MEDIUM"
    if category in ("EXAM_TIMETABLE", "MAKEUP_OR_REVALUATION"):
        return "HIGH"
    if category in (
        "FEE_OR_FORM_DEADLINE", "RESULT", "SCHOLARSHIP", "EDUCATION_LOAN", "INTERNSHIP",
        "JOB_OR_PLACEMENT", "COMPETITION", "RESEARCH_PROGRAMME",
    ):
        return "MEDIUM"
    return "LOW"


def rule_classify(title: str, published_date: str | None, text: str) -> dict:
    haystack = f"{title}\n{text or ''}"
    category = detect_category(haystack)
    deadline = extract_deadline(haystack)
    if not deadline and published_date:
        better = [d for _, d in find_dates(title) if d.isoformat() >= published_date]
        if better:
            deadline = min(better).isoformat()
    applies_to = {
        "branches": extract_branches(haystack),
        "semesters": extract_semesters(haystack),
        "schemes": extract_schemes(haystack),
    }
    confidence = "high" if text and len(text) > 200 else ("medium" if deadline else "low")
    return {
        "category": category,
        "summary": build_summary(title, text, category),
        "deadline": deadline,
        "applies_to": applies_to,
        "urgency": compute_urgency(category, deadline),
        "action_required": build_action(category, deadline),
        "details": extract_details(haystack, category),
        "confidence": confidence,
        "classifier": "rules",
    }


LLM_SYSTEM = """You read official Indian university, college, scholarship and opportunity notices. Return ONLY valid JSON with these keys:
category (one of EXAM_TIMETABLE, FEE_OR_FORM_DEADLINE, MAKEUP_OR_REVALUATION, RESULT, SCHOLARSHIP, EDUCATION_LOAN, INTERNSHIP, JOB_OR_PLACEMENT, COMPETITION, RESEARCH_PROGRAMME, STUDENT_WELFARE, ACADEMIC_POLICY, HOLIDAY_OR_GENERAL),
summary (max 25 words, plain English), deadline (ISO date YYYY-MM-DD or null),
applies_to {branches: [], semesters: [], schemes: []} (empty list means everyone; semesters are digits like "7"; schemes are years like "2022"),
urgency (HIGH if deadline within 5 days or it is an exam/make-up notice, else MEDIUM or LOW),
action_required (short string or null),
details {amount_text (string or null), amount_value (integer rupees or null), income_ceiling (integer rupees or null), categories (subset of ["SC", "ST", "OBC", "EWS", "Minority", "PwD", "General"]), domicile (Indian state, "All India" or null), course_level ("Class 10", "Class 12", "Diploma", "Undergraduate", "Postgraduate", "PhD" or null), eligibility_notes (short quote or null)},
confidence (high, medium or low).
Only use details explicitly stated for this scholarship, loan or opportunity. Leave unknown fields null or empty. Do not infer an income limit from an amount, and do not invent eligibility conditions. Return JSON only."""

_llm_semaphore = asyncio.Semaphore(1)
OLLAMA_NUM_PREDICT = 450


def _strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        return text[start:end + 1]
    return text


def _build_user_payload(title: str, published_date: str | None, text: str) -> str:
    return json.dumps(
        {"title": title, "published_date": published_date, "text": (text or "")[:12000]},
        ensure_ascii=False,
    )


async def ollama_classify(title: str, published_date: str | None, text: str) -> dict | None:
    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0, "num_predict": OLLAMA_NUM_PREDICT},
        "messages": [
            {"role": "system", "content": LLM_SYSTEM},
            {"role": "user", "content": _build_user_payload(title, published_date, text)},
        ],
    }
    try:
        async with _llm_semaphore:
            async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
                response = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        if response.status_code >= 400:
            return None
        raw = (response.json().get("message") or {}).get("content") or ""
        parsed = json.loads(_strip_json(raw))
        if not isinstance(parsed, dict) or parsed.get("category") not in CATEGORIES:
            return None
        parsed["classifier"] = "ollama"
        return parsed
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return None


async def anthropic_classify(title: str, published_date: str | None, text: str) -> dict | None:
    if not settings.anthropic_api_key:
        return None
    try:
        async with _llm_semaphore:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": settings.anthropic_model,
                        "max_tokens": 700,
                        "system": LLM_SYSTEM,
                        "messages": [
                            {
                                "role": "user",
                                "content": _build_user_payload(title, published_date, text),
                            }
                        ],
                    },
                )
        if response.status_code >= 400:
            return None
        blocks = (response.json().get("content")) or []
        raw = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        parsed = json.loads(_strip_json(raw))
        if not isinstance(parsed, dict) or parsed.get("category") not in CATEGORIES:
            return None
        parsed["classifier"] = "claude"
        return parsed
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, ValueError, TypeError):
        return None


async def llm_classify(title: str, published_date: str | None, text: str) -> dict | None:
    provider = settings.llm_provider
    if provider == "ollama":
        return await ollama_classify(title, published_date, text)
    if provider == "anthropic":
        return await anthropic_classify(title, published_date, text)
    return None


async def llm_health() -> dict:
    """Lightweight reachability + model check for the health endpoint."""
    info = {"provider": settings.llm_provider, "model": settings.llm_model, "reachable": False}
    if settings.llm_provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=4) as client:
                response = await client.get(f"{settings.ollama_base_url}/api/tags")
            if response.status_code < 400:
                names = [m.get("name", "") for m in response.json().get("models", [])]
                info["reachable"] = True
                info["models"] = names
                info["model_loaded"] = any(
                    name == settings.ollama_model or name.startswith(settings.ollama_model.split(":")[0])
                    for name in names
                )
        except httpx.HTTPError:
            pass
    elif settings.llm_provider == "anthropic":
        info["reachable"] = bool(settings.anthropic_api_key)
    return info


SEMESTER_WORDS = {
    "first": "1", "second": "2", "third": "3", "fourth": "4",
    "fifth": "5", "sixth": "6", "seventh": "7", "eighth": "8",
}


def normalize_semester(value: object) -> str | None:
    raw = str(value).strip().lower()
    match = re.search(r"\d", raw)
    if match:
        digit = match.group(0)
        return digit if digit != "0" else None
    for word, digit in SEMESTER_WORDS.items():
        if word in raw:
            return digit
    roman = {"i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8"}
    return roman.get(raw)


def _normalize_applies_to(data: object) -> dict:
    if not isinstance(data, dict):
        return {"branches": [], "semesters": [], "schemes": []}
    branches = [str(b).strip().upper() for b in data.get("branches") or [] if str(b).strip()]
    semesters = [s for s in (normalize_semester(v) for v in data.get("semesters") or []) if s]
    schemes = [re.sub(r"\D", "", str(s)) for s in data.get("schemes") or []]
    schemes = [s for s in schemes if len(s) == 4]
    return {
        "branches": list(dict.fromkeys(branches)),
        "semesters": list(dict.fromkeys(semesters)),
        "schemes": list(dict.fromkeys(schemes)),
    }


def _union_lists(base: list[str], extra: list[str]) -> list[str]:
    return list(dict.fromkeys([*base, *extra]))


def _valid_deadline(value: object, published_date: str | None) -> str | None:
    text = str(value or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return None
    try:
        parsed = date.fromisoformat(text)
    except ValueError:
        return None
    today = datetime.now(timezone.utc).date()
    earliest = today.year - 1
    if published_date:
        try:
            earliest = min(earliest, date.fromisoformat(published_date).year - 1)
        except ValueError:
            pass
    if not (earliest <= parsed.year <= today.year + 2):
        return None
    return text


def _deadline_supported(value: str, source_text: str) -> bool:
    """Reject LLM dates that do not exist in the source (small models often echo the publish date)."""
    try:
        target = date.fromisoformat(value)
    except ValueError:
        return False
    return any(parsed == target for _, parsed in find_dates(source_text or ""))


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        number = int(float(str(value).replace(",", "")))
    except (TypeError, ValueError):
        return None
    return number if 100 <= number <= 10_000_000_000 else None


def _normalize_details(data: object, text: str, validate: bool) -> dict:
    """Validate model-extracted facts against the source before storing them."""
    if not isinstance(data, dict):
        return {}
    digits_in_source = re.sub(r"\D", "", text or "")
    details: dict = {}

    amount = _positive_int(data.get("amount_value"))
    if amount and (not validate or str(amount) in digits_in_source):
        details["amount_value"] = amount
        details["amount_text"] = f"₹{amount:,}"

    income = _positive_int(data.get("income_ceiling"))
    if income and (not validate or str(income) in digits_in_source):
        details["income_ceiling"] = income

    pattern_by_label = {label: (pattern, flags) for label, pattern, flags in ELIGIBILITY_CATEGORY_PATTERNS}
    categories = [
        str(value)
        for value in (data.get("categories") or [])
        if str(value) in pattern_by_label
        and (
            not validate
            or re.search(pattern_by_label[str(value)][0], text, pattern_by_label[str(value)][1])
        )
    ]
    if categories:
        details["categories"] = list(dict.fromkeys(categories))

    domicile = str(data.get("domicile") or "").strip()
    if domicile and (domicile == "All India" or domicile in INDIAN_STATES):
        if not validate or re.search(rf"\b{re.escape(domicile)}\b", text, re.IGNORECASE):
            details["domicile"] = domicile

    course_level = str(data.get("course_level") or "").strip()
    if course_level in {"Class 10", "Class 12", "Diploma", "Undergraduate", "Postgraduate", "PhD"}:
        if not validate or _extract_course_level(text) == course_level:
            details["course_level"] = course_level

    notes = data.get("eligibility_notes")
    if isinstance(notes, str) and notes.strip() and not validate:
        details["eligibility_notes"] = notes.strip()[:280]
    return details


def _merge_details(base: dict, llm: dict) -> dict:
    merged = dict(base)
    for key in ("amount_value", "amount_text", "income_ceiling", "domicile", "course_level"):
        if llm.get(key) not in (None, ""):
            merged[key] = llm[key]
    if llm.get("categories"):
        merged["categories"] = list(
            dict.fromkeys([*(base.get("categories") or []), *llm["categories"]])
        )
    if not merged.get("eligibility_notes") and llm.get("eligibility_notes"):
        merged["eligibility_notes"] = llm["eligibility_notes"]
    return merged


def merge_classification(base: dict, llm: dict | None, text: str, title: str = "") -> dict:
    if not llm:
        return base
    merged = dict(base)
    provider = llm.get("classifier") or settings.llm_provider

    if llm.get("category") in CATEGORIES:
        merged["category"] = llm["category"]

    deadline = _valid_deadline(llm.get("deadline"), base.get("deadline") or None)
    if deadline and not _deadline_supported(deadline, f"{title}\n{text or ''}"):
        deadline = None
    if deadline:
        merged["deadline"] = deadline
    elif not merged.get("deadline"):
        merged["deadline"] = base.get("deadline")

    llm_applies = _normalize_applies_to(llm.get("applies_to"))
    base_applies = _normalize_applies_to(base.get("applies_to"))
    merged["applies_to"] = {
        "branches": _union_lists(base_applies["branches"], llm_applies["branches"]),
        "semesters": _union_lists(base_applies["semesters"], llm_applies["semesters"]),
        "schemes": _union_lists(base_applies["schemes"], llm_applies["schemes"]),
    }

    summary = llm.get("summary")
    if (
        isinstance(summary, str)
        and 3 <= len(summary.split()) <= 35
        and text
        and len(text) > 400
    ):
        merged["summary"] = summary.strip()

    if isinstance(llm.get("action_required"), str) and llm["action_required"].strip():
        merged["action_required"] = llm["action_required"].strip()
    elif not merged.get("action_required"):
        merged["action_required"] = build_action(merged["category"], merged.get("deadline"))

    if llm.get("confidence") in ("high", "medium", "low"):
        merged["confidence"] = llm["confidence"]

    if merged["category"] in OPPORTUNITY_CATEGORIES:
        merged["details"] = _merge_details(
            _normalize_details(base.get("details"), "", validate=False),
            _normalize_details(llm.get("details"), f"{title}\n{text or ''}", validate=True),
        )
    else:
        merged["details"] = {}

    # Urgency is always derived deterministically so a small model cannot hand out wrong colours.
    merged["urgency"] = compute_urgency(merged["category"], merged.get("deadline"))
    merged["classifier"] = f"rules+{provider}"
    return merged


async def classify(title: str, published_date: str | None, text: str) -> dict:
    base = rule_classify(title, published_date, text)
    llm = await llm_classify(title, published_date, text)
    return merge_classification(base, llm, text, title)
