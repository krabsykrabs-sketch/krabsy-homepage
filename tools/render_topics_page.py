#!/usr/bin/env python3
"""Write the topics page "Themen" of every section (owner decision 2026-11-27:
the top bar shows Spielen · Üben · Themen · Profil instead of one link per
topic; this page lists the topics).

    python3 tools/render_topics_page.py          # write the pages
    python3 tools/render_topics_page.py --check  # exit 1 if a page is out of date

Output (the URL is sections.json `topics`):
    homepage/de/themen/index.html
    homepage/es/temas/index.html
    homepage/en/spanish/topics/index.html   (noindex, like all of /en/spanish/)

Data: homepage/data/topics.json (the section's topics = topics with a URL in
its interface language, krabsy_registry.section_topics) and games.json (games
whose `topics` include the topic, without `audience: "teacher"` and
`coming_soon`). Each topic is a card: name (→ topic hub), one line (first
sentence of `description`), `card_stats`, "Üben" (the topic's Sprint page, else
the hub) and the number of games (→ the hub's games section).

Class years: a topic may carry an optional `"year"` (a number, e.g. 5) in
topics.json. Topics are grouped by it, lowest first; topics without a year go
into "Alle Klassen" / "Todos los cursos" / "All years" (all of them today).
Re-run after changing topics.json, games.json or sections.json.
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import krabsy_registry as R  # noqa: E402

ROOT = R.ROOT
HP = R.HOME
ORIGIN = "https://krabsy.com"
ASSET_V = "2026-11-27h"   # krabsy-ui.css / header / footer / lang-switch, same as the site-wide bump

T = {
    "de": {
        "title": "Themen – Englisch-Grammatik üben | Krabsy",
        "h1": "Themen",
        "lead": "Alle Grammatik-Themen auf Krabsy. Such dir eins aus: üben oder gleich spielen.",
        "desc": "Alle Grammatik-Themen auf Krabsy: {list}. Mit Übungen und Spielen, kostenlos und ohne Anmeldung.",
        "all_years": "Alle Klassen", "year": "Klasse {n}",
        "practise": "Üben", "games": ("{n} Spiel", "{n} Spiele"), "no_games": "Noch kein Spiel",
        "crumbs": "Brotkrümelnavigation", "home": "Krabsy",
        "noscript": "", "locale": "de_DE", "and": " und ",
    },
    "es": {
        "title": "Temas – practicar gramática inglesa | Krabsy",
        "h1": "Temas",
        "lead": "Todos los temas de gramática en Krabsy. Elige uno: practica o juega directamente.",
        "desc": "Todos los temas de gramática en Krabsy: {list}. Con ejercicios y juegos, gratis y sin registro.",
        "all_years": "Todos los cursos", "year": "Curso {n}",
        "practise": "Practicar", "games": ("{n} juego", "{n} juegos"), "no_games": "Aún sin juego",
        "crumbs": "Ruta de navegación", "home": "Krabsy",
        "noscript": "", "locale": "es_ES", "and": " y ",
    },
    "en": {
        "title": "Topics – practise Spanish grammar | Krabsy",
        "h1": "Topics",
        "lead": "All the grammar topics on Krabsy. Pick one: practise it or play a game.",
        "desc": "All the grammar topics on Krabsy: {list}. With practice and games, free and without sign-up.",
        "all_years": "All years", "year": "Year {n}",
        "practise": "Practise", "games": ("{n} game", "{n} games"), "no_games": "No game yet",
        "crumbs": "Breadcrumb", "home": "Krabsy",
        "noscript": "", "locale": "en_GB", "and": " and ",
    },
}

ACCENTS = ["#2ee6c0", "#ffcf5e", "#ff8585"]

ICON_PRACTISE = ('<svg class="tp-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" '
                 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="#ffcf5e" d="M4 20l1-4.6L15.4 5a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L8.6 19 4 20z"/>'
                 '<path fill="#ff8585" d="M15.4 5a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3l-1.4 1.4-3.6-3.6z"/><path d="M5 15.4l3.6 3.6"/></svg>')
ICON_PLAY = ('<svg class="tp-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" '
             'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="#2ee6c0" d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l1 5a2.8 2.8 0 0 1-4.8 2.4L15 16H9l-2.1 2a2.8 2.8 0 0 1-4.8-2.4l1-5A4.5 4.5 0 0 1 7.5 7z"/>'
             '<path d="M7.5 10.5v3M6 12h3"/><circle fill="#2c2a3a" stroke="none" cx="15.5" cy="11" r="1.1"/><circle fill="#2c2a3a" stroke="none" cx="17.6" cy="13.2" r="1.1"/></svg>')

CSS = """
    .tp-main { width: 100%; max-width: 1080px; margin: 0 auto; padding: 20px 24px 48px; flex: 1 0 auto; }
    .tp-crumbs { font-size: 0.85rem; color: var(--krabsy-ink-mute); margin: 0 0 10px; }
    .tp-crumbs a { color: var(--krabsy-ink-mute); }
    .tp-h1 { font-family: var(--font-display); font-weight: normal; font-size: 2rem; line-height: 1.15; margin: 0 0 6px; }
    .tp-lead { margin: 0 0 22px; color: var(--krabsy-ink-mute); font-size: 1.02rem; max-width: 60ch; }
    .tp-group { margin: 0 0 28px; }
    .tp-group-h { font-family: var(--font-display); font-weight: normal; font-size: 1.2rem; margin: 0 0 12px; }
    .tp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
    .tp-card {
      display: flex; flex-direction: column; gap: 6px; height: 100%;
      padding: 18px 20px 16px; border-radius: var(--radius-md); background: #fff;
      box-shadow: var(--shadow-card), inset 0 5px 0 var(--tp-accent, #2ee6c0);
    }
    .tp-name { font-family: var(--font-display); font-weight: normal; font-size: 1.3rem; line-height: 1.2; margin: 4px 0 0; }
    .tp-name a { color: var(--krabsy-ink); text-decoration: none; }
    .tp-name a:hover { text-decoration: underline; text-underline-offset: 3px; }
    .tp-line { margin: 0; line-height: 1.45; }
    .tp-stats { margin: 0; font-size: 0.85rem; color: var(--krabsy-ink-mute); }
    .tp-acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: auto; padding-top: 10px; }
    .tp-practise {
      display: inline-flex; align-items: center; gap: 7px; min-height: 44px; padding: 0 18px 0 14px;
      border-radius: var(--radius-pill); background: var(--krabsy-ink); color: #fff;
      font-weight: 800; text-decoration: none;
    }
    .tp-practise:hover { background: #45425a; color: #fff; }
    .tp-practise .tp-ico { background: #fff; border-radius: 50%; padding: 2px; width: 24px; height: 24px; }
    .tp-games {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 4px;
      color: var(--krabsy-ink); font-weight: 700; text-decoration: none;
    }
    .tp-games:hover { text-decoration: underline; text-underline-offset: 3px; color: var(--krabsy-ink); }
    .tp-games.is-none { color: var(--krabsy-ink-mute); }
    .tp-ico { width: 22px; height: 22px; flex: 0 0 auto; }
    .tp-main a:focus-visible { outline: 3px solid var(--krabsy-ink); outline-offset: 3px; border-radius: 8px; }
    .tp-practise:focus-visible { border-radius: var(--radius-pill) !important; }
    @media (max-width: 559px) {
      .tp-main { padding: 14px 16px 32px; }
      .tp-h1 { font-size: 1.7rem; }
      .tp-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    }
"""


def esc(s):
    return html.escape(str(s or ""), quote=True)


def first_sentence(text):
    text = (text or "").strip()
    parts = re.findall(r".+?[.!?](?=\s|$)", text) or [text]
    out = parts[0]
    if len(out) < 40 and len(parts) > 1:   # "Soy or estoy?" alone says too little
        out += " " + parts[1].strip()
    return out.strip()


def pick(m, lang):
    if isinstance(m, dict):
        return m.get(lang) or m.get("en") or next((v for v in m.values() if v), "")
    return m or ""


def games_of(topic_id):
    games = json.loads((HP / "data" / "games.json").read_text(encoding="utf-8"))
    if isinstance(games, dict):
        games = games.get("games", [])
    return [g for g in games
            if topic_id in (g.get("topics") or [])
            and g.get("audience") != "teacher"
            and g.get("status") != "coming_soon"]


def section_cards(sec):
    ui = sec["ui"]
    out = []
    for tid in R.section_topics(sec):
        t = R.topics()[tid]
        if t.get("status") == "coming_soon":
            continue
        hub = R.topic_url(tid, sec)
        practise = R.topic_url(tid, sec, "sprint") if "sprint" in (t.get("pages") or {}) else hub
        out.append({
            "id": tid,
            "name": pick(t.get("display_name"), ui) or tid,
            "line": first_sentence(pick(t.get("description"), ui)),
            "stats": pick(t.get("card_stats"), ui),
            "hub": hub,
            "practise": practise,
            "games": len(games_of(tid)),
            "year": t.get("year"),
        })
    return out


def groups(cards, s):
    years = sorted({c["year"] for c in cards if isinstance(c["year"], int)})
    out = [(s["year"].format(n=y), [c for c in cards if c["year"] == y]) for y in years]
    rest = [c for c in cards if not isinstance(c["year"], int)]
    if rest:
        out.append((s["all_years"], rest))
    return out


def card_html(c, s, i):
    n = c["games"]
    if n:
        games = (f'<a class="tp-games" href="{esc(c["hub"])}#games-section">{ICON_PLAY}'
                 f'<span>{esc(s["games"][0 if n == 1 else 1].format(n=n))}</span></a>')
    else:
        games = f'<a class="tp-games is-none" href="{esc(c["hub"])}">{esc(s["no_games"])}</a>'
    return f"""          <li>
            <article class="tp-card" style="--tp-accent: {ACCENTS[i % len(ACCENTS)]}" aria-labelledby="tp-{c['id']}">
              <h3 class="tp-name" id="tp-{c['id']}"><a href="{esc(c['hub'])}">{esc(c['name'])}</a></h3>
              <p class="tp-line">{esc(c['line'])}</p>
              <p class="tp-stats">{esc(c['stats'])}</p>
              <div class="tp-acts">
                <a class="tp-practise" href="{esc(c['practise'])}" aria-label="{esc(s['practise'] + ': ' + c['name'])}">{ICON_PRACTISE}<span>{esc(s['practise'])}</span></a>
                {games}
              </div>
            </article>
          </li>"""


def page_html(sec):
    ui = sec["ui"]
    s = T[ui]
    url = sec["topics"]
    cards = section_cards(sec)
    names = [pick(R.topics()[c["id"]].get("in_sentence"), ui) or c["name"] for c in cards]
    names = [n for n in names if n]
    lst = names[0] if len(names) == 1 else ", ".join(names[:-1]) + s["and"] + names[-1] if names else ""
    desc = s["desc"].format(list=lst)
    noindex = sec["id"].startswith("en/")
    # hreflang: the same page in the other sections of the same subject (de <-> es).
    peers = [p for p in R.sections() if p["subject"] == sec["subject"] and p.get("topics")]
    alts = ""
    if not noindex and len(peers) > 1:
        alts = "".join(f'  <link rel="alternate" hreflang="{p["ui"]}" href="{ORIGIN}{p["topics"]}">\n' for p in peers)
        alts += f'  <link rel="alternate" hreflang="x-default" href="{ORIGIN}{peers[0]["topics"]}">\n'
    robots = ('  <!-- /en/spanish/ is the Spanish pilot section (noindex), so this page is too. -->\n'
              '  <meta name="robots" content="noindex">\n') if noindex else ""
    ld_items = [{"@type": "ListItem", "position": i + 1, "name": c["name"], "url": ORIGIN + c["hub"]}
                for i, c in enumerate(cards)]
    ld = [
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Krabsy", "item": ORIGIN + sec["home"]},
            {"@type": "ListItem", "position": 2, "name": s["h1"], "item": ORIGIN + url}]},
        {"@context": "https://schema.org", "@type": "ItemList", "name": s["h1"], "itemListElement": ld_items},
    ]
    ld_html = "".join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in ld)
    body_groups = "\n".join(
        f"""      <section class="tp-group" aria-labelledby="tp-g{gi}">
        <h2 class="tp-group-h" id="tp-g{gi}">{esc(name)}</h2>
        <ul class="tp-grid">
{chr(10).join(card_html(c, s, i) for i, c in enumerate(items))}
        </ul>
      </section>""" for gi, (name, items) in enumerate(groups(cards, s)))
    lang_switch = (f'  <script src="/lib/krabsy-lang-switch.js?v={ASSET_V}" defer></script>\n'
                   if len(peers) > 1 else "")
    return f"""<!doctype html>
<!-- GENERATED by tools/render_topics_page.py from data/topics.json + games.json. Do not edit; re-run the tool. -->
<html lang="{ui}">
<head>
  <meta charset="utf-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","{ui}");}}catch(_){{}}</script>
  <title>{esc(s['title'])}</title>
  <meta name="description" content="{esc(desc)}">
{robots}  <link rel="canonical" href="{ORIGIN}{url}">
{alts}  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2026-11-27">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=2026-11-27">
  <meta property="og:title" content="{esc(s['title'])}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="{ORIGIN}{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="{s['locale']}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v={ASSET_V}">
  <style>{CSS}  </style>
{ld_html}</head>
<body>
  <div class="k-page">
    <header class="k-page-header">
      <a href="{sec['home']}" class="k-logo" aria-label="Krabsy"><span>kr</span><span class="k-logo-crab" aria-hidden="true"><img src="/favicon.png?v=2026-11-27" alt="" decoding="async"></span><span>bsy</span></a>
    </header>

    <main class="tp-main">
      <nav class="tp-crumbs" aria-label="{esc(s['crumbs'])}"><a href="{sec['home']}">{esc(s['home'])}</a> › <span aria-current="page">{esc(s['h1'])}</span></nav>
      <h1 class="tp-h1">{esc(s['h1'])}</h1>
      <p class="tp-lead">{esc(s['lead'])}</p>
{body_groups}
    </main>

    <footer class="k-footer">
      <span>© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v={ASSET_V}" defer></script>
  <script type="module" src="/lib/krabsy-header.js?v={ASSET_V}"></script>
{lang_switch}  <script src="/lib/krabsy-analytics.js?v=2026-11-22" defer></script>
</body>
</html>
"""


def main():
    check = "--check" in sys.argv
    stale = 0
    for sec in R.sections():
        if not sec.get("topics"):
            continue
        path = HP / R.page_path(sec["topics"])
        new = page_html(sec)
        old = path.read_text(encoding="utf-8") if path.exists() else None
        if old == new:
            continue
        if check:
            print(f"out of date: {path.relative_to(ROOT)}")
            stale += 1
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(new, encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)}")
    if check and stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
