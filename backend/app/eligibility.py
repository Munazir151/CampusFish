"""Compare captured scholarship/loan conditions with optional profile facts.

Unknown profile data never becomes a negative result: it is reported as missing.
Only an explicit contradiction (income above the ceiling, a different social
category or a different domicile) blocks an alert.
"""

import json
import re


def _norm(value) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _category(value) -> str:
    raw = str(value or "").strip().upper()
    return {
        "PWD": "PwD",
        "MINORITY": "Minority",
        "GENERAL": "General",
        "SC": "SC",
        "ST": "ST",
        "OBC": "OBC",
        "EWS": "EWS",
    }.get(raw, "")


def evaluate_eligibility(details, user: dict) -> dict:
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except json.JSONDecodeError:
            details = {}
    if not isinstance(details, dict):
        details = {}

    conditions: list[dict] = []

    ceiling = details.get("income_ceiling")
    if ceiling:
        income = user.get("annual_income")
        if income in (None, ""):
            conditions.append({
                "label": "Family income",
                "expected": f"Up to ₹{int(ceiling):,}",
                "actual": "Not in profile",
                "state": "missing",
            })
        else:
            try:
                within = int(income) <= int(ceiling)
            except (TypeError, ValueError):
                within = None
            if within is None:
                conditions.append({
                    "label": "Family income",
                    "expected": f"Up to ₹{int(ceiling):,}",
                    "actual": "Not usable",
                    "state": "missing",
                })
            else:
                conditions.append({
                    "label": "Family income",
                    "expected": f"Up to ₹{int(ceiling):,}",
                    "actual": f"₹{int(income):,}",
                    "state": "match" if within else "mismatch",
                })

    stated_categories = details.get("categories") or []
    if stated_categories:
        user_category = _category(user.get("social_category"))
        if not user_category:
            conditions.append({
                "label": "Social category",
                "expected": ", ".join(stated_categories),
                "actual": "Not in profile",
                "state": "missing",
            })
        else:
            conditions.append({
                "label": "Social category",
                "expected": ", ".join(stated_categories),
                "actual": user_category,
                "state": "match" if user_category in stated_categories else "mismatch",
            })

    stated_domicile = details.get("domicile")
    if stated_domicile:
        user_domicile = str(user.get("domicile") or "").strip()
        if not user_domicile:
            conditions.append({
                "label": "Domicile",
                "expected": stated_domicile,
                "actual": "Not in profile",
                "state": "missing",
            })
        else:
            matches = (
                stated_domicile == "All India"
                or _norm(stated_domicile) in _norm(user_domicile)
                or _norm(user_domicile) in _norm(stated_domicile)
            )
            conditions.append({
                "label": "Domicile",
                "expected": stated_domicile,
                "actual": user_domicile,
                "state": "match" if matches else "mismatch",
            })

    if any(condition["state"] == "mismatch" for condition in conditions):
        status = "DOES_NOT_MEET"
        note = "At least one stated condition conflicts with your profile."
    elif any(condition["state"] == "missing" for condition in conditions):
        status = "CHECK"
        note = "Some stated conditions need information from your profile."
    elif conditions:
        status = "MEETS"
        note = "The stated income, category and domicile conditions match your profile."
    else:
        status = "UNKNOWN"
        note = "The notice does not state structured individual conditions."

    return {"status": status, "conditions": conditions, "note": note}
