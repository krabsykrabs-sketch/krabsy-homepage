#!/usr/bin/env python3
"""One-page teacher guide (DE): irregular verbs in a cover lesson with Krabsy.

Written for upload to 4teachers ("Interaktive Materialien", see
docs/outreach-4teachers-2026-11-25.md). Facts must match the live site:
class mode (docs/classroom-concept.md "Phase 2 as built"), Verb-Diplom levels
(docs/brief-verb-diplom.md), worksheet page.

Output: docs/4teachers/krabsy-vertretungsstunde-unregelmaessige-verben.pdf
Needs:  segno (QR codes): pip install segno
Run:    python3 tools/generate_teacher_guide.py
"""
import pathlib
import sys
import tempfile

import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = ROOT / "homepage" / "lib" / "fonts"
OUT = ROOT / "docs" / "4teachers" / "krabsy-vertretungsstunde-unregelmaessige-verben.pdf"


def qr(url):
    return segno.make(url, error="m").svg_inline(scale=3, dark="#2c2a3a", border=0)


def font_css():
    f = lambda n: (FONTS / n).as_uri()
    return f"""
@font-face{{font-family:'Fredoka One';src:url('{f("fredoka-one-400-latin.woff2")}') format('woff2')}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin-ext.woff2")}') format('woff2');unicode-range:U+0100-024F}}
"""


CSS = """
@page{size:A4;margin:13mm 14mm 20mm}
*{box-sizing:border-box}
body{font-family:'Nunito',Arial,sans-serif;color:#2c2a3a;font-size:9.8pt;line-height:1.38;margin:0}
h1{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:17.5pt;line-height:1.15;margin:0}
h2{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:11.5pt;margin:0 0 1.5mm;color:#2c2a3a}
.brand{font-family:'Fredoka One',Arial,sans-serif;font-size:11pt;color:#e07a64}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5pt solid #f2937e;padding-bottom:2mm;margin-bottom:2mm}
.sub{color:#6e6c80;margin:0 0 3.5mm;font-size:9.5pt}
.box{border:.6pt solid #d9d7e0;border-radius:2.5mm;padding:2.6mm 3.2mm;margin-bottom:3mm}
.prep{display:flex;gap:4mm;align-items:center;background:#f3fbf9;border-color:#bfe9df}
.prep ol{margin:0;padding-left:5mm}
.prep li{margin-bottom:.8mm}
.qr{text-align:center;font-size:7.5pt;color:#6e6c80;flex:none}
.qr svg{display:block;margin:0 auto 1mm}
table.plan{width:100%;border-collapse:collapse;margin:0 0 3mm}
.plan td{padding:1.9mm 2mm;border-top:.5pt solid #e6e4ec;vertical-align:top}
.plan tr:first-child td{border-top:none}
.plan td.t{width:17mm;font-family:'Fredoka One',Arial,sans-serif;color:#e07a64;white-space:nowrap}
.plan td.w{width:37mm;font-weight:bold}
.plan small{color:#6e6c80}
.url{font-weight:bold;color:#1f9e85;white-space:nowrap}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.cols .box{margin:0}
.box p{margin:0}
.box ul{margin:0;padding-left:4.5mm}
.box li{margin-bottom:.6mm}
.foot{position:fixed;bottom:0;left:0;right:0;font-size:8pt;color:#6e6c80;border-top:.5pt solid #d9d7e0;padding-top:1.5mm;display:flex;justify-content:space-between}
"""

