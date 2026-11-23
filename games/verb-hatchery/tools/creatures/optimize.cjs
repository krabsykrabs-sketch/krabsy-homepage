// node optimize.cjs in.glb out.glb   — shrink a creature GLB without any dependency.
// (also used as a module by build.cjs:  require('./optimize.cjs').optimize(buffer) → { glb, stats })
//
// What it does (everything stays loadable by three.js GLTFLoader without extra decoders):
//   meshes      normals → int8, uvs → uint16 (when inside 0…1), skin weights → uint8   (KHR_mesh_quantization)
//   animations  drops tracks that only repeat the bone's rest pose, removes keyframes a straight line
//               between their neighbours reproduces (within ~1.5 mm / 0.15°), rotations → int16,
//               identical time lines are stored once
//   the rest    textures, materials, skins are copied; unused data is left out
const fs = require('fs');

const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const GET = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jl).toString('utf8'));
  const bo = 20 + jl;
  const bin = bo < buf.length ? buf.slice(bo + 8, bo + 8 + buf.readUInt32LE(bo)) : Buffer.alloc(0);
  return { json, bin };
}

function readAccessor(json, bin, i) {
  const a = json.accessors[i], bv = json.bufferViews[a.bufferView], n = NC[a.type];
  const size = CT[a.componentType].BYTES_PER_ELEMENT, stride = bv.byteStride || size * n;
  const dv = new DataView(bin.buffer, bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0));
  const out = new Float64Array(a.count * n), get = GET[a.componentType], k = a.normalized ? 1 / NORM[a.componentType] : 1;
  for (let e = 0; e < a.count; e++) for (let c = 0; c < n; c++) out[e * n + c] = dv[get](e * stride + c * size, true) * k;
  return { data: out, n, count: a.count, acc: a };
}

