"""Answer counts, game events, weekly summary and landing flow (2026-11-22).

Runs under pytest or standalone (`python3 api/tests/test_learning_games.py`).
The collector test needs fastapi + httpx and is skipped without them.
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

import dashboard  # noqa: E402

CHROME = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
NOW = datetime.now(timezone.utc)


def _ts(minutes_ago: float) -> str:
    return (NOW - timedelta(minutes=minutes_ago)).isoformat()


def pv(sid, path, minutes_ago, referrer=None, vh="v1"):
    return {"event_type": "page_view", "ts_server": _ts(minutes_ago), "path": path,
            "referrer": referrer, "session_page_id": sid, "visitor_hash": vh, "ua": CHROME,
            "bot": False, "country": "DE", "device_type": "desktop", "language": "de-DE"}


def hb(sid, path, minutes_ago, elapsed, answers=None, correct=None, source=None, vh="v1"):
    e = {"event_type": "page_heartbeat", "ts_server": _ts(minutes_ago), "path": path,
         "session_page_id": sid, "visitor_hash": vh, "ua": CHROME, "bot": False,
         "country": "DE", "device_type": "desktop", "elapsed_seconds": elapsed}
    if answers is not None:
        e.update(answers=answers, correct=correct, answer_source=source)
    return e


def ge(sid, minutes_ago, name, level=None, **data):
    e = {"event_type": "game_event", "ts_server": _ts(minutes_ago), "path": "/de/spiele/verb-towers/",
         "session_page_id": sid, "visitor_hash": "v1", "ua": CHROME, "bot": False,
         "country": "DE", "device_type": "desktop", "game": "verb-towers", "name": name,
         "data": data}
    if level is not None:
        e["level"] = level
    return e


TOWERS = "/de/spiele/verb-towers/"


def test_learning_rows_use_running_max():
    events = [
        pv("s1", TOWERS, 10), hb("s1", TOWERS, 9.5, 30, 4, 3, "verb-towers"),
        hb("s1", TOWERS, 9, 60, 10, 8, "verb-towers"),           # running totals: keep max
        pv("s2", "/de/unregelmaessige-verben/sprint/", 8, vh="v2"),
        hb("s2", "/de/unregelmaessige-verben/sprint/", 7, 90, 20, 15, "sprint", vh="v2"),
        pv("s3", "/de/", 6, vh="v3"), hb("s3", "/de/", 5, 30),     # no answers: ignored
    ]
    rows = {r["name"]: r for r in dashboard.aggregate("7d", False, events=events)["learning_rows"]}
    assert set(rows) == {"verb-towers", "sprint"}
    assert rows["verb-towers"]["answers"] == 10 and round(rows["verb-towers"]["correct_pct"]) == 80
    assert rows["sprint"]["per_minute"] == 20 / 1.5


def test_landing_flow_counts_next_pages():
    events = [
        pv("a", "/de/", 30), pv("b", TOWERS, 29, referrer="https://krabsy.com/de/"),
        pv("c", "/de/spiele/verb-kitchen/", 28, referrer="https://krabsy.com/de/"),
        pv("d", TOWERS, 27, referrer="https://krabsy.com/es/"),
        pv("e", TOWERS, 26, referrer="https://krabsy.com/de/spiele/"),     # not from landing
        pv("f", TOWERS, 25, referrer="https://www.google.com/"),           # external
    ]
    data = dashboard.aggregate("7d", False, events=events)
    assert dict(data["landing_next"]) == {TOWERS: 2, "/de/spiele/verb-kitchen/": 1}
    assert data["landing_next_total"] == 3


def test_weekly_summary_windows():
    day = 60 * 24
    events = [
        pv("w1", TOWERS, 1 * day), hb("w1", TOWERS, 1 * day - 1, 600, 30, 24, "verb-towers"),
        pv("w2", "/de/", 2 * day, referrer="https://ceibal.schoology.com/", vh="v2"),
        hb("w2", "/de/", 2 * day - 1, 45, vh="v2"),
        pv("p1", TOWERS, 9 * day, vh="v3"), hb("p1", TOWERS, 9 * day - 1, 300, vh="v3"),
        pv("old", TOWERS, 20 * day, vh="v4"),                                   # outside 14 days
    ]
    ws = dashboard.weekly_summary(events=events, now=NOW)
    cur, prev = ws["cur"], ws["prev"]
    assert cur["visitors"] == 2 and prev["visitors"] == 1
    assert cur["school"] == 1 and prev["school"] == 0
    assert cur["game_minutes"] == 10 and prev["game_minutes"] == 5
    assert cur["answers"] == 30 and round(cur["correct_pct"]) == 80
    assert ws["top_games"][0][0] == "verb-towers"


def test_game_stats_levels_and_left():
    events = [
        pv("g1", TOWERS, 60), hb("g1", TOWERS, 59, 30),
        ge("g1", 58, "level_start", 1),
        ge("g1", 57, "tower_built", 1, tower="cannon", cost=50, wave=1),
        ge("g1", 56, "tower_built", 1, tower="cannon", cost=50, wave=2),
        ge("g1", 55, "level_end", 1, result="won", seconds=300, answers=20, correct=16),
        ge("g1", 54, "level_start", 2),
        ge("g1", 53, "wave_end", 2, wave=4, lives=3),
        # no level_end for level 2 -> left at wave 4
        pv("g2", TOWERS, 40, vh="v2"), hb("g2", TOWERS, 39, 30, vh="v2"),
        ge("g2", 38, "level_start", 1),
        ge("g2", 37, "level_end", 1, result="lost", seconds=240, answers=10, correct=4),
    ]
    for e in events:
        if e["session_page_id"] == "g2":
            e["visitor_hash"] = "v2"
    games = dashboard.aggregate("7d", False, events=events)["games"]
    levels = {r["level"]: r for r in games["verb-towers"]["levels"]}
    assert (levels[1]["starts"], levels[1]["won"], levels[1]["lost"], levels[1]["left"]) == (2, 1, 1, 0)
    assert levels[1]["win_rate"] == 50 and levels[1]["answers_per_end"] == 15
    assert round(levels[1]["correct_pct"]) == 67
    assert (levels[2]["starts"], levels[2]["left"], levels[2]["left_median_wave"]) == (1, 1, 4)
    towers = [r for r in games["verb-towers"]["other"] if r["name"] == "tower_built"]
    assert towers == [{"name": "tower_built", "level": 1, "attrs": (("tower", "cannon"),),
                       "count": 2, "avgs": {"cost": 50.0, "wave": 1.5}}]


def test_render_dashboard_new_sections():
    events = [pv("g1", TOWERS, 60), hb("g1", TOWERS, 59, 30, 5, 4, "verb-towers"),
              ge("g1", 58, "level_start", 1)]
    html = dashboard.render_dashboard("7d", False, events=events)
    for needle in ("This week", "Top games", "Learning activity", "Games in detail",
                   "From the landing page", "verb-towers"):
        assert needle in html, needle
    empty = dashboard.render_dashboard("today", False, events=[])
    assert "No game events in this range yet" in empty


def test_collector_answers_and_game_events():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        print("  (skipped: fastapi/httpx not installed)")
        return
    import main
    import storage
    main.lookup_country = lambda ip: "unknown"
    storage.EVENTS_FILE.unlink(missing_ok=True)
    main._buckets.clear()
    client = TestClient(main.app)
    base = {"path": TOWERS, "timestamp": "2026-11-22T10:00:00Z", "session_page_id": "x1"}
    posts = [
        dict(base, event_type="page_heartbeat", elapsed_seconds=30, answers=7, correct=9,
             answer_source="verb-towers"),                                   # correct capped
        dict(base, event_type="page_heartbeat", elapsed_seconds=45, answers=3,
             answer_source="Not A Slug!"),                                   # source dropped
        dict(base, event_type="game_event", game="verb-towers", name="tower_built", level=3,
             data={"tower": "cannon", "cost": 50, "note": "free text is dropped",
                   "nested": {"a": 1}, "Bad Key": 1, "ok": True}),
        dict(base, event_type="game_event", game="Verb Towers", name="x"),   # bad slug: dropped
        dict(base, event_type="game_event", name="level_start"),             # no game: dropped
    ]
    for body in posts:
        assert client.post("/api/track", content=json.dumps(body),
                           headers={"user-agent": CHROME}).status_code == 200
    recs = list(storage.read_events())
    assert len(recs) == 3
    assert (recs[0]["answers"], recs[0]["correct"], recs[0]["answer_source"]) == (7, 7, "verb-towers")
    assert recs[1]["answers"] == 3 and "answer_source" not in recs[1]
    assert recs[2]["game"] == "verb-towers" and recs[2]["level"] == 3
    assert recs[2]["data"] == {"tower": "cannon", "cost": 50, "ok": True}


def test_rate_limit_fits_a_class():
    import importlib
    try:
        main = importlib.import_module("main")
    except Exception:
        print("  (skipped: fastapi not installed)")
        return
    # 30 pupils behind one school IP: 4 heartbeats/min each + game events.
    assert main.RATE_LIMIT >= 30 * 4 * 3


if __name__ == "__main__":
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"ok    {name}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"FAIL  {name}: {exc!r}")
    sys.exit(1 if failed else 0)
