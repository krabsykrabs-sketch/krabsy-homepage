// The island: terrain (a height function, so the player needs no physics engine),
// zones, nature (Quaternius trees / rocks / plants in the static batch), the home base with incubators
// and pens, wild eggs with nests and light beams, locked-zone walls.
// World step 3 added the island's shape: an irregular coast (coast), the Volcano's ridges and lava
// streams, the Meadow's hill, the stream with its bridge, the lighthouse knoll, three tiny islands.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RARITY, MAX_PENS, MAX_INCUBATORS, ISLAND, HOME, ZONES } from './balance.js';
import { buildCreature, animateCreature, rng } from './creatures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticBatch, paint, paintMat, setAtlas, seeThrough, wind } from './merge.js';
import { loadQ } from './qnature.js';
import { GroundCover } from './ground.js';

export const WATER_Y = -0.6;
const zone = (id) => ZONES.find((z) => z.id === id);
const FOREST = zone('forest'), BEACH = zone('beach'), VOLCANO = zone('volcano');
const dist = (x, z, ax, az) => Math.hypot(x - ax, z - az);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A pond in the meadow and dirt paths from home to each zone (also used by decor.js).
export const POND = { x: 38, z: 20, r: 10, water: 0.15 };
// The pond is not a circle: its radius changes with the direction (×0.75 … ×1.3).
// pondD = the distance from its middle as if it were round with radius POND.r,
// so "pondD < POND.r" is the bank everywhere; the waterline is at about 0.8 × that.
export const pondF = (a) => 1 + 0.17 * Math.sin(2 * a + 0.6) + 0.09 * Math.sin(3 * a + 2.1) + 0.04 * Math.sin(5 * a + 4);
export const pondD = (x, z) => Math.hypot(x - POND.x, z - POND.z) / pondF(Math.atan2(z - POND.z, x - POND.x));
// a point at `d` (round-pond metres) from the middle in direction `a`
export const pondPoint = (a, d) => [POND.x + Math.cos(a) * d * pondF(a), POND.z + Math.sin(a) * d * pondF(a)];
const dp = pondD;
export const PATHS = [
  [[0, 46], [0, 24], [-20, 8], [-38, -8]],          // to the Forest
  [[0, 24], [26, 12], [50, -2], [70, -12]],         // to the Beach
  [[0, 24], [-4, -8], [2, -40], [0, -64]],          // to the Volcano
];
export const FORK = { x: 3, z: 22 };
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function pathDist(x, z) {
  let d = 1e9;
  for (const p of PATHS) for (let i = 1; i < p.length; i++) d = Math.min(d, segDist(x, z, p[i - 1], p[i]));
  return d;
}
// The base's wooden deck (the terrain under it is lowered so the two never flicker).
export const DECK = { x0: HOME.x - 15.2, x1: HOME.x + 15.2, z0: HOME.z - 11.2, z1: HOME.z + 15.2 };
const onDeck = (x, z) => x > DECK.x0 && x < DECK.x1 && z > DECK.z0 && z < DECK.z1;

// The beach is a bay cut into the east coast: sand runs down into shallow water.
// BAY = the circle of sea that bites into the island; its edge is the waterline.
export const BAY = { x: BEACH.x + 36, z: BEACH.z, r: 28 };
const bayS = (x, z) => dist(x, z, BAY.x, BAY.z) - BAY.r; // metres inland from the bay's waterline (< 0 = in the bay)
// 1 on the beach, 0 where the normal island terrain takes over
export function beachW(x, z) {
  return (1 - smooth(34, 50, bayS(x, z))) * (1 - smooth(38, 56, dist(x, z, BEACH.x, BEACH.z)));
}
export const bayPoint = (ang, s) => [BAY.x - Math.cos(ang) * (BAY.r + s), BAY.z + Math.sin(ang) * (BAY.r + s)]; // ang 0 = due west of the bay centre
// A small sand islet in the bay, reached by wading along a sandbar.
export const ISLET = (() => { const [x, z] = bayPoint(0.8, -13.5); return { x, z, r: 6.5, bar: bayPoint(0.8, 1) }; })();
// A wooden pier from the sand out over the water (walkable: part of height()).
export const PIER = (() => {
  const ang = -0.35, [x0, z0] = bayPoint(ang, 10.5);
  return { x0, z0, ux: Math.cos(ang), uz: -Math.sin(ang), len: 26.5, half: 1.5, headLen: 5.5, headHalf: 3.4, top: 0.55, ramp: 3 };
})();
// → [metres along the pier, metres sideways]
export function pierLocal(x, z) {
  const dx = x - PIER.x0, dz = z - PIER.z0;
  return [dx * PIER.ux + dz * PIER.uz, -dx * PIER.uz + dz * PIER.ux];
}
function beachProfile(x, z) {
  const s = bayS(x, z);
  if (s <= 0) return WATER_Y + Math.max(-1.8, s * 0.075);            // shallow water, then the bay floor
  if (s <= 12) return WATER_Y + s * 0.085;                            // wet sand up to the dry beach
  return 0.42 + 1.1 * smooth(12, 44, s) + smooth(15, 26, s) * 0.3 * Math.sin(x * 0.21 + 1) * Math.cos(z * 0.17); // low dunes behind
}

// ── world step 3: what gives the island its shape beyond the round stamps ──
// The coast is not a circle: coast(x, z) = metres the sea reaches further in (+, a cove)
// or the land further out (−, a headland / rocky bit). Behind the hatchery the land
// always reaches out, so the house and the farm stand well inland.
export function coast(x, z) {
  const a = Math.atan2(z - ISLAND.cz, x - ISLAND.cx);
  const n = 3.6 * Math.sin(3 * a + 0.6) + 2.6 * Math.sin(5 * a + 2.1) + 1.7 * Math.sin(8 * a + 4.4) + 1.0 * Math.sin(13 * a + 1.0);
  let da = Math.abs(a - Math.PI / 2); if (da > Math.PI) da = 2 * Math.PI - da;
  const m = 1 - smooth(0.55, 1.0, da);
  return Math.max(-8, Math.min(5.5, n)) * (1 - m) - 5 * m;
}
// The Volcano's cone has ridges and gullies; lava runs down some of the gullies.
const RIDGES = 7;
const ridgeAt = (a) => Math.sin(a * RIDGES + 0.9 + 0.55 * Math.sin(a * 3 + 1.3)); // −1 = bottom of a gully, 1 = crest
export const LAVA_RIM = 6;            // crater radius
export const LAVA_ANGLES = (() => {   // the gullies that carry lava (those facing the island, not the open sea)
  const out = [];
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2, v = ridgeAt(a);
    if (v < ridgeAt(a - 0.0087) && v <= ridgeAt(a + 0.0087) && v < -0.9) out.push(a);
  }
  return out.filter((a) => Math.sin(a) > -0.35); // (z grows towards home: sin > 0 = the side you see)
})();
// a lava stream's centre line: [x, z] at `d` metres from the crater's middle
export const lavaPoint = (k, d) => { const a = LAVA_ANGLES[k] + 0.07 * Math.sin(d * 0.33 + k * 2.1) * smooth(7, 12, d); return [VOLCANO.x + Math.cos(a) * d, VOLCANO.z + Math.sin(a) * d]; };
export const LAVA_END = VOLCANO.r + 4; // where the streams cool and stop
// The Meadow's landmarks: a hill with one huge tree; a stream from the pond to the sea
// with a stone bridge; a scarecrow field beyond the bridge; a ruin near the stone circle.
export const CAMP = { x: FOREST.x + 12, z: FOREST.z + 16 }; // the Forest camp's clearing
export const HILL = { x: 36, z: -37, r: 20, h: 5.2 };
export const FIELD = { x: 82, z: 41 };
export const RUIN = { x: -57, z: 37 };
// the stream's centre line (a smooth curve through a few points), pond → sea
export const STREAM = (() => {
  const P = [[38, 20], [44.5, 27.5], [52, 37], [58, 48], [68, 59], [78, 72], [85, 82]], out = [];
  for (let i = 1; i < P.length - 2; i++) for (let k = 0; k < 6; k++) {
    const t = k / 6, a = P[i - 1], b = P[i], c = P[i + 1], d = P[i + 2];
    out.push([0, 1].map((j) => 0.5 * (2 * b[j] + (c[j] - a[j]) * t + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t + (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t * t * t)));
  }
  out.push(P[P.length - 2]);
  let L = 0; const len = [0];
  for (let i = 1; i < out.length; i++) { L += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); len.push(L); }
  return { pts: out, len, L };
})();
// → [distance to the stream's centre line, 0…1 along it]
export function streamAt(x, z) {
  if (x < 34 || x > 92 || z < 16 || z > 86) return [99, 0];
  let best = 1e9, bt = 0; const { pts, len, L } = STREAM;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], LL = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / LL)), d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (d < best) { best = d; bt = (len[i - 1] + (len[i] - len[i - 1]) * t) / L; }
  }
  return [best, bt];
}
// the stream's water level at t (0 = pond, 1 = sea) and how deep it is
export const streamLevel = (t) => POND.water + (WATER_Y + 0.12 - POND.water) * Math.pow(t, 0.85);
export const STREAM_DEPTH = 0.34; // (ankle-deep: you can wade through anywhere)
// A stone bridge over the stream (walkable: part of height(), like the pier).
export const BRIDGE = (() => {
  const { pts } = STREAM, i = 15, c = pts[i], dx = pts[i + 1][0] - pts[i - 1][0], dz = pts[i + 1][1] - pts[i - 1][1], L = Math.hypot(dx, dz);
  return { x: c[0], z: c[1], ux: -dz / L, uz: dx / L, len: 15, half: 1.7 }; // (ux, uz) = along the bridge, across the stream
})();
export function bridgeLocal(x, z) { const dx = x - BRIDGE.x, dz = z - BRIDGE.z; return [dx * BRIDGE.ux + dz * BRIDGE.uz, -dx * BRIDGE.uz + dz * BRIDGE.ux]; }
export const onBridge = (x, z) => { if (Math.abs(x - BRIDGE.x) > 9 || Math.abs(z - BRIDGE.z) > 9) return false; const [a, b] = bridgeLocal(x, z); return Math.abs(a) <= BRIDGE.len / 2 && Math.abs(b) <= BRIDGE.half; };
export const bridgeTop = (a) => { const t = a / (BRIDGE.len / 2); return BRIDGE.y0 + (BRIDGE.y1 - BRIDGE.y0) * (t + 1) / 2 + BRIDGE.rise * (1 - t * t); };
// The lighthouse stands on a rocky knoll on the Beach's north headland.
export const LIGHT = (() => { const [x, z] = bayPoint(-1.3, 8.5); return { x, z, r: 11, h: 3.0 }; })();
// Three tiny islands off the coast (not reachable: deep water in between). r = where the
// sea floor starts to rise; what shows above the water is a little under half of that.
export const ISLETS = [{ x: -98, z: -118, r: 19, h: 2.6 }, { x: -97, z: 79, r: 17, h: 2.2 }, { x: 106, z: 82, r: 14, h: 2.0 }];

