# NoticeRadar

An AI agent that watches university, college and exam-board portals, reads the circulars and PDFs, and sends each student a personalised alert with the deadline — before faculty forwards it. Alerts are limited to the notice types, priority and deadline window each student chooses, so a scholarship feed does not become exam-notice noise.

Built with **TinyFish** (web agent), **FastAPI + SQLite** (backend), **Ollama** (local classification), and **Next.js + Tailwind** (dashboard).

No institution is hardcoded. Add any official portal — university, college, scholarship, education-loan, internship or job source — as a URL, and the agent reads it like a human. Every source can carry its own research goal.

---

## How it works

```
Source watcher (every WATCH_INTERVAL_SECONDS, default 60s)
   -> cheap HTML listing read per enabled source
        - a listing unseen before triggers a full scan immediately
        - otherwise the source is rescanned after SCAN_INTERVAL_MINUTES
   -> TinyFish agent per source (run-async + polling)
        goal: list the latest circulars as structured JSON
   -> HTML fallback in parallel (reliability when a portal serves a degraded layout)
   -> Backend (FastAPI)
        - dedupe by content_hash (title + date + url)
        - enrich the newest items by reading the detail page/PDF with the agent
        - fast rule-based classification, then Ollama refines in the background
        - extract stated benefit amount, income ceiling, category, domicile and course level
        - match against student profiles (branch / semester / scheme)
        - apply each student's alert preferences (types, priority, deadline window)
        - suppress only explicit income/category/domicile contradictions
        - store in SQLite, create only matching alerts
   -> Telegram alert after the grace period, re-checked against the refined
        notice, current preferences and eligibility; always visible on the dashboard
```

**Safety:** agents are read-only. No student logins, no form submission.

---

## Quick start

### 1. Prerequisites

