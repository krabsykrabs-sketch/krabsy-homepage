"""Data export behind the dashboard's "Download data" buttons.

GET /dashboard/export streams every event of a dashboard range as one JSON
array or a flat CSV, each event tagged with its session class
(engaged | bounce | likely_bot | bot) and bot_reason, computed with the same
rules as the dashboard (classify.build_sessions over the whole range, before
the country/device filters, so an event's class never depends on a filter).

Two passes over a pinned byte window of the log (storage.find_window):
pass 1 classifies the sessions, pass 2 streams the tagged events. Memory is
bounded by the session table, never by the output size.
"""

import csv
import io
import json
import re
from datetime import datetime, timezone
from typing import Iterable, Iterator, NamedTuple, Optional

from classify import HIDDEN_BY_DEFAULT, bot_reason, build_sessions
from dashboard import event_passes_filters, normalize_range, since_iso, until_iso
from storage import find_window, read_events

# Newest events kept per export (same as the dashboard). ~600 bytes each as
# JSON, so the cap is ~120 MB; at 2026 traffic (100-300 events/day) even
# "all" is far below it. When it bites, the filename says TRUNCATED.
MAX_EVENTS = 200_000

FORMATS = ("json", "csv")

# Flat CSV layout. Anything else in an event is JSON-only.
CSV_COLUMNS = (
    "ts_server", "event_type", "class", "bot_reason", "path", "referrer",
    "language", "country", "device_type", "viewport_width", "elapsed_seconds",
    "answers", "correct", "answer_source", "game", "name", "level",
    "session_page_id", "visitor_hash", "ts_client", "bot", "ua",
)

_BATCH = 500   # rows per streamed chunk


class Export(NamedTuple):
    filename: str
    media_type: str
    body: Iterator[bytes]
    truncated: bool


def _tagged_events(since, start, end, include_bots, country_filter, device_filter, until=None) -> Iterator[dict]:
    sessions, keys = build_sessions(read_events(since, until, start=start, end=end))

    def gen():
        # Same byte window + same filter => exactly the sequence `keys` was
        # built from, so zip lines them up.
        for ev, key in zip(read_events(since, until, start=start, end=end), keys):
            if not event_passes_filters(ev, country_filter, device_filter):
                continue
            if key:
                cls, reason = sessions[key]["class"], sessions[key]["reason"]
            else:   # heartbeat without session_page_id: unclassifiable
                cls, reason = None, bot_reason(ev.get("ua"))
            if not include_bots and (cls in HIDDEN_BY_DEFAULT or (cls is None and reason)):
                continue
            row = {
                "ts_server": ev.get("ts_server"),
                "event_type": ev.get("event_type") or "page_view",
                "class": cls,
                "bot_reason": reason,
            }
            for k, v in ev.items():
                row.setdefault(k, v)
            yield row

    first = min((s["start"] for s in sessions.values() if s["start"]), default=None)
    return gen(), first


def _json_body(rows: Iterable[dict]) -> Iterator[bytes]:
    chunk = ["["]
    sep = "\n"
    for i, row in enumerate(rows, 1):
        chunk.append(sep + json.dumps(row, ensure_ascii=False, separators=(",", ":")))
        sep = ",\n"
        if i % _BATCH == 0:
            yield "".join(chunk).encode("utf-8")
            chunk = []
    chunk.append("\n]\n")
    yield "".join(chunk).encode("utf-8")


def _cell(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    return "" if v is None else v


def _csv_body(rows: Iterable[dict]) -> Iterator[bytes]:
    buf = io.StringIO()
    w = csv.writer(buf)       # comma-separated, CRLF line ends, minimal quoting
    buf.write("﻿")       # UTF-8 BOM so Excel detects the encoding
    w.writerow(CSV_COLUMNS)
    for i, row in enumerate(rows, 1):
        w.writerow([_cell(row.get(c)) for c in CSV_COLUMNS])
        if i % _BATCH == 0:
            yield buf.getvalue().encode("utf-8")
            buf.seek(0)
            buf.truncate()
    yield buf.getvalue().encode("utf-8")


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9-]", "", s)[:16]


def prepare_export(
    range_key: str,
    fmt: str = "json",
    include_bots: bool = True,
    country_filter: Optional[str] = None,
    device_filter: Optional[str] = None,
) -> Export:
    """Classify the range now (pass 1) and return a lazy body (pass 2).
    Filters are expected normalized (dashboard.normalize_filters)."""
    range_key = normalize_range(range_key)
    fmt = fmt if fmt in FORMATS else "json"
    since = since_iso(range_key)
    until = until_iso(range_key)
    start, end, truncated = find_window(since=since, until=until, max_count=MAX_EVENTS)
    rows, first = _tagged_events(since, start, end, include_bots, country_filter, device_filter, until)

    today = datetime.now(timezone.utc).date().isoformat()
    if since and not truncated:
        date_from = since[:10]
    else:
        date_from = (first or today)[:10]
    date_to = until[:10] if until else today
    parts = ["krabsy-analytics", date_from, date_to]
    if country_filter:
        parts.append(_slug(country_filter))
    if device_filter:
        parts.append(_slug(device_filter))
    if not include_bots:
        parts.append("nobots")
    if truncated:
        parts.append(f"TRUNCATED-newest-{MAX_EVENTS}")
    filename = "_".join(p for p in parts if p) + "." + fmt

    if fmt == "csv":
        return Export(filename, "text/csv; charset=utf-8", _csv_body(rows), truncated)
    return Export(filename, "application/json; charset=utf-8", _json_body(rows), truncated)
