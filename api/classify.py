"""Traffic classification shared by the collector and the dashboard.

Two layers:

1. **UA rules** (`bot_reason`) — run at ingest (main.py stores the result as
   `bot` + `bot_reason`) AND again at read time (dashboard.py), so events
   stored before a rule existed are re-classified without rewriting the log.

2. **Session rules** (`build_sessions` / `classify_session`) — only possible
   at read time, because they need the whole picture (did a heartbeat ever
   arrive? did this visitor_hash ever come back?).

Session classes (exactly one per session_page_id):

  bot         UA matches a known bot/agent/library token, the UA is not a
              browser UA at all (no "Mozilla/"), the UA is empty, the UA is
              internally impossible (see `is_impossible_ua`), or the event
              was already stored with bot=true.
  likely_bot  Human-looking UA, but: page_view with NO heartbeat, AND no
              referrer, AND browser language zh*, AND the visitor_hash has
              exactly one page_view in the range. This is the fingerprint of
              the rotating-UA stealth scraper seen Nov 2026. Each condition
              alone is common among real visitors; all four together are not
              (Krabsy's audience is DE/ES learners of English).
  bounce      Human-looking, no heartbeat (left within ~15 s, or JS timers
              never ran).
  engaged     Human-looking, at least one heartbeat.

Note `likely_bot` can never swallow a session with a heartbeat or a
referrer, so real search/internal/classroom visitors are never hidden by it.
"""

from __future__ import annotations

import re
from typing import Iterable, Optional

# ---------------------------------------------------------------------------
# UA rules
# ---------------------------------------------------------------------------

# Substring matching, not word-bounded — \bbot\b would miss "Googlebot",
# "AdsBot", etc. since the preceding char is a word char. Every token here
# must be absent from mainstream browser / in-app-browser UAs (Chrome,
# Safari, Firefox, Edge "Edg/", Samsung, Opera "OPR", GSA, Instagram/FBAN
# in-app, CrOS Chromebooks …).
BOT_RE = re.compile(
    r"("
    # generic crawler words (covers Googlebot, Bingbot, GPTBot, ClaudeBot,
    # PerplexityBot, CCBot, Applebot, Amazonbot, Bytespider, YandexBot, …)
    r"bot|crawl|spider|slurp|indexer|headless|"
    # AI assistants / agent fetchers whose UA lacks the word "bot"
    r"chatgpt|openai|perplexity|claude-|anthropic|cohere-ai|meta-external|"
    r"googleother|google-|bytedance|diffbot|firecrawl|lightpanda|rootevidence|"
    # automation frameworks / audit tools
    r"puppeteer|playwright|phantomjs|selenium|webdriver|lighthouse|pagespeed|"
    r"gtmetrix|ptst/|"
    # HTTP libraries and CLI tools
    r"curl|wget|python|httpx|aiohttp|scrapy|java/|okhttp|go-http|axios|"
    r"libwww|lwp-|apache-httpclient|postman|httrack|nutch|heritrix|ia_archiver|"
    r"archive\.org|zgrab|masscan|nmap|censys|"
    # link-preview / social unfurlers
    r"facebookexternalhit|whatsapp|telegrambot|preview|embedly|iframely|"
    r"fetch|monitor"
    r")",
    re.I,
)

# Device/brand names that contain a bot token but are real phones.
_FALSE_POSITIVE_RE = re.compile(r"cubot", re.I)

# iPhone / iPad / iPod OS version, e.g. "CPU iPhone OS 12_4 like Mac OS X".
_IOS_RE = re.compile(r"\((?:iphone|ipad|ipod)[^)]*?\bos (\d+)[_.]", re.I)
_SAFARI_VERSION_RE = re.compile(r"\bversion/(\d+)", re.I)


def is_impossible_ua(user_agent: str) -> bool:
    """True for an iOS UA whose Safari "Version/" can't exist on that iOS.

    Mobile Safari's Version/ major tracks the iOS major (iOS 17 ->
    Version/17). From iOS 26 Apple froze the OS token at "18_x" while
    Version/ jumped to 26, so "iPhone OS 18_6 … Version/26.0" is a real
    device. Versions 19–25 were never shipped. So any Version/>=19 on an
    iOS major < 18 is fabricated (the scraper sends iOS 11–18 with
    Version/26.5). macOS UAs are frozen at 10_15_7 and are NOT checked.
    """
    if not user_agent:
        return False
    m_os = _IOS_RE.search(user_agent)
    m_ver = _SAFARI_VERSION_RE.search(user_agent)
    if not (m_os and m_ver):
        return False
    return int(m_os.group(1)) < 18 and int(m_ver.group(1)) >= 19


