// Krabsy figures: a child's own KayKit character, put together from parts of several
// KayKit figures and recoloured. All figures share one skeleton (Rig_Medium) and every
// part is a skinned mesh, so a part from figure X can be bound to figure Y's skeleton by
// bone name. No weapons anywhere (they are separate files and never copied).
//
//   const fig = await buildFigure(config, { base: 'assets/' });
//   scene.add(fig.root); fig.mixer → play clips from the shared animation files.
//
// config (small JSON, stored by the page; see normalize()):
//   { v:1, outfit, head, hat, glasses, back, skin, hair, main, legs }
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// Figures that give parts (the Mage is the Quiz-Raum teacher's and not offered here).
export const FIGURES = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch', 'Superhero', 'Helper_A',
  'Helper_B', 'Caveman', 'Knight', 'Ranger', 'Rogue', 'Rogue_Hooded', 'Barbarian'];

// Outfits: the same list minus duplicates (Rogue_Hooded wears the Rogue's clothes, the two
// elves wear the same suit); their heads stay available.
export const OUTFITS = FIGURES.filter((f) => f !== 'Rogue_Hooded' && f !== 'Helper_B');
export const HEADS = FIGURES;
// Heads with a cap built in: no extra hat on top (it clashes).
export const HEAD_NO_HAT = ['Protagonist_A'];

// Extra parts: [figure, part roles]. Roles come from the mesh names (see roleOf).
export const HATS = {
  none: null, cap: ['Hiker', ['hat']], witch: ['Witch', ['hat']], pointy: ['Helper_A', ['hat']],
  elf: ['Helper_B', ['hat']], bear: ['Barbarian', ['bearhat']], helmet: ['Knight', ['helmet']],   // no visor: it covers the face
};
export const GLASSES = { none: null, square: ['Protagonist_A', ['glasses']], round: ['Witch', ['glasses']] };
export const BACKS = {
  none: null, pack: ['Hiker', ['backpack']], packA: ['Protagonist_A', ['backpack']], packB: ['Protagonist_B', ['backpack']],
  cape: ['Superhero', ['cape']], capeRed: ['Knight', ['cape']], capeBlue: ['Ranger', ['cape']], capeGreen: ['Rogue', ['cape']],
};

// Palettes (index -1 = the figure's own colour).
export const SKIN = ['#f7cfb0', '#eab38b', '#cf9469', '#a86c45', '#7d4c2e', '#563322'];
export const HAIR = ['#2a2220', '#5b3a24', '#8f5b30', '#c98b45', '#ecca72', '#d4582c', '#c3c8d2', '#7c5ce0', '#3f9be8', '#ff7ad9'];
export const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#3f7cff', '#9b6bff', '#ff7ad9', '#4cbf5a', '#e0453a', '#f2f4f8', '#2f3444'];

export const DEFAULT = { v: 1, outfit: 'Protagonist_A', head: 'Protagonist_A', hat: 'none', glasses: 'none', back: 'none',
  skin: -1, hair: -1, main: -1, legs: -1 };

// Anything stored or sent is checked against the catalogue (no free text).
export function normalize(c) {
  const o = { ...DEFAULT };
  if (!c || typeof c !== 'object') return o;
  if (OUTFITS.includes(c.outfit)) o.outfit = c.outfit;
  if (HEADS.includes(c.head)) o.head = c.head;
  if (c.hat in HATS && !HEAD_NO_HAT.includes(o.head)) o.hat = c.hat;
  if (c.glasses in GLASSES) o.glasses = c.glasses;
  if (c.back in BACKS) o.back = c.back;
  const idx = (v, list) => (Number.isInteger(v) && v >= -1 && v < list.length ? v : -1);
  o.skin = idx(c.skin, SKIN); o.hair = idx(c.hair, HAIR); o.main = idx(c.main, COLORS); o.legs = idx(c.legs, COLORS);
  return o;
}

export function randomConfig() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const keys = (o) => Object.keys(o);
  const fig = pick(OUTFITS);
  return normalize({ outfit: fig, head: Math.random() < 0.6 ? fig : pick(HEADS),
    hat: Math.random() < 0.5 ? 'none' : pick(keys(HATS)), glasses: Math.random() < 0.7 ? 'none' : pick(keys(GLASSES)),
    back: Math.random() < 0.5 ? 'none' : pick(keys(BACKS)), skin: Math.floor(Math.random() * SKIN.length),
    hair: Math.floor(Math.random() * HAIR.length), main: Math.floor(Math.random() * COLORS.length),
    legs: Math.random() < 0.5 ? -1 : Math.floor(Math.random() * COLORS.length) });
}

// ------------------------------------------------------------------ loading
const loader = new GLTFLoader();
const cache = new Map();
function loadFigure(base, name) {
  const key = base + name;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`${base}chars/${name}.glb`).then((g) => prepare(g.scene)));
  return cache.get(key);
}

