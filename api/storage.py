"""Append-only JSONL storage for analytics events.

One JSON object per line, written under an advisory exclusive lock so
concurrent uvicorn workers don't interleave bytes. /data is a Coolify
mounted volume; the directory survives container redeploys.
"""

import fcntl
import json
import os
from pathlib import Path
from typing import Iterator, Optional

DATA_DIR = Path(os.environ.get("KRABSY_DATA_DIR", "/data"))
EVENTS_FILE = DATA_DIR / "events.jsonl"


def append_event(event: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    line = json.dumps(event, separators=(",", ":"), ensure_ascii=False) + "\n"
    with open(EVENTS_FILE, "a", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.write(line)
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)


def read_events(
    since: Optional[str] = None,
    until: Optional[str] = None,
    max_count: int = 100_000,
) -> Iterator[dict]:
    """Stream events from the JSONL file, optionally filtered by ISO timestamp range.

    Filtering is done by string comparison on ts_server, which works because
    ISO 8601 in UTC sorts lexicographically.
    """
    if not EVENTS_FILE.exists():
        return iter(())

    def _gen():
        count = 0
        with open(EVENTS_FILE, "r", encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    ev = json.loads(raw)
                except Exception:
                    continue
                ts = ev.get("ts_server") or ev.get("ts_client") or ""
                if since and ts < since:
                    continue
                if until and ts > until:
                    continue
                yield ev
                count += 1
                if count >= max_count:
                    break

    return _gen()
