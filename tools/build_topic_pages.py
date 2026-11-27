#!/usr/bin/env python3
"""Build the pages of the English gap topics (format v2, content/FORMAT.md) in the
German and Spanish sections (/de/, /es/: English for German / Spanish speakers).

Per topic in TOPICS below and per interface language (de, es):

  /<ui>/<slug>/                topic hub: intro with examples, drills, games, class year,
                               a line for teachers (→ link builder)
  /<ui>/<slug>/sprint/         Sprint drill        ← <ui> prepositions Sprint page (skeleton)
  /<ui>/<slug>/fill-the-gap/   Fill the Gap drill  ← <ui> prepositions Fill the Gap page

Slugs, page slugs, names, class years ("years") and the review state come from
homepage/data/topics.json; the texts are in TOPICS below. A topic whose topics.json
entry has "status": "draft" (not yet checked by a native speaker) gets
<meta name="robots" content="noindex"> on all its pages, so generate_sitemap.py
leaves them out. To release a topic: delete its "status" field, re-run this script,
the render scripts below and generate_sitemap.py (check_catalogues.py fails while
pages and status disagree).

Afterwards run, in this order:
  python3 tools/render_static_games.py   (games grid on the hubs)
  python3 tools/render_game_info.py      (game pages list the section's topics)
  python3 tools/render_topics_page.py    (Themen / Temas page, grouped by class year)
  python3 tools/render_landing_intro.py  (landing line: topics.json in_sentence)
  python3 tools/generate_sitemap.py      (drafts stay out: noindex)

Run from the repo root:  python3 tools/build_topic_pages.py [--check]
"""
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import krabsy_registry as R  # noqa: E402

ROOT = R.ROOT
HOME = R.HOME
ORIGIN = 'https://krabsy.com'
UIS = ('de', 'es')
HEADER_V = '2026-11-27h'    # krabsy-footer.js, -lang-switch.js (site-wide bump)
UI_V = '2026-11-27-learn'   # krabsy-ui.css, -header.js (learning-language pill, 2026-11-27)
NAV_V = '2026-11-27p'       # krabsy-nav.js (drill chip bar)
LINK_BUILDER_ANCHOR = {'de': '/de/lehrkraefte/?topic={tid}#uebungslink',
                       'es': '/es/docentes/?topic={tid}#enlace-de-practica'}

