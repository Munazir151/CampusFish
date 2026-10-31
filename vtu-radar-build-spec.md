# VTU Radar — Build Spec (give this whole file to your coding agent)

## 0. Instructions to the coding agent
You are building a hackathon MVP in about 5 hours. Prioritize a working end-to-end demo over completeness. Build in the order given in section 12. Do not add features not listed here. Keep the UI clean and polished. If something is ambiguous, pick the simplest option and leave a `// TODO` comment.

## 1. Product in one line
VTU Radar is an AI agent that watches university portals (VTU and the student's college site), reads the circulars and PDFs, and sends each student a personalized alert with the deadline, before faculty forward it, so nobody misses exam, fee or make-up notices.

## 2. Problem
- VTU and affiliated colleges post circulars on web pages and PDFs with no API or RSS.
- Faculty forward them late (WhatsApp groups), so students miss form deadlines, revaluation windows and make-up exam notices.
- Students must manually check many pages, and most notices don't apply to their branch or semester.

## 3. Target user
A VTU-affiliated engineering student (for example: CSE-AIML, 7th sem, 2022 scheme, East Point College of Engineering & Technology). Demo persona: "Munazir".

## 4. MVP scope (hard limits)
- Sources: 2 only
  1. VTU official site, circulars/notifications page (https://vtu.ac.in)
  2. EPCET college notice/announcement page (find the real URL; use env var `COLLEGE_NOTICE_URL`)
- Alert categories: `EXAM_TIMETABLE`, `FEE_OR_FORM_DEADLINE`, `MAKEUP_OR_REVALUATION`, `RESULT`, `HOLIDAY_OR_GENERAL`
- Channel: Telegram bot + web dashboard
- Users: profile stored in DB (branch, semester, scheme, college). No complex auth for the MVP (a simple email or Telegram-chat-ID identity is enough).

## 5. Architecture
```
Scheduler (cron / manual "Run now" button)
   -> TinyFish Agent API (one run per source)
        goal: list latest circulars as structured JSON
   -> Backend (FastAPI)
        - dedupe by hash(title + date + url)
        - for each NEW circular: fetch PDF text (or run a second TinyFish run to open the PDF page)
        - LLM classify + extract (Claude API): category, deadline, audience, 1-line summary
        - match against user profiles
        - store in DB
        - send Telegram alert
   -> Frontend (Next.js) dashboard: feed, deadlines, profile, "Run scan now"
```

## 6. Tech stack
- Frontend: Next.js (App Router) + Tailwind
- Backend: FastAPI (Python)
- DB: Supabase (Postgres)
- Web agent: TinyFish Agent API (see section 7)
- LLM for classification: Claude API (model string from env `ANTHROPIC_MODEL`)
- Alerts: Telegram Bot API (python-telegram-bot or plain HTTPS calls)
- Scheduler: APScheduler inside FastAPI, plus a manual endpoint

## 7. TinyFish usage (verified from docs.tinyfish.ai; re-check exact request fields in the API reference)
- Base URL: `https://agent.tinyfish.ai`
- Auth: header `X-API-Key: $TINYFISH_API_KEY` (create the key at agent.tinyfish.ai/api-keys)
- Endpoints:
  - `POST /v1/automation/run` blocking, returns the final result
  - `POST /v1/automation/run-async` returns a `run_id`; then `GET /v1/runs/{id}` to poll. Status values: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED. The result is in `run.result` when COMPLETED.
  - `POST /v1/automation/run-sse` streams live events plus a streaming URL, useful for the demo UI
  - `POST /v1/automation/run-batch` for many runs at once
- Request body core fields: `url` and `goal` (natural language). The docs also describe structured output (JSON schema); read https://docs.tinyfish.ai/key-concepts/structured-output and use it if it is simple.
- SDKs: TypeScript `@tiny-fish/sdk` (`new TinyFish()`, `client.agent.run({url, goal})`), Python `tinyfish` (`TinyFish()`, `client.agent.stream(url=..., goal=...)`).
- Use `run-async` + polling in the backend for scans. Use `run-sse` only if you build the "watch the agent live" panel.

### Agent goals (use these as the `goal` strings, tune after the first test)
**Goal A: list circulars (run on each source URL)**
> "On this page, find the list of the latest circulars/notifications. Scroll or paginate until you have the 15 most recent items. For each item return JSON with: title, date (as shown on the page, ISO format if possible), the direct URL of the PDF or detail page, and the page section it came from. Return a JSON array only. Do not invent items that are not on the page."

**Goal B: read a detail page (only if the PDF link is not directly fetchable)**
> "Open this notice page. Extract the full visible text of the notice, any dates, and any download links. Return JSON: {title, body_text, dates_found, links}."

**Goal C (stretch, "acting for the student"): check a status page**
> "Open the exam registration / fee page, look for the current semester's registration status and the last date. Return JSON: {status, last_date, notes}. Do not submit any forms."

Safety rule: agents must be read-only. Never log in with real student credentials in the demo. Never submit forms.

## 8. LLM classification prompt (Claude API)
System prompt:
> You read Indian university circulars. Return ONLY valid JSON with these keys: category (one of EXAM_TIMETABLE, FEE_OR_FORM_DEADLINE, MAKEUP_OR_REVALUATION, RESULT, HOLIDAY_OR_GENERAL), summary (max 25 words, plain English), deadline (ISO date or null), applies_to {branches: [], semesters: [], schemes: []} (empty list means everyone), urgency (HIGH if deadline within 5 days or it is an exam/make-up notice, else MEDIUM or LOW), action_required (short string or null).

Input: the circular title, date, and extracted text. If extraction fails, classify by title only and set `confidence: "low"`.

## 9. Data model (Supabase)
- `users`: id, name, telegram_chat_id, college, branch, semester, scheme, created_at
- `sources`: id, name, url, last_scanned_at
- `circulars`: id, source_id, title, published_date, url, content_hash (unique), raw_text, category, summary, deadline, applies_to (jsonb), urgency, detected_at
- `alerts`: id, user_id, circular_id, sent_at, channel, status
- `scan_runs`: id, source_id, tinyfish_run_id, status, started_at, finished_at, new_items_count, error

## 10. Backend API (FastAPI)
- `POST /api/scan` : run a scan of all sources now (returns scan id)
- `GET /api/scan/{id}` : status plus count of new items
- `GET /api/circulars?category=&urgency=` : feed
- `GET /api/deadlines` : upcoming deadlines, sorted by date
- `POST /api/users` and `GET /api/users/me` : profile
- `POST /api/telegram/webhook` : links a Telegram chat to a user (`/start <user_id>`)
- `POST /api/demo/inject` : insert a fake new circular, so the live demo never depends on VTU posting something at that moment

Matching rule: a user gets an alert if `applies_to` is empty or contains the user's branch, semester and scheme.

## 11. Frontend pages (Next.js)
1. `/` landing: headline, one-line pitch, "Get started" button.
2. `/onboarding`: form for name, college, branch, semester, scheme, plus a "Connect Telegram" button (deep link `https://t.me/<bot>?start=<user_id>`).
3. `/dashboard`:
   - top bar: "Last scan: X min ago" and a "Scan now" button (shows scan progress)
   - "Deadlines this week" cards with countdown and urgency colour
   - Feed of circulars: category chip, one-line summary, source, "Detected Xh before typical faculty forwarding" badge (use `detected_at`; for the demo, just show the detection time), link to the original PDF
   - filter by category
4. `/agent-live` (stretch): embeds the TinyFish live streaming URL to show the agent browsing VTU.

UI: clean, mobile-first, dark/light friendly, easily understandable for everyone, clear urgency colours (red, amber, green).

## 12. Build order (time-boxed)
1. (30 min) Verify TinyFish: run Goal A against vtu.ac.in's circulars page through the API and print the JSON. This is the riskiest part, so do it first. If the page is hard, test with the college page.
2. (45 min) FastAPI skeleton, Supabase tables, `/api/scan` that stores deduped circulars.
3. (45 min) Claude classification and matching logic.
4. (30 min) Telegram bot and alert sending.
5. (75 min) Next.js onboarding and dashboard.
6. (30 min) `/api/demo/inject`, polish, error states, loading states.
7. (30 min) Stretch: live agent panel or Goal C. Then rehearse the demo.

## 13. Environment variables
```
TINYFISH_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
COLLEGE_NOTICE_URL=
VTU_CIRCULARS_URL=
```

## 14. Error handling and fallbacks
- If a TinyFish run FAILS or times out: log it in `scan_runs`, retry once, then show "Source temporarily unavailable" in the UI. Never crash the scan.
- Keep a cached JSON of the last good scan in `/data/fallback_circulars.json` so the dashboard is never empty during the demo.
- If the PDF can't be parsed: classify using the title only.
- Dedupe strictly by `content_hash` so users never get duplicate alerts.

## 15. Demo script (3 minutes)
1. Problem: show a WhatsApp-style late circular and say "this arrives 2 days late".
2. Onboard "Munazir" (CSE-AIML, 7th sem), connect Telegram.
3. Click "Scan now" and show TinyFish browsing the real VTU site (live panel if built).
4. A real or injected circular appears on the dashboard with category, deadline and summary.
5. The phone buzzes with the Telegram alert.
6. Close: "Works for any university portal, because TinyFish reads sites like a human, no scrapers per site."

## 16. Pitch points for the judges
- Real problem for lakhs of VTU students, with no existing API, which is why a web agent is needed.
- Uses TinyFish for navigation, pagination and PDF/page reading across messy sites.
- Personalized, so it is not another notice board.
- Easy expansion: add any university by adding a URL and a goal.

## 17. Out of scope (do NOT build)
Login with real student credentials, payments, form submission, multi-language support, mobile app, admin panel.
