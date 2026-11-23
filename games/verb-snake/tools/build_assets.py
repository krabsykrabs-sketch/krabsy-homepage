#!/usr/bin/env python3
"""Turn the chosen Gemini originals into the game's sized assets.

  foods-1.png    -> assets/foods.webp   (4x4 sheet, 128 px cells, magenta keyed to alpha)
  keyart-1.png   -> assets/keyart.webp  (start/end screen art)
  backdrop-1.png -> assets/backdrop.webp (garden lawn behind the board)

Run from the repo root: python3 games/verb-snake/tools/build_assets.py
"""
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[3]
SRC = ROOT / '_incoming' / 'verb-snake-art'
OUT = ROOT / 'games' / 'verb-snake' / 'assets'
CELL = 128


def key_magenta(im):
    """Magenta background -> alpha, with despill on the soft edge."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # how "magenta" the pixel is: high r and b, low g
            m = min(r, b) - g
            if m > 150:
                px[x, y] = (0, 0, 0, 0)
            elif m > 40:
                a = int(255 * (150 - m) / 110)
                # pull the magenta spill out of the edge colour
                spill = min(r, b) - g
                r2 = max(0, r - spill * 0.6)
                b2 = max(0, b - spill * 0.6)
                px[x, y] = (int(r2), g, int(b2), a)
    return im


def foods():
    sheet = key_magenta(Image.open(SRC / 'foods-1.png'))
    w, h = sheet.size
    cw, ch = w // 4, h // 4
    out = Image.new('RGBA', (CELL * 4, CELL * 4), (0, 0, 0, 0))
    for i in range(16):
        cx, cy = i % 4, i // 4
        cell = sheet.crop((cx * cw, cy * ch, (cx + 1) * cw, (cy + 1) * ch))
        bbox = cell.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        cell = cell.crop(bbox)
        s = (CELL - 8) / max(cell.size)
        cell = cell.resize((max(1, round(cell.width * s)), max(1, round(cell.height * s))), Image.LANCZOS)
        out.paste(cell, (cx * CELL + (CELL - cell.width) // 2, cy * CELL + (CELL - cell.height) // 2), cell)
    out.save(OUT / 'foods.webp', 'WEBP', quality=88, method=6)


def keyart():
    im = Image.open(SRC / 'keyart-1.png').convert('RGB')
    im = im.resize((960, round(960 * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / 'keyart.webp', 'WEBP', quality=80, method=6)


def backdrop():
    im = Image.open(SRC / 'backdrop-1.png').convert('RGB')
    im = im.resize((560, round(560 * im.height / im.width)), Image.LANCZOS)
    im.save(OUT / 'backdrop.webp', 'WEBP', quality=72, method=6)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    foods(); keyart(); backdrop()
    for f in sorted(OUT.iterdir()):
        print(f.name, f.stat().st_size)
