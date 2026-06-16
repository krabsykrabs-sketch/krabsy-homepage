#!/usr/bin/env python3
"""Generate per-verb reference pages (DE + ES) from content/irregular-verbs.json.

Output:
  homepage/de/unregelmaessige-verben/<slug>/index.html   (155 pages)
  homepage/es/verbos-irregulares/<slug>/index.html       (155 pages)
  homepage/de/unregelmaessige-verben/a-z/index.html      (A-Z index)
  homepage/es/verbos-irregulares/a-z/index.html          (A-Z index)
and rewrites sitemap.xml (idempotent: previous verb/a-z entries replaced).

Slugs are IDENTICAL across languages on purpose: the language toggle's
fallback translates the topic slug and keeps the page slug as-is
(lib/krabsy-lang-switch.js), so /de/unregelmaessige-verben/go/ <->
/es/verbos-irregulares/go/ works without registering 155 pages in
topics.json.

Run from repo root:  python3 tools/generate_verb_pages.py
"""
import json, re, hashlib, html, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
LASTMOD = "2026-06-12"
CSSV = "2026-05-24"

DE_TOPIC = "unregelmaessige-verben"
ES_TOPIC = "verbos-irregulares"

# ── aggregate the question items into one record per verb ──────────────────
items = json.loads((ROOT / "content" / "irregular-verbs.json").read_text(encoding="utf-8"))
verbs = {}
for it in items:
    v = verbs.setdefault(it["verb"], {"verb": it["verb"]})
    key = "past" if it["form"] == "past" else "pp"
    v[key] = it["correct_answer"]
    v[key + "_alts"] = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
    v[key + "_ctx"] = it.get("context_sentence", "")
    v[key + "_wrong"] = it.get("wrong_answers", [])[:2]
    v["meaning_de"] = it.get("meaning_de", "")
    v["meaning_es"] = it.get("meaning_es", "")
    v["tier"] = it.get("tier", 3)

VERBS = sorted(verbs.values(), key=lambda v: v["verb"])
for v in VERBS:
    v["slug"] = v["verb"].replace(" ", "-")
    base, past, pp = v["verb"], v["past"], v["pp"]
    if base == past == pp:   v["pattern"] = "AAA"
    elif past == pp:         v["pattern"] = "ABB"
    elif base == pp:         v["pattern"] = "ABA"
    else:                    v["pattern"] = "ABC"

PATTERN_TEXT = {
    "de": {
        "AAA": "A–A–A: alle drei Formen sind gleich.",
        "ABB": "A–B–B: Simple Past und Past Participle sind gleich.",
        "ABA": "A–B–A: das Past Participle ist gleich der Grundform.",
        "ABC": "A–B–C: alle drei Formen sind verschieden.",
    },
    "es": {
        "AAA": "A–A–A: las tres formas son iguales.",
        "ABB": "A–B–B: el pasado y el participio son iguales.",
        "ABA": "A–B–A: el participio es igual a la forma base.",
        "ABC": "A–B–C: las tres formas son diferentes.",
    },
}

def related(v, n=8):
    pool = [w for w in VERBS if w["pattern"] == v["pattern"] and w["slug"] != v["slug"]]
    pool.sort(key=lambda w: (abs(w["tier"] - v["tier"]), w["verb"]))
    return pool[:n]

def shuffled(options, seed):
    """Deterministic shuffle so rebuilds are reproducible."""
    return sorted(options, key=lambda o: hashlib.md5((seed + o).encode()).hexdigest())

def fill_ctx(ctx, form):
    if "___" in ctx:
        return ctx.replace("___", f"<strong>{html.escape(form)}</strong>", 1)
    return ""

E = html.escape

# ── DE title/meta (SEO-tuned, 2026-06; sourced from data, length-bounded) ────
# Title ≤60 chars: verb + key form(s) + "Simple Past & unregelmäßige Verben" +
# brand. Past participle shown only when it differs from the past. On a length
# breach: first drop "unregelmäßige Verben" (keep the higher-volume "Simple
# Past"), then drop "Simple Past" as a last resort. Meta ≤160: forms front-
# loaded, CTA tail shortened for long-meaning verbs so nothing truncates.
def _de_forms(v):
    return v["past"] if v["past"] == v["pp"] else f"{v['past']}, {v['pp']}"

