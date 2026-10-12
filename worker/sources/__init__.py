"""Source detection and the common shape every fetcher returns."""

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse


class FetchError(Exception):
    """A readable reason the link couldn't be fetched (shown in the app)."""


@dataclass
class Fetched:
    source_type: str                    # tiktok | instagram | web
    source_id: str
    url: str                            # canonical URL
    title: Optional[str] = None
    author: Optional[str] = None
    source_name: Optional[str] = None   # "@creator" or site name
    thumbnail_url: Optional[str] = None
    text: str = ""                      # caption / page text / structured data
    audio_path: Optional[Path] = None   # video sources only
    extra: dict = field(default_factory=dict)


def detect_source(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if re.search(r"(^|\.)tiktok\.com$", host):
        return "tiktok"
    if re.search(r"(^|\.)(instagram\.com|instagr\.am)$", host):
        return "instagram"
    return "web"


def fetch(url: str, source_type: str, workdir: Path) -> Fetched:
    if source_type in ("tiktok", "instagram"):
        from .video import fetch_video
        return fetch_video(url, source_type, workdir)
    from .web import fetch_web
    return fetch_web(url)
