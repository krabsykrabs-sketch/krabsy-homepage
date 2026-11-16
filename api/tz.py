"""Country from the browser's IANA time zone — no IP lookup, no third party.

The tracking script sends Intl.DateTimeFormat().resolvedOptions().timeZone
(e.g. "America/Montevideo"); we map it to an ISO country code with a static
table generated from the IANA tz database (zone.tab + backward aliases).
Coarse by design: a traveller keeps their home device's zone, and zones
shared by several countries resolve to the one listed in zone.tab.
Regenerate api/tz_country.json from /usr/share/zoneinfo when tzdata changes
materially (rare).
"""
import json
from pathlib import Path
from typing import Optional

_TABLE: dict[str, str] = {}
try:
    _TABLE = json.loads((Path(__file__).parent / "tz_country.json").read_text(encoding="utf-8"))
except Exception as exc:  # never break tracking over this
    print(f"[krabsy] tz_country.json not loaded: {exc}")


def country_for_tz(tz: Optional[str]) -> Optional[str]:
    if not tz or not isinstance(tz, str) or len(tz) > 64:
        return None
    return _TABLE.get(tz.strip())
