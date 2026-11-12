"""Bot / session classification + dashboard aggregate tests.

Synthetic events modelled on the Nov 2-12 2026 export. Runs under pytest
(`pytest api/tests`) or standalone (`python3 api/tests/test_classification.py`)
— pytest is deliberately not a runtime requirement. The collector test needs
fastapi + httpx and is skipped without them.
"""

import itertools
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

from classify import bot_reason, build_sessions, is_impossible_ua  # noqa: E402
import dashboard  # noqa: E402

# --- UAs --------------------------------------------------------------------

CHROME_WIN = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
CHROME_MAC = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")
SAFARI_MAC_26 = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
                 "(KHTML, like Gecko) Version/26.1 Safari/605.1.15")
IOS_FAKE_12 = ("Mozilla/5.0 (iPhone; CPU iPhone OS 12_4 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1")
IOS_FAKE_17 = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1")
IOS_REAL_26 = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1")
IOS_REAL_17 = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
IPAD_REAL_16 = ("Mozilla/5.0 (iPad; CPU OS 16_7 like Mac OS X) AppleWebKit/605.1.15 "
                "(KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1")
IOS_CHROME = ("Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 "
              "(KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1")
FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
CHROMEBOOK = ("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36")
SAMSUNG = ("Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) "
           "SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36")
CUBOT = ("Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) "
         "Chrome/140.0.0.0 Mobile Safari/537.36")
EDGE = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0")
INSTAGRAM = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 "
             "(KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0.0 (iPhone15,2; iOS 18_5)")
GSA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 "
       "(KHTML, like Gecko) GSA/380.0.0 Mobile/15E148 Safari/604.1")

HUMAN_UAS = [CHROME_WIN, CHROME_MAC, SAFARI_MAC_26, IOS_REAL_26, IOS_REAL_17, IPAD_REAL_16,
             IOS_CHROME, FIREFOX, CHROMEBOOK, SAMSUNG, CUBOT, EDGE, INSTAGRAM, GSA]

BOT_UAS = {
    # missed by the old pattern (stored bot:false in the export)
    "Lightpanda/1.0": "ua:lightpanda",
    "RootEvidence/1.0": "ua:rootevidence",
    IOS_FAKE_12: "impossible_ua",
    IOS_FAKE_17: "impossible_ua",
    "SomeNewAgent/0.3": "non_browser_ua",
    "": "empty_ua",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0)": "ua:chatgpt",
    "Mozilla/5.0 (compatible; Perplexity-User/1.0)": "ua:perplexity",
    "Mozilla/5.0 (compatible; Claude-User/1.0)": "ua:claude-",
    "Mozilla/5.0 (compatible; meta-externalagent/1.1)": "ua:meta-external",
    "Mozilla/5.0 (compatible; GoogleOther)": "ua:googleother",
    "Mozilla/5.0 (X11; Linux x86_64) Chrome/120 Safari/537.36 Chrome-Lighthouse": "ua:lighthouse",
    "python-urllib3/2.2": "ua:python",
    # already caught before — must stay caught
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)": "ua:bot",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)": "ua:bot",
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)": "ua:spider",
    "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)": "ua:spider",
    "Mozilla/5.0 (compatible; ElevenlabsCrawler/1.0)": "ua:crawl",
    "Mozilla/5.0 (compatible; Reflectionbot/1.0)": "ua:bot",
    "meta-webindexer/1.1": "ua:indexer",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0.0.0 Safari/537.36": "ua:headless",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)": "ua:bot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)": "ua:bot",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0)": "ua:perplexity",
    "CCBot/2.0 (https://commoncrawl.org/faq/)": "ua:bot",
}


def test_human_uas_pass():
    for ua in HUMAN_UAS:
        assert bot_reason(ua) is None, ua


def test_bot_uas_caught():
    for ua, reason in BOT_UAS.items():
        assert bot_reason(ua) == reason, (ua, bot_reason(ua))


def test_impossible_ua_rule():
    assert is_impossible_ua(IOS_FAKE_12)
    assert is_impossible_ua(IOS_FAKE_17)
    assert not is_impossible_ua(IOS_REAL_26)    # iOS 26 freezes the OS token at 18_x
    assert not is_impossible_ua(IOS_REAL_17)
    assert not is_impossible_ua(SAFARI_MAC_26)  # macOS token frozen at 10_15_7, not checked


# --- synthetic export ---------------------------------------------------------

T0 = datetime.now(timezone.utc).replace(microsecond=0) - timedelta(hours=6)
_sid = itertools.count()
_vh = itertools.count()
GAME = "/es/juegos/verb-snake/"


def _iso(dt):
    return dt.isoformat()


