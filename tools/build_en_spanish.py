#!/usr/bin/env python3
"""Build the English-interface Spanish section's drill pages (/en/spanish/…).

Spanish for English speakers (pilot 2026-11-24, docs/vision.md). Each Spanish
topic (format v2, content/FORMAT.md) gets two drill pages, generated from the
German preposition drill pages so layout/CSS/logic stay in one place:

  /en/spanish/<slug>/sprint/        ← de/praepositionen/sprint/index.html
  /en/spanish/<slug>/fill-the-gap/  ← de/praepositionen/fill-the-gap/index.html

The landing page /en/spanish/index.html is hand-written (not generated).
While the section is a pilot, every page carries noindex (NOINDEX below).

Run from the repo root:  python3 tools/build_en_spanish.py
Re-run after changing the German drill pages or adding a topic.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOME = ROOT / 'homepage'
NOINDEX = True          # flip to False when the section goes public
FOOTER_V = '2026-11-24'

# One row per Spanish topic. slug = URL folder; topic = engine id.
TOPICS = [
    {
        'topic': 'es_ser',
        'slug': 'ser',
        'name': 'I am … (ser)',
        'short': 'name, where you are from, what you are like',
    },
]


def head(title, desc, url):
    robots = '\n  <meta name="robots" content="noindex">' if NOINDEX else ''
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","en");}}catch(_){{}}</script>
  <title>{title} — Krabsy</title>{robots}
  <meta name="description" content="{desc}">
  <link rel="canonical" href="https://krabsy.com{url}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
  <meta property="og:title" content="{title} — Krabsy">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="https://krabsy.com{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Krabsy">
'''


def sub(text, old, new, count=1):
    """Replace exactly `count` occurrences or fail loudly (template drifted)."""
    n = text.count(old)
    if n != count:
        sys.exit(f'template changed: expected {count}× {old[:70]!r}, found {n}')
    return text.replace(old, new)


def cut(text, start_marker, end_marker):
    a = text.index(start_marker)
    b = text.index(end_marker, a) + len(end_marker)
    return text[:a] + text[b:]


def common_body(s, hub):
    s = sub(s, '<a class="k-logo" href="/de/"', f'<a class="k-logo" href="{hub}"')
    # The chip bar, topic nav and language switch are built for the DE/ES
    # English-learning tree; the English section has its own links.
    s = re.sub(r'\s*<script type="module">\s*import \{ initDrillPage \}.*?</script>', '', s, flags=re.S)
    for js in ('krabsy-topic-nav.js', 'krabsy-lang-switch.js'):
        s = re.sub(r'\s*<script src="/lib/' + js + r'[^"]*" defer></script>', '', s)
    s = re.sub(r'/lib/krabsy-footer\.js\?v=[0-9-]+', f'/lib/krabsy-footer.js?v={FOOTER_V}', s)
    s = cut(s, '<!-- seo-article:start', '<!-- seo-article:end -->')
    return s


def intro(s, text):
    """Replace the intro card's aria-label and paragraph (function replacement:
    a text starting with a digit would otherwise merge into the group ref)."""
    return re.sub(r'(<aside class="k-intro-card" aria-label=")[^"]*(">\s*<p>).*?(</p>)',
                  lambda m: m.group(1) + 'About this drill' + m.group(2) + text + m.group(3),
                  s, count=1, flags=re.S)


def links_block(t, here):
    base = f'/en/spanish/{t["slug"]}/'
    items = [('sprint/', 'Sprint', 'tap the right word, as fast as you can'),
             ('fill-the-gap/', 'Fill the Gap', 'type the missing word yourself')]
    lis = ''.join(f'\n        <li><a href="{base}{p}">{n}</a>: {d}.</li>'
                  for p, n, d in items if p != here)
    return f'''
      <section class="k-article" aria-label="More practice">
        <h2>More practice</h2>
        <ul class="k-article-links">{lis}
          <li><a href="/en/spanish/">All Spanish topics and games</a></li>
        </ul>
      </section>'''


def build_sprint(t):
    src = (HOME / 'de/praepositionen/sprint/index.html').read_text()
    url = f'/en/spanish/{t["slug"]}/sprint/'
    title = f'Sprint: Spanish {t["name"]}'
    desc = f'20 Spanish sentences with a gap, as fast as you can: {t["short"]}. Free, no sign-up.'
    s = head(title, desc, url) + src[src.index('  <meta name="viewport"'):]
    s = common_body(s, '/en/spanish/')
    s = sub(s, '<h1 class="k-page-h1">Sprint: englische Präpositionen auf Zeit üben</h1>',
            f'<h1 class="k-page-h1">Sprint: Spanish {t["name"]}</h1>')
    s = intro(s, '20 Spanish sentences with a gap. Tap the right word as fast as you can; '
                 'a wrong answer adds 3 seconds. Stuck? The <b>?</b> button shows a small hint.')
    s = sub(s, 'data-string="common.loading">Lädt…', 'data-string="common.loading">Loading…')
    s = sub(s, '<span>Tipp</span>', '<span>Hint</span>')
    s = sub(s, '<span class="sprint-pattern-hint-label">Muster</span>',
            '<span class="sprint-pattern-hint-label">Pattern</span>')
    s = sub(s, 'aria-label="Antworten"', 'aria-label="Answers"')
    s = sub(s, '<a href="/de/praepositionen/" class="k-btn-secondary"', '<a href="/en/spanish/" class="k-btn-secondary"')
    s = sub(s, "const CURRENT_TOPIC = 'prepositions';", f"const CURRENT_TOPIC = '{t['topic']}';")
    s = sub(s, "const BEST_KEY = 'krabsy_best_sprint_prepositions';",
            f"const BEST_KEY = 'krabsy_best_sprint_{t['topic']}';")
    s = sub(s, "const HUB_URL = '/de/praepositionen/';", "const HUB_URL = '/en/spanish/';")
    # Spanish topics are small: use every difficulty, not only level 2.
    s = sub(s, "          difficulty: 2,\n", '')
    s = sub(s, "loadingEl.textContent = 'Fehler beim Laden.';",
            "loadingEl.textContent = 'Could not load.';")
    s = sub(s, '    </main>', links_block(t, 'sprint/') + '\n    </main>')
    return url, s


def build_fill(t):
    src = (HOME / 'de/praepositionen/fill-the-gap/index.html').read_text()
    url = f'/en/spanish/{t["slug"]}/fill-the-gap/'
    title = f'Fill the Gap: Spanish {t["name"]}'
    desc = f'Type the missing Spanish word: {t["short"]}. Three lives. Free, no sign-up.'
    s = head(title, desc, url) + src[src.index('  <meta name="viewport"'):]
    s = common_body(s, '/en/spanish/')
    s = sub(s, '<h1 class="k-page-h1">Lückentext: englische Präpositionen richtig einsetzen</h1>',
            f'<h1 class="k-page-h1">Fill the Gap: Spanish {t["name"]}</h1>')
    s = intro(s, 'Spanish sentences with a gap. Type the missing word and press Enter. '
                 'You have three lives: a wrong answer costs one. You don\'t need to type accents '
                 '(ingles counts as inglés), but look at how it\'s spelled when the answer appears.')
    s = sub(s, 'src="/games/fill-the-gap.html?lang=de&topic=prepositions"',
            f'src="/games/fill-the-gap.html?lang=en&topic={t["topic"]}"')
    s = sub(s, 'title="Lückentext — Präpositionen"', f'title="Fill the Gap — Spanish {t["name"]}"')
    s = re.sub(r'(<p class="fg-narrow-note">).*?(</p>)',
               r'\1Fill the Gap needs a wider screen. Open this page on a device at least 900&nbsp;px wide, in landscape.\2',
               s, count=1, flags=re.S)
    s = sub(s, '    </main>', links_block(t, 'fill-the-gap/') + '\n    </main>')
    return url, s


def main():
    for t in TOPICS:
        for build in (build_sprint, build_fill):
            url, html = build(t)
            visible = re.sub(r'<(style|script)\b.*?</\1>', '', html, flags=re.S)  # comments in CSS/JS are fine
            leftovers = [w for w in ('Präposition', 'Lückentext', ' und ', 'Übung', 'hreflang')
                         if w in visible]
            if leftovers:
                sys.exit(f'{url}: German/SEO leftovers {leftovers}')
            out = HOME / url.strip('/') / 'index.html'
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(html)
            print('wrote', out.relative_to(ROOT))


if __name__ == '__main__':
    main()
