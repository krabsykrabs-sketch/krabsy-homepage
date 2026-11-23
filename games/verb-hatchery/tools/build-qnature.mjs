// Builds assets/qnature/qnature.glb + atlas.webp from the Quaternius kits (CC0):
// Stylized Nature MegaKit, Fantasy Props MegaKit, Medieval Village MegaKit.
//
//   MESHOPT=<dir>/node_modules/meshoptimizer/index.js SHARP=<dir>/node_modules/sharp \
//     node tools/build-qnature.mjs
//   (npm i meshoptimizer sharp in any temp folder; they are not part of the game)
//
// Why a build step: the kit's trees have 3–10k triangles and 2048 px textures with
// normal maps; that is far too heavy for a school Chromebook. This tool
//  - simplifies trunks / rocks / props (meshoptimizer) and thins out the leaf cards
//    (keeps a share of them, made a little bigger),
//  - bakes what is a flat colour into vertex colours: bark (mean colour × the kit's
//    ambient-occlusion vertex colour), the grass palette, the props' wood and metal,
//  - packs every texture that is a real picture or a cut-out shape (leaf clusters,
//    plants, flowers, rocks, stepping stones, mushrooms) into ONE small atlas,
//  - writes ONE .glb: a mesh per model with POSITION, NORMAL (int8), TEXCOORD_0
//    (uint16, atlas coordinates; (0,0) = a white opaque texel for untextured parts)
//    and COLOR_0 (uint8 RGBA).
// COLOR_0 is our own convention, read by src/qnature.js (not standard glTF):
//   rgb = sRGB-encoded colour; a = 255: final colour, a = 0: "foliage", the game
//   multiplies it with a tint when it places the model (so one tree mesh can be
//   light green, dark green or autumn orange).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MeshoptSimplifier } = await import(process.env.MESHOPT || 'meshoptimizer');
const sharp = require(process.env.SHARP || 'sharp');
await MeshoptSimplifier.ready;

const LIB = process.env.QLIB || '/home/janah/dev/_assets/quaternius/packs';
const DIRS = {
  nature: `${LIB}/Stylized_Nature_MegaKit_Standard_/glTF`,
  props: `${LIB}/Fantasy_Props_MegaKit_Standard_/Exports/glTF`,
  village: `${LIB}/Medieval_Village_MegaKit_Standard_/Medieval Village MegaKit[Standard]/glTF`,
};
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../assets/qnature');

