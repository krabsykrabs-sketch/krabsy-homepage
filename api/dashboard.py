"""Server-rendered analytics dashboard.

Self-contained HTML (no external JS dependencies). Aggregates are computed
on each request from the JSONL file. At our expected volume (<1k events/day
for months) this is plenty fast.
"""

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from html import escape
from typing import Optional
from urllib.parse import urlparse

from classify import (
    CLASS_BOT, CLASS_BOUNCE, CLASS_ENGAGED, CLASS_LIKELY_BOT, CLASSES,
    HIDDEN_BY_DEFAULT, build_sessions,
)
from storage import read_events

# Value assigned to bounce sessions (page_view with zero heartbeats) when
# computing engagement averages. ~7s is the midpoint of the 0–15s window in
# which we know the visitor left before the first heartbeat fired.
BOUNCE_SECONDS = 7

# Brand palette (kept in sync with the main site)
LAVENDER = "#babfd8"
SAGE = "#cdd9b4"
CORAL = "#f2937e"
TEAL = "#2ec4a0"
CREAM = "#fdfbf4"
INK = "#111"
MUTED = "#666"

RANGES = [
    ("today", "Today", 1),
    ("7d", "Last 7 days", 7),
    ("30d", "Last 30 days", 30),
    ("all", "All time", None),
]


def _since_iso(range_key: str) -> Optional[str]:
    for key, _, days in RANGES:
        if key == range_key:
            if days is None:
                return None
            return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    return (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()


def _referrer_host(ref: Optional[str]) -> str:
    if not ref:
        return "direct"
    try:
        host = urlparse(ref).hostname or "direct"
    except Exception:
        return "unknown"
    if host.endswith("krabsy.com"):
        return f"(self) {host}"
    return host


# Substring needles matched against the referrer host. AI is checked first
# because e.g. "gemini.google." also contains "google.".
_SRC_AI = ("chatgpt.com", "chat.openai.", "openai.com", "perplexity.",
           "gemini.google.", "claude.ai", "copilot.microsoft.")
_SRC_SEARCH = ("google.", "bing.", "duckduckgo.", "ecosia.", "yahoo.",
               "yandex.", "baidu.", "qwant.", "startpage.", "search.brave.")
_SRC_SOCIAL = ("facebook.", "fb.", "instagram.", "twitter.", "x.com", "t.co",
               "tiktok.", "youtube.", "youtu.be", "reddit.", "linkedin.",
               "pinterest.", "whatsapp.", "wa.me", "telegram.", "t.me")


# --- School / classroom platforms ------------------------------------------
# (label, host needles). Checked in order against the referrer host; first
# match wins. Ceibal runs on Schoology (ceibal.schoology.com), so it goes
# first to get its own row. Referrers only carry the origin (browsers'
# default strict-origin-when-cross-origin policy), so matching is host-only;
# self-hosted IServ/Moodle on a plain school domain falls into the generic
# school-domain bucket at best.
SCHOOL_PLATFORMS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Ceibal (Uruguay)", ("ceibal",)),
    ("Schoology", ("schoology.",)),
    ("Google Classroom", ("classroom.google.",)),
    ("Microsoft Teams", ("teams.microsoft.", "teams.live.", "teams.cloud.microsoft")),
    ("Moodle / Aula virtual", ("moodle", "aulavirtual", "aules.edu.gva.es")),
    ("Canvas", ("instructure.com", "canvas.")),
    ("itslearning", ("itslearning.",)),
    ("mebis (Bayern)", ("mebis.",)),
    ("LOGINEO (NRW)", ("logineo",)),
    ("IServ", ("iserv",)),
    ("WebUntis", ("webuntis.",)),
    ("Schul-Cloud", ("schul-cloud", "schulcloud", "dbildungscloud", "niedersachsen.cloud")),
    ("EducaMadrid / Educamos", ("educa.madrid.org", "educamos.")),
    ("Edmodo", ("edmodo.",)),
    ("Seesaw / ClassDojo", ("seesaw.me", "classdojo.")),
    ("Padlet", ("padlet.",)),
)
SCHOOL_GENERIC_LABEL = "Other school / .edu domain"
_SCHOOL_GENERIC_NEEDLES = (".edu.", ".sch.", "k12.", "schule", "school", "colegio",
                           "escuela", "instituto", "liceo", "gymnasium", "ikastola")


def school_platform(referrer: Optional[str]) -> Optional[str]:
    """Return the school/LMS platform label for a referrer URL, or None."""
    if not referrer:
        return None
    try:
        host = (urlparse(referrer).hostname or "").lower()
    except Exception:
        return None
    return school_platform_for_host(host)


def school_platform_for_host(host: str) -> Optional[str]:
    host = (host or "").lower()
    if not host or host.endswith("krabsy.com"):
        return None
    for label, needles in SCHOOL_PLATFORMS:
        if any(n in host for n in needles):
            return label
    if host.endswith(".edu") or any(n in host for n in _SCHOOL_GENERIC_NEEDLES):
        return SCHOOL_GENERIC_LABEL
    return None


