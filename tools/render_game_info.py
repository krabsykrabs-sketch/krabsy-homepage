#!/usr/bin/env python3
"""Render the crawlable info section + JSON-LD into every game wrapper page.

Wrapper pages (homepage/de/spiele/<id>/, homepage/es/juegos/<id>/) used to
contain only the game. This script adds, BELOW the game (the game stays the
first thing a player sees):

  * a slim "scroll for instructions" bar right under the game frame,
  * <main> with h1, intro, how-to-play, what-you-learn, FAQ, links to the
    topic hub / verb pages / related games,
  * in <head>: the shared stylesheet and a JSON-LD @graph
    (WebPage + VideoGame + BreadcrumbList + FAQPage built from the same
    visible FAQ),
  * optionally a better meta description (also og:/twitter:description).

Text lives in tools/game_info_content.py; game names/taglines/thumbnails come
from homepage/data/games.json. Everything is injected between markers, so the
script is safe to re-run:

    python3 tools/render_game_info.py          # rewrite pages
    python3 tools/render_game_info.py --check  # exit 1 if out of date

Page layout (overflow, frame height) is NOT managed here; see the comment
block "SEO info section below the game" in each wrapper's <style>.
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from game_info_content import CONTENT, GENRE, TEACHES, v as verb_link  # noqa: E402
from krabsy_registry import sections, section_topics, subject_lang, topics as load_topics, game_url  # noqa: E402
try:
    from game_info_content import TEACHER  # noqa: E402
except ImportError:  # older content file
    TEACHER = {}
try:
    from game_info_content import PLAYMODE  # noqa: E402
except ImportError:
    PLAYMODE = {}

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "homepage"
SITE = "https://krabsy.com"
ASSET_VER = "2026-11-27"   # bump when krabsy-game-info.js/.css change

HEAD_START = "<!-- GAME-HEAD:START (tools/render_game_info.py) -->"
HEAD_END = "<!-- GAME-HEAD:END -->"
BODY_START = "<!-- GAME-INFO:START (tools/render_game_info.py) -->"
BODY_END = "<!-- GAME-INFO:END -->"

# Visible text per section (sections.json id); paths come from the section.
# CONTENT / TEACHES / TEACHER in game_info_content.py use the same keys.
L = {
    "de": {
        "anchor": "anleitung",
        "hint": "▼ Anleitung &amp; Infos zu {name}",
        "crumbs_label": "Brotkrümelnavigation", "home": "Krabsy", "games": "Spiele",
        "howto": "So spielst du {name}", "learn": "Was du dabei lernst",
        "teach": "Im Unterricht einsetzen", "teach_more": 'Mehr Ideen und Arbeitsblätter: <a href="/de/lehrkraefte/">Für Lehrkräfte</a> · <a href="/de/unregelmaessige-verben/arbeitsblaetter/">Arbeitsblätter (PDF)</a>',
        "faq": "Häufige Fragen", "more": "Weiter üben", "related": "Mehr Spiele mit Verben",
        "verbs_intro": "Verbformen nachschlagen:",
        "top": "▲ Zurück zum Spiel", "play": "Spielen →",
        "alt": "Spielszene aus {name}",
        "links": [
            ("/de/unregelmaessige-verben/", "Unregelmäßige Verben – Übersicht und Übungen"),
            ("/de/unregelmaessige-verben/a-z/", "Alle unregelmäßigen Verben von A bis Z"),
            ("/de/unregelmaessige-verben/verb-tabelle/", "Verb-Tabelle mit allen drei Formen"),
            ("/de/unregelmaessige-verben/sprint/", "Sprint: Verbformen ohne Spiel trainieren"),
            ("/de/praepositionen/", "Englische Präpositionen üben"),
            ("/de/spiele/", "Alle Krabsy-Spiele"),
        ],
        "level": "ab Klasse 5 (Englisch als Fremdsprache)",
        "resource": "Lernspiel",
        "page_suffix": " — Krabsy",
    },
    "es": {
        "anchor": "instrucciones",
        "hint": "▼ Instrucciones e información de {name}",
        "crumbs_label": "Ruta de navegación", "home": "Krabsy", "games": "Juegos",
        "howto": "Cómo se juega {name}", "learn": "Qué aprendes",
        "teach": "En clase: ideas para docentes", "teach_more": 'Más ideas y fichas: <a href="/es/docentes/">Para docentes</a> · <a href="/es/verbos-irregulares/fichas/">Fichas para imprimir (PDF)</a>',
        "faq": "Preguntas frecuentes", "more": "Sigue practicando", "related": "Más juegos de verbos",
        "verbs_intro": "Consulta las formas de:",
        "top": "▲ Volver al juego", "play": "Jugar →",
        "alt": "Escena del juego {name}",
        "links": [
            ("/es/verbos-irregulares/", "Verbos irregulares en inglés: resumen y ejercicios"),
            ("/es/verbos-irregulares/a-z/", "Todos los verbos irregulares de la A a la Z"),
            ("/es/verbos-irregulares/tabla-de-verbos/", "Tabla de verbos irregulares con las tres formas"),
            ("/es/verbos-irregulares/sprint/", "Sprint: practica las formas sin juego"),
            ("/es/preposiciones/", "Practica las preposiciones en inglés"),
            ("/es/juegos/", "Todos los juegos de Krabsy"),
        ],
        "level": "desde 10 años (inglés como lengua extranjera)",
        "resource": "Juego educativo",
        "page_suffix": " — Krabsy",
    },
    # Spanish for English speakers (2026-11-24)
    "en/spanish": {
        "anchor": "how-to-play",
        "topic_label": "Topic:",   # games here play several topics: chips with ?topic=
        "hint": "▼ How to play {name}",
        "crumbs_label": "Breadcrumbs", "home": "Krabsy Spanish", "games": "Games",
        "howto": "How to play {name}", "learn": "What you practice",
        "teach": "Using it in lessons", "teach_more": '<a href="/en/spanish/teachers/#practice-link">Make a practice link</a> · <a href="/games/quiz-room/teacher.html?topic=es_ser&amp;lang=en">Quiz Room for live lessons</a>',
        "faq": "Questions and answers", "more": "Keep practicing", "related": "More Spanish games",
        "verbs_intro": "",
        "top": "▲ Back to the game", "play": "Play →",
        "alt": "Scene from {name}",
        "links": [
            ("/en/spanish/ser/", "Yo soy … (ser): games and drills"),
            ("/en/spanish/estar/", "Estoy … (estar): games and drills"),
            ("/en/spanish/ser-or-estar/", "Ser or estar? games and drills"),
            ("/en/spanish/tener/", "Tengo … (tener): games and drills"),
            ("/en/spanish/games/", "All Spanish games"),
        ],
        "level": "beginners, from about 8 (Spanish as a foreign language)",
        "resource": "Educational game",
        "page_suffix": " — Krabsy",
    },
}


def esc(s):
    return html.escape(s or "", quote=True)


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def fill_verbs(text, lang):
    return re.sub(r"\{([a-z-]+)\}", lambda m: verb_link(lang, m.group(1)), text)


def game_name(g, lang):
    return re.sub(r"!$", "", (g.get("name") or {}).get(lang) or g["id"])


def render_body(gid, sec, games, inline_game):
    lang = sec["ui"]
    t = L[sec["id"]]
    c = CONTENT[gid][sec["id"]]
    gmap = {g["id"]: g for g in games}
    name = game_name(gmap[gid], lang)
    url_games = sec["games"]
    out = [BODY_START]
    if not inline_game:
        # Teacher practice links (2026-11-25): pass ?lang= ?topic= ?difficulty= of this page
        # on to the game frame (right after the iframe, so the game loads with them).
        out.append('<script>(function(){try{var p=new URLSearchParams(location.search),f=document.getElementById("game-frame");'
                   'if(!f)return;var u=new URL(f.getAttribute("src"),location.href),ch=0;'
                   '["lang","topic","difficulty"].forEach(function(k){var v=p.get(k);'
                   'if(v&&/^[a-z0-9_,]{1,40}$/.test(v)&&u.searchParams.get(k)!==v){u.searchParams.set(k,v);ch=1;}});'
                   'if(ch)f.src=u.pathname+u.search;}catch(_){}})();</script>')
    if inline_game:
        # Inlined games are absolutely positioned; this spacer reserves their
        # height in the page flow (height set from resizeWorld()).
        out.append('<div class="kg-stage-spacer" aria-hidden="true"></div>')
    out.append(f'<a class="kg-scroll-hint" href="#{t["anchor"]}">{t["hint"].format(name=esc(name))}</a>')
    out.append(f'<main class="kg-info" id="{t["anchor"]}" lang="{lang}">')
    out.append(f'  <nav class="kg-crumbs" aria-label="{t["crumbs_label"]}"><a href="{sec["home"]}">{t["home"]}</a> › '
               f'<a href="{url_games}">{t["games"]}</a> › <span aria-current="page">{esc(name)}</span></nav>')
    out.append(f'  <h1>{c["h1"]}</h1>')
    if t.get("topic_label"):   # which topic the game asks (game page script marks the current one)
        topics = load_topics()
        chips = " · ".join(f'<a class="kg-topic" data-es-topic="{tid}" href="?topic={tid}">{esc(topics[tid]["display_name"][lang])}</a>'
                           for tid in section_topics(sec))
        out.append(f'  <p class="kg-topics"><strong>{t["topic_label"]}</strong> {chips}</p>')
    for p in c["lead"]:
        out.append(f"  <p>{fill_verbs(p, lang)}</p>")
    out.append(f'  <h2>{t["howto"].format(name=esc(name))}</h2>')
    out.append('  <ul class="kg-steps">')
    for li in c["howto"]:
        out.append(f"    <li>{fill_verbs(li, lang)}</li>")
    out.append("  </ul>")
    out.append(f'  <h2>{t["learn"]}</h2>')
    for p in c["learn"]:
        out.append(f"  <p>{fill_verbs(p, lang)}</p>")
    if gid in TEACHER and sec["id"] in TEACHER[gid]:
        out.append(f'  <h2>{t["teach"]}</h2>')
        out.append('  <ul class="kg-steps">')
        for li in TEACHER[gid][sec["id"]]:
            out.append(f"    <li>{li}</li>")
        out.append("  </ul>")
        out.append(f'  <p>{t["teach_more"]}</p>')
    out.append(f'  <h2>{t["faq"]}</h2>')
    out.append('  <div class="kg-faq">')
    for q, a in c["faq"]:
        out.append(f"    <h3>{q}</h3>")
        out.append(f"    <p>{fill_verbs(a, lang)}</p>")
    out.append("  </div>")
    out.append(f'  <h2>{t["more"]}</h2>')
    out.append('  <ul class="kg-links">')
    for href, label in t["links"]:
        out.append(f'    <li><a href="{href}">{label}</a></li>')
    out.append("  </ul>")
    out.append(f'  <h2>{t["related"]}</h2>')
    out.append('  <div class="kg-related">')
    for rid in c["related"]:
        g = gmap[rid]
        rname = (g.get("name") or {}).get(lang) or rid
        if g.get("thumbnail"):
            thumb = (f'<img src="{esc(g["thumbnail"])}" alt="{esc(t["alt"].format(name=game_name(g, lang)))}" '
                     f'loading="lazy" decoding="async" width="320" height="180">')
        else:
            thumb = '<span class="kg-related-emoji" aria-hidden="true">✏️</span>'
        out.append(f'    <a class="kg-related-card" href="{game_url(sec, rid)}">'
                   f'<span class="kg-related-thumb">{thumb}</span>'
                   f'<span class="kg-related-name">{esc(rname)}</span>'
                   f'<span class="kg-related-tag">{esc((g.get("tagline") or {}).get(lang, ""))}</span></a>')
    out.append("  </div>")
    out.append(f'  <p class="kg-top"><a href="#">{t["top"]}</a></p>')
    out.append("</main>")
    if not inline_game:
        out.append(f'<script src="/lib/krabsy-game-info.js?v={ASSET_VER}" defer></script>')
    out.append(BODY_END)
    return "\n".join("  " + line if line else line for line in out)


def render_head(gid, sec, games, title, description):
    lang = sec["ui"]
    t = L[sec["id"]]
    c = CONTENT[gid][sec["id"]]
    g = {x["id"]: x for x in games}[gid]
    name = game_name(g, lang)
    page = SITE + game_url(sec, gid)
    image = f"{SITE}{g['thumbnail']}" if g.get("thumbnail") else f"{SITE}/og-image.png"
    teaches = TEACHES[sec["id"]].get(gid, TEACHES[sec["id"]]["default"])
    graph = [
        {
            "@type": "WebPage",
            "@id": page,
            "url": page,
            "name": title,
            "description": description,
            "inLanguage": lang,
            "isPartOf": {"@type": "WebSite", "name": "Krabsy", "url": f"{SITE}/"},
            "breadcrumb": {"@id": page + "#breadcrumb"},
            "mainEntity": {"@id": page + "#game"},
            "primaryImageOfPage": image,
        },
        {
            "@type": "VideoGame",
            "@id": page + "#game",
            "name": name,
            "url": page,
            "description": description,
            "image": image,
            "inLanguage": subject_lang(sec["subject"]),   # the questions' language
            "genre": GENRE[gid],
            "gamePlatform": "Web browser",
            "applicationCategory": "EducationalApplication",
            "operatingSystem": "Any",
            "playMode": PLAYMODE.get(gid, "SinglePlayer"),
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
            "learningResourceType": t["resource"],
            "educationalLevel": t["level"],
            "teaches": teaches,
            "audience": {"@type": "EducationalAudience", "educationalRole": "student"},
            "typicalAgeRange": "10-16",
            "publisher": {"@type": "Organization", "name": "Krabsy", "url": f"{SITE}/"},
        },
        {
            "@type": "BreadcrumbList",
            "@id": page + "#breadcrumb",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Krabsy", "item": SITE + sec["home"]},
                {"@type": "ListItem", "position": 2, "name": t["games"], "item": SITE + sec["games"]},
                {"@type": "ListItem", "position": 3, "name": name, "item": page},
            ],
        },
        {
            "@type": "FAQPage",
            "@id": page + "#faq",
            "inLanguage": lang,
            "mainEntity": [
                {"@type": "Question", "name": strip_tags(q),
                 "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}}
                for q, a in c["faq"]
            ],
        },
    ]
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, indent=2)
    ld = ld.replace("</", "<\\/")
    ld = "\n".join("    " + line for line in ld.splitlines())
    return "\n".join([
        "  " + HEAD_START,
        f'  <link rel="stylesheet" href="/lib/krabsy-game-info.css?v={ASSET_VER}">',
        '  <script type="application/ld+json">',
        ld,
        "  </script>",
        "  " + HEAD_END,
    ])


def replace_between(text, start, end, block):
    s = text.index(start)
    e = text.index(end) + len(end)
    # include the indentation before the start marker
    ls = text.rfind("\n", 0, s) + 1
    return text[:ls] + block + text[e:]


def set_meta(text, name_attr, value):
    pat = re.compile(r'(<meta (?:name|property)="%s" content=")[^"]*(")' % re.escape(name_attr))
    if not pat.search(text):
        raise SystemExit(f"meta {name_attr} missing")
    return pat.sub(lambda m: m.group(1) + esc(value) + m.group(2), text, count=1)


def process(path, gid, sec, games):
    lang = sec["ui"]
    text = path.read_text(encoding="utf-8")
    c = CONTENT[gid][sec["id"]]
    if c.get("meta"):
        for n in ("description", "og:description", "twitter:description"):
            text = set_meta(text, n, c["meta"])
    title = html.unescape(re.search(r"<title>([^<]*)</title>", text).group(1))
    description = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', text).group(1))
    inline_game = 'id="game-world"' in text
    head = render_head(gid, sec, games, title, description)
    body = render_body(gid, sec, games, inline_game)
    if HEAD_START in text:
        text = replace_between(text, HEAD_START, HEAD_END, head)
    else:
        i = text.index("</head>")
        text = text[:i] + head.lstrip("\n") + "\n" + text[i:]
    if BODY_START in text:
        text = replace_between(text, BODY_START, BODY_END, body)
    else:
        b = text.index("<body")
        if inline_game:
            # right after the game world, before the game's own <script>
            i = text.index("<script", b)
        else:
            i = text.index("</iframe>", b) + len("</iframe>")
            i = text.index("\n", i) + 1
        text = text[:i] + body + "\n" + text[i:]
    # Page language = language of the visible text (slash games said "en").
    text = re.sub(r'<html lang="[a-z]+"', f'<html lang="{lang}"', text, count=1)
    return text


def main():
    check = "--check" in sys.argv
    games = json.loads((HOME / "data/games.json").read_text(encoding="utf-8"))
    stale, missing = [], []
    for g in games:
        for sec in sections():
            path = HOME / game_url(sec, g["id"]).strip("/") / "index.html"
            if not path.exists():
                continue
            head = path.read_text(encoding="utf-8")
            if "GAME-INFO:START" not in head and 'content="noindex' in head:
                continue   # lean tester page (Verb Hatchery's DE/ES pages), no info section
            if g["id"] not in CONTENT or sec["id"] not in CONTENT[g["id"]]:
                missing.append(str(path.relative_to(ROOT)))
                continue
            old = path.read_text(encoding="utf-8")
            new = process(path, g["id"], sec, games)
            if new != old:
                stale.append(str(path.relative_to(ROOT)))
                if not check:
                    path.write_text(new, encoding="utf-8")
    for p in stale:
        print(("out of date: " if check else "updated: ") + p)
    for p in missing:
        print("NO CONTENT (add it to tools/game_info_content.py): " + p)
    if not stale and not missing:
        print("all game info sections up to date")
    if check and (stale or missing):
        sys.exit(1)


if __name__ == "__main__":
    main()
