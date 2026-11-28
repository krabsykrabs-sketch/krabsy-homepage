"""Shared look for Krabsy worksheets (2026-11-28 redesign).

Rules (owner, 2026-11-28):
  * Must work on a black-and-white school copier: black lines, light greys,
    no large solid fills, nothing that only works in colour.
  * The mascot comes from ONE file (MASCOT). When the mascot changes, swap
    that file and regenerate; every sheet follows.
  * Pictures are line drawings (ICONS) so they copy cleanly and can be
    coloured in.

Used by tools/generate_worksheets.py (all verb + preposition sheets, DE + ES).
"""
import base64
import glob
import html
import os
import pathlib
import re
import subprocess
import sys
import tempfile

import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
FONTS = HP / "lib" / "fonts"
MASCOT = HP / "favicon.png"          # ← the one mascot file (192 px is enough at ≤ 25 mm)
E = lambda s: html.escape(str(s))


def mascot_img(cls="crab", mm=None):
    data = base64.b64encode(MASCOT.read_bytes()).decode()
    size = f' style="width:{mm}mm;height:{mm}mm"' if mm else ""
    return f'<img class="{cls}" src="data:image/png;base64,{data}" alt=""{size}>'


def qr(url, mm=20):
    q = segno.make(url, error="m")
    svg = q.svg_inline(scale=1, border=0, dark="#000")
    return re.sub(r"<svg ", f'<svg style="width:{mm}mm;height:{mm}mm" ', svg, count=1)


# ── line icons (viewBox 0 0 48 48, stroke only) ────────────────────────────
_S = 'fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'
ICONS = {
    "eat": '<path d="M24 14c-3-3-9-3-12 1-4 5-2 14 2 19 3 4 6 5 10 3 4 2 7 1 10-3 4-5 6-14 2-19-3-4-9-4-12-1z"/>'
           '<path d="M24 14c0-4 1-7 4-9"/><path d="M26 9c3-2 7-1 8 1-3 2-6 2-8-1z"/>'
           '<path d="M37 20a3.5 3.5 0 0 1 0 6"/>',
    "drink": '<path d="M14 14h20l-3 28H17z"/><path d="M15.5 24h17"/><path d="M27 14 31 4h6"/>',
    "fly": '<path d="M5 22 43 8 30 40l-7-12z"/><path d="M43 8 23 28"/><path d="M23 28v10l5-5"/>',
    "go": '<path d="M14 8c3 0 5 3 5 8s-2 8-5 8-5-3-5-8 2-8 5-8z"/><path d="M11 28h6v3a3 3 0 0 1-6 0z"/>'
          '<path d="M34 16c3 0 5 3 5 8s-2 8-5 8-5-3-5-8 2-8 5-8z"/><path d="M31 36h6v3a3 3 0 0 1-6 0z"/>',
    "run": '<circle cx="30" cy="8" r="4"/><path d="M28 14 22 27l8 5-3 11"/><path d="M22 27l-9 3-4 8"/>'
           '<path d="M26 17l-8 2-4 6M27 17l6 5 6-2"/><path d="M4 16h8M2 22h7"/>',
    "sleep": '<path d="M28 8a15 15 0 1 0 12 24A13 13 0 0 1 28 8z"/><path d="M33 8h7l-7 8h7"/><path d="M38 20h5l-5 6h5"/>',
    "swim": '<circle cx="18" cy="17" r="5"/><path d="M23 19l9-6 7 2"/><path d="M4 29c4-3 6-3 10 0s6 3 10 0 6-3 10 0 6 3 10 0"/>'
            '<path d="M4 37c4-3 6-3 10 0s6 3 10 0 6-3 10 0 6 3 10 0"/>',
    "sing": '<path d="M16 36V12l22-5v24"/><path d="M16 17l22-5"/><ellipse cx="11.5" cy="36" rx="5" ry="4"/>'
            '<ellipse cx="33.5" cy="31" rx="5" ry="4"/>',
    "write": '<path d="M30 6l8 8-20 20-10 2 2-10z"/><path d="M26 10l8 8"/><path d="M8 42h32"/>',
    "drive": '<path d="M6 30v-6l5-10h22l7 10h2v6z"/><path d="M13 14l-3 10h30"/><path d="M24 14v10"/>'
             '<circle cx="14" cy="33" r="4.5"/><circle cx="35" cy="33" r="4.5"/>',
    "buy": '<path d="M10 16h28l-3 26H13z"/><path d="M18 20v-6a6 6 0 0 1 12 0v6"/><path d="M19 31l4 4 7-8"/>',
    "see": '<path d="M3 24c5-9 12-14 21-14s16 5 21 14c-5 9-12 14-21 14S8 33 3 24z"/><circle cx="24" cy="24" r="7"/>'
           '<circle cx="24" cy="24" r="2.5"/>',
    "shell": '<path d="M24 41c-3.2 0-5.6-1.4-6.6-3.8L6.8 24.6a17.2 17.2 0 1 1 34.4 0L30.6 37.2c-1 2.4-3.4 3.8-6.6 3.8z"/>'
             '<path d="M24 34V11M19.6 34 13.2 16M28.4 34l6.4-18"/>',
}


