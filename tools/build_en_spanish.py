#!/usr/bin/env python3
"""Build the Spanish section for English speakers (/en/spanish/…) from the
German pages' skeletons, so it looks and works like the rest of the site.

Spanish for English speakers (pilot 2026-11-24, docs/vision.md). Generated:

  /en/spanish/<slug>/               topic hub     ← de/praepositionen/ (head + style)
  /en/spanish/<slug>/sprint/        drill         ← de/praepositionen/sprint/
  /en/spanish/<slug>/fill-the-gap/  drill         ← de/praepositionen/fill-the-gap/
  /en/spanish/games/                games hub     ← de/spiele/ (head + style)
  /en/spanish/games/<id>/           game page     ← de/spiele/<id>/

Hand-written: the landing /en/spanish/index.html (built on the /de/ landing).
Afterwards run, in this order:
  python3 tools/render_static_games.py   (game grids: landing, games hub, topic hub)
  python3 tools/render_game_info.py      (info section under each game)
The shared scripts (krabsy-nav, -topic-nav, -footer, -landing) know /en/ as this
section: topics with an "en" URL in topics.json, the games that play them.
While the section is a pilot, every page carries noindex (NOINDEX below).

Run from the repo root:  python3 tools/build_en_spanish.py
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
        'title': 'Yo soy … (ser)',
        'short': 'name, where you are from, what you are like',
        'level': 'Beginners (A1)',
        'intro': 'Say who you are, where you are from and what you are like: '
                 '<em lang="es">Yo soy Lucas. Soy de Inglaterra. Soy alto.</em> '
                 'Play one of the games, or practise with the two quick drills.',
    },
    {
        'topic': 'es_estar', 'slug': 'estar', 'name': 'I am … (estar)', 'title': 'Estoy … (estar)',
        'short': 'how you feel and where things are', 'level': 'Beginners (A1)',
        'intro': 'Say how you feel and where you or things are: '
                 '<em lang="es">Estoy cansado. Estoy en casa. El libro está en la mesa.</em> '
                 'Play one of the games, or practise with the two quick drills.',
    },
    {
        'topic': 'es_ser_estar', 'slug': 'ser-or-estar', 'name': 'ser or estar?', 'title': 'Ser or estar?',
        'short': 'soy or estoy, es or está', 'level': 'Beginners (A1)',
        'intro': '<em lang="es">Soy</em> for what you are like and where you come from, '
                 '<em lang="es">estoy</em> for how you feel and where you are: '
                 '<em lang="es">Soy de Londres, pero estoy en Madrid.</em> Play, or practise with the drills.',
    },
    {
        'topic': 'es_tener', 'slug': 'tener', 'name': 'I have … (tener)', 'title': 'Tengo … (tener)',
        'short': 'age, things you have, hungry and cold', 'level': 'Beginners (A1)',
        'intro': 'Your age, what you have, and how hungry or cold you are: '
                 '<em lang="es">Tengo diez años. Tengo un perro. Tengo hambre.</em> '
                 'Play one of the games, or practise with the two quick drills.',
    },
]

# Games of the section: id → (German page to copy, served game path)
GAMES = {
    'verb-kitchen':    ('de/spiele/verb-kitchen/index.html', '/games/verb-kitchen/'),
    'verb-platformer': ('de/spiele/verb-platformer/index.html', '/games/verb-platformer/'),
    'verb-towers':     ('de/spiele/verb-towers/index.html', '/games/tower-defense/'),
}
GAME_TITLES = {
    'verb-kitchen': 'Verb Kitchen: Spanish cooking game',
    'verb-platformer': 'Verb Platformer: Spanish jump-and-run',
    'verb-towers': 'Verb Towers: Spanish tower defence',
}


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
  <meta property="og:locale" content="en_GB">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title} — Krabsy">
  <meta name="twitter:description" content="{desc}">
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


def common_body(s, hub, topic=None):
    s = sub(s, '<a class="k-logo" href="/de/"', f'<a class="k-logo" href="{hub}"')
    # Chip bar + topic nav are section-aware (/en/ → the Spanish topics and games);
    # the DE/ES language switch has no counterpart here.
    if topic:
        s = sub(s, "initDrillPage('sprint', 'prepositions',", f"initDrillPage('sprint', '{topic}',") \
            if "initDrillPage('sprint'" in s else s
        s = sub(s, "initDrillPage('fill_gap', 'prepositions',", f"initDrillPage('fill_gap', '{topic}',") \
            if "initDrillPage('fill_gap'" in s else s
    s = re.sub(r'\s*<script src="/lib/krabsy-lang-switch.js[^"]*" defer></script>', '', s)
    s = re.sub(r'/lib/krabsy-(footer|topic-nav)\.js\?v=[0-9-]+', lambda m: f'/lib/krabsy-{m.group(1)}.js?v={FOOTER_V}', s)
    s = re.sub(r"/lib/krabsy-nav\.js\?v=[0-9-]+", f"/lib/krabsy-nav.js?v={FOOTER_V}", s)
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
          <li><a href="/en/spanish/{t["slug"]}/">{t["title"]}: all games and drills</a></li>
          <li><a href="/en/spanish/">Krabsy Spanish: home</a></li>
        </ul>
      </section>'''


def build_sprint(t):
    src = (HOME / 'de/praepositionen/sprint/index.html').read_text()
    url = f'/en/spanish/{t["slug"]}/sprint/'
    title = f'Sprint: Spanish {t["name"]}'
    desc = f'20 Spanish sentences with a gap, as fast as you can: {t["short"]}. Free, no sign-up.'
    s = head(title, desc, url) + src[src.index('  <meta name="viewport"'):]
    s = common_body(s, '/en/spanish/', t['topic'])
    s = sub(s, '<h1 class="k-page-h1">Sprint: englische Präpositionen auf Zeit üben</h1>',
            f'<h1 class="k-page-h1">Sprint: Spanish {t["title"]}</h1>')
    s = intro(s, '20 Spanish sentences with a gap. Tap the right word as fast as you can; '
                 'a wrong answer adds 3 seconds. Stuck? The <b>?</b> button shows a small hint.')
    s = sub(s, 'data-string="common.loading">Lädt…', 'data-string="common.loading">Loading…')
    s = sub(s, '<span>Tipp</span>', '<span>Hint</span>')
    s = sub(s, '<span class="sprint-pattern-hint-label">Muster</span>',
            '<span class="sprint-pattern-hint-label">Pattern</span>')
    s = sub(s, 'aria-label="Antworten"', 'aria-label="Answers"')
    s = sub(s, '<a href="/de/praepositionen/" class="k-btn-secondary"', f'<a href="/en/spanish/{t["slug"]}/" class="k-btn-secondary"')
    s = sub(s, "const CURRENT_TOPIC = 'prepositions';", f"const CURRENT_TOPIC = '{t['topic']}';")
    s = sub(s, "const BEST_KEY = 'krabsy_best_sprint_prepositions';",
            f"const BEST_KEY = 'krabsy_best_sprint_{t['topic']}';")
    s = sub(s, "const HUB_URL = '/de/praepositionen/';", f"const HUB_URL = '/en/spanish/{t['slug']}/';")
    # Spanish topics are small: use every difficulty, not only level 2.
    s = sub(s, "          difficulty: 2,\n", '')
    s = sub(s, "loadingEl.textContent = 'Fehler beim Laden.';",
            "loadingEl.textContent = 'Could not load.';")
    s = sub(s, '    </main>', links_block(t, 'sprint/') + '\n    </main>')
    s = s.replace('</head>', remember_topic(t['topic']) + '</head>', 1)
    return url, s


def build_fill(t):
    src = (HOME / 'de/praepositionen/fill-the-gap/index.html').read_text()
    url = f'/en/spanish/{t["slug"]}/fill-the-gap/'
    title = f'Fill the Gap: Spanish {t["name"]}'
    desc = f'Type the missing Spanish word: {t["short"]}. Three lives. Free, no sign-up.'
    s = head(title, desc, url) + src[src.index('  <meta name="viewport"'):]
    s = common_body(s, '/en/spanish/', t['topic'])
    s = sub(s, '<h1 class="k-page-h1">Lückentext: englische Präpositionen richtig einsetzen</h1>',
            f'<h1 class="k-page-h1">Fill the Gap: Spanish {t["title"]}</h1>')
    s = intro(s, 'Spanish sentences with a gap. Type the missing word and press Enter. '
                 'You have three lives: a wrong answer costs one. You don\'t need to type accents '
                 '(ingles counts as inglés), but look at how it\'s spelled when the answer appears.')
    s = sub(s, 'src="/games/fill-the-gap.html?lang=de&topic=prepositions"',
            f'src="/games/fill-the-gap.html?lang=en&topic={t["topic"]}"')
    s = sub(s, 'title="Lückentext — Präpositionen"', f'title="Fill the Gap — Spanish {t["name"]}"')
    s = sub(s, '<!-- teacher practice link: pass ?difficulty= ?lang= on to the game frame -->',
            '<!-- teacher practice link: pass ?difficulty= ?lang= on to the game frame -->')
    s = re.sub(r'(<p class="fg-narrow-note">).*?(</p>)',
               r'\1Fill the Gap needs a wider screen. Open this page on a device at least 900&nbsp;px wide, in landscape.\2',
               s, count=1, flags=re.S)
    s = sub(s, '    </main>', links_block(t, 'fill-the-gap/') + '\n    </main>')
    s = s.replace('</head>', remember_topic(t['topic']) + '</head>', 1)
    return url, s


def style_of(path):
    """The first <style> block of a German page (layout lives there)."""
    src = (HOME / path).read_text()
    return src[src.index('  <style>'):src.index('</style>') + len('</style>')]


HEADER = '''    <header class="k-page-header">
      <a href="/en/spanish/" class="logo" aria-label="Krabsy">
        <span>kr</span>
        <span class="logo-crab" aria-hidden="true">
          <img src="/favicon.png" alt="" decoding="async">
        </span>
        <span>bsy</span>
      </a>
    </header>'''

FOOTER = f'''    <footer class="k-footer">
      <span id="footer-copyright">© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v={FOOTER_V}" defer></script>
  <script src="/lib/krabsy-topic-nav.js?v={FOOTER_V}" defer></script>
  <script src="/lib/krabsy-analytics.js?v=2026-11-22" defer></script>
</body>
</html>
'''


def build_topic_hub(t):
    """Topic hub on the prepositions hub's layout: hero, drills, games, article."""
    url = f'/en/spanish/{t["slug"]}/'
    title = f'Spanish: {t["title"]}'
    desc = f'Spanish games and drills for beginners: {t["short"]}. Free, no sign-up.'
    s = head(title, desc, url) + '''  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-23">
  <link rel="stylesheet" href="/lib/krabsy-article.css?v=2026-11-12">
''' + style_of('de/praepositionen/index.html') + f'''
</head>
<body>
  <div class="k-page">

{HEADER}

    <section class="hero">
      <div class="hero-banner">
        <img class="hero-banner-bg" src="/thumbnails/banner.png" alt="" loading="eager" decoding="async">
        <div class="hero-banner-text">
          <h1 class="hero-title">Spanish: {t["title"]}</h1>
          <p class="hero-sub">{t["level"]} · {t["short"]}</p>
        </div>
      </div>
    </section>

<section class="k-hub-intro">
  <p>{t["intro"]}</p>
</section>

    <section class="k-section bg-lavender" id="games-section">
      <h2 class="section-heading">Games</h2>
      <p class="section-sub">3D games that ask Spanish sentences.</p>
      <div class="card-grid-games card-grid" id="games-grid"></div>
    </section>

    <section class="k-section bg-sage">
      <h2 class="section-heading">Speed drills</h2>
      <p class="section-sub">Short challenges. Beat your best time.</p>
      <div class="card-grid" id="drills-grid">
        <a class="module-card drill-card" href="{url}sprint/"><div class="drill-card-thumb"><img src="/thumbnails/Sprint.png" alt="Sprint" loading="lazy"></div><div class="drill-card-body"><div class="module-card-title">Sprint</div><div class="module-card-tagline">20 sentences, as fast as you can.</div><span class="module-card-cta">Play →</span></div></a>
        <a class="module-card drill-card" href="{url}fill-the-gap/"><div class="drill-card-thumb"><img src="/thumbnails/FillGap.png" alt="Fill the Gap" loading="lazy"></div><div class="drill-card-body"><div class="module-card-title">Fill the Gap</div><div class="module-card-tagline">Type the missing word. Three lives.</div><span class="module-card-cta">Play →</span></div></a>
      </div>
    </section>

<section class="k-article" aria-labelledby="ka-title">
  <h2 id="ka-title">What you practise here</h2>
  <p>Every question is a short Spanish sentence with one gap. After a wrong answer you see the right sentence and a short rule in English, so you learn why, not only what. No grammar terms needed.</p>
  <h3>For teachers</h3>
  <p>Make a <a href="/en/spanish/teachers/#practice-link">practice link</a> with this topic, a game and a difficulty, or run a live <a href="/games/quiz-room/teacher.html?topic={t["topic"]}&amp;lang=en">Quiz Room</a> with your class or one pupil online. No accounts, first names only.</p>
  <ul class="k-article-links">
    <li><a href="{url}sprint/">Sprint</a>: 20 sentences against the clock.</li>
    <li><a href="{url}fill-the-gap/">Fill the Gap</a>: type the missing word.</li>
    <li><a href="/en/spanish/games/">All Spanish games</a></li>
  </ul>
</section>

{FOOTER}'''
    s = s.replace('</head>', remember_topic(t['topic']) + '</head>', 1)
    return url, s