# Texts per topic and interface language. intro = what it is + 2–3 example sentences
# (English in <em lang="en">); h1/title may use the grammar term (teachers search it),
# the questions themselves never do (presentation mandate).
TOPICS = {
    'en_simple_past': {
        'de': {
            'h1': 'Simple Past üben: was gestern passiert ist',
            'title': 'Simple Past üben – Übungen und Spiele',
            'short': 'erzählen, was schon vorbei ist',
            'intro': 'Mit dem Simple Past erzählst du, was schon vorbei ist: gestern, letzte Woche, vor zwei Tagen. '
                     'Viele Verben bekommen einfach <em lang="en">-ed</em>, andere haben eine eigene Form: '
                     '<em lang="en">I walked to school. We went to the beach. Did you see the match?</em>',
        },
        'es': {
            'h1': 'Past simple en inglés: lo que pasó ayer',
            'title': 'Past simple en inglés (pasado simple) – ejercicios y juegos',
            'short': 'contar lo que ya pasó',
            'intro': 'Con el past simple cuentas lo que ya pasó: ayer, la semana pasada, hace dos días. '
                     'Muchos verbos solo añaden <em lang="en">-ed</em>, otros tienen su propia forma: '
                     '<em lang="en">I walked to school. We went to the beach. Did you see the match?</em>',
        },
    },
    'en_present_simple': {
        'de': {
            'h1': 'Simple Present üben: he plays, does he play?',
            'title': 'Simple Present üben – Übungen und Spiele',
            'short': 'was jemand immer oder oft tut',
            'intro': 'Mit dem Simple Present sagst du, was jemand immer, oft oder nie tut. '
                     'Bei <em lang="en">he</em>, <em lang="en">she</em> und <em lang="en">it</em> kommt ein '
                     '<em lang="en">-s</em> dazu: <em lang="en">I play football. My sister plays the guitar. '
                     'Does your dad like pizza?</em>',
        },
        'es': {
            'h1': 'Present simple en inglés: he plays, does he play?',
            'title': 'Present simple en inglés (presente simple) – ejercicios y juegos',
            'short': 'lo que alguien hace siempre o a menudo',
            'intro': 'Con el present simple dices lo que alguien hace siempre, a menudo o nunca. '
                     'Con <em lang="en">he</em>, <em lang="en">she</em> e <em lang="en">it</em> se añade una '
                     '<em lang="en">-s</em>: <em lang="en">I play football. My sister plays the guitar. '
                     'Does your dad like pizza?</em>',
        },
    },
    'en_present_progressive': {
        'de': {
            'h1': 'Present Progressive üben: was gerade passiert',
            'title': 'Present Progressive üben – Übungen und Spiele',
            'short': 'was gerade jetzt passiert',
            'intro': 'Was passiert gerade jetzt? Dafür nimmst du <em lang="en">am / is / are</em> und ein Verb mit '
                     '<em lang="en">-ing</em>: <em lang="en">Look! The baby is sleeping. We are watching a film. '
                     'Are you listening?</em> Und du übst, wann es <em lang="en">he plays</em> heißt und wann '
                     '<em lang="en">he is playing</em>.',
        },
        'es': {
            'h1': 'Present continuous en inglés: lo que pasa ahora',
            'title': 'Present continuous en inglés (presente continuo) – ejercicios y juegos',
            'short': 'lo que está pasando ahora mismo',
            'intro': '¿Qué está pasando ahora mismo? Para eso usas <em lang="en">am / is / are</em> y un verbo con '
                     '<em lang="en">-ing</em>: <em lang="en">Look! The baby is sleeping. We are watching a film. '
                     'Are you listening?</em> Y practicas cuándo se dice <em lang="en">he plays</em> y cuándo '
                     '<em lang="en">he is playing</em>.',
        },
    },
    'en_present_perfect': {
        'de': {
            'h1': 'Present Perfect üben: I have seen',
            'title': 'Present Perfect üben – Übungen und Spiele',
            'short': 'was passiert ist und jetzt noch zählt',
            'intro': 'Mit dem Present Perfect sagst du, was du schon einmal (oder noch nie) gemacht hast, '
                     'oder was gerade passiert ist: <em lang="en">have / has</em> + 3. Form. '
                     '<em lang="en">I have never seen a snake. She has just finished her homework. '
                     'Have you ever ridden a horse?</em>',
        },
        'es': {
            'h1': 'Present perfect en inglés: I have seen',
            'title': 'Present perfect en inglés (presente perfecto) – ejercicios y juegos',
            'short': 'lo que ha pasado y todavía cuenta ahora',
            'intro': 'Con el present perfect dices lo que ya has hecho alguna vez (o nunca), '
                     'o lo que acaba de pasar: <em lang="en">have / has</em> + participio. '
                     '<em lang="en">I have never seen a snake. She has just finished her homework. '
                     'Have you ever ridden a horse?</em>',
        },
    },
}

