#!/usr/bin/env python3
"""Generate printable PDFs for teachers (DE + ES) from content/irregular-verbs.json:

  1. verb list      all verbs grouped by pattern, 2 columns, ~2 pages
  2. forms sheet    "go -> ___ -> ___" rows + answer key
  3. gap sheet      gap sentences with the verb as a hint + answer key

Output:
  homepage/de/unregelmaessige-verben/arbeitsblaetter/*.pdf
  homepage/es/verbos-irregulares/fichas/*.pdf

Rendering: HTML -> PDF with a local headless Chrome (Playwright's
chrome-headless-shell, or set CHROME=/path/to/chrome). Deterministic: the same
catalogue gives the same verb selection.

Presentation mandate: task lines use positional notation (go -> ___ -> ___) or
sentence gaps, never grammar terms; terms appear only as small captions.

Also writes the two download pages (index.html in those folders) and adds them
to sitemap.xml once. --no-pdf rebuilds only the pages (PDF bytes change on
every render, so skip them when the catalogue did not change).

Run from repo root:  python3 tools/generate_worksheets.py [--no-pdf]
"""
import glob
import html
import json
import os
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
FONTS = HP / "lib" / "fonts"
E = lambda s: html.escape(str(s))

# ── data ─────────────────────────────────────────────────────────────────────
items = json.loads((ROOT / "content" / "irregular-verbs.json").read_text(encoding="utf-8"))
verbs, ctx = {}, []
for it in items:
    v = verbs.setdefault(it["verb"], {"verb": it["verb"]})
    key = "past" if it["form"] == "past" else "pp"
    v[key] = it["correct_answer"]
    v[key + "_alts"] = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
    v["de"], v["es"], v["tier"] = it.get("meaning_de", ""), it.get("meaning_es", ""), it.get("tier", 3)
    ctx.append(it)
VERBS = sorted(verbs.values(), key=lambda v: v["verb"])
for v in VERBS:
    b, p, q = v["verb"], v["past"], v["pp"]
    v["pattern"] = ("AAA" if b == p == q else "ABB" if p == q else "ABA" if b == q
                    else "AAB" if b == p else "ABC")
TOP = [v for v in VERBS if v["tier"] == 1 and " " not in v["verb"]]


def forms(v, key):
    return " / ".join([v[key]] + v[key + "_alts"])


def spread(seq, n):
    """n items spread evenly over seq (deterministic)."""
    if len(seq) <= n:
        return list(seq)
    step = len(seq) / n
    return [seq[int(i * step)] for i in range(n)]


# Sheet 2 (forms): A = 12 verbs, base given; B = 8 verbs with three different forms, past given.
FORMS_A = spread([v for v in TOP], 12)
FORMS_B = spread([v for v in TOP if v["pattern"] == "ABC" and v not in FORMS_A], 8)
# Sheet 3 (gaps): 12 sentences from the top verbs, alternating past / participle sentences.
_ctx = {(i["verb"], i["form"]): i for i in ctx}
GAPS = []
for n, v in enumerate(spread([v for v in TOP if v not in FORMS_A], 12)):
    form = "past" if n % 2 == 0 else "participle"
    it = _ctx.get((v["verb"], form))
    if it and it.get("context_sentence", "").count("___") == 1:
        alts = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
        GAPS.append((it["context_sentence"], v["verb"], " / ".join([it["correct_answer"]] + alts)))

# ── copy ─────────────────────────────────────────────────────────────────────
L = {
    "de": {
        "dir": HP / "de" / "unregelmaessige-verben" / "arbeitsblaetter",
        "meaning": "de",
        "practice": "krabsy.com/de/unregelmaessige-verben/sprint/",
        "footer": "Krabsy · kostenlos für den Unterricht · Online üben:",
        "name": "Name:", "date": "Datum:", "class": "Klasse:",
        "key": "Lösungen",
        "list": {
            "file": "unregelmaessige-verben-liste.pdf",
            "title": "Unregelmäßige Verben Englisch: Liste",
            "sub": f"Alle {len(VERBS)} Verben, sortiert nach Mustern. Wer die Muster kennt, muss weniger auswendig lernen.",
            "th": ["Grundform", "Simple Past", "Past Participle", "Deutsch"],
            "groups": {
                "AAA": "Alle drei Formen gleich",
                "ABB": "Zweite und dritte Form gleich",
                "ABA": "Erste und dritte Form gleich",
                "AAB": "Erste und zweite Form gleich",
                "ABC": "Alle drei Formen verschieden",
            },
        },
        "forms": {
            "file": "arbeitsblatt-verbformen.pdf",
            "title": "Arbeitsblatt: Die drei Formen",
            "a": "1. Schreib die beiden fehlenden Formen in die Lücken.",
            "b": "2. Hier ist die mittlere Form gegeben. Ergänze die anderen beiden.",
            "caption": "Grundform → Simple Past → Past Participle",
        },
        "gaps": {
            "file": "arbeitsblatt-lueckentext.pdf",
            "title": "Arbeitsblatt: Lückensätze",
            "task": "Setz das Verb in der richtigen Form ein. Das Verb steht in Klammern.",
        },
    },
    "es": {
        "dir": HP / "es" / "verbos-irregulares" / "fichas",
        "meaning": "es",
        "practice": "krabsy.com/es/verbos-irregulares/sprint/",
        "footer": "Krabsy · gratis para el aula · Practica online:",
        "name": "Nombre:", "date": "Fecha:", "class": "Curso:",
        "key": "Soluciones",
        "list": {
            "file": "lista-verbos-irregulares-ingles.pdf",
            "title": "Lista de verbos irregulares en inglés",
            "sub": f"Los {len(VERBS)} verbos, ordenados por tipos. Si conoces los tipos, tienes que memorizar menos.",
            "th": ["Infinitivo", "Simple Past", "Past Participle", "Español"],
            "groups": {
                "AAA": "Las tres formas iguales",
                "ABB": "Segunda y tercera forma iguales",
                "ABA": "Primera y tercera forma iguales",
                "AAB": "Primera y segunda forma iguales",
                "ABC": "Las tres formas distintas",
            },
        },
        "forms": {
            "file": "ficha-formas-verbos-irregulares.pdf",
            "title": "Ficha: Las tres formas",
            "a": "1. Escribe las dos formas que faltan.",
            "b": "2. Aquí tienes la forma del medio. Completa las otras dos.",
            "caption": "Infinitivo → Simple Past → Past Participle",
        },
        "gaps": {
            "file": "ficha-frases-verbos-irregulares.pdf",
            "title": "Ficha: Completa las frases",
            "task": "Escribe el verbo en la forma correcta. El verbo está entre paréntesis.",
        },
    },
}


