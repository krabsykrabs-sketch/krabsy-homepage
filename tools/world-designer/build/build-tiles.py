#!/usr/bin/env python3
"""Generate single-colour 1×1 floor tiles for the Krabsy level editor.

The KayKit floor pieces are 2×2-cell checkerboards (two colour swatches from
the atlas). This script samples those swatches and emits four 1×1 (one-cell)
tile models — one per colour — so you can lay your own floor patterns:

  tile_white, tile_black            (from floor_kitchen — style A)
  tile_brown_light, tile_brown_dark (from floor_kitchen_styleB — style B)

Each tile is a 0.5-thick slab (top at y=0, like the floors) textured by the
SAME shared atlas, with every UV collapsed onto its colour's swatch — so it
renders as that exact solid colour through the editor's shared-atlas material.

These live in the gitignored assets/<pack>/ folder, so run this as part of
setup:  copy-pack.sh → build-tiles.py → build-catalog.py

Usage:  python3 build-tiles.py
"""
import base64
import json
import os
import struct
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets', 'restaurant-bits')
ATLAS_FILE = 'restaurantbits_extra.png'

# floor source -> the two tile names it yields (lighter first, darker second)
SOURCES = [
    ('floor_kitchen',        ['tile_white', 'tile_black']),
    ('floor_kitchen_styleB', ['tile_brown_light', 'tile_brown_dark']),
]

# ---- read a GLTF + .bin mesh -------------------------------------------
def load_mesh(name):
    gltf = json.load(open(os.path.join(ASSETS, name + '.gltf')))
    blob = open(os.path.join(ASSETS, name + '.bin'), 'rb').read()

    def acc(i):
        a = gltf['accessors'][i]
        bv = gltf['bufferViews'][a['bufferView']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        cnt = a['count']
        ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        ct = a['componentType']
        if ct == 5126:   fmt = '<%df' % (cnt * ncomp)
        elif ct == 5123: fmt = '<%dH' % (cnt * ncomp)
        elif ct == 5125: fmt = '<%dI' % (cnt * ncomp)
        else: raise ValueError('componentType ' + str(ct))
        flat = struct.unpack_from(fmt, blob, off)
        return [flat[k:k + ncomp] for k in range(0, len(flat), ncomp)]

    prim = gltf['meshes'][0]['primitives'][0]
    pos = acc(prim['attributes']['POSITION'])
    uv = acc(prim['attributes']['TEXCOORD_0'])
    idx = [t[0] for t in acc(prim['indices'])]
    return pos, uv, idx

# ---- interpolate the UV at a top-face XZ point --------------------------
def uv_at(pos, uv, idx, px, pz):
    for t in range(0, len(idx), 3):
        a, b, c = idx[t], idx[t + 1], idx[t + 2]
        if min(pos[a][1], pos[b][1], pos[c][1]) < -0.05:
            continue   # not the top face
        ax, az = pos[a][0], pos[a][2]
        bx, bz = pos[b][0], pos[b][2]
        cx, cz = pos[c][0], pos[c][2]
        d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
        if abs(d) < 1e-9:
            continue
        w1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d
        w2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d
        w3 = 1 - w1 - w2
        if w1 >= -1e-3 and w2 >= -1e-3 and w3 >= -1e-3:
            return (w1 * uv[a][0] + w2 * uv[b][0] + w3 * uv[c][0],
                    w1 * uv[a][1] + w2 * uv[b][1] + w3 * uv[c][1])
    return None

def sample(img, u, v):
    W, H = img.size
    x = min(W - 1, max(0, int(round(u * (W - 1)))))
    y = min(H - 1, max(0, int(round(v * (H - 1)))))   # glTF UV: origin top-left
    rs = gs = bs = n = 0
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            p = img.getpixel((min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy))))
            rs += p[0]; gs += p[1]; bs += p[2]; n += 1
    return (rs // n, gs // n, bs // n)

def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]

