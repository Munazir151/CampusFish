import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    telegram_chat_id TEXT,
    preferences TEXT NOT NULL DEFAULT '{}',
    institution TEXT,
    branch TEXT,
    semester TEXT,
    scheme TEXT,
    annual_income INTEGER,
    social_category TEXT,
    domicile TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    institution TEXT,
    goal TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_scanned_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS circulars (
    id TEXT PRIMARY KEY,
    source_id TEXT,
    source_name TEXT,
    institution TEXT,
    title TEXT NOT NULL,
    published_date TEXT,
    url TEXT,
    content_hash TEXT NOT NULL UNIQUE,
    raw_text TEXT,
    category TEXT NOT NULL,
    summary TEXT,
    deadline TEXT,
    applies_to TEXT NOT NULL DEFAULT '{}',
    details TEXT NOT NULL DEFAULT '{}',
    urgency TEXT NOT NULL,
    action_required TEXT,
    confidence TEXT,
    detected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    circular_id TEXT NOT NULL,
    sent_at TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    deliver_after TEXT,
    UNIQUE(user_id, circular_id)
);

CREATE TABLE IF NOT EXISTS scan_runs (
    id TEXT PRIMARY KEY,
    scan_group_id TEXT NOT NULL,
    source_id TEXT,
    source_name TEXT,
    tinyfish_run_id TEXT,
    extraction TEXT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    new_items_count INTEGER NOT NULL DEFAULT 0,
    total_items_count INTEGER NOT NULL DEFAULT 0,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_circulars_deadline ON circulars(deadline);
CREATE INDEX IF NOT EXISTS idx_circulars_category ON circulars(category);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_group ON scan_runs(scan_group_id);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def get_conn():
    conn = sqlite3.connect(settings.database_path, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    data = dict(row)
    for field, fallback in (("applies_to", {}), ("preferences", {}), ("details", {})):
        if field in data and isinstance(data[field], str):
            try:
                data[field] = json.loads(data[field])
            except json.JSONDecodeError:
                data[field] = fallback
    return data


def rows_to_dicts(rows) -> list[dict]:
    return [row_to_dict(r) for r in rows]


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(scan_runs)")}
        if "extraction" not in columns:
            conn.execute("ALTER TABLE scan_runs ADD COLUMN extraction TEXT")
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
        if "preferences" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN preferences TEXT NOT NULL DEFAULT '{}'")
        for column, definition in (
            ("annual_income", "INTEGER"),
            ("social_category", "TEXT"),
            ("domicile", "TEXT"),
        ):
            if column not in user_columns:
                conn.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")
        circular_columns = {row["name"] for row in conn.execute("PRAGMA table_info(circulars)")}
        if "details" not in circular_columns:
            conn.execute("ALTER TABLE circulars ADD COLUMN details TEXT NOT NULL DEFAULT '{}'")
        alert_columns = {row["name"] for row in conn.execute("PRAGMA table_info(alerts)")}
        if "deliver_after" not in alert_columns:
            conn.execute("ALTER TABLE alerts ADD COLUMN deliver_after TEXT")
        # A restart cannot finish an in-flight Telegram send; return it to the queue.
        conn.execute("UPDATE alerts SET status = 'pending' WHERE status = 'sending'")
        # A restart cannot resume an in-flight agent run; surface it instead of leaving it spinning.
        conn.execute(
            "UPDATE scan_runs SET status = 'FAILED', "
            "error = COALESCE(error, 'Interrupted by a server restart'), finished_at = ? "
            "WHERE status IN ('RUNNING', 'PENDING')",
            (now_iso(),),
        )
        seed_default_sources(conn)
    seed_fallback_circulars()
    seed_demo_user()


def seed_default_sources(conn: sqlite3.Connection) -> None:
    """Seed sources from SEED_SOURCES only. No institution is hardcoded."""
    existing = conn.execute("SELECT COUNT(*) AS c FROM sources").fetchone()["c"]
    if existing or not settings.seed_sources:
        return
    try:
        parsed = json.loads(settings.seed_sources)
    except json.JSONDecodeError:
        return
    items = parsed if isinstance(parsed, list) else [parsed]
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        url = str(item.get("url") or "").strip()
        if not name or not url:
            continue
        conn.execute(
            "INSERT INTO sources (id, name, url, institution, goal, enabled, created_at) VALUES (?,?,?,?,?,?,?)",
            (
                new_id(),
                name,
                url,
                str(item.get("institution") or "").strip() or None,
                str(item.get("goal") or "").strip() or None,
                1,
                now_iso(),
            ),
        )


def seed_demo_user() -> None:
    with get_conn() as conn:
        existing = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        if existing:
            return
        conn.execute(
            "INSERT INTO users (id, name, email, telegram_chat_id, institution, branch, semester, scheme, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (
                new_id(),
                "Student",
                None,
                None,
                None,
                None,
                None,
                None,
                now_iso(),
            ),
        )


def seed_fallback_circulars() -> None:
    """Optionally load the bundled sample notices when the database has no circulars."""
    import os

    if not settings.seed_sample_data:
        return

    fallback_path = os.path.join(settings.data_dir, "fallback_circulars.json")
    if not os.path.exists(fallback_path):
        return
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) AS c FROM circulars").fetchone()["c"]:
            return
        try:
            with open(fallback_path, "r", encoding="utf-8") as fh:
                items = json.load(fh)
        except (OSError, json.JSONDecodeError):
            return
        for item in items:
            conn.execute(
                "INSERT OR IGNORE INTO circulars (id, source_id, source_name, institution, title, published_date, url, "
                "content_hash, raw_text, category, summary, deadline, applies_to, details, urgency, action_required, confidence, detected_at) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    item.get("id") or new_id(),
                    item.get("source_id"),
                    item.get("source_name", "Cached scan"),
                    item.get("institution"),
                    item.get("title", "Untitled circular"),
                    item.get("published_date"),
                    item.get("url"),
                    item.get("content_hash") or new_id(),
                    item.get("raw_text"),
                    item.get("category", "HOLIDAY_OR_GENERAL"),
                    item.get("summary"),
                    item.get("deadline"),
                    json.dumps(item.get("applies_to") or {}),
                    json.dumps(item.get("details") or {}),
                    item.get("urgency", "LOW"),
                    item.get("action_required"),
                    item.get("confidence", "low"),
                    item.get("detected_at") or now_iso(),
                ),
            )
