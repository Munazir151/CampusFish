import json
import sqlite3
from datetime import datetime, timedelta, timezone

import httpx

from .classifier import CATEGORY_LABELS
from .config import settings
from .db import new_id, now_iso, row_to_dict
from .eligibility import evaluate_eligibility
from .matching import user_matches
from .preferences import alert_matches, normalize_preferences

CATEGORY_EMOJI = {
    "SCHOLARSHIP": "🎓",
    "EDUCATION_LOAN": "🏦",
    "INTERNSHIP": "🧑‍💻",
    "JOB_OR_PLACEMENT": "💼",
    "COMPETITION": "🏆",
    "RESEARCH_PROGRAMME": "🔬",
    "EXAM_TIMETABLE": "📅",
    "FEE_OR_FORM_DEADLINE": "💰",
    "MAKEUP_OR_REVALUATION": "🔁",
    "RESULT": "📊",
    "ACADEMIC_POLICY": "📋",
    "STUDENT_WELFARE": "🛟",
    "HOLIDAY_OR_GENERAL": "📢",
}

URGENCY_LABEL = {"HIGH": "🔴 HIGH", "MEDIUM": "🟠 MEDIUM", "LOW": "🟢 LOW"}


def build_message(circular: dict, eligibility: dict | None = None) -> str:
    emoji = CATEGORY_EMOJI.get(circular.get("category"), "📢")
    lines = [
        f"{emoji} <b>{_escape(circular.get('title', 'Notice'))}</b>",
        f"{_escape(circular.get('summary') or '')}",
        "",
        f"Type: {_escape(CATEGORY_LABELS.get(circular.get('category'), 'General'))}",
        f"Urgency: {URGENCY_LABEL.get(circular.get('urgency'), circular.get('urgency', ''))}",
    ]
    details = circular.get("details") or {}
    if isinstance(details, str):
        try:
            details = json.loads(details)
        except json.JSONDecodeError:
            details = {}
    if details.get("amount_value"):
        lines.append(f"Amount: <b>₹{int(details['amount_value']):,}</b>")
    if details.get("income_ceiling"):
        lines.append(f"Income limit: ₹{int(details['income_ceiling']):,}")
    if details.get("categories"):
        lines.append(f"Categories: {_escape(', '.join(details['categories']))}")
    if details.get("domicile"):
        lines.append(f"Domicile: {_escape(details['domicile'])}")
    if eligibility and eligibility.get("status") == "CHECK":
        lines.append("Eligibility: some conditions need your profile")
    if circular.get("deadline"):
        lines.append(f"Deadline: <b>{_escape(circular['deadline'])}</b>")
    if circular.get("action_required"):
        lines.append(f"Action: {_escape(circular['action_required'])}")
    if circular.get("source_name"):
        lines.append(f"Source: {_escape(circular['source_name'])}")
    if circular.get("url"):
        lines.append(f'<a href="{_escape(circular["url"])}">Open notice</a>')
    return "\n".join(lines)


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


async def send_telegram(chat_id: str, text: str) -> bool:
    if not settings.telegram_bot_token or not chat_id:
        return False
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False,
                },
            )
        return response.status_code < 400
    except httpx.HTTPError:
        return False


def _delivery_time() -> str:
    return (
        datetime.now(timezone.utc) + timedelta(seconds=settings.alert_grace_seconds)
    ).isoformat()


