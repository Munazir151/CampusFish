import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx
from pydantic import BaseModel, Field

from . import db
from .alerts import create_alerts, send_telegram
from .classifier import CATEGORY_LABELS, classify, llm_health, rule_classify
from .config import settings
from .preferences import DEFAULT_PREFERENCES, normalize_preferences, preference_summary
from .qa import answer_question
from .scanner import create_scan_group, run_scan_group
from .scheduler import poll_telegram, shutdown_scheduler, start_scheduler
from .tinyfish import TinyFishClient, TinyFishError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("noticeradar")

DEFAULT_GOAL = (
    "On this page, find the latest official notices and opportunities: examinations, results, fees, "
    "scholarships, education loans, internships, placements and jobs, research programmes, competitions, "
    "student welfare and academic policy. Scroll or paginate until you have the 15 most recent items. "
    "For each item return: title, date, the direct URL of the PDF or detail page, and the page section it "
    "came from. Do not invent items that are not on the page."
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    start_scheduler()
    logger.info("CampusFish backend ready")
    yield
    shutdown_scheduler()


app = FastAPI(title="CampusFish API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- models
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str | None = None
    institution: str | None = None
    branch: str | None = None
    semester: str | None = None
    scheme: str | None = None
    telegram_chat_id: str | None = None
    preferences: dict | None = None
    annual_income: int | None = Field(default=None, ge=0)
    social_category: str | None = None
    domicile: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    institution: str | None = None
    branch: str | None = None
    semester: str | None = None
    scheme: str | None = None
    telegram_chat_id: str | None = None
    preferences: dict | None = None
    annual_income: int | None = Field(default=None, ge=0)
    social_category: str | None = None
    domicile: str | None = None


class SourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    url: str = Field(min_length=4)
    institution: str | None = None
    goal: str | None = None


class SourceUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    institution: str | None = None
    goal: str | None = None
    enabled: bool | None = None


class TelegramLink(BaseModel):
    chat_id: str


class InjectRequest(BaseModel):
    title: str | None = None
    summary: str | None = None
    category: str | None = None
    deadline: str | None = None
    urgency: str | None = None
    applies_to: dict | None = None
    details: dict | None = None
    source_name: str | None = "Demo injection"
    url: str | None = None
    raw_text: str | None = None


class ClassifyRequest(BaseModel):
    title: str = Field(min_length=1)
    published_date: str | None = None
    text: str | None = None


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=600)
    user_id: str | None = None


# ---------------------------------------------------------------- helpers
def _decorate(circular: dict) -> dict:
    circular["category_label"] = CATEGORY_LABELS.get(circular.get("category"), "General")
    deadline = circular.get("deadline")
    if deadline:
        try:
            circular["days_left"] = (date.fromisoformat(deadline) - datetime.now(timezone.utc).date()).days
        except ValueError:
            circular["days_left"] = None
    else:
        circular["days_left"] = None
    circular["details"] = circular.get("details") or {}
    return circular


def _user_payload(user: dict | None) -> dict | None:
    if not user:
        return user
    user["preferences"] = normalize_preferences(user.get("preferences"))
    return user


def _group_status(runs: list[dict]) -> str:
    statuses = [r["status"] for r in runs]
    if not statuses:
        return "EMPTY"
    if any(s in ("PENDING", "RUNNING") for s in statuses):
        return "RUNNING"
    if all(s == "FAILED" for s in statuses):
        return "FAILED"
    if any(s == "FAILED" for s in statuses):
        return "PARTIAL"
    return "COMPLETED"


def _scan_group_payload(group_id: str) -> dict:
    with db.get_conn() as conn:
        runs = db.rows_to_dicts(
            conn.execute(
                "SELECT * FROM scan_runs WHERE scan_group_id = ? ORDER BY started_at", (group_id,)
            ).fetchall()
        )
    if not runs:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        "scan_id": group_id,
        "status": _group_status(runs),
        "new_items_count": sum(r.get("new_items_count") or 0 for r in runs),
        "runs": runs,
        "started_at": min(r["started_at"] for r in runs),
        "finished_at": max((r.get("finished_at") or "") for r in runs) or None,
    }


# ---------------------------------------------------------------- health / config
@app.get("/api/health")
async def health() -> dict:
    llm = await llm_health()
    return {
        "ok": True,
        "tinyfish_configured": bool(settings.tinyfish_api_key),
        "llm_configured": settings.llm_configured,
        "llm": llm,
        "telegram_configured": bool(settings.telegram_bot_token),
    }