def icon(name, mm=14):
    return f'<svg class="ic" viewBox="0 0 48 48" style="width:{mm}mm;height:{mm}mm" {_S}>{ICONS[name]}</svg>'


def font_css():
    f = lambda name: (FONTS / name).as_uri()
    return f"""
@font-face{{font-family:'Fredoka One';src:url('{f("fredoka-one-400-latin.woff2")}') format('woff2')}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin-ext.woff2")}') format('woff2');unicode-range:U+0100-024F}}
"""


# Greys only. #111 ink, #555 secondary text, #999 rules, #e6e6e6 light tint (copies as a pale grey).
CSS = """
@page{size:A4;margin:12mm 13mm 16mm}
*{box-sizing:border-box}
body{font-family:'Nunito',Arial,sans-serif;color:#111;font-size:10.5pt;margin:0}
.page{position:relative;height:268mm;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.disp{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal}
/* header */
.hd{display:flex;align-items:center;gap:4mm;border:1.2pt solid #111;border-radius:5mm;padding:2.5mm 5mm 2.5mm 3mm;margin-bottom:3mm}
.hd .crab{width:20mm;height:20mm;filter:grayscale(1) contrast(1.15);flex:none}
.hd-t{flex:1}
.hd-k{font-size:8.5pt;letter-spacing:.6px;text-transform:uppercase;color:#555;margin:0 0 .5mm}
.hd h1{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:21pt;line-height:1.05;margin:0}
.brand{font-family:'Fredoka One',Arial,sans-serif;font-size:15pt;align-self:flex-start;margin-top:1mm}
.fields{display:flex;gap:7mm;font-size:10pt;margin:0 0 4mm;padding:0 2mm}
.fields span{flex:1;border-bottom:.7pt solid #555;padding-bottom:1mm}
.fields span.s{flex:.45}
/* task heading: number disc + text */
.task{display:flex;align-items:center;gap:3mm;margin:4mm 0 3mm}
.num{flex:none;width:9mm;height:9mm;border-radius:50%;border:1.4pt solid #111;display:flex;align-items:center;justify-content:center;font-family:'Fredoka One',Arial,sans-serif;font-size:13pt}
.task p{margin:0;font-size:11.5pt;font-weight:bold;line-height:1.3}
.task small{display:block;font-weight:normal;color:#555;font-size:9pt}
/* picture cards */
.cards{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3.6mm 4mm}
.card{display:flex;align-items:center;gap:3mm;border:.9pt solid #111;border-radius:4mm;padding:3.6mm 3mm 3.6mm 2.5mm;min-width:0}
.card .ic{flex:none}
.card-v{font-family:'Fredoka One',Arial,sans-serif;font-size:15pt;line-height:1;margin:0 0 2mm}
.line{display:flex;align-items:flex-end;gap:1.6mm;font-size:12pt}
.gap{display:inline-block;width:25mm;height:7mm;border-bottom:.9pt solid #111}
.arr{color:#555}
/* crab tip */
.tip{display:flex;align-items:center;gap:3mm;margin-top:auto}
.tip .crab{width:19mm;height:19mm;filter:grayscale(1) contrast(1.15);flex:none}
.bub{position:relative;border:1pt dashed #555;border-radius:5mm;padding:2.5mm 4mm;font-size:10pt;line-height:1.45;flex:1}
.bub b{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal}
/* plain rows */
.rows{display:grid;grid-template-columns:1fr 1fr;gap:5.5mm 8mm;margin:1mm 0 2mm;padding-left:2mm}
.rows .line b{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:13pt}
.rows .gap{width:25mm}
/* word search */
.ws{display:flex;gap:7mm;align-items:flex-start}
table.grid{border-collapse:collapse;flex:none}
.grid td{width:8.2mm;height:8.2mm;border:.5pt solid #999;text-align:center;font-family:'Fredoka One',Arial,sans-serif;font-size:12.5pt}
.grid td.hit{background:#e0e0e0;font-weight:bold}
.found{flex:1;border-collapse:collapse;font-size:10pt}
.found th{text-align:left;font-weight:normal;color:#555;font-size:8.5pt;padding:0 0 1.5mm}
.found td{height:8.5mm;border-bottom:.7pt solid #999;vertical-align:bottom;padding-bottom:1mm}
.found td:first-child{width:46%}
/* self check */
.bonus{margin:0 0 0 12mm}
.bonus div{height:9mm;border-bottom:.7pt solid #999}
.rate{display:flex;align-items:center;gap:4mm;border:1pt solid #111;border-radius:5mm;padding:3mm 5mm;margin-top:auto}
.rate p{margin:0;flex:1;font-size:10pt;line-height:1.4}
.rate .ic{margin-left:-1mm}
/* footer */
.ft{display:flex;align-items:center;gap:3mm;border-top:.7pt solid #999;padding-top:2mm;margin-top:4mm;font-size:8.5pt;color:#555}
.ft .t{flex:1;line-height:1.4}
.ft b{color:#111;font-weight:bold}
/* answer key */
.key h2{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:12.5pt;margin:4mm 0 2mm}
.key ol{columns:2;column-gap:10mm;margin:0;padding-left:6mm;font-size:10.5pt}
.key li{margin:0 0 1.4mm}
.key .grid td{width:6.5mm;height:6.5mm;font-size:10pt}
.cheer{display:flex;align-items:center;gap:3mm;margin-top:auto}
.cheer .crab{width:16mm;height:16mm;filter:grayscale(1) contrast(1.15)}
"""