def _de_title(v):
    f = _de_forms(v)
    t1 = f"{v['verb']} – {f}: Simple Past & unregelmäßige Verben | Krabsy"
    if len(t1) <= 60: return t1
    t2 = f"{v['verb']} – {f}: Simple Past | Krabsy"
    if len(t2) <= 60: return t2
    return f"{v['verb']} – {f} | Krabsy"

def _de_desc(v):
    base = (f"Unregelmäßiges Verb {v['verb']} ({v['meaning_de']}): "
            f"Simple Past „{v['past']}“, Past Participle „{v['pp']}“. ")
    full = base + "Alle Formen mit Beispielsätzen — kostenlos üben & spielen auf Krabsy."
    return full if len(full) <= 160 else base + "Kostenlos üben auf Krabsy."

# ── language pack ───────────────────────────────────────────────────────────
L = {
    "de": {
        "topic": DE_TOPIC, "other": "es", "other_topic": ES_TOPIC, "locale": "de_DE",
        "topic_name": "Unregelmäßige Verben", "hub": f"/de/{DE_TOPIC}/",
        "title": _de_title,
        "desc": _de_desc,
        "h1_sub": lambda v: f"Englisch <em>{E(v['verb'])}</em> = {E(v['meaning_de'])}",
        "th": ("Grundform", "Simple Past", "Past Participle"), "also": "auch möglich:",
        "ex_h": "Beispielsätze", "ex_past": "Simple Past", "ex_pp": "Past Participle",
        "quiz_h": "Mini-Quiz: kannst du es?", "quiz_past": lambda v: f"Was ist das Simple Past von <b>{E(v['verb'])}</b>?",
        "quiz_pp": lambda v: f"Was ist das Past Participle von <b>{E(v['verb'])}</b>?",
        "right": "Richtig! 🎉", "wrong_fb": "Leider nein — die richtige Antwort ist",
        "pattern_h": "Muster", "rel_h": "Verben mit demselben Muster",
        "faq_h": "Häufige Fragen",
        "faq1q": lambda v: f"Was ist das Simple Past von {v['verb']}?",
        "faq1a": lambda v: (f"Das Simple Past von {v['verb']} ist {v['past']}"
                            + (f" (auch möglich: {', '.join(v['past_alts'])})" if v["past_alts"] else "") + "."),
        "faq2q": lambda v: f"Was ist das Past Participle von {v['verb']}?",
        "faq2a": lambda v: (f"Das Past Participle von {v['verb']} ist {v['pp']}"
                            + (f" (auch möglich: {', '.join(v['pp_alts'])})" if v["pp_alts"] else "") + "."),
        "cta_h": "Jetzt üben", "cta_sub": "Festigen, was du gerade gelernt hast:",
        "cta": [("Sprint", "sprint"), ("Type Race", "type-race"), ("Karteikarten", "karteikarten"), ("Verb-Tabelle", "verb-tabelle")],
        "cta_games": ("Alle Spiele", "/de/spiele/"),
        "prev": "Vorheriges Verb", "next": "Nächstes Verb", "all": "Alle Verben A–Z",
        "crumb_all": "Alle Verben",
        "idx_title": "Alle unregelmäßigen Verben von A bis Z — Krabsy",
        "idx_desc": "Liste aller 155 wichtigen unregelmäßigen englischen Verben mit Simple Past und Past Participle — jede Form mit Beispielen und Mini-Quiz. Kostenlos.",
        "idx_h1": "Unregelmäßige Verben von A bis Z",
        "idx_sub": "155 Verben — tippe ein Verb für alle Formen, Beispielsätze und ein Mini-Quiz.",
        "footer_lang": "Sprache wählen",
    },
    "es": {
        "topic": ES_TOPIC, "other": "de", "other_topic": DE_TOPIC, "locale": "es_ES",
        "topic_name": "Verbos irregulares", "hub": f"/es/{ES_TOPIC}/",
        "title": lambda v: f"{v['verb']} – {v['past']} – {v['pp']}: pasado de {v['verb']} en inglés — Krabsy",
        "desc": lambda v: (f"Verbo irregular {v['verb']} ({v['meaning_es']}): pasado simple “{v['past']}”, "
                           f"participio “{v['pp']}”. Con frases de ejemplo y mini-quiz — gratis en Krabsy."),
        "h1_sub": lambda v: f"Inglés <em>{E(v['verb'])}</em> = {E(v['meaning_es'])}",
        "th": ("Forma base", "Pasado simple", "Participio"), "also": "también:",
        "ex_h": "Frases de ejemplo", "ex_past": "Pasado simple", "ex_pp": "Participio",
        "quiz_h": "Mini-quiz: ¿te lo sabes?", "quiz_past": lambda v: f"¿Cuál es el pasado simple de <b>{E(v['verb'])}</b>?",
        "quiz_pp": lambda v: f"¿Cuál es el participio de <b>{E(v['verb'])}</b>?",
        "right": "¡Correcto! 🎉", "wrong_fb": "No — la respuesta correcta es",
        "pattern_h": "Patrón", "rel_h": "Verbos con el mismo patrón",
        "faq_h": "Preguntas frecuentes",
        "faq1q": lambda v: f"¿Cuál es el pasado simple de {v['verb']}?",
        "faq1a": lambda v: (f"El pasado simple de {v['verb']} es {v['past']}"
                            + (f" (también: {', '.join(v['past_alts'])})" if v["past_alts"] else "") + "."),
        "faq2q": lambda v: f"¿Cuál es el participio de {v['verb']}?",
        "faq2a": lambda v: (f"El participio de {v['verb']} es {v['pp']}"
                            + (f" (también: {', '.join(v['pp_alts'])})" if v["pp_alts"] else "") + "."),
        "cta_h": "Practica ahora", "cta_sub": "Refuerza lo que acabas de aprender:",
        "cta": [("Sprint", "sprint"), ("Type Race", "type-race"), ("Tarjetas", "tarjetas"), ("Tabla de verbos", "tabla-de-verbos")],
        "cta_games": ("Todos los juegos", "/es/juegos/"),
        "prev": "Verbo anterior", "next": "Verbo siguiente", "all": "Todos los verbos A–Z",
        "crumb_all": "Todos los verbos",
        "idx_title": "Todos los verbos irregulares en inglés de la A a la Z — Krabsy",
        "idx_desc": "Lista de los 155 verbos irregulares más importantes del inglés con pasado simple y participio — cada verbo con ejemplos y mini-quiz. Gratis.",
        "idx_h1": "Verbos irregulares de la A a la Z",
        "idx_sub": "155 verbos — toca un verbo para ver todas sus formas, frases de ejemplo y un mini-quiz.",
        "footer_lang": "Elegir idioma",
    },
}

