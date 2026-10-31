import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from . import db, html_fallback
from .alerts import deliver_pending_alerts, send_telegram
from .config import settings
from .preferences import normalize_preferences, preference_summary
from .scanner import create_scan_group, run_scan_group

logger = logging.getLogger("noticeradar.scheduler")

_scheduler: AsyncIOScheduler | None = None
_telegram_offset = 0
_watch_lock = asyncio.Lock()
# Listing entries already inspected once. Without this, an older item that the
# agent did not capture could trigger a full scan on every single watch tick.
_seen_titles: set[str] = set()
_seen_urls: set[str] = set()


def _norm_title(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _norm_url(value: str | None) -> str:
    return str(value or "").split("?")[0].split("#")[0].rstrip("/").lower()


def find_new_items(
    items: list[dict], known_titles: set[str], known_urls: set[str]
) -> list[dict]:
    """Return candidates that match neither a known title nor a known URL."""
    fresh: list[dict] = []
    for item in items:
        title_key = _norm_title(item.get("title"))
        url_key = _norm_url(item.get("url"))
        if not title_key and not url_key:
            continue
        if url_key and url_key in known_urls:
            continue
        if title_key and title_key in known_titles:
            continue
        fresh.append(item)
    return fresh


def _is_due(source: dict, now: datetime) -> bool:
    last = source.get("last_scanned_at")
    if not last:
        return True
    try:
        parsed = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return now - parsed >= timedelta(minutes=settings.scan_interval_minutes)


async def watch_sources() -> None:
    """Check source pages cheaply and scan immediately when something new appears.

    The HTML read is deliberately lightweight: it only decides whether a full
    agent scan is worth starting. Sources that cannot be read without JavaScript
    still fall back to the regular scan interval.
    """
    if _watch_lock.locked():
        logger.info("Source watch skipped: a scan is already running")
        return

    async with _watch_lock:
        with db.get_conn() as conn:
            sources = db.rows_to_dicts(
                conn.execute("SELECT * FROM sources WHERE enabled = 1 ORDER BY created_at").fetchall()
            )
            known_rows = conn.execute("SELECT title, url FROM circulars").fetchall()
        if not sources:
            return

        known_titles = {_norm_title(row["title"]) for row in known_rows if row["title"]}
        known_urls = {_norm_url(row["url"]) for row in known_rows if row["url"]}
        known_titles |= _seen_titles
        known_urls |= _seen_urls
        now = datetime.now(timezone.utc)
        due = {source["id"] for source in sources if _is_due(source, now)}
        changed: set[str] = set()

        if settings.auto_scan_on_change:
            semaphore = asyncio.Semaphore(4)

            async def inspect(source: dict) -> None:
                async with semaphore:
                    items = await html_fallback.fetch_items(source["url"], limit=20)
                if not items:
                    return
                fresh = find_new_items(items, known_titles, known_urls)
                if not fresh:
                    return
                changed.add(source["id"])
                logger.info("New listing detected on %s", source["name"])
                # Remember the whole visible listing, not only the items the agent
                # manages to capture, so the same page cannot retrigger every tick.
                for item in items:
                    title_key = _norm_title(item.get("title"))
                    url_key = _norm_url(item.get("url"))
                    if title_key:
                        known_titles.add(title_key)
                        _seen_titles.add(title_key)
                    if url_key:
                        known_urls.add(url_key)
                        _seen_urls.add(url_key)

            await asyncio.gather(*(inspect(source) for source in sources))

        targets = sorted(changed | due)
        if not targets:
            return

        logger.info(
            "Starting automatic scan for %s source(s): %s changed, %s due",
            len(targets),
            len(changed),
            len(due),
        )
        group_id, runs = create_scan_group(targets)
        if not runs:
            return
        try:
            await run_scan_group(group_id)
        except Exception:  # noqa: BLE001 - the watch loop must survive one bad scan
            logger.exception("Automatic scan failed")


async def poll_telegram() -> None:
    global _telegram_offset
    if not settings.telegram_bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/getUpdates"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                url, params={"offset": _telegram_offset + 1, "timeout": 0, "limit": 20}
            )
        if response.status_code >= 400:
            return
        updates = response.json().get("result") or []
    except httpx.HTTPError:
        return

    for update in updates:
        _telegram_offset = max(_telegram_offset, int(update.get("update_id", 0)))
        message = update.get("message") or {}
        text = (message.get("text") or "").strip()
        chat_id = str((message.get("chat") or {}).get("id") or "")
        if not chat_id or not text.startswith("/start"):
            continue
        parts = text.split()
        if len(parts) < 2:
            await send_telegram(
                chat_id,
                "Send <code>/start &lt;your-id&gt;</code> from CampusIntel to link this chat.",
            )
            continue
        user_id = parts[1].strip()
        with db.get_conn() as conn:
            user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not user:
                await send_telegram(
                    chat_id, "That CampusIntel account was not found. Open Profile to copy your ID."
                )
                continue
            conn.execute("UPDATE users SET telegram_chat_id = ? WHERE id = ?", (chat_id, user_id))
        prefs = normalize_preferences(user["preferences"])
        audience = f"{user['branch']}, semester {user['semester']}" if user["branch"] else "your profile"
        await send_telegram(
            chat_id,
            f"<b>Linked.</b> Alerts for {audience} are limited to: "
            f"{preference_summary(prefs)}. Change them in Profile → Preferences.",
        )


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler:
        return _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        watch_sources,
        "interval",
        seconds=settings.watch_interval_seconds,
        id="watch_sources",
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(timezone.utc) + timedelta(seconds=5),
    )
    if settings.telegram_bot_token:
        _scheduler.add_job(
            deliver_pending_alerts,
            "interval",
            seconds=10,
            id="alert_delivery",
            max_instances=1,
            coalesce=True,
        )
        _scheduler.add_job(
            poll_telegram,
            "interval",
            seconds=6,
            id="telegram_poller",
            max_instances=1,
            coalesce=True,
        )
    _scheduler.start()
    logger.info(
        "Source watcher started (checks every %ss, full fallback scan every %s min)",
        settings.watch_interval_seconds,
        settings.scan_interval_minutes,
    )
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