def header(kicker, title, t, fields=True):
    f = (f'<div class="fields"><span>{E(t["name"])}</span><span class="s">{E(t["class"])}</span>'
         f'<span class="s">{E(t["date"])}</span></div>') if fields else ""
    return (f'<div class="hd">{mascot_img()}<div class="hd-t"><p class="hd-k">{E(kicker)}</p>'
            f'<h1>{E(title)}</h1></div><span class="brand">krabsy</span></div>{f}')


def task(n, text, small=""):
    s = f"<small>{E(small)}</small>" if small else ""
    return f'<div class="task"><span class="num">{n}</span><p>{E(text)}{s}</p></div>'


def footer(t, url):
    return (f'<div class="ft">{qr("https://" + url, 13)}<span class="t">{E(t["foot1"])}<br>'
            f'<b>{E(url)}</b></span><span>{E(t["foot2"])}</span></div>')


def doc(pages, lang):
    return (f"<!doctype html><html lang='{lang}'><head><meta charset='utf-8'><style>{font_css()}{CSS}</style>"
            f"</head><body>{''.join(pages)}</body></html>")


def chrome():
    if os.environ.get("CHROME"):
        return os.environ["CHROME"]
    hits = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")))
    if not hits:
        raise SystemExit("No headless Chrome found; set CHROME=/path/to/chrome")
    return hits[-1]


def to_pdf(doc_html, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = pathlib.Path(td) / "sheet.html"
        src.write_text(doc_html, encoding="utf-8")
        subprocess.run([chrome(), "--no-sandbox", "--allow-file-access-from-files", "--no-pdf-header-footer",
                        "--virtual-time-budget=3000", f"--print-to-pdf={out}", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out


# ── flowing reference sheets (verb list, preposition overview) + gap sheets ──
CSS += """
.flowp{display:block}
.flowp .ft{margin-top:5mm}
.sub{color:#555;margin:0 0 3mm;font-size:10pt}
.cols{column-count:2;column-gap:7mm}
.grp{break-inside:avoid-column}
.grp h2{break-after:avoid;margin:3mm 0 1mm;font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:11pt}
.grp h2 small{font-family:'Nunito',Arial,sans-serif;color:#555;font-size:8pt}
table.vl{width:100%;border-collapse:collapse;font-size:8.2pt;margin-bottom:2mm}
.vl th{text-align:left;font-size:6.5pt;text-transform:uppercase;letter-spacing:.4px;color:#555;font-weight:normal;padding:0 1mm 1mm}
.vl td{padding:.75mm 1mm;border-top:.4pt solid #ccc;vertical-align:top}
.vl td:first-child{font-weight:bold}
.vl td.m{color:#444}
.vl tr{break-inside:avoid}
ol.sent{padding-left:7mm;margin:1mm 0 3mm}
ol.sent li{font-size:11.5pt;margin:0 0 4.6mm;line-height:1.5;padding-left:1mm}
ol.sent .gap{width:30mm;height:5mm;vertical-align:-1mm}
.hint{color:#555}
.wbox{border:1pt dashed #555;border-radius:4mm;padding:2.5mm 4mm;font-size:11.5pt;line-height:1.7;margin:0 0 3mm}
.wbox span{color:#555;font-size:9.5pt;margin-right:2mm}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:5mm 8mm}
.scol{border:.9pt solid #111;border-radius:4mm;padding:3mm 4mm 2mm}
.scol h3{margin:0 0 1mm;font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:11pt}
.sex{color:#555;margin:0 0 1mm;font-style:italic;font-size:10pt}
.sline{border-bottom:.8pt solid #999;height:9mm}
.key ol.sent li{font-size:10.5pt;margin-bottom:2.2mm}
.stack{display:flex;flex-direction:column;gap:3mm;margin-top:auto}
.stack .tip,.stack .rate{margin-top:0}
"""


def rate(t):
    return f'<div class="rate"><p>{E(t["rate"])}</p>{"".join(icon("shell", 10) for _ in range(5))}</div>'


def tip(text_html):
    return f'<div class="tip">{mascot_img()}<div class="bub">{text_html}</div></div>'


def cheer(t):
    return f'<div class="cheer">{mascot_img()}<span>{E(t["cheer"])}</span></div>'
CSS += """
ol.sent.tight li{margin-bottom:3.1mm;line-height:1.4}
"""
