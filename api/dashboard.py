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


def aggregate(range_key: str, show_bots: bool, view: str = VIEW_VIEWS) -> dict:
    since = _since_iso(range_key)
    total_all = 0
    bot_count = 0
    counted = 0
    paths: Counter = Counter()
    referrers: Counter = Counter()
    langs: Counter = Counter()
    countries: Counter = Counter()
    devices: Counter = Counter()
    hours: Counter = Counter()

    # Per-bucket sets of visitor_hash for the "unique visitors" view. Events
    # without a visitor_hash (legacy, pre-feature) silently never join these
    # sets, so they're excluded from uniques counts.
    paths_u: dict[str, set] = defaultdict(set)
    referrers_u: dict[str, set] = defaultdict(set)
    langs_u: dict[str, set] = defaultdict(set)
    countries_u: dict[str, set] = defaultdict(set)
    devices_u: dict[str, set] = defaultdict(set)
    all_uniques: set = set()

    # session_page_id -> {path, max_elapsed (or None for bounce), is_bot}
    sessions: dict[str, dict] = {}

    for ev in read_events(since=since, max_count=200_000):
        # Events stored before heartbeats existed have no event_type — treat
        # them as page_view for backward compatibility.
        event_type = ev.get("event_type") or "page_view"
        bot = bool(ev.get("bot"))
        sid = ev.get("session_page_id")
        path = ev.get("path") or "/"

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
            lang = _lang_short(ev.get("language"))
            country = ev.get("country") or "unknown"
            device = ev.get("device_type") or "unknown"

            paths[path] += 1
            referrers[ref] += 1
            langs[lang] += 1
            countries[country] += 1
            devices[device] += 1
            ts = ev.get("ts_server") or ev.get("ts_client") or ""
            try:
                hour = datetime.fromisoformat(ts.replace("Z", "+00:00")).hour
                hours[hour] += 1
            except Exception:
                pass

            vh = ev.get("visitor_hash")
            if vh:
                paths_u[path].add(vh)
                referrers_u[ref].add(vh)
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
    langs_out = _by_view(langs, langs_u)
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
        "langs": sorted(langs_out.items(), key=lambda kv: -kv[1]),
        "countries": countries_out.most_common(10),
        "devices": sorted(devices_out.items(), key=lambda kv: -kv[1]),
        "hours": hours,
        "engagement_rows": engagement_rows,
        "overall_avg_engagement": overall_avg,
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


def render_dashboard(range_key: str, show_bots: bool, view: str = VIEW_VIEWS) -> str:
    if range_key not in {k for k, _, _ in RANGES}:
        range_key = "7d"
    if view not in (VIEW_VIEWS, VIEW_UNIQUES):
        view = VIEW_VIEWS
    data = aggregate(range_key, show_bots, view)

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
    bots_checked = " checked" if show_bots else ""

    # First card swaps label/value between modes; the remaining cards always
    # describe the page-view universe (bot %, total incl. bots, etc.).
    if is_uniques:
        first_card = _stat("Unique visitors", f"{data['uniques_total']:,}")
    else:
        first_card = _stat("Events shown", f"{data['counted']:,}")

    numbers = (
        first_card
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
    <label><input type="checkbox" name="bots" value="1"{bots_checked} onchange="this.form.submit()"> show bots</label>
    <noscript><button type="submit">Apply</button></noscript>
  </form>
  <a class="dl" href="/dashboard/raw">raw JSON</a>
</header>
<main>
  <p class="muted">Showing <strong>{escape(range_label)}</strong> · generated {escape(now_iso)} · bots are {"<strong>included</strong>" if show_bots else "<strong>excluded</strong>"} from the breakdowns below</p>
  <p class="muted" style="font-style:italic;font-size:12px;margin-top:-8px">Per-day unique count. Cross-day totals may include the same visitor counted on multiple days.</p>

  <section>
    <div class="numbers">{numbers}</div>
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
    <h2>Top referrers</h2>
    {_table(("Referrer", count_header), data["referrers"])}
  </section>

  <section>
    <h2>Language</h2>
    {_table(("Lang", count_header), data["langs"])}
  </section>

  <section>
    <h2>Country</h2>
    {_table(("Country", count_header), data["countries"])}
  </section>

  <section>
    <h2>Device</h2>
    {_table(("Device", count_header), data["devices"])}
  </section>

  <section>
    <h2>Hourly distribution (UTC)</h2>
    <div class="chart">{_hourly_svg(data["hours"])}</div>
  </section>
</main>
</body>
</html>"""
