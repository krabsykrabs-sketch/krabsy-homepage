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

Run from repo root:  python3 tools/generate_worksheets.py
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
@page{size:A4;margin:14mm 14mm 16mm}
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
.foot{position:fixed;bottom:-10mm;left:0;right:0;font-size:8pt;color:#6e6c80;border-top:.5pt solid #d9d7e0;padding-top:1.5mm;display:flex;justify-content:space-between}
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


for lang, t in L.items():
    for kind, fn in (("list", verb_list), ("forms", forms_sheet), ("gaps", gaps_sheet)):
        out = t["dir"] / t[kind]["file"]
        to_pdf(fn(t), out)
        print(f"{lang}: {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")
print(f"forms A {len(FORMS_A)}, B {len(FORMS_B)}, gap sentences {len(GAPS)}")
