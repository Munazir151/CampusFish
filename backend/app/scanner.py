import asyncio
import hashlib
import json
import logging
import re
from urllib.parse import urljoin

from . import db, html_fallback
from .alerts import create_alerts
from .classifier import classify, demojibake, parse_published_date, rule_classify
from .config import settings
from .tinyfish import TinyFishClient, TinyFishError, extract_result, normalize_items

logger = logging.getLogger("noticeradar.scanner")

SCAN_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "date": {"type": "string", "nullable": True},
                    "url": {"type": "string", "nullable": True},
                    "section": {"type": "string", "nullable": True},
                },
                "required": ["title"],
            },
        }
    },
    "required": ["results"],
}

ENRICH_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "body_text": {"type": "string"},
        "dates_found": {"type": "array", "items": {"type": "string"}},
        "links": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["body_text"],
}

SCAN_GOAL_TEMPLATE = (
    "On this page, list the {max_items} most recent circulars/notifications. Stay on this page — "
    "do not paginate or open each item. For each item return: title, date (as shown on the page, "
    "ISO format if possible), the direct URL of the PDF or detail page, and the page section it came "
    "from. Do not invent items that are not on the page."
)

ENRICH_GOAL = (
    "Open this circular/notice or PDF. Extract the full visible text of the notice, any dates, and any "
    "download links. Return the title, the complete body text, every date you can find, and the links."
)

_refine_tasks: set[asyncio.Task] = set()


def content_hash(title: str, published_date: str | None, url: str | None) -> str:
    title_norm = re.sub(r"[^a-z0-9]+", "", (title or "").lower())
    url_norm = (url or "").strip().lower()
    raw = f"{title_norm}|{(published_date or '').strip()}|{url_norm}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_scan_group(source_ids: list[str] | None = None) -> tuple[str, list[dict]]:
    group_id = db.new_id()
    if source_ids is not None and not source_ids:
        return group_id, []
    with db.get_conn() as conn:
        query = "SELECT * FROM sources WHERE enabled = 1"
        params: tuple = ()
        if source_ids:
            placeholders = ",".join("?" for _ in source_ids)
            query += f" AND id IN ({placeholders})"
            params = tuple(source_ids)
        sources = db.rows_to_dicts(conn.execute(f"{query} ORDER BY created_at", params).fetchall())
        if not sources:
            return group_id, []
        runs = []
        for source in sources:
            run_id = db.new_id()
            conn.execute(
                "INSERT INTO scan_runs (id, scan_group_id, source_id, source_name, status, started_at) "
                "VALUES (?,?,?,?,?,?)",
                (run_id, group_id, source["id"], source["name"], "PENDING", db.now_iso()),
            )
            runs.append({"id": run_id, "source_id": source["id"], "source_name": source["name"]})
    return group_id, runs


async def run_scan_group(group_id: str) -> None:
    with db.get_conn() as conn:
        runs = db.rows_to_dicts(
            conn.execute("SELECT * FROM scan_runs WHERE scan_group_id = ?", (group_id,)).fetchall()
        )
        sources = {
            row["id"]: dict(row)
            for row in conn.execute("SELECT * FROM sources").fetchall()
        }

    if not runs:
        return

    client = TinyFishClient()
    semaphore = asyncio.Semaphore(3)

    async def guarded(run: dict) -> None:
        async with semaphore:
            await scan_source(client, run, sources.get(run["source_id"] or ""))

    try:
        await asyncio.gather(*(guarded(run) for run in runs))
    finally:
        await client.close()
        write_fallback_cache()