STYLE = """
    body { background: var(--krabsy-cream); }
    .logo{display:inline-flex;align-items:center;gap:0;font-family:var(--font-display);font-size:1.6rem;text-decoration:none;color:var(--krabsy-ink);letter-spacing:-0.5px;line-height:1}
    .logo-crab{display:inline-flex;width:1.15em;height:1.15em;align-items:center;justify-content:center;margin:0 -0.04em;vertical-align:middle}
    .logo-crab img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
    .vp-wrap{max-width:760px;margin:0 auto;padding:0 var(--space-5) var(--space-7);width:100%}
    .crumbs{font-size:0.82rem;color:var(--krabsy-ink-mute);padding:var(--space-4) 0 0}
    .crumbs a{color:inherit;text-decoration:none}
    .crumbs a:hover{text-decoration:underline}
    .vp-h1{font-family:var(--font-display);font-size:clamp(1.7rem,5.4vw,2.5rem);color:var(--krabsy-ink);margin:10px 0 4px;line-height:1.15}
    .vp-sub{color:var(--krabsy-ink-mute);font-size:1rem;margin-bottom:18px}
    .vp-card{background:#fff;border:1px solid rgba(31,43,61,0.08);border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 10px rgba(31,43,61,0.04)}
    .vp-card h2{font-family:var(--font-display);font-size:1.05rem;color:var(--krabsy-ink);margin-bottom:10px}
    table.vforms{width:100%;border-collapse:collapse;font-size:1.05rem}
    .vforms th{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);text-align:left;padding:4px 10px}
    .vforms td{padding:8px 10px;font-family:var(--font-display);font-size:1.25rem;border-radius:10px}
    .vforms .f-base{color:#b8860b}.vforms .f-past{color:#0d9c7c}.vforms .f-pp{color:#e05252}
    .valts{font-size:0.82rem;color:var(--krabsy-ink-mute);margin-top:6px}
    .vp-ex{margin:0;padding:0;list-style:none}
    .vp-ex li{padding:9px 12px;border-left:3px solid var(--krabsy-teal,#2ec4a0);background:#f6faf8;border-radius:0 10px 10px 0;margin-bottom:8px;font-size:0.98rem;color:var(--krabsy-ink)}
    .vp-ex li.pp{border-left-color:#e05252;background:#fdf4f2}
    .vp-ex .lbl{display:block;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);margin-bottom:2px}
    .quiz-q{margin-bottom:14px}
    .quiz-q p{font-size:0.98rem;color:var(--krabsy-ink);margin-bottom:8px}
    .quiz-opts{display:flex;gap:8px;flex-wrap:wrap}
    .quiz-btn{font-family:var(--font-display);font-size:1rem;padding:8px 20px;border-radius:30px;border:2px solid rgba(31,43,61,0.15);background:#fff;cursor:pointer;transition:transform .12s}
    .quiz-btn:hover{transform:translateY(-1px)}
    .quiz-btn.ok{background:#d9f4ec;border-color:#0d9c7c;color:#0d6e58}
    .quiz-btn.no{background:#fde3e3;border-color:#e05252;color:#a33}
    .quiz-fb{font-size:0.88rem;margin-top:6px;min-height:1.2em;font-weight:700}
    .quiz-fb.ok{color:#0d9c7c}.quiz-fb.no{color:#e05252}
    .vp-pattern{font-size:0.95rem;color:var(--krabsy-ink)}
    .rel-list{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
    .rel-list a{font-family:var(--font-display);font-size:0.9rem;color:var(--krabsy-ink);background:#fff;border:1.5px solid rgba(31,43,61,0.14);padding:5px 14px;border-radius:30px;text-decoration:none;transition:transform .12s}
    .rel-list a:hover{transform:translateY(-1px);border-color:var(--krabsy-teal,#2ec4a0)}
    .faq dt{font-weight:800;color:var(--krabsy-ink);margin-top:10px;font-size:0.95rem}
    .faq dd{color:var(--krabsy-ink-mute);font-size:0.93rem;margin:2px 0 0}
    .cta-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .cta-row a{font-family:var(--font-display);font-size:0.92rem;color:#fff;background:linear-gradient(135deg,#2ec4a0,#0d9c7c);padding:8px 18px;border-radius:30px;text-decoration:none;box-shadow:0 3px 10px rgba(0,196,154,0.25)}
    .cta-row a.alt{background:linear-gradient(135deg,#ff8a70,#e05252);box-shadow:0 3px 10px rgba(224,82,82,0.22)}
    .vp-nav{display:flex;justify-content:space-between;gap:10px;font-size:0.9rem;margin:18px 0 0}
    .vp-nav a{color:var(--krabsy-ink);text-decoration:none;font-weight:800}
    .vp-nav a:hover{text-decoration:underline}
    .az-letter{font-family:var(--font-display);font-size:1.3rem;color:var(--krabsy-ink);margin:18px 0 8px}
    .az-grid{display:flex;gap:8px;flex-wrap:wrap}
    .az-grid a{font-family:var(--font-display);font-size:0.95rem;color:var(--krabsy-ink);background:#fff;border:1.5px solid rgba(31,43,61,0.14);padding:6px 16px;border-radius:30px;text-decoration:none;transition:transform .12s}
    .az-grid a:hover{transform:translateY(-1px);border-color:var(--krabsy-teal,#2ec4a0)}
"""