def font_css():
    f = lambda name: (FONTS / name).as_uri()
    return f"""
@font-face{{font-family:'Fredoka One';src:url('{f("fredoka-one-400-latin.woff2")}') format('woff2')}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin-ext.woff2")}') format('woff2');unicode-range:U+0100-024F}}
"""


CSS = """
@page{size:A4;margin:14mm 14mm 22mm}
*{box-sizing:border-box}
body{font-family:'Nunito',Arial,sans-serif;color:#2c2a3a;font-size:10.5pt;margin:0}
h1{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:19pt;margin:0 0 2mm}
h2{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:12pt;margin:5mm 0 2mm}
.brand{font-family:'Fredoka One',Arial,sans-serif;font-size:11pt;color:#e07a64;letter-spacing:.5px}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5pt solid #f2937e;padding-bottom:2mm;margin-bottom:4mm}
.fields{display:flex;gap:8mm;font-size:10pt;margin:0 0 5mm}
.fields span{flex:1;border-bottom:.6pt solid #6e6c80;padding-bottom:1mm}
.fields span.s{flex:.5}
.sub{color:#6e6c80;margin:0 0 3mm}
.caption{color:#6e6c80;font-size:8.5pt;margin:-1mm 0 2mm}
.foot{position:fixed;bottom:0;left:0;right:0;font-size:8pt;color:#6e6c80;border-top:.5pt solid #d9d7e0;padding-top:1.5mm;display:flex;justify-content:space-between}
.page{page-break-after:always}
.page:last-child{page-break-after:auto}
/* verb list */
.cols{column-count:2;column-gap:7mm}
.grp{break-inside:avoid-column}
.grp h2{break-after:avoid;margin-top:3mm;font-size:10.5pt}
.grp h2 small{font-family:'Nunito',Arial,sans-serif;color:#6e6c80;font-size:8pt}
table.vl{width:100%;border-collapse:collapse;font-size:8.2pt;margin-bottom:2mm}
.vl th{text-align:left;font-size:6.5pt;text-transform:uppercase;letter-spacing:.4px;color:#6e6c80;font-weight:normal;padding:0 1mm 1mm}
.vl td{padding:.75mm 1mm;border-top:.4pt solid #e6e4ec;vertical-align:top}
.vl td:first-child{font-weight:bold}
.vl td.m{color:#6e6c80}
.vl tr{break-inside:avoid}
/* exercises */
.rows{display:grid;grid-template-columns:1fr 1fr;column-gap:10mm;row-gap:6.5mm;margin:3mm 0 4mm}
.row{font-size:12pt;white-space:nowrap}
.row b{font-weight:bold}
.gap{display:inline-block;width:27mm;border-bottom:.8pt solid #2c2a3a;height:5mm;vertical-align:-1mm}
.arrow{color:#e07a64;margin:0 1.5mm}
ol.sent{padding-left:6mm;margin:3mm 0}
ol.sent li{font-size:11.5pt;margin:0 0 6.5mm;line-height:1.5}
ol.sent .gap{width:32mm}
.hint{color:#6e6c80}
.key{font-size:10pt}
.key ol{columns:2;column-gap:10mm;padding-left:6mm}
.key li{margin:0 0 1.5mm}
"""


def page_head(t, title, fields=True):
    f = (f'<div class="fields"><span>{t["name"]}</span><span class="s">{t["class"]}</span>'
         f'<span class="s">{t["date"]}</span></div>') if fields else ""
    return f'<div class="top"><h1>{E(title)}</h1><span class="brand">krabsy</span></div>{f}'


def doc(t, body):
    foot = f'<div class="foot"><span>{E(t["footer"])} {E(t["practice"])}</span><span>krabsy.com</span></div>'
    return (f"<!doctype html><html><head><meta charset='utf-8'><style>{font_css()}{CSS}</style></head>"
            f"<body>{foot}{body}</body></html>")


