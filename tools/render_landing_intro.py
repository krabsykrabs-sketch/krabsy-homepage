#!/usr/bin/env python3
"""Render the intro band at the top of each section's landing page
(/de/, /es/, /en/spanish/ ...), owner brief 2026-11-27.

What it says: what Krabsy is (h1), which grammar for whom, free / no sign-up /
no ads (one line), three actions (play / practise / verb diploma), and a quiet
line for teachers with the class-code and Quiz Room join links.

Sources (docs/i18n-scaling.md: no visible text in code):
  data/ui_<ui>.json  landing.*   every visible text
  data/sections.json             targets: games, practice, teachers; ui.class
  data/topics.json               the section's topics; their "in_sentence"
                                 name per ui language makes the subject list
                                 ({topics} in landing.intro_line). A topic
                                 without one falls back to short_name; null
                                 leaves it out (e.g. "ser or estar?" is
                                 already covered by ser + estar).
The verb-diploma button appears when a topic of the section has a
"verb-diplom" page; the class-code link when the ui has a class page.

The markup goes between the markers
    <!-- LANDING-INTRO:START (tools/render_landing_intro.py) -->
    <!-- LANDING-INTRO:END -->
in each section's home page. Behaviour (collapsed for returning visitors,
the toggle, the class badge) lives in lib/krabsy-landing.js + .css; the
collapsed state is decided before first paint by a one-line script in the
page head (html.k-intro-ret).

    python3 tools/render_landing_intro.py          # rewrite pages
    python3 tools/render_landing_intro.py --check  # exit 1 if out of date
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from krabsy_registry import registry, sections, section_topics, topics, topic_url, page_path  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / "homepage"
DATA = HOME / "data"
START = "<!-- LANDING-INTRO:START (tools/render_landing_intro.py) -->"
END = "<!-- LANDING-INTRO:END -->"
QUIZ_URL = "/quiz/?lang={ui}"          # short join link of the Quiz Room (forwards with ?lang)
ICONS = {"play": "🎮", "practice": "✍️", "diploma": "🏆"}   # decoration, aria-hidden


def esc(s):
    return html.escape(s or "", quote=True)


def ui_texts(ui):
    d = json.loads((DATA / f"ui_{ui}.json").read_text(encoding="utf-8"))
    return d["landing"]


def topic_list(sec, L):
    names = []
    for tid in section_topics(sec):
        t = topics()[tid]
        own = t.get("in_sentence") or {}
        if sec["ui"] in own:
            if own[sec["ui"]]:
                names.append(own[sec["ui"]])
        else:
            names.append((t.get("short_name") or {}).get(sec["ui"]) or tid)
    if len(names) <= 1:
        return "".join(names)
    return L["list_sep"].join(names[:-1]) + L["list_last"] + names[-1]


def intro_line(sec, L):
    fmt = L["intro_line"]
    names = topic_list(sec, L)
    if fmt.startswith("{topics}") and names:
        names = names[0].upper() + names[1:]
    return fmt.replace("{topics}", names)


def diploma_url(sec):
    for tid in section_topics(sec):
        if "verb-diplom" in (topics()[tid].get("pages") or {}):
            return topic_url(tid, sec, "verb-diplom")
    return None


def render(sec):
    ui = sec["ui"]
    L = ui_texts(ui)
    acts = [("play", sec["games"], L["btn_play"]), ("practice", sec["practice"], L["btn_practice"])]
    dip = diploma_url(sec)
    if dip:
        acts.append(("diploma", dip, L["btn_diploma"]))
    joins = [f'<a class="gl-join-teach" href="{esc(sec["teachers"])}">{esc(L["teachers"])}</a>']
    cls = registry()["ui"][ui].get("class")
    if cls:
        joins.append(f'<a class="gl-join-class" href="{esc(cls)}">{esc(L["join_class"])}</a>')
    joins.append(f'<a class="gl-join-quiz" href="{esc(QUIZ_URL.format(ui=ui))}">{esc(L["join_quiz"])}</a>')
    sep = ' <span class="gl-join-sep" aria-hidden="true">·</span> '
    i = "          "
    return "\n".join([
        START,
        f'{i}<div class="gl-intro-top"><h1>{esc(L["h1"])}</h1>'
        f'<button class="gl-intro-toggle" id="gl-intro-toggle" type="button" aria-expanded="false" aria-controls="gl-intro-more">'
        f'<span class="gl-intro-toggle-txt">{esc(L["toggle"])}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button></div>',
        f'{i}<div class="gl-intro-more" id="gl-intro-more">',
        f'{i}  <p class="gl-intro-line">{esc(intro_line(sec, L))}</p>',
        f'{i}  <nav class="gl-acts" aria-label="{esc(L["acts_label"])}">'
        + "".join(f'<a class="gl-act gl-act-{k}" href="{esc(u)}"><span aria-hidden="true">{ICONS[k]}</span>{esc(t)}</a>'
                  for k, u, t in acts) + "</nav>",
        f'{i}  <p class="gl-join" id="gl-join">{sep.join(joins)}</p>',
        f"{i}</div>",
        f"{i}{END}",
    ])


def main():
    check = "--check" in sys.argv
    stale = []
    pat = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
    for sec in sections():
        path = HOME / page_path(sec["home"])
        src = path.read_text(encoding="utf-8")
        if START not in src:
            print(f"{path.relative_to(ROOT)}: no {START} marker, skipped", file=sys.stderr)
            continue
        out = pat.sub(lambda _: render(sec), src, count=1)
        if out != src:
            stale.append(path)
            if not check:
                path.write_text(out, encoding="utf-8")
    for p in stale:
        print(("out of date: " if check else "wrote ") + str(p.relative_to(ROOT)))
    return 1 if (check and stale) else 0


if __name__ == "__main__":
    sys.exit(main())