// Slow noise for the ground colours (−1 … 1): [meadow patches, ragged zone edges, forest litter]
export function groundNoise(x, z) {
  return [
    (Math.sin(x * 0.052 + 1.7) * Math.cos(z * 0.047 - 0.4) + 0.55 * Math.sin(x * 0.11 - z * 0.093 + 2.2) + 0.3 * Math.sin(x * 0.23 + z * 0.19)) / 1.5,
    (Math.sin(x * 0.19 + z * 0.13) + 0.6 * Math.sin(x * 0.31 - z * 0.37 + 1.1)) / 1.6,
    Math.sin(x * 0.16 + 0.5) * Math.sin(z * 0.14 + 2.0) + 0.4 * Math.sin(x * 0.4 - z * 0.33),
  ];
}

// ── height function (metres) ──
// terrainH = the ground itself (the terrain mesh); height = what you stand on (ground or pier).
export function terrainH(x, z) {
  const d = dist(x, z, ISLAND.cx, ISLAND.cz);
  let h = 1.2 * Math.sin(x * 0.045) * Math.cos(z * 0.04) + 0.6 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4)
    + 0.25 * Math.sin(x * 0.27) * Math.cos(z * 0.23);
  h += 2.0; // keeps every inland dip well above the sea (an inland dip below it was an invisible wall)
  // forest: rolling hills
  const df = dist(x, z, FOREST.x, FOREST.z);
  h += (1 - smooth(FOREST.r * 0.6, FOREST.r + 8, df)) * (1.6 + 1.4 * Math.sin(x * 0.13) * Math.sin(z * 0.15));
  // volcano: a cone with a crater
  // (a rough cone: ridges and gullies run down from the crater, a little bumpy all over;
  // the gullies that carry lava cut a notch into the crater's rim)
  const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
  const cone = Math.max(0, 1 - dv / (VOLCANO.r + 8));
  if (cone > 0) {
    const va = Math.atan2(z - VOLCANO.z, x - VOLCANO.x), rg = ridgeAt(va);
    const rough = 1 + (0.24 * rg + 0.07 * Math.sin(x * 0.52 + 1) * Math.sin(z * 0.58 + 2)) * smooth(5, 14, dv);
    h += 24 * Math.pow(cone, 1.6) * rough;
    if (dv < LAVA_RIM) h -= (LAVA_RIM - dv) * 2.1; // the crater (the cone itself rises about 1 m per metre here)
    else if (dv < 11) for (const la of LAVA_ANGLES) { let da = Math.abs(va - la); if (da > Math.PI) da = 2 * Math.PI - da; h -= 1.5 * (1 - smooth(0, 0.3, da)) * (1 - smooth(LAVA_RIM, 11, dv)); }
  }
  // the meadow's hill with the giant tree
  const dhl = dist(x, z, HILL.x, HILL.z);
  if (dhl < HILL.r) h += HILL.h * (1 - smooth(1.5, HILL.r, dhl));
  // home: flat
  const dh = dist(x, z, HOME.x, HOME.z);
  const home = 1 - smooth(20, 30, dh);
  h = h * (1 - home) + 0.4 * home;
  // the pond: a bowl below its water
  // (its floor stays above the sea level, so the sea mesh never shows through)
  const pd = pondD(x, z);
  if (pd < POND.r + 3) { const k = smooth(POND.r * 0.6, POND.r + 3, pd); h = h * k + (WATER_Y + 0.15) * (1 - k); }
  // island edge: down into the sea (coves and headlands, see coast())
  if (d > ISLAND.r - 30) h -= smooth(ISLAND.r - 18, ISLAND.r + 6, d + coast(x, z)) * 6;
  // the stream from the pond to the sea: a shallow bed in a gentle valley
  const [sd, st] = streamAt(x, z);
  if (sd < 11.5) {
    const bed = streamLevel(st) - STREAM_DEPTH;
    // (the bed is flat for 3 m each side: the terrain mesh is a 2 m grid and has to catch it)
    if (h > bed) h = bed + (h - bed) * smooth(3.0, 10.5, sd + 0.5 * Math.sin(x * 0.4 + z * 0.3));
  }
  // the beach and its bay replace all of that on the east coast
  const w = beachW(x, z);
  if (w > 0) {
    h = h * (1 - w) + beachProfile(x, z) * w;
    const bar = 1 - smooth(1.6, 5, segDist(x, z, ISLET.bar, [ISLET.x, ISLET.z]));   // sandbar: ankle-deep
    h = Math.max(h, h + (WATER_Y - 0.12 - h) * bar);
    const isl = 1 - smooth(2, ISLET.r + 1.5, dist(x, z, ISLET.x, ISLET.z));          // the islet
    h = Math.max(h, h + (0.8 - h) * isl);
  }
  // the lighthouse knoll, and the tiny islands out at sea
  const dl = dist(x, z, LIGHT.x, LIGHT.z);
  if (dl < LIGHT.r) h = Math.max(h, h + (LIGHT.h - h) * (1 - smooth(3, LIGHT.r, dl)));
  if (d > ISLAND.r) for (const I of ISLETS) {
    const di = dist(x, z, I.x, I.z);
    if (di < I.r) h = Math.max(h, h + (I.h - h) * (1 - smooth(1.5, I.r, di + 1.2 * Math.sin(x * 0.5) * Math.cos(z * 0.45))));
  }
  return h;
}
// The ground as it is drawn: the terrain mesh is a 2 m grid of triangles, and on rough
// ground (the Volcano's ridges) the smooth function above and the mesh differ by a few
// decimetres. Everything that stands on the ground uses the mesh's own height, so feet,
// eggs and props touch what you see. (The grid is filled on first use.)
export const TGRID = { size: 300, seg: 150 };
let tgrid = null;
export function groundH(x, z) {
  const { size, seg } = TGRID, step = size / seg, n = seg + 1;
  const fx = (x - ISLAND.cx + size / 2) / step, fz = (z - ISLAND.cz + size / 2) / step;
  if (!(fx >= 0 && fz >= 0 && fx < seg && fz < seg)) return terrainH(x, z);
  if (!tgrid) { tgrid = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) tgrid[j * n + i] = terrainH(ISLAND.cx - size / 2 + i * step, ISLAND.cz - size / 2 + j * step); }
  const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, k = iz * n + ix;
  const a = tgrid[k], b = tgrid[k + n], c = tgrid[k + n + 1], dd = tgrid[k + 1]; // PlaneGeometry: triangles (a, b, d) and (b, c, d)
  return u + v <= 1 ? a + u * (dd - a) + v * (b - a) : c + (1 - u) * (b - c) + (1 - v) * (dd - c);
}
export function onPier(x, z) {
  const [a, b] = pierLocal(x, z);
  return a >= 0 && a <= PIER.len && Math.abs(b) <= (a > PIER.len - PIER.headLen ? PIER.headHalf : PIER.half);
}
export function height(x, z) {
  const h = groundH(x, z);
  if (onBridge(x, z)) return Math.max(h, bridgeTop(bridgeLocal(x, z)[0]));
  if (!onPier(x, z)) return h;
  const [a] = pierLocal(x, z);
  return Math.max(h, PIER.y0 + (PIER.top - PIER.y0) * smooth(0, PIER.ramp, a));
}
PIER.y0 = terrainH(PIER.x0, PIER.z0); // the pier starts level with the sand
{ // the bridge's ends lie on the banks, its middle arches over the water
  const e = (s) => groundH(BRIDGE.x + BRIDGE.ux * s * BRIDGE.len / 2, BRIDGE.z + BRIDGE.uz * s * BRIDGE.len / 2);
  BRIDGE.y0 = e(-1) + 0.05; BRIDGE.y1 = e(1) + 0.05; BRIDGE.rise = 1.0;
}
// Distance to the shore (metres, > 0 = in the water) of water standing at `level`:
// ≈ depth / slope; on flat shallows (sandbar, pond floor) the depth alone.
function shoreDist(x, z, level) {
  const depth = level - terrainH(x, z);
  const grad = Math.hypot(terrainH(x + 1, z) - terrainH(x - 1, z), terrainH(x, z + 1) - terrainH(x, z - 1)) / 2;
  return Math.max(-6, Math.min(40, depth / Math.max(grad, 0.03), depth / 0.075));
}
// How deep you can wade into the sea.
export const WADE = 0.28; // the character is small: this is up to its waist
// Walkable = not the sea (wading is fine) and not the deep middle of the pond. Inland
// ground is always walkable, so a low dip in a meadow can never act as an invisible
// wall; only the coast and the beach (which has a bay inland) use the height test.
export function onIsland(x, z) {
  if (pondD(x, z) < POND.r * 0.7) return false;
  if (Math.hypot(x - ISLAND.cx, z - ISLAND.cz) < ISLAND.r - 20 && beachW(x, z) < 0.01) return true;
  return height(x, z) > WATER_Y - WADE;
}

