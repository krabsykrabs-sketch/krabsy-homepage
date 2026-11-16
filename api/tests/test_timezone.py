"""Country from browser time zone (no IP lookup)."""
import json
import os
import sys
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

from tz import country_for_tz  # noqa: E402


def test_tz_table():
    assert country_for_tz("America/Montevideo") == "UY"
    assert country_for_tz("Europe/Berlin") == "DE"
    assert country_for_tz("America/Bogota") == "CO"
    assert country_for_tz("Asia/Calcutta") == "IN"        # legacy alias
    assert country_for_tz("Etc/UTC") is None
    assert country_for_tz("") is None and country_for_tz(None) is None
    assert country_for_tz("x" * 100) is None


def test_collector_uses_timezone_when_geoip_unknown():
    from fastapi.testclient import TestClient
    import main
    import storage
    main.lookup_country = lambda ip: "unknown"     # no GeoIP DB, ip-api off
    storage.EVENTS_FILE.unlink(missing_ok=True)
    client = TestClient(main.app)
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36"
    for tz in ("America/Montevideo", None, "Mars/Olympus"):
        body = {"path": "/es/", "timestamp": "2026-11-17T10:00:00Z"}
        if tz:
            body["timezone"] = tz
        assert client.post("/api/track", content=json.dumps(body), headers={"user-agent": ua}).status_code == 200
    recs = list(storage.read_events())
    assert [(r["country"], r["country_source"]) for r in recs] == [
        ("UY", "timezone"), ("unknown", None), ("unknown", None)]
    assert all("timezone" not in r for r in recs)   # tz itself is not persisted


def test_dockerfile_copies_tz_table():
    copy = next(line for line in (API_DIR / "Dockerfile").read_text().splitlines()
                if line.startswith("COPY main.py"))
    assert "tz_country.json" in copy.split()
