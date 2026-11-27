#!/usr/bin/env python3
"""Lesson plans for teachers ("Unterrichtsideen"): web page + one-page PDF each.

One source per plan (PLANS below) → both outputs, so page and PDF never
disagree. Plan: docs/lesson-plans-plan.md. Facts must match the live site
(class mode: docs/classroom-concept.md "Phase 2 as built"; Quiz-Raum:
games/quiz-show/CLAUDE.md; Verb-Diplom: docs/brief-verb-diplom.md).

Every [[/path|label]] link is checked against the files under homepage/; the
script stops if one is missing.

Output (DE):
  homepage/de/lehrkraefte/unterrichtsideen/index.html              hub
  homepage/de/lehrkraefte/unterrichtsideen/<slug>/index.html       plan page
  homepage/de/lehrkraefte/unterrichtsideen/<slug>/<slug>.pdf       printable
  docs/4teachers/<file>.pdf                                        upload copy (if set)

Needs: segno (QR codes, pip install segno) and headless Chrome (Playwright's
chrome-headless-shell, or CHROME=/path/to/chrome).
Run:   python3 tools/generate_lesson_plans.py   then  python3 tools/generate_sitemap.py
"""
import glob
import html
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import segno

ROOT = pathlib.Path(__file__).resolve().parent.parent
HP = ROOT / "homepage"
FONTS = HP / "lib" / "fonts"
HUB = "/de/lehrkraefte/unterrichtsideen/"
STAND = "November 2026"
ASSET_V = "2026-11-25"

JOIN = "/de/klasse/"
CREATE = "/de/lehrkraefte/klasse-erstellen/"
QUIZ_T = "/games/quiz-room/teacher.html?lang=de"
QUIZ_J = "/quiz/"
V = "/de/unregelmaessige-verben/"
P = "/de/praepositionen/"

# ── content ──────────────────────────────────────────────────────────────────
# Text uses [[/path|label]] for links (label optional) and plain HTML otherwise.
# Web: a link. PDF: the label followed by the bold URL (or just the URL).