// How each source material is handled. scale = atlas pixels per source pixel.
//  flat   : mean texture colour × AO vertex colour → vertex colour, no texture
//  sample : texture (blurred) sampled at each vertex → vertex colour, no texture
//  mask   : cut-out shape in the atlas (white), colour = foliage (tinted in the game)
//  atlas  : picture in the atlas
const MATS = {
  Bark_NormalTree: { mode: 'flat' }, Bark_DeadTree: { mode: 'flat' }, Bark_TwistedTree: { mode: 'flat' },
  Leaves_NormalTree: { mode: 'mask', scale: 0.25 }, Leaves_TwistedTree: { mode: 'mask', scale: 0.25 }, Leaves_Pine: { mode: 'mask', scale: 0.125 },
  Leaves: { mode: 'atlas', scale: 0.25, cut: true, ao: 0.5, up: 0.6 }, Flowers: { mode: 'atlas', scale: 0.3, cut: true, up: 0.6 },
  Grass: { mode: 'sample', ao: 0.5, up: 0.75, foliage: true },
  Rocks: { mode: 'atlas', scale: 0.25 }, PathRocks: { mode: 'atlas', scale: 0.5 }, Mushrooms: { mode: 'atlas', scale: 0.25 },
  MI_Trim_Metal: { mode: 'sample' }, MI_Trim_Furniture: { mode: 'sample' }, MI_Banner: { mode: 'sample', foliage: true, grey: true },
  MI_WoodTrim: { mode: 'sample' }, MI_Trim_Props_Vertex: { mode: 'sample' },
};
// Models: [name, kit, { tris: target triangles for solid parts, ratio: share of the
// triangles kept, keep: share of leaf cards / blades kept, grow: how much the kept ones
// grow, src: source file when the name is our own }]
const tree = (n, tris, keep, grow) => [n, 'nature', { tris, keep, grow }];
const MODELS = [
  ...[1, 2, 3, 4, 5].map((i) => tree(`CommonTree_${i}`, 220, 0.25, 1.6)),
  ...[1, 2, 3, 4, 5].map((i) => tree(`Pine_${i}`, 200, 0.45, 1.35)),
  ...[1, 3, 5].map((i) => tree(`TwistedTree_${i}`, 480, 0.3, 1.55)),
  ...[1, 2, 3, 4, 5].map((i) => tree(`DeadTree_${i}`, 380)),
  ['Bush_Common', 'nature', { keep: 0.22, grow: 1.6 }], ['Bush_Common_Flowers', 'nature', { keep: 0.22, grow: 1.6, keepMat: { Flowers: 0.4 } }],
  ['Fern_1', 'nature', { ratio: 0.6 }], ['Clover_1', 'nature', { keep: 0.5, grow: 1.25 }], ['Clover_2', 'nature', { keep: 0.5, grow: 1.25 }],
  ['Plant_1', 'nature', {}], ['Plant_1_Big', 'nature', {}], ['Plant_7', 'nature', {}], ['Plant_7_Big', 'nature', {}],
  ['Grass_Common_Short', 'nature', {}], ['Grass_Common_Tall', 'nature', { keep: 0.6, grow: 1.15, ratio: 0.5 }], ['Grass_Wispy_Short', 'nature', { keep: 0.4, grow: 1.25, ratio: 0.6 }], ['Grass_Wispy_Tall', 'nature', { keep: 0.4, grow: 1.25, ratio: 0.6 }],
  // light versions for the instanced ground cover near the player (src/ground.js)
  ['Grass_Tuft', 'nature', { src: 'Grass_Common_Short', keep: 0.5, grow: 1.25, ratio: 0.38 }], ['Clover_Small', 'nature', { src: 'Clover_1', keep: 0.22, grow: 1.5 }], ['Fern_Small', 'nature', { src: 'Fern_1', ratio: 0.4 }],
  ['Flower_3_Single', 'nature', { ratio: 0.45, ratioMat: { Flowers: 1 } }], ['Flower_3_Group', 'nature', { ratio: 0.25, ratioMat: { Flowers: 1 } }],
  ['Flower_4_Single', 'nature', { ratio: 0.4, ratioMat: { Flowers: 0.3 } }], ['Flower_4_Group', 'nature', { ratio: 0.3, ratioMat: { Flowers: 0.22 } }],
  ...[1, 2, 3, 4, 5].map((i) => [`Petal_${i}`, 'nature', {}]),
  ['Mushroom_Common', 'nature', { tris: 180 }], ['Mushroom_Laetiporus', 'nature', { tris: 420 }],
  ...[1, 2, 3].map((i) => [`Rock_Medium_${i}`, 'nature', { ratio: 0.6 }]),
  ...[1, 2, 3, 4, 5].map((i) => [`Pebble_Round_${i}`, 'nature', { ratio: 0.4 }]), ...[1, 2, 3, 4, 5, 6].map((i) => [`Pebble_Square_${i}`, 'nature', {}]),
  ...['Round_Small_1', 'Round_Small_2', 'Round_Small_3', 'Square_Small_1', 'Square_Small_2', 'Square_Small_3']
    .map((n) => [`RockPath_${n}`, 'nature', { ratio: 0.2 }]),
  ['Lantern_Wall', 'props', { tris: 420 }], ['Banner_1_Cloth', 'props', {}],
  ['Prop_WoodenFence_Single', 'village', {}], ['Prop_WoodenFence_Extension1', 'village', {}], ['Prop_WoodenFence_Extension2', 'village', {}],
];