function optimize(input, opt = {}) {
  const { json, bin } = parseGlb(input);
  const tolPos = opt.tolPos ?? 0.0015, tolRot = opt.tolRot ?? 0.0013, tolScale = opt.tolScale ?? 0.002;
  const chunks = []; let length = 0;
  const views = [], accessors = [];
  const stats = { meshBytes: 0, animBytes: 0, imageBytes: 0, keysIn: 0, keysOut: 0, tracksIn: 0, tracksOut: 0, tris: 0, verts: 0 };

  function addView(bytes, extra = {}) {
    const pad = (4 - (length % 4)) % 4;
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, ...extra });
    chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)); length += bytes.length;
    return views.length - 1;
  }
  function addAccessor(typed, type, o = {}) {
    const n = NC[type], componentType = +Object.keys(CT).find((k) => CT[k] === typed.constructor);
    let bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength), count = typed.length / n, view = {};
    if (o.vertex) {
      view.target = 34962;
      const el = typed.BYTES_PER_ELEMENT * n;
      if (el % 4) { // vertex data must sit on 4-byte steps
        const stride = el + (4 - (el % 4)), p = new Uint8Array(stride * count);
        for (let e = 0; e < count; e++) p.set(bytes.subarray(e * el, (e + 1) * el), e * stride);
        bytes = p; view.byteStride = stride;
      }
    } else if (o.index) view.target = 34963;
    const acc = { bufferView: addView(bytes, view), componentType, count, type };
    if (o.normalized) acc.normalized = true;
    if (o.minmax) {
      acc.min = Array(n).fill(Infinity); acc.max = Array(n).fill(-Infinity);
      for (let i = 0; i < typed.length; i++) { const c = i % n; if (typed[i] < acc.min[c]) acc.min[c] = typed[i]; if (typed[i] > acc.max[c]) acc.max[c] = typed[i]; }
    }
    accessors.push(acc); return accessors.length - 1;
  }

  // ── meshes ──
  const done = new Map();
  const conv = (old, kind) => {
    const key = old + kind; if (done.has(key)) return done.get(key);
    const before = length;
    const { data, n, count, acc } = readAccessor(json, bin, old);
    let id;
    if (kind === 'NORMAL') {
      const t = new Int8Array(data.length); for (let i = 0; i < data.length; i++) t[i] = Math.round(Math.max(-1, Math.min(1, data[i])) * 127);
      id = addAccessor(t, acc.type, { vertex: true, normalized: true });
    } else if (kind === 'UV' && data.every((v) => v >= 0 && v <= 1)) {
      const t = new Uint16Array(data.length); for (let i = 0; i < data.length; i++) t[i] = Math.round(data[i] * 65535);
      id = addAccessor(t, acc.type, { vertex: true, normalized: true });
    } else if (kind === 'WEIGHTS') {
      const t = new Uint8Array(data.length);
      for (let e = 0; e < count; e++) {
        let sum = 0, big = 0, tot = 0;
        for (let c = 0; c < n; c++) tot += data[e * n + c];
        for (let c = 0; c < n; c++) { const v = Math.round((data[e * n + c] / (tot || 1)) * 255); t[e * n + c] = v; sum += v; if (v > t[e * n + big]) big = c; }
        t[e * n + big] += 255 - sum;
      }
      id = addAccessor(t, acc.type, { vertex: true, normalized: true });
    } else if (kind === 'INDEX') {
      let max = 0; for (const v of data) if (v > max) max = v;
      id = addAccessor(max < 65535 ? Uint16Array.from(data) : Uint32Array.from(data), 'SCALAR', { index: true });
      stats.tris += count / 3;
    } else if (kind === 'IBM') {
      id = addAccessor(Float32Array.from(data), acc.type);
    } else { // POSITION, JOINTS, uvs outside 0…1, anything else: same type as before
      const T = CT[acc.componentType];
      id = addAccessor(T.from(acc.normalized ? data.map((v) => Math.round(v * NORM[acc.componentType])) : data), acc.type, { vertex: true, normalized: acc.normalized, minmax: kind === 'POSITION' });
      if (kind === 'POSITION') stats.verts += count;
    }
    stats.meshBytes += length - before;
    done.set(key, id); return id;
  };
  for (const m of json.meshes || []) for (const p of m.primitives) {
    const at = {};
    for (const [k, v] of Object.entries(p.attributes)) {
      if (k.startsWith('COLOR') || k === 'TANGENT') continue;
      at[k] = conv(v, k === 'NORMAL' ? 'NORMAL' : k.startsWith('TEXCOORD') ? 'UV' : k.startsWith('WEIGHTS') ? 'WEIGHTS' : k === 'POSITION' ? 'POSITION' : 'RAW');
    }
    p.attributes = at;
    if (p.indices !== undefined) p.indices = conv(p.indices, 'INDEX');
    delete p.targets;
  }
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = conv(s.inverseBindMatrices, 'IBM');

  // ── animations ──
  const parent = {}; (json.nodes || []).forEach((nd, i) => (nd.children || []).forEach((c) => { parent[c] = i; }));
  const worldScale = (i) => { let s = 1; for (let p = parent[i]; p !== undefined; p = parent[p]) s *= Math.max(...(json.nodes[p].scale || [1]).map(Math.abs)); return s; };
  const REST = { translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] };
  const times = new Map();
  const before = length;
  for (const an of json.animations || []) {
    const ch = [], sm = [];
    let end = 0;
    for (const c of an.channels) end = Math.max(end, json.accessors[an.samplers[c.sampler].input].max[0]);
    for (const c of an.channels) {
      const s = an.samplers[c.sampler], path = c.target.path, node = json.nodes[c.target.node];
      const t = readAccessor(json, bin, s.input).data, o = readAccessor(json, bin, s.output), v = o.data, n = o.n;
      stats.tracksIn++; stats.keysIn += t.length;
      if ((s.interpolation || 'LINEAR') !== 'LINEAR' || path === 'weights') { // copied as is
        sm.push({ input: addAccessor(Float32Array.from(t), 'SCALAR', { minmax: true }), output: addAccessor(Float32Array.from(v), o.acc.type), interpolation: s.interpolation });
        ch.push({ sampler: sm.length - 1, target: c.target }); stats.tracksOut++; stats.keysOut += t.length; continue;
      }
      const tol = path === 'translation' ? tolPos / worldScale(c.target.node) : path === 'rotation' ? tolRot : tolScale;
      const rest = node[path] || REST[path];
      if (path === 'rotation') for (let k = 1; k < t.length; k++) { // same hemisphere as the key before
        let d = 0; for (let j = 0; j < 4; j++) d += v[k * 4 + j] * v[(k - 1) * 4 + j];
        if (d < 0) for (let j = 0; j < 4; j++) v[k * 4 + j] = -v[k * 4 + j];
      }
      const near = (k, ref) => { // key k equals ref (for rotations also −ref)
        let a = 0, b = 0;
        for (let j = 0; j < n; j++) { a = Math.max(a, Math.abs(v[k * n + j] - ref[j])); b = Math.max(b, Math.abs(v[k * n + j] + ref[j])); }
        return a <= tol || (path === 'rotation' && b <= tol);
      };
      let isRest = true; for (let k = 0; k < t.length && isRest; k++) isRest = near(k, rest);
      if (isRest) continue; // the bone keeps its rest value in this clip
      // keep a key only when a straight line between the kept neighbours misses it
      const keep = [0];
      let a = 0;
      while (a < t.length - 1) {
        let b = a + 1;
        for (let cand = a + 2; cand < t.length; cand++) {
          let ok = true;
          for (let k = a + 1; k < cand && ok; k++) {
            const f = (t[k] - t[a]) / (t[cand] - t[a]);
            for (let j = 0; j < n && ok; j++) if (Math.abs(v[a * n + j] + (v[cand * n + j] - v[a * n + j]) * f - v[k * n + j]) > tol) ok = false;
          }
          if (!ok) break; b = cand;
        }
        keep.push(b); a = b;
      }
      let kt = keep.map((k) => t[k]), kv = keep.flatMap((k) => Array.from(v.subarray(k * n, k * n + n)));
      if (keep.length === 2 && near(keep[1], kv.slice(0, n))) { kt = [0, end]; kv = kv.slice(0, n).concat(kv.slice(0, n)); } // constant, but not the rest pose
      const tk = kt.map((x) => Math.fround(x)).join(',');
      if (!times.has(tk)) times.set(tk, addAccessor(Float32Array.from(kt), 'SCALAR', { minmax: true }));
      const out = path === 'rotation'
        ? addAccessor(Int16Array.from(kv, (x) => Math.round(Math.max(-1, Math.min(1, x)) * 32767)), 'VEC4', { normalized: true })
        : addAccessor(Float32Array.from(kv), 'VEC3');
      sm.push({ input: times.get(tk), output: out, interpolation: 'LINEAR' });
      ch.push({ sampler: sm.length - 1, target: c.target });
      stats.tracksOut++; stats.keysOut += kt.length;
    }
    an.channels = ch; an.samplers = sm;
  }
  stats.animBytes = length - before;

  // ── images ──
  for (const im of json.images || []) if (im.bufferView !== undefined) {
    const bv = json.bufferViews[im.bufferView];
    const bytes = new Uint8Array(bin.buffer, bin.byteOffset + (bv.byteOffset || 0), bv.byteLength);
    im.bufferView = addView(Uint8Array.from(bytes)); stats.imageBytes += bv.byteLength;
  }

  json.accessors = accessors; json.bufferViews = views;
  const pad = (4 - (length % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  json.buffers = [{ byteLength: length }];
  json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'KHR_mesh_quantization'])];
  json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'KHR_mesh_quantization'])];
  json.asset.generator = (json.asset.generator || '') + ' + krabsy creatures/optimize.cjs';
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(length, 0); bh.writeUInt32LE(0x004e4942, 4);
  const glb = Buffer.concat([head, jh, js, bh, ...chunks]);
  stats.bytesIn = input.length; stats.bytes = glb.length; stats.jsonBytes = js.length;
  stats.clips = (json.animations || []).map((a) => a.name);
  stats.materials = (json.materials || []).length; stats.bones = Math.max(0, ...(json.skins || []).map((s) => s.joints.length));
  return { glb, stats };
}

module.exports = { optimize, parseGlb };

if (require.main === module) {
  const [inp, out] = process.argv.slice(2);
  if (!inp || !out) { console.log('node optimize.cjs in.glb out.glb'); process.exit(1); }
  const { glb, stats } = optimize(fs.readFileSync(inp));
  fs.writeFileSync(out, glb);
  console.log(JSON.stringify(stats));
}