def verb_list(t):
    c = t["list"]
    th = "".join(f"<th>{h}</th>" for h in c["th"])
    groups = ""
    for key in ("AAA", "ABB", "ABA", "AAB", "ABC"):
        vs = [v for v in VERBS if v["pattern"] == key]
        if not vs:
            continue
        ex = vs[0]
        rows = "".join(f'<tr><td>{E(v["verb"])}</td><td>{E(forms(v, "past"))}</td>'
                       f'<td>{E(forms(v, "pp"))}</td><td class="m">{E(v[t["meaning"]])}</td></tr>' for v in vs)
        # long groups are split into chunks so each chunk can move to the next column
        chunks = [rows]
        if len(vs) > 30:
            rl = rows.split("</tr>")[:-1]
            chunks = ["</tr>".join(rl[i:i + 30]) + "</tr>" for i in range(0, len(rl), 30)]
        head = f'<h2>{c["groups"][key]} <small>({len(vs)})</small></h2>'
        for i, ch in enumerate(chunks):
            groups += (f'<div class="grp">{head if i == 0 else ""}<table class="vl"><thead><tr>{th}</tr></thead>'
                       f"<tbody>{ch}</tbody></table></div>")
    body = page_head(t, c["title"], fields=False) + f'<p class="sub">{E(c["sub"])}</p><div class="cols">{groups}</div>'
    return doc(t, body)


def forms_sheet(t):
    c = t["forms"]
    gap = '<span class="gap"></span>'
    ar = '<span class="arrow">→</span>'
    a = "".join(f'<div class="row"><b>{E(v["verb"])}</b>{ar}{gap}{ar}{gap}</div>' for v in FORMS_A)
    b = "".join(f'<div class="row">{gap}{ar}<b>{E(v["past"])}</b>{ar}{gap}</div>' for v in FORMS_B)
    key_a = "".join(f'<li>{E(v["verb"])} → {E(forms(v, "past"))} → {E(forms(v, "pp"))}</li>' for v in FORMS_A)
    key_b = "".join(f'<li>{E(v["verb"])} → {E(v["past"])} → {E(forms(v, "pp"))}</li>' for v in FORMS_B)
    body = (f'<div class="page">{page_head(t, c["title"])}<p class="caption">{E(c["caption"])}</p>'
            f'<h2>{E(c["a"])}</h2><div class="rows">{a}</div>'
            f'<h2>{E(c["b"])}</h2><div class="rows">{b}</div></div>'
            f'<div class="page key">{page_head(t, c["title"] + " – " + t["key"], fields=False)}'
            f'<h2>1.</h2><ol>{key_a}</ol><h2>2.</h2><ol>{key_b}</ol></div>')
    return doc(t, body)


def gaps_sheet(t):
    c = t["gaps"]
    lis = "".join(
        f'<li>{E(s).replace("___", "<span class=gap></span>", 1)} <span class="hint">({E(verb)})</span></li>'
        for s, verb, _ in GAPS)
    key = "".join(f'<li>{E(s).replace("___", "<b>" + E(ans) + "</b>", 1)}</li>' for s, _, ans in GAPS)
    body = (f'<div class="page">{page_head(t, c["title"])}<h2>{E(c["task"])}</h2><ol class="sent">{lis}</ol></div>'
            f'<div class="page key">{page_head(t, c["title"] + " – " + t["key"], fields=False)}'
            f'<ol class="sent" style="columns:1">{key}</ol></div>')
    return doc(t, body)


def chrome():
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    hits = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")))
    if not hits:
        raise SystemExit("No headless Chrome found; set CHROME=/path/to/chrome")
    return hits[-1]


