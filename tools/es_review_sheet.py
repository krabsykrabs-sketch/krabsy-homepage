#!/usr/bin/env python3
"""Review sheet (Markdown, in Spanish) of Spanish topics for a teacher to check.

    python3 tools/es_review_sheet.py content/es-estar.json content/es-tener.json > docs/<file>.md

One table per item: sentence (gap as \\_\\_\\_, English hint in brackets), answer,
wrong choices, difficulty. The teacher marks mistakes directly in the text.
"""
import json
import sys

GROUPS = {'name': 'Nombre', 'origin': 'Origen', 'describe': 'Descripciones', 'feel': 'Cómo estás',
          'place': 'Lugar', 'things': 'Cosas', 'age': 'Edad', 'contrast': 'Contraste'}


def sheet(paths):
    out = ['# Krabsy · Revisión de temas de español (A1)', '',
           'Hola Nora: estas son las preguntas de los nuevos temas. Los alumnos ven la frase con un hueco y eligen '
           'entre 3 o 4 respuestas (o la escriben). Las pistas entre paréntesis salen en inglés. Después de un error '
           'ven la frase completa y la explicación corta.', '',
           '**Lo que necesitamos de ti:** marca lo que esté mal o suene raro, lo que sobre y lo que falte. '
           'Cambia lo que quieras directamente en este texto. Ojo especial: ¿alguna opción "incorrecta" podría '
           'ser correcta en algún contexto (por ejemplo en Latinoamérica)?', '',
           'Dificultad: 1 = fácil, 2 = media, 3 = difícil.', '']
    n = 0
    for p in paths:
        d = json.load(open(p, encoding='utf-8'))
        out += [f'## {d["title"]["es"]}', '']
        for it in d['items']:
            out += [f'### {it["label"]} ({GROUPS.get(it.get("group"), it.get("group", ""))})', '',
                    f'*Explicación:* {it["explanation"].get("es", "")}', '',
                    '| # | Frase | Respuesta | Opciones incorrectas | Dif. |', '|---|---|---|---|---|']
            for ex in it['examples']:
                n += 1
                s = ex['sentence'].replace('___', '\\_\\_\\_')
                if ex.get('hint'):
                    s += f' *({ex["hint"].get("en")})*'
                wrong = ', '.join(ex.get('distractors', it.get('distractors', [])))
                out.append(f'| {n} | {s} | **{" / ".join(ex["answers"])}** | {wrong} | {ex.get("difficulty", 1)} |')
            out.append('')
    return '\n'.join(out)


if __name__ == '__main__':
    print(sheet(sys.argv[1:]))
