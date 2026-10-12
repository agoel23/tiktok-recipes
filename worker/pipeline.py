"""One job: fetch → transcribe → extract → save."""

import hashlib
import logging
import re
import tempfile
from pathlib import Path

from . import db
from .extract import extract
from .schema import ExtractedRecipe, measurements_source
from .sources import Fetched, FetchError, fetch
from .sources.web import canonical_url
from .transcribe import transcribe

log = logging.getLogger("worker")


def recipe_id(source_type: str, source_id: str) -> str:
    return f"{source_type}-{source_id}"


def id_from_url(url: str, source_type: str) -> str | None:
    """Best-effort source id without network access (short links return None)."""
    if source_type == "tiktok":
        m = re.search(r"/(?:video|photo)/(\d+)", url)
        return m.group(1) if m else None
    if source_type == "instagram":
        m = re.search(r"/(?:reel|reels|p|tv)/([A-Za-z0-9_-]+)", url)
        return m.group(1) if m else None
    return hashlib.sha1(canonical_url(url).encode()).hexdigest()[:16]


def recipe_fields(r: ExtractedRecipe) -> dict:
    return {
        "title": r.title.strip(),
        "cuisine": r.cuisine,
        "tags": [t.lower().strip() for t in r.tags][:8],
        "base_servings": max(1, r.base_servings),
        "servings_estimated": r.servings_estimated,
        "measurements_source": measurements_source(r.ingredients),
        "prep_minutes": r.prep_minutes,
        "cook_minutes": r.cook_minutes,
        "total_minutes": r.total_minutes,
        "time_estimated": r.time_estimated,
        "ingredients": [i.model_dump() for i in r.ingredients],
        "steps": [s.model_dump() for s in r.steps],
        "notes": r.notes,
    }


def run_import(job: dict) -> None:
    url, source_type, manual = job["url"].strip(), job["source_type"], (job.get("manual_text") or "").strip()

    guessed = id_from_url(url, source_type)
    if guessed and not manual and db.get_recipe(recipe_id(source_type, guessed)):
        db.update_job(job["id"], status="done", recipe_id=recipe_id(source_type, guessed))
        log.info("already saved: %s", url)
        return

    with tempfile.TemporaryDirectory(prefix="recipe-") as tmp:
        try:
            fetched = fetch(url, source_type, Path(tmp))
        except FetchError:
            if not manual:
                raise
            if not guessed:
                raise FetchError("Couldn't open this short link. Paste the full link (open it in a browser first).")
            fetched = Fetched(source_type=source_type, source_id=guessed, url=url)

        rid = recipe_id(fetched.source_type, fetched.source_id)
        if not manual and db.get_recipe(rid):
            db.update_job(job["id"], status="done", recipe_id=rid)
            log.info("already saved: %s", rid)
            return

        transcript = ""
        if fetched.audio_path:
            try:
                transcript = transcribe(fetched.audio_path)
            except Exception as e:  # caption alone may still be enough
                log.warning("transcription failed for %s: %s", rid, e)
                if not fetched.text and not manual:
                    raise RuntimeError(f"Transcription failed and there's no caption: {e}") from e

    caption = "\n\n".join(t for t in (fetched.text if source_type != "web" else "", manual) if t)
    page_text = fetched.text if source_type == "web" else ""
    result = extract(caption=caption, transcript=transcript, page_text=page_text, title_hint=fetched.title)

    source_text = "\n\n".join(t for t in (fetched.text, manual and f"[Pasted text]\n{manual}") if t)
    if not result.is_recipe:
        db.update_job(job["id"], status="not_recipe", error="This doesn't look like a recipe.")
        log.info("not a recipe: %s", url)
        return

    db.upsert_recipe({
        "id": rid,
        "source_type": fetched.source_type,
        "source_id": fetched.source_id,
        "source_url": fetched.url,
        "source_name": fetched.source_name,
        "author": fetched.author,
        "thumbnail_path": db.store_thumbnail(rid, fetched.thumbnail_url),
        **recipe_fields(result),
    }, source_text=source_text, transcript=transcript)
    db.update_job(job["id"], status="done", recipe_id=rid, error=None)
    log.info("saved %s: %s", rid, result.title)


def run_reextract(job: dict) -> None:
    rid = job.get("recipe_id")
    sources = db.get_sources(rid) if rid else None
    if not sources:
        raise RuntimeError("No saved source text for this recipe; re-add it from the link instead.")
    recipe = db.get_recipe(rid) or {}
    text = sources.get("source_text") or ""
    if job.get("manual_text"):
        text = f"{text}\n\n[Pasted text]\n{job['manual_text']}".strip()
    is_web = recipe.get("source_type") == "web"
    result = extract(
        caption="" if is_web else text,
        page_text=text if is_web else "",
        transcript=sources.get("transcript") or "",
        title_hint=recipe.get("title"),
    )
    if not result.is_recipe:
        db.update_job(job["id"], status="not_recipe", error="Claude no longer sees a recipe here; recipe left unchanged.")
        return
    db.update_recipe(rid, recipe_fields(result))
    db.update_job(job["id"], status="done", error=None)
    log.info("re-extracted %s", rid)


def process(job: dict) -> None:
    try:
        (run_reextract if job["kind"] == "reextract" else run_import)(job)
    except Exception as e:
        log.exception("job %s failed", job["id"])
        db.update_job(job["id"], status="failed", error=str(e)[:500] or e.__class__.__name__)