def visit(start, *, ua=CHROME_WIN, path="/", referrer=None, lang="de-DE", country="DE",
          vh=None, viewport=1366, heartbeats=0, bot=False):
    """One page session: a page_view plus `heartbeats` heartbeats 15 s apart."""
    sid = f"s{next(_sid)}"
    vh = vh or f"v{next(_vh)}"
    base = {"ts_client": _iso(start), "path": path, "referrer": referrer,
            "viewport_width": viewport, "language": lang, "country": country,
            "device_type": "desktop", "bot": bot, "ua": ua,
            "session_page_id": sid, "visitor_hash": vh}
    evs = [dict(base, event_type="page_view", ts_server=_iso(start))]
    for k in range(1, heartbeats + 1):
        t = start + timedelta(seconds=15 * k)
        evs.append(dict(base, event_type="page_heartbeat", ts_server=_iso(t),
                        ts_client=_iso(t), elapsed_seconds=15 * k))
    return evs


def build_export():
    ev = []
    # 1. missed bots (stored bot:false at the time)
    ev += visit(T0, ua="Lightpanda/1.0", path="/de/unregelmaessige-verben/go/", lang="en-US", country="US")
    ev += visit(T0, ua="RootEvidence/1.0", path="/", lang=None, country="US")
    # an old-pattern bot that was stored bot:true
    ev += visit(T0, ua="Mozilla/5.0 (compatible; Googlebot/2.1)", path="/", bot=True, lang=None, country="US")
    # 2a. stealth scraper, impossible iOS UA (zh-CN, no referrer, no heartbeat)
    ev += visit(T0 + timedelta(minutes=1), ua=IOS_FAKE_12, path="/de/unregelmaessige-verben/be/",
                lang="zh-CN", country="CN")
    # 2b. stealth scraper, plausible desktop UAs: 6 sequential verb pages + one
    #     page hit 3x from "different visitors"
    for i, verb in enumerate(["begin", "bite", "blow", "break", "bring", "build"]):
        ev += visit(T0 + timedelta(minutes=8 * i), ua=[CHROME_WIN, CHROME_MAC][i % 2],
                    path=f"/de/unregelmaessige-verben/{verb}/", lang="zh-CN", country="US")
    for i in range(3):
        ev += visit(T0 + timedelta(minutes=50 + 7 * i), ua=CHROME_MAC,
                    path="/de/unregelmaessige-verben/buy/", lang="zh-CN", country="US")
    # 3. real humans
    ev += visit(T0 + timedelta(hours=1), path="/de/unregelmaessige-verben/go/",
                referrer="https://www.bing.com/", heartbeats=4)            # engaged
    ev += visit(T0 + timedelta(hours=1, minutes=5), ua=SAMSUNG, path="/es/",
                referrer="https://duckduckgo.com/", lang="es-ES", country="ES")  # bounce
    ev += visit(T0 + timedelta(hours=1, minutes=6), ua=FIREFOX, path="/de/",
                lang="de-DE")                                                # direct bounce
    # zh-CN humans the likely_bot rule must NOT swallow
    ev += visit(T0 + timedelta(hours=2), path="/de/", lang="zh-CN", country="DE",
                referrer="https://www.ecosia.org/")                         # has referrer -> bounce
    ev += visit(T0 + timedelta(hours=2, minutes=1), path="/de/spiele/", lang="zh-CN",
                country="DE", heartbeats=1)                                 # has heartbeat -> engaged
    vh_repeat = "zh-returning"
    ev += visit(T0 + timedelta(hours=2, minutes=2), path="/de/", lang="zh-CN", vh=vh_repeat)
    ev += visit(T0 + timedelta(hours=2, minutes=3), path="/de/a/", lang="zh-CN", vh=vh_repeat)
    # 4. Ceibal classroom burst: 11 pupils, 3 visitor hashes, each = LMS embed
    #    (viewport 978, bounce) + opened tab 4 s later (1366, long heartbeats).
    cls = T0 + timedelta(hours=3)
    for i in range(11):
        start = cls + timedelta(seconds=12 * i)
        common = dict(ua=CHROMEBOOK, path=GAME, referrer="https://ceibal.schoology.com/",
                      lang="es-UY", country="UY", vh=f"ceibal-{i % 3}")
        ev += visit(start, viewport=978, **common)
        ev += visit(start + timedelta(seconds=4), viewport=1366,
                    heartbeats=(735 - 30 * i) // 15, **common)
    # another platform, to exercise grouping
    ev += visit(T0 + timedelta(hours=4), path="/de/", referrer="https://classroom.google.com/",
                heartbeats=2)
    ev.sort(key=lambda e: e["ts_server"])
    return ev


def test_session_classes():
    sessions, keys = build_sessions(build_export())
    by = {}
    for s in sessions.values():
        by.setdefault(s["class"], []).append(s)
    reasons = sorted(s["reason"] for s in by["bot"])
    assert reasons == sorted(["ua:lightpanda", "ua:rootevidence", "ua:bot", "impossible_ua"]), reasons
    assert len(by["likely_bot"]) == 9
    assert all(s["language"] == "zh-CN" and not s["referrer"] for s in by["likely_bot"])
    # engaged: bing + zh heartbeat + 11 ceibal tabs + classroom.google
    assert len(by["engaged"]) == 14
    # bounce: ddg + direct de + zh w/ referrer + 2 zh returning + 11 ceibal embeds
    assert len(by["bounce"]) == 16
    bing = next(s for s in sessions.values() if s["referrer"] == "https://www.bing.com/")
    assert bing["class"] == "engaged" and bing["max_elapsed"] == 60


def test_dashboard_aggregate_default():
    data = dashboard.aggregate("all", False, "views", events=build_export())
    assert data["class_sessions"] == {"engaged": 14, "bounce": 16, "likely_bot": 9, "bot": 4}
    assert data["class_views"] == data["class_sessions"]      # one page_view per session here
    assert data["total_all"] == 43
    assert data["bot_count"] == 13
    assert data["counted"] == 30
    shown_paths = dict(data["paths"])
    assert not any("verben/b" in p for p in shown_paths), shown_paths   # scraper hidden
    assert shown_paths["/de/unregelmaessige-verben/go/"] == 1           # bing human kept, lightpanda gone
    assert shown_paths[GAME] == 22
    assert dict(data["sources"])["Search"] == 3                         # bing, ddg, ecosia
    assert dict(data["sources"])["School"] == 23                        # ceibal + classroom.google
    assert dict(data["hidden_reasons"])["zh_noref_single_hit"] == 9

    rows = {r["platform"]: r for r in data["school_rows"]}
    assert set(rows) == {"Ceibal (Uruguay)", "Google Classroom"}
    c = rows["Ceibal (Uruguay)"]
    assert c["sessions"] == 22
    assert c["engaged"] == 11
    assert c["visitors"] == 3
    assert c["max_engaged"] == 735
    assert c["median_engaged"] == 585          # durations 735..435 step 30 -> median 585
    assert c["peak_concurrent"] == 12          # 11 open tabs + the last pupil's embed
    assert c["top_paths"][0] == (GAME, 22)
    assert data["school_total"]["sessions"] == 23


def test_dashboard_aggregate_show_bots():
    data = dashboard.aggregate("all", True, "views", events=build_export())
    assert data["counted"] == data["total_all"] == 43
    assert data["class_sessions"]["likely_bot"] == 9       # counts don't depend on the toggle


def test_school_platform_matching():
    sp = dashboard.school_platform
    assert sp("https://ceibal.schoology.com/") == "Ceibal (Uruguay)"
    assert sp("https://app.schoology.com/") == "Schoology"
    assert sp("https://classroom.google.com/") == "Google Classroom"
    assert sp("https://moodle.gymnasium-x.de/") == "Moodle / Aula virtual"
    assert sp("https://school.instructure.com/") == "Canvas"
    assert sp("https://teams.microsoft.com/") == "Microsoft Teams"
    assert sp("https://www.itslearning.com/") == "itslearning"
    assert sp("https://lernplattform.mebis.bycs.de/") == "mebis (Bayern)"
    assert sp("https://webuntis.com/") == "WebUntis"
    assert sp("https://ies-ejemplo.edu.es/") == "Other school / .edu domain"
    assert sp("https://www.bing.com/") is None
    assert sp("https://www.google.com/") is None
    assert sp("https://www.canva.com/") is None
    assert sp("https://krabsy.com/de/") is None
    assert sp(None) is None


def test_render_dashboard_smoke():
    html = dashboard.render_dashboard("all", False, "uniques", events=build_export())
    assert "Traffic classification" in html and "School / classroom" in html
    assert "Ceibal (Uruguay)" in html
    html = dashboard.render_dashboard("7d", True, "views", country_filter="UY",
                                      events=build_export())
    assert "Ceibal (Uruguay)" in html
    assert dashboard.render_dashboard("today", False, events=[]).count("No visits from school") == 1


def test_collector_records_bot_reason():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        print("  (skipped: fastapi/httpx not installed)")
        return
    import json
    import main
    import storage
    main.lookup_country = lambda ip: "unknown"          # no network in tests
    storage.EVENTS_FILE.unlink(missing_ok=True)
    client = TestClient(main.app)
    body = json.dumps({"path": "/x", "timestamp": "2026-11-12T10:00:00Z", "language": "zh-CN"})
    for ua in ("Lightpanda/1.0", IOS_FAKE_12, CHROME_WIN):
        assert client.post("/api/track", content=body, headers={"user-agent": ua}).status_code == 200
    recs = list(storage.read_events())
    assert [(r["bot"], r["bot_reason"]) for r in recs] == [
        (True, "ua:lightpanda"), (True, "impossible_ua"), (False, None)]
    # schema unchanged apart from the added key
    assert set(recs[-1]) >= {"event_type", "ts_client", "ts_server", "path", "referrer",
                             "viewport_width", "language", "country", "device_type", "bot",
                             "ua", "session_page_id", "visitor_hash"}


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