def to_pdf(html_text, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = pathlib.Path(td) / "sheet.html"
        src.write_text(html_text, encoding="utf-8")
        subprocess.run([chrome(), "--no-sandbox", "--allow-file-access-from-files", "--no-pdf-header-footer",
                        "--virtual-time-budget=3000", f"--print-to-pdf={out}", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


# ── download pages (/de/unregelmaessige-verben/arbeitsblaetter/, /es/verbos-irregulares/fichas/) ──
P = {
    "de": {
        "path": "/de/unregelmaessige-verben/arbeitsblaetter/",
        "hub": "/de/unregelmaessige-verben/", "hub_name": "Unregelmäßige Verben",
        "title": "Unregelmäßige Verben Arbeitsblätter (PDF) mit Lösungen — Krabsy",
        "desc": ("Kostenlose Arbeitsblätter zu den englischen unregelmäßigen Verben zum Ausdrucken: "
                 "Verbliste nach Mustern, Formen-Übung und Lückensätze, jeweils mit Lösungen."),
        "h1": "Unregelmäßige Verben: Arbeitsblätter zum Ausdrucken",
        "crumb": "Arbeitsblätter",
        "sub": ("Kostenlos, als PDF und mit Lösungen. Für den Englischunterricht ab Klasse 5, "
                "für die Hausaufgabe oder zum Üben zu Hause."),
        "download": "PDF herunterladen", "online": "Online üben",
        "pages": lambda n: f"{n} Seiten" if n != 1 else "1 Seite",
        "cards": {
            "list": ("Verbliste nach Mustern",
                     f"Alle {len(VERBS)} unregelmäßigen Verben mit deutscher Bedeutung, sortiert nach den vier Mustern "
                     "(z. B. <em lang=\"en\">cut – cut – cut</em>, <em lang=\"en\">buy – bought – bought</em>). "
                     "Zum Abheften oder als Spickzettel für die Vokabelmappe.",
                     "/de/unregelmaessige-verben/#verb-liste", "Liste online ansehen"),
            "forms": ("Die drei Formen",
                      f"{len(FORMS_A) + len(FORMS_B)} häufige Verben: Die Lernenden ergänzen die fehlenden Formen "
                      "(<em lang=\"en\">go → ___ → ___</em>). Im zweiten Teil ist die mittlere Form gegeben. Mit Lösungsblatt.",
                     "/de/unregelmaessige-verben/type-race/", "Type Race"),
            "gaps": ("Lückensätze",
                     f"{len(GAPS)} englische Sätze, in die das Verb in der richtigen Form eingesetzt wird. "
                     "Das Verb steht als Hilfe in Klammern. Mit Lösungsblatt.",
                     "/de/unregelmaessige-verben/fill-the-gap/", "Fill the Gap"),
        },
        "tip_h": "So passen Papier und Bildschirm zusammen",
        "tip": ("Ein Vorschlag: zuerst das Arbeitsblatt in Ruhe ausfüllen und vergleichen, danach zehn Minuten "
                "<a href=\"/de/unregelmaessige-verben/sprint/\">Sprint</a> am Tablet oder Handy. Wer die Formen "
                "auf Papier kann, schafft dort schnell eine neue Bestzeit. Zum Abschluss: das <a href=\"/de/unregelmaessige-verben/verb-diplom/\">Verb-Diplom</a> mit Urkunde."),
        "use": ("Sie dürfen die Arbeitsblätter für Ihren Unterricht ausdrucken, kopieren und an Ihre Klasse "
                "weitergeben. Fertige Stundenabläufe mit diesen Blättern finden Sie unter "
                "<a href=\"/de/lehrkraefte/unterrichtsideen/\">Unterrichtsideen</a>, weitere Ideen auf der Seite "
                "<a href=\"/de/lehrkraefte/\">Für Lehrkräfte</a>."),
    },
    "es": {
        "path": "/es/verbos-irregulares/fichas/",
        "hub": "/es/verbos-irregulares/", "hub_name": "Verbos irregulares",
        "title": "Fichas de verbos irregulares en inglés (PDF) con soluciones — Krabsy",
        "desc": ("Fichas gratis de verbos irregulares en inglés para imprimir: lista por tipos, ejercicio "
                 "de formas y frases para completar, todas con soluciones."),
        "h1": "Verbos irregulares en inglés: fichas para imprimir",
        "crumb": "Fichas",
        "sub": ("Gratis, en PDF y con soluciones. Para la clase de inglés desde 5.º de Primaria, "
                "para deberes o para practicar en casa."),
        "download": "Descargar PDF", "online": "Practicar online",
        "pages": lambda n: f"{n} páginas" if n != 1 else "1 página",
        "cards": {
            "list": ("Lista por tipos",
                     f"Los {len(VERBS)} verbos irregulares con su significado en español, ordenados por los cuatro tipos "
                     "(p. ej. <em lang=\"en\">cut – cut – cut</em>, <em lang=\"en\">buy – bought – bought</em>). "
                     "Para el cuaderno o como chuleta de repaso.",
                     "/es/verbos-irregulares/#verb-liste", "Ver la lista online"),
            "forms": ("Las tres formas",
                      f"{len(FORMS_A) + len(FORMS_B)} verbos frecuentes: el alumnado completa las formas que faltan "
                      "(<em lang=\"en\">go → ___ → ___</em>). En la segunda parte se da la forma del medio. Con soluciones.",
                      "/es/verbos-irregulares/type-race/", "Type Race"),
            "gaps": ("Completa las frases",
                     f"{len(GAPS)} frases en inglés para completar con el verbo en la forma correcta. "
                     "El verbo aparece entre paréntesis como ayuda. Con soluciones.",
                     "/es/verbos-irregulares/fill-the-gap/", "Fill the Gap"),
        },
        "tip_h": "Papel y pantalla, juntos",
        "tip": ("Una idea: primero la ficha con calma y la corrección en grupo; después, diez minutos de "
                "<a href=\"/es/verbos-irregulares/sprint/\">Sprint</a> en la tablet o el móvil. Quien ya domina "
                "las formas en papel, bate su récord enseguida. Para terminar: el <a href=\"/es/verbos-irregulares/diploma/\">diploma de verbos</a> con certificado."),
        "use": ("Puedes imprimir, fotocopiar y repartir las fichas en tu clase. Encontrarás más ideas en la "
                "página <a href=\"/es/docentes/\">Para docentes</a>."),
    },
}

PAGE_CSS = """
    body{background:var(--krabsy-cream)}
    .logo{display:inline-flex;align-items:center;font-family:var(--font-display);font-size:1.6rem;text-decoration:none;color:var(--krabsy-ink);letter-spacing:-0.5px;line-height:1}
    .logo-crab{display:inline-flex;width:1.15em;height:1.15em;align-items:center;justify-content:center;margin:0 -0.04em}
    .logo-crab img{display:block;width:100%;height:100%;object-fit:contain}
    .ws-wrap{max-width:760px;margin:0 auto;padding:0 var(--space-5,20px) var(--space-7,48px);width:100%}
    .crumbs{font-size:0.82rem;color:var(--krabsy-ink-mute);padding:var(--space-4,16px) 0 0}
    .crumbs a{color:inherit;text-decoration:none}
    .ws-h1{font-family:var(--font-display);font-weight:normal;font-size:clamp(1.6rem,5vw,2.3rem);color:var(--krabsy-ink);margin:10px 0 6px;line-height:1.15}
    .ws-sub{color:var(--krabsy-ink-mute);font-size:1rem;margin:0 0 20px;line-height:1.5}
    .ws-card{background:#fff;border:1px solid rgba(44,42,58,0.08);border-radius:16px;padding:18px 20px;margin-bottom:14px;box-shadow:0 2px 10px rgba(31,43,61,0.04)}
    .ws-card h2{font-family:var(--font-display);font-weight:normal;font-size:1.2rem;color:var(--krabsy-ink);margin:0 0 6px}
    .ws-card p{margin:0 0 10px;color:var(--krabsy-ink);line-height:1.55;font-size:0.97rem}
    .ws-meta{font-size:0.82rem;color:var(--krabsy-ink-mute)}
    .ws-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .ws-dl{font-family:var(--font-display);font-size:0.95rem;color:#fff;background:var(--krabsy-coral-dark,#e07a64);padding:9px 18px;border-radius:30px;text-decoration:none}
    .ws-dl:hover{filter:brightness(1.05)}
    .ws-on{font-size:0.92rem;color:var(--krabsy-ink);text-decoration-color:var(--krabsy-coral);text-underline-offset:2px}
    .ws-note{background:#fff8e6;border:1px solid #f5d98a;border-radius:12px;padding:12px 16px;margin:18px 0 10px;color:var(--krabsy-ink);line-height:1.55;font-size:0.95rem}
    .ws-note h2{font-family:var(--font-display);font-weight:normal;font-size:1.05rem;margin:0 0 4px}
    .ws-note a,.ws-use a{color:var(--krabsy-ink);text-decoration-color:var(--krabsy-coral);text-underline-offset:2px}
    .ws-use{font-size:0.9rem;color:var(--krabsy-ink-mute);line-height:1.5}
"""


def pdf_pages(path):
    import re as _re
    return len(_re.findall(rb"/Type\s*/Page[^s]", path.read_bytes()))


def download_page(lang, LL, PP, kinds):
    t, p = LL[lang], PP[lang]
    other = "es" if lang == "de" else "de"
    url = lambda x: "https://krabsy.com" + x
    cards = ""
    for kind in kinds:
        name, desc, on_href, on_label = p["cards"][kind]
        f = t["dir"] / t[kind]["file"]
        meta = f'PDF · {p["pages"](pdf_pages(f))} · {max(1, f.stat().st_size // 1024)} KB'
        cards += (f'<section class="ws-card"><h2>{E(name)}</h2><p>{desc}</p>'
                  f'<div class="ws-actions"><a class="ws-dl" href="{p["path"]}{t[kind]["file"]}" download>'
                  f'{p["download"]}</a><a class="ws-on" href="{on_href}">{E(on_label) if kind in ("list", "sort", "overview") else p["online"] + ": " + E(on_label)} →</a>'
                  f'<span class="ws-meta">{meta}</span></div></section>')
    crumbs_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Krabsy", "item": url(f"/{lang}/")},
        {"@type": "ListItem", "position": 2, "name": p["hub_name"], "item": url(p["hub"])},
        {"@type": "ListItem", "position": 3, "name": p["crumb"], "item": url(p["path"])}]}
    title, desc = E(p["title"]), E(p["desc"])
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","{lang}");}}catch(_){{}}</script>
  <!-- generated by tools/generate_worksheets.py -->
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{url(p['path'])}">
  <link rel="alternate" hreflang="{lang}" href="{url(p['path'])}">
  <link rel="alternate" hreflang="{other}" href="{url(PP[other]['path'])}">
  <link rel="alternate" hreflang="x-default" href="{url(PP['de']['path'])}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2026-11-27">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=2026-11-27">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="{url(p['path'])}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="{'de_DE' if lang == 'de' else 'es_ES'}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-27h">
  <style>{PAGE_CSS}</style>
  <script type="application/ld+json">{json.dumps(crumbs_ld, ensure_ascii=False)}</script>
</head><body>
  <div class="k-page">
    <header class="k-page-header">
      <a href="/{lang}/" class="logo" aria-label="Krabsy">
        <span>kr</span>
        <span class="logo-crab" aria-hidden="true"><img src="/favicon.png?v=2026-11-27" alt="" decoding="async"></span>
        <span>bsy</span>
      </a>
      <div class="k-lang-toggle" role="group" aria-label="{'Sprache wählen' if lang == 'de' else 'Elegir idioma'}">
        <button class="k-lang-btn{' is-active' if lang == 'de' else ''}" type="button" data-lang="de">DE</button>
        <button class="k-lang-btn{' is-active' if lang == 'es' else ''}" type="button" data-lang="es">ES</button>
      </div>
    </header>
    <main class="ws-wrap">
      <nav class="crumbs"><a href="{p['hub']}">{E(p['hub_name'])}</a> › {E(p['crumb'])}</nav>
      <h1 class="ws-h1">{E(p['h1'])}</h1>
      <p class="ws-sub">{E(p['sub'])}</p>
      {cards}
      <aside class="ws-note"><h2>{E(p['tip_h'])}</h2>{p['tip']}</aside>
      <p class="ws-use">{p['use']}</p>
    </main>
    <footer class="k-footer">
      <span id="footer-copyright">© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v=2026-11-27h" defer></script>
  <script type="module" src="/lib/krabsy-header.js?v=2026-11-27h"></script>
  <script src="/lib/krabsy-lang-switch.js?v=2026-11-27h" defer></script>
  <script src="/lib/krabsy-analytics.js?v=2026-11-22" defer></script>
</body>
</html>
"""


def sitemap_entries(PP):
    """Add a topic's two download pages to sitemap.xml once (idempotent)."""
    sm = HP / "sitemap.xml"
    s = sm.read_text(encoding="utf-8")
    if PP["de"]["path"] in s:
        return
    de, es = PP["de"]["path"], PP["es"]["path"]
    block = ""
    for loc in (de, es):
        block += f"""  <url>
    <loc>https://krabsy.com{loc}</loc>
    <lastmod>2026-11-22</lastmod>
    <changefreq>monthly</changefreq>
    <xhtml:link rel="alternate" hreflang="de"        href="https://krabsy.com{de}"/>
    <xhtml:link rel="alternate" hreflang="es"        href="https://krabsy.com{es}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://krabsy.com{de}"/>
  </url>
"""
    sm.write_text(s.replace("</urlset>", block + "</urlset>", 1), encoding="utf-8")
    print("sitemap: download pages added")




# ── extra verb sheet: sort by pattern ────────────────────────────────────────
SORT_EX = {"AAA": "cut", "ABB": "buy", "ABA": "come", "ABC": "go"}
SORT = {}
for key in ("AAA", "ABB", "ABA", "ABC"):
    pool = sorted([v for v in VERBS if v["pattern"] == key and v["verb"] != SORT_EX[key] and " " not in v["verb"]],
                  key=lambda v: (v["tier"], v["verb"]))
    SORT[key] = pool[:4]
SORT_BOX = sorted((v for vs in SORT.values() for v in vs), key=lambda v: v["verb"])
_vmap = {v["verb"]: v for v in VERBS}


def sort_sheet(t):
    c = t["sort"]
    chain = lambda v: f'{v["verb"]} – {v["past"]} – {v["pp"]}'
    box = " · ".join(E(v["verb"]) for v in SORT_BOX)
    cols = ""
    for key in ("AAA", "ABB", "ABA", "ABC"):
        lines = "".join('<div class="sline"></div>' for _ in SORT[key])
        cols += (f'<div class="scol"><h2>{E(t["list"]["groups"][key])}</h2>'
                 f'<p class="sex">{E(chain(_vmap[SORT_EX[key]]))}</p>{lines}</div>')
    key_html = "".join(
        f'<h2>{E(t["list"]["groups"][k])}</h2><ol>'
        + "".join(f'<li>{E(v["verb"])} – {E(forms(v, "past"))} – {E(forms(v, "pp"))}</li>' for v in SORT[k])
        + "</ol>" for k in ("AAA", "ABB", "ABA", "ABC"))
    css = ("<style>.box{border:1pt dashed #e07a64;border-radius:3mm;padding:3mm 4mm;font-size:12pt;"
           "line-height:1.8;margin:2mm 0 5mm}.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:6mm 10mm}"
           ".scol h2{margin:0 0 1mm;font-size:11pt}.sex{color:#6e6c80;margin:0 0 2mm;font-style:italic}"
           ".sline{border-bottom:.8pt solid #2c2a3a;height:9mm}</style>")
    body = (f'{css}<div class="page">{page_head(t, c["title"])}<h2>{E(c["task"])}</h2>'
            f'<div class="box">{box}</div><div class="sgrid">{cols}</div></div>'
            f'<div class="page key">{page_head(t, c["title"] + " – " + t["key"], fields=False)}{key_html}</div>')
    return doc(t, body)


L["de"]["sort"] = {"file": "arbeitsblatt-verben-nach-mustern.pdf", "title": "Arbeitsblatt: Verben nach Mustern sortieren",
                   "task": "Schreib jedes Verb mit seinen drei Formen in die passende Spalte. Das Beispiel zeigt das Muster."}
L["es"]["sort"] = {"file": "ficha-verbos-irregulares-por-tipos.pdf", "title": "Ficha: Ordena los verbos por tipos",
                   "task": "Escribe cada verbo con sus tres formas en la columna correcta. El ejemplo muestra el tipo."}
P["de"]["cards"]["sort"] = ("Nach Mustern sortieren",
                            f"{len(SORT_BOX)} Verben werden mit ihren drei Formen in die vier Muster einsortiert. "
                            "Gut, um nach der Verbliste die Muster selbst zu entdecken. Mit Lösungsblatt.",
                            "/de/unregelmaessige-verben/#muster", "Muster online ansehen")
P["es"]["cards"]["sort"] = ("Ordena por tipos",
                            f"{len(SORT_BOX)} verbos para clasificar con sus tres formas en los cuatro tipos. "
                            "Ideal para descubrir los tipos después de la lista. Con soluciones.",
                            "/es/verbos-irregulares/#muster", "Ver los tipos online")

# ── prepositions ─────────────────────────────────────────────────────────────
PREPS = json.loads((ROOT / "content" / "prepositions.json").read_text(encoding="utf-8"))
PGROUPS = ["time", "place", "movement", "transport", "verb", "adjective", "noun", "phrase"]
PG_NAME = {
    "de": {"time": "Zeit", "place": "Ort", "movement": "Bewegung", "transport": "Verkehrsmittel",
           "verb": "Nach Verben", "adjective": "Nach Adjektiven", "noun": "Nach Nomen", "phrase": "Feste Wendungen"},
    "es": {"time": "Tiempo", "place": "Lugar", "movement": "Movimiento", "transport": "Transporte",
           "verb": "Después de verbos", "adjective": "Después de adjetivos", "noun": "Después de sustantivos",
           "phrase": "Expresiones fijas"},
}


def _first_example(it):
    exs = sorted(it["examples"], key=lambda e: e.get("difficulty", 9))
    ok = [e for e in exs if e["sentence"].count("___") == 1]
    return ok[0] if ok else None


def _prep_set(groups, n):
    items = [it for g in groups for it in PREPS if it["group"] == g and _first_example(it)]
    return [(_first_example(it)["sentence"], _first_example(it)["valid_answers"]) for it in spread(items, n)]


PGAP_A = _prep_set(["time", "place", "movement", "transport"], 15)
PGAP_B = _prep_set(["verb", "adjective", "noun"], 15)


def prep_overview(t):
    c = t["overview"]
    groups = ""
    for g in PGROUPS:
        its = [it for it in PREPS if it["group"] == g and _first_example(it)]
        if not its:
            continue
        rows = ""
        for it in its:
            ex = _first_example(it)
            sent = E(ex["sentence"]).replace("___", "<b>" + E(ex["valid_answers"][0]) + "</b>", 1)
            rows += f'<tr><td>{E(it["pattern"])}</td><td class="m">{sent}</td></tr>'
        groups += (f'<div class="grp"><h2>{E(PG_NAME[t["lang"]][g])} <small>({len(its)})</small></h2>'
                   f'<table class="vl"><thead><tr><th>{E(c["th"][0])}</th><th>{E(c["th"][1])}</th></tr></thead>'
                   f"<tbody>{rows}</tbody></table></div>")
    body = page_head(t, c["title"], fields=False) + f'<p class="sub">{E(c["sub"])}</p><div class="cols">{groups}</div>'
    return doc(t, body)


def _prep_gap_sheet(t, c, items):
    words = sorted({a[0] for _, a in items})
    box = ("<style>.box{border:1pt dashed #e07a64;border-radius:3mm;padding:2.5mm 4mm;font-size:11.5pt;"
           "margin:1mm 0 3mm}</style>" + f'<div class="box">{E(c["box"])} ' + " · ".join(E(w) for w in words) + "</div>")
    lis = "".join(f'<li>{E(s).replace("___", "<span class=gap></span>", 1)}</li>' for s, _ in items)
    key = "".join(f'<li>{E(s).replace("___", "<b>" + E(" / ".join(a)) + "</b>", 1)}</li>' for s, a in items)
    body = (f'<div class="page">{page_head(t, c["title"])}<h2>{E(c["task"])}</h2>{box}'
            f'<ol class="sent tight">{lis}</ol></div>'
            f'<div class="page key">{page_head(t, c["title"] + " – " + t["key"], fields=False)}'
            f'<ol class="sent tight">{key}</ol></div>')
    return doc(t, body.replace('<ol class="sent tight">', '<ol class="sent" style="margin-top:2mm">'))


def prep_gaps_a(t):
    return _prep_gap_sheet(t, t["gaps_a"], PGAP_A)


def prep_gaps_b(t):
    return _prep_gap_sheet(t, t["gaps_b"], PGAP_B)


LP = {
    "de": {
        "lang": "de", "dir": HP / "de" / "praepositionen" / "arbeitsblaetter",
        "practice": "krabsy.com/de/praepositionen/sprint/",
        "footer": L["de"]["footer"], "name": "Name:", "date": "Datum:", "class": "Klasse:", "key": "Lösungen",
        "overview": {"file": "englische-praepositionen-uebersicht.pdf", "title": "Englische Präpositionen: Übersicht",
                     "sub": f"{len(PREPS)} Regeln mit je einem Beispielsatz, sortiert nach Themen.",
                     "th": ["Regel", "Beispiel"]},
        "gaps_a": {"file": "arbeitsblatt-praepositionen-zeit-ort.pdf", "title": "Arbeitsblatt: Präpositionen für Zeit und Ort",
                   "task": "Setz die passende Präposition ein.", "box": "Diese Wörter brauchst du:"},
        "gaps_b": {"file": "arbeitsblatt-praepositionen-verben-adjektive.pdf",
                   "title": "Arbeitsblatt: Präpositionen nach Verben und Adjektiven",
                   "task": "Setz die passende Präposition ein.", "box": "Diese Wörter brauchst du:"},
    },
    "es": {
        "lang": "es", "dir": HP / "es" / "preposiciones" / "fichas",
        "practice": "krabsy.com/es/preposiciones/sprint/",
        "footer": L["es"]["footer"], "name": "Nombre:", "date": "Fecha:", "class": "Curso:", "key": "Soluciones",
        "overview": {"file": "preposiciones-ingles-resumen.pdf", "title": "Preposiciones en inglés: resumen",
                     "sub": f"{len(PREPS)} reglas con una frase de ejemplo cada una, ordenadas por temas.",
                     "th": ["Regla", "Ejemplo"]},
        "gaps_a": {"file": "ficha-preposiciones-tiempo-lugar.pdf", "title": "Ficha: Preposiciones de tiempo y lugar",
                   "task": "Completa con la preposición correcta.", "box": "Palabras que necesitas:"},
        "gaps_b": {"file": "ficha-preposiciones-verbos-adjetivos.pdf",
                   "title": "Ficha: Preposiciones después de verbos y adjetivos",
                   "task": "Completa con la preposición correcta.", "box": "Palabras que necesitas:"},
    },
}

PPP = {
    "de": {
        "path": "/de/praepositionen/arbeitsblaetter/", "hub": "/de/praepositionen/", "hub_name": "Präpositionen",
        "title": "Englische Präpositionen Arbeitsblätter (PDF) mit Lösungen — Krabsy",
        "desc": ("Kostenlose Arbeitsblätter zu den englischen Präpositionen zum Ausdrucken: Übersicht aller Regeln, "
                 "in/on/at für Zeit und Ort, Präpositionen nach Verben und Adjektiven. Mit Lösungen."),
        "h1": "Englische Präpositionen: Arbeitsblätter zum Ausdrucken", "crumb": "Arbeitsblätter",
        "sub": P["de"]["sub"], "download": P["de"]["download"], "online": P["de"]["online"], "pages": P["de"]["pages"],
        "cards": {
            "overview": ("Übersicht aller Regeln",
                         f"{len(PREPS)} Regeln von <em lang=\"en\">in + Monat</em> bis <em lang=\"en\">good at</em>, "
                         "jeweils mit Beispielsatz, sortiert nach Themen. Zum Abheften.",
                         "/de/praepositionen/uebersicht/", "Übersicht online ansehen"),
            "gaps_a": ("Zeit und Ort: in, on, at …",
                       f"{len(PGAP_A)} Lückensätze zu Zeit, Ort, Bewegung und Verkehrsmitteln. "
                       "Die benötigten Wörter stehen im Kasten. Mit Lösungsblatt.",
                       "/de/praepositionen/sprint/", "Sprint"),
            "gaps_b": ("Nach Verben und Adjektiven",
                       f"{len(PGAP_B)} Lückensätze wie <em lang=\"en\">good ___ maths</em> oder "
                       "<em lang=\"en\">afraid ___ spiders</em>. Mit Wortkasten und Lösungsblatt.",
                       "/de/praepositionen/fill-the-gap/", "Fill the Gap"),
        },
        "tip_h": P["de"]["tip_h"],
        "tip": ("Ein Vorschlag: zuerst das Arbeitsblatt in Ruhe ausfüllen und vergleichen, danach zehn Minuten "
                "<a href=\"/de/praepositionen/sprint/\">Sprint</a> am Tablet oder Handy."),
        "use": P["de"]["use"],
    },
    "es": {
        "path": "/es/preposiciones/fichas/", "hub": "/es/preposiciones/", "hub_name": "Preposiciones",
        "title": "Fichas de preposiciones en inglés (PDF) con soluciones — Krabsy",
        "desc": ("Fichas gratis de preposiciones en inglés para imprimir: resumen de todas las reglas, in/on/at "
                 "de tiempo y lugar, preposiciones después de verbos y adjetivos. Con soluciones."),
        "h1": "Preposiciones en inglés: fichas para imprimir", "crumb": "Fichas",
        "sub": P["es"]["sub"], "download": P["es"]["download"], "online": P["es"]["online"], "pages": P["es"]["pages"],
        "cards": {
            "overview": ("Resumen de todas las reglas",
                         f"{len(PREPS)} reglas, desde <em lang=\"en\">in + mes</em> hasta <em lang=\"en\">good at</em>, "
                         "cada una con una frase de ejemplo y ordenadas por temas.",
                         "/es/preposiciones/resumen/", "Ver el resumen online"),
            "gaps_a": ("Tiempo y lugar: in, on, at …",
                       f"{len(PGAP_A)} frases para completar sobre tiempo, lugar, movimiento y transporte. "
                       "Las palabras necesarias están en el recuadro. Con soluciones.",
                       "/es/preposiciones/sprint/", "Sprint"),
            "gaps_b": ("Después de verbos y adjetivos",
                       f"{len(PGAP_B)} frases como <em lang=\"en\">good ___ maths</em> o "
                       "<em lang=\"en\">afraid ___ spiders</em>. Con recuadro de palabras y soluciones.",
                       "/es/preposiciones/fill-the-gap/", "Fill the Gap"),
        },
        "tip_h": P["es"]["tip_h"],
        "tip": ("Una idea: primero la ficha con calma y la corrección en grupo; después, diez minutos de "
                "<a href=\"/es/preposiciones/sprint/\">Sprint</a> en la tablet o el móvil."),
        "use": P["es"]["use"],
    },
}

# ── main ─────────────────────────────────────────────────────────────────────
import sys  # noqa: E402

TOPICS = [
    (L, P, [("list", verb_list), ("forms", forms_sheet), ("gaps", gaps_sheet), ("sort", sort_sheet)]),
    (LP, PPP, [("overview", prep_overview), ("gaps_a", prep_gaps_a), ("gaps_b", prep_gaps_b)]),
]
for LL, PP, sheets in TOPICS:
    for lang, t in LL.items():
        if "--no-pdf" not in sys.argv:
            for kind, fn in sheets:
                out = t["dir"] / t[kind]["file"]
                to_pdf(fn(t), out)
                print(f"{lang}: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
        t["dir"].mkdir(parents=True, exist_ok=True)
        (t["dir"] / "index.html").write_text(download_page(lang, LL, PP, [k for k, _ in sheets]), encoding="utf-8")
        print(f"{lang}: {(t['dir'] / 'index.html').relative_to(ROOT)}")
    sitemap_entries(PP)
print(f"verbs: forms A {len(FORMS_A)}, B {len(FORMS_B)}, gaps {len(GAPS)}, sort {len(SORT_BOX)}; "
      f"preps: gaps A {len(PGAP_A)}, B {len(PGAP_B)}")