async def scan_source(client: TinyFishClient, run: dict, source: dict) -> None:
    run_id = run["id"]
    _update_run(run_id, status="RUNNING")

    goal = (source.get("goal") or "").strip() or SCAN_GOAL_TEMPLATE.format(max_items=8)
    if (source.get("goal") or "").strip():
        # Custom goals still feed the same structured schema; tell the agent what shape
        # the extractor needs so a dynamic site does not come back empty.
        goal += (
            " Return each item with: title, date (if shown), and the direct URL — use this listing "
            "page URL when an item has no stable link. Do not invent items."
        )

    items: list[dict] = []
    tinyfish_run_id: str | None = None
    extraction = "html_fallback"
    error_message: str | None = None

    # Start the browser agent for the live trace and for portals we cannot read
    # directly — but do not make the scan wait for it when a direct read works.
    try:
        tinyfish_run_id = await client.start_run(source["url"], goal, SCAN_SCHEMA)
        _set_agent_run_id(run_id, tinyfish_run_id)
    except Exception as exc:  # noqa: BLE001 - the direct read can still succeed
        logger.info("Agent could not start for %s: %s", source.get("url"), exc)

    try:
        items = await asyncio.wait_for(
            html_fallback.fetch_items(source["url"], limit=30),
            timeout=max(2, settings.fast_path_seconds),
        )
    except Exception:  # noqa: BLE001 - timeout or fetch failure
        items = []

    if not items and tinyfish_run_id:
        extraction = "agent"
        try:
            agent_run = await client.wait_for_run(tinyfish_run_id, settings.agent_timeout_seconds)
            items = normalize_items(extract_result(agent_run))
        except TinyFishError as exc:
            error_message = str(exc)
            logger.warning("Agent failed for %s: %s", source.get("url"), exc)
    elif not items:
        error_message = "The page could not be read and the browser agent could not start"

    if not items and error_message:
        _update_run(run_id, status="FAILED", error=error_message[:900], finished=True)
        # Record the attempt, otherwise a watcher would retry a broken portal
        # every minute. The next due scan is controlled by SCAN_INTERVAL_MINUTES.
        with db.get_conn() as conn:
            conn.execute(
                "UPDATE sources SET last_scanned_at = ? WHERE id = ?",
                (db.now_iso(), source["id"]),
            )
        return

    with db.get_conn() as conn:
        conn.execute(
            "UPDATE scan_runs SET tinyfish_run_id = ?, total_items_count = ?, extraction = ? WHERE id = ?",
            (tinyfish_run_id, len(items), extraction, run_id),
        )
        conn.execute(
            "UPDATE sources SET last_scanned_at = ? WHERE id = ?",
            (db.now_iso(), source["id"]),
        )

    new_count = 0
    new_ids: list[str] = []
    enrich_budget = settings.enrich_max_items if settings.enable_pdf_enrich else 0

    prepared: list[dict] = []
    for index, item in enumerate(items):
        title = demojibake(str(item.get("title") or item.get("name") or "")).strip()
        if not title:
            continue
        url = str(item.get("url") or item.get("link") or item.get("pdf_url") or "").strip()
        if url:
            url = urljoin(source["url"], url)
        published = parse_published_date(item.get("date") or item.get("published_date"))
        prepared.append(
            {
                "title": title,
                "url": url or source["url"],
                "published_date": published,
                "section": item.get("section"),
                "index": index,
            }
        )

    with db.get_conn() as conn:
        existing = {
            row["content_hash"]
            for row in conn.execute("SELECT content_hash FROM circulars").fetchall()
        }

    fresh = []
    for item in prepared:
        item["content_hash"] = content_hash(item["title"], item["published_date"], item["url"])
        if item["content_hash"] in existing:
            continue
        existing.add(item["content_hash"])
        fresh.append(item)

    for item in fresh:
        # Fast deterministic pass so the feed and alerts are immediate; the LLM refines below.
        classification = rule_classify(item["title"], item["published_date"], item.get("raw_text", ""))
        circular = {
            "id": db.new_id(),
            "source_id": source["id"],
            "source_name": source["name"],
            "institution": source.get("institution"),
            "title": item["title"],
            "published_date": item["published_date"],
            "url": item["url"],
            "content_hash": item["content_hash"],
            "raw_text": item.get("raw_text"),
            "category": classification["category"],
            "summary": classification["summary"],
            "deadline": classification.get("deadline"),
            "applies_to": classification.get("applies_to") or {},
            "details": classification.get("details") or {},
            "urgency": classification.get("urgency") or "LOW",
            "action_required": classification.get("action_required"),
            "confidence": classification.get("confidence"),
            "detected_at": db.now_iso(),
        }
        with db.get_conn() as conn:
            cursor = conn.execute(
                "INSERT OR IGNORE INTO circulars (id, source_id, source_name, institution, title, published_date, url, "
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
            inserted = cursor.rowcount > 0
            if inserted:
                new_count += 1
                new_ids.append(circular["id"])
                await create_alerts(conn, circular)

    upgrade_limit = max(
        settings.llm_max_items_per_scan if settings.llm_configured else 0,
        enrich_budget,
    )
    if new_ids and upgrade_limit > 0:
        task = asyncio.create_task(_upgrade_circulars(new_ids[:upgrade_limit], enrich_budget))
        _refine_tasks.add(task)
        task.add_done_callback(_refine_tasks.discard)

    _update_run(
        run_id,
        status="COMPLETED",
        new_items=new_count,
        total_items=len(prepared),
        finished=True,
        extraction=extraction,
    )
    logger.info("Source %s: %s items, %s new", source.get("name"), len(prepared), new_count)


async def _upgrade_circulars(circular_ids: list[str], enrich_budget: int) -> None:
    """Read detail pages and classify with the LLM after the scan has already finished."""
    client: TinyFishClient | None = None
    upgraded = 0
    try:
        for index, circular_id in enumerate(circular_ids):
            with db.get_conn() as conn:
                row = db.row_to_dict(
                    conn.execute("SELECT * FROM circulars WHERE id = ?", (circular_id,)).fetchone()
                )
            if not row:
                continue

            raw_text = row.get("raw_text") or ""
            if index < enrich_budget and not raw_text and row.get("url"):
                try:
                    if client is None:
                        client = TinyFishClient()
                    run = await client.run(
                        row["url"], ENRICH_GOAL, ENRICH_SCHEMA, settings.enrich_timeout_seconds
                    )
                    result = extract_result(run)
                    if isinstance(result, dict):
                        body = result.get("body_text") or ""
                        if isinstance(body, str) and body.strip():
                            raw_text = body.strip()[:20000]
                            with db.get_conn() as conn:
                                conn.execute(
                                    "UPDATE circulars SET raw_text = ? WHERE id = ?",
                                    (raw_text, circular_id),
                                )
                except Exception as exc:  # noqa: BLE001 - enrichment is best effort
                    logger.info("Detail read failed for %s: %s", row.get("url"), exc)

            try:
                merged = await classify(row["title"], row.get("published_date"), raw_text)
            except Exception as exc:  # noqa: BLE001 - refinement is best effort
                logger.info("LLM refine failed for %s: %s", circular_id, exc)
                continue
            if not str(merged.get("classifier", "")).startswith("rules+"):
                continue
            with db.get_conn() as conn:
                conn.execute(
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
                upgraded_row = db.row_to_dict(
                    conn.execute("SELECT * FROM circulars WHERE id = ?", (circular_id,)).fetchone()
                )
                # The refined category may now fit a student's preferences. Alerts are
                # deduplicated by (user, circular), so nobody receives it twice.
                if upgraded_row:
                    await create_alerts(conn, upgraded_row)
            upgraded += 1
            logger.info("Upgraded %s -> %s (%s)", circular_id, merged["category"], merged.get("classifier"))
    finally:
        if client is not None:
            await client.close()
    if upgraded:
        logger.info("Upgraded %s circulars", upgraded)
        write_fallback_cache()


async def _run_with_retry(
    client: TinyFishClient,
    url: str,
    goal: str,
    schema: dict,
    scan_run_id: str | None = None,
) -> dict:
    async def attempt() -> dict:
        tinyfish_run_id = await client.start_run(url, goal, schema)
        # Publish the run id immediately so the dashboard can show the live trace.
        if scan_run_id:
            _set_agent_run_id(scan_run_id, tinyfish_run_id)
        run = await client.wait_for_run(tinyfish_run_id, settings.agent_timeout_seconds)
        run["_run_id"] = tinyfish_run_id
        return run

    try:
        return await attempt()
    except TinyFishError as first_error:
        logger.info("Retrying %s once after: %s", url, first_error)
        await asyncio.sleep(2)
        return await attempt()


def _set_agent_run_id(scan_run_id: str, tinyfish_run_id: str) -> None:
    with db.get_conn() as conn:
        conn.execute(
            "UPDATE scan_runs SET tinyfish_run_id = ? WHERE id = ?",
            (tinyfish_run_id, scan_run_id),
        )


def _update_run(
    run_id: str,
    status: str,
    error: str | None = None,
    finished: bool = False,
    new_items: int | None = None,
    total_items: int | None = None,
    extraction: str | None = None,
) -> None:
    fields = ["status = ?"]
    values: list = [status]
    if error is not None:
        fields.append("error = ?")
        values.append(error)
    if finished:
        fields.append("finished_at = ?")
        values.append(db.now_iso())
    if new_items is not None:
        fields.append("new_items_count = ?")
        values.append(new_items)
    if total_items is not None:
        fields.append("total_items_count = ?")
        values.append(total_items)
    if extraction is not None:
        fields.append("extraction = ?")
        values.append(extraction)
    values.append(run_id)
    with db.get_conn() as conn:
        conn.execute(f"UPDATE scan_runs SET {', '.join(fields)} WHERE id = ?", values)


def write_fallback_cache() -> None:
    import os

    with db.get_conn() as conn:
        rows = db.rows_to_dicts(
            conn.execute("SELECT * FROM circulars ORDER BY detected_at DESC LIMIT 100").fetchall()
        )
    if not rows:
        return
    path = os.path.join(settings.data_dir, "fallback_circulars.json")
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, ensure_ascii=False, indent=2)
    except OSError:
        logger.warning("Could not write fallback cache")