PLANS = [
    {
        "slug": "vertretungsstunde-unregelmaessige-verben",
        "title": "Unregelmäßige Verben in der Vertretungsstunde",
        "seo_title": "Vertretungsstunde Englisch: unregelmäßige Verben (45 Min., Klasse 5–8)",
        "desc": "Fertiger Stundenablauf für 45 Minuten: unregelmäßige Verben mit Online-Sprint, "
                "Arbeitsblatt mit Lösung und Verb-Diplom. Kostenlos, ohne Anmeldung, mit Klassenübersicht.",
        "teaser": "Sprint, Arbeitsblatt und Verb-Diplom. Danach sieht die Fachlehrkraft, welche Verben die Klasse noch übt.",
        "lead": "Wiederholung von <em lang=\"en\">go – went – gone</em> &amp; Co. mit Online-Übung, Arbeitsblatt "
                "und Verb-Diplom. Funktioniert auch fachfremd. Die Englischlehrkraft sieht danach, welche Verben "
                "die Klasse noch übt.",
        "glance": {
            "Klasse": "5–8", "Niveau": "A1–A2", "Dauer": "45 Minuten",
            "Geräte": "Handy, Tablet oder Computerraum (auch zu zweit)",
            "Material": "Arbeitsblatt „Die drei Formen“ (optional)",
            "Lösungen": "ja, Lösungsblatt im PDF des Arbeitsblatts",
        },
        "minutes": 45,
        "level": "Klasse 5–8",
        "teaches": "Englische unregelmäßige Verben: die drei Formen",
        "qr": JOIN,
        "qr_label": "Beitreten",
        "prep": [
            f"[[{CREATE}]] öffnen und einen Namen für die Klasse eingeben (z.&nbsp;B. „6b“). Sie bekommen einen "
            "Code für die Kinder und einen privaten Link zu Ihrer Übersicht. Kein Konto, keine E-Mail.",
            "Den privaten Link als Lesezeichen speichern: Er ist der einzige Zugang zur Übersicht.",
            f"Optional: das Arbeitsblatt „Die drei Formen“ kopieren ([[{V}arbeitsblaetter/|Arbeitsblätter]], mit Lösungsblatt).",
        ],
        "steps": [
            ("0–5", "Beitreten",
             f"Code an die Tafel. Die Kinder öffnen [[{JOIN}]] (oder den QR-Code) und tippen Code und Vornamen ein."),
            ("5–17", "Sprint",
             f"[[{V}sprint/|Sprint]]: Zu jedem Verb die fehlenden Formen tippen, z.&nbsp;B. "
             "<em lang=\"en\">go → ___ → ___</em>. Jede Runde ist kurz; Ziel ist die eigene Bestzeit."),
            ("17–29", "Arbeitsblatt",
             "Geräte zur Seite. „Die drei Formen“ (20 Verben) allein ausfüllen, dann mit dem Nachbarn vergleichen "
             "und mit dem Lösungsblatt prüfen. Ohne Kopien: fünf Verben aus dem Sprint gemeinsam an der Tafel ergänzen."),
            ("29–41", "Verb-Diplom",
             f"[[{V}verb-diplom/|Verb-Diplom]]: Bronze = 15 häufige Verben, zu jedem die 2. und 3. Form, höchstens "
             "3 Fehler. Wer besteht, druckt die Urkunde (oder macht ein Foto) und versucht Silber (30 Verben) oder "
             "Gold (45). Wer nicht besteht, sieht die Verben zum Üben und startet neu."),
            ("41–45", "Abschluss",
             "Ihre Übersicht öffnen: Dort stehen die Verben, bei denen die Klasse noch unsicher ist. Drei davon an "
             "die Tafel; das ist die Hausaufgabe."),
        ],
        "easier": f"Sprint nur mit den häufigsten Verben: [[{V}sprint/?difficulty=1|Sprint, Stufe 1]]. "
                  "Beim Arbeitsblatt zu zweit arbeiten.",
        "harder": f"Silber oder Gold im Verb-Diplom. Wer fertig ist: [[{V}type-race/|Type Race]] gegen die Uhr.",
        "offline": f"Arbeitsblätter „Die drei Formen“ und „Lückensätze“ ([[{V}arbeitsblaetter/|Arbeitsblätter]]). "
                   "Partnerquiz: Eine Person nennt das Verb, die andere die beiden Formen; nach zehn Verben tauschen.",
        "after": "Geben Sie den privaten Link an die Englischlehrkraft weiter. Sie sieht pro Klasse und pro Kind, "
                 "wer geübt hat, wie viele Antworten richtig waren und welche Verben noch unsicher sind. Die Klasse "
                 "kann mit demselben Code weiterüben, auch zu Hause.",
        "privacy": [
            "Die Kinder tippen nur ihren Vornamen: kein Konto, keine E-Mail, kein Passwort.",
            "Ohne Klassencode wird nichts über die Kinder gespeichert. Keine Werbung, keine Cookies.",
            "Server in Deutschland; Klassen ohne Aktivität werden nach 6 Monaten gelöscht.",
        ],
        "copy_to": ROOT / "docs" / "4teachers" / "krabsy-vertretungsstunde-unregelmaessige-verben.pdf",
    },
    {
        "slug": "praepositionen-in-on-at",
        "title": "in, on, at: Präpositionen der Zeit und des Ortes",
        "seo_title": "Englisch Präpositionen in, on, at: Unterrichtsstunde (45 Min., Klasse 5–6)",
        "desc": "Fertiger Stundenablauf für 45 Minuten zu in, on, at (Zeit und Ort): Einstieg an der Tafel, "
                "Arbeitsblatt mit Lösung, Online-Sprint und Live-Quiz. Kostenlos, ohne Anmeldung.",
        "teaser": "Regel an der Tafel entdecken, auf Papier üben, im Sprint festigen und mit dem Live-Quiz abschließen.",
        "lead": "Die Klasse entdeckt die Regeln für <em lang=\"en\">in, on, at</em> selbst, übt sie auf dem "
                "Arbeitsblatt und spielt zum Schluss gemeinsam im Quiz-Raum.",
        "glance": {
            "Klasse": "5–6", "Niveau": "A1", "Dauer": "45 Minuten",
            "Geräte": "Handy, Tablet oder Computerraum (auch zu zweit); Beamer für den Quiz-Raum",
            "Material": "Arbeitsblatt „Zeit und Ort: in, on, at …“",
            "Lösungen": "ja, Lösungsblatt im PDF des Arbeitsblatts",
        },
        "minutes": 45,
        "level": "Klasse 5–6",
        "teaches": "Englische Präpositionen der Zeit und des Ortes: in, on, at",
        "qr": QUIZ_J,
        "qr_label": "Quiz beitreten",
        "prep": [
            f"Das Arbeitsblatt „Zeit und Ort: in, on, at …“ kopieren "
            f"([[{P}arbeitsblaetter/|Arbeitsblätter]], 15 Lückensätze mit Wortkasten und Lösungsblatt).",
            f"Den [[{QUIZ_T}|Quiz-Raum]] vorbereiten: Präpositionen, Schwierigkeit 1, 10 Fragen, 20 Sekunden. "
            "Die Fragen sehen Sie vorher und können sie tauschen.",
            f"Optional: eine Klasse erstellen ([[{CREATE}]]). Dann zählen Sprint und Quiz in Ihre Übersicht.",
        ],
        "steps": [
            ("0–8", "Einstieg an der Tafel",
             "Drei Sätze anschreiben: <em lang=\"en\">My birthday is ___ July. · The party is ___ Saturday. · "
             "The film starts ___ 7 o'clock.</em> Die Klasse rät; dann die Regel festhalten: "
             "<em lang=\"en\">in</em> + Monat/Jahr, <em lang=\"en\">on</em> + Tag/Datum, <em lang=\"en\">at</em> + Uhrzeit. "
             "Ebenso Orte: <em lang=\"en\">in the box, on the table, at the bus stop</em>."),
            ("8–20", "Arbeitsblatt",
             "15 Lückensätze mit Wortkasten allein ausfüllen, mit dem Nachbarn vergleichen, mit dem Lösungsblatt prüfen."),
            ("20–32", "Sprint",
             f"[[{P}sprint/?difficulty=1|Sprint Präpositionen, Stufe 1]]: zwei Runden. Neben Zeit und Ort kommen "
             "auch Wendungen wie <em lang=\"en\">good at</em> vor. Am Ende zeigt der Sprint die Sätze, die verpasst wurden."),
            ("32–42", "Quiz-Raum",
             f"Den vorbereiteten Raum öffnen, Code und QR-Code an den Beamer. Die Kinder kommen über [[{QUIZ_J}]] "
             "mit Code und Vornamen dazu. Nach jeder Frage: Lösung und Top 5."),
            ("42–45", "Abschluss",
             "Am Ende zeigt der Quiz-Raum die Wörter, die die Klasse am häufigsten falsch hatte. Zwei davon "
             "gemeinsam begründen; drei eigene Sätze dazu sind die Hausaufgabe."),
        ],
        "easier": f"Die [[{P}uebersicht/|Übersicht aller Regeln]] während des Arbeitsblatts offen lassen. "
                  "Im Quiz-Raum 30 Sekunden pro Frage wählen.",
        "harder": f"Das zweite Blatt „Nach Verben und Adjektiven“ (gleiche Seite wie oben) oder "
                  f"[[{P}fill-the-gap/|Fill the Gap]].",
        "offline": "Statt Sprint und Quiz: Ping-Pong zu zweit. Eine Person "
                   "nennt eine Zeit oder einen Ort (<em lang=\"en\">Monday, 2012, the kitchen</em>), die andere "
                   "antwortet mit der passenden Präposition.",
        "after": f"Als Hausaufgabe eignen sich die [[{P}karteikarten/|Karteikarten]]. Mit Klassencode zeigt Ihre "
                 "Übersicht, welche Präpositionen noch unsicher sind.",
        "privacy": [
            "Kein Konto, keine E-Mail, keine Werbung, keine Cookies. Im Quiz-Raum nur der Vorname; nach dem Quiz wird nichts gespeichert.",
            "Mit Klassencode: nur Vorname und Antworten, Server in Deutschland, Löschung nach 6 Monaten ohne Aktivität.",
        ],
    },
    {
        "slug": "quiz-raum-stundenabschluss",
        "title": "Der Quiz-Raum als Stundenabschluss",
        "seo_title": "Live-Quiz Englisch zum Stundenende: unregelmäßige Verben und Präpositionen (15 Min.)",
        "desc": "Zehn bis fünfzehn Minuten Live-Quiz am Ende der Englischstunde: Jedes Kind spielt am eigenen Gerät, "
                "am Ende stehen die Wörter, die die Klasse wiederholen sollte. Kostenlos, ohne Anmeldung.",
        "teaser": "Ein Live-Quiz am eigenen Gerät. Am Ende stehen die Wörter, die die Klasse wiederholen sollte.",
        "lead": "Jedes Kind läuft am eigenen Gerät als Figur durch einen 3D-Raum und beantwortet die Fragen, die Sie "
                "ausgewählt haben. Am Ende sehen alle, welche Wörter noch wackeln.",
        "glance": {
            "Klasse": "5–9", "Niveau": "A1–A2", "Dauer": "10–15 Minuten",
            "Geräte": "ein Gerät pro Kind (oder zu zweit), Beamer oder großer Bildschirm",
            "Material": "keins",
            "Themen": "unregelmäßige Verben oder Präpositionen",
        },
        "minutes": 15,
        "level": "Klasse 5–9",
        "teaches": "Wiederholung: englische unregelmäßige Verben oder Präpositionen",
        "qr": QUIZ_J,
        "qr_label": "Quiz beitreten",
        "prep": [
            f"Den [[{QUIZ_T}|Quiz-Raum]] öffnen: Thema, Schwierigkeit (1 = häufigste Wörter), Anzahl der Fragen "
            "(10, 15, 20 oder 30) und Zeit pro Frage (15, 20 oder 30 Sekunden) wählen.",
            "Die Fragenliste ansehen: Fragen tauschen, entfernen oder hinzufügen. Für 10–15 Minuten reichen 10 Fragen.",
            "Bonusrunde: aus, 3 oder 5 Fragen. In der Bonusrunde laufen die Figuren zur richtigen Antwort.",
        ],
        "steps": [
            ("0–2", "Beitreten",
             f"Code und QR-Code an den Beamer. Die Kinder öffnen [[{QUIZ_J}]] und tippen Code und Vornamen ein. "
             "Bis zu 40 Kinder pro Raum."),
            ("2–10", "Quiz",
             "Sie starten jede Frage. Nach jeder Frage zeigt der Raum die Lösung, die Anzahl der Antworten und die Top 5. "
             "Bei Verben folgt die 3. Form immer direkt auf die 2. Form."),
            ("10–12", "Bonusrunde (optional)",
             "Die Antworten liegen als Felder im Raum; wer zur richtigen läuft, bekommt Punkte."),
            ("12–15", "Auswertung",
             "Die Liste „am häufigsten falsch“ gemeinsam ansehen: zwei oder drei Wörter besprechen und "
             "ins Heft schreiben. Das ist der Einstieg für die nächste Stunde."),
        ],
        "easier": "Schwierigkeit 1 und 30 Sekunden pro Frage. Zu zweit an einem Gerät spielen.",
        "harder": "Schwierigkeit 2 oder 3 und 15 Sekunden. Oder 20 Fragen als Wiederholung vor der Klassenarbeit.",
        "offline": "Der Quiz-Raum braucht für jedes Kind (oder jedes Paar) ein Gerät mit Internet. Ohne Geräte: "
                   f"die Fragen aus der Fragenliste vorlesen und auf Papier beantworten lassen, oder ein Arbeitsblatt "
                   f"([[{V}arbeitsblaetter/|Verben]], [[{P}arbeitsblaetter/|Präpositionen]]).",
        "after": f"Haben die Kinder vorher einer Klasse beigetreten ([[{CREATE}|Klasse erstellen]]), zählen ihre "
                 "Quiz-Antworten in Ihre Übersicht. Zum Weiterüben zu Hause: der "
                 f"[[{V}sprint/|Sprint]] mit denselben Wörtern.",
        "privacy": [
            "Die Kinder tippen nur ihren Vornamen. Der Raum läuft über unseren Server; nach dem Quiz wird nichts gespeichert.",
            "Kein Konto, keine E-Mail, keine Werbung, keine Cookies.",
            "Mit Klassencode zählen die Antworten in Ihre Übersicht (nur Vorname und Antworten).",
        ],
    },
]