// Mesh role from its name ("Hiker_Body", "Protagonist_A_A_Glasses"; Helper_A has two
// unnamed parts: Cube.583 = head, Cylinder.242 = hat).
function roleOf(name) {
  if (/Cube\.583/.test(name)) return 'head';
  if (/Cylinder\.242/.test(name)) return 'hat';
  // A part with two materials (glasses: frame + lenses) becomes "…_Glasses_1", "…_Glasses_2".
  const m = /(ArmLeft|ArmRight|LegLeft|LegRight|Body|Head|BearHat|HelmetVisor|Helmet|Hat|Glasses|Backpack|Cape|Mask|Quiver)(_\d+)*$/.exec(name);
  if (!m) return null;
  return { ArmLeft: 'armL', ArmRight: 'armR', LegLeft: 'legL', LegRight: 'legR', HelmetVisor: 'visor' }[m[1]] || m[1].toLowerCase();
}
const OUTFIT = ['body', 'armL', 'armR', 'legL', 'legR'];

// Per figure: its parts, which palette cells each part uses (8 × 4 grid), the source image.
// Almost every part is skinned; one is a rigid mesh hanging on a bone (Superhero's cape
// on "chest"): `bone` keeps that bone's name.
function prepare(scene) {
  const parts = {};
  let image = null;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const r = roleOf(o.name) || roleOf(o.parent?.name || '');
    if (!r) return;
    image ||= o.material.map?.image;
    if (!o.material.map) { (parts[r] ||= []).push({ mesh: o, cells: new Map(), bone: o.isSkinnedMesh ? null : o.parent.name, plain: true }); return; }
    const uv = o.geometry.attributes.uv, cells = new Map();
    for (let i = 0; i < uv.count; i++) {
      const c = Math.min(7, Math.floor(uv.getX(i) * 8)), row = Math.min(3, Math.floor(uv.getY(i) * 4));
      const k = row * 8 + c;
      cells.set(k, (cells.get(k) || 0) + 1);
    }
    (parts[r] ||= []).push({ mesh: o, cells, bone: o.isSkinnedMesh ? null : o.parent.name });
  });
  return { scene, parts, image, cellColor: cellColors(image) };
}

// Mean colour of each palette cell (for "is it skin / dark / saturated").
function cellColors(image) {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, out = [];
  // The texture's v axis is flipped by three.js (flipY = false for glTF): row r of the
  // cell grid (uv.y in r/4…(r+1)/4) is image row r from the top.
  for (let k = 0; k < 32; k++) {
    const cx = (k % 8) * 8 + 4, cy = Math.floor(k / 8) * 16 + 8;
    const i = (cy * S + cx) * 4;
    out.push(new THREE.Color(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255));
  }
  return out;
}

const hsl = (col) => { const h = {}; col.getHSL(h); return h; };
const SKIN_CELL = 0;

// The outfit's main colour: the cell that covers most of the body (or of the legs for
// trousers), weighted towards clear colours (a yellow jacket beats grey trousers) but a
// big grey area still wins (the Knight's armour). Never skin, near black or near white.
function mainCell(fig, roles, exclude = -1) {
  const count = new Map();
  for (const r of roles) for (const p of fig.parts[r] || []) for (const [k, n] of p.cells) count.set(k, (count.get(k) || 0) + n);
  let best = -1, bestN = 0;
  for (const [k, n] of count) {
    if (k === SKIN_CELL || k === exclude) continue;
    const h = hsl(fig.cellColor[k]);
    if (h.l < 0.15 || h.l > 0.9) continue;
    const score = n * (0.35 + h.s);
    if (score > bestN) { best = k; bestN = score; }
  }
  return best;
}

// Hair: the head's cells that aren't skin and aren't the (near black) eyes.
function hairCells(fig) {
  const out = new Set();
  for (const p of fig.parts.head || []) for (const k of p.cells.keys()) {
    if (k === SKIN_CELL) continue;
    const h = hsl(fig.cellColor[k]);
    if (h.l > 0.1) out.add(k);
  }
  return out;
}