- Python 3.11+
- Node 18+
- [Ollama](https://ollama.com) running locally with a model:
  ```bash
  ollama pull llama3.2:3b
  ollama list
  ```
- A TinyFish API key from https://agent.tinyfish.ai/api-keys

### 2. Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env` (copy `.env.example`) and set at least:

```env
TINYFISH_API_KEY=your_key
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:3b
```

Run it:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for the interactive API.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `TINYFISH_API_KEY` | — | TinyFish Agent API key (required) |
| `TINYFISH_BASE_URL` | `https://agent.tinyfish.ai` | Agent API base URL |
| `LLM_PROVIDER` | `ollama` | `ollama`, `anthropic`, or `none` |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Local Ollama server |
| `OLLAMA_MODEL` | `llama3.2:3b` | Model used for classification/refinement |
| `OLLAMA_TIMEOUT_SECONDS` | `180` | Per-call timeout |
| `LLM_MAX_ITEMS_PER_SCAN` | `12` | How many new notices get LLM refinement |
| `ANTHROPIC_API_KEY` | — | Only when `LLM_PROVIDER=anthropic` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` | Claude model |
| `TELEGRAM_BOT_TOKEN` | — | Enables phone alerts + `/start` linking |
| `TELEGRAM_BOT_USERNAME` | — | Deep link on the onboarding page |
| `SEED_SOURCES` | — | Optional JSON array of sources to seed a fresh database |
| `SEED_SAMPLE_DATA` | `false` | Load bundled sample notices when the database is empty |
| `DATABASE_PATH` | `./data/noticeradar.db` | SQLite database |
| `SCAN_INTERVAL_MINUTES` | `30` | Maximum time between full scans of a source |
| `WATCH_INTERVAL_SECONDS` | `60` | How often listings are checked for new items (minimum 15) |
| `AUTO_SCAN_ON_CHANGE` | `true` | Trigger a full scan as soon as a new listing is detected |
| `ALERT_GRACE_SECONDS` | `45` | Hold Telegram delivery so the refined classification is used |
| `ENABLE_PDF_ENRICH` | `true` | Read top items' detail pages/PDFs |
| `ENRICH_MAX_ITEMS` | `2` | Enrichment budget per scan |
| `AGENT_TIMEOUT_SECONDS` | `240` | Max time for the listing run |
| `RETRY_EMPTY_SCAN` | `true` | Retry the agent once on an empty extraction |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin |

> Classification never blocks ingestion. New notices are inserted with deterministic rules immediately, alerts are created, and Ollama upgrades category/summary/audience afterwards. The feed refreshes into the refined values.

---

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Status incl. TinyFish + Ollama reachability |
| GET | `/api/config` | Public config (LLM model, categories, interval) |
| GET/POST | `/api/sources` | List / add any portal (`name`, `url`, optional `goal`) |
| PATCH/DELETE | `/api/sources/{id}` | Pause/resume, edit, remove |
| POST | `/api/scan` | Start a scan of all enabled sources → `scan_id` |
| GET | `/api/scan/{scan_id}` | Status + per-source runs + new item count |
| GET | `/api/scans` | Recent scan groups |
| GET | `/api/circulars` | Feed (`category`, `urgency`, `q`, `limit`) |
| GET | `/api/circulars/{id}` | Single notice |
| GET | `/api/deadlines` | Upcoming deadlines sorted by date |
| POST | `/api/classify` | Classify arbitrary text (tests Ollama) |
| POST | `/api/circulars/{id}/reclassify` | Re-run classification on one notice |
| POST | `/api/reclassify?limit=N` | Re-run on the N most recent |
| POST | `/api/users` | Create a student profile |
| GET | `/api/users/me` | Profile (falls back to the first user) |
| PATCH | `/api/users/{id}` | Update profile |
| GET | `/api/users/{id}/alerts` | Alerts with joined notices |
| POST | `/api/users/{id}/telegram` | Link a chat ID |
| POST | `/api/users/{id}/telegram/test` | Send a test alert with the current preference summary |
| POST | `/api/telegram/webhook` | `/start <user_id>` linking |
| POST | `/api/demo/inject` | Insert a realistic circular + alerts |
| GET | `/api/agent/runs/{id}` | TinyFish run status, steps, streaming URL |
| GET | `/api/agent/runs/{id}/steps/{step}/screenshot` | Screenshot proxy |

Matching rule: a notice applies when each non-empty dimension in `applies_to` matches the student; empty lists mean everyone. An alert is then created only if its category is selected, its urgency meets the student's threshold and its deadline fits the chosen window. Everything else stays in Discover.

### Alert delivery

A matching notice creates an alert immediately, so it appears in the dashboard. Telegram delivery is queued for `ALERT_GRACE_SECONDS` (default 45) so the background classifier can finish. Just before sending, the notice is re-checked against the student's current preferences, audience and eligibility conditions. If the refined category, income limit, category list or domicile no longer fits, the alert is marked `suppressed` and never sent. A restart returns any in-flight `sending` alert to the queue.

The watcher also sends `ETag` / `Last-Modified` conditional requests, so an unchanged listing is answered with a 304 and costs almost nothing.

### Structured scholarship and loan facts

Scholarship, loan and opportunity notices are parsed for the facts students actually need before applying:

- benefit amount (₹ value),
- family-income ceiling,
- eligible social categories (SC, ST, OBC, EWS, Minority, PwD, General),
- domicile state (or All India),
- course level,
- a short verbatim eligibility note.

These appear on Discover cards, in Telegram alerts and on the Eligibility page. Rules extract them deterministically; the LLM can add to them only when the value also appears in the source document, so a small model cannot invent an income limit or category.

The profile accepts optional `annual_income`, `social_category` and `domicile`. They are used only to compare stated conditions:

- a clear contradiction (income above the ceiling, different category or domicile) suppresses that alert;
- missing profile information produces a “Check conditions” label and still delivers the alert, so an incomplete profile never silently hides an opportunity;
- the amount is shown even when no personal conditions are known.

Notification preferences live on the profile (`PATCH /api/users/{id}` with a `preferences` object):

```json
{
  "categories": ["SCHOLARSHIP", "EDUCATION_LOAN", "INTERNSHIP", "JOB_OR_PLACEMENT"],
  "min_urgency": "MEDIUM",
  "deadline_within_days": 30,
  "include_without_deadline": true
}
```

An empty `categories` list pauses alerts without deleting the profile. Telegram linking stays the same: open Profile → Connect Telegram, or send `/start <user_id>` to the bot.

---

## Adding another university

1. Dashboard → **Sources → Add**, or `POST /api/sources`:
   ```json
   { "name": "ABC University notifications", "url": "https://abc.edu/notices" }
   ```
2. Optionally override the extraction goal for an unusual layout:
   ```json
   { "name": "ABC", "url": "...", "goal": "List the 15 newest notifications with title, date and PDF link as JSON." }
   ```
3. Scan. The agent handles pagination and PDF links; the generic HTML fallback covers WordPress-style notice archives.

No per-site scraper code.

---

## Before deploying publicly

This build has no sign-in. Student IDs are UUIDs, but a UUID is an identifier rather than an authentication secret, and `/api/users/me` falls back to the first profile when no ID is supplied. Run it behind an authenticated reverse proxy or add a real sign-in / per-profile token before exposing it to the internet. Telegram linking and profile edits should be protected together.

Run the backend with one worker while the scheduler lives in-process:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

Every additional worker would start its own watcher and scan the same sources. If you need multiple workers, move the scheduler into a dedicated process first.

---

## Testing

```bash
cd backend
python scripts/smoke_test.py          # exercises every core endpoint
python scripts/seed_from_run.py <run_id>   # rebuild data/fallback_circulars.json from a real agent run
```

The bundled sample notices are only loaded when `SEED_SAMPLE_DATA=true`; by default a fresh install starts empty and honest.

---

## Project layout

```
backend/
  app/
    main.py          FastAPI routes
    scanner.py       scan orchestration, dedupe, alerts, background LLM refinement
    tinyfish.py      Agent API client (run-async + polling, schema, result normalisation)
    classifier.py    rules + Ollama/Claude classification and guards
    html_fallback.py generic notice-page parser (safety net)
    matching.py      student <-> notice matching
    alerts.py        preference-gated Telegram delivery + alert records
    eligibility.py   income / category / domicile condition comparison
    preferences.py   per-student category / urgency / deadline rules
    scheduler.py     source watcher, immediate scans, Telegram /start poller
    db.py            SQLite schema, seeds, fallback cache
  scripts/           smoke test + fallback seeding
frontend/
  app/               landing, onboarding, dashboard, agent-live
  components/        cards, nav, theme toggle
  lib/               API client and types
```