# Interface texts. Kids read the hub and drills (du / tú); the teacher line speaks to
# teachers (Sie in German, as on /de/lehrkraefte/).
UI = {
    'de': {
        'locale': 'de_DE', 'home': 'Krabsy', 'topics': 'Themen',
        'skeleton': 'praepositionen', 'drill_fill': 'Lückentext',
        'drills_h': 'Speed-Drills', 'drills_sub': 'Kurze Challenges. Schlag deine Bestzeit.',
        'sprint_tag': '20 Sätze, so schnell wie möglich.', 'fill_tag': 'Tippe das fehlende Wort. Drei Leben.',
        'play': 'Los →',
        'games_h': 'Spiele', 'games_sub': 'Diese Spiele fragen Sätze zu diesem Thema.',
        'all_games': 'Alle Spiele ansehen →',
        'about_h': 'Was du hier übst',
        'about': 'Jede Frage ist ein kurzer englischer Satz mit einer Lücke. Fachwörter brauchst du dafür nicht. '
                 'Nach einer falschen Antwort siehst du den richtigen Satz und eine kurze Erklärung auf Deutsch.',
        'teach_h': 'Für Lehrkräfte',
        'year_line': 'Passt zu {year} (je nach Bundesland und Schulform).',
        'teach': 'Mit dem <a href="{lb}">Übungslink</a> schicken Sie Ihrer Klasse dieses Thema mit einem Spiel '
                 'oder einer Übung und einer Schwierigkeit – ohne Konto, ohne Anmeldung.',
        'draft': 'Neues Thema: Die Sätze werden gerade noch von einer englischen Muttersprachlerin bzw. einem '
                 'Muttersprachler geprüft.',
        'more_h': 'Mehr üben', 'all_topics': 'Alle Themen',
        'li_sprint': 'Sprint', 'li_sprint_d': 'das richtige Wort antippen, so schnell du kannst',
        'li_fill_d': 'das fehlende Wort selbst tippen, mit drei Leben',
        'li_hub': '{name}: alle Spiele und Übungen',
        'sprint_h1': 'Sprint: {short_name} üben',
        'sprint_intro': '20 englische Sätze mit einer Lücke. Tippe so schnell wie möglich das richtige Wort an; '
                        'ein Fehler kostet 3 Sekunden. Kommst du nicht weiter? Der Knopf <b>Tipp</b> zeigt dir '
                        'ein kleines Muster.',
        'sprint_desc': '20 englische Lückensätze zum {short_name}, so schnell wie möglich: {short}. '
                       'Kostenlos, ohne Anmeldung.',
        'fill_h1': 'Lückentext: {short_name} üben',
        'fill_intro': 'Englische Sätze mit einer Lücke. Tippe das fehlende Wort und drücke Enter. '
                      'Du hast drei Leben: Jede falsche Antwort kostet eines.',
        'fill_desc': 'Lückentext zum {short_name}: Tippe das fehlende englische Wort. Drei Leben. '
                     'Kostenlos, ohne Anmeldung.',
        'hub_desc': '{short_name} üben mit Lückensätzen, Speed-Drills und Spielen: {short}. Für {year}. '
                    'Kostenlos, ohne Anmeldung.',
        'error': 'Fehler beim Laden.',
    },
    'es': {
        'locale': 'es_ES', 'home': 'Krabsy', 'topics': 'Temas',
        'skeleton': 'preposiciones', 'drill_fill': 'Rellena el hueco',
        'drills_h': 'Speed Drills', 'drills_sub': 'Retos cortos. Supera tu mejor tiempo.',
        'sprint_tag': '20 frases, lo más rápido posible.', 'fill_tag': 'Escribe la palabra que falta. Tres vidas.',
        'play': 'Jugar →',
        'games_h': 'Juegos', 'games_sub': 'Estos juegos preguntan frases de este tema.',
        'all_games': 'Ver todos los juegos →',
        'about_h': 'Qué practicas aquí',
        'about': 'Cada pregunta es una frase corta en inglés con un hueco. No necesitas términos gramaticales. '
                 'Después de una respuesta incorrecta ves la frase correcta y una explicación corta en español.',
        'teach_h': 'Para docentes',
        'year_line': 'Encaja en {year} (según la comunidad y el libro de texto).',
        'teach': 'Con el <a href="{lb}">enlace de práctica</a> envías a tu clase este tema con un juego o un '
                 'ejercicio y una dificultad, sin cuentas ni registro.',
        'draft': 'Tema nuevo: una persona nativa de inglés todavía está revisando las frases.',
        'more_h': 'Más práctica', 'all_topics': 'Todos los temas',
        'li_sprint': 'Sprint', 'li_sprint_d': 'toca la palabra correcta lo más rápido que puedas',
        'li_fill_d': 'escribe tú la palabra que falta, con tres vidas',
        'li_hub': '{name}: todos los juegos y ejercicios',
        'sprint_h1': 'Sprint: practica el {short_name}',
        'sprint_intro': '20 frases en inglés con un hueco. Toca la palabra correcta lo más rápido que puedas; '
                        'cada fallo suma 3 segundos. ¿Te atascas? El botón <b>Pista</b> te muestra un pequeño patrón.',
        'sprint_desc': '20 frases en inglés con hueco para practicar el {short_name}, lo más rápido posible: '
                       '{short}. Gratis, sin registro.',
        'fill_h1': 'Rellena el hueco: practica el {short_name}',
        'fill_intro': 'Frases en inglés con un hueco. Escribe la palabra que falta y pulsa Enter. '
                      'Tienes tres vidas: cada respuesta incorrecta cuesta una.',
        'fill_desc': 'Rellena el hueco con el {short_name}: escribe la palabra que falta en inglés. Tres vidas. '
                     'Gratis, sin registro.',
        'hub_desc': 'Ejercicios de {short_name} en inglés: frases con hueco, speed drills y juegos ({short}). '
                    'Para {year}. Gratis, sin registro.',
        'error': 'Error al cargar.',
    },
}


