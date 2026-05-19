"""Krabsy first-party analytics backend.

Endpoints:
  POST /api/track       - accept one analytics event from the page tracker
  GET  /dashboard/      - basic-auth HTML dashboard
  GET  /dashboard/raw   - basic-auth JSON dump of the last 1000 events
  GET  /healthz         - liveness probe

The client IP is used only to derive a country code (via the MaxMind
GeoLite2-Country DB) and to bucket the in-memory rate limiter. It is
never written to disk.
"""

import asyncio
import json
import os
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field, ValidationError

from storage import append_event, read_events
from dashboard import render_dashboard

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DASHBOARD_USERNAME = os.environ.get("DASHBOARD_USERNAME", "jan")
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "changeme")
GEOIP_DB_PATH = os.environ.get("GEOIP_DB_PATH", "/data/GeoLite2-Country.mmdb")

if DASHBOARD_PASSWORD == "changeme":
    print("[krabsy] WARNING: DASHBOARD_PASSWORD is the default value")

# ---------------------------------------------------------------------------
# GeoIP (optional — missing DB is logged, not fatal)
# ---------------------------------------------------------------------------

_geoip_reader = None
try:
    import geoip2.database  # type: ignore

    if Path(GEOIP_DB_PATH).exists():
        _geoip_reader = geoip2.database.Reader(GEOIP_DB_PATH)
        print(f"[krabsy] GeoIP DB loaded from {GEOIP_DB_PATH}")
    else:
        print(f"[krabsy] GeoIP DB not found at {GEOIP_DB_PATH}; country=unknown for all events")
except Exception as exc:
    print(f"[krabsy] GeoIP init failed: {exc}")


# ---------------------------------------------------------------------------
# Country lookup: ip-api.com (primary) + MaxMind (fallback) + in-memory cache
# ---------------------------------------------------------------------------
#
# Flow per IP:
#   1. Cache hit within 24h  -> return cached country code
#   2. Try ip-api.com  (free HTTP endpoint, 45/min cap from their side)
#   3. Try MaxMind GeoLite2 (local DB, no rate)
#   4. "unknown"
#
# We never cache "unknown" — a transient ip-api outage would otherwise
# poison the cache for a full day.

IPAPI_URL = "http://ip-api.com/json/{ip}?fields=status,countryCode"
IPAPI_TIMEOUT_S = 1.0
IPAPI_MAX_CALLS_PER_MIN = 40            # below ip-api's 45/min hard cap
IPAPI_WINDOW_S = 60.0
COUNTRY_CACHE_TTL_S = 24 * 60 * 60
COUNTRY_CACHE_MAX = 10_000
COUNTRY_CACHE_DROP = 100

_country_cache: dict[str, tuple[str, float]] = {}
_ipapi_calls: deque[float] = deque()
_ipapi_paused_until: float = 0.0
_country_lock = threading.Lock()


def _ipapi_can_call(now_mono: float) -> bool:
    """Return True if we're allowed to hit ip-api right now.

    Maintains a sliding-window counter under _country_lock. When the
    counter trips, we mark the service "paused" for 60 seconds so we
    don't keep checking the window on every event during a burst.
    """
    global _ipapi_paused_until
    if now_mono < _ipapi_paused_until:
        return False
    while _ipapi_calls and now_mono - _ipapi_calls[0] > IPAPI_WINDOW_S:
        _ipapi_calls.popleft()
    if len(_ipapi_calls) >= IPAPI_MAX_CALLS_PER_MIN:
        _ipapi_paused_until = now_mono + IPAPI_WINDOW_S
        return False
    _ipapi_calls.append(now_mono)
    return True


