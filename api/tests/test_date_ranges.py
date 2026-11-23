"""Custom day / week ranges and the countries-per-day table."""
from datetime import date

import dashboard


def ev(ts, country, vh, path="/de/"):
    return {"event_type": "page_view", "ts_server": ts, "path": path, "country": country,
            "device_type": "desktop", "visitor_hash": vh, "session_page_id": f"{vh}-{ts}",
            "referrer": "https://www.bing.com/", "language": "de-DE"}


def test_custom_range_parsing():
    assert dashboard.custom_range("d:2026-11-22") == (date(2026, 11, 22), date(2026, 11, 22))
    assert dashboard.custom_range("d:2026-11-22..2026-11-16") == (date(2026, 11, 16), date(2026, 11, 22))
    assert dashboard.custom_range("d:2026-13-01") is None
    assert dashboard.normalize_range("d:2026-11-22..2026-11-22") == "d:2026-11-22"
    assert dashboard.normalize_range("nonsense") == dashboard.DEFAULT_RANGE
    assert dashboard.range_from_dates("2026-11-16", "") == "d:2026-11-16"
    assert dashboard.range_from_dates("", "") is None
    assert dashboard.since_iso("d:2026-11-16..2026-11-22").startswith("2026-11-16T00:00:00")
    assert dashboard.until_iso("d:2026-11-16..2026-11-22").startswith("2026-11-22T23:59:59")
    assert dashboard.until_iso("7d") is None


def test_country_days_and_empty_days():
    events = [ev("2026-11-16T10:00:00+00:00", "DE", "a"),
              ev("2026-11-16T11:00:00+00:00", "DE", "b"),
              ev("2026-11-18T10:00:00+00:00", "CO", "c")]
    data = dashboard.aggregate("d:2026-11-16..2026-11-19", True, dashboard.VIEW_UNIQUES, events=events)
    assert [r[0] for r in data["timeseries"]] == ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]
    cd = data["country_days"]
    assert cd["cells"]["2026-11-16"]["DE"] == 2
    assert cd["cells"]["2026-11-18"]["CO"] == 1
    assert cd["order"][0] == "DE"
    html = dashboard.render_dashboard("d:2026-11-16..2026-11-19", True, dashboard.VIEW_UNIQUES, events=events)
    assert "Countries per day" in html and "Pick days" in html and "previous 4 days" in html
