#!/usr/bin/env python3
"""Render the SEO blocks of the two irregular-verb hub pages from
content/irregular-verbs.json:

  1. hub-verb-table   full static table of all verbs (base / past / participle /
                      meaning), with search filter and print button, right
                      under the hero (after <!-- seo-lead:end -->)
  2. hub-verb-patterns "verbs by pattern" section inside the SEO article
  3. hub-verb-faq     visible FAQ + FAQPage JSON-LD (after <!-- seo-article:end -->)

Pages:
  homepage/de/unregelmaessige-verben/index.html
  homepage/es/verbos-irregulares/index.html

Idempotent: each block lives between <!-- NAME:start --> / <!-- NAME:end -->
markers; on the first run the markers are inserted at fixed anchors.
Rerun whenever the verb catalogue changes (together with
tools/generate_verb_pages.py).

Run from repo root:  python3 tools/render_hub_verb_table.py
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
E = lambda s: html.escape(str(s), quote=True)

# ── one record per verb (same aggregation as generate_verb_pages.py) ─────────
items = json.loads((ROOT / "content" / "irregular-verbs.json").read_text(encoding="utf-8"))
verbs = {}
for it in items:
    v = verbs.setdefault(it["verb"], {"verb": it["verb"]})
    key = "past" if it["form"] == "past" else "pp"
    v[key] = it["correct_answer"]
    v[key + "_alts"] = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
    v["de"] = it.get("meaning_de", "")
    v["es"] = it.get("meaning_es", "")
    v["tier"] = it.get("tier", 3)
VERBS = sorted(verbs.values(), key=lambda v: v["verb"])
for v in VERBS:
    v["slug"] = v["verb"].replace(" ", "-")
    b, p, q = v["verb"], v["past"], v["pp"]
    v["pattern"] = ("AAA" if b == p == q else "ABB" if p == q else "ABA" if b == q
                    else "AAB" if b == p else "ABC")
N = len(VERBS)
TOP = [v for v in VERBS if v["tier"] == 1]
BY_PAT = {k: [v for v in VERBS if v["pattern"] == k] for k in ("AAA", "ABB", "ABA", "AAB", "ABC")}


def forms(v, key):
    return " / ".join([v[key]] + v[key + "_alts"])


def chain(v):
    return f"{v['verb']} – {v['past']} – {v['pp']}"


# ── per-language copy ────────────────────────────────────────────────────────
L = {
    "de": {
        "file": HP / "de" / "unregelmaessige-verben" / "index.html",
        "base": "/de/unregelmaessige-verben/",
        "meaning": "de",
        "title": f"Unregelmäßige Verben Englisch: Liste & Tabelle ({N} Verben) — Krabsy",
        "desc": (f"Liste aller {N} unregelmäßigen Verben im Englischen mit deutscher Bedeutung, "
                 "zum Ausdrucken. Dazu Übungen und Spiele. Kostenlos, ohne Anmeldung."),
        "h1": "Unregelmäßige Verben Englisch: Liste mit Übungen",
        "table_h": "Liste der unregelmäßigen Verben",
        "table_sub": (f"Alle {N} Verben mit Grundform, Simple Past, Past Participle und deutscher "
                      "Bedeutung. Tippe auf ein Verb für Beispielsätze und ein Mini-Quiz."),
        "th": ["Grundform", "Simple Past", "Past Participle", "Deutsch"],
        "search": "Verb suchen …",
        "print": "Liste drucken",
        "none": "Kein Verb gefunden.",
        "table_foot": ('<a href="#muster">Verben nach Mustern</a> · '
                       '<a href="/de/unregelmaessige-verben/a-z/">Jedes Verb mit eigener Seite (A bis Z)</a> · '
                       '<a href="/de/unregelmaessige-verben/arbeitsblaetter/">Arbeitsblätter (PDF)</a> · '
                       '<a href="/de/unregelmaessige-verben/sprint/">Gleich üben im Sprint →</a>'),
        "pat_anchor": "<h3>Dein Lernweg in vier Schritten</h3>",
        "pat_h": "Unregelmäßige Verben nach Mustern",
        "pat_intro": ("Fast alle unregelmäßigen Verben folgen einem von vier Mustern. "
                      "Wer die Muster kennt, muss viel weniger auswendig lernen:"),
        "pat_names": {
            "AAA": "Alle drei Formen gleich",
            "ABB": "Simple Past und Past Participle gleich",
            "ABA": "Grundform und Past Participle gleich",
            "ABC": "Alle drei Formen verschieden",
        },
        "pat_count": lambda n: f"{n} Verben",
        "pat_beat": lambda v: (f"Eine Ausnahme passt in keine Gruppe: <a href=\"/de/unregelmaessige-verben/{v['slug']}/\">"
                               f"<em lang=\"en\">{E(chain(v))}</em></a>."),
        "faq_h": "Häufige Fragen zu unregelmäßigen Verben",
        "faq": [
            ("Wie viele unregelmäßige Verben gibt es im Englischen?",
             f"Je nach Zählweise rund 200, dazu kommen seltene Verben und Zusammensetzungen wie "
             f"<em lang=\"en\">understand</em> oder <em lang=\"en\">overcome</em>. Krabsy enthält {N} Verben, "
             f"von sehr häufig bis selten. Für den Anfang reichen die {len(TOP)} häufigsten: Sie sind in der "
             f"<a href=\"/de/unregelmaessige-verben/a-z/\">Liste von A bis Z</a> oben zusammengestellt."),
            ("Welche unregelmäßigen Verben sollte ich zuerst lernen?",
             "Die häufigsten: <em lang=\"en\">be, have, do, say, go, get, make, know, think, take, see, come</em>. "
             "Sie stecken in fast jedem Satz über die Vergangenheit. Danach lohnt es sich, nach Mustern zu lernen "
             "(siehe oben), zum Beispiel alle Verben, bei denen sich nichts ändert."),
            ("Heißt es learned oder learnt?",
             "Beides ist richtig. <em lang=\"en\">learnt</em> ist im britischen Englisch verbreitet, "
             "<em lang=\"en\">learned</em> im amerikanischen und inzwischen auch in Großbritannien häufig. "
             "Genauso ist es bei <em lang=\"en\">burnt/burned</em> oder <em lang=\"en\">dreamt/dreamed</em>. "
             "In der Liste stehen beide Formen, und die Übungen auf Krabsy akzeptieren beide."),
            ("Was ist der Unterschied zwischen Simple Past und Past Participle?",
             "Das Simple Past steht allein: <em lang=\"en\">I went home.</em> Das Past Participle braucht ein "
             "Hilfsverb, zum Beispiel im Present Perfect (<em lang=\"en\">I have gone</em>) oder im Passiv "
             "(<em lang=\"en\">The letter was written</em>). Bei vielen Verben sind beide Formen gleich "
             "(<em lang=\"en\">bought – bought</em>), bei anderen nicht (<em lang=\"en\">went – gone</em>)."),
            ("Kann ich die Liste ausdrucken?",
             f"Ja. Tippe oben bei der Liste auf „Liste drucken“. Gedruckt wird nur die Tabelle mit allen {N} "
             "Verben, ohne Menüs und Spiele. Im Druckdialog kannst du sie auch als PDF speichern."),
        ],
    },
    "es": {
        "file": HP / "es" / "verbos-irregulares" / "index.html",
        "base": "/es/verbos-irregulares/",
        "meaning": "es",
        "title": f"Lista de verbos irregulares en inglés ({N} verbos) — Krabsy",
        "desc": (f"Lista de los {N} verbos irregulares en inglés con su significado en español, "
                 "para imprimir. Además, ejercicios y juegos. Gratis y sin registro."),
        "h1": "Verbos irregulares en inglés: lista y ejercicios",
        "table_h": "Lista de verbos irregulares en inglés",
        "table_sub": (f"Los {N} verbos con infinitivo, Simple Past (pasado), Past Participle (participio) "
                      "y significado en español. Toca un verbo para ver ejemplos y un mini-quiz."),
        "th": ["Infinitivo", "Simple Past", "Past Participle", "Español"],
        "search": "Buscar verbo …",
        "print": "Imprimir lista",
        "none": "No se encontró ningún verbo.",
        "table_foot": ('<a href="#muster">Tipos de verbos irregulares</a> · '
                       '<a href="/es/verbos-irregulares/a-z/">Cada verbo con su página (de la A a la Z)</a> · '
                       '<a href="/es/verbos-irregulares/fichas/">Fichas para imprimir (PDF)</a> · '
                       '<a href="/es/verbos-irregulares/sprint/">Practica ya en el Sprint →</a>'),
        "pat_anchor": "<h3>Aprende paso a paso</h3>",
        "pat_h": "Tipos de verbos irregulares",
        "pat_intro": ("Casi todos los verbos irregulares siguen uno de cuatro patrones. "
                      "Si los conoces, tienes que memorizar mucho menos:"),
        "pat_names": {
            "AAA": "Las tres formas iguales",
            "ABB": "Pasado y participio iguales",
            "ABA": "Infinitivo y participio iguales",
            "ABC": "Las tres formas distintas",
        },
        "pat_count": lambda n: f"{n} verbos",
        "pat_beat": lambda v: (f"Una excepción no encaja en ningún grupo: <a href=\"/es/verbos-irregulares/{v['slug']}/\">"
                               f"<em lang=\"en\">{E(chain(v))}</em></a>."),
        "faq_h": "Preguntas frecuentes sobre los verbos irregulares",
        "faq": [
            ("¿Cuántos verbos irregulares hay en inglés?",
             f"Según cómo se cuenten, unos 200, a los que se suman verbos poco frecuentes y compuestos como "
             f"<em lang=\"en\">understand</em> u <em lang=\"en\">overcome</em>. Krabsy reúne {N} verbos, de los "
             f"más usados a los más raros. Para empezar bastan los {len(TOP)} más frecuentes: los tienes juntos "
             f"al principio de la <a href=\"/es/verbos-irregulares/a-z/\">lista de la A a la Z</a>."),
            ("¿Qué verbos irregulares debo aprender primero?",
             "Los más frecuentes: <em lang=\"en\">be, have, do, say, go, get, make, know, think, take, see, come</em>. "
             "Aparecen en casi cualquier frase en pasado. Después conviene aprenderlos por tipos (ver arriba), "
             "por ejemplo todos los que no cambian."),
            ("¿Se dice learned o learnt?",
             "Las dos formas son correctas. <em lang=\"en\">learnt</em> es habitual en el inglés británico y "
             "<em lang=\"en\">learned</em> en el americano, y cada vez más también en el Reino Unido. Lo mismo pasa "
             "con <em lang=\"en\">burnt/burned</em> o <em lang=\"en\">dreamt/dreamed</em>. En la lista aparecen "
             "las dos formas, y los ejercicios de Krabsy aceptan ambas."),
            ("¿Qué diferencia hay entre el Simple Past y el Past Participle?",
             "El Simple Past va solo: <em lang=\"en\">I went home.</em> El Past Participle necesita un verbo "
             "auxiliar, por ejemplo en el Present Perfect (<em lang=\"en\">I have gone</em>) o en la pasiva "
             "(<em lang=\"en\">The letter was written</em>). En muchos verbos las dos formas son iguales "
             "(<em lang=\"en\">bought – bought</em>), en otros no (<em lang=\"en\">went – gone</em>)."),
            ("¿Puedo imprimir la lista?",
             f"Sí. Toca «Imprimir lista» arriba, junto a la lista. Se imprime solo la tabla con los {N} verbos, "
             "sin menús ni juegos. En el diálogo de impresión también puedes guardarla como PDF."),
        ],
    },
}

STYLE = """<style>
  .hvt{max-width:760px;margin:var(--space-4,16px) auto 0;padding:0 var(--space-4,16px)}
  .hvt h2{font-family:var(--font-display);font-weight:normal;font-size:clamp(1.2rem,3.4vw,1.5rem);color:var(--krabsy-ink);margin:0 0 4px}
  .hvt-sub{font-size:0.92rem;color:var(--krabsy-ink-mute);margin:0 0 10px;line-height:1.5}
  .hvt-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
  .hvt-tools input{flex:1 1 220px;min-width:0;font:inherit;font-size:16px;padding:8px 12px;border:1.5px solid rgba(44,42,58,0.18);border-radius:10px;background:#fff;color:var(--krabsy-ink)}
  .hvt-tools[hidden]{display:none}
  .hvt-tools button{font:inherit;font-size:0.9rem;padding:8px 14px;border:1.5px solid rgba(44,42,58,0.18);border-radius:10px;background:#fff;color:var(--krabsy-ink);cursor:pointer}
  .hvt-tools button:hover{border-color:var(--krabsy-coral)}
  .hvt-scroll{max-height:min(62vh,30rem);overflow:auto;background:#fff;border:1px solid rgba(44,42,58,0.10);border-radius:12px;-webkit-overflow-scrolling:touch}
  table.hvt-table{width:100%;border-collapse:collapse;font-size:0.95rem}
  .hvt-table th{position:sticky;top:0;background:var(--krabsy-cream,#fdfaf3);font-size:0.68rem;text-transform:uppercase;letter-spacing:1px;color:var(--krabsy-ink-mute);text-align:left;padding:8px;z-index:1}
  .hvt-table td{padding:6px 8px;border-top:1px solid rgba(44,42,58,0.07);color:var(--krabsy-ink)}
  .hvt-table td a{font-family:var(--font-display);color:var(--krabsy-ink);text-decoration:none}
  .hvt-table td a:hover{text-decoration:underline}
  .hvt-table td.m{color:var(--krabsy-ink-mute);font-size:0.85rem}
  .hvt-none{padding:12px;color:var(--krabsy-ink-mute);font-size:0.9rem}
  .hvt-foot{font-size:0.88rem;margin:8px 0 0;color:var(--krabsy-ink-mute)}
  .hvt-foot a{color:var(--krabsy-ink);text-decoration-color:var(--krabsy-coral);text-underline-offset:2px}
  .k-article .hvp-list{list-style:none;padding:0;margin:8px 0 12px}
  .k-article .hvp-list li{margin:0 0 10px}
  .k-article .hvp-ex{display:block;font-size:0.92rem;color:var(--krabsy-ink-mute)}
  .k-article .hvp-ex a{color:var(--krabsy-ink-mute)}
  .k-article dl.hvf dt{font-weight:700;margin:14px 0 4px}
  .k-article dl.hvf dd{margin:0}
  @media (max-width:480px){
    table.hvt-table{font-size:0.82rem;table-layout:fixed}
    .hvt-table th,.hvt-table td{padding:5px 4px;overflow-wrap:anywhere}
    .hvt-table th{letter-spacing:0;font-size:0.6rem}
    .hvt-table td.m{font-size:0.75rem}
  }
  @media print{
    .k-page>*:not(.hvt){display:none!important}
    .hvt-tools,.hvt-foot,.hvt-none{display:none!important}
    .hvt-scroll{max-height:none;overflow:visible;border:0}
    .hvt-table th{position:static}
    .hvt-table tr{break-inside:avoid}
    .hvt-table tr[hidden]{display:table-row!important}
  }
</style>"""

SCRIPT = """<script>
(function(){
  var box=document.getElementById('verb-liste'); if(!box) return;
  var q=box.querySelector('input'), rows=box.querySelectorAll('tbody tr'), none=box.querySelector('.hvt-none');
  box.querySelector('.hvt-tools').hidden=false;
  q.addEventListener('input',function(){
    var s=q.value.trim().toLowerCase(), n=0;
    for(var i=0;i<rows.length;i++){var hit=!s||rows[i].textContent.toLowerCase().indexOf(s)>-1; rows[i].hidden=!hit; if(hit) n++;}
    none.hidden=n>0;
  });
  box.querySelector('.hvt-print').addEventListener('click',function(){ q.value=''; q.dispatchEvent(new Event('input')); window.print(); });
})();
</script>"""


def table_block(t):
    rows = "".join(
        f'<tr><td><a href="{t["base"]}{v["slug"]}/">{E(v["verb"])}</a></td>'
        f'<td>{E(forms(v, "past"))}</td><td>{E(forms(v, "pp"))}</td>'
        f'<td class="m">{E(v[t["meaning"]])}</td></tr>'
        for v in VERBS)
    th = "".join(f'<th scope="col">{h}</th>' for h in t["th"])
    return f"""{STYLE}
<section class="hvt" id="verb-liste" aria-labelledby="hvt-title">
  <h2 id="hvt-title">{t['table_h']}</h2>
  <p class="hvt-sub">{t['table_sub']}</p>
  <div class="hvt-tools" hidden>
    <input type="search" placeholder="{E(t['search'])}" aria-label="{E(t['search'])}" autocomplete="off">
    <button type="button" class="hvt-print">{t['print']}</button>
  </div>
  <div class="hvt-scroll"><table class="hvt-table"><thead><tr>{th}</tr></thead><tbody>{rows}</tbody></table><p class="hvt-none" hidden>{t['none']}</p></div>
  <p class="hvt-foot">{t['table_foot']}</p>
</section>
{SCRIPT}"""


def patterns_block(t):
    items_html = ""
    for key in ("AAA", "ABB", "ABA", "ABC"):
        vs = sorted(BY_PAT[key], key=lambda v: (v["tier"], v["verb"]))[:8]
        ex = ", ".join(f'<a href="{t["base"]}{v["slug"]}/"><em lang="en">{E(chain(v))}</em></a>' for v in vs)
        items_html += (f'<li><strong>{t["pat_names"][key]}</strong> ({t["pat_count"](len(BY_PAT[key]))})'
                       f'<span class="hvp-ex">{ex}</span></li>')
    extra = "".join(f"<p>{t['pat_beat'](v)}</p>" for v in BY_PAT["AAB"])
    return (f'<h3 id="muster">{t["pat_h"]}</h3>\n  <p>{t["pat_intro"]}</p>\n'
            f'  <ul class="hvp-list">{items_html}</ul>\n  {extra}')


def faq_block(t):
    dl = "".join(f"<dt>{E(q)}</dt><dd>{a}</dd>" for q, a in t["faq"])
    strip = lambda s: re.sub(r"<[^>]+>", "", s)
    ld = {"@context": "https://schema.org", "@type": "FAQPage",
          "mainEntity": [{"@type": "Question", "name": q,
                          "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in t["faq"]]}
    return (f'<section class="k-article" aria-labelledby="hvf-title">\n'
            f'  <h2 id="hvf-title">{t["faq_h"]}</h2>\n  <dl class="hvf">{dl}</dl>\n</section>\n'
            f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')


def put_block(src, name, content, anchor, before=False):
    start, end = f"<!-- {name}:start (tools/render_hub_verb_table.py) -->", f"<!-- {name}:end -->"
    block = f"{start}\n{content}\n{end}"
    pat = re.compile(re.escape(f"<!-- {name}:start") + r".*?" + re.escape(end), re.S)
    if pat.search(src):
        return pat.sub(lambda _: block, src, count=1)
    assert anchor in src, f"anchor not found for {name}: {anchor!r}"
    return src.replace(anchor, (block + "\n  " + anchor) if before else (anchor + "\n" + block), 1)


def set_head(src, t):
    """Title / description in the static head (incl. og/twitter)."""
    title, desc = E(t["title"]), E(t["desc"])
    src = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", src, count=1, flags=re.S)
    for attr in ('name="description"', 'property="og:description"', 'name="twitter:description"'):
        src = re.sub(rf'<meta {attr} content="[^"]*">', f'<meta {attr} content="{desc}">', src, count=1)
    for attr in ('property="og:title"', 'name="twitter:title"'):
        src = re.sub(rf'<meta {attr} content="[^"]*">', f'<meta {attr} content="{title}">', src, count=1)
    src = re.sub(r'(<h1 class="hero-title"[^>]*>).*?(</h1>)', lambda m: m.group(1) + E(t["h1"]) + m.group(2),
                 src, count=1, flags=re.S)
    return src


def set_ui_strings(lang, t):
    """The hub's JS re-applies title / meta description / H1 from ui_<lang>.json,
    so the strings there must match the static HTML."""
    p = HP / "data" / f"ui_{lang}.json"
    s = p.read_text(encoding="utf-8")
    hp = re.search(r'\n  "homepage": \{.*?\n  \}', s, re.S)
    assert hp, "top-level homepage block not found"
    blk = hp.group(0)
    for key, val in (("seo_title", t["title"]), ("seo_h1", t["h1"]), ("meta_description", t["desc"])):
        blk, n = re.subn(rf'("{key}": )"(?:[^"\\]|\\.)*"', lambda m: m.group(1) + json.dumps(val, ensure_ascii=False),
                         blk, count=1)
        assert n == 1, f"{key} missing in ui_{lang}.json homepage block"
    s = s.replace(hp.group(0), blk, 1)
    json.loads(s)  # still valid JSON
    p.write_text(s, encoding="utf-8")


for lang, t in L.items():
    src = t["file"].read_text(encoding="utf-8")
    src = set_head(src, t)
    src = put_block(src, "hub-verb-table", table_block(t), "<!-- seo-lead:end -->")
    src = put_block(src, "hub-verb-patterns", patterns_block(t), t["pat_anchor"], before=True)
    src = put_block(src, "hub-verb-faq", faq_block(t), "<!-- seo-article:end -->")
    t["file"].write_text(src, encoding="utf-8")
    set_ui_strings(lang, t)
    print(f"{lang}: {N} verbs, {len(TOP)} top, patterns "
          + ", ".join(f"{k} {len(v)}" for k, v in BY_PAT.items()))
