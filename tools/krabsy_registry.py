#!/usr/bin/env python3
"""Section + topic registry for the Python side, and the generator of
homepage/lib/krabsy-registry.js (the same data for the browser).

Sources of truth (docs/i18n-scaling.md N1):
  homepage/data/sections.json  interface languages, subjects, sections
  homepage/data/topics.json    topics: subject, level, shapes, file, slug per ui

A section is (interface language x subject): de, es, en/spanish, later
de/spanisch ... A topic belongs to a section when its subject matches and it
has a URL slug for the section's interface language.

    python3 tools/krabsy_registry.py          # write lib/krabsy-registry.js + api/catalog.json
    python3 tools/krabsy_registry.py --check  # exit 1 if it is out of date

Generators import it:  from krabsy_registry import sections, section_games, ...
"""
import hashlib
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "homepage"
DATA = HOME / "data"
JS_OUT = HOME / "lib" / "krabsy-registry.js"
API_OUT = ROOT / "api" / "catalog.json"   # the API is deployed without homepage/ (Coolify base dir /api)
LANG_JS = HOME / "lib" / "krabsy-lang.js"   # imports the registry with ?v=<hash of it>
IMPORT_RE = re.compile(r"(from '\./krabsy-registry\.js\?v=)[0-9a-z-]+(')")