JOIN = "krabsy.com/de/klasse/"
BODY = f"""
<div class="foot"><span>Krabsy · kostenlos für den Unterricht, ohne Anmeldung und ohne Werbung · krabsy.com/de/lehrkraefte/</span><span>Stand: November 2026</span></div>
<div class="top"><h1>Unregelmäßige Verben in der Vertretungsstunde</h1><span class="brand">krabsy</span></div>
<p class="sub">45 Minuten, Klasse 5–8 · Handy, Tablet oder Computerraum · Wiederholung von <i>go – went – gone</i> &amp; Co.
mit Online-Übung, Arbeitsblatt und Verb-Diplom. Die Fachlehrkraft sieht danach, welche Verben die Klasse noch übt.</p>

<div class="box prep">
  <div>
    <h2>Vorbereitung (5 Minuten, vor der Stunde)</h2>
    <ol>
      <li><span class="url">krabsy.com/de/lehrkraefte/klasse-erstellen/</span> öffnen, einen Namen für die Klasse eingeben (z.&nbsp;B. „6b“).
        Sie bekommen einen <b>Code</b> für die Schülerinnen und Schüler und einen <b>privaten Link</b> zu Ihrer Übersicht.
        Kein Konto, keine E-Mail.</li>
      <li>Den privaten Link als Lesezeichen speichern: Er ist der einzige Zugang zur Übersicht.</li>
      <li>Optional: das Arbeitsblatt „Die drei Formen“ kopieren
        (<span class="url">krabsy.com/de/unregelmaessige-verben/arbeitsblaetter/</span>, mit Lösungsblatt).</li>
    </ol>
  </div>
  <div class="qr">{qr("https://" + JOIN)}Beitreten:<br>{JOIN}</div>
</div>

<h2>Ablauf</h2>
<table class="plan">
  <tr><td class="t">0–5</td><td class="w">Beitreten</td>
      <td>Code an die Tafel. Die Kinder öffnen <span class="url">{JOIN}</span> (oder den QR-Code oben) und tippen Code und Vornamen ein.</td></tr>
  <tr><td class="t">5–17</td><td class="w">Sprint</td>
      <td><span class="url">krabsy.com/de/unregelmaessige-verben/sprint/</span>: Die Kinder tippen zu jedem Verb die fehlenden Formen,
        z.&nbsp;B. <i>go → ___ → ___</i>. Jede Runde ist kurz; Ziel ist die eigene Bestzeit.</td></tr>
  <tr><td class="t">17–29</td><td class="w">Arbeitsblatt</td>
      <td>Geräte zur Seite. „Die drei Formen“ (20 Verben) allein ausfüllen, dann mit dem Nachbarn vergleichen und mit dem Lösungsblatt prüfen.
        <small>Ohne Kopien: an der Tafel fünf Verben aus dem Sprint gemeinsam ergänzen.</small></td></tr>
  <tr><td class="t">29–41</td><td class="w">Verb-Diplom</td>
      <td><span class="url">krabsy.com/de/unregelmaessige-verben/verb-diplom/</span>: <b>Bronze</b> = 15 häufige Verben, zu jedem die 2. und 3. Form,
        höchstens 3 Fehler. Wer besteht, druckt die Urkunde (oder macht ein Foto) und versucht <b>Silber</b> (30 Verben) oder <b>Gold</b> (45).
        <small>Wer nicht besteht, sieht die Verben zum Üben und startet neu.</small></td></tr>
  <tr><td class="t">41–45</td><td class="w">Abschluss</td>
      <td>Ihre Übersicht öffnen: Dort stehen die Verben, bei denen die Klasse noch unsicher ist. Drei davon an die Tafel; das ist die Hausaufgabe.</td></tr>
</table>

<div class="cols">
  <div class="box">
    <h2>Für die Fachlehrkraft</h2>
    <p>Geben Sie den privaten Link an die Englischlehrkraft weiter. Dort sieht sie pro Klasse und pro Kind:
      wer geübt hat, wie viele Antworten richtig waren und welche Verben noch unsicher sind. Die Klasse kann weiter
      mit demselben Code üben, auch zu Hause.</p>
  </div>
  <div class="box">
    <h2>Datenschutz in Kürze</h2>
    <ul>
      <li>Die Kinder tippen nur ihren Vornamen, kein Konto, keine E-Mail, kein Passwort.</li>
      <li>Ohne Klassencode wird nichts über die Kinder gespeichert. Keine Werbung, keine Cookies.</li>
      <li>Server in Deutschland; Klassen ohne Aktivität werden nach 6 Monaten gelöscht.</li>
    </ul>
  </div>
</div>
"""


if __name__ == "__main__":
    import glob
    import os
    import subprocess

    hits = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")))
    exe = os.environ.get("CHROME") or (hits[-1] if hits else None)
    if not exe:
        raise SystemExit("No headless Chrome found; set CHROME=/path/to/chrome")
    html = (f"<!doctype html><html lang='de'><head><meta charset='utf-8'><style>{font_css()}{CSS}</style></head>"
            f"<body>{BODY}</body></html>")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = pathlib.Path(td) / "guide.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run([exe, "--no-sandbox", "--allow-file-access-from-files", "--no-pdf-header-footer",
                        "--virtual-time-budget=3000", f"--print-to-pdf={OUT}", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"{OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