// ── reading the source files ──
const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readModel(dir, name) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${name}.gltf`)), bin = fs.readFileSync(`${dir}/${j.buffers[0].uri}`);
  const acc = (i) => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = NUM[a.type], T = TYPES[a.componentType];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * n);
    const stride = bv.byteStride || n * T.BYTES_PER_ELEMENT, dv = new DataView(bin.buffer, bin.byteOffset);
    const get = { 5126: (o) => dv.getFloat32(o, true), 5123: (o) => dv.getUint16(o, true) / (a.normalized ? 65535 : 1), 5121: (o) => dv.getUint8(o) / (a.normalized ? 255 : 1), 5125: (o) => dv.getUint32(o, true) }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = get(off + k * stride + c * T.BYTES_PER_ELEMENT);
    return out;
  };
  // node transform (some props have a scale on their one node)
  const node = j.nodes.find((n) => n.mesh !== undefined) || {}, sc = node.scale || [1, 1, 1];
  if (node.rotation && node.rotation.some((v, i) => Math.abs(v - [0, 0, 0, 1][i]) > 1e-4)) throw new Error(`${name}: rotated node`);
  const prims = [];
  for (const m of j.meshes) for (const p of m.primitives) {
    const mat = j.materials[p.material], tex = mat.pbrMetallicRoughness?.baseColorTexture;
    const pos = acc(p.attributes.POSITION); for (let i = 0; i < pos.length; i++) pos[i] *= sc[i % 3];
    prims.push({ mat: mat.name, image: tex ? `${dir}/${j.images[j.textures[tex.index].source].uri}` : null, pos, nor: acc(p.attributes.NORMAL),
      uv: p.attributes.TEXCOORD_0 !== undefined ? acc(p.attributes.TEXCOORD_0) : null, col: p.attributes.COLOR_0 !== undefined ? acc(p.attributes.COLOR_0) : null,
      idx: Uint32Array.from(acc(p.indices)) });
  }
  return prims;
}
const images = new Map(); // path → { w, h, data (RGBA) }
async function image(file) {
  if (!images.has(file)) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    images.set(file, { w: info.width, h: info.height, data, file });
  }
  return images.get(file);
}
const srgb2lin = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin2srgb = (c) => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function meanColour(img) { // mean of the opaque pixels (linear), as sRGB 0–1
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < img.data.length; i += 4 * 7) if (img.data[i + 3] > 128) { r += srgb2lin(img.data[i] / 255); g += srgb2lin(img.data[i + 1] / 255); b += srgb2lin(img.data[i + 2] / 255); n++; }
  return [r / n, g / n, b / n].map(lin2srgb);
}
const blurred = new Map(); // a 48 px copy for 'sample' (wood grain and scratches average out)
async function blur(file) {
  if (!blurred.has(file)) {
    const N = 48, { data } = await sharp(file).removeAlpha().resize(N, N, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true });
    blurred.set(file, { N, data });
  }
  return blurred.get(file);
}

// ── geometry helpers ──
function weld(pos, idx) { // vertices at the same place become one (first one wins)
  const map = new Map(), remap = new Uint32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${Math.round(pos[i * 3] * 2000)},${Math.round(pos[i * 3 + 1] * 2000)},${Math.round(pos[i * 3 + 2] * 2000)}`;
    if (!map.has(k)) map.set(k, i);
    remap[i] = map.get(k);
  }
  return idx.map((i) => remap[i]);
}
function compact(p, idx) { // drop unused vertices
  const used = new Int32Array(p.pos.length / 3).fill(-1); let n = 0;
  for (const i of idx) if (used[i] < 0) used[i] = n++;
  const out = { ...p, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), uv: p.uv && new Float32Array(n * 2), col: p.col && new Float32Array(n * 4), idx: idx.map((i) => used[i]) };
  used.forEach((to, from) => {
    if (to < 0) return;
    for (let c = 0; c < 3; c++) { out.pos[to * 3 + c] = p.pos[from * 3 + c]; out.nor[to * 3 + c] = p.nor[from * 3 + c]; }
    if (p.uv) { out.uv[to * 2] = p.uv[from * 2]; out.uv[to * 2 + 1] = p.uv[from * 2 + 1]; }
    if (p.col) for (let c = 0; c < 4; c++) out.col[to * 4 + c] = p.col[from * 4 + c];
  });
  return out;
}
function smoothNormals(p) {
  const n = new Float32Array(p.pos.length), P = p.pos, I = p.idx;
  for (let f = 0; f < I.length; f += 3) {
    const [a, b, c] = [I[f] * 3, I[f + 1] * 3, I[f + 2] * 3];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // length = 2 × area: big faces count more
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const L = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= L; n[i + 1] /= L; n[i + 2] /= L; }
  p.nor = n;
}
function simplify(p, targetTris, welded) {
  if (p.idx.length / 3 <= targetTris) return p;
  const src = welded ? weld(p.pos, p.idx) : p.idx;
  // 'Permissive': the kit's models are faceted (every face has its own vertices), which
  // the simplifier would otherwise treat as seams it must keep
  const [idx] = welded ? MeshoptSimplifier.simplify(src, p.pos, 3, Math.floor(targetTris) * 3, 0.1, ['Permissive'])
    : MeshoptSimplifier.simplifyWithAttributes(src, p.pos, 3, p.uv, 2, [1.5, 1.5], null, Math.floor(targetTris) * 3, 0.1, ['Permissive']);
  const out = compact(p, idx);
  if (welded) smoothNormals(out);
  return out;
}
// Leaf cards: keep a share of the separate pieces and make the kept ones bigger.
function thin(p, keep, grow, seed) {
  const n = p.pos.length / 3, parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let f = 0; f < p.idx.length; f += 3) { const a = find(p.idx[f]); parent[find(p.idx[f + 1])] = a; parent[find(p.idx[f + 2])] = a; }
  const roots = [...new Set(Array.from({ length: n }, (_, i) => find(i)))];
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  // evenly through the list (pieces are stored cluster by cluster), with a random start
  const kept = new Set(); let acc = rnd();
  for (const r of roots) { acc += keep; if (acc >= 1) { acc -= 1; kept.add(r); } }
  const cen = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); if (!kept.has(r)) continue; const c = cen.get(r) || [0, 0, 0, 0]; c[0] += p.pos[i * 3]; c[1] += p.pos[i * 3 + 1]; c[2] += p.pos[i * 3 + 2]; c[3]++; cen.set(r, c); }
  const pos = Float32Array.from(p.pos);
  for (let i = 0; i < n; i++) { const c = cen.get(find(i)); if (!c) continue; for (let k = 0; k < 3; k++) pos[i * 3 + k] = c[k] / c[3] + (p.pos[i * 3 + k] - c[k] / c[3]) * grow; }
  const idx = []; for (let f = 0; f < p.idx.length; f += 3) if (kept.has(find(p.idx[f]))) idx.push(p.idx[f], p.idx[f + 1], p.idx[f + 2]);
  return { out: compact({ ...p, pos }, Uint32Array.from(idx)), pieces: roots.length, kept: kept.size };
}

