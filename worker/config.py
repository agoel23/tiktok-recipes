"""Settings loaded from worker/.env (never committed)."""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(Path(__file__).resolve().parent / ".env")

CUISINES: list[str] = json.loads((ROOT / "shared" / "cuisines.json").read_text())


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Missing {name} in worker/.env (see .env.example)")
    return value


class Settings:
    @property
    def supabase_url(self) -> str:
        return _require("SUPABASE_URL")

    @property
    def supabase_service_key(self) -> str:
        return _require("SUPABASE_SERVICE_ROLE_KEY")

    @property
    def groq_api_key(self) -> str:
        return _require("GROQ_API_KEY")

    # ANTHROPIC_API_KEY is read by the SDK directly.

    claude_model = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")
    whisper_model = os.environ.get("WHISPER_MODEL", "whisper-large-v3-turbo")
    # Browser whose logged-in session yt-dlp borrows for Instagram ("" to disable).
    instagram_cookies_browser = os.environ.get("INSTAGRAM_COOKIES_BROWSER", "chrome")
    poll_seconds = int(os.environ.get("POLL_SECONDS", "10"))


settings = Settings()
