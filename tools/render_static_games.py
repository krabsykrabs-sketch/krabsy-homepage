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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from krabsy_registry import (  # noqa: E402
    sections, section_topics, game_in_section, game_url, topic_url, topics as _topics, page_path,
)

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "homepage"
DEFAULT_TOPIC = "irregular_verbs"   # what a game plays without ?topic= (krabsy-questions.js)
START = "<!-- STATIC-GAMES:START (tools/render_static_games.py) -->"
END = "<!-- STATIC-GAMES:END -->"

# Visible text per interface language; paths come from the section (sections.json).
L10N = {
    "de": {"beta": "Beta", "soon": "Bald", "teacher": "Für Lehrkräfte", "play": "Spielen →",
           "alt": "Spielszene aus {name}"},
    "es": {"beta": "Beta", "soon": "Pronto", "teacher": "Para docentes", "play": "Jugar →",
           "alt": "Escena del juego {name}"},
    "en": {"beta": "Beta", "soon": "Soon", "teacher": "For teachers", "play": "Play →",
           "alt": "Scene from {name}"},
}

# A section (sections.json: interface language x subject) shows only its topics
# (subject + URL in its interface language) and the games that play one of them.

EMOJI = "✏️"


def esc(s):
    return html.escape(s or "", quote=True)


def name_of(g, lang):
    return (g.get("name") or {}).get(lang) or g["id"]


def card(g, sec, *, decoding=True, topic=None):
    """Big card (.k-game-card) — games hub + topic hubs. Mirrors the
    buildGameCard()/buildTopicGameCard() DOM in those pages."""
    lang = sec["ui"]
    t = L10N[lang]
    playable = g.get("status") != "coming_soon"
    name = name_of(g, lang)
    tag = "a" if playable else "div"
    cls = "k-game-card" + ("" if playable else " is-disabled")
    q = f"?topic={topic}" if topic and topic != DEFAULT_TOPIC else ""   # topic hub: the game plays that topic
    href = f' href="{game_url(sec, g["id"])}{q}"' if playable else ""
    parts = [f'<{tag} class="{cls}"{href} data-game-id="{esc(g["id"])}">']
    if g.get("audience") == "teacher":   # teacher-led: a child can't start it alone
        parts.append(f'<span class="k-game-card-badge is-teacher">{t["teacher"]}</span>')
    elif g.get("status") == "beta":
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


# ── Landing pages (/de/, /es/, /en/spanish/): featured tile + tile grid ───
# Markup mirrors homepage/lib/krabsy-landing.css; krabsy-landing.js only
# filters it (data-tags), drops NEU flags past `new_until` and fills the
# profile card next to the featured tile.
LANDING = {
    "de": {"play_now": "Jetzt spielen", "play": "Spielen", "new": "NEU", "soon": "Bald",
           "phone_ok": "Handy ✓", "large_screen": "Großer Bildschirm", "beta": "Beta",
           "sr_3d": "3D-Spiel", "sr_new": "neu", "sr_soon": "bald verfügbar", "sr_game": "Spiel"},
    "es": {"play_now": "Jugar ahora", "play": "Jugar", "new": "NUEVO", "soon": "Pronto",
           "phone_ok": "Celular ✓", "large_screen": "Pantalla grande", "beta": "Beta",
           "sr_3d": "juego 3D", "sr_new": "nuevo", "sr_soon": "disponible pronto", "sr_game": "juego"},
    "en": {"play_now": "Play now", "play": "Play", "new": "NEW", "soon": "Soon",
           "phone_ok": "Phone ✓", "large_screen": "Big screen", "beta": "Beta",
           "sr_3d": "3D game", "sr_new": "new", "sr_soon": "coming soon", "sr_game": "game"},
}
PLAY_SVG = '<svg><use href="#i-play"/></svg>'


def _new_attr(g):
    nu = g.get("new_until")
    return f' data-new-until="{esc(nu)}"' if nu else ""


def _flags(g, lang):
    L = LANDING[lang]
    out = []
    if g.get("kind") == "3d":
        out.append('<span class="bdg bdg-3d">3D</span>')
    if g.get("new_until") and g.get("status") != "coming_soon":   # NEU only once playable
        out.append(f'<span class="bdg bdg-new"{_new_attr(g)}>{L["new"]}</span>')
    return "".join(out)