# ── link markup ──────────────────────────────────────────────────────────────

LINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
MISSING = []


def check_path(path):
    p = path.split("#")[0].split("?")[0]
    f = HP / p.lstrip("/")
    if p.endswith("/"):
        f = f / "index.html"
    if not f.exists():
        MISSING.append(path)


def show_url(path):
    """krabsy.com/... as printed; the teacher-only ?lang=de stays."""
    return "krabsy.com" + (path.rstrip("/") if path in (QUIZ_J, JOIN) else path)


def web(text):
    def rep(m):
        path, label = m.group(1), m.group(2)
        check_path(path)
        return f'<a href="{html.escape(path)}">{label or show_url(path)}</a>'
    return LINK.sub(rep, text)


def pdf(text):
    def rep(m):
        path, label = m.group(1), m.group(2)
        u = f'<span class="url">{html.escape(show_url(path))}</span>'
        return f"{label} ({u})" if label else u
    return LINK.sub(rep, text)


def plain(text):
    return re.sub(r"<[^>]+>", "", LINK.sub(lambda m: m.group(2) or show_url(m.group(1)), text))


def qr_svg(path, scale):
    return segno.make("https://" + show_url(path), error="m").svg_inline(scale=scale, dark="#2c2a3a", border=0)


# ── web pages ────────────────────────────────────────────────────────────────

