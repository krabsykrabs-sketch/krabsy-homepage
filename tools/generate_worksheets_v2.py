#!/usr/bin/env python3
"""Worksheets, new look (prototype 2026-11-28): "Die drei Formen" with pictures,
a crab tip, a word search and a self-check. Black-and-white copier safe.

Look and mascot: tools/worksheet_kit.py. All verb forms are read from
content/irregular-verbs.json (the script stops if a verb is missing).

Output (prototype, not served yet):  _incoming/worksheets/<file>.pdf (+ .png previews
with --png, needs pymupdf).

Run:  python3 tools/generate_worksheets_v2.py [--png]
Needs: segno, headless Chrome (see worksheet_kit.chrome).
"""
import json
import random
import sys

from worksheet_kit import ROOT, E, header, task, footer, doc, icon, mascot_img, to_pdf

OUT = ROOT / "_incoming" / "worksheets"

# ── data ─────────────────────────────────────────────────────────────────────
items = json.loads((ROOT / "content" / "irregular-verbs.json").read_text(encoding="utf-8"))
V = {}
for it in items:
    v = V.setdefault(it["verb"], {"verb": it["verb"]})
    v["past" if it["form"] == "past" else "pp"] = it["correct_answer"]
    v["past_alts" if it["form"] == "past" else "pp_alts"] = [
        a for a in it.get("correct_alt", []) if a and a != it["correct_answer"]]


def verb(b):
    if b not in V:
        raise SystemExit(f"verb missing in catalogue: {b}")
    return V[b]


def both(v, key):
    return " / ".join([v[key]] + v[key + "_alts"])


PICTURES = ["eat", "drink", "go", "run", "swim", "fly", "sing", "write", "sleep", "drive", "buy", "see"]
MIDDLE = ["draw", "give", "wear", "speak", "take", "forget"]
HIDDEN = ["come", "find", "make", "tell", "hear", "leave", "feel", "say"]   # their past forms are hidden

# ── word search (deterministic; → and ↓ only) ────────────────────────────────
N = 10


# Every form of every catalogue verb (go, went, gone, be, was …). Apart from the hidden
# words themselves, none of them may be readable in the grid in ANY direction
# (→ ↓ ← ↑ and diagonals), or pupils find "GO" or "BE" in the filler (owner, 2026-11-28).
FORBIDDEN = sorted({f.upper() for v in V.values()
                    for f in [v["verb"], v.get("past", ""), v.get("pp", ""), *v.get("past_alts", []), *v.get("pp_alts", [])]
                    if f and f.isalpha() and len(f) >= 2})


def stray_words(g, placed):
    """Forms readable in g (any of 8 directions) other than inside the placed hidden words."""
    lines = [[(y, x) for x in range(N)] for y in range(N)] + [[(y, x) for y in range(N)] for x in range(N)]
    for k in range(-N + 1, N):
        lines.append([(y, y - k) for y in range(N) if 0 <= y - k < N])
        lines.append([(y, k + N - 1 - y) for y in range(N) if 0 <= k + N - 1 - y < N])
    lines += [l[::-1] for l in lines]
    found = []
    for cells in lines:
        text = "".join(g[y][x] for y, x in cells)
        for f in FORBIDDEN:
            i = text.find(f)
            while i != -1:
                seg = set(cells[i:i + len(f)])
                if not any(seg <= set(p) for p in placed):   # inside a hidden word (HEAR in HEARD) is fine
                    found.append(f)
                i = text.find(f, i + 1)
    return found


def word_search(words, seed=11):
    rnd = random.Random(seed)
    for _ in range(5000):
        g = [[None] * N for _ in range(N)]
        hits, placed = set(), set()
        ok = True
        for w in sorted(words, key=len, reverse=True):
            for _ in range(300):
                d = rnd.choice([(0, 1), (1, 0)])
                r = rnd.randrange(N - (len(w) - 1) * d[0])
                c = rnd.randrange(N - (len(w) - 1) * d[1])
                cells = [(r + i * d[0], c + i * d[1]) for i in range(len(w))]
                if all(g[y][x] in (None, ch) for (y, x), ch in zip(cells, w)):
                    for (y, x), ch in zip(cells, w):
                        g[y][x] = ch
                    hits.update(cells)
                    placed.add(tuple(cells))
                    break
            else:
                ok = False
                break
        if not ok:
            continue
        fill = "BCDFGHKLMNPRSTVWXZ" * 2 + "AEIOU"   # few vowels → few accidental words
        for y in range(N):
            for x in range(N):
                if g[y][x] is None:
                    g[y][x] = rnd.choice(fill)
        if not stray_words(g, placed):
            return g, hits
    raise SystemExit("word search: no clean grid found")


def grid_html(g, hits=None):
    rows = "".join("<tr>" + "".join(
        f'<td class="hit">{ch}</td>' if hits and (y, x) in hits else f"<td>{ch}</td>"
        for x, ch in enumerate(row)) + "</tr>" for y, row in enumerate(g))
    return f'<table class="grid">{rows}</table>'