def bot_reason(user_agent: Optional[str]) -> Optional[str]:
    """Return why this UA is a bot ("ua:<token>", "impossible_ua",
    "non_browser_ua", "empty_ua"), or None for a human-looking UA."""
    ua = (user_agent or "").strip()
    if not ua:
        return "empty_ua"
    # "CUBOT" is an Android phone brand ("Android 10; CUBOT X30") — strip it
    # so the generic "bot" token doesn't flag real Cubot owners.
    m = BOT_RE.search(_FALSE_POSITIVE_RE.sub("", ua))
    if m:
        return "ua:" + m.group(1).lower()
    if is_impossible_ua(ua):
        return "impossible_ua"
    # Every mainstream browser UA starts with "Mozilla/5.0". The tracker is
    # JS-driven, so a non-Mozilla UA means a JS-capable agent announcing
    # itself under its own name (e.g. "SomeAgent/1.0").
    if "mozilla/" not in ua.lower():
        return "non_browser_ua"
    return None


def is_bot(user_agent: Optional[str]) -> bool:
    return bot_reason(user_agent) is not None


# ---------------------------------------------------------------------------
# Session rules (read time)
# ---------------------------------------------------------------------------

CLASS_BOT = "bot"
CLASS_LIKELY_BOT = "likely_bot"
CLASS_BOUNCE = "bounce"
CLASS_ENGAGED = "engaged"
CLASSES = (CLASS_ENGAGED, CLASS_BOUNCE, CLASS_LIKELY_BOT, CLASS_BOT)
HIDDEN_BY_DEFAULT = frozenset({CLASS_BOT, CLASS_LIKELY_BOT})

# Language prefixes for the stealth-scraper rule (matched on lowercase
# "zh", "zh-cn", "zh-tw" …).
LIKELY_BOT_LANG_PREFIXES = ("zh",)


def _ts(ev: dict) -> str:
    return ev.get("ts_server") or ev.get("ts_client") or ""


def build_sessions(events: Iterable[dict]) -> tuple[dict[str, dict], list[str]]:
    """Group events into sessions and classify each one.

    Returns (sessions, keys) where keys[i] is the session key of events[i].
    The key is the session_page_id, or a synthetic per-event key for legacy
    page_views without one (each such page_view is its own session).
    """
    sessions: dict[str, dict] = {}
    keys: list[str] = []
    visitor_views: dict[str, int] = {}

    for i, ev in enumerate(events):
        event_type = ev.get("event_type") or "page_view"
        sid = ev.get("session_page_id")
        if not sid:
            if event_type != "page_view":
                keys.append("")          # orphan heartbeat: unusable
                continue
            sid = f"_nosid:{i}"
        keys.append(sid)
        ts = _ts(ev)
        s = sessions.get(sid)
        if s is None:
            s = sessions[sid] = {
                "key": sid, "path": ev.get("path") or "/", "page_views": 0,
                "heartbeats": 0, "max_elapsed": None, "start": ts, "end": ts,
                "first_hb_elapsed": None, "referrer": None, "language": None,
                "ua": "", "visitor_hash": None, "stored_bot": False,
                "stored_reason": None,
            }
        if ts and (not s["start"] or ts < s["start"]):
            s["start"] = ts
        if ts and ts > s["end"]:
            s["end"] = ts
        if ev.get("bot"):
            s["stored_bot"] = True
            s["stored_reason"] = s["stored_reason"] or ev.get("bot_reason")
        if not s["ua"]:
            s["ua"] = ev.get("ua") or ""
        if event_type == "page_view":
            s["page_views"] += 1
            s["path"] = ev.get("path") or s["path"]
            s["referrer"] = ev.get("referrer") or s["referrer"]
            s["language"] = ev.get("language") or s["language"]
            s["ua"] = ev.get("ua") or s["ua"]
            vh = ev.get("visitor_hash")
            if vh:
                s["visitor_hash"] = vh
                visitor_views[vh] = visitor_views.get(vh, 0) + 1
        elif event_type == "page_heartbeat":
            elapsed = ev.get("elapsed_seconds")
            if not isinstance(elapsed, int) or elapsed < 0:
                continue
            s["heartbeats"] += 1
            if s["max_elapsed"] is None or elapsed > s["max_elapsed"]:
                s["max_elapsed"] = elapsed
            # heartbeat-only session (page_view outside the range): borrow
            # its context so it can still be classified / attributed.
            s["referrer"] = s["referrer"] or ev.get("referrer")
            s["language"] = s["language"] or ev.get("language")
            s["visitor_hash"] = s["visitor_hash"] or ev.get("visitor_hash")

    for s in sessions.values():
        s["visitor_page_views"] = visitor_views.get(s["visitor_hash"] or "", 0)
        s["class"], s["reason"] = classify_session(s)
    return sessions, keys


def classify_session(s: dict) -> tuple[str, Optional[str]]:
    """Return (class, reason) for one session dict from build_sessions."""
    reason = bot_reason(s.get("ua"))
    if reason:
        return CLASS_BOT, reason
    if s.get("stored_bot"):
        return CLASS_BOT, s.get("stored_reason") or "stored_flag"
    if s.get("heartbeats", 0) > 0:
        return CLASS_ENGAGED, None
    lang = (s.get("language") or "").lower()
    if (
        s.get("page_views", 0) > 0
        and not s.get("referrer")
        and lang.startswith(LIKELY_BOT_LANG_PREFIXES)
        and s.get("visitor_page_views", 0) == 1
    ):
        return CLASS_LIKELY_BOT, "zh_noref_single_hit"
    return CLASS_BOUNCE, None
