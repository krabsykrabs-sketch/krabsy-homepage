"""Reader / raw endpoint / "Download data" export tests.

A synthetic events.jsonl with >10,000 lines over 10 days (the size at which
the old oldest-first cap froze /dashboard/raw). Runs under pytest or
standalone (`python3 api/tests/test_export.py`); endpoint tests need
fastapi + httpx and are skipped without them.
"""

import csv
import io
import json
import os
import re
import sys
import tempfile
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

import dashboard  # noqa: E402
import export  # noqa: E402
import storage  # noqa: E402
from classify import CLASSES  # noqa: E402

CHROME_WIN = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
CHROME_MAC = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")
SAMSUNG = ("Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) "
           "SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36")
CHROMEBOOK = ("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

# kind -> (ua, country, device, lang, referrer, heartbeats, stored bot flag).
# The expected class is the kind itself; it is also encoded in the path.
KINDS = {
    "engaged": (CHROME_WIN, "DE", "desktop", "de-DE", "https://www.bing.com/", 3, False),
    "bounce": (SAMSUNG, "ES", "mobile", "es-ES", None, 0, False),
    "bot": (GOOGLEBOT, "US", "desktop", None, None, 0, True),
    "likely_bot": (CHROME_MAC, "US", "desktop", "zh-CN", None, 0, False),
    "school": (CHROMEBOOK, "UY", "tablet", "es-UY", "https://ceibal.schoology.com/", 2, False),
}
EXPECTED_CLASS = {"engaged": "engaged", "bounce": "bounce", "bot": "bot",
                  "likely_bot": "likely_bot", "school": "engaged"}

NOW = datetime.now(timezone.utc).replace(microsecond=0)
DAYS = 10
SPACING_S = 140          # one session start every 140 s (heartbeats +15/30/45 s)
BOUNDARY_SLACK = timedelta(hours=1)   # keep events away from the 1d/7d cutoffs


def _build_lines():
    events = []
    kinds = list(KINDS)
    k = 0
    offset = timedelta(seconds=60)
    while offset < timedelta(days=DAYS):
        near_cutoff = any(abs(offset - timedelta(days=d)) < BOUNDARY_SLACK for d in (1, 7))
        if not near_cutoff:
            kind = kinds[k % len(kinds)]
            ua, country, device, lang, ref, hbs, bot = KINDS[kind]
            start = NOW - offset
            base = {"ts_client": start.isoformat(), "path": f"/t/{kind}/", "referrer": ref,
                    "viewport_width": 1366, "language": lang, "country": country,
                    "device_type": device, "bot": bot, "bot_reason": "ua:bot" if bot else None,
                    "ua": ua, "session_page_id": f"s{k}", "visitor_hash": f"v{k}"}
            events.append(dict(base, event_type="page_view", ts_server=start.isoformat()))
            for j in range(1, hbs + 1):
                t = start + timedelta(seconds=15 * j)
                events.append(dict(base, event_type="page_heartbeat", ts_server=t.isoformat(),
                                   ts_client=t.isoformat(), elapsed_seconds=15 * j))
            k += 1
        offset += timedelta(seconds=SPACING_S)
    events.sort(key=lambda e: e["ts_server"])
    return events


EVENTS = _build_lines()
NEWEST = EVENTS[-1]
_FILE = Path(tempfile.mkdtemp(prefix="krabsy-export-test-")) / "events.jsonl"
with open(_FILE, "w", encoding="utf-8") as _f:
    for _i, _ev in enumerate(EVENTS):
        _f.write(json.dumps(_ev) + "\n")
        if _i == 5000:                       # junk the readers must skip
            _f.write("\n{not json\n")


def _within(days):
    cutoff = NOW - timedelta(days=days)
    return [e for e in EVENTS if datetime.fromisoformat(e["ts_server"]) >= cutoff]


@contextmanager
def synthetic_log():
    old = storage.EVENTS_FILE
    storage.EVENTS_FILE = _FILE
    try:
        yield
    finally:
        storage.EVENTS_FILE = old


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None, None
    import main
    return TestClient(main.app), (main.DASHBOARD_USERNAME, main.DASHBOARD_PASSWORD)


def _skip():
    print("  (skipped: fastapi/httpx not installed)")


# --- storage ------------------------------------------------------------------

def test_synthetic_file_is_big():
    assert sum(1 for _ in open(_FILE)) > 10_000
    assert len({e["ts_server"] for e in EVENTS}) == len(EVENTS)      # ts = identity


def test_read_events_uncapped_and_ordered():
    with synthetic_log():
        got = list(storage.read_events())
    assert got == EVENTS


def test_read_newest_is_the_tail():
    with synthetic_log():
        got, truncated = storage.read_newest(1000)
        assert truncated and got == EVENTS[-1000:]
        since = (NOW - timedelta(days=1)).isoformat()
        got, truncated = storage.read_newest(100_000, since=since)
        assert not truncated and got == _within(1)


def test_reverse_reader_block_boundaries():
    old = storage._BLOCK
    try:
        for block in (1, 7, 300, 4096):
            storage._BLOCK = block
            with synthetic_log():
                got, _ = storage.read_newest(250)
            assert got == EVENTS[-250:], block
    finally:
        storage._BLOCK = old


def test_find_window_keeps_newest():
    with synthetic_log():
        start, end, truncated = storage.find_window(max_count=300)
        assert truncated and end == _FILE.stat().st_size
        assert list(storage.read_events(start=start, end=end)) == EVENTS[-300:]
        start, end, truncated = storage.find_window(max_count=10**9)
        assert (start, truncated) == (0, False)


def test_dashboard_cap_applies_from_newest_end():
    old = dashboard.MAX_EVENTS
    dashboard.MAX_EVENTS = 500
    try:
        with synthetic_log():
            data = dashboard.aggregate("all", True, "views")
            html = dashboard.render_dashboard("all", True, "views")
    finally:
        dashboard.MAX_EVENTS = old
    assert data["truncated"] and data["events_loaded"] == 500
    assert data["timeseries"][-1][0] == NEWEST["ts_server"][:10]     # newest day present
    assert 'class="warn"' in html and "Only the newest 500 events" in html
    with synthetic_log():
        assert not dashboard.aggregate("30d", True, "views")["truncated"]


# --- endpoints ------------------------------------------------------------------

def test_auth_required():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        for url in ("/dashboard/", "/dashboard/raw", "/dashboard/export?range=7d&format=csv"):
            assert client.get(url).status_code == 401, url
            assert client.get(url, auth=(auth[0], "wrong")).status_code == 401, url
            assert client.get(url, auth=auth).status_code == 200, url


def test_raw_returns_newest():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        got = client.get("/dashboard/raw", auth=auth).json()
        assert got == EVENTS[-1000:]                 # newest 1000, chronological
        assert got[-1]["ts_server"] == NEWEST["ts_server"]
        assert client.get("/dashboard/raw?limit=5", auth=auth).json() == EVENTS[-5:]
        got = client.get("/dashboard/raw?range=today&limit=10000", auth=auth).json()
        assert got == _within(1)
        assert client.get("/dashboard/raw?limit=10001", auth=auth).status_code == 422


def _export(client, auth, query):
    r = client.get("/dashboard/export?" + query, auth=auth)
    assert r.status_code == 200, r.text[:300]
    return r


def test_export_json_7d():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        r = _export(client, auth, "range=7d&format=json")
    assert r.headers["content-type"].startswith("application/json")
    since = (NOW - timedelta(days=7)).date().isoformat()
    today = datetime.now(timezone.utc).date().isoformat()
    assert r.headers["content-disposition"] == \
        f'attachment; filename="krabsy-analytics_{since}_{today}.json"'
    assert "x-krabsy-truncated" not in r.headers
    rows = r.json()
    expected = _within(7)
    assert [x["ts_server"] for x in rows] == [e["ts_server"] for e in expected]
    assert rows[-1]["ts_server"] == NEWEST["ts_server"]
    for row in rows:
        kind = row["path"].split("/")[2]
        assert row["class"] == EXPECTED_CLASS[kind], row
        assert row["class"] in CLASSES
        assert "bot_reason" in row
    reasons = {row["class"]: row["bot_reason"] for row in rows}
    assert reasons == {"engaged": None, "bounce": None, "bot": "ua:bot",
                       "likely_bot": "zh_noref_single_hit"}
    # stored fields survive untouched
    for x, e in zip(rows, expected):
        assert all(x[k] == v for k, v in e.items() if k != "bot_reason"), x


def test_export_classes_match_dashboard():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        rows = _export(client, auth, "range=30d").json()
        data = dashboard.aggregate("30d", True, "views")
    views = Counter(x["class"] for x in rows if x["event_type"] == "page_view")
    assert views == Counter({c: n for c, n in data["class_views"].items() if n})
    assert len(rows) == len(EVENTS)                                  # 10 days < 30d


def test_export_csv():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        r = _export(client, auth, "range=7d&format=csv")
    assert r.headers["content-type"].startswith("text/csv")
    assert r.headers["content-disposition"].endswith('.csv"')
    assert r.content.startswith(b"\xef\xbb\xbf")                     # UTF-8 BOM
    reader = csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"), newline=""))
    assert tuple(reader.fieldnames) == export.CSV_COLUMNS
    rows = list(reader)
    expected = _within(7)
    assert [x["ts_server"] for x in rows] == [e["ts_server"] for e in expected]
    assert {x["class"] for x in rows} == set(CLASSES)
    bots = [x for x in rows if x["class"] == "bot"]
    assert bots and all(x["bot_reason"] == "ua:bot" and x["bot"] == "true" for x in bots)
    assert all(x["bot_reason"] == "" for x in rows if x["class"] == "engaged")
    hb = [x for x in rows if x["event_type"] == "page_heartbeat"]
    assert hb and all(x["elapsed_seconds"] in ("15", "30", "45") for x in hb)


def test_export_filters_and_bots_toggle():
    client, auth = _client()
    if not client:
        return _skip()
    expected = _within(7)
    with synthetic_log():
        rows = _export(client, auth, "range=7d&country=uy").json()     # case-insensitive
        assert rows and {x["country"] for x in rows} == {"UY"}
        assert len(rows) == sum(e["country"] == "UY" for e in expected)
        r = _export(client, auth, "range=7d&device=mobile&format=csv")
        assert "_mobile" in r.headers["content-disposition"]
        rows = list(csv.DictReader(io.StringIO(r.content.decode("utf-8-sig"))))
        assert rows and {x["device_type"] for x in rows} == {"mobile"}
        # the dashboard form sends bots=0 then (if ticked) bots=1: last wins
        r = _export(client, auth, "range=7d&bots=0")
        rows = r.json()
        assert "nobots" in r.headers["content-disposition"]
        assert {x["class"] for x in rows} == {"engaged", "bounce"}
        assert len(rows) == sum(EXPECTED_CLASS[e["path"].split("/")[2]] in ("engaged", "bounce")
                                for e in expected)
        rows = _export(client, auth, "range=7d&bots=0&bots=1").json()
        assert len(rows) == len(expected)
        # "all" works and is complete
        rows = _export(client, auth, "range=all").json()
        assert len(rows) == len(EVENTS)


def test_export_truncation_keeps_newest_and_says_so():
    client, auth = _client()
    if not client:
        return _skip()
    old = export.MAX_EVENTS
    export.MAX_EVENTS = 400
    try:
        with synthetic_log():
            r = _export(client, auth, "range=all")
    finally:
        export.MAX_EVENTS = old
    assert r.headers["x-krabsy-truncated"] == "1"
    assert "TRUNCATED-newest-400" in r.headers["content-disposition"]
    assert [x["ts_server"] for x in r.json()] == [e["ts_server"] for e in EVENTS[-400:]]


def test_dashboard_has_download_buttons():
    client, auth = _client()
    if not client:
        return _skip()
    with synthetic_log():
        html = client.get("/dashboard/?range=30d&country=uy&device=tablet", auth=auth).text
    m = re.search(r'<form method="get" action="/dashboard/export">(.*?)</form>', html, re.S)
    assert m, "download form missing"
    form = m.group(1)
    for snippet in ('name="range" value="30d"', 'name="country" value="UY"',
                    'name="device" value="tablet"', 'name="bots" value="0"',
                    'name="format" value="json"', 'name="format" value="csv"',
                    'name="bots" value="1" checked', "Download JSON", "Download CSV"):
        assert snippet in form, snippet
    assert form.index('name="bots" value="0"') < form.index('name="bots" value="1"')
    assert "/dashboard/raw" not in html


def test_dockerfile_copies_every_module():
    copy = next(line for line in (API_DIR / "Dockerfile").read_text().splitlines()
                if line.startswith("COPY main.py"))
    for mod in API_DIR.glob("*.py"):
        assert mod.name in copy.split(), mod.name


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