def esc(s):
    return html.escape(str(s or ''), quote=True)


def sub(text, pattern, repl, count=1, flags=0):
    """Regex replace exactly `count` matches or fail loudly (the skeleton changed)."""
    n = len(re.findall(pattern, text, flags))
    if n != count:
        sys.exit(f'template changed: expected {count}x {pattern[:70]!r}, found {n}')
    return re.sub(pattern, lambda m: repl, text, flags=flags)


def section(ui):
    return R.section(ui)


def urls(tid, ui):
    sec = section(ui)
    return {'hub': R.topic_url(tid, sec), 'sprint': R.topic_url(tid, sec, 'sprint'),
            'fill': R.topic_url(tid, sec, 'fill-the-gap')}


def names(tid, ui):
    """(display name, short name in running text). Spanish writes the English
    tense names in lower case inside a sentence ("practica el past simple")."""
    t = R.topics()[tid]
    short = t['short_name'][ui]
    if ui == 'es':
        short = short[0].lower() + short[1:]
    return t['display_name'][ui], short


def head(tid, ui, page, title, desc, crumbs, resource=None):
    """<head> up to (not including) the viewport meta of the skeleton."""
    S = UI[ui]
    url = urls(tid, ui)[page]
    alts = ''.join(f'  <link rel="alternate" hreflang="{u}" href="{ORIGIN}{urls(tid, u)[page]}">\n' for u in UIS)
    alts += f'  <link rel="alternate" hreflang="x-default" href="{ORIGIN}{urls(tid, "de")[page]}">\n'
    robots = ('  <!-- status "draft" in topics.json: not checked by a native speaker yet (tools/build_topic_pages.py) -->\n'
              '  <meta name="robots" content="noindex">\n') if R.is_draft(tid) else ''
    ld = [{'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': ORIGIN + u} for i, (n, u) in enumerate(crumbs)]}]
    if resource:
        ld.append({'@context': 'https://schema.org', '@type': 'LearningResource', 'name': resource,
                   'url': ORIGIN + url, 'description': desc, 'learningResourceType': 'Game' if page != 'hub' else 'Exercise',
                   'interactivityType': 'active', 'educationalLevel': R.year_label(tid, ui) or '',
                   'inLanguage': ui, 'audience': {'@type': 'EducationalAudience', 'educationalRole': 'student'},
                   'isPartOf': {'@type': 'WebSite', 'name': 'Krabsy', 'url': ORIGIN + '/'}})
    ld_html = ''.join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>\n' for x in ld)
    full = f'{title} — Krabsy'
    return f'''<!doctype html>
<!-- GENERATED by tools/build_topic_pages.py from data/topics.json. Do not edit; re-run the tool. -->
<html lang="{ui}">
<head>
  <meta charset="utf-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","{ui}");}}catch(_){{}}</script>
  <title>{esc(full)}</title>
  <meta name="description" content="{esc(desc)}">
{robots}  <link rel="canonical" href="{ORIGIN}{url}">
{alts}  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2026-11-27">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=2026-11-27">
  <meta property="og:title" content="{esc(full)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="{ORIGIN}{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="{S['locale']}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(full)}">
  <meta name="twitter:description" content="{esc(desc)}">
{ld_html}'''