QUIZ_JS = """
function vq(btn, ok, fbId, correct, okTxt, noTxt) {
  var box = btn.parentNode;
  var fb = document.getElementById(fbId);
  Array.prototype.forEach.call(box.children, function (b) { b.disabled = true; });
  if (ok) { btn.classList.add('ok'); fb.textContent = okTxt; fb.className = 'quiz-fb ok'; }
  else { btn.classList.add('no'); fb.textContent = noTxt + ' "' + correct + '".'; fb.className = 'quiz-fb no'; }
}
"""

def head(lang, t, title, desc, path, other_path):
    other = t["other"]
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","{lang}");}}catch(_){{}}</script>
  <title>{E(title)}</title>
  <meta name="description" content="{E(desc)}">
  <link rel="canonical" href="https://krabsy.com{path}">
  <link rel="alternate" hreflang="{lang}" href="https://krabsy.com{path}">
  <link rel="alternate" hreflang="{other}" href="https://krabsy.com{other_path}">
  <link rel="alternate" hreflang="x-default" href="https://krabsy.com{path if lang == 'de' else other_path}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
  <meta property="og:title" content="{E(title)}">
  <meta property="og:description" content="{E(desc)}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="https://krabsy.com{path}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="{t['locale']}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{E(title)}">
  <meta name="twitter:description" content="{E(desc)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v={CSSV}">
  <style>{STYLE}</style>