# ---- build a 1×1 (2×2 unit) slab tile GLTF -----------------------------
def make_tile(name, uv):
    X0, X1, Y0, Y1, Z0, Z1 = -1.0, 1.0, -0.5, 0.0, -1.0, 1.0
    faces = [
        ((0, 1, 0),  [(X0, Y1, Z0), (X1, Y1, Z0), (X1, Y1, Z1), (X0, Y1, Z1)]),
        ((0, -1, 0), [(X0, Y0, Z0), (X1, Y0, Z0), (X1, Y0, Z1), (X0, Y0, Z1)]),
        ((1, 0, 0),  [(X1, Y0, Z0), (X1, Y1, Z0), (X1, Y1, Z1), (X1, Y0, Z1)]),
        ((-1, 0, 0), [(X0, Y0, Z0), (X0, Y1, Z0), (X0, Y1, Z1), (X0, Y0, Z1)]),
        ((0, 0, 1),  [(X0, Y0, Z1), (X1, Y0, Z1), (X1, Y1, Z1), (X0, Y1, Z1)]),
        ((0, 0, -1), [(X0, Y0, Z0), (X1, Y0, Z0), (X1, Y1, Z0), (X0, Y1, Z0)]),
    ]
    pos, nor, tex, idx = [], [], [], []
    for normal, quad in faces:
        base = len(pos)
        for v in quad:
            pos.append(v); nor.append(normal); tex.append((uv[0], uv[1]))
        # winding so the geometric normal agrees with the intended outward normal
        e1 = tuple(quad[1][k] - quad[0][k] for k in range(3))
        e2 = tuple(quad[2][k] - quad[0][k] for k in range(3))
        cx = e1[1] * e2[2] - e1[2] * e2[1]
        cy = e1[2] * e2[0] - e1[0] * e2[2]
        cz = e1[0] * e2[1] - e1[1] * e2[0]
        outward = (cx * normal[0] + cy * normal[1] + cz * normal[2]) >= 0
        tris = [(0, 1, 2), (0, 2, 3)] if outward else [(0, 2, 1), (0, 3, 2)]
        for tri in tris:
            idx.extend(base + t for t in tri)

    buf = bytearray()
    def pad():
        while len(buf) % 4: buf.append(0)
    pos_off = len(buf)
    for v in pos: buf += struct.pack('<3f', *v)
    nor_off = len(buf)
    for v in nor: buf += struct.pack('<3f', *v)
    uv_off = len(buf)
    for v in tex: buf += struct.pack('<2f', *v)
    pad()
    idx_off = len(buf)
    for i in idx: buf += struct.pack('<H', i)
    pad()

    mn = [min(p[k] for p in pos) for k in range(3)]
    mx = [max(p[k] for p in pos) for k in range(3)]
    n = len(pos)
    gltf = {
        'asset': {'generator': 'krabsy build-tiles.py', 'version': '2.0'},
        'scene': 0,
        'scenes': [{'name': 'Scene', 'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': name}],
        'materials': [{'name': 'restaurant', 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.5}}],
        'meshes': [{'name': name, 'primitives': [{
            'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2},
            'indices': 3, 'material': 0}]}],
        'textures': [{'sampler': 0, 'source': 0}],
        'images': [{'mimeType': 'image/png', 'name': 'restaurantbits_extra', 'uri': ATLAS_FILE}],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': n, 'type': 'VEC3', 'min': mn, 'max': mx},
            {'bufferView': 1, 'componentType': 5126, 'count': n, 'type': 'VEC3'},
            {'bufferView': 2, 'componentType': 5126, 'count': n, 'type': 'VEC2'},
            {'bufferView': 3, 'componentType': 5123, 'count': len(idx), 'type': 'SCALAR'},
        ],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': pos_off, 'byteLength': nor_off - pos_off, 'target': 34962},
            {'buffer': 0, 'byteOffset': nor_off, 'byteLength': uv_off - nor_off, 'target': 34962},
            {'buffer': 0, 'byteOffset': uv_off, 'byteLength': idx_off - uv_off, 'target': 34962},
            {'buffer': 0, 'byteOffset': idx_off, 'byteLength': len(buf) - idx_off, 'target': 34963},
        ],
        'samplers': [{'magFilter': 9729, 'minFilter': 9987}],
        'buffers': [{'byteLength': len(buf),
                     'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(buf)).decode()}],
    }
    out = os.path.join(ASSETS, name + '.gltf')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(gltf, fh, indent=2)
    return out

def main():
    img = Image.open(os.path.join(ASSETS, ATLAS_FILE)).convert('RGB')
    print('atlas', img.size)
    for src, names in SOURCES:
        pos, uv, idx = load_mesh(src)
        seen = []   # (color, uv)
        for px, pz in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
            u = uv_at(pos, uv, idx, px, pz)
            if not u:
                continue
            col = sample(img, *u)
            if all(sum((col[k] - s[0][k]) ** 2 for k in range(3)) > 150 for s in seen):
                seen.append((col, u))
        seen.sort(key=lambda s: lum(s[0]), reverse=True)   # lighter first
        print('%-22s ->' % src)
        for (col, u), nm in zip(seen, names):
            make_tile(nm, u)
            print('   %-18s rgb%-16s uv(%.4f,%.4f)' % (nm, str(col), u[0], u[1]))
        if len(seen) < 2:
            print('   !! found only', len(seen), 'distinct colours')

if __name__ == '__main__':
    main()
