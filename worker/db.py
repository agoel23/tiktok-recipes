"""Supabase access with the service-role key (bypasses RLS — keep it on the Mac)."""

from functools import lru_cache

from curl_cffi import requests
from supabase import Client, create_client

from .config import settings


@lru_cache(maxsize=1)
def client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def claim_next_job() -> dict | None:
    rows = (client().table("jobs").select("*").eq("status", "queued")
            .order("created_at").limit(1).execute().data)
    if not rows:
        return None
    job = rows[0]
    claimed = (client().table("jobs")
               .update({"status": "processing", "error": None, "attempts": job["attempts"] + 1})
               .eq("id", job["id"]).eq("status", "queued").execute().data)
    return claimed[0] if claimed else None


def update_job(job_id: str, **fields) -> None:
    client().table("jobs").update(fields).eq("id", job_id).execute()


def get_recipe(recipe_id: str) -> dict | None:
    rows = client().table("recipes").select("*").eq("id", recipe_id).limit(1).execute().data
    return rows[0] if rows else None


def get_sources(recipe_id: str) -> dict | None:
    rows = client().table("recipe_sources").select("*").eq("recipe_id", recipe_id).limit(1).execute().data
    return rows[0] if rows else None


def upsert_recipe(recipe: dict, source_text: str, transcript: str) -> None:
    client().table("recipes").upsert(recipe).execute()
    client().table("recipe_sources").upsert(
        {"recipe_id": recipe["id"], "source_text": source_text, "transcript": transcript}
    ).execute()


def update_recipe(recipe_id: str, fields: dict) -> None:
    client().table("recipes").update(fields).eq("id", recipe_id).execute()


def store_thumbnail(recipe_id: str, image_url: str | None) -> str | None:
    """Copy the image into our own bucket so it survives the original being deleted."""
    if not image_url:
        return None
    try:
        resp = requests.get(image_url, impersonate="chrome", allow_redirects=True, timeout=30)
        resp.raise_for_status()
    except Exception:
        return None
    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    ext = {"image/png": "png", "image/webp": "webp", "image/avif": "avif"}.get(content_type, "jpg")
    path = f"{recipe_id}.{ext}"
    client().storage.from_("thumbs").upload(
        path, resp.content, {"content-type": content_type, "upsert": "true"}
    )
    return path