export function zoneAt(x, z) {
  for (const zz of ZONES) if (zz.r && dist(x, z, zz.x, zz.z) < zz.r) return zz;
  return ZONES[0];
}

// ── shared egg look ──
const eggGeo = (() => {
  const g = new THREE.SphereGeometry(1, 24, 18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = 1 - 0.2 * Math.max(0, y);
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  g.computeVertexNormals(); g.scale(0.32, 0.42, 0.32); g.translate(0, 0.42, 0);
  return g;
})();
const texCache = {};
function eggTexture(rarity) {
  if (texCache[rarity]) return texCache[rarity];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  const R = RARITY[rarity];
  x.fillStyle = R.css; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#' + R.accent.toString(16).padStart(6, '0');
  x.globalAlpha = 0.55;
  if (rarity === 'legendary') for (let i = 0; i < 6; i++) x.fillRect(0, 14 + i * 20, 256, 5);
  else if (rarity === 'epic') for (let i = 0; i < 16; i++) { x.beginPath(); const px = i * 16, py = 64 + Math.sin(i) * 10; x.moveTo(px, py - 8); x.lineTo(px + 8, py); x.lineTo(px, py + 8); x.lineTo(px - 8, py); x.fill(); }
  else for (let i = 0; i < 26; i++) { x.beginPath(); x.arc((i * 61) % 256, 18 + ((i * 37) % 96), 5 + (i % 4) * 3, 0, Math.PI * 2); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[rarity] = t);
}
const eggMats = {};
export function eggMat(rarity) {
  if (!eggMats[rarity]) {
    const shiny = rarity === 'legendary' || rarity === 'epic';
    eggMats[rarity] = new THREE.MeshStandardMaterial({ map: eggTexture(rarity), roughness: shiny ? 0.22 : 0.55,
      metalness: rarity === 'legendary' ? 0.55 : 0.05, emissive: RARITY[rarity].color, emissiveIntensity: shiny ? 0.25 : 0.06 });
  }
  return eggMats[rarity];
}
export function makeEggMesh(rarity, scale = 1) {
  const m = new THREE.Mesh(eggGeo, eggMat(rarity));
  m.scale.setScalar(scale); m.castShadow = true;
  return m;
}
let glowTexture = null;
export function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (glowTexture = new THREE.CanvasTexture(c));
}
let starTexture = null;
function starTex() {
  if (starTexture) return starTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ffcf5e'; x.strokeStyle = '#0d2240'; x.lineWidth = 4; x.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 28; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  x.closePath(); x.fill(); x.stroke();
  starTexture = new THREE.CanvasTexture(c); starTexture.colorSpace = THREE.SRGBColorSpace;
  return starTexture;
}
// Light beams over rare and better eggs: a thin line in the egg's colour that fades
// out with height (alpha in the vertex colours). main.js widens it with the distance,
// so it stays a thin but visible line from far away. Event eggs get a big one.
export const BEAM_H = 30;
const beamGeo = (() => {
  const g = new THREE.CylinderGeometry(0.15, 0.2, BEAM_H, 8, 5, true).translate(0, BEAM_H / 2, 0);
  const p = g.attributes.position, c = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) { c.set([1, 1, 1, Math.pow(1 - p.getY(i) / BEAM_H, 1.15)], i * 4); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 4));
  return g;
})();
const beamMats = {};
function beamMat(rarity) {
  // a little lighter than the egg, so a blue beam still reads against the blue sky
  return beamMats[rarity] || (beamMats[rarity] = new THREE.MeshBasicMaterial({ color: new THREE.Color(RARITY[rarity].color).lerp(new THREE.Color(0xffffff), 0.18),
    vertexColors: true, transparent: true, opacity: 1, depthWrite: false, fog: false }));
}
const nestGeo = new THREE.TorusGeometry(0.42, 0.14, 6, 14).rotateX(Math.PI / 2);
const nestMat = new THREE.MeshStandardMaterial({ color: 0xa0723f, roughness: 1, flatShading: true });

// ── materials for the base ──
const MAT = {
  ghost: new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, roughness: 1, depthWrite: false }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }),
};
// wooden planks for the deck (canvas texture, repeats)
function deckMat() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    x.fillStyle = ['#d9a46a', '#d29c62', '#ddaa72', '#cf975c'][i % 4]; x.fillRect(0, i * 32, 64, 32);
    x.fillStyle = 'rgba(90,50,20,.35)'; x.fillRect(0, i * 32, 64, 2);
    x.fillStyle = 'rgba(90,50,20,.25)'; x.fillRect((i * 23) % 60, i * 32 + 6, 3, 3); x.fillRect((i * 41 + 30) % 60, i * 32 + 20, 3, 3);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3.5);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
}
// painted primitives (vertex colours) for the merged base meshes
const pbox = (w, h, d, hex, x, y, z) => paint(new THREE.BoxGeometry(w, h, d), hex).translate(x, y, z);
const pcyl = (rt, rb, h, hex, x, y, z, seg = 20) => paint(new THREE.CylinderGeometry(rt, rb, h, seg), hex).translate(x, y, z);
const COL = { wood: 0xc68a52, woodDark: 0x9a6236, metalDark: 0x55657f, teal: 0x2ee6c0, coral: 0xff8585, amber: 0xffcf5e, pen: 0xa8e08f, wall: 0xfff1d6 };

// Base layout (world coordinates). The player arrives from the north (−z).
const HY = 0.4; // base floor height
export const PAD = new THREE.Vector3(HOME.x, HY, HOME.z - 9);
export const INC_POS = Array.from({ length: MAX_INCUBATORS }, (_, i) => new THREE.Vector3(HOME.x - 6.25 + i * 2.5, HY, HOME.z - 2.5));
export const PEN_POS = Array.from({ length: MAX_PENS }, (_, i) => {
  const col = i % 6, row = Math.floor(i / 6);
  return new THREE.Vector3(HOME.x - 11 + col * 4.4, HY, HOME.z + 3.5 + row * 4.4);
});
export const SPAWN = new THREE.Vector3(HOME.x, HY, HOME.z - 17);
// The hatchery building (decor.js builds it; kit walls are 2 m wide and 3.1 m high).
// hall: a long house behind the deck, ridge along x; tower: on its east end, a little forward.
export const HATCHERY = {
  y: HY, wallH: 3.1,
  hall: { x: HOME.x, z: HOME.z + 19.6, w: 14, d: 8 },
  tower: { x: HOME.x + 9, z: HOME.z + 16.1, floors: 3 },
  sign: { w: 8.4, y: HY + 5.0, z: HOME.z + 14.6 },
};

// Sky colours and where the sun stands: in the west-south-west, about 37° up. You
// see it over the Forest; what you look at on the way out from home is lit, not in shade.
const SKY = { top: 0x3f97ea, horizon: 0xcfeeff, sun: 0xfff6d8 };
const SUN_DIR = new THREE.Vector3(-48, 42, 30).normalize();
const HAZE = { forest: new THREE.Color(0xb9e3a4), forestTop: new THREE.Color(0x7fc7a0), volcano: new THREE.Color(0xf0c9a8) };