WEB_CSS = """
    body{background:var(--krabsy-cream)}
    .logo{display:inline-flex;align-items:center;font-family:var(--font-display);font-size:1.6rem;text-decoration:none;color:var(--krabsy-ink);letter-spacing:-0.5px;line-height:1}
    .logo-crab{display:inline-flex;width:1.15em;height:1.15em;align-items:center;justify-content:center;margin:0 -0.04em}
    .logo-crab img{display:block;width:100%;height:100%;object-fit:contain}
    .lp-wrap{max-width:780px;margin:0 auto;padding:0 var(--space-5,20px) var(--space-7,48px);width:100%;box-sizing:border-box}
    .crumbs{font-size:0.82rem;color:var(--krabsy-ink-mute);padding:var(--space-4,16px) 0 0}
    .crumbs a{color:inherit;text-decoration:none}
    .lp-h1{font-family:var(--font-display);font-weight:normal;font-size:clamp(1.6rem,5vw,2.3rem);color:var(--krabsy-ink);margin:10px 0 8px;line-height:1.15}
    .lp-lead{color:var(--krabsy-ink);font-size:1.02rem;margin:0 0 18px;line-height:1.55}
    .lp-wrap a{color:var(--krabsy-ink);text-decoration-color:var(--krabsy-coral);text-underline-offset:2px}
    .lp-card{background:#fff;border:1px solid rgba(44,42,58,0.08);border-radius:16px;padding:18px 20px;margin-bottom:14px;box-shadow:0 2px 10px rgba(31,43,61,0.04)}
    .lp-card h2{font-family:var(--font-display);font-weight:normal;font-size:1.2rem;color:var(--krabsy-ink);margin:0 0 10px}
    .lp-card p{margin:0;line-height:1.55}
    .lp-card ol,.lp-card ul{margin:0;padding-left:1.25em;line-height:1.55}
    .lp-card li{margin-bottom:6px}
    .lp-glance{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:0 0 14px;font-size:0.95rem}
    .lp-glance dt{color:var(--krabsy-ink-mute)}
    .lp-glance dd{margin:0;color:var(--krabsy-ink)}
    .lp-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
    .lp-dl{font-family:var(--font-display);font-size:0.95rem;color:#fff!important;background:var(--krabsy-coral-dark,#e07a64);padding:9px 18px;border-radius:30px;text-decoration:none}
    .lp-dl:hover{filter:brightness(1.05)}
    .lp-meta{font-size:0.82rem;color:var(--krabsy-ink-mute)}
    .lp-prep{display:flex;gap:18px;align-items:flex-start}
    .lp-prep ol{flex:1}
    .lp-qr{flex:none;text-align:center;font-size:0.78rem;color:var(--krabsy-ink-mute)}
    .lp-qr svg{display:block;margin:0 auto 4px;width:96px;height:96px}
    .lp-steps{list-style:none;padding:0!important;margin:0}
    .lp-steps li{display:grid;grid-template-columns:72px 1fr;gap:12px;padding:12px 0;border-top:1px solid #eeecf2;margin:0!important}
    .lp-steps li:first-child{border-top:none;padding-top:0}
    .lp-t{font-family:var(--font-display);color:var(--krabsy-coral-dark,#e07a64);white-space:nowrap}
    .lp-t small{display:block;font-family:var(--font-body,inherit);font-size:0.75rem;color:var(--krabsy-ink-mute)}
    .lp-steps b{display:block;margin-bottom:2px}
    .lp-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .lp-cols .lp-card{margin:0}
    .lp-note{background:#f3fbf9;border-color:#bfe9df}
    .lp-small{font-size:0.9rem;color:var(--krabsy-ink-mute);line-height:1.5}
    .lp-hub{display:grid;gap:14px}
    .lp-chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
    .lp-chip{font-size:0.78rem;background:#f3fbf9;border:1px solid #bfe9df;border-radius:20px;padding:2px 10px;color:var(--krabsy-ink)}
    .lp-card h2 a{text-decoration:none}
    @media (max-width:600px){
      .lp-cols{grid-template-columns:1fr}
      .lp-prep{flex-direction:column}
      .lp-qr{display:none}
      .lp-steps li{grid-template-columns:1fr;gap:2px}
    }
"""


