#!/usr/bin/env python3
"""Validate the catalogues before a release (docs/i18n-scaling.md, contract rule 6).

    python3 tools/check_catalogues.py           # errors + warnings, exit 1 on errors
    python3 tools/check_catalogues.py --strict  # warnings count as errors too

Checks
  sections.json   ids unique, ui/subject known, paths under /<ui>/, pages exist,
                  starter topic belongs to the section
  generated       lib/krabsy-registry.js, krabsy-lang.js stamp and api/catalog.json
                  match the data (tools/krabsy_registry.py)
  topics.json     subject known, shapes valid, file present, slugs only for ui
                  languages, unique per language, display/short name for every
                  language that has a URL, page slugs unique
  ui_<lang>.json  one per interface language, same keys everywhere (topic_overrides
                  only where the topic is shown), same
                  {placeholders}, no HTML unless the key ends in _html
  games.json      ids unique, topics known, ui_langs known, name/tagline for
                  every section the game is in, featured_in valid
  content/        format-2 topic files (content/FORMAT.md): required fields,
                  unique ids, one ___ per sentence, explanation in every
                  interface language of the topic's sections; the two original
                  files' ids unique; content/ and homepage/data/ copies equal
  quiz room       its topic list only names known topics
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import krabsy_registry as R  # noqa: E402

ROOT = R.ROOT
HOME = R.HOME
DATA = R.DATA
CONTENT = ROOT / "content"

errors, warnings = [], []


def err(where, msg):
    errors.append(f"{where}: {msg}")


def warn(where, msg):
    warnings.append(f"{where}: {msg}")


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(path.relative_to(ROOT), "missing")
    except json.JSONDecodeError as e:
        err(path.relative_to(ROOT), f"invalid JSON ({e})")
    return None


def page_exists(url):
    return (HOME / url.strip("/") / "index.html").exists()


PLACEHOLDER = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")
HTML = re.compile(r"<[a-zA-Z/][^>]*>")


# ── sections.json ──────────────────────────────────────────────────────────

def check_sections(reg, topics):
    where = "data/sections.json"
    uis, subjects = reg.get("ui") or {}, reg.get("subjects") or {}
    for key in ("default_ui", "fallback_ui"):
        if reg.get(key) not in uis:
            err(where, f"{key} {reg.get(key)!r} is not an interface language")
    for ui, d in uis.items():
        if not re.fullmatch(r"[a-z]{2,3}", ui):
            err(where, f"ui {ui!r}: not an ISO language code")
        for k, url in d.items():
            if k == "name" or url is None:
                continue
            if not url.startswith(f"/{ui}/"):
                err(where, f"ui {ui}.{k} {url!r} is not under /{ui}/")
            elif not page_exists(url):
                err(where, f"ui {ui}.{k}: no page homepage{url}index.html")
    for sid, s in subjects.items():
        if not isinstance(s.get("keys", []), list):
            err(where, f"subject {sid}: keys must be a list")
    seen = Counter(s.get("id") for s in reg.get("sections") or [])
    for sid, n in seen.items():
        if n > 1:
            err(where, f"section id {sid!r} listed {n} times")
    homes = Counter(s.get("home") for s in reg.get("sections") or [])
    for h, n in homes.items():
        if n > 1:
            err(where, f"section home {h!r} used {n} times")
    for s in reg.get("sections") or []:
        w = f"{where} [{s.get('id')}]"
        if s.get("ui") not in uis:
            err(w, f"ui {s.get('ui')!r} not in ui")
            continue
        if s.get("subject") not in subjects:
            err(w, f"subject {s.get('subject')!r} not in subjects")
        for k in ("home", "games", "teachers", "practice"):
            url = s.get(k)
            if not url:
                err(w, f"{k} missing")
            elif not url.startswith(f"/{s['ui']}/") or not url.endswith("/"):
                err(w, f"{k} {url!r} must start with /{s['ui']}/ and end with /")
            elif not page_exists(url):
                err(w, f"{k}: no page homepage{url}index.html")
        if s.get("starter") not in topics:
            err(w, f"starter {s.get('starter')!r} is not a topic")
        elif not R.topic_in_section(s["starter"], s):
            err(w, f"starter {s['starter']!r} does not belong to the section")
        if not R.section_topics(s):
            warn(w, "has no topics")


# ── generated files ────────────────────────────────────────────────────────

def check_generated():
    for p in R.stale():
        err(p.relative_to(ROOT), "out of date: run python3 tools/krabsy_registry.py")


# ── topics.json ────────────────────────────────────────────────────────────

def check_topics(reg, topics):
    where = "data/topics.json"
    uis = set(reg["ui"])
    slugs = {u: Counter() for u in uis}
    for tid, t in topics.items():
        w = f"{where} [{tid}]"
        if not re.fullmatch(r"[a-z0-9_]{1,40}", tid):
            err(w, "id must be [a-z0-9_], at most 40 characters (the API checks it)")
        if t.get("subject") not in reg["subjects"]:
            err(w, f"subject {t.get('subject')!r} not in sections.json subjects")
        shapes = t.get("shapes")
        if not shapes or not set(shapes) <= {"chain", "quiz"}:
            err(w, f"shapes {shapes!r}: non-empty subset of chain, quiz")
        if t.get("file") and not (DATA / t["file"]).exists():
            err(w, f"file {t['file']} not in homepage/data/")
        langs = [u for u in uis if t.get(u)]
        if not langs:
            warn(w, "has no URL in any interface language (no section shows it)")
        for k in t:
            if re.fullmatch(r"[a-z]{2,3}", k) and k not in uis:
                err(w, f"slug for {k!r}, which is not an interface language")
        for u in langs:
            slugs[u][t[u]] += 1
            for field in ("display_name", "short_name"):
                if not (t.get(field) or {}).get(u):
                    err(w, f"{field}.{u} missing (it has a {u} URL)")
        for pid, p in (t.get("pages") or {}).items():
            for u, slug in p.items():
                if u not in langs:
                    err(w, f"page {pid} has a {u} slug but the topic has no {u} URL")
        for u in langs:
            c = Counter(p[u] for p in (t.get("pages") or {}).values() if p.get(u))
            for slug, n in c.items():
                if n > 1:
                    err(w, f"page slug {u}:{slug!r} used {n} times")
    for u, c in slugs.items():
        for slug, n in c.items():
            if n > 1:
                err(where, f"slug {u}:{slug!r} used by {n} topics")


# ── ui_<lang>.json ─────────────────────────────────────────────────────────

def flat(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        if isinstance(v, dict):
            out.update(flat(v, prefix + k + "."))
        else:
            out[prefix + k] = v
    return out


def check_ui(reg):
    files = {}
    for u in reg["ui"]:
        d = load(DATA / f"ui_{u}.json")
        if d is not None:
            files[u] = flat(d)
    for p in DATA.glob("ui_*.json"):
        u = p.stem[3:]
        if u not in reg["ui"]:
            warn(f"data/{p.name}", f"{u!r} is not an interface language in sections.json")
    if not files:
        return
    keys = set().union(*[set(f) for f in files.values()])

    def needed(k, u):
        # topic_overrides.<topic>.… only in the interface languages of the topic's sections
        m = re.match(r"topic_overrides\.([a-z0-9_]+)\.", k)
        return not m or u in section_uis(m.group(1))

    for u, f in files.items():
        missing = sorted(k for k in keys - set(f) if needed(k, u))
        if missing:
            err(f"data/ui_{u}.json", f"{len(missing)} key(s) missing: {', '.join(missing[:12])}"
                + (" …" if len(missing) > 12 else ""))
    for k in sorted(keys):
        ph = {}
        for u, f in files.items():
            v = f.get(k)
            if isinstance(v, str):
                ph[u] = sorted(set(PLACEHOLDER.findall(v)))
                if not v.strip():
                    err(f"data/ui_{u}.json", f"{k} is empty")
                if HTML.search(v) and not k.endswith("_html"):
                    warn(f"data/ui_{u}.json", f"{k} contains HTML (name the key *_html if intended)")
            elif v is not None and not isinstance(v, (list, int, float, bool)):
                err(f"data/ui_{u}.json", f"{k}: unexpected value type")
        if len({tuple(v) for v in ph.values()}) > 1:
            err("data/ui_*.json", f"{k}: placeholders differ " + "; ".join(f"{u}={v}" for u, v in ph.items()))


# ── games.json ─────────────────────────────────────────────────────────────

def check_games(reg, topics):
    where = "data/games.json"
    games = load(DATA / "games.json")
    if games is None:
        return
    ids = Counter(g.get("id") for g in games)
    for gid, n in ids.items():
        if n > 1:
            err(where, f"game id {gid!r} listed {n} times")
    sections = {s["id"]: s for s in reg["sections"]}
    featured = Counter()
    for g in games:
        w = f"{where} [{g.get('id')}]"
        for t in g.get("topics") or []:
            if t not in topics:
                err(w, f"topic {t!r} not in topics.json")
        for u in g.get("ui_langs") or []:
            if u not in reg["ui"]:
                err(w, f"ui_langs: {u!r} is not an interface language")
        for sid in g.get("featured_in") or []:
            if sid not in sections:
                err(w, f"featured_in: unknown section {sid!r}")
            else:
                featured[sid] += 1
        for k in ("featured", "featured_langs"):
            if k in g:
                err(w, f"{k!r} is replaced by featured_in (section ids)")
        for s in reg["sections"]:
            if not R.game_in_section(g, s):
                continue
            for field in ("name", "tagline"):
                if not (g.get(field) or {}).get(s["ui"]):
                    err(w, f"{field}.{s['ui']} missing (the game is in section {s['id']})")
            if g.get("status") != "coming_soon" and g.get("audience") != "teacher" \
                    and not page_exists(R.game_url(s, g["id"])):
                warn(w, f"no wrapper page {R.game_url(s, g['id'])} (section {s['id']})")
    for sid, n in featured.items():
        if n > 1:
            warn(where, f"{n} games featured in {sid} (the landing shows the first)")


# ── content/ ───────────────────────────────────────────────────────────────

def section_uis(tid):
    return sorted({s["ui"] for s in R.sections() if R.topic_in_section(tid, s)})


def check_gap_file(path, topics, reg):
    rel = path.relative_to(ROOT)
    d = load(path)
    if d is None:
        return
    for k in ("format", "id", "learn_lang", "title", "items"):
        if k not in d:
            err(rel, f"field {k!r} missing")
    if d.get("format") != 2:
        err(rel, "format must be 2")
    tid = d.get("id")
    t = topics.get(tid)
    if not t:
        err(rel, f"id {tid!r} not in topics.json")
        return
    if t.get("file") != path.name:
        err(rel, f"topics.json [{tid}] file is {t.get('file')!r}")
    lang = R.subject_lang(t.get("subject"))
    if d.get("learn_lang") != lang:
        err(rel, f"learn_lang {d.get('learn_lang')!r} but subject {t.get('subject')!r} teaches {lang!r}")
    need = section_uis(tid)
    for u in need:
        if not (d.get("title") or {}).get(u):
            warn(rel, f"title.{u} missing")
    ids = Counter()
    labels = Counter()
    for it in d.get("items") or []:
        iid = it.get("id")
        ids[iid] += 1
        w = f"{rel} [{iid}]"
        if not iid or not re.fullmatch(r"[a-z0-9_]{1,60}", iid):
            err(w, "item id must be ASCII [a-z0-9_] (the class API rejects others)")
        if it.get("label"):
            labels[it["label"]] += 1
        expl = it.get("explanation")
        if not isinstance(expl, dict) or not expl:
            err(w, "explanation (map per interface language) missing")
        else:
            for u in need:
                if not expl.get(u):
                    err(w, f"explanation.{u} missing (the topic is shown in a {u} section)")
        exs = it.get("examples") or []
        if not exs:
            err(w, "no examples")
        for i, ex in enumerate(exs):
            we = f"{w} example {i}"
            s = ex.get("sentence") or ""
            if s.count("___") != 1:
                err(we, f"sentence needs exactly one ___: {s!r}")
            if not ex.get("answers"):
                err(we, "answers missing")
            wrong = ex.get("distractors") or it.get("distractors") or []
            if len(wrong) < 2:
                err(we, "fewer than 2 wrong choices (item or example distractors)")
            norm = lambda x: str(x).strip().lower()
            if set(map(norm, wrong)) & set(map(norm, ex.get("answers") or [])):
                err(we, "a wrong choice is also an accepted answer")
            if "hint" in ex:
                warn(we, "hint: don't use (FORMAT.md, owner decision 2026-11-26)")
            if ex.get("difficulty", 1) not in (1, 2, 3):
                err(we, "difficulty must be 1-3")
    for iid, n in ids.items():
        if n > 1:
            err(rel, f"item id {iid!r} used {n} times")
    for lab, n in labels.items():
        if n > 1:
            err(rel, f"label {lab!r} used {n} times (labels are unique per topic)")


def check_content(reg, topics):
    for p in sorted(CONTENT.glob("*.json")):
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            err(p.relative_to(ROOT), f"invalid JSON ({e})")
            continue
        if isinstance(d, dict) and d.get("format") == 2:
            check_gap_file(p, topics, reg)
        elif isinstance(d, list):
            c = Counter(x.get("id") for x in d if isinstance(x, dict))
            for i, n in c.items():
                if n > 1:
                    err(p.relative_to(ROOT), f"id {i!r} used {n} times")
        served = DATA / p.name
        if served.exists() and served.read_bytes() != p.read_bytes():
            warn(p.relative_to(ROOT), f"differs from homepage/data/{p.name} (sync at release)")
    for tid, t in topics.items():
        if t.get("file") and not (CONTENT / t["file"]).exists():
            err(f"data/topics.json [{tid}]", f"no canonical copy content/{t['file']}")


# ── quiz room topic list ───────────────────────────────────────────────────

def check_quiz_room(topics):
    p = HOME / "games/quiz-room/src/questions.js"
    if not p.exists():
        return
    m = re.search(r"TOPICS\s*=\s*\[([^\]]*)\]", p.read_text(encoding="utf-8"))
    if not m:
        return
    listed = re.findall(r"['\"]([a-z0-9_]+)['\"]", m.group(1))
    for t in listed:
        if t not in topics:
            err("games/quiz-room/src/questions.js", f"TOPICS lists unknown topic {t!r}")
    for t, d in topics.items():
        if "quiz" in (d.get("shapes") or []) and t not in listed:
            warn("games/quiz-room/src/questions.js", f"topic {t!r} is not in the Quiz Room")


def main():
    strict = "--strict" in sys.argv
    reg = load(DATA / "sections.json")
    topics = load(DATA / "topics.json")
    if reg is None or topics is None:
        pass
    else:
        check_sections(reg, topics)
        check_generated()
        check_topics(reg, topics)
        check_ui(reg)
        check_games(reg, topics)
        check_content(reg, topics)
        check_quiz_room(topics)
    for w in warnings:
        print("warning: " + w)
    for e in errors:
        print("ERROR: " + e)
    print(f"{len(errors)} error(s), {len(warnings)} warning(s)")
    sys.exit(1 if errors or (strict and warnings) else 0)


if __name__ == "__main__":
    main()
