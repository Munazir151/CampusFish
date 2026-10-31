"""Seed data/fallback_circulars.json from a completed TinyFish run (real scan results)."""

import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app import db  # noqa: E402
from app.classifier import demojibake, parse_published_date, rule_classify  # noqa: E402
from app.config import settings  # noqa: E402
from app.scanner import content_hash  # noqa: E402


async def main(run_id: str) -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.get(
            f"{settings.tinyfish_base_url}/v1/runs/{run_id}",
            headers={"X-API-Key": settings.tinyfish_api_key},
        )
        response.raise_for_status()
        run = response.json()

    result = run.get("result") or {}
    items = result.get("results") if isinstance(result, dict) else result
    items = items or []

    out = []
    now = datetime.now(timezone.utc)
    for index, item in enumerate(items):
        title = demojibake(str(item.get("title") or "")).strip()
        if not title:
            continue
        published = parse_published_date(item.get("date"))
        url = item.get("url") or ""
        classification = rule_classify(title, published, "")
        out.append(
            {
                "id": db.new_id(),
                "source_id": None,
                "source_name": "VTU - Examination",
                "institution": "Visvesvaraya Technological University",
                "title": title,
                "published_date": published,
                "url": url,
                "content_hash": content_hash(title, published, url),
                "raw_text": None,
                "category": classification["category"],
                "summary": classification["summary"],
                "deadline": classification["deadline"],
                "applies_to": classification["applies_to"],
                "urgency": classification["urgency"],
                "action_required": classification["action_required"],
                "confidence": classification["confidence"],
                "detected_at": (now - timedelta(minutes=35 * index)).isoformat(),
            }
        )

    path = Path(settings.data_dir) / "fallback_circulars.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(out)} circulars to {path}")
    for item in out[:5]:
        print(f" - [{item['category']}] {item['title'][:80]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: python scripts/seed_from_run.py <tinyfish_run_id>")
    asyncio.run(main(sys.argv[1]))