</head>"""

def chrome_open(lang, t):
    return f"""<body>
  <div class="k-page">
    <header class="k-page-header">
      <a href="/{lang}/" class="logo" aria-label="Krabsy">
        <span>kr</span>
        <span class="logo-crab" aria-hidden="true"><img src="/favicon.png" alt="" decoding="async"></span>
        <span>bsy</span>
      </a>
      <div class="k-lang-toggle" role="group" aria-label="{t['footer_lang']}">
        <button class="k-lang-btn{' is-active' if lang == 'de' else ''}" type="button" data-lang="de">DE</button>
        <button class="k-lang-btn{' is-active' if lang == 'es' else ''}" type="button" data-lang="es">ES</button>
      </div>
    </header>
    <div class="vp-wrap">"""

def chrome_close():
    return f"""    </div>
    <footer class="k-footer">
      <span id="footer-copyright">© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-topic-nav.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-lang-switch.js?v={CSSV}" defer></script>
  <script src="/lib/krabsy-analytics.js?v={CSSV}" defer></script>
</body>
</html>"""

def quiz_block(t, v, form_key, idx):
    correct = v[form_key]
    opts = shuffled([correct] + v[form_key + "_wrong"], v["verb"] + form_key)
    q = t["quiz_past"](v) if form_key == "past" else t["quiz_pp"](v)
    fb = f"qfb{idx}"
    btns = "".join(
        f"""<button class="quiz-btn" onclick="vq(this,{str(o == correct).lower()},'{fb}','{E(correct)}','{E(t['right'])}','{E(t['wrong_fb'])}')">{E(o)}</button>"""
        for o in opts)
    return f"""<div class="quiz-q"><p>{q}</p><div class="quiz-opts">{btns}</div><div class="quiz-fb" id="{fb}"></div></div>"""

def verb_page(lang, v, prev_v, next_v):
    t = L[lang]
    path = f"/{lang}/{t['topic']}/{v['slug']}/"
    other_path = f"/{t['other']}/{t['other_topic']}/{v['slug']}/"
    title, desc = t["title"](v), t["desc"](v)

    ex = []
    p_ex = fill_ctx(v.get("past_ctx", ""), v["past"])
    pp_ex = fill_ctx(v.get("pp_ctx", ""), v["pp"])
    if p_ex: ex.append(f'<li><span class="lbl">{t["ex_past"]}</span>{p_ex}</li>')
    if pp_ex: ex.append(f'<li class="pp"><span class="lbl">{t["ex_pp"]}</span>{pp_ex}</li>')
    ex_html = f"""<section class="vp-card"><h2>{t['ex_h']}</h2><ul class="vp-ex">{''.join(ex)}</ul></section>""" if ex else ""

    alts = []
    if v["past_alts"]: alts.append(f"Simple Past {t['also']} {E(', '.join(v['past_alts']))}")
    if v["pp_alts"]: alts.append(f"Past Participle {t['also']} {E(', '.join(v['pp_alts']))}")
    alts_html = f'<div class="valts">{" · ".join(alts)}</div>' if alts else ""

    rel = related(v)
    rel_html = "".join(f'<a href="/{lang}/{t["topic"]}/{w["slug"]}/">{E(w["verb"])}</a>' for w in rel)

    cta = "".join(f'<a href="{t["hub"]}{slug}/">{E(name)}</a>' for name, slug in t["cta"])
    cta += f'<a class="alt" href="{t["cta_games"][1]}">{E(t["cta_games"][0])} →</a>'

    nav = []
    nav.append(f'<a href="/{lang}/{t["topic"]}/{prev_v["slug"]}/">← {E(prev_v["verb"])}</a>' if prev_v else "<span></span>")
    nav.append(f'<a href="/{lang}/{t["topic"]}/a-z/">{t["all"]}</a>')
    nav.append(f'<a href="/{lang}/{t["topic"]}/{next_v["slug"]}/">{E(next_v["verb"])} →</a>' if next_v else "<span></span>")

    faq_ld = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": t["faq1q"](v),
             "acceptedAnswer": {"@type": "Answer", "text": t["faq1a"](v)}},
            {"@type": "Question", "name": t["faq2q"](v),
             "acceptedAnswer": {"@type": "Answer", "text": t["faq2a"](v)}},
        ],
    }
    crumb_ld = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": t["topic_name"], "item": f"https://krabsy.com{t['hub']}"},
            {"@type": "ListItem", "position": 2, "name": t["crumb_all"], "item": f"https://krabsy.com/{lang}/{t['topic']}/a-z/"},
            {"@type": "ListItem", "position": 3, "name": v["verb"], "item": f"https://krabsy.com{path}"},
        ],
    }

    return head(lang, t, title, desc, path, other_path) + chrome_open(lang, t) + f"""
      <nav class="crumbs"><a href="{t['hub']}">{t['topic_name']}</a> › <a href="/{lang}/{t['topic']}/a-z/">{t['crumb_all']}</a> › {E(v['verb'])}</nav>
      <h1 class="vp-h1">{E(v['verb'])} – {E(v['past'])} – {E(v['pp'])}</h1>
      <p class="vp-sub">{t['h1_sub'](v)}</p>

      <section class="vp-card">
        <table class="vforms">
          <tr><th>{t['th'][0]}</th><th>{t['th'][1]}</th><th>{t['th'][2]}</th></tr>
          <tr><td class="f-base">{E(v['verb'])}</td><td class="f-past">{E(v['past'])}</td><td class="f-pp">{E(v['pp'])}</td></tr>
        </table>
        {alts_html}
      </section>

      {ex_html}

      <section class="vp-card">
        <h2>{t['quiz_h']}</h2>
        {quiz_block(t, v, 'past', 1)}
        {quiz_block(t, v, 'pp', 2)}
      </section>

      <section class="vp-card">
        <h2>{t['pattern_h']}</h2>
        <p class="vp-pattern">{PATTERN_TEXT[lang][v['pattern']]}</p>
        <h2 style="margin-top:14px">{t['rel_h']}</h2>
        <div class="rel-list">{rel_html}</div>
      </section>

      <section class="vp-card faq">
        <h2>{t['faq_h']}</h2>
        <dl>
          <dt>{E(t['faq1q'](v))}</dt><dd>{E(t['faq1a'](v))}</dd>
          <dt>{E(t['faq2q'](v))}</dt><dd>{E(t['faq2a'](v))}</dd>
        </dl>
      </section>

      <section class="vp-card">
        <h2>{t['cta_h']}</h2>
        <p style="font-size:0.9rem;color:var(--krabsy-ink-mute)">{t['cta_sub']}</p>
        <div class="cta-row">{cta}</div>
      </section>

      <nav class="vp-nav">{''.join(nav)}</nav>
  <script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>
  <script type="application/ld+json">{json.dumps(crumb_ld, ensure_ascii=False)}</script>
  <script>{QUIZ_JS}</script>