def crumbs(tid, ui, last=None):
    sec = section(ui)
    name, _ = names(tid, ui)
    out = [('Krabsy', sec['home']), (UI[ui]['topics'], sec['topics']), (name, urls(tid, ui)['hub'])]
    if last:
        out.append(last)
    return out


def links_block(tid, ui, here):
    S = UI[ui]
    u = urls(tid, ui)
    name, _ = names(tid, ui)
    items = [('sprint', S['li_sprint'], S['li_sprint_d']), ('fill', S['drill_fill'], S['li_fill_d'])]
    lis = ''.join(f'\n          <li><a href="{u[k]}">{n}</a>: {d}.</li>' for k, n, d in items if k != here)
    return f'''
      <section class="k-article" aria-label="{S['more_h']}">
        <h2>{S['more_h']}</h2>
        <ul class="k-article-links">{lis}
          <li><a href="{u['hub']}">{esc(S['li_hub'].format(name=name))}</a></li>
          <li><a href="{section(ui)['topics']}">{S['all_topics']}</a></li>
        </ul>
      </section>'''


def body_from(src):
    return src[src.index('  <meta name="viewport"'):]


def common(s, tid, ui, drill_key):
    """Shared swaps of both drill skeletons."""
    skel_topic = 'prepositions'
    s = sub(s, re.escape(f"initDrillPage('{drill_key}', '{skel_topic}',"), f"initDrillPage('{drill_key}', '{tid}',")
    s = sub(s, r'\n<!-- seo-article:start.*?<!-- seo-article:end -->', '', flags=re.S)
    s = re.sub(r'/lib/krabsy-(ui\.css|footer\.js|header\.js|lang-switch\.js)\?v=[0-9a-z-]+',
               lambda m: f'/lib/krabsy-{m.group(1)}?v={UI_V if m.group(1) in ("ui.css", "header.js") else HEADER_V}', s)
    s = re.sub(r'/lib/krabsy-nav\.js\?v=[0-9a-z-]+', f'/lib/krabsy-nav.js?v={NAV_V}', s)
    return s


def intro_card(s, text):
    return re.sub(r'(<aside class="k-intro-card" aria-label="[^"]*">\s*<p>).*?(</p>)',
                  lambda m: m.group(1) + text + m.group(2), s, count=1, flags=re.S)


def build_sprint(tid, ui):
    S = UI[ui]
    name, short_name = names(tid, ui)
    u = urls(tid, ui)
    src = (HOME / ui / S['skeleton'] / 'sprint' / 'index.html').read_text(encoding='utf-8')
    title = S['sprint_h1'].format(short_name=short_name)
    desc = S['sprint_desc'].format(short_name=short_name, short=TOPICS[tid][ui]['short'])
    s = head(tid, ui, 'sprint', title, desc, crumbs(tid, ui, ('Sprint', u['sprint'])), f'Sprint — {short_name}') + body_from(src)
    s = common(s, tid, ui, 'sprint')
    s = sub(s, r'<h1 class="k-page-h1">[^<]*</h1>', f'<h1 class="k-page-h1">{esc(title)}</h1>')
    s = intro_card(s, S['sprint_intro'])
    s = sub(s, r'<a href="/' + ui + r'/[a-z-]+/" class="k-btn-secondary"', f'<a href="{u["hub"]}" class="k-btn-secondary"')
    s = sub(s, re.escape("const CURRENT_TOPIC = 'prepositions';"), f"const CURRENT_TOPIC = '{tid}';")
    s = sub(s, re.escape("const BEST_KEY = 'krabsy_best_sprint_prepositions';"), f"const BEST_KEY = 'krabsy_best_sprint_{tid}';")
    s = sub(s, r"const HUB_URL = '[^']*';", f"const HUB_URL = '{u['hub']}';")
    # Gap topics use every difficulty (prepositions' Sprint asks only level 2).
    s = sub(s, r"\n          difficulty: 2,", '')
    s = sub(s, r'\n      </section>\n    </main>', '\n      </section>' + links_block(tid, ui, 'sprint') + '\n    </main>')
    return u['sprint'], s