def build_teachers():
    """Teacher page: practice link builder + Quiz Room (teacher-page styles of /de/lehrkraefte/)."""
    url = '/en/spanish/teachers/'
    s = head('Krabsy for Spanish teachers',
             'Free Spanish grammar games for your pupils: make a practice link with topic, game and difficulty, or run a live Quiz Room. No accounts.', url) + \
        f'''  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-23">
  <link rel="stylesheet" href="/lib/krabsy-teachers.css?v=2026-11-23">
  <link rel="stylesheet" href="/lib/krabsy-link-builder.css?v=2026-11-25">
</head>
<body>
  <div class="k-page">

{HEADER}

    <main>
      <section class="tc-sec">
        <div class="tc-wrap">
          <p class="tc-kicker">For teachers</p>
          <h1 class="tc-h2">Spanish practice your pupils actually want to do</h1>
          <p class="tc-sub">Free games and drills for Spanish grammar at beginner level. Send a practice link for homework or between lessons, or run a live Quiz Room in class or in an online lesson. No accounts, no names stored.</p>
        </div>
      </section>

      <section class="tc-sec tc-band" id="practice-link">
        <div class="tc-wrap">
          <p class="tc-kicker">Practice link</p>
          <h2 class="tc-h2">Make a practice link for your pupils</h2>
          <p class="tc-sub">Choose a topic, a game or drill, the difficulty and the language of the game's menus. Share the link in your learning platform, by message or as a QR code. It works for good, and nothing is saved.</p>
          <div id="link-builder" data-lang="en"></div>
        </div>
      </section>

      <section class="tc-sec" id="quiz-room">
        <div class="tc-wrap">
          <p class="tc-kicker">Live</p>
          <h2 class="tc-h2">The Quiz Room: live with your class or one pupil</h2>
          <p class="tc-sub">Every pupil walks through a 3D room as a little character and answers on their own screen. You choose the topic, see every question first (swap or remove any) and, at the end, the sentences to practise again. Works in class and over Zoom.</p>
          <div class="tc-ctas"><a class="tc-btn is-amber" href="/games/quiz-room/teacher.html?topic=es_ser&amp;lang=en">Open the Quiz Room</a></div>
        </div>
      </section>

      <section class="tc-sec tc-band" id="privacy">
        <div class="tc-wrap">
          <h2 class="tc-h2">Privacy</h2>
          <p class="tc-sub">No accounts, no e-mail addresses, no cookies. Progress stays in the pupil's browser. Details in the <a href="/en/privacy/">privacy policy</a>.</p>
        </div>
      </section>
    </main>

{FOOTER.replace('<script src="/lib/krabsy-footer.js', '<script type="module" src="/lib/krabsy-link-builder.js?v=2026-11-25"></script>\n  <script src="/lib/krabsy-footer.js', 1)}'''
    return url, s


