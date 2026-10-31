"""Per-student alert preferences.

A notice becomes an alert only when its category is selected, its urgency meets
the threshold and its deadline fits the chosen window. Everything else is still
captured and shown in the product; it simply does not interrupt the student.
"""

import json
from datetime import date, datetime, timezone

from .classifier import CATEGORIES, CATEGORY_LABELS

DEFAULT_CATEGORIES = [
    "SCHOLARSHIP",
    "EDUCATION_LOAN",
    "INTERNSHIP",
    "JOB_OR_PLACEMENT",
    "COMPETITION",
    "RESEARCH_PROGRAMME",
]

DEFAULT_PREFERENCES = {
    "categories": DEFAULT_CATEGORIES,
    "min_urgency": "LOW",
    "deadline_within_days": None,
    "include_without_deadline": True,
}

URGENCY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def normalize_preferences(raw) -> dict:
    """Return a complete, valid preference object for any stored value."""
    data = raw
    if isinstance(data, str):
        try:
            data = json.loads(data) if data.strip() else {}
        except json.JSONDecodeError:
            data = {}
    if not isinstance(data, dict):
        data = {}

    if "categories" in data:
        values = data.get("categories")
        values = values if isinstance(values, list) else []
        categories = []
        for value in values:
            key = str(value).strip().upper()
            if key in CATEGORIES and key not in categories:
                categories.append(key)
    else:
        categories = list(DEFAULT_CATEGORIES)

    min_urgency = str(data.get("min_urgency") or "LOW").strip().upper()
    if min_urgency not in URGENCY_RANK:
        min_urgency = "LOW"

    window = data.get("deadline_within_days")
    try:
        window_days = int(window) if window is not None else None
    except (TypeError, ValueError):
        window_days = None
    if window_days is not None and window_days <= 0:
        window_days = None

    include_without = data.get("include_without_deadline", True)
    if isinstance(include_without, str):
        include_without = include_without.strip().lower() in {"1", "true", "yes", "on"}

    return {
        "categories": categories,
        "min_urgency": min_urgency,
        "deadline_within_days": window_days,
        "include_without_deadline": bool(include_without),
    }


def alert_matches(preferences, circular: dict) -> tuple[bool, str]:
    """Explain why a circular would or would not be delivered."""
    prefs = normalize_preferences(preferences)
    category = str(circular.get("category") or "").upper()
    if category not in prefs["categories"]:
        return False, "category not selected"

    urgency = str(circular.get("urgency") or "LOW").upper()
    if URGENCY_RANK.get(urgency, 0) < URGENCY_RANK[prefs["min_urgency"]]:
        return False, "below urgency threshold"

    deadline = circular.get("deadline")
    deadline_date: date | None = None
    if deadline:
        try:
            deadline_date = date.fromisoformat(str(deadline)[:10])
        except ValueError:
            deadline_date = None

    if deadline_date is not None:
        days_left = (deadline_date - datetime.now(timezone.utc).date()).days
        if days_left < 0:
            return False, "deadline closed"
        window = prefs["deadline_within_days"]
        if window is not None and days_left > window:
            return False, "deadline outside your window"
    elif not prefs["include_without_deadline"]:
        return False, "no stated deadline"

    return True, "matches your preferences"


def preference_summary(preferences, max_categories: int = 4) -> str:
    prefs = normalize_preferences(preferences)
    if not prefs["categories"]:
        return "alerts paused"
    labels = [CATEGORY_LABELS.get(key, key) for key in prefs["categories"]]
    shown = ", ".join(labels[:max_categories])
    if len(labels) > max_categories:
        shown += f" +{len(labels) - max_categories} more"
    urgency = {
        "HIGH": "high priority only",
        "MEDIUM": "medium and high priority",
        "LOW": "all priorities",
    }[prefs["min_urgency"]]
    window = (
        "any deadline"
        if prefs["deadline_within_days"] is None
        else f"within {prefs['deadline_within_days']} days"
    )
    if not prefs["include_without_deadline"]:
        window += ", dated notices only"
    return f"{shown} · {urgency} · {window}"