def page(title, desc, path, crumbs, body, ld):
    url = "https://krabsy.com" + path
    lds = "\n".join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <script>/* krabsy_lang-from-url */try{{localStorage.setItem("krabsy_lang","de");}}catch(_){{}}</script>
  <!-- generated by tools/generate_lesson_plans.py -->
  <title>{html.escape(title)} — Krabsy</title>
  <meta name="description" content="{html.escape(desc)}">
  <link rel="canonical" href="{url}">
  <link rel="alternate" hreflang="de" href="{url}">
  <link rel="alternate" hreflang="x-default" href="{url}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico?v=2026-11-27">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png?v=2026-11-27">
  <meta property="og:title" content="{html.escape(title)} — Krabsy">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:image" content="https://krabsy.com/og-image.png">
  <meta property="og:url" content="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Krabsy">
  <meta property="og:locale" content="de_DE">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-27-rv">
  <style>{WEB_CSS}</style>
{lds}
</head><body>
  <div class="k-page">
    <header class="k-page-header">
      <a href="/de/" class="logo" aria-label="Krabsy">
        <span>kr</span>
        <span class="logo-crab" aria-hidden="true"><img src="/favicon.png?v=2026-11-27" alt="" decoding="async"></span>
        <span>bsy</span>
      </a>
      <div class="k-lang-toggle" role="group" aria-label="Sprache wählen">
        <button class="k-lang-btn is-active" type="button" data-lang="de">DE</button>
        <button class="k-lang-btn" type="button" data-lang="es">ES</button>
      </div>
    </header>
    <main class="lp-wrap">
      <nav class="crumbs">{crumbs}</nav>
{body}
    </main>
    <footer class="k-footer">
      <span id="footer-copyright">© 2026 Krabsy</span>
      <span class="k-footer-legal-sep" aria-hidden="true">·</span>
      <span class="k-footer-legal-mount"></span>
    </footer>
  </div>
  <script src="/lib/krabsy-footer.js?v=2026-11-27h" defer></script>
  <script type="module" src="/lib/krabsy-header.js?v=2026-11-27-rv"></script>
  <script src="/lib/krabsy-lang-switch.js?v=2026-11-27h" defer></script>
  <script src="/lib/krabsy-analytics.js?v=2026-11-22" defer></script>
