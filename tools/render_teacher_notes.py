#!/usr/bin/env python3
"""Render a short "Im Unterricht einsetzen" / "En clase" block into the SEO
article of the drill pages (game pages get theirs from render_game_info.py).

The block sits inside <!-- seo-article --> before the article's link list,
between <!-- teacher-notes:start/end --> markers, so the script is safe to re-run.

Run from repo root:  python3 tools/render_teacher_notes.py
"""
import pathlib
import re

HP = pathlib.Path(__file__).resolve().parent.parent / "homepage"

HEAD = {"de": "Im Unterricht einsetzen", "es": "En clase: ideas para docentes"}
MORE = {
    "de": ('Mehr Ideen und Arbeitsblätter: <a href="/de/lehrkraefte/">Für Lehrkräfte</a> · '
           '<a href="/de/unregelmaessige-verben/arbeitsblaetter/">Arbeitsblätter (PDF)</a>'),
    "es": ('Más ideas y fichas: <a href="/es/docentes/">Para docentes</a> · '
           '<a href="/es/verbos-irregulares/fichas/">Fichas para imprimir (PDF)</a>'),
}

V_DE, V_ES = "de/unregelmaessige-verben", "es/verbos-irregulares"
P_DE, P_ES = "de/praepositionen", "es/preposiciones"

NOTES = {
    # ── irregular verbs ──
    f"{V_DE}/sprint": [
        "Eine Runde dauert nur wenige Minuten, auf Handy, Tablet oder PC. Kein Konto nötig: Sie teilen einfach den Link.",
        "Als Warm-up: Alle spielen eine Runde, merken sich ihre Zeit und versuchen sie in der zweiten Runde zu schlagen.",
        "Die Liste „Diese hast du verpasst“ am Ende ist eine persönliche Lernliste für die Hausaufgabe.",
    ],
    f"{V_ES}/sprint": [
        "Una ronda dura pocos minutos, en móvil, tablet u ordenador. No hace falta cuenta: basta con compartir el enlace.",
        "Como calentamiento: todos juegan una ronda, apuntan su tiempo e intentan mejorarlo en la segunda.",
        "La lista de verbos fallados al final sirve como lista personal de repaso para casa.",
    ],
    f"{V_DE}/type-race": [
        "Trainiert das Schreiben der Formen, also genau das, was in Klassenarbeiten verlangt wird.",
        "Gut als ruhige Einzelarbeit, am besten mit Tastatur.",
        "Idee: vor einem Test zehn Minuten tippen lassen, danach die Formen besprechen, die noch nicht sitzen.",
    ],
    f"{V_ES}/type-race": [
        "Practica la escritura de las formas, justo lo que se pide en los exámenes.",
        "Ideal como trabajo individual tranquilo, mejor con teclado.",
        "Idea: antes de un examen, diez minutos escribiendo y después repasar las formas que aún fallan.",
    ],
    f"{V_DE}/fill-the-gap": [
        "Übt die Formen im ganzen Satz, nicht nur einzeln: passend nach der Einführung von Simple Past und Present Perfect.",
        'Passt zum Arbeitsblatt „Lückensätze“ (<a href="/de/unregelmaessige-verben/arbeitsblaetter/">PDF</a>): erst auf Papier, dann online.',
        "Drei Leben pro Runde halten die Runden kurz, gut für die letzten Minuten der Stunde.",
    ],
    f"{V_ES}/fill-the-gap": [
        "Practica las formas dentro de la frase, no sueltas: ideal después de introducir el Simple Past y el Present Perfect.",
        'Combina con la ficha «Completa las frases» (<a href="/es/verbos-irregulares/fichas/">PDF</a>): primero en papel, luego online.',
        "Con tres vidas por ronda, las rondas son cortas: perfectas para los últimos minutos de la clase.",
    ],
    f"{V_DE}/drag-match": [
        "Ohne Tippen und ohne Zeitdruck: geeignet für den Einstieg und für Lernende, denen das Schreiben noch schwerfällt.",
        "Funktioniert gut am interaktiven Whiteboard: Die Klasse sagt an, ein Kind zieht.",
    ],
    f"{V_ES}/drag-match": [
        "Sin escribir y sin presión de tiempo: ideal para empezar y para quien aún tiene dificultades al escribir.",
        "Funciona muy bien en la pizarra digital: la clase dice la respuesta y una persona arrastra.",
    ],
    f"{V_DE}/falling-forms": [
        "Schnell und spielerisch: gut, wenn die Formen schon sitzen und schneller abgerufen werden sollen.",
        "Idee: als kleiner Wettbewerb in Partnerarbeit am Stundenende.",
    ],
    f"{V_ES}/falling-forms": [
        "Rápido y como un juego: ideal cuando las formas ya se saben y hay que recordarlas más deprisa.",
        "Idea: un pequeño concurso por parejas al final de la clase.",
    ],
    # ── prepositions ──
    f"{P_DE}/sprint": [
        "20 Lückensätze pro Runde, in wenigen Minuten. Das kleine Muster über dem Satz macht die Regel sichtbar.",
        "Idee: nach der Einführung von in, on und at erst gemeinsam am Whiteboard, dann alle allein.",
    ],
    f"{P_ES}/sprint": [
        "20 frases por ronda, en pocos minutos. El pequeño patrón sobre la frase muestra la regla.",
        "Idea: después de introducir in, on y at, primero juntos en la pizarra digital y luego cada uno solo.",
    ],
    f"{P_DE}/fill-the-gap": [
        "Die Lernenden tippen die Präposition selbst: anspruchsvoller als Auswählen.",
        "Gut als Hausaufgabe: Link teilen und in der nächsten Stunde die schwierigsten Sätze besprechen.",
    ],
    f"{P_ES}/fill-the-gap": [
        "El alumnado escribe la preposición: más exigente que elegirla.",
        "Ideal como tarea: compartir el enlace y en la clase siguiente comentar las frases más difíciles.",
    ],
}

START, END = "<!-- teacher-notes:start (tools/render_teacher_notes.py) -->", "<!-- teacher-notes:end -->"

for rel, items in NOTES.items():
    lang = rel[:2]
    more = MORE[lang]
    if "/praepositionen" in rel:
        more = more.replace("/de/unregelmaessige-verben/arbeitsblaetter/", "/de/praepositionen/arbeitsblaetter/")
    if "/preposiciones" in rel:
        more = more.replace("/es/verbos-irregulares/fichas/", "/es/preposiciones/fichas/")
    block = (f"{START}\n  <h3>{HEAD[lang]}</h3>\n  <ul>\n"
             + "".join(f"    <li>{li}</li>\n" for li in items)
             + f"  </ul>\n  <p>{more}</p>\n  {END}")
    f = HP / rel / "index.html"
    s = f.read_text(encoding="utf-8")
    art = re.search(r"<!-- seo-article:start.*?<!-- seo-article:end -->", s, re.S)
    assert art, f"no seo-article in {rel}"
    a = art.group(0)
    if START in a:
        a2 = re.sub(re.escape(START) + r".*?" + re.escape(END), lambda _: block, a, count=1, flags=re.S)
    elif '<ul class="k-article-links">' in a:
        a2 = a.replace('<ul class="k-article-links">', block + '\n  <ul class="k-article-links">', 1)
    else:
        a2 = a.replace("</section>\n<!-- seo-article:end -->", block + "\n</section>\n<!-- seo-article:end -->", 1)
        assert a2 != a, f"no anchor in {rel}"
    f.write_text(s.replace(a, a2, 1), encoding="utf-8")
    print("ok", rel)