@lru_cache(maxsize=None)
def registry():
    return json.loads((DATA / "sections.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def topics():
    return json.loads((DATA / "topics.json").read_text(encoding="utf-8"))


def ui_langs():
    return list(registry()["ui"].keys())


def sections():
    return list(registry()["sections"])


def section(section_id):
    for s in sections():
        if s["id"] == section_id:
            return s
    raise KeyError(f"unknown section {section_id!r}")


def default_section(ui):
    """First section listed for an interface language."""
    for s in sections():
        if s["ui"] == ui:
            return s
    return None


def subject_lang(subject):
    return (registry()["subjects"].get(subject) or {}).get("lang")


def topic_in_section(tid, sec):
    t = topics().get(tid) or {}
    return t.get("subject") == sec["subject"] and bool(t.get(sec["ui"]))


def section_topics(sec):
    """Topic ids of a section, in topics.json order."""
    return [tid for tid in topics() if topic_in_section(tid, sec)]


def game_in_section(g, sec):
    own = set(section_topics(sec))
    return any(t in own for t in (g.get("topics") or []))


def section_games(games, sec):
    return [g for g in games if game_in_section(g, sec)]


def topic_url(tid, sec, page_id=None):
    """/de/unregelmaessige-verben/ or /de/unregelmaessige-verben/sprint/.
    Topic slugs are relative to the interface root (/<ui>/)."""
    t = topics()[tid]
    url = f"/{sec['ui']}/{t[sec['ui']]}/"
    if page_id:
        url += f"{t['pages'][page_id][sec['ui']]}/"
    return url


def is_draft(tid):
    """topics.json `"status": "draft"`: content not yet checked by a native speaker.
    Its pages are live and linked but carry noindex (so they stay out of the
    sitemap). Deleting the field (and re-running the page generators) releases it."""
    return (topics().get(tid) or {}).get("status") == "draft"


# ── class years (topics.json "years") ──────────────────────────────────────
# "years": {"de": [5, 6], "es": [7, 7]} = first and last school year in which the
# topic is usually taught, per interface language's school system (source:
# docs/curriculum-map.md). Numbers count school years from the first year of
# primary school: de = Klasse (5 = Klasse 5); es = curso, 1-6 = 1º-6º Primaria,
# 7-10 = 1º-4º ESO. Pages group topics by the first year (Themen page).

def year_range(tid, ui):
    y = ((topics().get(tid) or {}).get("years") or {}).get(ui)
    if not y:
        return None
    return (y[0], y[-1])


def _es_year(n):
    return f"{n}º Primaria" if n <= 6 else f"{n - 6}º ESO"


def year_label(tid, ui):
    """'Klasse 5–6' / '1º–3º ESO' / '5º Primaria – 1º ESO'; None without years."""
    r = year_range(tid, ui)
    if not r:
        return None
    a, b = r
    if ui == "es":
        if a == b:
            return _es_year(a)
        if (a <= 6) == (b <= 6):
            return f"{a - 6}º–{b - 6}º ESO" if a > 6 else f"{a}º–{b}º Primaria"
        return f"{_es_year(a)} – {_es_year(b)}"
    if ui == "de":
        return f"Klasse {a}" if a == b else f"Klasse {a}–{b}"
    return f"Year {a}" if a == b else f"Years {a}–{b}"


def year_group(tid, ui):
    """(sort key, heading) of the Themen page group, or None. es: 5º and 6º
    Primaria share one group (Krabsy's youngest Spanish audience)."""
    r = year_range(tid, ui)
    if not r:
        return None
    a = r[0]
    if ui == "es":
        return (6, "5º/6º Primaria") if a <= 6 else (a, _es_year(a))
    if ui == "de":
        return (a, f"Klasse {a}")
    return (a, f"Year {a}")


def game_url(sec, gid):
    return f"{sec['games']}{gid}/"


def page_path(url):
    """Site URL ("/de/spiele/") -> file under homepage/ ("de/spiele/index.html")."""
    return url.strip("/") + "/index.html"


# ── lib/krabsy-registry.js ─────────────────────────────────────────────────

def _js_topics():
    out = {}
    uis = ui_langs()
    for tid, t in topics().items():
        out[tid] = {
            "subject": t.get("subject"),
            "learn": subject_lang(t.get("subject")),
            "level": t.get("level"),
            "shapes": t.get("shapes") or ["quiz"],
            "file": t.get("file"),
            "status": t.get("status"),
            "slug": {u: t[u] for u in uis if t.get(u)},
        }
    return out


def render_js():
    r = registry()
    dump = lambda v: json.dumps(v, ensure_ascii=False, indent=2)
    return (
        "/* GENERATED by tools/krabsy_registry.py from data/sections.json and\n"
        "   data/topics.json. Do not edit; edit the JSON and re-run the tool.\n"
        "   Read it through lib/krabsy-lang.js (sections, languages) and\n"
        "   lib/krabsy-data.js (topicInfo). */\n"
        f"export const DEFAULT_UI = {json.dumps(r['default_ui'])};\n"
        f"export const FALLBACK_UI = {json.dumps(r['fallback_ui'])};\n"
        f"export const UI = {dump(r['ui'])};\n"
        f"export const SUBJECTS = {dump(r['subjects'])};\n"
        f"export const SECTIONS = {dump(r['sections'])};\n"
        f"export const TOPICS = {dump(_js_topics())};\n"
    )


def _ui_mail(ui):
    """The "mail" block of data/ui_<lang>.json (email texts the API sends)."""
    p = DATA / f"ui_{ui}.json"
    try:
        return json.loads(p.read_text(encoding="utf-8")).get("mail") or {}
    except (OSError, ValueError):
        return {}


def render_api():
    """What the API needs (api/catalog.py): languages, topics, sections, page paths, email texts."""
    r = registry()
    cat = {
        "_doc": "GENERATED by tools/krabsy_registry.py from homepage/data/sections.json + topics.json + ui_<lang>.json (mail). Do not edit.",
        "default_ui": r["default_ui"],
        "fallback_ui": r["fallback_ui"],
        "ui_langs": ui_langs(),
        "class_langs": [u for u, d in r["ui"].items() if d.get("class")],
        "topics": {tid: {"subject": t.get("subject"), "learn": subject_lang(t.get("subject"))}
                   for tid, t in topics().items()},
        "sections": [{k: sec[k] for k in ("id", "ui", "subject", "home", "games")} for sec in sections()],
        # per-interface pages (sign-in links in emails point to them) and the email texts
        "ui_pages": {u: {k: v for k, v in d.items() if k != "name" and v} for u, d in r["ui"].items()},
        "mail": {u: _ui_mail(u) for u in ui_langs()},
    }
    return json.dumps(cat, ensure_ascii=False, indent=2) + "\n"


def outputs():
    """{path: wanted text} for the generated module and the stamped import."""
    js = render_js()
    ver = hashlib.sha1(js.encode("utf-8")).hexdigest()[:10]
    lang = LANG_JS.read_text(encoding="utf-8")
    if not IMPORT_RE.search(lang):
        raise SystemExit("krabsy-lang.js: registry import line not found")
    return {JS_OUT: js, LANG_JS: IMPORT_RE.sub(lambda m: m.group(1) + ver + m.group(2), lang),
            API_OUT: render_api()}


def stale():
    return [p for p, text in outputs().items()
            if not p.exists() or p.read_text(encoding="utf-8") != text]


def main():
    check = "--check" in sys.argv
    out = outputs()
    todo = [p for p in stale()]
    for p in todo:
        rel = p.relative_to(ROOT)
        if check:
            print(f"out of date: {rel} (run python3 tools/krabsy_registry.py)")
        else:
            p.write_text(out[p], encoding="utf-8")
            print(f"updated: {rel}")
    if not todo:
        print("lib/krabsy-registry.js, api/catalog.json up to date")
    if check and todo:
        sys.exit(1)


if __name__ == "__main__":
    main()