// A recoloured copy of a figure's palette (256 px is plenty for 8 × 4 gradient cells).
function recolor(fig, map) {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(fig.image, 0, 0, S, S);
  if (map.size) {
    const img = g.getImageData(0, 0, S, S), d = img.data, cw = S / 8, ch = S / 4;
    for (const [k, hex] of map) {
      const t = new THREE.Color(hex), mean = fig.cellColor[k];
      const ml = Math.max(0.05, 0.299 * mean.r + 0.587 * mean.g + 0.114 * mean.b);
      const x0 = (k % 8) * cw, y0 = Math.floor(k / 8) * ch;
      for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) {
        const i = (y * S + x) * 4;
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const f = Math.min(1.6, l / ml);                       // keeps the cell's gradient
        d[i] = Math.min(255, t.r * f * 255); d[i + 1] = Math.min(255, t.g * f * 255); d[i + 2] = Math.min(255, t.b * f * 255);
      }
    }
    g.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false;
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ------------------------------------------------------------------ building
// opts.base: path to the assets folder (with chars/), opts.lambert: cheaper material.
export async function buildFigure(config, opts = {}) {
  const cfg = normalize(config);
  const base = opts.base || 'assets/';
  const extra = [[cfg.head, ['head']], HATS[cfg.hat], GLASSES[cfg.glasses], BACKS[cfg.back]].filter(Boolean);
  const names = [...new Set([cfg.outfit, ...extra.map((e) => e[0])])];
  const figs = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadFigure(base, n)])));

  // The outfit figure gives the skeleton, body, arms and legs.
  const root = cloneSkinned(figs[cfg.outfit].scene);
  let skeleton = null, holder = null;
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh && OUTFIT.includes(roleOf(o.name))) { skeleton ||= o.skeleton; holder ||= o.parent; }
    if (!OUTFIT.includes(roleOf(o.name) || roleOf(o.parent?.name || ''))) drop.push(o);
  });
  drop.forEach((o) => o.parent.remove(o));
  const bones = Object.fromEntries(skeleton.bones.map((b) => [b.name, b]));
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push({ mesh: o, fig: cfg.outfit }); });

  // Parts from other figures, bound to this skeleton by bone name.
  for (const [figName, roles] of extra) {
    for (const r of roles) for (const p of figs[figName].parts[r] || []) {
      const src = p.mesh, m = src.clone();
      if (p.bone) {                                        // rigid part: hang it on the same bone
        (bones[p.bone] || holder).add(m);
      } else {
        const sk = new THREE.Skeleton(src.skeleton.bones.map((b) => bones[b.name]), src.skeleton.boneInverses);
        m.bind(sk, src.bindMatrix);
        holder.add(m);
      }
      meshes.push({ mesh: m, fig: figName, plain: p.plain });
    }
  }

  // Colours: one recoloured palette per source figure.
  const rules = new Map();                 // figure → Map(cell → colour)
  const rule = (fig, cell, hex) => { if (cell < 0) return; (rules.get(fig) || rules.set(fig, new Map()).get(fig)).set(cell, hex); };
  for (const { fig } of meshes) {
    if (cfg.skin >= 0) rule(fig, SKIN_CELL, SKIN[cfg.skin]);
  }
  if (cfg.hair >= 0) for (const k of hairCells(figs[cfg.head])) rule(cfg.head, k, HAIR[cfg.hair]);
  const o = figs[cfg.outfit];
  const mc = mainCell(o, ['body']);
  if (cfg.main >= 0) {
    rule(cfg.outfit, mc, COLORS[cfg.main]);
    if (cfg.back !== 'none') { const b = BACKS[cfg.back]; const bc = mainCell(figs[b[0]], b[1]); rule(b[0], bc, COLORS[cfg.main]); }
  }
  if (cfg.legs >= 0) rule(cfg.outfit, mainCell(o, ['legL', 'legR'], mc), COLORS[cfg.legs]);

  const texCache = new Map();
  const Mat = opts.lambert ? THREE.MeshLambertMaterial : THREE.MeshStandardMaterial;
  for (const { mesh, fig, plain } of meshes) {
    if (plain || !mesh.material.map) { mesh.material = mesh.material.clone(); continue; }   // e.g. glass lenses
    if (!texCache.has(fig)) texCache.set(fig, recolor(figs[fig], rules.get(fig) || new Map()));
    mesh.material = new Mat({ map: texCache.get(fig), ...(opts.lambert ? {} : { roughness: 0.9, metalness: 0 }) });
    mesh.castShadow = true; mesh.frustumCulled = false;
  }
  return {
    root, config: cfg,
    dispose() { for (const t of texCache.values()) t.dispose(); for (const { mesh } of meshes) mesh.material.dispose(); },
  };
}

// The shared animation clips (Idle, Walk, Run, Jump, Interact …).
let clipsP = null;
export function loadClips(base = 'assets/') {
  clipsP ||= Promise.all(['General', 'MovementBasic'].map((n) => loader.loadAsync(`${base}anim/Rig_Medium_${n}.glb`)))
    .then((gs) => Object.fromEntries(gs.flatMap((g) => g.animations).map((a) => [a.name, a])));
  return clipsP;
}

// For tools / QA: a figure's parts with the palette cells they use and the cells' colours.
export async function inspectFigure(name, base = 'assets/') {
  const f = await loadFigure(base, name);
  return Object.fromEntries(Object.entries(f.parts).map(([r, ps]) => [r, ps.flatMap((p) =>
    [...p.cells].map(([k, n]) => `${k}:${n}:#${f.cellColor[k].getHexString()}`))]));
}
