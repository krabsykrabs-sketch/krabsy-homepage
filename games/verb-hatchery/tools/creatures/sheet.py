"""python3 sheet.py   — roster sheet for the owner: ../../_shots/roster.png
All icons in a grid per zone, with name (EN / DE / ES), rarity and size. Needs Pillow."""
import json, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); DIR = os.path.join(HERE, '../../assets/creatures')
man = json.load(open(os.path.join(DIR, 'creatures.json'), encoding='utf8'))
RAR = {'common': '#8a8f98', 'uncommon': '#3faa4c', 'rare': '#2f6fd0', 'epic': '#7a3fd6', 'legendary': '#e0a020'}
ZONE = {'meadow': ('Meadow (start)', '#e8f3d6'), 'forest': ('Forest (2 stars)', '#d9ead8'), 'beach': ('Beach (5 stars)', '#f5ecd2'), 'volcano': ('Volcano (9 stars)', '#f1dcd6')}
def font(size, bold=False):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else ''), '/usr/share/fonts/truetype/liberation/LiberationSans-%s.ttf' % ('Bold' if bold else 'Regular')]:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()
F, FB, FS, FH = font(13), font(14, True), font(11), font(24, True)
COLS, CW, CH, PAD = 8, 172, 214, 14
rows = {z: -(-len([c for c in man['creatures'] if c['zone'] == z]) // COLS) for z in man['zones']}
W = COLS * CW + PAD * 2; H = 70 + sum(46 + r * CH + 10 for r in rows.values())
im = Image.new('RGB', (W, H), '#fbfaf6'); d = ImageDraw.Draw(im)
n = len(man['creatures']); mb = sum(c['bytes'] for c in man['creatures']) / 1048576
d.text((PAD, 14), 'Verb Hatchery: creature collection', font=FH, fill='#123')
d.text((PAD, 46), '%d creatures (%d animals, %d monsters), models %.1f MB. Dark picture = "not found yet". All CC0 by Quaternius.' % (n, sum(c['kind'] == 'animal' for c in man['creatures']), sum(c['kind'] == 'monster' for c in man['creatures']), mb), font=F, fill='#456')
y = 70
for z in man['zones']:
    cs = [c for c in man['creatures'] if c['zone'] == z]
    d.rectangle([0, y, W, y + 46 + rows[z] * CH + 4], fill=ZONE[z][1])
    cnt = ', '.join('%d %s' % (sum(c['rarity'] == r for c in cs), r) for r in man['rarities'] if any(c['rarity'] == r for c in cs))
    d.text((PAD, y + 10), ZONE[z][0], font=FH, fill='#123'); d.text((PAD + 300, y + 18), '%d creatures: %s' % (len(cs), cnt), font=F, fill='#345')
    y += 46
    for i, c in enumerate(cs):
        x, yy = PAD + (i % COLS) * CW, y + (i // COLS) * CH
        d.rounded_rectangle([x + 4, yy + 2, x + CW - 6, yy + CH - 8], 10, fill='#ffffff', outline=RAR[c['rarity']], width=3)
        ic = Image.open(os.path.join(DIR, c['icon'])).convert('RGBA'); im.paste(ic, (x + 10, yy + 8), ic)
        sl = Image.open(os.path.join(DIR, c['silhouette'])).convert('RGBA').resize((40, 40), Image.LANCZOS); im.paste(sl, (x + CW - 52, yy + 8), sl)
        d.text((x + 12, yy + 136), c['name']['en'], font=FB, fill='#123')
        if c['name']['de'] != c['name']['en'] or c['name']['es'] != c['name']['en']:
            d.text((x + 12, yy + 154), c['name']['de'] + ' / ' + c['name']['es'], font=FS, fill='#567')
        elif c['kind'] == 'monster': d.text((x + 12, yy + 154), 'monster', font=FS, fill='#567')
        d.text((x + 12, yy + 170), c['rarity'], font=FB, fill=RAR[c['rarity']])
        d.text((x + 12, yy + 188), '%d tris, %d KB, %d clips' % (c['tris'], c['bytes'] // 1024, len(set(c['clips'].values()))), font=FS, fill='#789')
    y += rows[z] * CH + 10
out = os.path.join(HERE, '../../_shots/roster.png'); os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out)
print(os.path.normpath(out), im.size)