// Some cards use uv 1–2 (the texture repeats): move every separate piece back into 0–1.
function unwrapUV(p) {
  const n = p.pos.length / 3, parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let f = 0; f < p.idx.length; f += 3) { const a = find(p.idx[f]); parent[find(p.idx[f + 1])] = a; parent[find(p.idx[f + 2])] = a; }
  const min = new Map();
  for (let i = 0; i < n; i++) { const r = find(i), m = min.get(r) || [1e9, 1e9]; m[0] = Math.min(m[0], p.uv[i * 2]); m[1] = Math.min(m[1], p.uv[i * 2 + 1]); min.set(r, m); }
  for (let i = 0; i < n; i++) { const m = min.get(find(i)); p.uv[i * 2] -= Math.floor(m[0] + 0.01); p.uv[i * 2 + 1] -= Math.floor(m[1] + 0.01); }
}

// ── pass 1: read everything, find which part of each atlas texture is used ──
const loaded = [];
const regions = new Map(); // image path → { u0, v0, u1, v1, scale, cut, mask }
for (const [name, kit, o] of MODELS) {
  const prims = readModel(DIRS[kit], o.src || name);
  for (const p of prims) {
    const M = MATS[p.mat]; if (!M) throw new Error(`${name}: no rule for material ${p.mat}`);
    if (M.mode === 'mask' || M.mode === 'atlas') {
      unwrapUV(p);
      const r = regions.get(p.image) || { u0: 1, v0: 1, u1: 0, v1: 0, scale: M.scale, cut: !!M.cut, mask: M.mode === 'mask' };
      for (let i = 0; i < p.uv.length; i += 2) {
        if (p.uv[i] < -0.15 || p.uv[i] > 1.15 || p.uv[i + 1] < -0.15 || p.uv[i + 1] > 1.15) throw new Error(`${name}/${p.mat}: uv far outside 0–1 (${p.uv[i]}, ${p.uv[i + 1]})`);
        p.uv[i] = Math.min(1, Math.max(0, p.uv[i])); p.uv[i + 1] = Math.min(1, Math.max(0, p.uv[i + 1])); // (a few cards stick out a little)
        r.u0 = Math.min(r.u0, p.uv[i]); r.u1 = Math.max(r.u1, p.uv[i]); r.v0 = Math.min(r.v0, p.uv[i + 1]); r.v1 = Math.max(r.v1, p.uv[i + 1]);
      }
      regions.set(p.image, r);
    }
  }
  loaded.push({ name, o, prims });
}