</body>
</html>
"""


def breadcrumbs(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": "https://krabsy.com" + u}
        for i, (n, u) in enumerate(items)]}


def glance_dl(p):
    rows = "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in p["glance"].items())
    return f'<dl class="lp-glance">{rows}<dt>Kosten</dt><dd>kostenlos, ohne Anmeldung</dd></dl>'


def plan_page(p, kb):
    path = f"{HUB}{p['slug']}/"
    pdf_url = f"{path}{p['slug']}.pdf"
    steps = "".join(
        f'<li><span class="lp-t">{t}<small>Min.</small></span><div><b>{h}</b>{web(x)}</div></li>'
        for t, h, x in p["steps"])
    prep = "".join(f"<li>{web(x)}</li>" for x in p["prep"])
    priv = "".join(f"<li>{x}</li>" for x in p["privacy"])
    others = " · ".join(f'<a href="{HUB}{o["slug"]}/">{o["title"]}</a>' for o in PLANS if o is not p)
    check_path(p["qr"])
    body = f"""      <h1 class="lp-h1">{p['title']}</h1>
      <p class="lp-lead">{p['lead']}</p>
      <section class="lp-card" aria-label="Auf einen Blick">
        {glance_dl(p)}
        <div class="lp-actions"><a class="lp-dl" href="{pdf_url}" download>Stundenablauf als PDF</a><span class="lp-meta">PDF · 1 Seite · {kb} KB · zum Ausdrucken und Weitergeben</span></div>
      </section>
      <section class="lp-card"><h2>Vorbereitung</h2>
        <div class="lp-prep"><ol>{prep}</ol><div class="lp-qr">{qr_svg(p['qr'], 3)}{p['qr_label']}:<br>{show_url(p['qr'])}</div></div>
      </section>
      <section class="lp-card"><h2>Ablauf</h2><ol class="lp-steps">{steps}</ol></section>
      <div class="lp-cols">
        <section class="lp-card"><h2>Leichter</h2><p>{web(p['easier'])}</p></section>
        <section class="lp-card"><h2>Schwerer</h2><p>{web(p['harder'])}</p></section>
      </div>
      <section class="lp-card"><h2>Ohne Geräte oder ohne WLAN</h2><p>{web(p['offline'])}</p></section>
      <section class="lp-card"><h2>Danach</h2><p>{web(p['after'])}</p></section>
      <section class="lp-card lp-note"><h2>Datenschutz in Kürze</h2><ul>{priv}</ul></section>
      <p class="lp-small">Weitere Stunden: {others}. Alle Ideen: <a href="{HUB}">Unterrichtsideen</a> · <a href="/de/lehrkraefte/">Für Lehrkräfte</a>. Stand: {STAND}.</p>"""
    crumbs = (f'<a href="/de/lehrkraefte/">Für Lehrkräfte</a> › <a href="{HUB}">Unterrichtsideen</a> › '
              f'{p["title"]}')
    ld = [breadcrumbs([("Für Lehrkräfte", "/de/lehrkraefte/"), ("Unterrichtsideen", HUB), (p["title"], path)]),
          {"@context": "https://schema.org", "@type": "LearningResource", "name": p["title"],
           "description": p["desc"], "url": "https://krabsy.com" + path, "inLanguage": "de",
           "learningResourceType": "Unterrichtsentwurf", "educationalLevel": p["level"],
           "timeRequired": f"PT{p['minutes']}M", "teaches": p["teaches"], "isAccessibleForFree": True,
           "audience": {"@type": "EducationalAudience", "educationalRole": "teacher"},
           "encoding": {"@type": "MediaObject", "contentUrl": "https://krabsy.com" + pdf_url,
                        "encodingFormat": "application/pdf"},
           "publisher": {"@type": "Organization", "name": "Krabsy", "url": "https://krabsy.com/"}}]
    return path, page(p["seo_title"], p["desc"], path, crumbs, body, ld)


def hub_page():
    cards = ""
    for p in PLANS:
        g = p["glance"]
        chips = "".join(f'<span class="lp-chip">{x}</span>' for x in
                        (f"Klasse {g['Klasse']}", g["Niveau"], g["Dauer"]))
        u = f"{HUB}{p['slug']}/"
        cards += f"""        <section class="lp-card"><h2><a href="{u}">{p['title']}</a></h2>
          <div class="lp-chips">{chips}</div>
          <p>{p['teaser']}</p>
          <div class="lp-actions" style="margin-top:12px"><a class="lp-dl" href="{u}">Ablauf ansehen</a><a href="{u}{p['slug']}.pdf" download>PDF (1 Seite)</a></div>
        </section>
