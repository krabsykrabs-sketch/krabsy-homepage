#!/usr/bin/env python3
"""Generate printable PDFs for teachers (DE + ES) from content/irregular-verbs.json:

  1. verb list      all verbs grouped by pattern, 2 columns, ~2 pages
  2. forms sheet    "go -> ___ -> ___" rows + answer key
  3. gap sheet      gap sentences with the verb as a hint + answer key

Output:
  homepage/de/unregelmaessige-verben/arbeitsblaetter/*.pdf
  homepage/es/verbos-irregulares/fichas/*.pdf

Look (2026-11-28): tools/worksheet_kit.py — black-and-white copier safe, the
mascot from one file, line icons, QR footer. Keep file names: the PDF URLs are
linked from outside.

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
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from worksheet_kit import (header, task, footer, doc as kit_doc, icon, mascot_img, to_pdf,  # noqa: E402
                           rate, tip, cheer)

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


# Sheet 2 (forms, new look): picture cards, middle form given, word search.
_V = {v["verb"]: v for v in VERBS}


def _need(b):
    if b not in _V:
        raise SystemExit(f"verb missing in catalogue: {b}")
    return _V[b]


PICTURES = [_need(b) for b in ["eat", "drink", "go", "run", "swim", "fly", "sing", "write", "sleep", "drive", "buy", "see"]]
MIDDLE = [_need(b) for b in ["draw", "give", "wear", "speak", "take", "forget"]]
HIDDEN = [_need(b) for b in ["come", "find", "make", "tell", "hear", "leave", "feel", "say"]]  # past forms hidden
# Sheet 3 (gaps): 12 sentences from the top verbs, alternating past / participle sentences.
_ctx = {(i["verb"], i["form"]): i for i in ctx}
GAPS = []
_used = {v["verb"] for v in PICTURES + MIDDLE + HIDDEN}
for n, v in enumerate(spread([v for v in TOP if v["verb"] not in _used], 12)):
    form = "past" if n % 2 == 0 else "participle"
    it = _ctx.get((v["verb"], form))
    if it and it.get("context_sentence", "").count("___") == 1:
        alts = [a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]
        GAPS.append((it["context_sentence"], v["verb"], " / ".join([it["correct_answer"]] + alts)))

# ── copy ─────────────────────────────────────────────────────────────────────
L = {
    "de": {
        "lang": "de",
        "dir": HP / "de" / "unregelmaessige-verben" / "arbeitsblaetter",
        "meaning": "de",
        "practice": "krabsy.com/de/unregelmaessige-verben/sprint/",
        "kicker": "Englisch · Unregelmäßige Verben",
        "foot1": "Weiterüben am Handy oder Tablet, ohne Anmeldung:",
        "foot2": "Krabsy · kostenlos für den Unterricht",
        "rate": "Wie sicher bist du jetzt? Mal die Muscheln aus: eine für „noch unsicher“, fünf für „kann ich!“",
        "cheer": "Geschafft! Die Verben, die noch schwer waren: dreimal laut sagen und morgen noch einmal.",
        "name": "Name:", "date": "Datum:", "class": "Klasse:",
        "key": "Lösungen",
        "list": {
            "file": "unregelmaessige-verben-liste.pdf",
            "title": "Die Verbliste",
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
            "title": "Die drei Formen",
            "t1": "Schreib die beiden fehlenden Formen dazu.",
            "t1s": "Die Bilder helfen dir. Du darfst sie auch ausmalen.",
            "tip": ("<b>Krabsy-Tipp:</b> Sprich die drei Formen laut im Satz: <i>I go</i> – "
                    "<i>yesterday I went</i> – <i>I have gone</i>. Wenn es im Satz gut klingt, stimmt es meistens."),
            "t2": "Hier steht die mittlere Form schon da. Ergänze die anderen beiden.",
            "t3": "Verb-Detektiv: Im Gitter verstecken sich 8 Formen.",
            "t3s": "Sie stehen von links nach rechts oder von oben nach unten. Schreib jede Form und ihre Grundform auf.",
            "t4": "Bonus: Schreib zwei Sätze mit Formen, die du im Gitter gefunden hast.",
            "found": "Gefundene Form", "base": "Grundform",
            "k1": "1. Bilder", "k2": "2. Mittlere Form", "k3": "3. Verb-Detektiv",
        },
        "gaps": {
            "file": "arbeitsblatt-lueckentext.pdf",
            "title": "Lückensätze",
            "task": "Setz das Verb in der richtigen Form ein.",
            "task_s": "Das Verb steht in Klammern hinter dem Satz.",
            "tip": ("<b>Krabsy-Tipp:</b> Steht <i>have</i> oder <i>has</i> vor der Lücke, brauchst du die dritte Form "
                    "(<i>I have <u>seen</u></i>). Steht <i>yesterday</i> oder <i>last week</i> im Satz, meistens die "
                    "zweite (<i>I <u>saw</u> it yesterday</i>)."),
        },
    },
    "es": {
        "lang": "es",
        "dir": HP / "es" / "verbos-irregulares" / "fichas",
        "meaning": "es",
        "practice": "krabsy.com/es/verbos-irregulares/sprint/",
        "kicker": "Inglés · Verbos irregulares",
        "foot1": "Sigue practicando en el celular o la tablet, sin registrarte:",
        "foot2": "Krabsy · gratis para el aula",
        "rate": "¿Qué tan seguro te sientes? Colorea las caracolas: una para «todavía me cuesta», cinco para «¡ya lo sé!»",
        "cheer": "¡Listo! Los verbos que todavía cuestan: dilos tres veces en voz alta y repásalos mañana.",
        "name": "Nombre:", "date": "Fecha:", "class": "Curso:",
        "key": "Soluciones",
        "list": {
            "file": "lista-verbos-irregulares-ingles.pdf",
            "title": "La lista de verbos",
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
            "title": "Las tres formas",
            "t1": "Escribe las dos formas que faltan.",
            "t1s": "Los dibujos te ayudan. También puedes colorearlos.",
            "tip": ("<b>Consejo de Krabsy:</b> Di las tres formas en voz alta dentro de una frase: <i>I go</i> – "
                    "<i>yesterday I went</i> – <i>I have gone</i>. Si suena bien en la frase, casi siempre es correcto."),
            "t2": "Aquí ya está la forma del medio. Completa las otras dos.",
            "t3": "Detective de verbos: en la sopa de letras se esconden 8 formas.",
            "t3s": "Están de izquierda a derecha o de arriba abajo. Escribe cada forma y su infinitivo.",
            "t4": "Extra: escribe dos frases con formas que encontraste en la sopa de letras.",
            "found": "Forma encontrada", "base": "Infinitivo",
            "k1": "1. Dibujos", "k2": "2. Forma del medio", "k3": "3. Detective de verbos",
        },
        "gaps": {
            "file": "ficha-frases-verbos-irregulares.pdf",
            "title": "Completa las frases",
            "task": "Escribe el verbo en la forma correcta.",
            "task_s": "El verbo está entre paréntesis después de la frase.",
            "tip": ("<b>Consejo de Krabsy:</b> Si antes del hueco hay <i>have</i> o <i>has</i>, va la tercera forma "
                    "(<i>I have <u>seen</u></i>). Si en la frase aparece <i>yesterday</i> o <i>last week</i>, casi "
                    "siempre la segunda (<i>I <u>saw</u> it yesterday</i>)."),
        },
    },
}


def doc(t, pages):
    return kit_doc(pages, t.get("lang", "de"))


def verb_list(t):
    c = t["list"]
    th = "".join(f"<th>{h}</th>" for h in c["th"])
    groups = ""
    for key in ("AAA", "ABB", "ABA", "AAB", "ABC"):
        vs = [v for v in VERBS if v["pattern"] == key]
        if not vs:
            continue
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
    return doc(t, [f'<div class="flowp">{header(t["kicker"], c["title"], t, fields=False)}'
                   f'<p class="sub">{E(c["sub"])}</p><div class="cols">{groups}</div>{footer(t, t["practice"])}</div>'])


# word search (deterministic; → and ↓ only). Apart from the hidden words, no form
# of any catalogue verb may be readable in any direction, or pupils find "GO" or
# "BE" in the filler letters (owner, 2026-11-28).
WS_N = 10
FORBIDDEN = sorted({f.upper() for v in VERBS
                    for f in [v["verb"], v["past"], v["pp"], *v["past_alts"], *v["pp_alts"]]
                    if f and f.isalpha() and len(f) >= 2})


def _ws_lines():
    n = WS_N
    lines = [[(y, x) for x in range(n)] for y in range(n)] + [[(y, x) for y in range(n)] for x in range(n)]
    for k in range(-n + 1, n):
        lines.append([(y, y - k) for y in range(n) if 0 <= y - k < n])
        lines.append([(y, k + n - 1 - y) for y in range(n) if 0 <= k + n - 1 - y < n])
    return lines + [l[::-1] for l in lines]


def _stray(g, placed):
    for cells in _ws_lines():
        text = "".join(g[y][x] for y, x in cells)
        for f in FORBIDDEN:
            i = text.find(f)
            while i != -1:
                seg = set(cells[i:i + len(f)])
                if not any(seg <= set(p) for p in placed):   # HEAR inside HEARD is fine
                    return True
                i = text.find(f, i + 1)
    return False


def word_search(words, seed=11):
    rnd, n = random.Random(seed), WS_N
    for _ in range(5000):
        g = [[None] * n for _ in range(n)]
        hits, placed, ok = set(), [], True
        for w in sorted(words, key=len, reverse=True):
            for _ in range(300):
                d = rnd.choice([(0, 1), (1, 0)])
                r = rnd.randrange(n - (len(w) - 1) * d[0])
                c = rnd.randrange(n - (len(w) - 1) * d[1])
                cells = [(r + i * d[0], c + i * d[1]) for i in range(len(w))]
                if all(g[y][x] in (None, ch) for (y, x), ch in zip(cells, w)):
                    for (y, x), ch in zip(cells, w):
                        g[y][x] = ch
                    hits.update(cells)
                    placed.append(cells)
                    break
            else:
                ok = False
                break
        if not ok:
            continue
        fill = "BCDFGHKLMNPRSTVWXZ" * 2 + "AEIOU"   # few vowels → few accidental words
        for y in range(n):
            for x in range(n):
                if g[y][x] is None:
                    g[y][x] = rnd.choice(fill)
        if not _stray(g, placed):
            return g, hits
    raise SystemExit("word search: no clean grid found")


def grid_html(g, hits=None):
    rows = "".join("<tr>" + "".join(
        f'<td class="hit">{ch}</td>' if hits and (y, x) in hits else f"<td>{ch}</td>"
        for x, ch in enumerate(row)) + "</tr>" for y, row in enumerate(g))
    return f'<table class="grid">{rows}</table>'


GAP = '<span class="gap"></span>'
AR = '<span class="arr">→</span>'


def forms_sheet(t):
    c = t["forms"]
    cards = "".join(
        f'<div class="card">{icon(v["verb"], 17)}<div><p class="card-v">{E(v["verb"])}</p>'
        f'<div class="line">{AR}{GAP}{AR}{GAP}</div></div></div>' for v in PICTURES)
    p1 = (f'<div class="page">{header(t["kicker"], c["title"], t)}'
          f'{task(1, c["t1"], c["t1s"])}<div class="cards">{cards}</div>'
          f'{tip(c["tip"])}{footer(t, t["practice"])}</div>')
    rows = "".join(f'<div class="line">{GAP}{AR}<b>{E(v["past"])}</b>{AR}{GAP}</div>' for v in MIDDLE)
    g, hits = word_search([v["past"].upper() for v in HIDDEN])
    found = "".join("<tr><td></td><td></td></tr>" for _ in HIDDEN)
    p2 = (f'<div class="page">{header(t["kicker"], c["title"], t, fields=False)}'
          f'{task(2, c["t2"])}<div class="rows">{rows}</div>'
          f'{task(3, c["t3"], c["t3s"])}'
          f'<div class="ws">{grid_html(g)}<table class="found"><tr><th>{E(c["found"])}</th>'
          f'<th>{E(c["base"])}</th></tr>{found}</table></div>'
          f'{task(4, c["t4"])}<div class="bonus"><div></div><div></div><div></div></div>'
          f'{rate(t)}{footer(t, t["practice"])}</div>')
    k1 = "".join(f'<li>{E(v["verb"])} → {E(forms(v, "past"))} → {E(forms(v, "pp"))}</li>' for v in PICTURES)
    k2 = "".join(f'<li>{E(v["verb"])} → {E(v["past"])} → {E(forms(v, "pp"))}</li>' for v in MIDDLE)
    k3 = "".join(f'<li>{E(v["past"])} → {E(v["verb"])}</li>' for v in HIDDEN)
    p3 = (f'<div class="page key">{header(t["kicker"], c["title"] + " – " + t["key"], t, fields=False)}'
          f'<h2>{E(c["k1"])}</h2><ol>{k1}</ol><h2>{E(c["k2"])}</h2><ol>{k2}</ol>'
          f'<h2>{E(c["k3"])}</h2><div class="ws">{grid_html(g, hits)}<ol style="columns:1">{k3}</ol></div>'
          f'{cheer(t)}{footer(t, t["practice"])}</div>')
    return doc(t, [p1, p2, p3])


def gaps_sheet(t):
    c = t["gaps"]
    lis = "".join(
        f'<li>{E(s).replace("___", GAP, 1)} <span class="hint">({E(verb)})</span></li>' for s, verb, _ in GAPS)
    key = "".join(f'<li>{E(s).replace("___", "<b>" + E(ans) + "</b>", 1)}</li>' for s, _, ans in GAPS)
    p1 = (f'<div class="page">{header(t["kicker"], c["title"], t)}'
          f'{task(1, c["task"], c["task_s"])}<ol class="sent">{lis}</ol>'
          f'<div class="stack">{tip(c["tip"])}{rate(t)}</div>{footer(t, t["practice"])}</div>')
    p2 = (f'<div class="page key">{header(t["kicker"], c["title"] + " – " + t["key"], t, fields=False)}'
          f'<ol class="sent">{key}</ol>{cheer(t)}{footer(t, t["practice"])}</div>')
    return doc(t, [p1, p2])


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
                      f"{len(PICTURES)} häufige Verben mit Bildern zum Ausmalen: Die Lernenden ergänzen die fehlenden Formen "
                      "(<em lang=\"en\">go → ___ → ___</em>). Dazu Verben mit gegebener mittlerer Form, ein "
                      "Suchrätsel und eine Selbsteinschätzung. Mit Lösungsblatt.",
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
        "sub": ("Gratis, en PDF y con soluciones. Para la clase de inglés a partir de los 10 años, "
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
                      f"{len(PICTURES)} verbos frecuentes con dibujos para colorear: el alumnado completa las formas que faltan "
                      "(<em lang=\"en\">go → ___ → ___</em>). Además, verbos con la forma del medio dada, una sopa "
                      "de letras y una autoevaluación. Con soluciones.",
                      "/es/verbos-irregulares/type-race/", "Type Race"),
            "gaps": ("Completa las frases",
                     f"{len(GAPS)} frases en inglés para completar con el verbo en la forma correcta. "
                     "El verbo aparece entre paréntesis como ayuda. Con soluciones.",
                     "/es/verbos-irregulares/fill-the-gap/", "Fill the Gap"),
        },
        "tip_h": "Papel y pantalla, juntos",
        "tip": ("Una idea: primero la ficha con calma y la corrección en grupo; después, diez minutos de "
                "<a href=\"/es/verbos-irregulares/sprint/\">Sprint</a> en la tablet o el celular. Quien ya domina "
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
    .ws-dl{font-family:var(--font-body);font-weight:800;font-size:0.95rem;color:var(--k-btn-fg,#fff);background:var(--k-btn-bg,#bf4a33);box-shadow:0 3px 0 var(--k-btn-edge,#8f3a28);padding:9px 18px;border-radius:30px;text-decoration:none}
    .ws-dl:hover{background:var(--k-btn-bg-hover,#a63f2b);color:var(--k-btn-fg,#fff)}
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
  <link rel="stylesheet" href="/lib/krabsy-ui.css?v=2026-11-28-btn">
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
  <script type="module" src="/lib/krabsy-header.js?v=2026-11-27-rv"></script>
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
        cols += (f'<div class="scol"><h3>{E(t["list"]["groups"][key])}</h3>'
                 f'<p class="sex">{E(chain(_vmap[SORT_EX[key]]))}</p>{lines}</div>')
    key_html = "".join(
        f'<h2>{E(t["list"]["groups"][k])}</h2><ol>'
        + "".join(f'<li>{E(v["verb"])} – {E(forms(v, "past"))} – {E(forms(v, "pp"))}</li>' for v in SORT[k])
        + "</ol>" for k in ("AAA", "ABB", "ABA", "ABC"))
    p1 = (f'<div class="page">{header(t["kicker"], c["title"], t)}{task(1, c["task"], c["task_s"])}'
          f'<div class="wbox">{box}</div><div class="sgrid">{cols}</div>'
          f'<div class="stack">{tip(c["tip"])}{rate(t)}</div>{footer(t, t["practice"])}</div>')
    p2 = (f'<div class="page key">{header(t["kicker"], c["title"] + " – " + t["key"], t, fields=False)}'
          f'{key_html}{cheer(t)}{footer(t, t["practice"])}</div>')
    return doc(t, [p1, p2])


L["de"]["sort"] = {"file": "arbeitsblatt-verben-nach-mustern.pdf", "title": "Verben nach Mustern sortieren",
                   "task": "Schreib jedes Verb mit seinen drei Formen in den passenden Kasten.",
                   "task_s": "Das Beispiel oben im Kasten zeigt das Muster.",
                   "tip": ("<b>Krabsy-Tipp:</b> Sag die drei Formen laut und hör genau hin: Klingen alle drei gleich "
                           "wie <i>cut – cut – cut</i>? Oder nur die letzten beiden wie <i>buy – bought – bought</i>?")}
L["es"]["sort"] = {"file": "ficha-verbos-irregulares-por-tipos.pdf", "title": "Ordena los verbos por tipos",
                   "task": "Escribe cada verbo con sus tres formas en el recuadro correcto.",
                   "task_s": "El ejemplo arriba de cada recuadro muestra el tipo.",
                   "tip": ("<b>Consejo de Krabsy:</b> Di las tres formas en voz alta y escucha bien: ¿suenan las tres "
                           "iguales, como <i>cut – cut – cut</i>? ¿O solo las dos últimas, como <i>buy – bought – bought</i>?")}
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
    return doc(t, [f'<div class="flowp">{header(t["kicker"], c["title"], t, fields=False)}'
                   f'<p class="sub">{E(c["sub"])}</p><div class="cols">{groups}</div>{footer(t, t["practice"])}</div>'])


def _prep_gap_sheet(t, c, items):
    words = sorted({a[0] for _, a in items})
    box = f'<div class="wbox"><span>{E(c["box"])}</span>' + " · ".join(E(w) for w in words) + "</div>"
    lis = "".join(f'<li>{E(s).replace("___", GAP, 1)}</li>' for s, _ in items)
    key = "".join(f'<li>{E(s).replace("___", "<b>" + E(" / ".join(a)) + "</b>", 1)}</li>' for s, a in items)
    p1 = (f'<div class="page">{header(t["kicker"], c["title"], t)}{task(1, c["task"])}{box}'
          f'<ol class="sent tight">{lis}</ol><div class="stack">{rate(t)}</div>{footer(t, t["practice"])}</div>')
    p2 = (f'<div class="page key">{header(t["kicker"], c["title"] + " – " + t["key"], t, fields=False)}'
          f'<ol class="sent">{key}</ol>{cheer(t)}{footer(t, t["practice"])}</div>')
    return doc(t, [p1, p2])


def prep_gaps_a(t):
    return _prep_gap_sheet(t, t["gaps_a"], PGAP_A)


def prep_gaps_b(t):
    return _prep_gap_sheet(t, t["gaps_b"], PGAP_B)


LP = {
    "de": {
        "lang": "de", "dir": HP / "de" / "praepositionen" / "arbeitsblaetter",
        "practice": "krabsy.com/de/praepositionen/sprint/",
        "kicker": "Englisch · Präpositionen", "foot1": L["de"]["foot1"], "foot2": L["de"]["foot2"],
        "rate": L["de"]["rate"],
        "cheer": "Geschafft! Die Sätze, die noch schwer waren: laut lesen und morgen noch einmal.",
        "name": "Name:", "date": "Datum:", "class": "Klasse:", "key": "Lösungen",
        "overview": {"file": "englische-praepositionen-uebersicht.pdf", "title": "Übersicht aller Regeln",
                     "sub": f"{len(PREPS)} Regeln mit je einem Beispielsatz, sortiert nach Themen.",
                     "th": ["Regel", "Beispiel"]},
        "gaps_a": {"file": "arbeitsblatt-praepositionen-zeit-ort.pdf", "title": "Zeit und Ort",
                   "task": "Setz die passende Präposition ein.", "box": "Diese Wörter brauchst du:"},
        "gaps_b": {"file": "arbeitsblatt-praepositionen-verben-adjektive.pdf",
                   "title": "Nach Verben und Adjektiven",
                   "task": "Setz die passende Präposition ein.", "box": "Diese Wörter brauchst du:"},
    },
    "es": {
        "lang": "es", "dir": HP / "es" / "preposiciones" / "fichas",
        "practice": "krabsy.com/es/preposiciones/sprint/",
        "kicker": "Inglés · Preposiciones", "foot1": L["es"]["foot1"], "foot2": L["es"]["foot2"],
        "rate": L["es"]["rate"],
        "cheer": "¡Listo! Las frases que todavía cuestan: léelas en voz alta y repásalas mañana.",
        "name": "Nombre:", "date": "Fecha:", "class": "Curso:", "key": "Soluciones",
        "overview": {"file": "preposiciones-ingles-resumen.pdf", "title": "Resumen de las reglas",
                     "sub": f"{len(PREPS)} reglas con una frase de ejemplo cada una, ordenadas por temas.",
                     "th": ["Regla", "Ejemplo"]},
        "gaps_a": {"file": "ficha-preposiciones-tiempo-lugar.pdf", "title": "Tiempo y lugar",
                   "task": "Completa con la preposición correcta.", "box": "Palabras que necesitas:"},
        "gaps_b": {"file": "ficha-preposiciones-verbos-adjetivos.pdf",
                   "title": "Después de verbos y adjetivos",
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
                "<a href=\"/es/preposiciones/sprint/\">Sprint</a> en la tablet o el celular."),
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
print(f"verbs: pictures {len(PICTURES)}, middle {len(MIDDLE)}, hidden {len(HIDDEN)}, gaps {len(GAPS)}, sort {len(SORT_BOX)}; "
      f"preps: gaps A {len(PGAP_A)}, B {len(PGAP_B)}")
