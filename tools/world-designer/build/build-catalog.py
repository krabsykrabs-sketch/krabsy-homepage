#!/usr/bin/env python3
"""Generate an asset-catalog manifest for the Krabsy world designer.

A "catalog" is one asset pack the editor can load: a JSON manifest listing
the pack's models grouped into categories, plus where to fetch them. This
script scans a folder of GLTF models, buckets each model into a category by
name, and writes the manifest the editor consumes.

Each pack carries its OWN category rules + labels (the editor is a general
world designer now, not a kitchen tool), so a new pack's taxonomy never
disturbs another's. To add a NEW pack:
  1. Copy its gltf/bin/atlas into  ../assets/<pack-id>/  (build/copy-pack.sh)
  2. Add a PACKS entry below (id, name, atlas, rules, meta).
  3. Run this script; it writes ../catalogs/<pack-id>.json
  4. Register the catalog in src/catalog.js (the dropdown list).

Usage:  python3 build-catalog.py            # builds every pack in PACKS
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                     # tools/world-designer

_starts = lambda *p: (lambda n: n.startswith(p))


# --- restaurant bits (kitchen) -------------------------------------------
# Ordered; first matching rule wins. Unchanged from the original kitchen tool
# so restaurant-bits.json regenerates identically.
def kitchen_rules():
    return [
        ('tiles', _starts('tile_')),
        ('architecture', _starts('wall', 'door', 'pillar', 'floor')),
        # sink is a kitchencounter_* but is really a station -> appliances first
        ('appliances',   _starts('kitchencounter_sink')),
        ('appliances',   lambda n: (
            n.startswith(('stove', 'oven', 'fridge', 'shelf_papertowel'))
            or n in ('pizza_oven', 'extractorhood', 'icecream_machine',
                     'dishrack', 'dishrack_plates', 'towelrail'))),
        ('counters',     _starts('kitchencounter', 'kitchencabinet')),
        ('crates',       _starts('crate')),
        ('furniture',    _starts('chair', 'table_round', 'kitchentable')),
        ('food',         _starts('food_', 'pizzabox', 'stew')),
        ('food',         lambda n: n.startswith('icecream') and n != 'icecream_scoop'),
        ('tableware',    lambda n: (
            n.startswith(('plate', 'bowl', 'pot', 'pan', 'jar', 'lid'))
            or n in ('ketchup', 'mustard', 'spoon', 'knife', 'rollingpin',
                     'cuttingboard', 'menu', 'papertowel', 'icecream_scoop'))),
    ]

KITCHEN_META = [
    ('tiles',        'Floor Tiles'),
    ('architecture', 'Walls, Doors & Floors'),
    ('counters',     'Counters & Cabinets'),
    ('appliances',   'Appliances & Stations'),
    ('crates',       'Crates'),
    ('furniture',    'Tables & Chairs'),
    ('tableware',    'Tableware & Utensils'),
    ('food',         'Food & Ingredients'),
    ('misc',         'Other'),
]


# --- furniture bits (interiors / diorama rooms) --------------------------
def furniture_rules():
    return [
        ('seating',     _starts('armchair', 'couch', 'chair')),
        ('beds',        _starts('bed', 'pillow')),
        ('tables',      _starts('desk', 'table')),
        ('storage',     _starts('cabinet', 'shelf', 'wardrobe', 'drawer')),
        ('lighting',    _starts('lamp')),
        ('electronics', _starts('monitor', 'keyboard', 'mouse', 'gameconsole',
                                'tv', 'laptop', 'phone', 'speaker')),
        ('decor',       _starts('cactus', 'plant', 'book', 'pictureframe',
                                'rug', 'cup', 'mug', 'vase', 'clock', 'candle')),
    ]

FURNITURE_META = [
    ('seating',     'Seating'),
    ('beds',        'Beds & Bedding'),
    ('tables',      'Tables & Desks'),
    ('storage',     'Storage & Shelves'),
    ('lighting',    'Lighting'),
    ('electronics', 'Electronics'),
    ('decor',       'Decor & Plants'),
    ('misc',        'Other'),
]


def categorize(name, rules):
    for cid, pred in rules:
        if pred(name):
            return cid
    return 'misc'


# --- packs to build ------------------------------------------------------
PACKS = [
    {
        'id': 'restaurant-bits',
        'name': 'Restaurant Bits 1.0 EXTRA',
        'format': 'gltf',
        'basePath': 'assets/restaurant-bits/',
        'atlas': 'restaurantbits_extra.png',
        'rules': kitchen_rules,
        'meta': KITCHEN_META,
    },
    {
        'id': 'furniture-bits',
        'name': 'Furniture Bits 1.0',
        'format': 'gltf',
        'basePath': 'assets/furniture-bits/',
        'atlas': 'furniturebits_texture.png',
        'rules': furniture_rules,
        'meta': FURNITURE_META,
    },
]


def build(pack):
    src_dir = os.path.join(ROOT, pack['basePath'])
    names = sorted(
        f[:-5] for f in os.listdir(src_dir)
        if f.endswith('.gltf') and ':' not in f
    )
    rules = pack['rules']()
    meta = pack['meta']
    buckets = {cid: [] for cid, _ in meta}
    for n in names:
        buckets[categorize(n, rules)].append(n)

    categories = []
    for cid, label in meta:
        models = buckets[cid]
        if not models:
            continue
        categories.append({'id': cid, 'name': label, 'models': models})

    manifest = {
        'id': pack['id'],
        'name': pack['name'],
        'format': pack['format'],
        'basePath': pack['basePath'],
        'atlas': pack['atlas'],
        'count': len(names),
        'categories': categories,
    }
    out = os.path.join(ROOT, 'catalogs', pack['id'] + '.json')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')

    print(f"[{pack['id']}] {len(names)} models -> {os.path.relpath(out, ROOT)}")
    for c in categories:
        print(f"   {c['name']:<26} {len(c['models']):>3}")
    return manifest


if __name__ == '__main__':
    for p in PACKS:
        build(p)
