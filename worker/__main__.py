"""Recipe Book worker.

  python -m worker              # run forever, polling the queue
  python -m worker run-once     # drain the queue once, then exit
  python -m worker add <url>    # queue a link from the terminal
  python -m worker reextract <recipe-id>
"""

import logging
import sys
import time

from . import db
from .config import settings
from .pipeline import process
from .sources import detect_source

log = logging.getLogger("worker")


def drain() -> int:
    n = 0
    while job := db.claim_next_job():
        log.info("processing %s %s", job["kind"], job["url"])
        process(job)
        n += 1
    return n


def reset_stuck() -> None:
    """Jobs left 'processing' by a crash or sleep get re-queued on startup."""
    db.client().table("jobs").update({"status": "queued"}).eq("status", "processing").execute()


def main(argv: list[str]) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cmd = argv[0] if argv else "run"

    if cmd == "add" and len(argv) > 1:
        for url in argv[1:]:
            db.client().table("jobs").insert({"url": url, "source_type": detect_source(url)}).execute()
            print("queued", url)
        return
    if cmd == "reextract" and len(argv) > 1:
        recipe = db.get_recipe(argv[1])
        if not recipe:
            raise SystemExit(f"No recipe {argv[1]}")
        db.client().table("jobs").insert({
            "kind": "reextract", "url": recipe["source_url"],
            "source_type": recipe["source_type"], "recipe_id": recipe["id"],
        }).execute()
        drain()
        return
    if cmd == "run-once":
        reset_stuck()
        print(f"processed {drain()} job(s)")
        return
    if cmd != "run":
        print(__doc__)
        raise SystemExit(1)

    reset_stuck()
    log.info("worker started; polling every %ss", settings.poll_seconds)
    while True:
        try:
            drain()
        except Exception:
            log.exception("poll failed (network or Supabase down?); retrying")
        time.sleep(settings.poll_seconds)


if __name__ == "__main__":
    main(sys.argv[1:])
