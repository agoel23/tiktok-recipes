"""Narration → text with the Groq-hosted Whisper API."""

import shutil
import subprocess
from pathlib import Path

from groq import Groq

from .config import settings

MAX_BYTES = 24 * 1024 * 1024  # Groq free-tier upload limit is 25 MB


def _shrink(path: Path) -> Path:
    """Re-encode to small mono audio when the download is too big (needs ffmpeg)."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("Video is too large to transcribe and ffmpeg isn't installed (brew install ffmpeg).")
    out = path.with_suffix(".small.mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(out)],
        check=True,
    )
    return out


def transcribe(path: Path) -> str:
    if path.stat().st_size > MAX_BYTES:
        path = _shrink(path)
    client = Groq(api_key=settings.groq_api_key)
    with path.open("rb") as f:
        result = client.audio.transcriptions.create(
            file=(path.name, f.read()),
            model=settings.whisper_model,
            language="en",
            temperature=0,
        )
    return (result.text or "").strip()
