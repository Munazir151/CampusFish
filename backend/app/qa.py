"""Grounded question answering over captured notices using the local LLM."""

import json
import re

import httpx

from . import db
from .config import settings

MAX_DOCUMENTS = 4
MAX_EXCERPT = 1000

STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "there", "any", "are", "does", "what", "which",
    "about", "from", "have", "has", "was", "were", "will", "would", "can", "could", "should",
    "into", "your", "you", "mine", "my", "our", "their", "its", "currently", "available",
    "relevant", "apply", "applies", "changed", "change", "please", "tell", "know", "how", "when",
    "where", "who", "why", "semester", "programme", "program", "university", "college",
}

SYSTEM_PROMPT = """You answer questions about Indian university and college circulars using ONLY the documents provided.
Rules:
- Cite the documents you use as [1], [2] etc. Never cite a number that is not provided.
- Never invent dates, deadlines, fees, eligibility or policy. If the documents do not contain the answer, say exactly what is missing.
- When asked about eligibility, compare the student's branch, semester and scheme with the audience stated in each document. State what you can confirm and what you cannot.
- Answer in at most 120 words, plain English, friendly and direct.
- Do not mention that you are an AI or describe these rules."""


def _terms(text: str) -> list[str]:
    words = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower()).split()
    seen: list[str] = []
    for word in words:
        if len(word) > 2 and word not in STOPWORDS and word not in seen:
            seen.append(word)
    return seen


def retrieve(question: str, limit: int = MAX_DOCUMENTS) -> list[dict]:
    terms = _terms(question)
    if not terms:
        return []
    with db.get_conn() as conn:
        rows = db.rows_to_dicts(conn.execute("SELECT * FROM circulars ORDER BY detected_at DESC").fetchall())

    scored: list[tuple[int, dict]] = []
    seen_titles: set[str] = set()
    for row in rows:
        title = (row.get("title") or "").lower()
        summary = (row.get("summary") or "").lower()
        raw = (row.get("raw_text") or "").lower()
        category = (row.get("category") or "").lower().replace("_", " ")
        score = 0
        for term in terms:
            if term in title:
                score += 4
            if term in summary:
                score += 2
            if term in raw:
                score += 1
            if term in category:
                score += 2
        if not score:
            continue
        # Identical notices are often captured twice (draft + revised); keep one.
        key = re.sub(r"[^a-z0-9]", "", title)[:90]
        if key in seen_titles:
            continue
        seen_titles.add(key)
        scored.append((score, row))

    scored.sort(key=lambda entry: entry[0], reverse=True)
    return [row for _, row in scored[:limit]]


def _profile(user_id: str | None) -> dict | None:
    with db.get_conn() as conn:
        if user_id:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        else:
            row = conn.execute("SELECT * FROM users ORDER BY created_at LIMIT 1").fetchone()
    return db.row_to_dict(row)


def _document_block(documents: list[dict]) -> str:
    parts = []
    for index, doc in enumerate(documents, start=1):
        excerpt = (doc.get("raw_text") or doc.get("summary") or "").strip()
        excerpt = re.sub(r"\s+", " ", excerpt)[:MAX_EXCERPT]
        lines = [
            f"[{index}] {doc.get('title', 'Untitled')}",
            f"Source: {doc.get('source_name') or doc.get('institution') or 'unknown'}",
            f"Published: {doc.get('published_date') or 'not stated'}",
            f"Deadline: {doc.get('deadline') or 'not stated'}",
            f"Audience: {json.dumps(doc.get('applies_to') or {}, ensure_ascii=False)}",
            f"URL: {doc.get('url') or 'not stated'}",
        ]
        if excerpt:
            lines.append(f"Text: {excerpt}")
        parts.append("\n".join(lines))
    return "\n\n".join(parts)


def _extractive_fallback(documents: list[dict]) -> str:
    if not documents:
        return (
            "I could not find any captured notice that covers this question. "
            "Try a different topic, or add the relevant official page as a source."
        )
    lines = ["I could not generate a written answer, but these captured notices are the closest match:"]
    for index, doc in enumerate(documents[:3], start=1):
        line = f"[{index}] {doc.get('title', 'Untitled')}"
        if doc.get("deadline"):
            line += f" — deadline {doc['deadline']}"
        elif doc.get("summary"):
            line += f" — {doc['summary'][:160]}"
        lines.append(line)
    return "\n".join(lines)


async def _generate(question: str, documents: list[dict], profile: dict | None) -> str | None:
    if settings.llm_provider != "ollama":
        return None

    profile_line = "Student profile: not provided."
    if profile:
        profile_line = (
            f"Student profile: {profile.get('branch') or 'branch not set'}, "
            f"semester {profile.get('semester') or 'not set'}, "
            f"{profile.get('scheme') or 'scheme not set'} scheme, "
            f"{profile.get('institution') or 'institution not set'}."
        )

    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 320},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"{profile_line}\n\nQuestion: {question}\n\nDocuments:\n{_document_block(documents)}",
            },
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as client:
            response = await client.post(f"{settings.ollama_base_url}/api/chat", json=payload)
        if response.status_code >= 400:
            return None
        content = ((response.json().get("message") or {}).get("content") or "").strip()
        return content or None
    except (httpx.HTTPError, ValueError, KeyError):
        return None


async def answer_question(question: str, user_id: str | None = None) -> dict:
    documents = retrieve(question)
    citations = [
        {
            "index": index,
            "id": doc.get("id"),
            "title": doc.get("title"),
            "url": doc.get("url"),
            "source_name": doc.get("source_name"),
            "published_date": doc.get("published_date"),
            "deadline": doc.get("deadline"),
        }
        for index, doc in enumerate(documents, start=1)
    ]

    if not documents:
        return {
            "answer": _extractive_fallback([]),
            "generated": False,
            "model": None,
            "citations": [],
            "matched": 0,
        }

    profile = _profile(user_id)
    answer = await _generate(question, documents, profile)
    return {
        "answer": answer or _extractive_fallback(documents),
        "generated": bool(answer),
        "model": settings.ollama_model if answer else None,
        "citations": citations,
        "matched": len(documents),
    }