def _pills(g, lang, cls_device=True):
    L = LANDING[lang]
    out = []
    dev = g.get("devices")
    if dev in ("phone_ok", "large_screen"):
        c = ("bdg-phone" if dev == "phone_ok" else "bdg-big") if cls_device else ""
        out.append(f'<span class="bdg {c}">{L[dev]}</span>'.replace('class="bdg "', 'class="bdg"'))
    if g.get("status") == "beta":
        out.append(f'<span class="bdg bdg-beta">{L["beta"]}</span>')
    return "".join(out)


def _sr(g, lang):
    """Screen-reader prefix ('3D-Spiel, neu. ') — the visual flags are aria-hidden."""
    L = LANDING[lang]
    bits = []
    if g.get("kind") == "3d":
        bits.append(L["sr_3d"])
    if g.get("new_until") and g.get("status") != "coming_soon":
        bits.append(L["sr_new"])
    return f'<span class="vh">{", ".join(bits)}. </span>' if bits else ""


def landing_tile(g, sec):
    lang = sec["ui"]
    L = LANDING[lang]
    gid = g["id"]
    name = name_of(g, lang)
    playable = g.get("status") != "coming_soon"
    own = set(section_topics(sec))
    tags = " ".join([g.get("kind") or "arcade"] + [tid for tid in (g.get("topics") or []) if tid in own])
    img = g.get("thumb_small") or g.get("thumbnail") or ""
    thumb = (f'<img src="{esc(img)}" alt="" width="640" height="360" loading="lazy" decoding="async">'
             if img else "")
    flags = _flags(g, lang)
    flags_html = f'<div class="gt-flags" aria-hidden="true">{flags}</div>' if flags else ""
    tagline = esc((g.get("tagline") or {}).get(lang, ""))
    if playable:
        feat = " data-featured hidden" if is_featured(g, sec) else ""
        return (f'<a class="gt" href="{game_url(sec, gid)}" data-game-id="{esc(gid)}" data-tags="{tags}"{feat} '
                f'aria-labelledby="n-{gid}" aria-describedby="d-{gid}">'
                f'<div class="gt-thumb">{thumb}{flags_html}<span class="gt-play" aria-hidden="true">{L["play"]}</span></div>'
                f'<div class="gt-body"><h3 class="gt-name" id="n-{gid}">{esc(name)}</h3>'
                f'<div id="d-{gid}" class="vh"><p class="gt-tag">{tagline}</p>'   # owner 2026-11-25: picture + name only; text for screen readers
                f'<div class="gt-meta">{_sr(g, lang)}{_pills(g, lang)}</div></div></div></a>')
    sr_kind = L["sr_3d"] if g.get("kind") == "3d" else L["sr_game"]
    return (f'<div class="gt is-soon" data-game-id="{esc(gid)}" data-tags="{tags}">'
            f'<div class="gt-thumb">{thumb}{flags_html}'
            f'<span class="bdg bdg-soon gt-soon" aria-hidden="true">{L["soon"]}</span></div>'
            f'<div class="gt-body"><h3 class="gt-name">{esc(name)} <span class="vh">({sr_kind}, {L["sr_soon"]})</span></h3>'
            f'<div class="vh"><p class="gt-tag">{tagline}</p></div></div></div>')


