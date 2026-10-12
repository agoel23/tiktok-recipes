"""Recipe web pages: schema.org Recipe data when present, else the page's main text."""

import hashlib
import json
import re
from urllib.parse import urlparse, urlunparse

import trafilatura
from curl_cffi import requests

from . import Fetched, FetchError

MAX_TEXT_CHARS = 60_000


def canonical_url(url: str) -> str:
    """Drop tracking params/fragments so the same recipe dedupes."""
    p = urlparse(url)
    return urlunparse((p.scheme or "https", (p.hostname or "").lower(), p.path.rstrip("/") or "/", "", "", ""))


def _meta(html: str, prop: str) -> str | None:
    m = re.search(
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)', html, re.I
    ) or re.search(
        rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']', html, re.I
    )
    return m.group(1) if m else None


def _structured(html: str, url: str) -> dict | None:
    try:
        from recipe_scrapers import scrape_html
        scraper = scrape_html(html, org_url=url, supported_only=False)
        data = scraper.to_json()
    except Exception:
        return None
    return data if data.get("ingredients") else None


def fetch_web(url: str) -> Fetched:
    try:
        # Impersonate Chrome's TLS fingerprint; many recipe sites 403 plain HTTP clients.
        resp = requests.get(url, impersonate="chrome", allow_redirects=True, timeout=30)
    except requests.RequestsError as e:
        raise FetchError(f"Couldn't reach the page: {e}") from e
    if resp.status_code in (401, 403, 429, 503):
        raise FetchError(f"The site blocked automated access (HTTP {resp.status_code}). Paste the recipe text instead.")
    if resp.status_code >= 400:
        raise FetchError(f"The page returned HTTP {resp.status_code}.")

    html = resp.text
    final_url = str(resp.url)
    canon = canonical_url(final_url)
    site = _meta(html, "og:site_name") or (urlparse(final_url).hostname or "").removeprefix("www.")

    structured = _structured(html, final_url)
    page_text = trafilatura.extract(html, include_comments=False) or ""
    parts = []
    if structured:
        keep = {k: structured.get(k) for k in (
            "title", "yields", "prep_time", "cook_time", "total_time", "ingredients",
            "ingredient_groups", "instructions_list", "instructions", "cuisine", "category",
        ) if structured.get(k)}
        parts.append("STRUCTURED RECIPE DATA:\n" + json.dumps(keep, ensure_ascii=False, default=str))
    if page_text:
        parts.append("PAGE TEXT:\n" + page_text)
    text = "\n\n".join(parts)[:MAX_TEXT_CHARS]
    if not text.strip():
        raise FetchError("Couldn't find any recipe text on that page. Paste the recipe text instead.")

    return Fetched(
        source_type="web",
        source_id=hashlib.sha1(canon.encode()).hexdigest()[:16],
        url=canon,
        title=(structured or {}).get("title") or _meta(html, "og:title"),
        author=(structured or {}).get("author"),
        source_name=site,
        thumbnail_url=(structured or {}).get("image") or _meta(html, "og:image"),
        text=text,
    )