async def create_alerts(conn: sqlite3.Connection, circular: dict) -> int:
    """Record matching alerts immediately; Telegram delivery happens after a grace period.

    The grace period gives the classifier a chance to refine the category, amount
    and eligibility conditions, so a provisional rule pass cannot send the wrong
    message to a student.
    """
    users = conn.execute("SELECT * FROM users").fetchall()
    applies_to = circular.get("applies_to") or {}
    if isinstance(applies_to, str):
        applies_to = json.loads(applies_to)

    created = 0
    for row in users:
        user = dict(row)
        if not user_matches(user, applies_to):
            continue

        preferences = normalize_preferences(user.get("preferences"))
        matches, _reason = alert_matches(preferences, circular)
        if not matches:
            continue

        eligibility = evaluate_eligibility(circular.get("details") or {}, user)
        if eligibility["status"] == "DOES_NOT_MEET":
            continue

        already = conn.execute(
            "SELECT 1 FROM alerts WHERE user_id = ? AND circular_id = ?",
            (user["id"], circular["id"]),
        ).fetchone()
        if already:
            continue

        chat_id = user.get("telegram_chat_id")
        to_telegram = bool(chat_id and settings.telegram_bot_token)
        conn.execute(
            "INSERT OR IGNORE INTO alerts "
            "(id, user_id, circular_id, sent_at, channel, status, deliver_after) "
            "VALUES (?,?,?,?,?,?,?)",
            (
                new_id(),
                user["id"],
                circular["id"],
                now_iso(),
                "telegram" if to_telegram else "dashboard",
                "pending" if to_telegram else "dashboard_only",
                _delivery_time() if to_telegram else now_iso(),
            ),
        )
        created += 1
    return created


async def deliver_pending_alerts() -> dict:
    """Deliver queued Telegram alerts after re-checking the refined notice."""
    if not settings.telegram_bot_token:
        return {"sent": 0, "failed": 0, "suppressed": 0}

    cutoff = now_iso()
    with sqlite3.connect(settings.database_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT id, user_id, circular_id FROM alerts "
            "WHERE status = 'pending' AND (deliver_after IS NULL OR deliver_after <= ?) "
            "ORDER BY sent_at LIMIT 50",
            (cutoff,),
        ).fetchall()

    sent = failed = suppressed = 0
    for row in rows:
        with sqlite3.connect(settings.database_path) as conn:
            conn.row_factory = sqlite3.Row
            user = row_to_dict(
                conn.execute("SELECT * FROM users WHERE id = ?", (row["user_id"],)).fetchone()
            )
            circular = row_to_dict(
                conn.execute(
                    "SELECT * FROM circulars WHERE id = ?", (row["circular_id"],)
                ).fetchone()
            )

        if not user or not circular:
            with sqlite3.connect(settings.database_path) as conn:
                conn.execute(
                    "UPDATE alerts SET status = 'suppressed', channel = 'dashboard' WHERE id = ?",
                    (row["id"],),
                )
                conn.commit()
            suppressed += 1
            continue

        preferences = normalize_preferences(user.get("preferences"))
        matches, _reason = alert_matches(preferences, circular)
        eligibility = evaluate_eligibility(circular.get("details") or {}, user)
        if (
            not matches
            or not user_matches(user, circular.get("applies_to") or {})
            or eligibility["status"] == "DOES_NOT_MEET"
        ):
            with sqlite3.connect(settings.database_path) as conn:
                conn.execute(
                    "UPDATE alerts SET status = 'suppressed', channel = 'dashboard' WHERE id = ?",
                    (row["id"],),
                )
                conn.commit()
            suppressed += 1
            continue

        # Atomically claim one pending alert so overlapping scheduler ticks cannot
        # send the same message twice.
        with sqlite3.connect(settings.database_path) as conn:
            cursor = conn.execute(
                "UPDATE alerts SET status = 'sending' WHERE id = ? AND status = 'pending'",
                (row["id"],),
            )
            conn.commit()
        if cursor.rowcount == 0:
            continue

        delivered = bool(user.get("telegram_chat_id")) and await send_telegram(
            str(user["telegram_chat_id"]), build_message(circular, eligibility)
        )
        with sqlite3.connect(settings.database_path) as conn:
            conn.execute(
                "UPDATE alerts SET status = ?, channel = 'telegram', deliver_after = NULL WHERE id = ?",
                ("sent" if delivered else "failed", row["id"]),
            )
            conn.commit()
        if delivered:
            sent += 1
        else:
            failed += 1

    if sent or failed or suppressed:
        return {"sent": sent, "failed": failed, "suppressed": suppressed}
    return {"sent": 0, "failed": 0, "suppressed": 0}