def build_fill(tid, ui):
    S = UI[ui]
    name, short_name = names(tid, ui)
    u = urls(tid, ui)
    src = (HOME / ui / S['skeleton'] / 'fill-the-gap' / 'index.html').read_text(encoding='utf-8')
    title = S['fill_h1'].format(short_name=short_name)
    desc = S['fill_desc'].format(short_name=short_name)
    s = head(tid, ui, 'fill', title, desc, crumbs(tid, ui, (S['drill_fill'], u['fill'])),
             f'{S["drill_fill"]} — {short_name}') + body_from(src)
    s = common(s, tid, ui, 'fill_gap')
    s = sub(s, r'<h1 class="k-page-h1">[^<]*</h1>', f'<h1 class="k-page-h1">{esc(title)}</h1>')
    s = intro_card(s, S['fill_intro'])
    s = sub(s, re.escape(f'src="/games/fill-the-gap.html?lang={ui}&topic=prepositions"'),
            f'src="/games/fill-the-gap.html?lang={ui}&amp;topic={tid}"')
    s = sub(s, r'title="[^"]*"\n(\s*)loading="eager"', f'title="{esc(S["drill_fill"] + " — " + short_name)}"\n        loading="eager"')
    s = sub(s, r'</script>\n    </main>', '</script>' + links_block(tid, ui, 'fill') + '\n    </main>')
    return u['fill'], s


def style_of(path):
    """The first <style> block of a page (the hub layout lives there)."""
    src = (HOME / path).read_text(encoding='utf-8')
    return src[src.index('  <style>'):src.index('</style>') + len('</style>')]