@app.get("/api/config")
async def public_config() -> dict:
    with db.get_conn() as conn:
        sources = conn.execute("SELECT COUNT(*) AS c FROM sources WHERE enabled = 1").fetchone()["c"]
    return {
        "telegram_bot_username": settings.telegram_bot_username.replace("@", ""),
        "llm_configured": settings.llm_configured,
        "llm_provider": settings.llm_provider,
        "llm_model": settings.llm_model,
        "telegram_configured": bool(settings.telegram_bot_token),
        "scan_interval_minutes": settings.scan_interval_minutes,
        "watch_interval_seconds": settings.watch_interval_seconds,
        "auto_scan_on_change": settings.auto_scan_on_change,
        "alert_grace_seconds": settings.alert_grace_seconds,
        "default_goal": DEFAULT_GOAL,
        "active_sources": sources,
        "categories": CATEGORY_LABELS,
    }


# ---------------------------------------------------------------- sources
@app.get("/api/sources")
async def list_sources() -> dict:
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(conn.execute("SELECT * FROM sources ORDER BY created_at").fetchall())
    return {"items": rows}


@app.post("/api/sources", status_code=201)
async def create_source(payload: SourceCreate) -> dict:
    source_id = db.new_id()
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO sources (id, name, url, institution, goal, enabled, created_at) VALUES (?,?,?,?,?,?,?)",
            (source_id, payload.name, payload.url, payload.institution, payload.goal, 1, db.now_iso()),
        )
        row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    return db.row_to_dict(row)


