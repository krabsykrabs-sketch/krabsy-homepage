#!/usr/bin/env python3
"""Pre-render the JS-driven games lists as static, crawlable HTML.

Source of truth: homepage/data/games.json. The pages still re-render the
lists with JavaScript, but now ship the same markup in the served HTML so
search engines (and no-JS visitors) see real <a href> links to every game.
The page JS skips its re-render when the static cards already match the
catalogue (same ids in the same order), so there is no flash or duplicate.

The markup lives between the markers
    <!-- STATIC-GAMES:START (tools/render_static_games.py) -->
    <!-- STATIC-GAMES:END -->
inside each grid container. Re-run after every games.json change:

    python3 tools/render_static_games.py          # rewrite pages
    python3 tools/render_static_games.py --check  # exit 1 if out of date

Only the marker region (and the `hidden` attribute of the wrapping section)
is touched, so hand edits elsewhere on these pages are safe.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "homepage"
START = "<!-- STATIC-GAMES:START (tools/render_static_games.py) -->"
END = "<!-- STATIC-GAMES:END -->"

L10N = {
    "de": {"folder": "spiele", "beta": "Beta", "soon": "Bald", "play": "Spielen →",
           "alt": "Spielszene aus {name}"},
    "es": {"folder": "juegos", "beta": "Beta", "soon": "Pronto", "play": "Jugar →",
           "alt": "Escena del juego {name}"},
}

EMOJI = "✏️"


def esc(s):
    return html.escape(s or "", quote=True)


def name_of(g, lang):
    return (g.get("name") or {}).get(lang) or g["id"]


def card(g, lang, *, decoding=True):
    """Big card (.k-game-card) — games hub + topic hubs. Mirrors the
    buildGameCard()/buildTopicGameCard() DOM in those pages."""
    t = L10N[lang]
    playable = g.get("status") != "coming_soon"
    name = name_of(g, lang)
    tag = "a" if playable else "div"
    cls = "k-game-card" + ("" if playable else " is-disabled")
    href = f' href="/{lang}/{t["folder"]}/{g["id"]}/"' if playable else ""
    parts = [f'<{tag} class="{cls}"{href} data-game-id="{esc(g["id"])}">']
    if g.get("status") == "beta":
        parts.append(f'<span class="k-game-card-badge">{t["beta"]}</span>')
    elif g.get("status") == "coming_soon":
        parts.append(f'<span class="k-game-card-badge is-coming-soon">{t["soon"]}</span>')
    if g.get("thumbnail"):
        dec = ' decoding="async"' if decoding else ""
        parts.append(f'<div class="k-game-card-thumb"><img src="{esc(g["thumbnail"])}" '
                     f'alt="{esc(t["alt"].format(name=name))}" loading="lazy"{dec}></div>')
    else:
        parts.append(f'<div class="k-game-card-thumb"><span class="k-game-card-thumb-emoji">{EMOJI}</span></div>')
    body = (f'<div class="k-game-card-body"><h3 class="k-game-card-title">{esc(name)}</h3>'
            f'<p class="k-game-card-tagline">{esc((g.get("tagline") or {}).get(lang, ""))}</p>')
    if playable:
        body += f'<span class="k-game-card-cta">{t["play"]}</span>'
    body += "</div>"
    parts.append(body)
    parts.append(f"</{tag}>")
    return "".join(parts)


def tile(g, lang):
    """Compact tile (.ch-game-tile) — language homepages' games strip.
    Mirrors buildLangHubGameTile()."""
    t = L10N[lang]
    playable = g.get("status") != "coming_soon"
    name = name_of(g, lang)
    tag = "a" if playable else "div"
    cls = "ch-game-tile" + ("" if playable else " is-coming-soon")
    href = f' href="/{lang}/{t["folder"]}/{g["id"]}/"' if playable else ""
    if g.get("thumbnail"):
        thumb = (f'<div class="ch-game-tile-thumb"><img src="{esc(g["thumbnail"])}" '
                 f'alt="{esc(t["alt"].format(name=name))}" loading="lazy" decoding="async"></div>')
    else:
        thumb = f'<div class="ch-game-tile-thumb"><span class="ch-game-tile-emoji">{EMOJI}</span></div>'
    return (f'<{tag} class="{cls}"{href} data-game-id="{esc(g["id"])}">{thumb}'
            f'<div class="ch-game-tile-name">{esc(name)}</div></{tag}>')


def all_games(games):
    return list(games)


def strip_order(games):
    # Same order as renderGamesStrip(): playable first, then coming-soon.
    return [g for g in games if g.get("status") != "coming_soon"] + \
           [g for g in games if g.get("status") == "coming_soon"]


def for_topic(topic):
    return lambda games: [g for g in games if topic in (g.get("topics") or [])]


# page, grid element id, section id whose `hidden` follows emptiness (or None),
# selector of games, renderer
TARGETS = [
    ("de/spiele/index.html", "games-grid", None, all_games, lambda g: card(g, "de")),
    ("es/juegos/index.html", "games-grid", None, all_games, lambda g: card(g, "es")),
    ("de/index.html", "lang-hub-games-grid", "games-strip-section", strip_order, lambda g: tile(g, "de")),
    ("es/index.html", "lang-hub-games-grid", "games-strip-section", strip_order, lambda g: tile(g, "es")),
    ("de/unregelmaessige-verben/index.html", "games-grid", "games-section", for_topic("irregular_verbs"),
     lambda g: card(g, "de", decoding=False)),
    ("es/verbos-irregulares/index.html", "games-grid", "games-section", for_topic("irregular_verbs"),
     lambda g: card(g, "es", decoding=False)),
    ("de/praepositionen/index.html", "games-grid", "games-section", for_topic("prepositions"),
     lambda g: card(g, "de", decoding=False)),
    ("es/preposiciones/index.html", "games-grid", "games-section", for_topic("prepositions"),
     lambda g: card(g, "es", decoding=False)),
]


def render_page(text, grid_id, section_id, items, render):
    # 1. Locate the grid's opening tag.
    m = re.search(r'<div\b[^>]*\bid="%s"[^>]*>' % re.escape(grid_id), text)
    if not m:
        raise SystemExit(f"grid #{grid_id} not found")
    indent_m = re.search(r"([ \t]*)$", text[:m.start()])
    indent = indent_m.group(1) if indent_m else ""
    inner_indent = indent + "  "
    if items:
        body = "\n".join(inner_indent + render(g) for g in items)
        block = f"\n{inner_indent}{START}\n{body}\n{inner_indent}{END}\n{indent}"
    else:
        block = f"\n{inner_indent}{START}\n{inner_indent}{END}\n{indent}"
    after = text[m.end():]
    if after.lstrip().startswith(START):
        # Re-render: replace everything from the grid's open tag up to the
        # </div> that closes the marker region.
        close = after.index("</div>", after.index(END))
        text = text[:m.end()] + block + after[close:]
    elif after.startswith("</div>"):
        # First run: the grid is an empty <div ...></div>.
        text = text[:m.end()] + block + after
    else:
        raise SystemExit(f"grid #{grid_id} is not empty and has no markers")
    # 2. Section visibility mirrors the JS (hidden only when no games).
    if section_id:
        sm = re.search(r'<section\b[^>]*\bid="%s"[^>]*>' % re.escape(section_id), text)
        if not sm:
            raise SystemExit(f"section #{section_id} not found")
        tag = sm.group(0)
        has_hidden = re.search(r"\s+hidden(?=[\s>])", tag)
        if items and has_hidden:
            tag2 = tag[:has_hidden.start()] + tag[has_hidden.end():]
        elif not items and not has_hidden:
            tag2 = tag[:-1] + " hidden>"
        else:
            tag2 = tag
        text = text[:sm.start()] + tag2 + text[sm.end():]
    return text


def main():
    check = "--check" in sys.argv
    games = json.loads((HOME / "data/games.json").read_text(encoding="utf-8"))
    stale = []
    for rel, grid_id, section_id, select, render in TARGETS:
        p = HOME / rel
        old = p.read_text(encoding="utf-8")
        new = render_page(old, grid_id, section_id, select(games), render)
        if new != old:
            stale.append(rel)
            if not check:
                p.write_text(new, encoding="utf-8")
    verb = "out of date" if check else "updated"
    for rel in stale:
        print(f"{verb}: homepage/{rel}")
    if not stale:
        print("all static games lists up to date")
    if check and stale:
        sys.exit(1)


if __name__ == "__main__":
    main()