def build_hub(tid, ui):
    S = UI[ui]
    T = TOPICS[tid][ui]
    sec = section(ui)
    name, short_name = names(tid, ui)
    u = urls(tid, ui)
    year = R.year_label(tid, ui) or ''
    desc = S['hub_desc'].format(short_name=short_name, short=T['short'], year=year)
    lb = LINK_BUILDER_ANCHOR[ui].format(tid=tid)
    draft = f'\n  <p class="tp-draft">{S["draft"]}</p>' if R.is_draft(tid) else ''
    s = head(tid, ui, 'hub', T['title'], desc, crumbs(tid, ui), T['h1']) + f'''  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v={UI_V}">
  <link rel="stylesheet" href="/lib/krabsy-article.css?v=2026-11-12">
{style_of(f"{ui}/{S['skeleton']}/index.html")}
  <style>
    .hero-sub b {{ font-weight: 800; }}
    .tp-draft {{ font-size: 0.9rem; color: var(--krabsy-ink-mute); }}
  </style>
</head>
<body>
  <div class="k-page">
    <header class="k-page-header">
      <a class="k-logo" href="{sec['home']}" aria-label="Krabsy"><span>kr</span><span class="k-logo-crab" aria-hidden="true"><img src="/favicon.png?v=2026-11-27" alt="" decoding="async"></span><span>bsy</span></a>
    </header>

    <section class="hero">
      <div class="hero-banner">
        <img class="hero-banner-bg" src="/thumbnails/banner.png" alt="" loading="eager" decoding="async">
        <div class="hero-banner-text">
          <h1 class="hero-title">{esc(T['h1'])}</h1>
          <p class="hero-sub"><b>{esc(year)}</b> · {esc(T['short'])}</p>
        </div>
      </div>
    </section>

    <section class="k-hub-intro">
      <p>{T['intro']}</p>
    </section>

    <section class="k-section bg-sage">
      <h2 class="section-heading">{S['drills_h']}</h2>
      <p class="section-sub">{S['drills_sub']}</p>
      <div class="card-grid" id="drills-grid">
        <a class="module-card drill-card" href="{u['sprint']}"><div class="drill-card-thumb"><img src="/thumbnails/Sprint.png" alt="" loading="lazy"></div><div class="drill-card-body"><div class="module-card-title">Sprint</div><div class="module-card-tagline">{S['sprint_tag']}</div><span class="module-card-cta">{S['play']}</span></div></a>
        <a class="module-card drill-card" href="{u['fill']}"><div class="drill-card-thumb"><img src="/thumbnails/FillGap.png" alt="" loading="lazy"></div><div class="drill-card-body"><div class="module-card-title">{S['drill_fill']}</div><div class="module-card-tagline">{S['fill_tag']}</div><span class="module-card-cta">{S['play']}</span></div></a>
      </div>
    </section>

    <section class="k-section bg-lavender" id="games-section">
      <h2 class="section-heading">{S['games_h']}</h2>
      <p class="section-sub">{S['games_sub']}</p>
      <div class="card-grid-games card-grid" id="games-grid"></div>
      <p class="games-all-link-row">
        <a class="games-all-link" href="{sec['games']}">{S['all_games']}</a>
      </p>
    </section>

<section class="k-article" aria-labelledby="ka-title">
  <h2 id="ka-title">{S['about_h']}</h2>
  <p>{S['about']}</p>
  <h3>{S['teach_h']}</h3>
  <p>{S['year_line'].format(year=f'<strong>{esc(year)}</strong>')} {S['teach'].format(lb=lb)}</p>{draft}
  <ul class="k-article-links">
    <li><a href="{u['sprint']}">{S['li_sprint']}</a>: {S['li_sprint_d']}.</li>
    <li><a href="{u['fill']}">{S['drill_fill']}</a>: {S['li_fill_d']}.</li>
    <li><a href="{sec['topics']}">{S['all_topics']}</a></li>
  </ul>
</section>

    <footer class="k-footer">
      <span>© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v={HEADER_V}" defer></script>
  <script type="module" src="/lib/krabsy-header.js?v={UI_V}"></script>
  <script src="/lib/krabsy-lang-switch.js?v={HEADER_V}" defer></script>
  <script src="/lib/krabsy-analytics.js?v=2026-11-22" defer></script>
</body>
</html>
'''
    return u['hub'], s


LEFTOVERS = {'de': ('Präposition', 'in/on/at'), 'es': ('reposici', 'in/on/at')}


def pages():
    out = []
    for tid in TOPICS:
        t = R.topics().get(tid)
        if not t:
            sys.exit(f'{tid}: not in topics.json')
        for ui in UIS:
            if not t.get(ui):
                sys.exit(f'{tid}: no {ui} slug in topics.json')
            for build in (build_hub, build_sprint, build_fill):
                url, html_ = build(tid, ui)
                visible = re.sub(r'<(style|script)\b.*?</\1>', '', html_, flags=re.S)
                bad = [w for w in LEFTOVERS[ui] if w in visible]
                if bad:
                    sys.exit(f'{url}: preposition leftovers {bad}')
                out.append((url, html_))
    return out


GRID_RE = re.compile(r'<div class="card-grid-games card-grid" id="games-grid">.*?</div>(?=\n      <p class="games-all-link-row">)', re.S)


def main():
    check = '--check' in sys.argv
    stale = 0
    for url, text in pages():
        path = HOME / R.page_path(url)
        old = path.read_text(encoding='utf-8') if path.exists() else None
        if old is not None:
            # keep the games grid that render_static_games.py filled in
            m = GRID_RE.search(old)
            if m:
                text = GRID_RE.sub(lambda _: m.group(0), text, count=1)
        if old == text:
            continue
        if check:
            print(f'out of date: {path.relative_to(ROOT)}')
            stale += 1
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        print(f'wrote {path.relative_to(ROOT)}')
    if check and stale:
        sys.exit(1)


if __name__ == '__main__':
    main()