""" + chrome_close()

def index_page(lang):
    t = L[lang]
    path = f"/{lang}/{t['topic']}/a-z/"
    other_path = f"/{t['other']}/{t['other_topic']}/a-z/"
    groups = {}
    for v in VERBS:
        groups.setdefault(v["verb"][0].upper(), []).append(v)
    body = ""
    for letter in sorted(groups):
        links = "".join(f'<a href="/{lang}/{t["topic"]}/{v["slug"]}/">{E(v["verb"])}</a>' for v in groups[letter])
        body += f'<div class="az-letter">{letter}</div><div class="az-grid">{links}</div>'
    return head(lang, t, t["idx_title"], t["idx_desc"], path, other_path) + chrome_open(lang, t) + f"""
      <nav class="crumbs"><a href="{t['hub']}">{t['topic_name']}</a> › {t['crumb_all']}</nav>
      <h1 class="vp-h1">{t['idx_h1']}</h1>
      <p class="vp-sub">{t['idx_sub']}</p>
      {body}
""" + chrome_close()

# ── write pages ──────────────────────────────────────────────────────────────
written = 0
for lang in ("de", "es"):
    t = L[lang]
    for i, v in enumerate(VERBS):
        prev_v = VERBS[i - 1] if i > 0 else None
        next_v = VERBS[i + 1] if i < len(VERBS) - 1 else None
        out = HP / lang / t["topic"] / v["slug"] / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(verb_page(lang, v, prev_v, next_v), encoding="utf-8")
        written += 1
    out = HP / lang / t["topic"] / "a-z" / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(index_page(lang), encoding="utf-8")
    written += 1
print(f"pages written: {written}")

# ── sitemap (idempotent) ─────────────────────────────────────────────────────
sm = HP / "sitemap.xml"
txt = sm.read_text(encoding="utf-8")
known_slugs = {v["slug"] for v in VERBS} | {"a-z"}
blocks = re.split(r"(?=  <url>)", txt)
kept = []
for b in blocks:
    loc = re.search(r"<loc>https://krabsy\.com/(de|es)/[^/]+/([^/<]+)/</loc>", b)
    if loc and loc.group(2) in known_slugs:
        continue  # regenerated below
    kept.append(b)
txt = "".join(kept)

entries = []
def url_entry(de_path, es_path, which):
    loc = de_path if which == "de" else es_path
    return f"""  <url>
    <loc>https://krabsy.com{loc}</loc>
    <lastmod>{LASTMOD}</lastmod>
    <changefreq>monthly</changefreq>
    <xhtml:link rel="alternate" hreflang="de"        href="https://krabsy.com{de_path}"/>
    <xhtml:link rel="alternate" hreflang="es"        href="https://krabsy.com{es_path}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://krabsy.com{de_path}"/>
  </url>
"""
for which in ("de", "es"):
    entries.append(url_entry(f"/de/{DE_TOPIC}/a-z/", f"/es/{ES_TOPIC}/a-z/", which))
for v in VERBS:
    for which in ("de", "es"):
        entries.append(url_entry(f"/de/{DE_TOPIC}/{v['slug']}/", f"/es/{ES_TOPIC}/{v['slug']}/", which))

txt = txt.replace("</urlset>", "".join(entries) + "</urlset>")
sm.write_text(txt, encoding="utf-8")
n_urls = txt.count("<loc>")
print(f"sitemap now has {n_urls} URLs")