"""
    body = f"""      <h1 class="lp-h1">Unterrichtsideen für Englisch: fertige Stunden mit Krabsy</h1>
      <p class="lp-lead">Stundenabläufe mit Zeitplan, Material und Plan B ohne Geräte. Jede Stunde gibt es als Seite
        und als einseitiges PDF zum Ausdrucken oder Weitergeben, zum Beispiel für die Vertretung. Alles kostenlos
        und ohne Anmeldung.</p>
      <div class="lp-hub">
{cards}      </div>
      <p class="lp-small">Mehr Material: <a href="/de/unregelmaessige-verben/arbeitsblaetter/">Arbeitsblätter unregelmäßige Verben</a> ·
        <a href="/de/praepositionen/arbeitsblaetter/">Arbeitsblätter Präpositionen</a> · <a href="/de/lehrkraefte/">Für Lehrkräfte</a>.
        Sie wünschen sich eine Stunde zu einem anderen Thema? Schreiben Sie uns an <a href="mailto:hallo@krabsy.com">hallo@krabsy.com</a>.</p>"""
    crumbs = '<a href="/de/lehrkraefte/">Für Lehrkräfte</a> › Unterrichtsideen'
    ld = [breadcrumbs([("Für Lehrkräfte", "/de/lehrkraefte/"), ("Unterrichtsideen", HUB)]),
          {"@context": "https://schema.org", "@type": "ItemList", "name": "Unterrichtsideen Englisch",
           "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["title"],
                                "url": f"https://krabsy.com{HUB}{p['slug']}/"} for i, p in enumerate(PLANS)]}]
    return page("Unterrichtsideen Englisch: fertige Stunden zu Verben und Präpositionen",
                "Kostenlose Stundenabläufe für den Englischunterricht (Klasse 5–9): unregelmäßige Verben, "
                "in/on/at und Live-Quiz. Mit Zeitplan, Arbeitsblatt, Plan B ohne Geräte und PDF zum Ausdrucken.",
                HUB, crumbs, body, ld)


# ── PDF ──────────────────────────────────────────────────────────────────────

def font_css():
    f = lambda n: (FONTS / n).as_uri()
    return f"""