export class World {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping: keeps the bright, saturated colours (ACES / AgX grey them)
    // and only rolls off the highlights, so sunlit sand and white no longer clip.
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY.horizon);
    this.scene.fog = new THREE.Fog(SKY.horizon, 70, 190); // the fog is the horizon colour, so land and sea fade into the sky
    this._hazeK = [0, 0];
    this.batch = new StaticBatch(this.scene); // everything that never moves (see merge.js)
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.scene.add(this.camera);
    this.colliders = [];   // { x, z, r }
    this.grid = new Map(); // cell → colliders
    this.incubators = []; this.pens = []; this.walls = [];
    this.fx = []; this.time = 0;
    this.animators = []; // per-frame functions (decor life: clouds, birds, smoke …)
    // spots kept free of random trees/rocks for the set pieces: [x, z, radius] (decor.js)
    this.reserved = [];
    this.extra = new Set(); // creatures outside pens (jumping to a pen) that still animate
    this._lights(); this._sky(); this._terrain(); this._water(); this._pond(); this._base(); this._walls();
    this.batch.build(); // the base shows at once; trees and props follow when loaded (main.js builds again)
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  _lights() {
    // more sky light than before (soft, slightly blue shadows), a warm and lower sun
    // (stronger, because a lower sun lights the ground less: the ground is as bright as before)
    this.scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x8fae6a, 1.55));
    const sun = this.sun = new THREE.DirectionalLight(0xffe6bf, 2.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 160;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
    this.scene.add(sun); this.scene.add(sun.target);
    this.sunOffset = SUN_DIR.clone().multiplyScalar(80);
  }
  // The sky: a gradient (pale at the horizon, deeper blue above) with the sun in it.
  // One big triangle-cheap dome drawn behind everything; no extra render pass.
  _sky() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTop: { value: new THREE.Color(SKY.top) }, uHorizon: { value: new THREE.Color(SKY.horizon) },
        uSun: { value: new THREE.Color(SKY.sun) }, uSunDir: { value: SUN_DIR } },
      vertexShader: `varying vec3 vDir;
        void main() { vDir = position; vec4 p = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uTop, uHorizon, uSun, uSunDir; varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          vec3 c = mix(uHorizon, uTop, 1.0 - exp(-max(d.y, 0.0) * 3.0));
          float s = max(dot(d, uSunDir), 0.0);
          float disc = smoothstep(0.9978, 0.9984, s);
          float halo = pow(s, 90.0) * 0.45 + pow(s, 10.0) * 0.16;
          c = mix(c, uSun, clamp(disc + halo, 0.0, 1.0));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mat);
    sky.frustumCulled = false; sky.renderOrder = 1000; // after the opaque world: only the free pixels are shaded
    this.scene.add(sky); this.sky = sky;
  }
  // Haze: deep in the Forest the air turns green and close (you see about 60 m), on the
  // Volcano's slope it is warm and dusty. Only the fog and the horizon colour change,
  // smoothly with how far in the player is: no extra drawing.
  _haze() {
    const p = this.sun.target.position, K = this._hazeK;
    const f = 1 - smooth(FOREST.r * 0.5, FOREST.r + 8, dist(p.x, p.z, FOREST.x, FOREST.z)), v = 1 - smooth(VOLCANO.r * 0.45, VOLCANO.r + 10, dist(p.x, p.z, VOLCANO.x, VOLCANO.z));
    K[0] += (f - K[0]) * 0.04; K[1] += (v - K[1]) * 0.04;
    const fog = this.scene.fog;
    fog.color.setHex(SKY.horizon).lerp(HAZE.forest, K[0] * 0.85).lerp(HAZE.volcano, K[1] * 0.7);
    fog.near = 70 - 58 * K[0] - 40 * K[1]; fog.far = 190 - 112 * K[0] - 70 * K[1];
    this.sky.material.uniforms.uHorizon.value.copy(fog.color);
    this.sky.material.uniforms.uTop.value.setHex(SKY.top).lerp(HAZE.forestTop, K[0] * 0.5).lerp(HAZE.volcano, K[1] * 0.35);
  }
  // shadows follow the player
  followSun(p) {
    this.sun.position.copy(p).add(this.sunOffset);
    this.sun.target.position.copy(p);
  }

  _terrain() {
    const { size, seg } = TGRID;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    g.translate(ISLAND.cx, 0, ISLAND.cz);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color(), tmp = new THREE.Color();
    const GR = new THREE.Color(0x86d46c), GR2 = new THREE.Color(0x6fc25a), FO = new THREE.Color(0x4f9e48), SA = new THREE.Color(0xf2d9a0),
      RO = new THREE.Color(0x6b5a55), LA = new THREE.Color(0x3d3236), DI = new THREE.Color(0xc9a46f),
      SA2 = new THREE.Color(0xf7e3b4), WET = new THREE.Color(0xd3b47e), FLOOR = new THREE.Color(0xe6e0b8), PFLOOR = new THREE.Color(0xcfe3bd),
      MOSS = new THREE.Color(0x3f8f45), MOSS2 = new THREE.Color(0x57983c), LITTER = new THREE.Color(0x7d8a45),
      DRY = new THREE.Color(0xc6cf62), DRY2 = new THREE.Color(0xd8cf6e), LUSH = new THREE.Color(0x63c063),
      ASH = new THREE.Color(0x9c9791), ASH2 = new THREE.Color(0x7d7673),
      BED = new THREE.Color(0x58b3b4), CLIFF = new THREE.Color(0x8f8d86), CLIFF2 = new THREE.Color(0x77756f), STRAW = new THREE.Color(0xd9bf62), FLAG = new THREE.Color(0xa9a79c),
      SCORCH = new THREE.Color(0x2a1d1d), GLOW = new THREE.Color().setRGB(3.4, 0.85, 0.12); // (over 1: it glows in the sun's shade too)
    const dIsl = (x, z) => dist(x, z, ISLAND.cx, ISLAND.cz);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z);
      p.setY(i, onDeck(x, z) ? h - 0.15 : h);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5;
      c.copy(GR).lerp(GR2, n);
      const [n1, n2, n3] = groundNoise(x, z);
      // meadow: dry yellow patches on the rises, lusher green in between
      c.lerp(tmp.copy(DRY).lerp(DRY2, n), smooth(0.25, 0.7, n1) * 0.8);
      c.lerp(LUSH, smooth(0.3, 0.8, -n1) * 0.45);
      // forest: a dark mossy floor with patches of leaf litter; it fades out with a
      // ragged edge where the trees thin out
      const df = dist(x, z, FOREST.x, FOREST.z) + n2 * 5;
      const fo = 1 - smooth(FOREST.r * 0.75, FOREST.r + 12, df);
      c.lerp(tmp.copy(MOSS).lerp(MOSS2, n).lerp(LITTER, smooth(0.2, 0.7, n3) * 0.7), fo);
      void FO;
      // beach sand: the zone circle and the shore strip beside it, with a ragged edge
      const en = Math.sin(x * 0.45 + z * 0.3) * 1.6 + Math.sin(x * 0.19 - z * 0.37) * 2.2;
      const sand = Math.max(1 - smooth(BEACH.r - 3 + en, BEACH.r + 3 + en, dist(x, z, BEACH.x, BEACH.z)),
        smooth(0.5, 0.85, beachW(x, z)) * (1 - smooth(30 + en, 37 + en, bayS(x, z))));
      c.lerp(tmp.copy(SA).lerp(SA2, n), sand);
      // volcano: a ring of grey ash around the foot (ragged edge, a few tongues
      // reaching into the meadow), dark rock up the cone
      const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
      c.lerp(tmp.copy(ASH).lerp(ASH2, n), 1 - smooth(VOLCANO.r + 9 + n2 * 5, VOLCANO.r + 17 + n2 * 7, dv));
      c.lerp(tmp.copy(RO).lerp(LA, n), 1 - smooth(VOLCANO.r * 0.55, VOLCANO.r + 8, dv));
      // lighter rock on the ridges' crests, darker in the gullies
      if (dv < VOLCANO.r + 6) c.multiplyScalar(1 + 0.22 * ridgeAt(Math.atan2(z - VOLCANO.z, x - VOLCANO.x)) * smooth(5, 12, dv));
      // lava: the crater glows, and so does the rock beside each lava stream (scorched black at its edge)
      if (dv < LAVA_END + 2) {
        if (dv < LAVA_RIM + 1) c.lerp(GLOW, (1 - smooth(LAVA_RIM - 2.5, LAVA_RIM + 1, dv)) * 0.8);
        for (let k = 0; k < LAVA_ANGLES.length; k++) {
          const [lx, lz] = lavaPoint(k, dv), dl = dist(x, z, lx, lz), fade = 1 - smooth(LAVA_END - 9, LAVA_END + 1, dv);
          if (dl > 6) continue;
          c.lerp(SCORCH, (1 - smooth(1.5, 5.5, dl)) * 0.55 * fade);
          c.lerp(GLOW, (1 - smooth(0.2, 3.0, dl)) * 0.7 * fade);
        }
      }
      if (h < 0.5) c.lerp(SA, smooth(0.5, -0.2, h));
      // the coast: wide sand in the coves, grey rock on the headlands
      const di = dIsl(x, z);
      if (di > ISLAND.r - 26 && di < ISLAND.r + 8 && beachW(x, z) < 0.5) {
        // (only the strip along the water: di + cv is about ISLAND.r − 7 at the waterline)
        const cv = coast(x, z), wB = 1 - smooth(0.1, 0.5, beachW(x, z)), strip = smooth(ISLAND.r - 17, ISLAND.r - 11, di + cv + n2 * 1.5);
        c.lerp(tmp.copy(SA).lerp(SA2, n), smooth(1.5, 4, cv) * smooth(1.7, 0.8, h) * wB * smooth(ISLAND.r - 20, ISLAND.r - 14, di + cv));
        c.lerp(tmp.copy(CLIFF).lerp(CLIFF2, n), smooth(-2.2, -4.2, cv) * smooth(-1.6, -0.5, h) * wB * strip * 0.9);
      }
      // the lighthouse's knoll is rock too
      const dlh = dist(x, z, LIGHT.x, LIGHT.z);
      if (dlh < LIGHT.r) c.lerp(tmp.copy(CLIFF).lerp(CLIFF2, n), (1 - smooth(4.5, LIGHT.r - 1, dlh + n2 * 1.5)) * 0.92);
      // the camp's clearing, the wheat field, the ruin's old floor
      c.lerp(DI, (1 - smooth(4, 9, dist(x, z, CAMP.x, CAMP.z) + n2 * 1.2)) * 0.55);
      c.lerp(STRAW, (1 - smooth(6.5, 10.5, Math.max(Math.abs(x - FIELD.x) * 0.8, Math.abs(z - FIELD.z)) + n2)) * 0.6);
      c.lerp(FLAG, (1 - smooth(3.5, 8, dist(x, z, RUIN.x, RUIN.z) + n2 * 1.5)) * 0.5);
      const dh = dist(x, z, HOME.x, HOME.z);
      if (dh < 24) c.lerp(DI, (1 - smooth(16, 24, dh)) * 0.35);
      // dirt paths (a little noisy at the edge), pond banks
      const pd = pathDist(x, z) + Math.sin(x * 0.7 + z * 0.4) * 0.4;
      if (pd < 2.6) c.lerp(DI, 1 - smooth(1.4, 2.6, pd));
      const pdd = dp(x, z);
      if (pdd < POND.r + 2) { // a sand bank, wet at the waterline, a pale floor under the water
        c.lerp(SA, 1 - smooth(POND.r - 1.5, POND.r + 1.5, pdd));
        c.lerp(WET, smooth(POND.water + 0.3, POND.water, h) * 0.8);
        c.lerp(PFLOOR, smooth(POND.water - 0.05, POND.water - 0.5, h));
      }
      // the stream: a pebbly bank and a pale bed
      const [sd, st] = streamAt(x, z);
      if (sd < 7.5 && pdd > POND.r - 1) {
        const lv = streamLevel(st);
        c.lerp(SA, (1 - smooth(4.2, 6.6, sd + n2 * 0.6)) * 0.85);
        c.lerp(WET, smooth(lv + 0.35, lv, h) * 0.7);
        c.lerp(BED, smooth(lv - 0.02, lv - 0.24, h) * 0.85); // (a blue-green bed: the shallow water over it reads as water, not as wet sand)
      }
      // the shore: wet sand at the waterline, pale sea floor under the shallows
      if (h < WATER_Y + 0.5 && dp(x, z) > POND.r + 4 && !(sd < 4 && st < 0.8)) {
        c.lerp(WET, smooth(WATER_Y + 0.5, WATER_Y + 0.12, h));
        c.lerp(FLOOR, smooth(WATER_Y - 0.1, WATER_Y - 1.2, h));
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    m.receiveShadow = true;
    this.scene.add(m); this.terrain = m; this._terrainGrid = { size, seg };
    // lava: the crater's pool and the streams that run down the gullies, one mesh. A small
    // texture of bright and dark blotches drifts downhill (see update), so the lava flows.
    const lavaY = Math.min(...LAVA_ANGLES.map((a) => groundH(VOLCANO.x + Math.cos(a) * (LAVA_RIM + 0.4), VOLCANO.z + Math.sin(a) * (LAVA_RIM + 0.4)))) + 0.1;
    this.lavaY = lavaY;
    const lp = [], luv = [], lc = [], li = [];
    const lv = (x, y, z, u, v, hot) => { lp.push(x - VOLCANO.x, y, z - VOLCANO.z); luv.push(u, v); lc.push(hot, hot * (0.55 + 0.35 * hot), hot * 0.5); return lp.length / 3 - 1; };
    { // the pool (a fan; its edge disappears in the crater's wall)
      const c0 = lv(VOLCANO.x, lavaY, VOLCANO.z, 0.5, 0.5, 1);
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI * 2; lv(VOLCANO.x + Math.cos(a) * 6.6, lavaY, VOLCANO.z + Math.sin(a) * 6.6, 0.5 + Math.cos(a) * 0.9, 0.5 + Math.sin(a) * 0.9, 0.9); if (k) li.push(c0, c0 + k + 1, c0 + k); }
    }
    for (let k = 0; k < LAVA_ANGLES.length; k++) {
      let prev = null;
      for (let d = LAVA_RIM - 1.4; d <= LAVA_END + 0.01; d += 0.8) {
        const [x, z] = lavaPoint(k, d), [x2, z2] = lavaPoint(k, d + 0.4), L = Math.hypot(x2 - x, z2 - z), nx = -(z2 - z) / L, nz = (x2 - x) / L;
        const end = 1 - smooth(LAVA_END - 7, LAVA_END, d), w = (0.5 + 0.55 * smooth(LAVA_RIM, 16, d) + 0.25 * Math.sin(d * 0.9 + k)) * (0.25 + 0.75 * end);
        const y = (px, pz) => Math.max(groundH(px, pz), d < LAVA_RIM + 0.5 ? lavaY - 0.12 : -99) + 0.11;
        const row = [lv(x + nx * w, y(x + nx * w, z + nz * w), z + nz * w, 0, d / 3.2, 0.72 * (0.5 + 0.5 * end)), lv(x, y(x, z) + 0.04, z, 0.5, d / 3.2, 0.55 + 0.45 * end), lv(x - nx * w, y(x - nx * w, z - nz * w), z - nz * w, 1, d / 3.2, 0.72 * (0.5 + 0.5 * end))];
        if (prev) for (let j = 0; j < 2; j++) li.push(prev[j], row[j], prev[j + 1], prev[j + 1], row[j], row[j + 1]);
        prev = row;
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(luv, 2));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); lg.setIndex(li);
    const lt = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
      x.fillStyle = '#ff7a1c'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 46; i++) { // bright veins and dark crust, wrapped at the edges
        const px = (i * 37) % 64, py = (i * 23 + (i % 5) * 9) % 64, r = 3 + (i % 4) * 2;
        x.fillStyle = i % 3 === 0 ? 'rgba(120,30,10,.55)' : i % 3 === 1 ? 'rgba(255,214,90,.75)' : 'rgba(255,150,40,.6)';
        for (const [ox, oy] of [[0, 0], [64, 0], [-64, 0], [0, 64], [0, -64]]) { x.beginPath(); x.ellipse(px + ox, py + oy, r * 0.6, r * 1.6, 0, 0, 6.3); x.fill(); }
      }
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
    })();
    const lava = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ map: lt, vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
    lava.material.color.setRGB(1.5, 1.25, 1.1); // (hotter than white: stays bright through the tone mapping's absence and the fog)
    lava.position.set(VOLCANO.x, 0, VOLCANO.z);
    this.scene.add(lava); this.lava = lava;
    this.addCollider(VOLCANO.x, VOLCANO.z, 4.3); // nobody walks (and no egg lies) in the lava pool
    const lavaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    lavaGlow.scale.setScalar(26); lavaGlow.position.set(VOLCANO.x, lavaY + 3, VOLCANO.z);
    this.scene.add(lavaGlow); this.lavaGlow = lavaGlow;
  }

  // Tint the ground in a soft round patch (decor.js: the flower fields colour the
  // grass around them). Only grass is tinted: sand, paths and rock keep their colour.
  tintGround(patches) { // [x, z, radius, hex, strength]
    const { size, seg } = this._terrainGrid, a = this.terrain.geometry.attributes.color, p = this.terrain.geometry.attributes.position;
    const step = size / seg, c = new THREE.Color(), t = new THREE.Color();
    for (const [x, z, r, hex, k] of patches) {
      t.setHex(hex);
      const i0 = Math.floor((x - r - ISLAND.cx + size / 2) / step), i1 = Math.ceil((x + r - ISLAND.cx + size / 2) / step);
      const j0 = Math.floor((z - r - ISLAND.cz + size / 2) / step), j1 = Math.ceil((z + r - ISLAND.cz + size / 2) / step);
      for (let j = Math.max(0, j0); j <= Math.min(seg, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(seg, i1); i++) {
        const v = j * (seg + 1) + i, vx = p.getX(v), vz = p.getZ(v);
        const w = (1 - smooth(r * 0.35, r, dist(vx, vz, x, z) + Math.sin(vx * 0.9 + vz * 0.6) * 0.8)) * k;
        c.fromBufferAttribute(a, v);
        if (w <= 0 || c.g < c.r * 1.12 || c.g < c.b * 1.2) continue; // not grass
        c.lerp(t, w); a.setXYZ(v, c.r, c.g, c.b);
      }
    }
    a.needsUpdate = true;
  }

  // The pond uses the sea's shader (light shallows, foam at the waterline, calmer
  // waves). A polar grid that follows the pond's outline; every vertex knows its
  // distance to the bank.
  _pond() {
    const rings = 8, segs = 48, out = POND.r * 0.98;
    const pos = [POND.x, 0, POND.z], shore = [shoreDist(POND.x, POND.z, POND.water)], idx = [];
    for (let r = 1; r <= rings; r++) for (let k = 0; k < segs; k++) {
      const [x, z] = pondPoint((k / segs) * Math.PI * 2, (r / rings) * out);
      pos.push(x, 0, z); shore.push(shoreDist(x, z, POND.water));
    }
    const at = (r, k) => 1 + (r - 1) * segs + (k % segs);
    for (let k = 0; k < segs; k++) {
      idx.push(0, at(1, k + 1), at(1, k));
      for (let r = 1; r < rings; r++) idx.push(at(r, k), at(r, k + 1), at(r + 1, k), at(r, k + 1), at(r + 1, k + 1), at(r + 1, k));
    }
    // the stream to the sea: a ribbon along its centre line, sloping down with the bed
    // (same mesh and shader as the pond; y is relative to the pond's level)
    {
      const { pts, len, L } = STREAM, W = [-5.2, -4.6, -3.6, 0, 3.6, 4.6, 5.2]; // (the waterline lies at about ±4.6 m)
      let prev = -1; const i0 = idx.length;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dl = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / dl, nz = (b[0] - a[0]) / dl;
        const lv = streamLevel(len[i] / L), first = pos.length / 3;
        // (distance to the bank, set by hand: a bright rim where the water meets the banks (uBank in the
        // shader, world step 4: the stream read as a dull band before), light shallows, deeper blue in the middle)
        W.forEach((w, j) => { pos.push(pts[i][0] + nx * w, lv - POND.water, pts[i][1] + nz * w); shore.push([-5, -1.2, 2, 8, 2, -1.2, -5][j]); });
        if (prev >= 0) for (let j = 0; j < W.length - 1; j++) idx.push(prev + j, first + j, prev + j + 1, prev + j + 1, first + j, first + j + 1);
        prev = first;
      }
      // the ribbon must face up like the pond (world step 4: it faced down, so the stream's water was never drawn)
      const [a, b, c] = [0, 1, 2].map((k) => idx[i0 + k] * 3);
      if ((pos[b + 2] - pos[a + 2]) * (pos[c] - pos[a]) - (pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2]) < 0) for (let k = i0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(idx);
    const w = new THREE.Mesh(g, this._waterMat(0x3aa9dc, 0.07, 0.4, 0.6));
    w.position.y = POND.water; w.receiveShadow = true;
    this.scene.add(w); this.pond = w;
  }

  // The sea: one mesh, fine over the island and coarse far out. Every vertex knows
  // how far it is from the shore (aShore, metres), so the shader can paint light
  // shallows, foam at the waterline and little waves running in. No extra passes.
  _water() {
    const N = 104, K = 0.875, inner = 142, outer = 620; // ~3 m cells over the island, 21k triangles
    const g = new THREE.PlaneGeometry(2, 2, N, N).rotateX(-Math.PI / 2);
    const p = g.attributes.position, shore = new Float32Array(p.count);
    const warp = (u) => { const a = Math.abs(u); return Math.sign(u) * (a < K ? (a / K) * inner : inner + Math.pow((a - K) / (1 - K), 2) * (outer - inner)); };
    for (let i = 0; i < p.count; i++) {
      const x = ISLAND.cx + warp(p.getX(i)), z = ISLAND.cz + warp(p.getZ(i));
      p.setXYZ(i, x, 0, z);
      shore[i] = shoreDist(x, z, WATER_Y);
    }
    g.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
    g.computeBoundingSphere();
    const w = new THREE.Mesh(g, this._waterMat(0x35aee6, 0.55, 0.85));
    w.position.y = WATER_Y; w.receiveShadow = true;
    this.scene.add(w); this.water = w;
  }
  // Water with a shore: colour = deep water, wave = how strong the lines running in
  // are, edge = how strong the foam on the waterline is. Needs the aShore attribute.
  // bank = a bright rim where aShore is far below 0 (only the stream's edges are).
  _waterMat(color, wave, edge, bank = 0) {
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 });
    this.waterTime = this.waterTime || { value: 0 };
    const uni = { uTime: this.waterTime, uShallow: { value: new THREE.Color(0x6fe6e0) }, uWave: { value: wave }, uEdge: { value: edge }, uBank: { value: bank } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aShore;\nvarying float vShore;\nvarying vec2 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShore = aShore;\nvW = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uWave, uEdge, uBank;\nuniform vec3 uShallow;\nvarying float vShore;\nvarying vec2 vW;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float sd = vShore;
          float wob = sin(vW.x * 0.33 + uTime * 0.7) * sin(vW.y * 0.29 - uTime * 0.5);       // -1..1, breaks up straight lines
          float shallow = 1.0 - smoothstep(0.0, 15.0, sd);
          diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, shallow * 0.9);
          diffuseColor.rgb *= 1.0 + 0.05 * sin(vW.x * 0.11 + vW.y * 0.07 + uTime * 0.4);
          // two wave lines that run in to the beach and fade, and foam on the waterline
          float p1 = fract(uTime * 0.09), p2 = fract(uTime * 0.09 + 0.5);
          float l1 = (1.0 - smoothstep(0.0, 0.5, abs(sd - (1.0 - p1) * 10.0 + wob * 0.9))) * smoothstep(0.0, 0.25, p1);
          float l2 = (1.0 - smoothstep(0.0, 0.5, abs(sd - (1.0 - p2) * 10.0 - wob * 0.9))) * smoothstep(0.0, 0.25, p2);
          float edge = 1.0 - smoothstep(0.2, 1.1 + wob * 0.4, sd);
          float foam = clamp(edge * uEdge + (l1 + l2) * uWave + uBank * (1.0 - smoothstep(-4.5, -1.5, sd)), 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), foam);
          diffuseColor.a = max(mix(0.62, 0.93, smoothstep(0.0, 7.0, sd)), foam * 0.95);`);
    };
    return mat;
  }

  _base() {
    const s = this.scene, H = HOME, B = this.batch;
    // deck (its plank texture repeats, so it stays its own mesh)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK.x1 - DECK.x0, 0.3, DECK.z1 - DECK.z0), deckMat());
    deck.position.set(H.x, HY - 0.15, (DECK.z0 + DECK.z1) / 2); deck.receiveShadow = true; s.add(deck);
    // everything else that never changes goes into the static batch:
    // a darker trim around the deck
    for (const [w, d, x, z] of [[DECK.x1 - DECK.x0 + 0.4, 0.4, H.x, DECK.z0], [DECK.x1 - DECK.x0 + 0.4, 0.4, H.x, DECK.z1],
      [0.4, DECK.z1 - DECK.z0, DECK.x0, (DECK.z0 + DECK.z1) / 2], [0.4, DECK.z1 - DECK.z0, DECK.x1, (DECK.z0 + DECK.z1) / 2]]) {
      B.addPainted(pbox(w, 0.36, d, COL.woodDark, x, HY - 0.16, z), H.x, H.z);
    }
    // The hatchery building behind the deck (hall + tower) is built in decor.js from the
    // Quaternius village kit, once the pack is loaded. Its footprint is solid from the start:
    const { hall: HL, tower: TW } = HATCHERY;
    for (let i = 0; i < 6; i++) for (const dz of [-2, 2]) this.addCollider(HL.x - 5 + i * 2, HL.z + dz, 2.25);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.addCollider(HL.x + sx * (HL.w / 2 - 1), HL.z + sz * (HL.d / 2 - 1), 1.0);
    this.addCollider(TW.x, TW.z, 2.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.addCollider(TW.x + sx * 1.3, TW.z + sz * 1.3, 0.75);
    // the big sign board in front of the hall (a plank board on two posts; the posts are in decor.js)
    {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#7a4a26'; x.beginPath(); x.roundRect(0, 0, 1024, 256, 26); x.fill();
      x.fillStyle = '#ffcf5e'; x.beginPath(); x.roundRect(14, 14, 996, 228, 18); x.fill();
      x.strokeStyle = 'rgba(122,74,38,.35)'; x.lineWidth = 3; for (const y of [90, 168]) { x.beginPath(); x.moveTo(14, y); x.lineTo(1010, y); x.stroke(); }
      const text = () => { x.fillStyle = '#0d2240'; x.textAlign = 'center'; x.textBaseline = 'middle';
        let px = 124; do { px -= 4; x.font = `${px}px 'Fredoka One', sans-serif`; } while (x.measureText('🥚 Krabsy Hatchery').width > 930 && px > 40);
        x.fillText('🥚 Krabsy Hatchery', 512, 134); };
      text();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(HATCHERY.sign.w, HATCHERY.sign.w / 4), new THREE.MeshLambertMaterial({ map: t }));
      sign.position.set(HL.x, HATCHERY.sign.y, HATCHERY.sign.z - 0.09); sign.rotation.y = Math.PI; // faces the yard (north)
      s.add(sign); this.sign = sign;
      // (the canvas is drawn before the web font may be ready: draw the text again when it is)
      document.fonts?.ready.then(() => { x.fillStyle = '#ffcf5e'; x.fillRect(30, 30, 964, 196); text(); t.needsUpdate = true; });
    }
    // egg pad
    B.addPainted(pcyl(2.4, 2.6, 0.25, COL.teal, PAD.x, HY + 0.05, PAD.z, 32), H.x, H.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.set(PAD.x, HY + 0.2, PAD.z); s.add(ring); this.padRing = ring;
    const padSign = this._textSprite('⬇ 🥚 ⬇', '#0d2240', '#2ee6c0', 256);
    padSign.position.set(PAD.x, HY + 3.2, PAD.z); padSign.scale.set(2.6, 1.3, 1); s.add(padSign); this.padSign = padSign;
    // beacon over the base, visible from everywhere
    // (world step 4: slimmer and fading out with the height, like the egg beams; it is
    // widened with the distance in update(), so it still shows the way home from afar)
    const bg = new THREE.CylinderGeometry(0.55, 0.95, 110, 14, 8, true).translate(0, 55, 0);
    { const p = bg.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c.fill(Math.pow(1 - p.getY(i) / 110, 0.9), i * 3, i * 3 + 3); bg.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const beacon = new THREE.Mesh(bg,
      new THREE.MeshBasicMaterial({ color: 0x2ee6c0, vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beacon.position.set(PAD.x, HY, PAD.z); s.add(beacon); this.beacon = beacon;
    // Incubators and pens appear when bought. Their solid parts are kept as painted
    // geometry (relative to HOME) and merged into ONE mesh for all owned ones
    // (setOwned rebuilds it after a purchase); the glass domes into a second one.
    // The groups only hold what changes: the lamp bulb, the egg, the creature.
    const L = (v) => [v.x - H.x, v.y, v.z - H.z];
    this._incGeo = []; this._domeGeo = []; this._penGeo = [];
    for (let i = 0; i < MAX_INCUBATORS; i++) {
      const g = new THREE.Group(); g.position.copy(INC_POS[i]);
      const [x, y, z] = L(INC_POS[i]);
      this._incGeo.push(mergeGeometries([pcyl(0.85, 0.95, 0.5, COL.coral, x, y + 0.25, z), pcyl(0.7, 0.7, 0.1, COL.amber, x, y + 0.52, z),
        pcyl(0.06, 0.06, 1.7, COL.metalDark, x - 0.75, y + 0.85, z + 0.3, 8)]));
      this._domeGeo.push(new THREE.SphereGeometry(0.68, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.7, 1).translate(x, y + 0.55, z));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(-0.55, 1.6, 0.25); g.add(bulb);
      s.add(g);
      this.incubators.push({ group: g, egg: null, eggRarity: null, waiting: null, owned: false, ready: false, bulb });
    }
    for (let i = 0; i < MAX_PENS; i++) {
      const g = new THREE.Group(); g.position.copy(PEN_POS[i]);
      const [x, y, z] = L(PEN_POS[i]);
      const parts = [pbox(3.7, 0.25, 3.7, COL.pen, x, y + 0.12, z)];
      for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [-1.8, 0], [1.8, 0], [0, 1.8]]) parts.push(pbox(0.16, 0.8, 0.16, COL.wood, x + dx, y + 0.55, z + dz));
      parts.push(pbox(3.7, 0.1, 0.08, COL.woodDark, x, y + 0.8, z + 1.8));
      for (const dx of [-1.8, 1.8]) parts.push(pbox(0.08, 0.1, 3.7, COL.woodDark, x + dx, y + 0.8, z));
      for (const dx of [-1.3, 1.3]) parts.push(pbox(1.0, 0.1, 0.08, COL.woodDark, x + dx, y + 0.8, z - 1.8));
      this._penGeo.push(mergeGeometries(parts));
      s.add(g);
      this.pens.push({ group: g, creature: null, sp: null, owned: false, nextCoin: 1 + Math.random() * 3 });
    }
    // one "you can buy this next" ghost for each kind
    this.incGhost = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.5, 20).translate(0, 0.25, 0), MAT.ghost);
    this.penGhost = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.25, 3.7).translate(0, 0.12, 0), MAT.ghost);
    s.add(this.incGhost, this.penGhost);
  }

  _textSprite(text, bg, fg, w = 512) {
    const c = document.createElement('canvas'); c.width = w; c.height = w / 4;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.roundRect(4, 4, w - 8, w / 4 - 8, w / 16); x.fill();
    x.fillStyle = fg; x.font = `${Math.round(w / 11)}px 'Fredoka One', sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, w / 8 + 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  }

  // Shimmering walls around locked zones, with the stars needed.
  _walls() {
    for (const z of ZONES) {
      if (!z.r) continue;
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xb7f3ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, 60, 72, 1, true), mat);
      wall.position.set(z.x, 10, z.z);
      g.add(wall);
      // signs on the side facing home
      const ang = Math.atan2(HOME.x - z.x, HOME.z - z.z);
      for (const da of [-0.35, 0, 0.35]) {
        const sx = z.x + Math.sin(ang + da) * (z.r + 0.3), sz = z.z + Math.cos(ang + da) * (z.r + 0.3);
        const sp = this._textSprite(`🔒 ★ ${z.stars}`, '#0d2240', '#ffcf5e', 256);
        sp.position.set(sx, height(sx, sz) + 4, sz); sp.scale.set(7, 1.75, 1);
        g.add(sp);
      }
      this.scene.add(g);
      this.walls.push({ zone: z, group: g, mat, open: false });
    }
  }
  setZoneOpen(id, open, animate = false) {
    const w = this.walls.find((x) => x.zone.id === id);
    if (!w || w.open === open) return;
    w.open = open;
    if (!open) { w.group.visible = true; return; }
    if (!animate) { w.group.visible = false; return; }
    this.tween(1.6, (k) => { w.mat.opacity = 0.22 * (1 - k) + Math.sin(k * 30) * 0.1 * (1 - k); w.group.children[0].scale.y = 1 + k * 0.3; },
      () => { w.group.visible = false; });
  }

  // ── nature: Quaternius trees, bushes, rocks and plants (static batch) + colliders ──
  // The Forest is a dense mix of leaf trees, pines and a few huge twisted trees that
  // thins out beyond its edge; scattered leaf trees and flowering bushes in the
  // Meadow (a few in autumn colours); dead trees and dark rocks on the Volcano.
  async loadDecor() {
    const Q = this.q = await loadQ();
    setAtlas(Q.atlas);
    const M = Q.models;
    const R = rng('decor');
    const place = []; // [name, x, z, scale, rotY, colliderR, options]
    const free = (x, z, rr = 3, beachOk = false) => {
      if (!onIsland(x, z) || height(x, z) < 0.3) return false;
      // meadow plants stay off the sand
      if (!beachOk && (beachW(x, z) > 0.4 || dist(x, z, BEACH.x, BEACH.z) < BEACH.r + 3)) return false;
      if (dist(x, z, HOME.x, HOME.z) < 26) return false;
      if (pathDist(x, z) < 4.4 || dist(x, z, POND.x, POND.z) < POND.r + 3) return false; // (a circle: wider than the water anywhere)
      if (streamAt(x, z)[0] < 7 || onBridge(x, z)) return false;
      if (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 6 && LAVA_ANGLES.some((_, k) => { const [lx, lz] = lavaPoint(k, dist(x, z, VOLCANO.x, VOLCANO.z)); return dist(x, z, lx, lz) < 3.2; })) return false; // not in the lava
      if (this.reserved && this.reserved.some((r) => dist(x, z, r[0], r[1]) < r[2])) return false;
      for (const zz of ZONES) if (zz.r && Math.abs(dist(x, z, zz.x, zz.z) - zz.r) < 2.5) return false; // keep walls clear
      return !place.some((p) => dist(x, z, p[1], p[2]) < Math.max(rr, p[7] || 0));
    };
    // n models from `list` ([name, scale, collider radius at scale 1, tints]) in a disc.
    // o: gap (to other things), keepOut (things this size stay away from it), beachOk,
    // ok(x, z, d) → chance 0–1 that the spot is used, where(x, z) = extra test
    const add = (list, n, cx, cz, rad, o = {}) => {
      let tries = 0;
      while (n > 0 && tries++ < n * 40) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (o.ok && R() > o.ok(x, z, d)) continue;
        if (!free(x, z, o.gap ?? 3, o.beachOk)) continue;
        const [name, scale, col, tints] = list[Math.floor(R() * list.length)];
        const s = scale * (0.82 + R() * 0.4);
        place.push([name, x, z, s, R() * 6.28, col * s, { tint: tints ? tints[Math.floor(R() * tints.length)] : undefined, mul: o.mul, sink: o.sink }, o.keepOut]); n--;
      }
    };
    const GREEN = [0x86c843, 0x77bb3e, 0x93cf4c], DEEP = [0x5fa945, 0x529d42, 0x6cb449], PINE = [0x3f9458, 0x4a9f5a, 0x398a5c], AUTUMN = [0xf2a53a, 0xe9793a, 0xf6c244];
    const common = (tints, k = 1) => [1, 2, 3, 4, 5].map((i) => [`CommonTree_${i}`, 0.95 * k, 0.42, tints]);
    const pines = [1, 2, 3, 4, 5].map((i) => [`Pine_${i}`, 1.05, 0.42, PINE]);
    const twisted = [1, 3, 5].map((i) => [`TwistedTree_${i}`, 0.78, 1.0, DEEP]);
    const bushes = [['Bush_Common', 1.0, 0, GREEN], ['Bush_Common_Flowers', 1.0, 0, GREEN], ['Bush_Common_Flowers', 1.1, 0, DEEP]];
    const rocks = [1, 2, 3].map((i) => [`Rock_Medium_${i}`, 0.62, 1.45]);
    const df = (x, z) => dist(x, z, FOREST.x, FOREST.z);
    // forest: a few giants first, then the dense mix; beyond the edge fewer and fewer trees
    const thinOut = (x, z) => 1 - smooth(FOREST.r * 0.72, FOREST.r + 15, df(x, z)) * 0.97;
    add(twisted, 6, FOREST.x, FOREST.z, FOREST.r - 9, { gap: 13, keepOut: 7 });
    add([...common(DEEP, 1.05), ...pines, ...pines], 108, FOREST.x, FOREST.z, FOREST.r + 15, { gap: 5, ok: thinOut });
    // meadow: single trees and small groups, two autumn groves
    add(common(GREEN), 34, ISLAND.cx, ISLAND.cz, ISLAND.r - 12, { gap: 9, ok: (x, z) => (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 8 ? 0 : 1) });
    for (const [gx, gz] of [[52, 44], [-44, 62]]) add(common(AUTUMN, 0.9), 5, gx, gz, 9, { gap: 4.5 });
    add(bushes, 64, ISLAND.cx, ISLAND.cz, ISLAND.r - 10, { gap: 3, ok: (x, z) => (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 4 ? 0 : 1) });
    // undergrowth: ferns and big leafy plants in and around the forest, tall grass in the meadow
    add([['Fern_1', 0.3, 0], ['Fern_1', 0.24, 0], ['Plant_1_Big', 0.55, 0]], 46, FOREST.x, FOREST.z, FOREST.r + 10, { gap: 2.2, sink: 0.02 });
    add([['Grass_Common_Tall', 1.1, 0, GREEN], ['Grass_Wispy_Tall', 1.0, 0, GREEN], ['Plant_1_Big', 0.4, 0]], 70, ISLAND.cx, ISLAND.cz, ISLAND.r - 8,
      { gap: 1.6, ok: (x, z) => (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 6 || df(x, z) < FOREST.r ? 0 : 1) });
    add(rocks, 26, ISLAND.cx, ISLAND.cz, ISLAND.r - 8, { gap: 6, sink: 0.25, ok: (x, z) => (dist(x, z, VOLCANO.x, VOLCANO.z) < VOLCANO.r + 6 ? 0 : 1) });
    // (the beach is dressed in decor.js; a few bushes mark where the sand ends)
    add([['Bush_Common', 0.9, 0, GREEN]], 14, BEACH.x - 8, BEACH.z, BEACH.r + 12, { gap: 5 });
    // volcano: dead trees and dark, mossless rocks on the ash
    add([1, 2, 3, 4, 5].map((i) => [`DeadTree_${i}`, 0.5, 0.75]), 24, VOLCANO.x, VOLCANO.z, VOLCANO.r + 5, { gap: 5 });
    add(rocks.map(([n, s, c]) => [n, s * 1.25, c]), 30, VOLCANO.x, VOLCANO.z, VOLCANO.r + 7, { gap: 5, sink: 0.3, mul: 0xb9aaa6 });
    // ── world step 3 ──
    // big dark boulders on the Volcano's ridges (light models: they are seen from afar)
    const lo = [1, 2, 3].map((i) => [`Rock_Lo_${i}`, 1, 1.3]);
    add(lo.map(([n, , c]) => [n, 1.9, c]), 9, VOLCANO.x, VOLCANO.z, VOLCANO.r + 2, { gap: 9, sink: 0.3, mul: 0x7d7170,
      ok: (x, z, d) => (d > 9 && ridgeAt(Math.atan2(z - VOLCANO.z, x - VOLCANO.x)) > 0.55 ? 1 : 0) });
    // the Meadow's hill: one huge old tree on top
    place.push(['TwistedTree_Big', HILL.x, HILL.z, 1.5, 2.4, 1.7, { tint: 0x5fa945 }, 9]);
    // rocky bits of the coast: boulders along the waterline of every headland, some standing in the water
    {
      const RC = rng('coast');
      for (let a = 0; a < Math.PI * 2; a += 0.035) {
        const cx = Math.cos(a), cz = Math.sin(a);
        if (coast(ISLAND.cx + cx * ISLAND.r, ISLAND.cz + cz * ISLAND.r) > -2.4 || RC() < 0.42) continue;
        let r0 = ISLAND.r - 26; while (r0 < ISLAND.r + 12 && terrainH(ISLAND.cx + cx * r0, ISLAND.cz + cz * r0) > WATER_Y + 0.15) r0 += 0.5; // the waterline
        const r = r0 - 3.5 + RC() * 6, x = ISLAND.cx + cx * r, z = ISLAND.cz + cz * r;
        if (beachW(x, z) > 0.02 || streamAt(x, z)[0] < 7 || dist(x, z, LIGHT.x, LIGHT.z) < LIGHT.r || terrainH(x, z) < WATER_Y - 1.3) continue;
        if (ZONES.some((zz) => zz.r && Math.abs(dist(x, z, zz.x, zz.z) - zz.r) < 3)) continue;
        if (place.some((p) => dist(x, z, p[1], p[2]) < 2.6)) continue;
        const s = 0.7 + RC() * RC() * 1.5;
        place.push([`Rock_Lo_${1 + Math.floor(RC() * 3)}`, x, z, s, RC() * 6.28, 1.3 * s, { sink: 0.22, mul: [0xe6e2d8, 0xd6d2c8, 0xf2eee4][Math.floor(RC() * 3)] }]);
      }
    }
    // everything goes into the static batch (merged per cell, see merge.js)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let tris = 0;
    for (const p of place) {
      const model = M[p[0]]; if (!model) continue;
      q.setFromAxisAngle(v.set(0, 1, 0), p[4]); sc.setScalar(p[3]);
      this.batch.addQ(model, m4.compose(new THREE.Vector3(p[1], height(p[1], p[2]) - 0.08 - (p[6].sink || 0) * p[3] * model.h - model.minY * p[3], p[2]), q, sc), p[6]);
      tris += model.geo.index.count / 3;
    }
    for (const p of place) if (p[5] > 0) this.addCollider(p[1], p[2], p[5]);
    this.decorCount = place.length; this.decorTris = tris; this.coastRocks = place.filter((p) => p[0].startsWith('Rock_Lo')).length; // (for QA)
    // grass and small plants near the player (the sun's target is the player, see followSun)
    this.cover = new GroundCover(this);
    this.animators.push(() => this.cover.update(this.sun.target.position));
  }

  // Places where no egg should lie although you can walk there: in a lava stream, on the bridge.
  noEggSpot(x, z) {
    if (onBridge(x, z)) return true;
    const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
    return dv < LAVA_END + 1 && LAVA_ANGLES.some((_, k) => { const [lx, lz] = lavaPoint(k, dv); return dist(x, z, lx, lz) < 2.4; });
  }

  // ── colliders (circles in a grid) ──
  addCollider(x, z, r) {
    const c = { x, z, r };
    this.colliders.push(c);
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    const k = `${cx},${cz}`;
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(c);
    return c;
  }
  addBoxCollider(x, z, w, d) { // a row of circles along a box
    const r = Math.min(w, d) / 2;
    const n = Math.ceil(Math.max(w, d) / r);
    for (let i = 0; i <= n; i++) {
      const t = i / n - 0.5;
      if (w >= d) this.addCollider(x + t * (w - 2 * r), z, r); else this.addCollider(x, z + t * (d - 2 * r), r);
    }
  }
  nearColliders(x, z) {
    const out = [], cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const l = this.grid.get(`${cx + i},${cz + j}`); if (l) for (const c of l) if (!c.off) out.push(c);
    }
    return out;
  }

  // ── base state ──
  setOwned(pens, incubators) {
    (this.penCols || []).forEach((c, i) => { c.off = i >= pens; });
    (this.incCols || []).forEach((c, i) => { c.off = i >= incubators; });
    this.pens.forEach((p, i) => { p.owned = i < pens; p.group.visible = p.owned; });
    this.incubators.forEach((c, i) => { c.owned = i < incubators; c.group.visible = c.owned; });
    this.penGhost.visible = pens < MAX_PENS; if (pens < MAX_PENS) this.penGhost.position.copy(PEN_POS[pens]);
    this.incGhost.visible = incubators < MAX_INCUBATORS; if (incubators < MAX_INCUBATORS) this.incGhost.position.copy(INC_POS[incubators]);
    // one merged mesh for all owned pens + incubators, one for the glass domes
    const key = `${pens}|${incubators}`;
    if (key === this._ownedKey) return;
    this._ownedKey = key;
    for (const m of [this.ownedMesh, this.domeMesh]) if (m) { this.scene.remove(m); m.geometry.dispose(); }
    this.ownedMesh = this.domeMesh = null;
    const solid = [...this._penGeo.slice(0, pens), ...this._incGeo.slice(0, incubators)], domes = this._domeGeo.slice(0, incubators);
    if (solid.length) {
      const m = this.ownedMesh = new THREE.Mesh(mergeGeometries(solid), paintMat());
      m.position.set(HOME.x, 0, HOME.z); m.castShadow = true; m.receiveShadow = true; this.scene.add(m);
    }
    if (domes.length) {
      const m = this.domeMesh = new THREE.Mesh(mergeGeometries(domes), MAT.glass);
      m.position.set(HOME.x, 0, HOME.z); m.receiveShadow = true; this.scene.add(m);
    }
  }
  putEgg(i, rarity) {
    const c = this.incubators[i];
    if (c.egg) c.group.remove(c.egg);
    c.egg = makeEggMesh(rarity, 1.25); c.eggRarity = rarity; c.egg.position.y = 0.55;
    c.group.add(c.egg);
    return c.egg;
  }
  clearIncubator(i) {
    const c = this.incubators[i];
    if (c.egg) c.group.remove(c.egg);
    if (c.waiting) { c.group.remove(c.waiting); c.waiting = null; }
    c.egg = null; c.eggRarity = null;
  }
  showWaiting(i, sp) {
    const c = this.incubators[i];
    this.clearIncubator(i);
    const cr = buildCreature(sp); cr.position.y = 0.55; cr.scale.setScalar(cr.userData.real ? Math.min(1.5, 1.4 / cr.userData.height) : 0.9);
    c.group.add(cr); c.waiting = cr;
  }
  setPenCreature(i, sp) {
    const p = this.pens[i];
    if (p.creature) { p.group.remove(p.creature); p.creature = null; }
    p.sp = sp || null;
    if (sp) {
      const cr = buildCreature(sp);
      // (roster creatures come at their real size; big ones are shrunk to fit the pen)
      cr.position.set(0, 0.25, 0); cr.scale.setScalar(cr.userData.real ? Math.min(Math.max(1.7, 1.1 / cr.userData.height), 2.4 / cr.userData.height) : 1.5); cr.rotation.y = Math.PI; // look at the path (−z)
      p.group.add(cr); p.creature = cr;
    }
  }

  // ── wild eggs ──
  makeWildEgg(rarity, x, z, { event = false } = {}) {
    const g = new THREE.Group();
    const y = height(x, z);
    g.position.set(x, y, z);
    const nest = new THREE.Mesh(nestGeo, nestMat); nest.position.y = 0.08; nest.receiveShadow = true; g.add(nest);
    const egg = makeEggMesh(rarity, 1.25); egg.position.y = 0.02; g.add(egg);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: RARITY[rarity].color, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    glow.scale.setScalar(rarity === 'common' ? 1.8 : 2.6); glow.position.y = 0.6; g.add(glow);
    if (RARITY[rarity].beam || event) { const b = new THREE.Mesh(beamGeo, beamMat(rarity)); b.renderOrder = 2; g.add(b); g.userData.beam = b; }
    if (event) {
      // a special egg: bigger, the one big beam on the island, a turning golden ring and a star
      egg.scale.setScalar(1.7); glow.scale.multiplyScalar(1.6);
      g.userData.beam.scale.set(4.5, 2.4, 4.5);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.09, 8, 40).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffcf5e, transparent: true, opacity: 0.9 }));
      ring.position.y = 0.15; g.add(ring); g.userData.ring = ring;
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), transparent: true, depthWrite: false }));
      star.scale.setScalar(0.9); star.position.y = 2.4; g.add(star); g.userData.star = star;
    }
    g.userData.egg = egg; g.userData.glow = glow;
    this.scene.add(g);
    return g;
  }

  tween(dur, fn, end) { this.fx.push({ t: 0, dur, fn, end }); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.2 ? 80 : 70;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    for (const f of this.fx.slice()) {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.fn(k, dt);
      if (k >= 1) { this.fx.splice(this.fx.indexOf(f), 1); if (f.end) f.end(); }
    }
    for (const p of this.pens) if (p.creature) animateCreature(p.creature, this.time, dt);
    for (const c of this.extra) animateCreature(c, this.time, dt, 1);
    for (const c of this.incubators) {
      if (c.waiting) animateCreature(c.waiting, this.time, dt, 1);
      if (c.egg) c.egg.rotation.z = c.ready ? Math.sin(this.time * 14) * 0.12 * (Math.sin(this.time * 2.2) > 0.2 ? 1 : 0.2) : 0;
      c.bulb.material.color.setHex(c.egg ? 0xffd27a : 0x8a7a5a);
    }
    // the beacon would tint the whole view when you stand inside it
    { const d = this.camera.position.distanceTo(PAD), k = Math.min(3.2, Math.max(1, d / 45)); this.beacon.visible = d > 14; this.beacon.scale.set(k, 1, k); }
    this.padRing.scale.setScalar(1 + Math.sin(this.time * 3) * 0.04);
    this.padSign.position.y = HY + 3.2 + Math.sin(this.time * 2.5) * 0.2;
    // only while carrying eggs (set by main), and not right in front of the camera
    this.padSign.visible = !!this.wantPadSign && this.camera.position.distanceTo(this.padSign.position) > 7;
    this.waterTime.value = this.time;
    wind.time.value = this.time; // leaves, grass and palms sway (merge.js)
    this.water.position.y = WATER_Y + Math.sin(this.time * 0.9) * 0.03; // the sea laps at the sand
    this.lava.material.map.offset.y = this.time * 0.22; // the lava creeps downhill
    { const k = 1 + Math.sin(this.time * 2) * 0.07; this.lava.material.color.setRGB(1.5 * k, 1.25 * k, 1.1 * k); }
    this._haze();
    for (const w of this.walls) if (!w.open) w.mat.opacity = 0.16 + Math.sin(this.time * 2 + w.zone.x) * 0.06;
    for (const f of this.animators) f(dt, this.time);
    // the see-through tube runs from the camera to the player's chest (merge.js)
    // (world.seeThrough = false switches it off, for comparing)
    seeThrough.player.value.copy(this.sun.target.position).y += this.seeThrough === false ? -1e4 : 0.85;
    this.renderer.render(this.scene, this.camera);
  }
}
