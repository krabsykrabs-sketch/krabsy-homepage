// The island: terrain (a height function, so the player needs no physics engine),
// zones, decoration (instanced KayKit trees/rocks), the home base with incubators
// and pens, wild eggs with nests and light beams, locked-zone walls.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RARITY, MAX_PENS, MAX_INCUBATORS, ISLAND, HOME, ZONES } from './balance.js';
import { buildCreature, animateCreature, rng } from './creatures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticBatch, paint, paintMat } from './merge.js';

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
  const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
  const cone = Math.max(0, 1 - dv / (VOLCANO.r + 8));
  h += 24 * Math.pow(cone, 1.6);
  if (dv < 6) h -= (6 - dv) * 1.4;
  // home: flat
  const dh = dist(x, z, HOME.x, HOME.z);
  const home = 1 - smooth(20, 30, dh);
  h = h * (1 - home) + 0.4 * home;
  // the pond: a bowl below its water
  // (its floor stays above the sea level, so the sea mesh never shows through)
  const pd = pondD(x, z);
  if (pd < POND.r + 3) { const k = smooth(POND.r * 0.6, POND.r + 3, pd); h = h * k + (WATER_Y + 0.15) * (1 - k); }
  // island edge: down into the sea
  h -= smooth(ISLAND.r - 18, ISLAND.r + 6, d) * 6;
  // the beach and its bay replace all of that on the east coast
  const w = beachW(x, z);
  if (w > 0) {
    h = h * (1 - w) + beachProfile(x, z) * w;
    const bar = 1 - smooth(1.6, 5, segDist(x, z, ISLET.bar, [ISLET.x, ISLET.z]));   // sandbar: ankle-deep
    h = Math.max(h, h + (WATER_Y - 0.12 - h) * bar);
    const isl = 1 - smooth(2, ISLET.r + 1.5, dist(x, z, ISLET.x, ISLET.z));          // the islet
    h = Math.max(h, h + (0.8 - h) * isl);
  }
  return h;
}
export function onPier(x, z) {
  const [a, b] = pierLocal(x, z);
  return a >= 0 && a <= PIER.len && Math.abs(b) <= (a > PIER.len - PIER.headLen ? PIER.headHalf : PIER.half);
}
export function height(x, z) {
  const h = terrainH(x, z);
  if (!onPier(x, z)) return h;
  const [a] = pierLocal(x, z);
  return Math.max(h, PIER.y0 + (PIER.top - PIER.y0) * smooth(0, PIER.ramp, a));
}
PIER.y0 = terrainH(PIER.x0, PIER.z0); // the pier starts level with the sand
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