@font-face{{font-family:'Fredoka One';src:url('{f("fredoka-one-400-latin.woff2")}') format('woff2')}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin.woff2")}') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2190-21FF}}
@font-face{{font-family:'Nunito';src:url('{f("nunito-400-latin-ext.woff2")}') format('woff2');unicode-range:U+0100-024F}}
"""


PDF_CSS = """
@page{size:A4;margin:12mm 14mm 18mm}
*{box-sizing:border-box}
body{font-family:'Nunito',Arial,sans-serif;color:#2c2a3a;font-size:9.3pt;line-height:1.33;margin:0}
h1{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:17pt;line-height:1.15;margin:0}
h2{font-family:'Fredoka One',Arial,sans-serif;font-weight:normal;font-size:11pt;margin:0 0 1.3mm}
.brand{font-family:'Fredoka One',Arial,sans-serif;font-size:11pt;color:#e07a64}
.top{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5pt solid #f2937e;padding-bottom:2mm;margin-bottom:2mm}
.sub{color:#6e6c80;margin:0 0 2.5mm;font-size:9.3pt}
.glance{display:flex;flex-wrap:wrap;gap:1mm 5mm;font-size:8.6pt;margin:0 0 3mm}
.glance b{color:#6e6c80;font-weight:normal}
.box{border:.6pt solid #d9d7e0;border-radius:2.5mm;padding:2.4mm 3.2mm;margin-bottom:2.6mm}
.prep{display:flex;gap:4mm;align-items:center;background:#f3fbf9;border-color:#bfe9df}
.prep ol{margin:0;padding-left:5mm;flex:1}
.prep li{margin-bottom:.7mm}
.qr{text-align:center;font-size:7.5pt;color:#6e6c80;flex:none}
.qr svg{display:block;margin:0 auto 1mm}
table.plan{width:100%;border-collapse:collapse;margin:0 0 2.6mm}
.plan td{padding:1.7mm 2mm;border-top:.5pt solid #e6e4ec;vertical-align:top}
.plan tr:first-child td{border-top:none}
.plan td.t{width:15mm;font-family:'Fredoka One',Arial,sans-serif;color:#e07a64;white-space:nowrap}
.plan td.w{width:34mm;font-weight:bold}
.url{font-weight:bold;color:#1f9e85}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:2.6mm;margin-bottom:2.6mm}
.cols .box{margin:0}
.box p{margin:0}
.box ul{margin:0;padding-left:4.5mm}
.foot{position:fixed;bottom:0;left:0;right:0;font-size:8pt;color:#6e6c80;border-top:.5pt solid #d9d7e0;padding-top:1.5mm;display:flex;justify-content:space-between}
"""


def plan_pdf_html(p):
    g = p["glance"]
    glance = "".join(f"<span><b>{k}:</b> {v}</span>" for k, v in g.items())
    steps = "".join(f'<tr><td class="t">{t}</td><td class="w">{h}</td><td>{pdf(x)}</td></tr>' for t, h, x in p["steps"])
    prep = "".join(f"<li>{pdf(x)}</li>" for x in p["prep"])
    priv = "".join(f"<li>{x}</li>" for x in p["privacy"])
    body = f"""
<div class="foot"><span>Krabsy · kostenlos für den Unterricht, ohne Anmeldung und ohne Werbung · <span class="url">krabsy.com{HUB}</span></span><span>Stand: {STAND}</span></div>
<div class="top"><h1>{p['title']}</h1><span class="brand">krabsy</span></div>
<p class="sub">{p['lead']}</p>
<div class="glance">{glance}</div>
<div class="box prep"><div style="flex:1"><h2>Vorbereitung</h2><ol>{prep}</ol></div>
<div class="qr">{qr_svg(p['qr'], 3)}{p['qr_label']}: <span class="url">{show_url(p['qr'])}</span></div></div>
<h2>Ablauf (Minuten)</h2>
<table class="plan">{steps}</table>
<div class="cols"><div class="box"><h2>Leichter</h2><p>{pdf(p['easier'])}</p></div>
<div class="box"><h2>Schwerer</h2><p>{pdf(p['harder'])}</p></div></div>
<div class="cols"><div class="box"><h2>Ohne Geräte oder ohne WLAN</h2><p>{pdf(p['offline'])}</p></div>
<div class="box"><h2>Danach</h2><p>{pdf(p['after'])}</p></div></div>
<div class="box"><h2>Datenschutz in Kürze</h2><ul>{priv}</ul></div>
"""
    return (f'<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><style>{font_css()}{PDF_CSS}</style>'
            f"</head><body>{body}</body></html>")


def chrome():
    hits = sorted(glob.glob(os.path.expanduser(
        "~/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell")))
    exe = os.environ.get("CHROME") or (hits[-1] if hits else None)
    if not exe:
        raise SystemExit("No headless Chrome found; set CHROME=/path/to/chrome")
    return exe


def to_pdf(doc, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        src = pathlib.Path(td) / "plan.html"
        src.write_text(doc, encoding="utf-8")
        subprocess.run([chrome(), "--no-sandbox", "--allow-file-access-from-files", "--no-pdf-header-footer",
                        "--virtual-time-budget=3000", f"--print-to-pdf={out}", src.as_uri()],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    pages = len(re.findall(rb"/Type\s*/Page[^s]", out.read_bytes()))
    if pages != 1:
        print(f"WARNING: {out.name} has {pages} pages (should be 1)", file=sys.stderr)
    return out.stat().st_size // 1024


def main():
    # Validate all links first (web() records missing targets).
    for p in PLANS:
        for t in [p["easier"], p["harder"], p["offline"], p["after"], *p["prep"], *(s[2] for s in p["steps"])]:
            web(t)
        check_path(p["qr"])
    if MISSING:
        raise SystemExit("Missing link targets under homepage/:\n  " + "\n  ".join(sorted(set(MISSING))))

    for p in PLANS:
        d = HP / HUB.strip("/") / p["slug"]
        pdf_out = d / f"{p['slug']}.pdf"
        kb = to_pdf(plan_pdf_html(p), pdf_out)
        if p.get("copy_to"):
            shutil.copyfile(pdf_out, p["copy_to"])
        path, doc = plan_page(p, kb)
        (d / "index.html").write_text(doc, encoding="utf-8")
        print(f"{path}  + {pdf_out.name} ({kb} KB)")
    (HP / HUB.strip("/") / "index.html").write_text(hub_page(), encoding="utf-8")
    print(HUB)


if __name__ == "__main__":
    main()