@app.patch("/api/sources/{source_id}")
async def update_source(source_id: str, payload: SourceUpdate) -> dict:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "enabled" in updates:
        updates["enabled"] = 1 if updates["enabled"] else 0
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with db.get_conn() as conn:
        cursor = conn.execute(
            f"UPDATE sources SET {assignments} WHERE id = ?", (*updates.values(), source_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Source not found")
        row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
    return db.row_to_dict(row)


@app.delete("/api/sources/{source_id}")
async def delete_source(source_id: str) -> dict:
    with db.get_conn() as conn:
        cursor = conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Source not found")
    return {"deleted": True}


# ---------------------------------------------------------------- scans
@app.post("/api/scan", status_code=202)
async def start_scan(background_tasks: BackgroundTasks) -> dict:
    group_id, runs = create_scan_group()
    if not runs:
        raise HTTPException(status_code=400, detail="No enabled sources. Add a source first.")
    background_tasks.add_task(run_scan_group, group_id)
    return {"scan_id": group_id, "status": "RUNNING", "runs": runs}


@app.get("/api/scan/{scan_id}")
async def get_scan(scan_id: str) -> dict:
    return _scan_group_payload(scan_id)


@app.get("/api/scans")
async def recent_scans(limit: int = Query(10, ge=1, le=50)) -> dict:
    with db.get_conn() as conn:
        groups = conn.execute(
            "SELECT scan_group_id, MAX(started_at) AS started_at FROM scan_runs "
            "GROUP BY scan_group_id ORDER BY started_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return {"items": [_scan_group_payload(row["scan_group_id"]) for row in groups]}


@app.get("/api/agent/runs/{run_id}")
async def agent_run(run_id: str) -> dict:
    try:
        client = TinyFishClient()
    except TinyFishError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    try:
        run = await client.get_run(run_id)
    except TinyFishError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        await client.close()
    return {
        "run_id": run_id,
        "status": run.get("status"),
        "result": run.get("result"),
        "error": run.get("error"),
        "url": run.get("url"),
        "goal": run.get("goal"),
        "steps": run.get("steps") or [],
        "streaming_url": run.get("streaming_url"),
        "video_url": run.get("video_url"),
        "num_of_steps": run.get("num_of_steps"),
        "started_at": run.get("started_at"),
        "finished_at": run.get("finished_at"),
    }


@app.get("/api/agent/runs/{run_id}/steps/{step_id}/screenshot")
async def agent_screenshot(run_id: str, step_id: str) -> Response:
    if not settings.tinyfish_api_key:
        raise HTTPException(status_code=503, detail="TinyFish is not configured")
    async with httpx.AsyncClient(timeout=40) as client:
        response = await client.get(
            f"{settings.tinyfish_base_url}/runs/{run_id}/steps/{step_id}/screenshot",
            headers={"X-API-Key": settings.tinyfish_api_key},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Screenshot unavailable")
    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "image/png"),
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ---------------------------------------------------------------- circulars
@app.get("/api/circulars")
async def list_circulars(
    category: str | None = None,
    urgency: str | None = None,
    source_id: str | None = None,
    q: str | None = None,
    limit: int = Query(60, ge=1, le=200),
) -> dict:
    clauses: list[str] = []
    values: list = []
    if category:
        clauses.append("category = ?")
        values.append(category)
    if urgency:
        clauses.append("urgency = ?")
        values.append(urgency)
    if source_id:
        clauses.append("source_id = ?")
        values.append(source_id)
    if q:
        clauses.append("(lower(title) LIKE ? OR lower(summary) LIKE ?)")
        values.extend([f"%{q.lower()}%", f"%{q.lower()}%"])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(
            conn.execute(
                f"SELECT * FROM circulars {where} ORDER BY detected_at DESC LIMIT ?",
                (*values, limit),
            ).fetchall()
        )
    return {"items": [_decorate(row) for row in rows], "count": len(rows)}


@app.get("/api/circulars/{circular_id}")
async def get_circular(circular_id: str) -> dict:
    with db.get_conn() as conn:
        row = db.row_to_dict(
            conn.execute("SELECT * FROM circulars WHERE id = ?", (circular_id,)).fetchone()
        )
    if not row:
        raise HTTPException(status_code=404, detail="Circular not found")
    return _decorate(row)


@app.post("/api/classify")
async def classify_notice(payload: ClassifyRequest) -> dict:
    """Synchronous classification — useful for testing the local model directly."""
    started = datetime.now(timezone.utc)
    result = await classify(payload.title, payload.published_date, payload.text or "")
    result["elapsed_ms"] = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    result["llm_used"] = str(result.get("classifier", "")).startswith("rules+")
    return result


@app.post("/api/ask")
async def ask_question(payload: AskRequest) -> dict:
    """Answer a question using only captured notices, with citations."""
    return await answer_question(payload.question, payload.user_id)


def _apply_classification(circular_id: str, merged: dict) -> dict | None:
    with db.get_conn() as conn:
        cursor = conn.execute(
            "UPDATE circulars SET category = ?, summary = ?, deadline = ?, applies_to = ?, "
            "details = ?, urgency = ?, action_required = ?, confidence = ? WHERE id = ?",
            (
                merged["category"],
                merged.get("summary"),
                merged.get("deadline"),
                json.dumps(merged.get("applies_to") or {}),
                json.dumps(merged.get("details") or {}),
                merged.get("urgency") or "LOW",
                merged.get("action_required"),
                merged.get("confidence"),
                circular_id,
            ),
        )
        if cursor.rowcount == 0:
            return None
        row = conn.execute("SELECT * FROM circulars WHERE id = ?", (circular_id,)).fetchone()
    return _decorate(db.row_to_dict(row))


@app.post("/api/circulars/{circular_id}/reclassify")
async def reclassify_circular(circular_id: str) -> dict:
    with db.get_conn() as conn:
        row = db.row_to_dict(
            conn.execute("SELECT * FROM circulars WHERE id = ?", (circular_id,)).fetchone()
        )
    if not row:
        raise HTTPException(status_code=404, detail="Circular not found")
    merged = await classify(row["title"], row.get("published_date"), row.get("raw_text") or "")
    updated = _apply_classification(circular_id, merged)
    return {**updated, "classifier": merged.get("classifier")}


@app.post("/api/reclassify")
async def reclassify_recent(limit: int = Query(3, ge=1, le=50)) -> dict:
    """Re-run classification with the LLM over the most recent circulars."""
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(
            conn.execute(
                "SELECT * FROM circulars ORDER BY detected_at DESC LIMIT ?", (limit,)
            ).fetchall()
        )
    updated = []
    for row in rows:
        merged = await classify(row["title"], row.get("published_date"), row.get("raw_text") or "")
        if not str(merged.get("classifier", "")).startswith("rules+"):
            continue
        result = _apply_classification(row["id"], merged)
        if result:
            updated.append(result)
    return {"updated": len(updated), "requested": len(rows), "items": updated}


@app.get("/api/deadlines")
async def list_deadlines(limit: int = Query(12, ge=1, le=50)) -> dict:
    today = datetime.now(timezone.utc).date().isoformat()
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(
            conn.execute(
                "SELECT * FROM circulars WHERE deadline IS NOT NULL AND deadline >= ? "
                "ORDER BY deadline ASC, detected_at DESC LIMIT ?",
                (today, limit),
            ).fetchall()
        )
    return {"items": [_decorate(row) for row in rows], "count": len(rows)}


@app.get("/api/stats")
async def stats() -> dict:
    with db.get_conn() as conn:
        circulars = conn.execute("SELECT COUNT(*) AS c FROM circulars").fetchone()["c"]
        alerts = conn.execute(
            "SELECT COUNT(*) AS c FROM alerts WHERE status != 'suppressed'"
        ).fetchone()["c"]
        sources = conn.execute("SELECT COUNT(*) AS c FROM sources WHERE enabled = 1").fetchone()["c"]
        users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
        by_category = {
            row["category"]: row["c"]
            for row in conn.execute("SELECT category, COUNT(*) AS c FROM circulars GROUP BY category")
        }
        last_scan = conn.execute(
            "SELECT MAX(finished_at) AS t FROM scan_runs WHERE status = 'COMPLETED'"
        ).fetchone()["t"]
    return {
        "circulars": circulars,
        "alerts": alerts,
        "sources": sources,
        "users": users,
        "by_category": by_category,
        "last_scan_at": last_scan,
    }


# ---------------------------------------------------------------- users
@app.post("/api/users", status_code=201)
async def create_user(payload: UserCreate) -> dict:
    user_id = db.new_id()
    preferences = normalize_preferences(payload.preferences or DEFAULT_PREFERENCES)
    with db.get_conn() as conn:
        conn.execute(
            "INSERT INTO users (id, name, email, telegram_chat_id, preferences, institution, branch, semester, scheme, "
            "annual_income, social_category, domicile, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                user_id, payload.name, payload.email, payload.telegram_chat_id,
                json.dumps(preferences), payload.institution, payload.branch,
                payload.semester, payload.scheme, payload.annual_income,
                payload.social_category, payload.domicile, db.now_iso(),
            ),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_payload(db.row_to_dict(row))


@app.get("/api/users/me")
async def get_me(user_id: str | None = None) -> dict:
    with db.get_conn() as conn:
        if user_id:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        else:
            row = conn.execute("SELECT * FROM users ORDER BY created_at LIMIT 1").fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_payload(db.row_to_dict(row))


@app.patch("/api/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate) -> dict:
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "preferences" in updates:
        updates["preferences"] = json.dumps(normalize_preferences(updates["preferences"]))
    assignments = ", ".join(f"{key} = ?" for key in updates)
    with db.get_conn() as conn:
        cursor = conn.execute(
            f"UPDATE users SET {assignments} WHERE id = ?", (*updates.values(), user_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_payload(db.row_to_dict(row))


@app.get("/api/users/{user_id}/alerts")
async def user_alerts(user_id: str, limit: int = Query(50, ge=1, le=200)) -> dict:
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(
            conn.execute(
                "SELECT a.id AS alert_id, a.sent_at, a.channel, a.status AS alert_status, c.* "
                "FROM alerts a JOIN circulars c ON c.id = a.circular_id "
                "WHERE a.user_id = ? AND a.status != 'suppressed' ORDER BY a.sent_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        )
    return {"items": [_decorate(row) for row in rows], "count": len(rows)}


@app.post("/api/users/{user_id}/telegram")
async def link_telegram(user_id: str, payload: TelegramLink) -> dict:
    with db.get_conn() as conn:
        cursor = conn.execute(
            "UPDATE users SET telegram_chat_id = ? WHERE id = ?", (payload.chat_id, user_id)
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    return {"linked": True, "chat_id": payload.chat_id}


@app.post("/api/users/{user_id}/telegram/test")
async def test_telegram(user_id: str) -> dict:
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=400, detail="Telegram is not configured on this deployment")
    with db.get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    chat_id = row["telegram_chat_id"]
    if not chat_id:
        raise HTTPException(status_code=400, detail="Link Telegram first")
    preferences = normalize_preferences(row["preferences"])
    text = (
        "<b>CampusFish test alert</b>\n"
        f"Your Telegram alerts are limited to: {preference_summary(preferences)}.\n"
        "Notices outside these rules stay in the dashboard."
    )
    if not await send_telegram(chat_id, text):
        raise HTTPException(status_code=502, detail="Telegram did not accept the message")
    return {"sent": True}


# ---------------------------------------------------------------- telegram
@app.post("/api/telegram/webhook")
async def telegram_webhook(update: dict) -> dict:
    message = update.get("message") or {}
    text = (message.get("text") or "").strip()
    chat_id = str((message.get("chat") or {}).get("id") or "")
    if not chat_id or not text.startswith("/start"):
        return {"ok": True, "handled": False}
    parts = text.split()
    if len(parts) < 2:
        await send_telegram(chat_id, "Send /start &lt;your-id&gt; to link this chat.")
        return {"ok": True, "handled": True, "linked": False}
    user_id = parts[1]
    with db.get_conn() as conn:
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            await send_telegram(chat_id, "Account not found.")
            return {"ok": True, "handled": True, "linked": False}
        conn.execute("UPDATE users SET telegram_chat_id = ? WHERE id = ?", (chat_id, user_id))
    await send_telegram(chat_id, "<b>Linked.</b> You will receive personalised notice alerts here.")
    return {"ok": True, "handled": True, "linked": True}


@app.post("/api/telegram/poll")
async def trigger_telegram_poll() -> dict:
    await poll_telegram()
    return {"ok": True}


# ---------------------------------------------------------------- demo
@app.post("/api/demo/inject", status_code=201)
async def inject_demo(payload: InjectRequest | None = None) -> dict:
    payload = payload or InjectRequest()
    today = datetime.now(timezone.utc).date()
    deadline = payload.deadline or (today + timedelta(days=4)).isoformat()
    title = payload.title or (
        "Examination Registration and Fee Payment for B.E. 7th Semester (2022 Scheme) - "
        "Last Date Extended"
    )
    raw_text = payload.raw_text or (
        f"{title}. Students of B.E. 7th semester CSE-AIML under 2022 scheme must complete "
        f"examination registration and pay the prescribed fee on or before {deadline}. "
        "Late submissions will attract a penalty. Contact the examination section for details."
    )

    with db.get_conn() as conn:
        recent = conn.execute(
            "SELECT * FROM circulars WHERE title = ? AND detected_at > datetime('now', '-10 minutes')",
            (title,),
        ).fetchone()
        if recent:
            return {**_decorate(db.row_to_dict(recent)), "duplicate": True, "alerts_created": 0}

    base = rule_classify(title, today.isoformat(), raw_text)
    classification = {
        "category": payload.category or "FEE_OR_FORM_DEADLINE",
        "summary": payload.summary
        or "Exam registration and fee payment for 7th sem CSE-AIML extended - act before the deadline.",
        "deadline": deadline,
        "applies_to": payload.applies_to
        or {"branches": ["CSE-AIML"], "semesters": ["7"], "schemes": ["2022"]},
        "urgency": payload.urgency or "HIGH",
        "action_required": f"Pay the exam fee before {deadline}",
        "details": payload.details or base.get("details") or {},
        "confidence": "high",
    }

    source_name = payload.source_name or "Demo injection"
    with db.get_conn() as conn:
        source = conn.execute("SELECT * FROM sources ORDER BY created_at LIMIT 1").fetchone()
        circular = {
            "id": db.new_id(),
            "source_id": source["id"] if source else None,
            "source_name": source_name,
            "institution": source["institution"] if source else None,
            "title": title,
            "published_date": today.isoformat(),
            "url": payload.url or (source["url"] if source else None),
            "content_hash": f"demo-{db.new_id()}",
            "raw_text": raw_text,
            "category": classification["category"],
            "summary": classification["summary"],
            "deadline": classification["deadline"],
            "applies_to": classification["applies_to"],
            "details": classification["details"],
            "urgency": classification["urgency"],
            "action_required": classification["action_required"],
            "confidence": classification["confidence"],
            "detected_at": db.now_iso(),
        }
        conn.execute(
            "INSERT INTO circulars (id, source_id, source_name, institution, title, published_date, url, "
            "content_hash, raw_text, category, summary, deadline, applies_to, details, urgency, action_required, confidence, detected_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                circular["id"], circular["source_id"], circular["source_name"], circular["institution"],
                circular["title"], circular["published_date"], circular["url"], circular["content_hash"],
                circular["raw_text"], circular["category"], circular["summary"], circular["deadline"],
                json.dumps(circular["applies_to"]), json.dumps(circular["details"]),
                circular["urgency"], circular["action_required"],
                circular["confidence"], circular["detected_at"],
            ),
        )
        alerts = await create_alerts(conn, circular)

    return {**_decorate(circular), "alerts_created": alerts, "duplicate": False, "rule_baseline": base["category"]}
