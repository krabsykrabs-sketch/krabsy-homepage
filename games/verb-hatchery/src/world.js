// The island: terrain (a height function, so the player needs no physics engine),
// zones, decoration (instanced KayKit trees/rocks), the home base with incubators
// and pens, wild eggs with nests and light beams, locked-zone walls.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RARITY, MAX_PENS, MAX_INCUBATORS, ISLAND, HOME, ZONES } from './balance.js';
import { buildCreature, animateCreature, rng } from './creatures.js';

export const WATER_Y = -0.6;
const zone = (id) => ZONES.find((z) => z.id === id);
const FOREST = zone('forest'), BEACH = zone('beach'), VOLCANO = zone('volcano');
const dist = (x, z, ax, az) => Math.hypot(x - ax, z - az);
const dp = (x, z) => Math.hypot(x - POND.x, z - POND.z);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A pond in the meadow and dirt paths from home to each zone (also used by decor.js).
export const POND = { x: 38, z: 20, r: 10, water: 0.15 };
export const PATHS = [
  [[0, 46], [0, 24], [-20, 8], [-38, -8]],          // to the Forest
  [[0, 24], [26, 12], [50, -4]],                    // to the Beach
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

// ── height function (metres) ──
export function height(x, z) {
  const d = dist(x, z, ISLAND.cx, ISLAND.cz);
  let h = 1.2 * Math.sin(x * 0.045) * Math.cos(z * 0.04) + 0.6 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4)
    + 0.25 * Math.sin(x * 0.27) * Math.cos(z * 0.23);
  h += 1.2;
  // forest: rolling hills
  const df = dist(x, z, FOREST.x, FOREST.z);
  h += (1 - smooth(FOREST.r * 0.6, FOREST.r + 8, df)) * (1.6 + 1.4 * Math.sin(x * 0.13) * Math.sin(z * 0.15));
  // beach: flat sand sloping into the sea
  const db = dist(x, z, BEACH.x, BEACH.z);
  const beach = 1 - smooth(BEACH.r * 0.5, BEACH.r + 10, db);
  h = h * (1 - beach) + (0.35 + (BEACH.x - x) * 0.02) * beach;
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
  const dp = dist(x, z, POND.x, POND.z);
  if (dp < POND.r + 4) h = h * smooth(POND.r * 0.45, POND.r + 4, dp) + (-1.3) * (1 - smooth(POND.r * 0.45, POND.r + 4, dp));
  // island edge: down into the sea
  h -= smooth(ISLAND.r - 18, ISLAND.r + 6, d) * 6;
  return h;
}
export function onIsland(x, z) { return height(x, z) > WATER_Y + 0.25; }

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
const beamGeo = new THREE.CylinderGeometry(0.35, 0.9, 60, 12, 1, true).translate(0, 30, 0);
const beamMats = {};
function beamMat(rarity) {
  return beamMats[rarity] || (beamMats[rarity] = new THREE.MeshBasicMaterial({ color: RARITY[rarity].color, transparent: true,
    opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
}
const nestGeo = new THREE.TorusGeometry(0.42, 0.14, 6, 14).rotateX(Math.PI / 2);
const nestMat = new THREE.MeshStandardMaterial({ color: 0xa0723f, roughness: 1, flatShading: true });

// ── materials for the base ──
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const MAT = {
  wood: M(0xc68a52), woodDark: M(0x9a6236), deck: M(0xd9a46a), metalDark: M(0x55657f, { metalness: 0.3, roughness: 0.5 }),
  teal: M(0x2ee6c0), coral: M(0xff8585), amber: M(0xffcf5e), pen: M(0xa8e08f), roof: M(0xff8585, { flatShading: true }),
  wall: M(0xfff1d6), white: M(0xffffff),
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
function box(w, h, d, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}
function cyl(rt, rb, h, m, x, y, z, seg = 20) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
}

// Base layout (world coordinates). The player arrives from the north (−z).
const HY = 0.4; // base floor height
export const PAD = new THREE.Vector3(HOME.x, HY, HOME.z - 9);
export const INC_POS = Array.from({ length: MAX_INCUBATORS }, (_, i) => new THREE.Vector3(HOME.x - 6.25 + i * 2.5, HY, HOME.z - 2.5));
export const PEN_POS = Array.from({ length: MAX_PENS }, (_, i) => {
  const col = i % 6, row = Math.floor(i / 6);
  return new THREE.Vector3(HOME.x - 11 + col * 4.4, HY, HOME.z + 3.5 + row * 4.4);
});
export const SPAWN = new THREE.Vector3(HOME.x, HY, HOME.z - 17);

export class World {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fdcff);
    this.scene.fog = new THREE.Fog(0x9fdcff, 70, 190);
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
    this._lights(); this._terrain(); this._water(); this._pond(); this._base(); this._walls();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xe4f5ff, 0x6a8a4a, 1.25));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d0, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 140;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    this.scene.add(sun); this.scene.add(sun.target);
    this.sunOffset = new THREE.Vector3(-30, 60, 25);
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
      RO = new THREE.Color(0x6b5a55), LA = new THREE.Color(0x3d3236), DI = new THREE.Color(0xc9a46f);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = height(x, z);
      p.setY(i, onDeck(x, z) ? h - 0.15 : h);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5;
      c.copy(GR).lerp(GR2, n);
      const df = dist(x, z, FOREST.x, FOREST.z);
      c.lerp(tmp.copy(FO).lerp(GR2, n * 0.4), 1 - smooth(FOREST.r * 0.7, FOREST.r + 6, df));
      const db = dist(x, z, BEACH.x, BEACH.z);
      c.lerp(SA, 1 - smooth(BEACH.r * 0.6, BEACH.r + 6, db));
      const dv = dist(x, z, VOLCANO.x, VOLCANO.z);
      c.lerp(tmp.copy(RO).lerp(LA, n), 1 - smooth(VOLCANO.r * 0.7, VOLCANO.r + 10, dv));
      if (h < 0.5) c.lerp(SA, smooth(0.5, -0.2, h));
      const dh = dist(x, z, HOME.x, HOME.z);
      if (dh < 24) c.lerp(DI, (1 - smooth(16, 24, dh)) * 0.35);
      // dirt paths (a little noisy at the edge), pond banks
      const pd = pathDist(x, z) + Math.sin(x * 0.7 + z * 0.4) * 0.4;
      if (pd < 2.6) c.lerp(DI, 1 - smooth(1.4, 2.6, pd));
      if (dp(x, z) < POND.r + 2) c.lerp(SA, 1 - smooth(POND.r - 1, POND.r + 2, dp(x, z)));
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

  _pond() {
    const w = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 1.2, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x4cc6e8, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88 }));
    w.position.set(POND.x, POND.water, POND.z); w.receiveShadow = true;
    this.scene.add(w); this.pond = w;
  }

  _water() {
    const w = new THREE.Mesh(new THREE.CircleGeometry(600, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3fb8e8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    w.position.y = WATER_Y; w.receiveShadow = true;
    this.scene.add(w); this.water = w;
  }

  _base() {
    const s = this.scene, H = HOME;
    // deck
    const deck = box(DECK.x1 - DECK.x0, 0.3, DECK.z1 - DECK.z0, deckMat(), H.x, HY - 0.15, (DECK.z0 + DECK.z1) / 2);
    deck.castShadow = false; s.add(deck);
    // a darker trim around the deck
    for (const [w, d, x, z] of [[DECK.x1 - DECK.x0 + 0.4, 0.4, H.x, DECK.z0], [DECK.x1 - DECK.x0 + 0.4, 0.4, H.x, DECK.z1],
      [0.4, DECK.z1 - DECK.z0, DECK.x0, (DECK.z0 + DECK.z1) / 2], [0.4, DECK.z1 - DECK.z0, DECK.x1, (DECK.z0 + DECK.z1) / 2]]) {
      const t = box(w, 0.36, d, MAT.woodDark, x, HY - 0.16, z); t.castShadow = false; s.add(t);
    }
    // house behind
    const hx = H.x, hz = H.z + 17;
    s.add(box(10, 5, 6, MAT.wall, hx, HY + 2.5, hz));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.8, 3.5, 4), MAT.roof);
    roof.position.set(hx, HY + 6.7, hz); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.62; roof.castShadow = true; s.add(roof);
    s.add(box(2, 3, 0.2, MAT.woodDark, hx, HY + 1.5, hz - 3.05));
    this.addBoxCollider(hx, hz, 10, 6);
    // sign "Hatchery"
    const sign = this._textSprite('🥚 Krabsy Hatchery', '#ffcf5e', '#0d2240', 512);
    sign.position.set(hx, HY + 9.4, hz); sign.scale.set(8, 2, 1); s.add(sign);
    // egg pad
    const pad = cyl(2.4, 2.6, 0.25, MAT.teal, PAD.x, HY + 0.05, PAD.z, 32); pad.castShadow = false; s.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.set(PAD.x, HY + 0.2, PAD.z); s.add(ring); this.padRing = ring;
    const padSign = this._textSprite('⬇ 🥚 ⬇', '#0d2240', '#2ee6c0', 256);
    padSign.position.set(PAD.x, HY + 3.2, PAD.z); padSign.scale.set(2.6, 1.3, 1); s.add(padSign); this.padSign = padSign;
    // beacon over the base, visible from everywhere
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 120, 16, 1, true).translate(0, 60, 0),
      new THREE.MeshBasicMaterial({ color: 0x2ee6c0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beacon.position.set(PAD.x, HY, PAD.z); s.add(beacon); this.beacon = beacon;
    // incubators
    for (let i = 0; i < MAX_INCUBATORS; i++) {
      const g = new THREE.Group(); g.position.copy(INC_POS[i]);
      g.add(cyl(0.85, 0.95, 0.5, MAT.coral, 0, 0.25, 0));
      g.add(cyl(0.7, 0.7, 0.1, MAT.amber, 0, 0.52, 0));
      g.add(cyl(0.06, 0.06, 1.7, MAT.metalDark, -0.75, 0.85, 0.3, 8));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(-0.55, 1.6, 0.25); g.add(bulb);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass);
      dome.position.y = 0.55; dome.scale.y = 1.7; g.add(dome);
      const ghost = cyl(0.85, 0.95, 0.5, MAT.ghost, INC_POS[i].x, INC_POS[i].y + 0.25, INC_POS[i].z);
      s.add(g); s.add(ghost);
      this.incubators.push({ group: g, ghost, egg: null, eggRarity: null, waiting: null, owned: false, ready: false, bulb });
    }
    // pens
    for (let i = 0; i < MAX_PENS; i++) {
      const P = PEN_POS[i];
      const g = new THREE.Group(); g.position.copy(P);
      g.add(box(3.7, 0.25, 3.7, MAT.pen, 0, 0.12, 0));
      for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [-1.8, 0], [1.8, 0], [0, 1.8]]) g.add(box(0.16, 0.8, 0.16, MAT.wood, x, 0.55, z));
      g.add(box(3.7, 0.1, 0.08, MAT.woodDark, 0, 0.8, 1.8));
      for (const x of [-1.8, 1.8]) g.add(box(0.08, 0.1, 3.7, MAT.woodDark, x, 0.8, 0));
      for (const x of [-1.3, 1.3]) g.add(box(1.0, 0.1, 0.08, MAT.woodDark, x, 0.8, -1.8));
      const ghost = box(3.7, 0.25, 3.7, MAT.ghost, P.x, P.y + 0.12, P.z);
      s.add(g); s.add(ghost);
      this.pens.push({ group: g, ghost, creature: null, sp: null, owned: false, nextCoin: 1 + Math.random() * 3 });
    }
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
    const free = (x, z, rr = 3) => {
      if (!onIsland(x, z) || height(x, z) < 0.3) return false;
      if (dist(x, z, HOME.x, HOME.z) < 26) return false;
      if (pathDist(x, z) < 3 || dist(x, z, POND.x, POND.z) < POND.r + 3) return false;
      if (this.reserved && this.reserved.some((r) => dist(x, z, r[0], r[1]) < r[2])) return false;
      for (const zz of ZONES) if (zz.r && Math.abs(dist(x, z, zz.x, zz.z) - zz.r) < 2.5) return false; // keep walls clear
      return !place.some((p) => dist(x, z, p[1], p[2]) < rr);
    };
    const add = (list, n, cx, cz, rad, scale, col, minGap) => {
      let tries = 0;
      while (n > 0 && tries++ < n * 30) {
        const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!free(x, z, minGap)) continue;
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
    add(rocks, 18, BEACH.x, BEACH.z, BEACH.r - 2, 1.8, 1.1, 6);
    add(['Bush_3_A', 'Bush_1_A'], 14, BEACH.x, BEACH.z, BEACH.r - 4, 1.4, 0, 5);
    add(['Tree_Bare_1_A', 'Tree_Bare_2_B'], 26, VOLCANO.x, VOLCANO.z, VOLCANO.r + 4, 2.2, 0.45, 5);
    add(rocks, 30, VOLCANO.x, VOLCANO.z, VOLCANO.r + 6, 2.2, 1.3, 5);
    // build one InstancedMesh per model part
    const byName = {};
    for (const p of place) (byName[p[0]] = byName[p[0]] || []).push(p);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [name, list] of Object.entries(byName)) {
      const root = models[name]; if (!root) continue;
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, list.length);
        im.castShadow = name !== 'Grass_1_A'; im.receiveShadow = true;
        list.forEach((p, i) => {
          q.setFromAxisAngle(v.set(0, 1, 0), p[4]); sc.setScalar(p[3]);
          m4.compose(new THREE.Vector3(p[1], height(p[1], p[2]) - 0.1, p[2]), q, sc).multiply(o.matrixWorld);
          im.setMatrixAt(i, m4);
        });
        im.computeBoundingSphere();
        this.scene.add(im);
      });
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
    this.pens.forEach((p, i) => { p.owned = i < pens; p.group.visible = p.owned; p.ghost.visible = i === pens; });
    this.incubators.forEach((c, i) => { c.owned = i < incubators; c.group.visible = c.owned; c.ghost.visible = i === incubators; });
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
    if (RARITY[rarity].beam || event) { const b = new THREE.Mesh(beamGeo, beamMat(rarity)); g.add(b); g.userData.beam = b; }
    if (event) {
      // a special egg: bigger, a wide bright beam, a turning golden ring and a star
      egg.scale.setScalar(1.7); glow.scale.multiplyScalar(1.6);
      g.userData.beam.scale.set(2.2, 1.6, 2.2);
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
    this.lava.material.color.setHSL(0.05 + Math.sin(this.time * 1.5) * 0.01, 1, 0.55 + Math.sin(this.time * 2) * 0.05);
    for (const w of this.walls) if (!w.open) w.mat.opacity = 0.16 + Math.sin(this.time * 2 + w.zone.x) * 0.06;
    for (const f of this.animators) f(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }
}