def landing_featured(g, sec):
    """The featured game on the landing page: a tile like the grid's (.gt), only
    wider (.gt-wide), with the picture (16:9, like the small tiles) beside the name,
    the tagline and a visible play button.
    Owner 2026-11-25: the old dark banner (.feat) was too big and looked like an
    unclickable banner. The profile card next to it is hand-written in the pages."""
    lang = sec["ui"]
    L = LANDING[lang]
    name = name_of(g, lang)
    topics = _topics()
    own = set(section_topics(sec))
    mine = [tid for tid in (g.get("topics") or []) if tid in own]
    # topic pills only while they fit on one line (a game that plays every topic needs none)
    topic_pills = "".join(
        f'<span class="bdg bdg-topic">{esc(topics[tid]["display_name"][lang])}</span>' for tid in mine
    ) if len(mine) <= 2 else ""
    img = g.get("hero") or g.get("thumb_small") or g.get("thumbnail") or ""
    flags = _flags(g, lang)
    return (f'<a class="gt gt-wide" href="{game_url(sec, g["id"])}" data-game-id="{esc(g["id"])}" '
            f'aria-labelledby="feat-name" aria-describedby="feat-desc feat-meta">'
            f'<div class="gt-thumb"><img src="{esc(img)}" alt="" width="1200" height="675" decoding="async" fetchpriority="high">'
            + (f'<div class="gt-flags" aria-hidden="true">{flags}</div>' if flags else "") +
            f'</div><div class="gt-body"><h2 class="gt-name" id="feat-name">{esc(name)}</h2>'
            # owner 2026-11-28: one sentence about the game (tagline) is visible in the
            # featured tile; the topic/device badges stay hidden (screen readers only)
            f'<p class="gt-tag" id="feat-desc">{esc((g.get("tagline") or {}).get(lang, ""))}</p>'
            f'<div id="feat-meta" class="vh"><div class="gt-meta">{_sr(g, lang)}{topic_pills}{_pills(g, lang)}</div></div>'
            f'<span class="gt-cta" aria-hidden="true">{PLAY_SVG}{L["play_now"]}</span></div></a>')


def for_kids(games):
    # Children's lists (landing, games hubs, topic hubs, footer, in-game chips) skip
    # teacher-led games (audience "teacher", e.g. the Quiz-Raum); they live on the
    # teacher pages (owner 2026-11-23, hubs too 2026-11-25).
    return [g for g in games if g.get("audience") != "teacher"]


def is_featured(g, sec):
    # games.json "featured_in": section ids whose landing features this game
    return sec["id"] in (g.get("featured_in") or [])


def featured_only(games, sec):
    f = [g for g in for_kids(games) if game_in_section(g, sec) and is_featured(g, sec)
         and g.get("status") != "coming_soon"]
    return f[:1]


def landing_order(games, sec):
    # Featured first (hidden under "all"), then the 3D games, then the 2D
    # arcade games (owner 2026-11-22); inside each group playable first,
    # then coming soon, otherwise games.json order.
    feat = featured_only(games, sec)
    rest = [g for g in for_kids(games) if g not in feat and game_in_section(g, sec)]
    three_d = [g for g in rest if g.get("kind") == "3d"]
    others = [g for g in rest if g.get("kind") != "3d"]
    return feat + strip_order(three_d) + strip_order(others)


def all_games(games):
    return list(games)


def strip_order(games):
    # Same order as renderGamesStrip(): playable first, then coming-soon.
    return [g for g in games if g.get("status") != "coming_soon"] + \
           [g for g in games if g.get("status") == "coming_soon"]


def for_topic(topic):
    # children's lists: no teacher-led games (Quiz-Raum; owner 2026-11-25)
    return lambda games: [g for g in for_kids(games) if topic in (g.get("topics") or [])]


def targets():
    """(page, grid element id, <section> id whose `hidden` follows emptiness or
    None, selector of games, renderer) for every section in sections.json:
    its games hub, its landing (featured tile + grid) and one topic hub per
    topic. Topic hub cards carry ?topic= so the game plays that topic."""
    out = []
    for sec in sections():
        mine = lambda gs, sec=sec: [g for g in for_kids(gs) if game_in_section(g, sec)]
        out += [
            (page_path(sec["games"]), "games-grid", None, mine, lambda g, sec=sec: card(g, sec)),
            (page_path(sec["home"]), "gl-featured", None, lambda gs, sec=sec: featured_only(gs, sec),
             lambda g, sec=sec: landing_featured(g, sec)),
            (page_path(sec["home"]), "gl-grid", None, lambda gs, sec=sec: landing_order(gs, sec),
             lambda g, sec=sec: landing_tile(g, sec)),
        ]
        for tid in section_topics(sec):
            out.append((page_path(topic_url(tid, sec)), "games-grid", "games-section", for_topic(tid),
                        lambda g, sec=sec, tid=tid: card(g, sec, decoding=False, topic=tid)))
    return out


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
    for rel, grid_id, section_id, select, render in targets():
        p = HOME / rel
        if not p.exists():
            print(f"skipped (no page yet): homepage/{rel}")
            continue
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
