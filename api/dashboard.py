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


def _traffic_source(host: str) -> str:
    """Classify a referrer host into a coarse traffic-source bucket. NOTE:
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


def aggregate(
    range_key: str,
    show_bots: bool,
    view: str = VIEW_VIEWS,
    country_filter: Optional[str] = None,
    device_filter: Optional[str] = None,
) -> dict:
    since = _since_iso(range_key)
    total_all = 0
    bot_count = 0
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

    # session_page_id -> {path, max_elapsed (or None for bounce), is_bot}
    sessions: dict[str, dict] = {}

    def passes_filters(country: str, device: str) -> bool:
        if country_filter and country != country_filter:
            return False
        if device_filter and device != device_filter:
            return False
        return True

    for ev in read_events(since=since, max_count=200_000):
        # Events stored before heartbeats existed have no event_type — treat
        # them as page_view for backward compatibility.
        event_type = ev.get("event_type") or "page_view"
        bot = bool(ev.get("bot"))
        sid = ev.get("session_page_id")
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
        if not passes_filters(country, device):
            continue

        if event_type == "page_view":
            total_all += 1
            if bot:
                bot_count += 1
            # Register the session regardless of bot toggle so heartbeats can
            # be matched correctly; bot filtering happens at the aggregation
            # step below.
            if sid:
                existing = sessions.get(sid)
                if existing is None:
                    sessions[sid] = {"path": path, "max_elapsed": None, "is_bot": bot}
                else:
                    existing["path"] = path
                    existing["is_bot"] = bot
            if bot and not show_bots:
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

            vh = ev.get("visitor_hash")
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
        elif event_type == "page_heartbeat":
            if not sid:
                continue
            elapsed = ev.get("elapsed_seconds")
            if not isinstance(elapsed, int) or elapsed < 0:
                continue
            sess = sessions.get(sid)
            if sess is None:
                # Heartbeat arrived before its page_view in the window (or
                # the page_view fell outside the range). Keep it anyway.
                sessions[sid] = {"path": path, "max_elapsed": elapsed, "is_bot": bot}
            elif sess["max_elapsed"] is None or elapsed > sess["max_elapsed"]:
                sess["max_elapsed"] = elapsed

    # Engagement: each session contributes one value to its path's bucket.
    # Bounce sessions (no heartbeats) get BOUNCE_SECONDS so fast bounces drag
    # the average down rather than being silently dropped. Always views-based,
    # because engagement is a session-time concept, not a visitor-count one.
    by_path_durations: dict[str, list[int]] = defaultdict(list)
    all_durations: list[int] = []
    for sess in sessions.values():
        if sess["is_bot"] and not show_bots:
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
        "bot_count": bot_count,
        "counted": counted,
        "uniques_total": len(all_uniques),
        "unique_paths": len(paths),
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
    data = aggregate(range_key, show_bots, view, country_filter=country_filter, device_filter=device_filter)

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
        "bots are " + ("<strong>included</strong>" if show_bots else "<strong>excluded</strong>") +
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
        + _stat("Bots (% of total)", f"{bot_pct:.1f}%")
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