def build_games_hub():
    url = '/en/spanish/games/'
    s = head('Spanish games', 'Free 3D games for learning Spanish: cook, jump and build towers with Spanish sentences.', url) + \
        '''  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-23">
''' + style_of('de/spiele/index.html') + f'''
</head>
<body>
  <div class="k-page">

{HEADER}

    <section class="gh-hero">
      <h1 class="gh-hero-title">Krabsy Spanish games</h1>
      <p class="gh-hero-sub">Every game here asks Spanish sentences. Play, and practise Spanish on the way.</p>
    </section>

    <section class="gh-section">
      <div class="games-grid" id="games-grid"></div>
    </section>

    <section class="gh-about">
      <h2>Learn Spanish with games</h2>
      <p>In <a href="/en/spanish/games/verb-kitchen/">Verb Kitchen</a> you wash dirty plates with Spanish sentences, in <a href="/en/spanish/games/verb-platformer/">Verb Platformer</a> you jump on the block with the right word, and in <a href="/en/spanish/games/verb-towers/">Verb Towers</a> right answers forge coins for your towers. All games are free in the browser, without download or sign-up.</p>
      <p>Prefer a quick drill? Try the <a href="/en/spanish/ser/sprint/">Sprint</a> or <a href="/en/spanish/ser/fill-the-gap/">Fill the Gap</a>.</p>
    </section>

{FOOTER}'''
    return url, s


