"""Languages, topics and sections for the API (docs/i18n-scaling.md N5).

One source: homepage/data/sections.json + topics.json. The API is deployed on
its own (Coolify base directory /api), so tools/krabsy_registry.py copies what
the API needs into api/catalog.json; this module reads it once at import.
If the file is missing or broken the API keeps running on a small built-in
fallback (the two English topics, de/es/en) and logs a warning.

    from catalog import TOPICS, UI_LANGS, DEFAULT_UI, CLASS_LANGS, ui_lang
    catalog.ui_page("de", "class_account")      → "/de/lehrkraefte/meine-klassen/"
    catalog.mail_text("de", "teacher_login_subject", link=…)   (ui_<lang>.json "mail")
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Optional

log = logging.getLogger("krabsy.catalog")

CATALOG_FILE = Path(os.environ.get("KRABSY_CATALOG", Path(__file__).with_name("catalog.json")))

_FALLBACK = {
    "default_ui": "de",
    "fallback_ui": "en",
    "ui_langs": ["de", "es", "en"],
    "class_langs": ["de", "es"],
    "topics": {"irregular_verbs": {"subject": "english", "learn": "en"},
               "prepositions": {"subject": "english", "learn": "en"}},
    "sections": [
        {"id": "de", "ui": "de", "subject": "english", "home": "/de/", "games": "/de/spiele/"},
        {"id": "es", "ui": "es", "subject": "english", "home": "/es/", "games": "/es/juegos/"},
    ],
}


def load(path: Path = CATALOG_FILE) -> dict:
    try:
        cat = json.loads(path.read_text(encoding="utf-8"))
        for key in _FALLBACK:
            if key not in cat:
                raise ValueError(f"missing {key!r}")
        return cat
    except Exception as exc:  # noqa: BLE001 — never fail startup over the catalogue
        log.warning("catalog: %s unusable (%s), using the built-in fallback", path, exc)
        return dict(_FALLBACK)


_CAT = load()

DEFAULT_UI: str = _CAT["default_ui"]
FALLBACK_UI: str = _CAT["fallback_ui"]
UI_LANGS: tuple = tuple(_CAT["ui_langs"])
CLASS_LANGS: tuple = tuple(_CAT["class_langs"])
TOPICS: frozenset = frozenset(_CAT["topics"])
TOPIC_LEARN: dict = {tid: t.get("learn") for tid, t in _CAT["topics"].items()}
SECTIONS: tuple = tuple(_CAT["sections"])

# Landing pages = section homes; game wrapper pages = <section games folder><game id>/
LANDING_PATHS: tuple = tuple(s["home"] for s in SECTIONS)
_GAMES_PREFIXES = sorted((s["games"] for s in SECTIONS), key=len, reverse=True)
GAME_PAGE = re.compile(r"^(?:%s)([a-z0-9-]+)/$" % "|".join(re.escape(p) for p in _GAMES_PREFIXES))


UI_PAGES: dict = _CAT.get("ui_pages") or {}
MAIL: dict = _CAT.get("mail") or {}


def ui_page(lang: str, key: str) -> Optional[str]:
    """A per-interface page path from sections.json (profile, class_account, …) or None."""
    return (UI_PAGES.get(lang) or {}).get(key)


def mail_text(lang: str, key: str, **values) -> str:
    """An email text from data/ui_<lang>.json "mail" (via catalog.json), placeholders
    {name} filled in. Fallback chain (i18n contract 5): lang → en → default → key."""
    text = None
    for code in (lang, FALLBACK_UI, DEFAULT_UI):
        text = (MAIL.get(code) or {}).get(key)
        if text:
            break
    if not text:
        log.warning("catalog: no mail text %r", key)
        return key
    return re.sub(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", lambda m: str(values.get(m.group(1), m.group(0))), text)


def ui_lang(value: Optional[str], allowed: tuple = UI_LANGS, default: Optional[str] = None) -> str:
    """A known interface language, else `default` (else DEFAULT_UI when allowed,
    else the first allowed one)."""
    if value in allowed:
        return value
    if default is not None:
        return default
    return DEFAULT_UI if DEFAULT_UI in allowed else allowed[0]