# ── copy ─────────────────────────────────────────────────────────────────────
T = {
    "de": {
        "name": "Name:", "class": "Klasse:", "date": "Datum:",
        "kicker": "Englisch · Unregelmäßige Verben",
        "title": "Die drei Formen",
        "key_title": "Die drei Formen – Lösungen",
        "t1": "Schreib die beiden fehlenden Formen dazu.",
        "t1s": "Die Bilder helfen dir. Du darfst sie auch ausmalen.",
        "tip": ("<b>Krabsy-Tipp:</b> Sprich die drei Formen laut im Satz: <i>I go</i> – "
                "<i>yesterday I went</i> – <i>I have gone</i>. Wenn es im Satz gut klingt, stimmt es meistens."),
        "t2": "Hier steht die mittlere Form schon da. Ergänze die anderen beiden.",
        "t3": "Verb-Detektiv: Im Gitter verstecken sich 8 Formen.",
        "t3s": "Sie stehen von links nach rechts oder von oben nach unten. Schreib jede Form und ihre Grundform auf.",
        "t4": "Bonus: Schreib zwei Sätze mit Formen, die du im Gitter gefunden hast.",
        "found": "Gefundene Form", "base": "Grundform",
        "rate": "Wie sicher bist du jetzt? Mal die Muscheln aus: eine für „noch unsicher“, fünf für „kann ich!“",
        "foot1": "Weiterüben am Handy oder Tablet, ohne Anmeldung:",
        "foot2": "Krabsy · kostenlos für den Unterricht",
        "practice": "krabsy.com/de/unregelmaessige-verben/sprint/",
        "k1": "1. Bilder", "k2": "2. Mittlere Form", "k3": "3. Verb-Detektiv",
        "cheer": "Geschafft! Die Verben, die noch schwer waren: dreimal laut sagen und morgen noch einmal.",
        "file": "arbeitsblatt-drei-formen-neu",
    },
}


# ── sheet ────────────────────────────────────────────────────────────────────
def sheet(t):
    gap = '<span class="gap"></span>'
    ar = '<span class="arr">→</span>'
    cards = "".join(
        f'<div class="card">{icon(b, 17)}<div><p class="card-v">{E(b)}</p>'
        f'<div class="line">{ar}{gap}{ar}{gap}</div></div></div>'
        for b in PICTURES if verb(b))
    p1 = (f'<div class="page">{header(t["kicker"], t["title"], t)}'
          f'{task(1, t["t1"], t["t1s"])}<div class="cards">{cards}</div>'
          f'<div class="tip">{mascot_img()}<div class="bub">{t["tip"]}</div></div>'
          f'{footer(t, t["practice"])}</div>')

    rows = "".join(f'<div class="line">{gap}{ar}<b>{E(verb(b)["past"])}</b>{ar}{gap}</div>' for b in MIDDLE)
    hidden = [verb(b)["past"].upper() for b in HIDDEN]
    g, hits = word_search(hidden)
    found = "".join("<tr><td></td><td></td></tr>" for _ in hidden)
    shells = "".join(icon("shell", 10) for _ in range(5))
    p2 = (f'<div class="page">{header(t["kicker"], t["title"], t, fields=False)}'
          f'{task(2, t["t2"])}<div class="rows">{rows}</div>'
          f'{task(3, t["t3"], t["t3s"])}'
          f'<div class="ws">{grid_html(g)}<table class="found"><tr><th>{E(t["found"])}</th>'
          f'<th>{E(t["base"])}</th></tr>{found}</table></div>'
          f'{task(4, t["t4"])}<div class="bonus"><div></div><div></div><div></div></div>'
          f'<div class="rate"><p>{E(t["rate"])}</p>{shells}</div>'
          f'{footer(t, t["practice"])}</div>')

    k1 = "".join(f'<li>{E(b)} → {E(both(verb(b), "past"))} → {E(both(verb(b), "pp"))}</li>' for b in PICTURES)
    k2 = "".join(f'<li>{E(b)} → {E(verb(b)["past"])} → {E(both(verb(b), "pp"))}</li>' for b in MIDDLE)
    k3 = "".join(f'<li>{E(verb(b)["past"])} → {E(b)}</li>' for b in HIDDEN)
    p3 = (f'<div class="page key">{header(t["kicker"], t["key_title"], t, fields=False)}'
          f'<h2>{E(t["k1"])}</h2><ol>{k1}</ol><h2>{E(t["k2"])}</h2><ol>{k2}</ol>'
          f'<h2>{E(t["k3"])}</h2><div class="ws">{grid_html(g, hits)}<ol style="columns:1">{k3}</ol></div>'
          f'<div class="cheer">{mascot_img()}<span>{E(t["cheer"])}</span></div>'
          f'{footer(t, t["practice"])}</div>')
    return doc([p1, p2, p3], "de")


def main():
    for lang, t in T.items():
        out = to_pdf(sheet(t), OUT / f"{t['file']}.pdf")
        print(out.relative_to(ROOT))
        if "--png" in sys.argv:
            import fitz
            d = fitz.open(out)
            print(f"  {len(d)} pages")
            for i, pg in enumerate(d):
                pix = pg.get_pixmap(dpi=110, colorspace=fitz.csGRAY)
                png = OUT / f"{t['file']}-p{i + 1}.png"
                pix.save(png)
                print(" ", png.relative_to(ROOT))


if __name__ == "__main__":
    main()
