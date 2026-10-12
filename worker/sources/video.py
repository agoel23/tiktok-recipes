"""TikTok and Instagram via yt-dlp: caption + metadata + audio."""

from pathlib import Path

import yt_dlp

from ..config import settings
from . import Fetched, FetchError


def _ydl_opts(source_type: str, workdir: Path) -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        # Audio-only when offered; otherwise the smallest muxed file (audio is what we need).
        "format": "bestaudio/worst[acodec!=none]/worst",
        "outtmpl": str(workdir / "%(id)s.%(ext)s"),
        "socket_timeout": 30,
    }
    if source_type == "instagram" and settings.instagram_cookies_browser:
        opts["cookiesfrombrowser"] = (settings.instagram_cookies_browser,)
    return opts


def _friendly(err: Exception, source_type: str) -> str:
    msg = str(err)
    low = msg.lower()
    if "no video" in low:
        return "This post has no video (photo post). Paste the caption text below instead."
    if "login" in low or "cookies" in low or "rate" in low:
        return (f"{source_type.title()} asked for a login or rate-limited us. "
                "Make sure you're logged into Instagram in Chrome, or paste the caption text.")
    if "private" in low or "unavailable" in low or "removed" in low or "404" in low:
        return "The post is private, removed or unavailable. Paste the caption text if you have it."
    return f"Couldn't download from {source_type.title()}: {msg[:300]}"


def fetch_video(url: str, source_type: str, workdir: Path) -> Fetched:
    try:
        with yt_dlp.YoutubeDL(_ydl_opts(source_type, workdir)) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        raise FetchError(_friendly(e, source_type)) from e

    if info.get("_type") == "playlist":  # Instagram carousel: use the first video
        entries = [e for e in info.get("entries") or [] if e]
        if not entries:
            raise FetchError(_friendly(Exception("no video"), source_type))
        info = {**info, **entries[0]}

    files = [Path(d["filepath"]) for d in info.get("requested_downloads") or [] if d.get("filepath")]
    audio = files[0] if files and files[0].exists() else None

    # yt-dlp fields differ: TikTok uploader=handle/channel=display name; Instagram channel=handle.
    if source_type == "tiktok":
        handle, author = info.get("uploader"), info.get("channel") or info.get("uploader")
    else:
        handle, author = info.get("channel") or info.get("uploader_id"), info.get("uploader")
    source_name = f"@{handle.lstrip('@')}" if handle else source_type.title()
    caption = (info.get("description") or info.get("title") or "").strip()

    return Fetched(
        source_type=source_type,
        source_id=str(info["id"]),
        url=info.get("webpage_url") or url,
        title=info.get("title"),
        author=author,
        source_name=source_name,
        thumbnail_url=info.get("thumbnail"),
        text=caption,
        audio_path=audio,
        extra={"duration": info.get("duration")},
    )
