import re


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _branch_matches(user_branch: str, branches: list[str]) -> bool:
    user = _norm(user_branch)
    if not user:
        return False
    for branch in branches:
        candidate = _norm(branch)
        if not candidate:
            continue
        if candidate == user or candidate in user or user in candidate:
            return True
    return False


def _semester_matches(user_semester: str, semesters: list[str]) -> bool:
    user = _norm(user_semester)
    return any(_norm(s) == user for s in semesters if s)


def _scheme_matches(user_scheme: str, schemes: list[str]) -> bool:
    user = _norm(user_scheme)
    return any(_norm(s) == user for s in schemes if s)


def user_matches(user: dict, applies_to: dict | None) -> bool:
    """Empty dimension means everyone; every non-empty dimension must match."""
    applies_to = applies_to or {}
    branches = applies_to.get("branches") or []
    semesters = applies_to.get("semesters") or []
    schemes = applies_to.get("schemes") or []

    if branches and not _branch_matches(user.get("branch", ""), branches):
        return False
    if semesters and not _semester_matches(user.get("semester", ""), semesters):
        return False
    if schemes and not _scheme_matches(user.get("scheme", ""), schemes):
        return False
    return True
