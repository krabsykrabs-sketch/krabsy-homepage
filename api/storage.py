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


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
#
# The log is append-only, so file order == arrival order (oldest first).
# Every reader that has to cap its output keeps the NEWEST events: a cap
# applied while streaming oldest-first would freeze the window on the first
# N lines of the file forever (the old /dashboard/raw bug).
#
# Readers work in binary with byte offsets so a multi-pass reader (the
# export: classify first, then stream) can pin a snapshot [start, end) and
# see exactly the same lines on every pass, even while new events are being
# appended. A partial last line (append in progress) fails to parse and is
# skipped consistently by every pass.

_BLOCK = 64 * 1024


def _parse(raw: bytes, since: Optional[str], until: Optional[str]) -> Optional[dict]:
    """Decode one JSONL line; None if blank/corrupt or outside [since, until].

    Filtering is by string comparison on ts_server (ts_client fallback),
    which works because ISO 8601 in UTC sorts lexicographically.
    """
    raw = raw.strip()
    if not raw:
        return None
    try:
        ev = json.loads(raw)
    except Exception:
        return None
    if not isinstance(ev, dict):
        return None
    ts = ev.get("ts_server") or ev.get("ts_client") or ""
    if since and ts < since:
        return None
    if until and ts > until:
        return None
    return ev


def file_size() -> int:
    """Current size of the log in bytes (0 if it doesn't exist yet)."""
    try:
        return EVENTS_FILE.stat().st_size
    except FileNotFoundError:
        return 0


def read_events(
    since: Optional[str] = None,
    until: Optional[str] = None,
    *,
    start: int = 0,
    end: Optional[int] = None,
) -> Iterator[dict]:
    """Stream ALL matching events oldest-first (no cap), optionally limited
    to the byte range [start, end) of the log. `start` must be a line start
    (0 or an offset returned by find_window)."""
    if not EVENTS_FILE.exists():
        return iter(())

    def _gen():
        stop = file_size() if end is None else end
        with open(EVENTS_FILE, "rb") as f:
            f.seek(start)
            pos = start
            while pos < stop:
                raw = f.readline(stop - pos)
                if not raw:
                    break
                pos += len(raw)
                ev = _parse(raw, since, until)
                if ev is not None:
                    yield ev

    return _gen()


def _reverse_lines(f, end: int) -> Iterator[tuple[int, bytes]]:
    """Yield (line_start_offset, line_bytes) from byte `end` back to 0."""
    pos = end
    head = b""   # bytes of a line that started before the current block
    while pos > 0:
        size = min(_BLOCK, pos)
        pos -= size
        f.seek(pos)
        lines = (f.read(size) + head).split(b"\n")
        head = lines[0]
        off = pos + len(head) + 1
        complete = []
        for line in lines[1:]:
            complete.append((off, line))
            off += len(line) + 1
        yield from reversed(complete)
    if head:
        yield 0, head


def read_newest(
    limit: int,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> tuple[list[dict], bool]:
    """Return (events, truncated): the newest `limit` matching events in
    chronological order, and whether older matching events were dropped.
    Reads the file backwards and stops as soon as the cap is proven hit."""
    end = file_size()
    if not end:
        return [], False
    out: list[dict] = []
    truncated = False
    with open(EVENTS_FILE, "rb") as f:
        for _, raw in _reverse_lines(f, end):
            ev = _parse(raw, since, until)
            if ev is None:
                continue
            if len(out) >= limit:
                truncated = True
                break
            out.append(ev)
    out.reverse()
    return out, truncated


def find_window(
    since: Optional[str] = None,
    until: Optional[str] = None,
    max_count: Optional[int] = None,
) -> tuple[int, int, bool]:
    """Pin a snapshot for multi-pass readers: (start, end, truncated).

    [start, end) contains the newest `max_count` matching events (all of
    them when uncapped or under the cap); `truncated` says older matching
    events exist before `start`. Pass start/end to read_events."""
    end = file_size()
    if max_count is None or not end:
        return 0, end, False
    count, start = 0, 0
    with open(EVENTS_FILE, "rb") as f:
        for off, raw in _reverse_lines(f, end):
            if _parse(raw, since, until) is None:
                continue
            if count >= max_count:
                return start, end, True
            count += 1
            start = off
    return 0, end, False