// ── the atlas ──
const AW = 1024, PAD = 6, WHITE = 16;
let AH = 0;
{
  const list = [];
  for (const [file, r] of regions) {
    const img = await image(file);
    r.x0 = Math.max(0, Math.floor(r.u0 * img.w) - 2); r.y0 = Math.max(0, Math.floor(r.v0 * img.h) - 2);
    r.x1 = Math.min(img.w, Math.ceil(r.u1 * img.w) + 2); r.y1 = Math.min(img.h, Math.ceil(r.v1 * img.h) + 2);
    r.w = Math.round((r.x1 - r.x0) * r.scale); r.h = Math.round((r.y1 - r.y0) * r.scale);
    list.push([file, r]);
  }
  // shelves, tallest first; the white block sits in the top-left corner (uv 0,0)
  list.sort((a, b) => b[1].h - a[1].h);
  let x = WHITE + PAD, y = 0, shelf = 0;
  for (const [, r] of list) {
    if (x + r.w > AW) { x = 0; y += shelf + PAD; shelf = 0; }
    r.ax = x; r.ay = y; x += r.w + PAD; shelf = Math.max(shelf, r.h);
  }
  AH = Math.ceil((y + shelf) / 4) * 4; // (not a power of two: fine in WebGL 2)
  const layers = [{ input: { create: { width: WHITE, height: WHITE, channels: 4, background: '#ffffffff' } }, left: 0, top: 0 }];
  for (const [file, r] of list) {
    let { data, info } = await sharp(file).ensureAlpha().extract({ left: r.x0, top: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 })
      .resize(r.w, r.h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    if (r.mask) for (let i = 0; i < n; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255; }
    else if (r.cut) { // spread the colours into the transparent pixels (no dark fringe at the cut-out edge)
      const W = info.width, Hh = info.height;
      let done = new Uint8Array(n); for (let i = 0; i < n; i++) done[i] = data[i * 4 + 3] > 100 ? 1 : 0;
      for (let pass = 0; pass < 12; pass++) {
        const next = Uint8Array.from(done);
        for (let yy = 0; yy < Hh; yy++) for (let xx = 0; xx < W; xx++) {
          const i = yy * W + xx; if (done[i]) continue;
          let rr = 0, gg = 0, bb = 0, c = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = xx + dx, Y = yy + dy; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; const k = Y * W + X; if (done[k]) { rr += data[k * 4]; gg += data[k * 4 + 1]; bb += data[k * 4 + 2]; c++; } }
          if (c) { data[i * 4] = rr / c; data[i * 4 + 1] = gg / c; data[i * 4 + 2] = bb / c; next[i] = 1; }
        }
        done = next;
      }
    }
    layers.push({ input: data, raw: { width: info.width, height: info.height, channels: 4 }, left: r.ax, top: r.ay });
    if (!r.cut && !r.mask) { // opaque pictures: repeat the edge pixels into the padding (mip-maps would bleed otherwise)
      const edge = async (l, t, w, h, W2, H2, dx, dy) => layers.push({ input: await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).extract({ left: l, top: t, width: w, height: h }).resize(W2, H2, { fit: 'fill', kernel: 'nearest' }).raw().toBuffer(), raw: { width: W2, height: H2, channels: 4 }, left: r.ax + dx, top: r.ay + dy });
      const P = PAD / 2;
      if (r.ax >= P) await edge(0, 0, 1, r.h, P, r.h, -P, 0);
      if (r.ax + r.w + P <= AW) await edge(r.w - 1, 0, 1, r.h, P, r.h, r.w, 0);
      if (r.ay >= P) await edge(0, 0, r.w, 1, r.w, P, 0, -P);
      if (r.ay + r.h + P <= AH) await edge(0, r.h - 1, r.w, 1, r.w, P, 0, r.h);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  await sharp({ create: { width: AW, height: AH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } }).composite(layers)
    .webp({ quality: 82, alphaQuality: 90, effort: 6, exact: true }).toFile(`${OUT}/atlas.webp`);
  if (process.env.ATLAS_PNG) await sharp({ create: { width: AW, height: AH, channels: 4, background: { r: 255, g: 0, b: 255, alpha: 1 } } }).composite(layers).png().toFile(process.env.ATLAS_PNG);
}

// ── pass 2: process the models ──
const out = [];
for (const { name, o, prims } of loaded) {
  const parts = []; const note = [];
  // the leaves' bounding box (for the soft "ball" normals and the light-to-dark gradient)
  const leafBox = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  for (const p of prims) if (MATS[p.mat].mode === 'mask') for (let i = 0; i < p.pos.length; i++) { leafBox.min[i % 3] = Math.min(leafBox.min[i % 3], p.pos[i]); leafBox.max[i % 3] = Math.max(leafBox.max[i % 3], p.pos[i]); }
  for (let p of prims) {
    const M = MATS[p.mat], before = p.idx.length / 3;
    const img = p.image ? await image(p.image) : null;
    const src = p; // (uv / col are read before the geometry changes)
    if (!p.col) p.col = new Float32Array((p.pos.length / 3) * 4).fill(1);
    const keep = o.keepMat?.[p.mat] ?? (M.mode === 'mask' || M.cut || p.mat === 'Grass' ? o.keep : undefined);
    if (keep) { const t = thin(p, keep, M.mode === 'mask' || p.mat === 'Grass' || p.mat === 'Leaves' ? o.grow : 1, name.length * 7919 + before); p = t.out; }
    if (keep && o.ratio) p = simplify(p, (p.idx.length / 3) * o.ratio, true); // (blades with fewer bends)
    if (keep) { /* done */ } else if (M.mode === 'flat' || M.mode === 'sample') { if (o.tris) p = simplify(p, o.tris * (before / prims.filter((q) => ['flat', 'sample'].includes(MATS[q.mat].mode)).reduce((s, q) => s + q.idx.length / 3, 0)), true); }
    else if (o.tris) p = simplify(p, o.tris, false);
    else if (o.ratio) p = simplify(p, before * (o.ratioMat?.[p.mat] ?? o.ratio), false);
    const n = p.pos.length / 3, uv = new Float32Array(n * 2), col = new Float32Array(n * 4), nor = Float32Array.from(p.nor);
    const r = regions.get(p.image);
    const mean = M.mode === 'flat' ? meanColour(img) : null, bl = M.mode === 'sample' ? await blur(p.image) : null;
    for (let i = 0; i < n; i++) {
      const ao = p.col[i * 4]; // the kit's vertex colour is a grey value: AO on trunks, 0 at the root of grass and leaves
      let c = [1, 1, 1], a = 1;
      if (M.mode === 'flat') { const k = 0.45 + 0.55 * ao; c = mean.map((v) => v * k); }
      else if (M.mode === 'sample') {
        const u = Math.min(0.999, Math.max(0, p.uv[i * 2] - Math.floor(p.uv[i * 2]))), v = Math.min(0.999, Math.max(0, p.uv[i * 2 + 1] - Math.floor(p.uv[i * 2 + 1])));
        const k = (Math.floor(v * bl.N) * bl.N + Math.floor(u * bl.N)) * 3, sh = M.ao ? 1 - M.ao + M.ao * ao : 1;
        c = [bl.data[k] / 255 * sh, bl.data[k + 1] / 255 * sh, bl.data[k + 2] / 255 * sh];
        if (M.grey) { const g = Math.max(...c); c = [g, g, g].map((v) => Math.min(1, v * 1.5)); }
        if (M.foliage) a = 0;
      } else {
        const px = p.uv[i * 2] * img.w, py = p.uv[i * 2 + 1] * img.h;
        uv[i * 2] = (r.ax + (px - r.x0) * r.scale) / AW; uv[i * 2 + 1] = (r.ay + (py - r.y0) * r.scale) / AH;
        if (M.mode === 'mask') {
          // tree crowns: lighter at the top, darker below and inside; the game adds the colour
          const t = (p.pos[i * 3 + 1] - leafBox.min[1]) / Math.max(0.01, leafBox.max[1] - leafBox.min[1]);
          const g = 0.66 + 0.34 * t; c = [g, g, g]; a = 0;
        } else if (M.ao) { const k = 1 - M.ao + M.ao * ao; c = [k, k, k]; }
      }
      col.set([c[0], c[1], c[2], a], i * 4);
      if (M.mode === 'mask') { // soft normals: away from the middle of the crown, a bit upwards
        const cx = (leafBox.min[0] + leafBox.max[0]) / 2, cy = leafBox.min[1] + (leafBox.max[1] - leafBox.min[1]) * 0.35, cz = (leafBox.min[2] + leafBox.max[2]) / 2;
        let x = p.pos[i * 3] - cx, y = p.pos[i * 3 + 1] - cy + 0.6, z = p.pos[i * 3 + 2] - cz; const L = Math.hypot(x, y, z) || 1;
        nor.set([x / L, y / L, z / L], i * 3);
      } else if (M.up) { // ground plants: lit like the ground they stand on
        let x = p.nor[i * 3] * (1 - M.up), y = p.nor[i * 3 + 1] * (1 - M.up) + M.up, z = p.nor[i * 3 + 2] * (1 - M.up); const L = Math.hypot(x, y, z) || 1;
        nor.set([x / L, y / L, z / L], i * 3);
      }
    }
    void src;
    parts.push({ pos: p.pos, nor, uv, col, idx: p.idx });
    note.push(`${p.mat} ${before}→${p.idx.length / 3}`);
  }
  // one mesh per model
  const nv = parts.reduce((s, p) => s + p.pos.length / 3, 0), ni = parts.reduce((s, p) => s + p.idx.length, 0);
  const m = { name, pos: new Float32Array(nv * 3), nor: new Float32Array(nv * 3), uv: new Float32Array(nv * 2), col: new Float32Array(nv * 4), idx: new Uint32Array(ni) };
  let v0 = 0, i0 = 0;
  for (const p of parts) {
    m.pos.set(p.pos, v0 * 3); m.nor.set(p.nor, v0 * 3); m.uv.set(p.uv, v0 * 2); m.col.set(p.col, v0 * 4);
    for (let i = 0; i < p.idx.length; i++) m.idx[i0 + i] = p.idx[i] + v0;
    v0 += p.pos.length / 3; i0 += p.idx.length;
  }
  out.push(m);
  console.log(name.padEnd(28), String(ni / 3).padStart(5), 'tris ', note.join(', '));
}

// ── write the .glb ──
{
  const chunks = []; let len = 0;
  const push = (buf) => { const pad = (4 - (buf.byteLength % 4)) % 4; const off = len; chunks.push(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength)); if (pad) chunks.push(Buffer.alloc(pad)); len += buf.byteLength + pad; return off; };
  const j = { asset: { version: '2.0', generator: 'verb-hatchery tools/build-qnature.mjs' }, extensionsUsed: ['KHR_mesh_quantization'], scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] };
  const view = (buf, stride, target) => { j.bufferViews.push({ buffer: 0, byteOffset: push(buf), byteLength: buf.byteLength, ...(stride ? { byteStride: stride } : {}), target }); return j.bufferViews.length - 1; };
  for (const m of out) {
    const n = m.pos.length / 3;
    const nor = new Int8Array(n * 4), uv = new Uint16Array(n * 2), col = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) nor[i * 4 + c] = Math.round(m.nor[i * 3 + c] * 127);
      uv[i * 2] = Math.round(Math.min(1, Math.max(0, m.uv[i * 2])) * 65535); uv[i * 2 + 1] = Math.round(Math.min(1, Math.max(0, m.uv[i * 2 + 1])) * 65535);
      for (let c = 0; c < 4; c++) col[i * 4 + c] = Math.round(Math.min(1, Math.max(0, m.col[i * 4 + c])) * 255);
    }
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < m.pos.length; i++) { mn[i % 3] = Math.min(mn[i % 3], m.pos[i]); mx[i % 3] = Math.max(mx[i % 3], m.pos[i]); }
    const idx = n > 65535 ? m.idx : Uint16Array.from(m.idx);
    const a = j.accessors.length;
    j.accessors.push({ bufferView: view(m.pos, 12, 34962), componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx },
      { bufferView: view(nor, 4, 34962), componentType: 5120, normalized: true, count: n, type: 'VEC3' },
      { bufferView: view(uv, 4, 34962), componentType: 5123, normalized: true, count: n, type: 'VEC2' },
      { bufferView: view(col, 4, 34962), componentType: 5121, normalized: true, count: n, type: 'VEC4' },
      { bufferView: view(idx, 0, 34963), componentType: n > 65535 ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
    j.meshes.push({ primitives: [{ attributes: { POSITION: a, NORMAL: a + 1, TEXCOORD_0: a + 2, COLOR_0: a + 3 }, indices: a + 4 }] });
    j.nodes.push({ name: m.name, mesh: j.meshes.length - 1 }); j.scenes[0].nodes.push(j.nodes.length - 1);
  }
  const bin = Buffer.concat(chunks); j.buffers.push({ byteLength: bin.length });
  let json = Buffer.from(JSON.stringify(j)); json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
  const h1 = Buffer.alloc(8); h1.writeUInt32LE(json.length, 0); h1.writeUInt32LE(0x4e4f534a, 4);
  const h2 = Buffer.alloc(8); h2.writeUInt32LE(bin.length, 0); h2.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(`${OUT}/qnature.glb`, Buffer.concat([head, h1, json, h2, bin]));
  console.log(`\n${out.length} models, ${out.reduce((s, m) => s + m.idx.length / 3, 0)} triangles → qnature.glb ${(fs.statSync(`${OUT}/qnature.glb`).size / 1024).toFixed(0)} KB, atlas ${AW}×${AH} ${(fs.statSync(`${OUT}/atlas.webp`).size / 1024).toFixed(0)} KB`);
}