TOPIC_KEY = 'krabsy_es_topic'
TOPIC_SCRIPT = f'''  <script>
    (function () {{
      var t = 'es_ser', ok = /^es_[a-z0-9_]{{1,36}}$/;
      try {{
        var q = new URLSearchParams(location.search).get('topic');
        var saved = localStorage.getItem('{TOPIC_KEY}');
        if (q && ok.test(q)) {{ t = q; localStorage.setItem('{TOPIC_KEY}', q); }}
        else if (saved && ok.test(saved)) t = saved;
      }} catch (_) {{}}
      var f = document.getElementById('game-frame');
      f.src = f.getAttribute('src').replace('topic=es_ser', 'topic=' + t);
      document.addEventListener('DOMContentLoaded', function () {{
        document.querySelectorAll('[data-es-topic]').forEach(function (a) {{
          if (a.getAttribute('data-es-topic') === t) a.setAttribute('aria-current', 'true');
        }});
      }});
    }})();
  </script>
'''


def remember_topic(topic):
    """Inline script for topic hubs and drills: games opened later play this topic."""
    return f"  <script>try{{localStorage.setItem('{TOPIC_KEY}','{topic}')}}catch(_){{}}</script>\n"


def build_game_page(gid):
    src_path, game_path = GAMES[gid]
    src = (HOME / src_path).read_text()
    url = f'/en/spanish/games/{gid}/'
    title = GAME_TITLES[gid]
    s = head(title, '(set by render_game_info.py)', url) + src[src.index('  <meta name="viewport"'):]
    s = re.sub(r'src="' + re.escape(game_path) + r'(\?lang=de)?"', f'src="{game_path}?lang=en&amp;topic=es_ser"', s, count=1)
    if '?lang=en&amp;topic=es_ser' not in s:
        sys.exit(f'{gid}: iframe src not found')
    s = re.sub(r'\s*<script src="/lib/krabsy-lang-switch.js[^"]*" defer></script>', '', s)
    s = re.sub(r"/lib/krabsy-nav\.js\?v=[0-9-]+", f"/lib/krabsy-nav.js?v={FOOTER_V}", s)
    # Topic: ?topic=es_… (topic pages, the topic bar below the game), else the last
    # Spanish topic chosen on a topic page or drill (localStorage), else es_ser.
    s = s.replace('  <!-- GAME-INFO:START', TOPIC_SCRIPT + '  <!-- GAME-INFO:START', 1)
    return url, s


def main():
    pages = [build_games_hub(), build_teachers()] + [build_game_page(g) for g in GAMES]
    for t in TOPICS:
        pages.append(build_topic_hub(t))
    for url, html in pages:
        out = HOME / url.strip('/') / 'index.html'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html)
        print('wrote', out.relative_to(ROOT))
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
