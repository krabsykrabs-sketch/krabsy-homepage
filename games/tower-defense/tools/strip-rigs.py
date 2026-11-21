"""Build small animation-only GLB files from the KayKit rig files.

Keeps the node hierarchy (the bones the clips animate) and the chosen animation
clips; drops meshes, skins, materials, textures and every unused clip.
usage: python3 strip_rigs.py <out.glb> <clip,clip,...> <in1.glb> [in2.glb ...]
Clips from several inputs are merged into one file (bones are matched by name).
"""
import json, struct, sys

def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    n = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    bn = struct.unpack('<I', b[off:off + 4])[0]
    return j, b[off + 8: off + 8 + bn]

out_path, wanted, inputs = sys.argv[1], sys.argv[2].split(','), sys.argv[3:]
base, _ = read_glb(inputs[0])
nodes = []
for nd in base['nodes']:
    nd = dict(nd); nd.pop('mesh', None); nd.pop('skin', None)
    nodes.append(nd)
names = [n.get('name') for n in nodes]

out = {'asset': {'version': '2.0', 'generator': 'krabsy strip_rigs.py'}, 'scene': 0,
       'scenes': base['scenes'], 'nodes': nodes, 'animations': [],
       'accessors': [], 'bufferViews': [], 'buffers': []}
blob = bytearray()

def copy_accessor(j, bin_, idx, cache):
    if idx in cache: return cache[idx]
    a = dict(j['accessors'][idx])
    bv = j['bufferViews'][a['bufferView']]
    assert 'byteStride' not in bv, 'interleaved data not supported'
    comp = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    size = comp * width * a['count']
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    while len(blob) % 4: blob.append(0)
    out['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': size})
    blob.extend(bin_[start:start + size])
    a['bufferView'] = len(out['bufferViews']) - 1
    a.pop('byteOffset', None)
    out['accessors'].append(a)
    cache[idx] = len(out['accessors']) - 1
    return cache[idx]

found = set()
for path in inputs:
    j, bin_ = read_glb(path)
    # Node order differs between the rig files: remap channel targets by bone name.
    src_names = [n.get('name') for n in j['nodes']]
    index = {n: i for i, n in enumerate(names)}
    cache = {}
    for anim in j.get('animations', []):
        if anim['name'] not in wanted or anim['name'] in found: continue
        found.add(anim['name'])
        samplers = []
        for s in anim['samplers']:
            s = dict(s)
            s['input'] = copy_accessor(j, bin_, s['input'], cache)
            s['output'] = copy_accessor(j, bin_, s['output'], cache)
            samplers.append(s)
        channels = []
        for ch in anim['channels']:
            name = src_names[ch['target']['node']]
            assert name in index, f'{path}: bone {name} missing in the base skeleton'
            channels.append({'sampler': ch['sampler'], 'target': {'node': index[name], 'path': ch['target']['path']}})
        out['animations'].append({'name': anim['name'], 'channels': channels, 'samplers': samplers})

missing = [w for w in wanted if w not in found]
while len(blob) % 4: blob.append(0)
out['buffers'] = [{'byteLength': len(blob)}]
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(blob)
with open(out_path, 'wb') as f:
    f.write(b'glTF' + struct.pack('<II', 2, total))
    f.write(struct.pack('<I', len(js)) + b'JSON' + js)
    f.write(struct.pack('<I', len(blob)) + b'BIN\x00' + bytes(blob))
print(out_path, total // 1024, 'KB', 'clips', sorted(found), 'missing', missing)