// Sky colours and where the sun stands: in the west-south-west, about 37° up. You
// see it over the Forest; what you look at on the way out from home is lit, not in shade.
const SKY = { top: 0x3f97ea, horizon: 0xcfeeff, sun: 0xfff6d8 };
const SUN_DIR = new THREE.Vector3(-48, 42, 30).normalize();

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
  // shadows follow the player
  followSun(p) {
    this.sun.position.copy(p).add(this.sunOffset);
    this.sun.target.position.copy(p);
  }

  _terrain() {
    const size = 300, seg = 150;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    g.translate(ISLAND.cx, 0, ISLAND.cz);
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color(), tmp = new THREE.Color();
    const GR = new THREE.Color(0x86d46c), GR2 = new THREE.Color(0x6fc25a), FO = new THREE.Color(0x4f9e48), SA = new THREE.Color(0xf2d9a0),
      RO = new THREE.Color(0x6b5a55), LA = new THREE.Color(0x3d3236), DI = new THREE.Color(0xc9a46f),
      SA2 = new THREE.Color(0xf7e3b4), WET = new THREE.Color(0xd3b47e), FLOOR = new THREE.Color(0xe6e0b8), PFLOOR = new THREE.Color(0xcfe3bd);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z);
      p.setY(i, onDeck(x, z) ? h - 0.15 : h);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5;
      c.copy(GR).lerp(GR2, n);
      const df = dist(x, z, FOREST.x, FOREST.z);
      c.lerp(tmp.copy(FO).lerp(GR2, n * 0.4), 1 - smooth(FOREST.r * 0.7, FOREST.r + 6, df));
      // beach sand: the zone circle and the shore strip beside it, with a ragged edge
      const en = Math.sin(x * 0.45 + z * 0.3) * 1.6 + Math.sin(x * 0.19 - z * 0.37) * 2.2;
      const sand = Math.max(1 - smooth(BEACH.r - 3 + en, BEACH.r + 3 + en, dist(x, z, BEACH.x, BEACH.z)),
        smooth(0.5, 0.85, beachW(x, z)) * (1 - smooth(30 + en, 37 + en, bayS(x, z))));
      c.lerp(tmp.copy(SA).lerp(SA2, n), sand);
      const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
      c.lerp(tmp.copy(RO).lerp(LA, n), 1 - smooth(VOLCANO.r * 0.7, VOLCANO.r + 10, dv));
      if (h < 0.5) c.lerp(SA, smooth(0.5, -0.2, h));
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
      // the shore: wet sand at the waterline, pale sea floor under the shallows
      if (h < WATER_Y + 0.5 && dp(x, z) > POND.r + 4) {
        c.lerp(WET, smooth(WATER_Y + 0.5, WATER_Y + 0.12, h));
        c.lerp(FLOOR, smooth(WATER_Y - 0.1, WATER_Y - 1.2, h));
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    m.receiveShadow = true;
    this.scene.add(m);
    // lava in the crater
    const lava = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff6a2a }));
    lava.position.set(VOLCANO.x, height(VOLCANO.x, VOLCANO.z) + 1.2, VOLCANO.z);
    this.scene.add(lava); this.lava = lava;
    const lavaGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    lavaGlow.scale.setScalar(26); lavaGlow.position.copy(lava.position).add(new THREE.Vector3(0, 3, 0));
    this.scene.add(lavaGlow); this.lavaGlow = lavaGlow;
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
    g.setIndex(idx);
    const w = new THREE.Mesh(g, this._waterMat(0x3aa9dc, 0.07, 0.4));
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
  _waterMat(color, wave, edge) {
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 1 });
    this.waterTime = this.waterTime || { value: 0 };
    const uni = { uTime: this.waterTime, uShallow: { value: new THREE.Color(0x6fe6e0) }, uWave: { value: wave }, uEdge: { value: edge } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aShore;\nvarying float vShore;\nvarying vec2 vW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShore = aShore;\nvW = position.xz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime, uWave, uEdge;\nuniform vec3 uShallow;\nvarying float vShore;\nvarying vec2 vW;')
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
          float foam = clamp(edge * uEdge + (l1 + l2) * uWave, 0.0, 1.0);
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
    // house behind
    const hx = H.x, hz = H.z + 17;
    B.addPainted(pbox(10, 5, 6, COL.wall, hx, HY + 2.5, hz), H.x, H.z);
    B.addPainted(paint(new THREE.ConeGeometry(7.8, 3.5, 4), COL.coral, true).rotateY(Math.PI / 4).scale(1, 1, 0.62).translate(hx, HY + 6.7, hz), H.x, H.z);
    B.addPainted(pbox(2, 3, 0.2, COL.woodDark, hx, HY + 1.5, hz - 3.05), H.x, H.z);
    this.addBoxCollider(hx, hz, 10, 6);
    // sign "Hatchery"
    const sign = this._textSprite('🥚 Krabsy Hatchery', '#ffcf5e', '#0d2240', 512);
    sign.position.set(hx, HY + 9.4, hz); sign.scale.set(8, 2, 1); s.add(sign);
    // egg pad
    B.addPainted(pcyl(2.4, 2.6, 0.25, COL.teal, PAD.x, HY + 0.05, PAD.z, 32), H.x, H.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.set(PAD.x, HY + 0.2, PAD.z); s.add(ring); this.padRing = ring;
    const padSign = this._textSprite('⬇ 🥚 ⬇', '#0d2240', '#2ee6c0', 256);
    padSign.position.set(PAD.x, HY + 3.2, PAD.z); padSign.scale.set(2.6, 1.3, 1); s.add(padSign); this.padSign = padSign;
    // beacon over the base, visible from everywhere
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 120, 16, 1, true).translate(0, 60, 0),
      new THREE.MeshBasicMaterial({ color: 0x2ee6c0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
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

  // ── decoration: instanced KayKit models + colliders ──
  async loadDecor() {
    const loader = new GLTFLoader();
    const names = ['Tree_1_A', 'Tree_2_B', 'Tree_3_A', 'Tree_4_A', 'Tree_6_B', 'Tree_5_B', 'Tree_7_A', 'Tree_Bare_1_A', 'Tree_Bare_2_B',
      'Bush_1_A', 'Bush_2_C', 'Bush_4_A', 'Bush_3_A', 'Rock_1_A', 'Rock_3_C', 'Rock_2_B', 'Rock_1_J', 'Rock_3_A', 'Grass_1_A'];
    const models = {};
    await Promise.all(names.map(async (n) => {
      try { models[n] = (await loader.loadAsync(`assets/nature/${n}_Color1.gltf`)).scene; } catch (_) { /* optional */ }
    }));
    const R = rng('decor');
    const place = []; // [name, x, z, scale, rotY, colliderR]
    const free = (x, z, rr = 3, beachOk = false) => {
      if (!onIsland(x, z) || height(x, z) < 0.3) return false;
      // meadow plants stay off the sand
      if (!beachOk && (beachW(x, z) > 0.4 || dist(x, z, BEACH.x, BEACH.z) < BEACH.r + 3)) return false;
      if (dist(x, z, HOME.x, HOME.z) < 26) return false;
      if (pathDist(x, z) < 3 || dist(x, z, POND.x, POND.z) < POND.r + 3) return false; // (a circle: wider than the water anywhere)
      if (this.reserved && this.reserved.some((r) => dist(x, z, r[0], r[1]) < r[2])) return false;
      for (const zz of ZONES) if (zz.r && Math.abs(dist(x, z, zz.x, zz.z) - zz.r) < 2.5) return false; // keep walls clear
      return !place.some((p) => dist(x, z, p[1], p[2]) < rr);
    };
    const add = (list, n, cx, cz, rad, scale, col, minGap, beachOk) => {
      let tries = 0;
      while (n > 0 && tries++ < n * 30) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!free(x, z, minGap, beachOk)) continue;
        const name = list[Math.floor(R() * list.length)];
        const s = scale * (0.8 + R() * 0.45);
        place.push([name, x, z, s, R() * 6.28, col * s]); n--;
      }
    };
    const trees = ['Tree_1_A', 'Tree_2_B', 'Tree_3_A', 'Tree_4_A', 'Tree_6_B', 'Tree_5_B', 'Tree_7_A'];
    const bushes = ['Bush_1_A', 'Bush_2_C', 'Bush_4_A', 'Bush_3_A'];
    const rocks = ['Rock_1_A', 'Rock_3_C', 'Rock_2_B', 'Rock_1_J', 'Rock_3_A'];
    add(trees, 150, FOREST.x, FOREST.z, FOREST.r - 1, 2.4, 0.55, 5);     // dense forest
    add(trees, 45, ISLAND.cx, ISLAND.cz, ISLAND.r - 12, 2.2, 0.55, 9);    // meadow trees
    add(bushes, 70, ISLAND.cx, ISLAND.cz, ISLAND.r - 10, 1.6, 0, 3);
    add(['Grass_1_A'], 120, ISLAND.cx, ISLAND.cz, ISLAND.r - 8, 1.6, 0, 1.5);
    add(rocks, 30, ISLAND.cx, ISLAND.cz, ISLAND.r - 8, 1.6, 1.0, 6);
    // (the beach is dressed in decor.js; a few bushes mark where the sand ends)
    add(['Bush_3_A', 'Bush_1_A'], 16, BEACH.x - 8, BEACH.z, BEACH.r + 12, 1.4, 0, 5);
    add(['Tree_Bare_1_A', 'Tree_Bare_2_B'], 26, VOLCANO.x, VOLCANO.z, VOLCANO.r + 4, 2.2, 0.45, 5);
    add(rocks, 30, VOLCANO.x, VOLCANO.z, VOLCANO.r + 6, 2.2, 1.3, 5);
    // every tree, bush and rock goes into the static batch (merged per cell, see merge.js)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const p of place) {
      const root = models[p[0]]; if (!root) continue;
      q.setFromAxisAngle(v.set(0, 1, 0), p[4]); sc.setScalar(p[3]);
      this.batch.addModel(root, m4.compose(new THREE.Vector3(p[1], height(p[1], p[2]) - 0.1, p[2]), q, sc));
    }
    for (const p of place) if (p[5] > 0) this.addCollider(p[1], p[2], p[5]);
    this.decorCount = place.length;
  }

  // ── colliders (circles in a grid) ──
  addCollider(x, z, r) {
    const c = { x, z, r };
    this.colliders.push(c);
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8);
    const k = `${cx},${cz}`;
    if (!this.grid.has(k)) this.grid.set(k, []);
    this.grid.get(k).push(c);
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
      const l = this.grid.get(`${cx + i},${cz + j}`); if (l) out.push(...l);
    }
    return out;
  }

  // ── base state ──
  setOwned(pens, incubators) {
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
    const cr = buildCreature(sp); cr.position.y = 0.55; cr.scale.setScalar(0.9);
    c.group.add(cr); c.waiting = cr;
  }
  setPenCreature(i, sp) {
    const p = this.pens[i];
    if (p.creature) { p.group.remove(p.creature); p.creature = null; }
    p.sp = sp || null;
    if (sp) {
      const cr = buildCreature(sp);
      cr.position.set(0, 0.25, 0); cr.scale.setScalar(1.5); cr.rotation.y = Math.PI; // look at the path (−z)
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
    this.beacon.visible = this.camera.position.distanceTo(PAD) > 14;
    this.padRing.scale.setScalar(1 + Math.sin(this.time * 3) * 0.04);
    this.padSign.position.y = HY + 3.2 + Math.sin(this.time * 2.5) * 0.2;
    // only while carrying eggs (set by main), and not right in front of the camera
    this.padSign.visible = !!this.wantPadSign && this.camera.position.distanceTo(this.padSign.position) > 7;
    this.waterTime.value = this.time;
    this.water.position.y = WATER_Y + Math.sin(this.time * 0.9) * 0.03; // the sea laps at the sand
    this.lava.material.color.setHSL(0.05 + Math.sin(this.time * 1.5) * 0.01, 1, 0.55 + Math.sin(this.time * 2) * 0.05);
    for (const w of this.walls) if (!w.open) w.mat.opacity = 0.16 + Math.sin(this.time * 2 + w.zone.x) * 0.06;
    for (const f of this.animators) f(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }
}