def _traffic_source(host: str) -> str:
    """Classify a referrer host into a coarse traffic-source bucket (School /
    AI / Search / Social / Referral / Direct / Internal). NOTE:
    search ENGINES are identifiable, but the search TERM is not — Google &
    co. strip the query from the referrer. Actual queries live in Search
    Console, not here."""
    if host == "direct":
        return "Direct"
    if host.startswith("(self)"):
        return "Internal"
    if host == "unknown":
        return "Other"
    h = host.lower()
    # School first: "classroom.google.com" would otherwise count as Search.
    if school_platform_for_host(h):
        return "School"
    if any(n in h for n in _SRC_AI):
        return "AI"
    if any(n in h for n in _SRC_SEARCH):
        return "Search"
    if any(n in h for n in _SRC_SOCIAL):
        return "Social"
    return "Referral"


def _lang_short(lang: Optional[str]) -> str:
    if not lang:
        return "unknown"
    return lang.split("-")[0].lower()


def _median(values: list[float]) -> Optional[float]:
    if not values:
        return None
    sv = sorted(values)
    n = len(sv)
    if n % 2 == 1:
        return float(sv[n // 2])
    return (sv[n // 2 - 1] + sv[n // 2]) / 2


VIEW_VIEWS = "views"
VIEW_UNIQUES = "uniques"


def _parse_ts(ts: str) -> Optional[datetime]:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def concurrent_peak(sessions: list[dict]) -> tuple[int, Optional[datetime]]:
    """Max number of sessions open at the same instant, and when.

    A session spans [first event, last event] by ts_server; a bounce (no
    heartbeat) spans BOUNCE_SECONDS. This is the classroom headcount proxy:
    a whole class behind one school NAT + identical managed browser
    collapses to 1-3 visitor_hashes, but each pupil's tab is its own
    session_page_id.
    """
    edges: list[tuple[datetime, int]] = []
    for s in sessions:
        start = _parse_ts(s["start"])
        if start is None:
            continue
        end = _parse_ts(s["end"]) or start
        end = max(end, start + timedelta(seconds=BOUNCE_SECONDS))
        edges.append((start, 1))
        edges.append((end, -1))
    # at equal timestamps close before open: back-to-back isn't concurrent
    edges.sort(key=lambda e: (e[0], e[1]))
    peak, cur, peak_at = 0, 0, None
    for t, d in edges:
        cur += d
        if cur > peak:
            peak, peak_at = cur, t
    return peak, peak_at


def aggregate(
    range_key: str,
    show_bots: bool,
    view: str = VIEW_VIEWS,
    country_filter: Optional[str] = None,
    device_filter: Optional[str] = None,
    events: Optional[list[dict]] = None,
) -> dict:
    """Compute every dashboard number.

    Classification (classify.build_sessions) runs on ALL events of the
    range before the country/device filter, so a session's class never
    depends on the filter. `show_bots` False hides both `bot` and
    `likely_bot` sessions from every breakdown; the class table always
    shows all four counts. `events` is injectable for tests.
    """
    since = _since_iso(range_key)
    if events is None:
        events = list(read_events(since=since, max_count=200_000))
    sessions, keys = build_sessions(events)
    hidden = frozenset() if show_bots else HIDDEN_BY_DEFAULT

    total_all = 0
    hidden_views = 0                      # page views of bot + likely_bot
    counted = 0
    paths: Counter = Counter()
    referrers: Counter = Counter()
    sources: Counter = Counter()          # Search / Social / Direct / Referral / AI / Internal
    search_pages: Counter = Counter()     # landing paths whose visit came from a search engine
    langs: Counter = Counter()
    countries: Counter = Counter()
    devices: Counter = Counter()
    hours: Counter = Counter()
    daily_views: Counter = Counter()            # YYYY-MM-DD -> page views
    daily_uniques: dict[str, set] = defaultdict(set)  # YYYY-MM-DD -> visitor_hashes

    # Universe of dimensions present in the date range *before* filters are
    # applied. Used to populate the filter dropdowns — a user who filters to
    # ES still needs to see DE, FR, etc. in the dropdown so they can switch.
    available_countries: Counter = Counter()

    # Per-bucket sets of visitor_hash for the "unique visitors" view. Events
    # without a visitor_hash (legacy, pre-feature) silently never join these
    # sets, so they're excluded from uniques counts.
    paths_u: dict[str, set] = defaultdict(set)
    referrers_u: dict[str, set] = defaultdict(set)
    sources_u: dict[str, set] = defaultdict(set)
    search_pages_u: dict[str, set] = defaultdict(set)
    langs_u: dict[str, set] = defaultdict(set)
    countries_u: dict[str, set] = defaultdict(set)
    devices_u: dict[str, set] = defaultdict(set)
    all_uniques: set = set()

    # Classification bookkeeping (always over every class).
    included: set = set()                 # session keys with >=1 event passing filters
    class_views: Counter = Counter()
    class_uniques: dict[str, set] = defaultdict(set)
    hidden_reasons: Counter = Counter()   # reason -> page views (bot + likely_bot)
    hidden_paths: Counter = Counter()     # path -> page views (bot + likely_bot)

    def passes_filters(country: str, device: str) -> bool:
        if country_filter and country != country_filter:
            return False
        if device_filter and device != device_filter:
            return False
        return True

    for ev, key in zip(events, keys):
        # Events stored before heartbeats existed have no event_type — treat
        # them as page_view for backward compatibility.
        event_type = ev.get("event_type") or "page_view"
        path = ev.get("path") or "/"
        country = ev.get("country") or "unknown"
        device = ev.get("device_type") or "unknown"

        # Dropdown universe: page_views only (heartbeats inherit country/device
        # from the page_view, so counting both would inflate). Bots included so
        # the universe doesn't depend on the bot toggle.
        if event_type == "page_view":
            available_countries[country] += 1

        # Active filters drop everything that doesn't match — including
        # heartbeats, so engagement/uniques inherit the filter.
        if not key or not passes_filters(country, device):
            continue
        included.add(key)
        sess = sessions[key]
        cls = sess["class"]

        if event_type != "page_view":
            continue  # heartbeats only feed the session table (build_sessions)

        total_all += 1
        class_views[cls] += 1
        vh = ev.get("visitor_hash")
        if vh:
            class_uniques[cls].add(vh)
        if cls in HIDDEN_BY_DEFAULT:
            hidden_views += 1
            hidden_reasons[sess["reason"] or cls] += 1
            hidden_paths[path] += 1
        if cls in hidden:
            continue
        counted += 1
        ref = _referrer_host(ev.get("referrer"))
        src = _traffic_source(ref)
        lang = _lang_short(ev.get("language"))

        paths[path] += 1
        referrers[ref] += 1
        sources[src] += 1
        if src == "Search":
            search_pages[path] += 1
        langs[lang] += 1
        countries[country] += 1
        devices[device] += 1
        ts = ev.get("ts_server") or ev.get("ts_client") or ""
        ev_date = None
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            hours[dt.hour] += 1
            ev_date = dt.date().isoformat()
            daily_views[ev_date] += 1
        except Exception:
            pass

        if vh:
            paths_u[path].add(vh)
            if ev_date:
                daily_uniques[ev_date].add(vh)
            referrers_u[ref].add(vh)
            sources_u[src].add(vh)
            if src == "Search":
                search_pages_u[path].add(vh)
            langs_u[lang].add(vh)
            countries_u[country].add(vh)
            devices_u[device].add(vh)
            all_uniques.add(vh)

    class_sessions: Counter = Counter(sessions[k]["class"] for k in included)

    # Engagement: each session contributes one value to its path's bucket.
    # Bounce sessions (no heartbeats) get BOUNCE_SECONDS so fast bounces drag
    # the average down rather than being silently dropped. Always views-based,
    # because engagement is a session-time concept, not a visitor-count one.
    by_path_durations: dict[str, list[int]] = defaultdict(list)
    all_durations: list[int] = []
    for k in included:
        sess = sessions[k]
        if sess["class"] in hidden:
            continue
        value = sess["max_elapsed"] if sess["max_elapsed"] is not None else BOUNCE_SECONDS
        by_path_durations[sess["path"]].append(value)
        all_durations.append(value)

    engagement_rows = []
    for path, view_count in paths.most_common(20):
        durations = by_path_durations.get(path, [])
        if durations:
            avg: Optional[float] = sum(durations) / len(durations)
            med: Optional[float] = _median(durations)
        else:
            avg = None
            med = None
        engagement_rows.append(
            {
                "path": path,
                "views": view_count,
                "avg": avg,
                "median": med,
                "sessions": len(durations),
            }
        )

    overall_avg = sum(all_durations) / len(all_durations) if all_durations else None

    # School / classroom: sessions whose referrer is an LMS / school domain.
    # Hard bots are always excluded (likely_bot can't occur: it requires no
    # referrer). Counts sessions, not visitor_hashes — see concurrent_peak.
    school_by_platform: dict[str, list[dict]] = defaultdict(list)
    for k in included:
        sess = sessions[k]
        if sess["class"] == CLASS_BOT:
            continue
        platform = school_platform(sess["referrer"])
        if platform:
            school_by_platform[platform].append(sess)

    def _school_row(label: str, group: list[dict]) -> dict:
        engaged = [s for s in group if s["class"] == CLASS_ENGAGED]
        times = [s["max_elapsed"] for s in engaged if s["max_elapsed"] is not None]
        peak, peak_at = concurrent_peak(group)
        return {
            "platform": label,
            "sessions": len(group),
            "engaged": len(engaged),
            "visitors": len({s["visitor_hash"] for s in group if s["visitor_hash"]}),
            "median_engaged": _median(times),
            "max_engaged": max(times) if times else None,
            "peak_concurrent": peak,
            "peak_at": peak_at.strftime("%Y-%m-%d %H:%M UTC") if peak_at else None,
            "top_paths": Counter(s["path"] for s in group).most_common(3),
        }

    school_rows = sorted(
        (_school_row(label, group) for label, group in school_by_platform.items()),
        key=lambda r: (-r["sessions"], r["platform"]),
    )
    school_total = (
        _school_row("All school platforms", [s for g in school_by_platform.values() for s in g])
        if len(school_rows) > 1 else None
    )

    # Pick which counter feeds each breakdown based on `view`. Uniques mode
    # converts the per-bucket sets to counts; views mode reuses the existing
    # tallies. Existing events without visitor_hash naturally drop out of
    # uniques counts but stay in views counts.
    def _by_view(counter_views: Counter, uniques_map: dict) -> Counter:
        if view == VIEW_UNIQUES:
            return Counter({k: len(s) for k, s in uniques_map.items()})
        return counter_views

    paths_out = _by_view(paths, paths_u)
    referrers_out = _by_view(referrers, referrers_u)
    sources_out = _by_view(sources, sources_u)
    search_pages_out = _by_view(search_pages, search_pages_u)
    langs_out = _by_view(langs, langs_u)

    # Daily time-series: fill every day from first to last observed (zeros for
    # gaps) so the chart reads continuously. Each row: (date, views, uniques).
    observed = set(daily_views) | set(daily_uniques)
    timeseries: list[tuple] = []
    if observed:
        from datetime import date as _date, timedelta as _td
        d0 = _date.fromisoformat(min(observed))
        d1 = _date.fromisoformat(max(observed))
        d = d0
        while d <= d1:
            k = d.isoformat()
            timeseries.append((k, daily_views.get(k, 0), len(daily_uniques.get(k, ()))))
            d += _td(days=1)
    countries_out = _by_view(countries, countries_u)
    devices_out = _by_view(devices, devices_u)

    return {
        "view": view,
        "total_all": total_all,
        "bot_count": hidden_views,      # page views of bot + likely_bot
        "counted": counted,
        "uniques_total": len(all_uniques),
        "unique_paths": len(paths),
        "class_sessions": {c: class_sessions.get(c, 0) for c in CLASSES},
        "class_views": {c: class_views.get(c, 0) for c in CLASSES},
        "class_uniques": {c: len(class_uniques.get(c, ())) for c in CLASSES},
        "hidden_reasons": hidden_reasons.most_common(12),
        "hidden_paths": hidden_paths.most_common(10),
        "school_rows": school_rows,
        "school_total": school_total,
        "paths": paths_out.most_common(20),
        "referrers": referrers_out.most_common(10),
        "sources": sources_out.most_common(),
        "search_pages": search_pages_out.most_common(15),
        "timeseries": timeseries,
        "langs": sorted(langs_out.items(), key=lambda kv: -kv[1]),
        "countries": countries_out.most_common(10),
        "devices": sorted(devices_out.items(), key=lambda kv: -kv[1]),
        "hours": hours,
        "engagement_rows": engagement_rows,
        "overall_avg_engagement": overall_avg,
        "available_countries": available_countries,
        "country_filter": country_filter,
        "device_filter": device_filter,
    }


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

CSS = f"""
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  font-family: Verdana, Geneva, sans-serif;
  background: {CREAM};
  color: {INK};
  font-size: 14px;
}}
header {{
  background: {LAVENDER};
  padding: 18px 24px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}}
header h1 {{
  margin: 0;
  font-family: 'Limelight', 'Georgia', serif;
  font-size: 22px;
  letter-spacing: 0.5px;
}}
header form {{ display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }}
header select, header label {{ font-size: 13px; }}
header button {{
  background: {CORAL};
  color: white;
  border: 0;
  padding: 6px 14px;
  cursor: pointer;
  font-weight: bold;
}}
header a.dl {{
  margin-left: auto;
  color: {INK};
  text-decoration: none;
  font-size: 12px;
  border: 1px solid {INK};
  padding: 4px 8px;
}}
main {{ padding: 20px 24px 60px; max-width: 1100px; }}
section {{ margin-bottom: 32px; }}
h2 {{
  font-family: 'Limelight', 'Georgia', serif;
  color: {INK};
  background: {LAVENDER};
  display: inline-block;
  padding: 4px 12px;
  font-size: 16px;
  margin: 0 0 12px;
}}
.numbers {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }}
.stat {{
  background: {SAGE};
  padding: 16px;
  border-radius: 4px;
}}
.stat .value {{
  font-size: 28px;
  font-family: 'Limelight', 'Georgia', serif;
  color: {CORAL};
  display: block;
  line-height: 1.1;
}}
.stat .label {{ color: {INK}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }}
table {{ border-collapse: collapse; width: 100%; max-width: 720px; }}
th, td {{ padding: 6px 10px; text-align: left; border-bottom: 1px solid #ddd; }}
th {{ background: {SAGE}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }}
td.num {{ text-align: right; font-variant-numeric: tabular-nums; width: 80px; }}
table.engagement {{ max-width: 720px; }}
table.engagement th.col-path, table.engagement td.col-path {{ width: auto; text-align: left; }}
table.engagement th.col-num, table.engagement td.col-num {{
  text-align: right; font-variant-numeric: tabular-nums; width: 88px;
}}
.muted {{ color: {MUTED}; }}
.chart {{ background: white; padding: 12px; border: 1px solid #e0e0e0; max-width: 720px; }}
.empty {{ color: {MUTED}; font-style: italic; padding: 24px; background: white; border: 1px dashed #ccc; }}
@media (max-width: 600px) {{
  header {{ padding: 14px; }}
  main {{ padding: 14px 14px 40px; }}
  table {{ font-size: 13px; }}
}}
"""


def _stat(label: str, value: str) -> str:
    return (
        f'<div class="stat"><span class="value">{escape(value)}</span>'
        f'<span class="label">{escape(label)}</span></div>'
    )


def _table(headers: tuple[str, str], rows: list[tuple]) -> str:
    if not rows:
        return '<div class="empty">No data in this range</div>'
    body = "".join(
        f"<tr><td>{escape(str(k))}</td><td class='num'>{v}</td></tr>"
        for k, v in rows
    )
    return (
        f"<table><thead><tr><th>{escape(headers[0])}</th>"
        f"<th class='num'>{escape(headers[1])}</th></tr></thead><tbody>{body}</tbody></table>"
    )


def _format_duration(seconds: Optional[float]) -> str:
    """Render seconds as mm:ss or '<15s'.

    Sessions shorter than 15s (i.e. faster than the first heartbeat) and any
    aggregate average that lands below the heartbeat interval are both shown
    as '<15s' rather than a precise number we don't actually have.
    """
    if seconds is None:
        return "—"
    if seconds < 15:
        return "<15s"
    total = int(round(seconds))
    return f"{total // 60}:{total % 60:02d}"


def _engagement_table(rows: list[dict]) -> str:
    if not rows:
        return '<div class="empty">No data in this range</div>'
    body_rows = []
    for r in rows:
        body_rows.append(
            "<tr>"
            f"<td class='col-path'>{escape(r['path'])}</td>"
            f"<td class='col-num'>{r['views']}</td>"
            f"<td class='col-num'>{escape(_format_duration(r['avg']))}</td>"
            f"<td class='col-num'>{escape(_format_duration(r['median']))}</td>"
            "</tr>"
        )
    return (
        "<table class='engagement'><thead><tr>"
        "<th class='col-path'>Path</th>"
        "<th class='col-num'>Views</th>"
        "<th class='col-num'>Avg</th>"
        "<th class='col-num'>Median</th>"
        "</tr></thead><tbody>"
        f"{''.join(body_rows)}</tbody></table>"
    )


def _hourly_svg(hours: Counter) -> str:
    width = 720
    height = 180
    pad_left = 36
    pad_bottom = 28
    pad_top = 12
    chart_w = width - pad_left - 8
    chart_h = height - pad_top - pad_bottom
    max_v = max(hours.values()) if hours else 1
    bar_w = chart_w / 24
    bars = []
    for h in range(24):
        v = hours.get(h, 0)
        bar_h = (v / max_v) * chart_h if max_v else 0
        x = pad_left + h * bar_w
        y = pad_top + (chart_h - bar_h)
        bars.append(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w - 2:.1f}" '
            f'height="{bar_h:.1f}" fill="{CORAL}"><title>{h:02d}:00 — {v}</title></rect>'
        )
        if h % 3 == 0:
            label_y = height - pad_bottom + 16
            bars.append(
                f'<text x="{x + bar_w / 2:.1f}" y="{label_y}" font-size="10" '
                f'text-anchor="middle" fill="{MUTED}">{h:02d}</text>'
            )
    # y-axis max label
    bars.append(
        f'<text x="4" y="{pad_top + 8}" font-size="10" fill="{MUTED}">{max_v}</text>'
    )
    bars.append(
        f'<text x="4" y="{pad_top + chart_h:.1f}" font-size="10" fill="{MUTED}">0</text>'
    )
    return (
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'style="max-width:{width}px" role="img" aria-label="Events per hour of day">'
        f'{"".join(bars)}</svg>'
    )


def _timeseries_svg(rows: list[tuple]) -> str:
    """Daily trend line chart: unique visitors (teal) + page views (coral)."""
    if not rows:
        return '<div class="empty">No data in this range</div>'
    width, height = 720, 220
    pad_left, pad_right, pad_top, pad_bottom = 40, 12, 14, 40
    chart_w = width - pad_left - pad_right
    chart_h = height - pad_top - pad_bottom
    n = len(rows)
    max_v = max((max(v, u) for _, v, u in rows), default=1) or 1
    # one x per day; with a single day, centre it
    def xpos(i):
        return pad_left + (chart_w * (i / (n - 1)) if n > 1 else chart_w / 2)
    def ypos(val):
        return pad_top + (chart_h - (val / max_v) * chart_h)

    def series(idx, color, label_id):
        pts = " ".join(f"{xpos(i):.1f},{ypos(r[idx]):.1f}" for i, r in enumerate(rows))
        dots = "".join(
            f'<circle cx="{xpos(i):.1f}" cy="{ypos(r[idx]):.1f}" r="3" fill="{color}">'
            f'<title>{escape(r[0])} — {r[idx]} {label_id}</title></circle>'
            for i, r in enumerate(rows)
        )
        poly = (f'<polyline points="{pts}" fill="none" stroke="{color}" '
                f'stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>')
        return poly + dots

    # gridlines: 0 and max
    grid = (
        f'<line x1="{pad_left}" y1="{ypos(0):.1f}" x2="{width - pad_right}" y2="{ypos(0):.1f}" stroke="#e7e2d4"/>'
        f'<line x1="{pad_left}" y1="{ypos(max_v):.1f}" x2="{width - pad_right}" y2="{ypos(max_v):.1f}" stroke="#f2efe6"/>'
        f'<text x="4" y="{ypos(max_v) + 4:.1f}" font-size="10" fill="{MUTED}">{max_v}</text>'
        f'<text x="4" y="{ypos(0) + 4:.1f}" font-size="10" fill="{MUTED}">0</text>'
    )
    # x labels: ~6 evenly spaced dates (MM-DD)
    step = max(1, n // 6)
    xlabels = "".join(
        f'<text x="{xpos(i):.1f}" y="{height - pad_bottom + 16}" font-size="10" '
        f'text-anchor="middle" fill="{MUTED}">{escape(rows[i][0][5:])}</text>'
        for i in range(0, n, step)
    )
    legend = (
        f'<rect x="{pad_left}" y="{height - 14}" width="11" height="11" rx="2" fill="{TEAL}"/>'
        f'<text x="{pad_left + 16}" y="{height - 5}" font-size="11" fill="{INK}">Unique visitors</text>'
        f'<rect x="{pad_left + 130}" y="{height - 14}" width="11" height="11" rx="2" fill="{CORAL}"/>'
        f'<text x="{pad_left + 146}" y="{height - 5}" font-size="11" fill="{INK}">Page views</text>'
    )
    return (
        f'<svg viewBox="0 0 {width} {height}" width="100%" '
        f'style="max-width:{width}px" role="img" aria-label="Daily visitors and page views">'
        f'{grid}{xlabels}{series(1, CORAL, "views")}{series(2, TEAL, "visitors")}{legend}</svg>'
    )


CLASS_LABELS = {
    CLASS_ENGAGED: ("Engaged", "human-looking, ≥1 heartbeat (stayed ≥15 s)"),
    CLASS_BOUNCE: ("Bounce", "human-looking, no heartbeat"),
    CLASS_LIKELY_BOT: ("Likely bot", "no heartbeat + no referrer + zh* language + visitor seen once"),
    CLASS_BOT: ("Bot", "bot/agent UA, non-browser UA, impossible iOS UA, or stored bot flag"),
}


def _class_table(data: dict, show_bots: bool) -> str:
    rows = []
    for c in CLASSES:
        label, rule = CLASS_LABELS[c]
        state = "shown" if (show_bots or c not in HIDDEN_BY_DEFAULT) else "hidden"
        rows.append(
            "<tr>"
            f"<td><strong>{escape(label)}</strong> <span class='muted'>({state})</span><br>"
            f"<span class='muted' style='font-size:11px'>{escape(rule)}</span></td>"
            f"<td class='num'>{data['class_sessions'][c]:,}</td>"
            f"<td class='num'>{data['class_views'][c]:,}</td>"
            f"<td class='num'>{data['class_uniques'][c]:,}</td>"
            "</tr>"
        )
    return (
        "<table><thead><tr><th>Class</th><th class='num'>Sessions</th>"
        "<th class='num'>Page views</th><th class='num'>Visitors</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table>"
    )


def _school_table(rows: list[dict], total: Optional[dict]) -> str:
    if not rows:
        return '<div class="empty">No visits from school / LMS referrers in this range</div>'
    body = []
    for r in rows + ([total] if total else []):
        top = ", ".join(f"{escape(p)} ({n})" for p, n in r["top_paths"])
        peak_at = f"<br><span class='muted' style='font-size:11px'>{escape(r['peak_at'])}</span>" if r["peak_at"] else ""
        strong = r is total
        name = f"<strong>{escape(r['platform'])}</strong>" if strong else escape(r["platform"])
        body.append(
            "<tr>"
            f"<td>{name}<br><span class='muted' style='font-size:11px'>{top}</span></td>"
            f"<td class='num'>{r['sessions']}</td>"
            f"<td class='num'>{r['engaged']}</td>"
            f"<td class='num'>{r['visitors']}</td>"
            f"<td class='num'>{escape(_format_duration(r['median_engaged']))}</td>"
            f"<td class='num'>{escape(_format_duration(r['max_engaged']))}</td>"
            f"<td class='num'>{r['peak_concurrent']}{peak_at}</td>"
            "</tr>"
        )
    return (
        "<table style='max-width:900px'><thead><tr><th>Platform · top paths</th>"
        "<th class='num'>Sessions</th><th class='num'>Engaged</th><th class='num'>Visitors</th>"
        "<th class='num'>Median (engaged)</th><th class='num'>Max</th>"
        "<th class='num'>Peak concurrent</th></tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table>"
    )


DEVICE_OPTIONS = [("", "All devices"), ("desktop", "Desktop"), ("tablet", "Tablet"), ("mobile", "Mobile")]


def _country_section(data: dict, country_filter: Optional[str], count_header: str) -> str:
    """Render the Country breakdown — or a small notice when the filter is
    already pinning the country (in which case the breakdown would be a
    100% tautology and is hidden to save space)."""
    if country_filter:
        return (
            f'<p class="muted" style="font-size:12px;margin:0 0 32px">'
            f'Country breakdown hidden (filtered to {escape(country_filter)}).'
            f'</p>'
        )
    return (
        f'<section><h2>Country</h2>'
        f'{_table(("Country", count_header), data["countries"])}'
        f'</section>'
    )


def _device_section(data: dict, device_filter: Optional[str], count_header: str) -> str:
    if device_filter:
        return (
            f'<p class="muted" style="font-size:12px;margin:0 0 32px">'
            f'Device breakdown hidden (filtered to {escape(device_filter.title())}).'
            f'</p>'
        )
    return (
        f'<section><h2>Device</h2>'
        f'{_table(("Device", count_header), data["devices"])}'
        f'</section>'
    )


def render_dashboard(
    range_key: str,
    show_bots: bool,
    view: str = VIEW_VIEWS,
    country_filter: Optional[str] = None,
    device_filter: Optional[str] = None,
    events: Optional[list[dict]] = None,
) -> str:
    if range_key not in {k for k, _, _ in RANGES}:
        range_key = "7d"
    if view not in (VIEW_VIEWS, VIEW_UNIQUES):
        view = VIEW_VIEWS
    # Normalize: empty string => no filter (route layer already does this,
    # but defending the function entry point against direct callers).
    country_filter = country_filter or None
    device_filter = device_filter or None
    if device_filter and device_filter not in {d for d, _ in DEVICE_OPTIONS if d}:
        device_filter = None
    data = aggregate(range_key, show_bots, view, country_filter=country_filter,
                     device_filter=device_filter, events=events)

    range_label = next((label for k, label, _ in RANGES if k == range_key), "Last 7 days")
    bot_pct = (data["bot_count"] / data["total_all"] * 100) if data["total_all"] else 0
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    is_uniques = view == VIEW_UNIQUES

    # Selector controls
    range_options = "".join(
        f'<option value="{k}"{" selected" if k == range_key else ""}>{escape(label)}</option>'
        for k, label, _ in RANGES
    )
    view_options = "".join(
        f'<option value="{val}"{" selected" if val == view else ""}>{escape(label)}</option>'
        for val, label in [(VIEW_VIEWS, "Page views"), (VIEW_UNIQUES, "Unique visitors (per day)")]
    )
    # Country dropdown is data-driven: every country present in the date
    # range (regardless of current filter) becomes an option, sorted by
    # frequency desc. If the user has selected a country that no longer
    # appears in the range (e.g. they bookmarked a URL), still include it
    # so the selection is preserved and visible.
    country_codes = [code for code, _ in data["available_countries"].most_common()]
    if country_filter and country_filter not in country_codes:
        country_codes.append(country_filter)
    country_options = '<option value="">All countries</option>' + "".join(
        f'<option value="{escape(code)}"{" selected" if code == country_filter else ""}>{escape(code)}</option>'
        for code in country_codes
    )
    device_options = "".join(
        f'<option value="{val}"{" selected" if val == (device_filter or "") else ""}>{escape(label)}</option>'
        for val, label in DEVICE_OPTIONS
    )
    bots_checked = " checked" if show_bots else ""

    # Filter-state breadcrumbs in the descriptive line.
    filter_bits = [f"Showing <strong>{escape(range_label)}</strong>"]
    if country_filter:
        filter_bits.append(f"Country: <strong>{escape(country_filter)}</strong>")
    if device_filter:
        filter_bits.append(f"Device: <strong>{escape(device_filter.title())}</strong>")
    filter_bits.append(f"generated {escape(now_iso)}")
    filter_bits.append(
        "bots &amp; likely bots are " + ("<strong>included</strong>" if show_bots else "<strong>excluded</strong>") +
        " from the breakdowns below"
    )
    header_line = " · ".join(filter_bits)

    # First card swaps label/value between modes; the remaining cards always
    # describe the page-view universe (bot %, total incl. bots, etc.).
    if is_uniques:
        first_card = _stat("Unique visitors", f"{data['uniques_total']:,}")
    else:
        first_card = _stat("Events shown", f"{data['counted']:,}")

    ppv = data["counted"] / data["uniques_total"] if data["uniques_total"] else 0.0
    numbers = (
        first_card
        + _stat("Pages / visitor", f"{ppv:.1f}")
        + _stat("Unique paths", f"{data['unique_paths']:,}")
        + _stat("Avg engagement", _format_duration(data["overall_avg_engagement"]))
        + _stat("Engaged sessions", f"{data['class_sessions'][CLASS_ENGAGED]:,}")
        + _stat("Bots + likely bots (% of views)", f"{bot_pct:.1f}%")
        + _stat("Total incl. bots", f"{data['total_all']:,}")
    )

    # Column header for the second column adapts to the view mode so users
    # reading the table after switching see meaningful labels.
    count_header = "Visitors" if is_uniques else "Hits"
    paths_header = "Visitors" if is_uniques else "Views"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Krabsy Analytics</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Limelight&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header>
  <h1>Krabsy Analytics</h1>
  <form method="get" action="/dashboard/">
    <label>Range:
      <select name="range" onchange="this.form.submit()">{range_options}</select>
    </label>
    <label>View:
      <select name="view" onchange="this.form.submit()">{view_options}</select>
    </label>
    <label>Country:
      <select name="country" onchange="this.form.submit()">{country_options}</select>
    </label>
    <label>Device:
      <select name="device" onchange="this.form.submit()">{device_options}</select>
    </label>
    <label><input type="checkbox" name="bots" value="1"{bots_checked} onchange="this.form.submit()"> show bots</label>
    <noscript><button type="submit">Apply</button></noscript>
  </form>
  <a class="dl" href="/dashboard/raw">raw JSON</a>
</header>
<main>
  <p class="muted">{header_line}</p>
  <p class="muted" style="font-style:italic;font-size:12px;margin-top:-8px">Per-day unique count. Cross-day totals may include the same visitor counted on multiple days.</p>

  <section>
    <div class="numbers">{numbers}</div>
  </section>

  <section>
    <h2>Traffic classification</h2>
    {_class_table(data, show_bots)}
    <p class="muted" style="margin-top:8px;font-size:12px">Re-computed on every load from the raw log, so older events get the current rules. One class per page session (session_page_id). Bot + likely bot are hidden from the breakdowns unless &ldquo;show bots&rdquo; is ticked; a session with a heartbeat or a referrer is never a likely bot. Visitors = distinct daily visitor hashes.</p>
    <details style="margin-top:8px;max-width:720px"><summary class="muted" style="font-size:12px;cursor:pointer">What the hidden traffic is (reasons · paths)</summary>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:8px">
        <div>{_table(("Reason", "Views"), data["hidden_reasons"])}</div>
        <div>{_table(("Path", "Views"), data["hidden_paths"])}</div>
      </div>
    </details>
  </section>

  <section>
    <h2>Over time (daily)</h2>
    <div class="chart">{_timeseries_svg(data["timeseries"])}</div>
    <p class="muted" style="margin-top:8px;font-size:12px">Unique visitors and page views per day across the selected range. Hover a dot for the exact count.</p>
  </section>

  <section>
    <h2>Engagement by path</h2>
    {_engagement_table(data["engagement_rows"])}
    <p class="muted" style="margin-top:8px;font-size:12px">Avg and median are computed across session_page_id buckets, regardless of the view toggle. Bounces (no heartbeat fired before the visitor left) are counted as ~7s and render as &lt;15s.</p>
  </section>

  <section>
    <h2>School / classroom</h2>
    {_school_table(data["school_rows"], data["school_total"])}
    <p class="muted" style="margin-top:8px;font-size:12px">Sessions whose referrer is a school LMS or school domain. A class behind one school network with identical browsers collapses to 1&ndash;3 visitor hashes, so read <em>Sessions</em>, <em>Engaged</em> and <em>Peak concurrent</em> (most page sessions open at the same moment &asymp; pupils in the room) rather than <em>Visitors</em>. An LMS embed plus an opened tab can count one pupil twice. Times are max heartbeat per engaged session.</p>
  </section>

  <section>
    <h2>{"Unique visitors by path" if is_uniques else "Page views by path"}</h2>
    {_table(("Path", paths_header), data["paths"])}
  </section>

  <section>
    <h2>Traffic sources</h2>
    {_table(("Source", count_header), data["sources"])}
    <p class="muted" style="margin-top:8px;font-size:12px">Search engines are identifiable, but the search <em>term</em> is not — Google &amp; co. strip the query from the referrer. For actual queries, use Google Search Console.</p>
  </section>

  <section>
    <h2>Pages found via search</h2>
    {_table(("Path", count_header), data["search_pages"])}
    <p class="muted" style="margin-top:8px;font-size:12px">Landing pages whose visit arrived from a search engine — your closest in-house proxy for &ldquo;what are people finding us for&rdquo;.</p>
  </section>

  <section>
    <h2>Top referrers</h2>
    {_table(("Referrer", count_header), data["referrers"])}
  </section>

  <section>
    <h2>Language</h2>
    {_table(("Lang", count_header), data["langs"])}
  </section>

  {_country_section(data, country_filter, count_header)}

  {_device_section(data, device_filter, count_header)}

  <section>
    <h2>Hourly distribution (UTC)</h2>
    <div class="chart">{_hourly_svg(data["hours"])}</div>
  </section>
</main>
</body>
</html>"""
