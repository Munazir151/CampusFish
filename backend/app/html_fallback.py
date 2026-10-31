"""Generic HTML fallback for notice pages.

The TinyFish agent is the primary reader. When a portal serves a degraded layout
(mobile overlay, anti-bot interstitial) the agent can finish a run with an empty
list, so we parse the page ourselves. This works for the common WordPress-style
notice archive and is used only as a safety net.
"""

import html
import re
from datetime import datetime
from urllib.parse import urljoin

import httpx

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

DETAIL_URL_RE = re.compile(r"/20\d{2}/(?:0?[1-9]|1[0-2])/\d+/?$")
PDF_RE = re.compile(r"\.pdf(?:[?#]|$)", re.IGNORECASE)
ARTICLE_RE = re.compile(r"<article\b.*?</article>", re.IGNORECASE | re.DOTALL)
ANCHOR_RE = re.compile(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)

SKIP_TITLES = {
    "read more", "read more...", "read more »", "no comment", "comments",
    "continue reading", "view", "download", "click here",
}


_CACHE: dict[str, dict] = {}
_CACHE_LIMIT = 100


def _clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = html.unescape(html.unescape(text))
    return re.sub(r"\s+", " ", text).strip(" \t\n\r-–|:")


def _date_from_url(url: str) -> str | None:
    match = re.search(r"/20(\d{2})/(\d{2})/\d+", url)
    if not match:
        return None
    return f"20{match.group(1)}-{match.group(2)}-01"


def _parse_day_month(day: str, month: str) -> str | None:
    token = f"{day.strip()} {month.strip()}"
    for fmt in ("%d %b %Y", "%d %B %Y", "%d %b, %Y", "%d %B, %Y"):
        try:
            return datetime.strptime(token, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _article_items(page: str, base_url: str) -> list[dict]:
    items: list[dict] = []
    for block in ARTICLE_RE.findall(page):
        anchor = re.search(
            r'<h[12][^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            block,
            re.IGNORECASE | re.DOTALL,
        )
        if not anchor:
            for candidate in ANCHOR_RE.finditer(block):
                href = html.unescape(candidate.group(1))
                if DETAIL_URL_RE.search(href) or PDF_RE.search(href):
                    anchor = candidate
                    break
        if not anchor:
            continue
        url = urljoin(base_url, html.unescape(anchor.group(1)))
        title = _clean(anchor.group(2))
        if len(title) < 10 or title.lower() in SKIP_TITLES:
            continue
        day = re.search(r'class="[^"]*entry-day[^"]*"[^>]*>\s*(\d{1,2})\s*<', block, re.IGNORECASE)
        month = re.search(
            r'class="[^"]*entry-month[^"]*"[^>]*>\s*([A-Za-z]{3,9}\s+\d{4})\s*<',
            block,
            re.IGNORECASE,
        )
        published = _parse_day_month(day.group(1), month.group(1)) if day and month else None
        items.append(
            {
                "title": title,
                "url": url,
                "date": published or _date_from_url(url),
                "section": "HTML fallback",
            }
        )
    return items


def _anchor_items(page: str, base_url: str) -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for match in ANCHOR_RE.finditer(page):
        href = html.unescape(match.group(1))
        if not (DETAIL_URL_RE.search(href) or PDF_RE.search(href)):
            continue
        url = urljoin(base_url, href)
        if url in seen:
            continue
        title = _clean(match.group(2))
        if len(title) < 10 or title.lower() in SKIP_TITLES:
            continue
        seen.add(url)
        items.append(
            {
                "title": title,
                "url": url,
                "date": _date_from_url(url),
                "section": "HTML fallback",
            }
        )
    return items


def _parse_page(page: str, url: str) -> list[dict]:
    items = _article_items(page, url)
    if len(items) < 3:
        seen = {item["url"] for item in items}
        items.extend(item for item in _anchor_items(page, url) if item["url"] not in seen)
    return items


def _can_paginate(url: str) -> bool:
    return url.endswith("/") and "/page/" not in url and not DETAIL_URL_RE.search(url) and not PDF_RE.search(url)


async def fetch_items(url: str, limit: int = 20, pages: int = 3) -> list[dict]:
    cached = _CACHE.get(url)
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9"}
    if cached:
        if cached.get("etag"):
            headers["If-None-Match"] = cached["etag"]
        if cached.get("last_modified"):
            headers["If-Modified-Since"] = cached["last_modified"]

    items: list[dict] = []
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(40.0, connect=15.0),
            follow_redirects=True,
            headers=headers,
        ) as client:
            response = await client.get(url)
            if response.status_code == 304 and cached:
                return cached.get("items", [])[:limit]
            if response.status_code >= 400:
                return []
            items = _parse_page(response.text, url)

            # Notice archives usually paginate as /page/2/. Follow a couple of pages
            # so a scan captures more than the first screen.
            if len(items) >= 3 and pages > 1 and _can_paginate(url):
                seen = {item["url"] for item in items}
                base = url.rstrip("/")
                for number in range(2, pages + 1):
                    if len(items) >= limit:
                        break
                    try:
                        next_page = await client.get(f"{base}/page/{number}/")
                    except httpx.HTTPError:
                        break
                    if next_page.status_code >= 400:
                        break
                    fresh = [item for item in _parse_page(next_page.text, url) if item["url"] not in seen]
                    if not fresh:
                        break
                    seen.update(item["url"] for item in fresh)
                    items.extend(fresh)
    except httpx.HTTPError:
        return []

    items = items[:limit]

    if len(_CACHE) >= _CACHE_LIMIT and url not in _CACHE:
        _CACHE.pop(next(iter(_CACHE)), None)
    _CACHE[url] = {
        "etag": response.headers.get("etag"),
        "last_modified": response.headers.get("last-modified"),
        "items": items,
    }
    return items