def _ipapi_lookup(ip: str) -> Optional[str]:
    """Single network call to ip-api. Returns 2-letter country code or None.

    All exceptions (timeout, DNS failure, malformed JSON, non-success
    status, rate-limit response) collapse to None so the caller can fall
    through to MaxMind.
    """
    url = IPAPI_URL.format(ip=ip)
    req = urllib.request.Request(url, headers={"User-Agent": "krabsy-analytics/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=IPAPI_TIMEOUT_S) as resp:
            raw = resp.read()
        data = json.loads(raw)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
    except Exception:
        # Catch-all so a misbehaving DNS/socket layer never bubbles up
        # and 500s an analytics request.
        return None
    if data.get("status") != "success":
        return None
    code = data.get("countryCode")
    return code if isinstance(code, str) and len(code) == 2 else None


def _maxmind_lookup(ip: str) -> Optional[str]:
    if not _geoip_reader:
        return None
    try:
        rec = _geoip_reader.country(ip)
    except Exception:
        return None
    return rec.country.iso_code or None


def _cache_evict_if_full() -> None:
    """Drop the 100 oldest entries (by timestamp) when at capacity.

    Caller holds _country_lock.
    """
    if len(_country_cache) < COUNTRY_CACHE_MAX:
        return
    # sort once, drop a batch, amortise the O(n log n) cost across many
    # subsequent insertions.
    victims = sorted(_country_cache.items(), key=lambda kv: kv[1][1])[:COUNTRY_CACHE_DROP]
    for ip, _ in victims:
        _country_cache.pop(ip, None)


def lookup_country(ip: str) -> str:
    """Resolve `ip` to a 2-letter country code, or 'unknown'.

    Synchronous; safe to call from a thread (we hold a Lock for the
    cache + rate-guard mutations). Callers that are inside an async
    handler should invoke this via asyncio.to_thread so the urllib call
    does not block the event loop.
    """
    if not ip:
        return "unknown"

    now_wall = time.time()
    now_mono = time.monotonic()

    with _country_lock:
        cached = _country_cache.get(ip)
        if cached and now_wall - cached[1] < COUNTRY_CACHE_TTL_S:
            return cached[0]
        allow_ipapi = _ipapi_can_call(now_mono)

    country: Optional[str] = None
    if allow_ipapi:
        country = _ipapi_lookup(ip)
    if not country:
        country = _maxmind_lookup(ip)
    if not country:
        return "unknown"

    with _country_lock:
        _cache_evict_if_full()
        _country_cache[ip] = (country, now_wall)
    return country


async def country_for_ip(ip: str) -> str:
    """Async wrapper: runs the (possibly blocking) lookup on a thread."""
    return await asyncio.to_thread(lookup_country, ip)


# ---------------------------------------------------------------------------
# Rate limit (in-memory, per-IP, sliding window)
# ---------------------------------------------------------------------------

RATE_LIMIT = 60          # events per IP
RATE_WINDOW = 60.0       # seconds
_buckets: dict[str, deque] = defaultdict(deque)


def rate_limited(ip: str) -> bool:
    if not ip:
        return False
    now = time.monotonic()
    bucket = _buckets[ip]
    while bucket and now - bucket[0] > RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT:
        return True
    bucket.append(now)
    return False


# ---------------------------------------------------------------------------
# Bot / device classification
# ---------------------------------------------------------------------------

# Substring matching, not word-bounded — \bbot\b would miss "Googlebot",
# "AdsBot", etc. since the preceding char is a word char.
BOT_RE = re.compile(
    r"(bot|crawler|spider|headless|curl|wget|python-requests|httpx|scrapy|"
    r"facebookexternalhit|slackbot|twitterbot|whatsapp|telegrambot|preview|fetch|monitor)",
    re.I,
)


def is_bot(user_agent: str) -> bool:
    return bool(user_agent) and bool(BOT_RE.search(user_agent))


def device_type_for(viewport_width: Optional[int], user_agent: str = "") -> str:
    """Classify the device by User-Agent first, viewport width second.

    Viewport-only classification mis-tags landscape tablets as desktop
    (their viewport often hits 1024+). UA tokens are checked in priority
    order — "iPad" and "Tablet" are sharp signals; Android Chrome
    specifically uses *absence* of the "Mobile" token to mark tablets
    (Chrome's deliberate convention: phones include "Mobile", tablets
    omit it); "Mobile" otherwise indicates a phone.

    Known gap: iPadOS 13+ ships a desktop UA by default in Safari and
    Chrome, so iPads in that mode look like desktops here. There is no
    reliable headers-based fix for that without false positives.
    """
    ua = (user_agent or "").lower()
    if "ipad" in ua:
        return "tablet"
    if "tablet" in ua:
        return "tablet"
    if "android" in ua and "mobile" not in ua:
        # Chrome on Android: "Mobile" token present on phones, absent on
        # tablets. This rule must run before the next one so Android
        # tablets aren't caught by an accidental "mobile" elsewhere.
        return "tablet"
    if "mobile" in ua:
        # "tablet" / Android-tablet already handled above, so the spec's
        # "AND NOT tablet" guard is implicit by ordering.
        return "mobile"
    if viewport_width is None:
        return "unknown"
    if viewport_width < 640:
        return "mobile"
    if viewport_width < 1024:
        return "tablet"
    return "desktop"


# ---------------------------------------------------------------------------
# Request helpers
# ---------------------------------------------------------------------------

def client_ip(request: Request) -> str:
    # uvicorn is started with --proxy-headers so request.client.host already
    # reflects the X-Forwarded-For value. Fall back to the raw header as a
    # belt-and-suspenders measure for unusual proxy configs.
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class TrackEvent(BaseModel):
    path: str = Field(..., max_length=2048)
    referrer: Optional[str] = Field(None, max_length=2048)
    timestamp: str = Field(..., max_length=64)
    viewport_width: Optional[int] = Field(None, ge=0, le=65535)
    language: Optional[str] = Field(None, max_length=32)
    # New fields (all optional for backward compat with already-stored events).
    event_type: str = Field("page_view", max_length=32)
    session_page_id: Optional[str] = Field(None, max_length=64)
    elapsed_seconds: Optional[int] = Field(None, ge=0, le=86400)


KNOWN_EVENT_TYPES = {"page_view", "page_heartbeat"}
MAX_BODY_BYTES = 8 * 1024  # 8 KB — well above any legitimate payload


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="krabsy-analytics", docs_url=None, redoc_url=None, openapi_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https://(www\.)?krabsy\.com(:\d+)?$",
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=86400,
)

security = HTTPBasic()


def check_auth(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    ok_user = secrets.compare_digest(credentials.username, DASHBOARD_USERNAME)
    ok_pass = secrets.compare_digest(credentials.password, DASHBOARD_PASSWORD)
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=401,
            detail="Auth required",
            headers={"WWW-Authenticate": 'Basic realm="krabsy-dashboard"'},
        )
    return credentials.username


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/track")
async def track(request: Request) -> JSONResponse:
    ip = client_ip(request)
    if rate_limited(ip):
        # Silent drop — return success so scrapers can't probe the limit.
        return JSONResponse({"ok": True})

    # Raw-body parsing so navigator.sendBeacon can post with text/plain (a
    # CORS-simple request, no preflight). Without this, the pagehide beacon
    # races the browser's network teardown and is unreliable.
    try:
        raw = await request.body()
        if not raw or len(raw) > MAX_BODY_BYTES:
            return JSONResponse({"ok": True})
        data = json.loads(raw)
        event = TrackEvent.model_validate(data)
    except (json.JSONDecodeError, ValidationError, ValueError):
        # Silent accept of malformed payloads — analytics must not give
        # attackers a schema oracle, and a broken client is the user's
        # problem, not ours.
        return JSONResponse({"ok": True})

    event_type = event.event_type if event.event_type in KNOWN_EVENT_TYPES else "page_view"
    user_agent = request.headers.get("user-agent", "")[:512]
    country = await country_for_ip(ip)
    # The raw IP leaves scope at the end of this function. It is never
    # included in the persisted record.

    record = {
        "event_type": event_type,
        "ts_client": event.timestamp,
        "ts_server": datetime.now(timezone.utc).isoformat(),
        "path": event.path,
        "referrer": event.referrer,
        "viewport_width": event.viewport_width,
        "language": event.language,
        "country": country,
        "device_type": device_type_for(event.viewport_width, user_agent),
        "bot": is_bot(user_agent),
        "ua": user_agent,
        "session_page_id": event.session_page_id,
    }
    if event_type == "page_heartbeat":
        record["elapsed_seconds"] = event.elapsed_seconds
    try:
        append_event(record)
    except Exception as exc:
        print(f"[krabsy] append failed: {exc}")
    return JSONResponse({"ok": True})


@app.get("/dashboard", include_in_schema=False)
def dashboard_no_slash() -> RedirectResponse:
    return RedirectResponse(url="/dashboard/", status_code=308)


@app.get("/dashboard/", response_class=HTMLResponse)
def dashboard(
    user: str = Depends(check_auth),
    range_: str = Query("7d", alias="range"),
    show_bots: int = Query(0, alias="bots"),
) -> HTMLResponse:
    return HTMLResponse(render_dashboard(range_, bool(show_bots)))


@app.get("/dashboard/raw")
def dashboard_raw(user: str = Depends(check_auth)) -> JSONResponse:
    events = list(read_events(max_count=10_000))
    # Most-recent last 1000.
    return JSONResponse(events[-1000:])


@app.get("/healthz")
def healthz() -> dict:
    return {"ok": True}
