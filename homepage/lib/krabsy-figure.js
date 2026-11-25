// Krabsy figures ("Meine Figur"): a child picks one KayKit character and customises it
// with accessories (hats, glasses, things on the back) and colours. All KayKit characters
// share one skeleton (Rig_Medium), so an accessory from character X can be put on
// character Y: skinned parts are bound to Y's bones by name, rigid parts hang on the same
// bone. No weapons anywhere (they are separate files and never copied; a quiver and a
// robber mask are dropped). Concept: docs/figures-shells-world.md; for games:
// docs/game-contract.md ("The player's figure").
//
// Games (the page needs an import map for 'three' and 'three/addons/', r169):
//
//   import { loadPlayerFigure } from '/lib/krabsy-figure.js';
//   const fig = await loadPlayerFigure({ fallback: 'Ranger', lambert: true });
//   scene.add(fig.root);              // Rig_Medium skeleton
//   fig.clips                          // Idle_A, Walking_A, Running_A, Jump_Full_Short, Interact …
//
// The builder page (lib/krabsy-figure-page.js) uses buildFigure(config) directly.
//
// config (small JSON, see normalize()), saved in localStorage krabsy_figure_v2:
//   { v:2, char, hat, glasses, back, skin, hair, main, legs, acc }
//   hat / glasses / back: 'own' (what the character comes with), 'none' or a catalogue key.
//
// Source of this file: the prototype games/figure-builder/src/figure.js (moved here
// 2026-11-25). Assets: /assets/figures/ (chars/, anim/, portraits/, items/ = accessory pictures).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ownedItems } from './krabsy-shells.js';

export const ASSET_BASE = '/assets/figures/';
export const STORAGE_KEY = 'krabsy_figure_v2';

// ------------------------------------------------------------------ catalogue
// The characters, in three groups. The Mage is the Quiz-Raum teacher's and not offered.
export const GROUPS = ['people', 'fantasy', 'monsters'];
export const CHARS = [
  ['Protagonist_A', 'people'], ['Protagonist_B', 'people'], ['Hiker', 'people'], ['Witch', 'people'],
  ['Superhero', 'people'], ['MagicalGirl', 'people'], ['Helper_A', 'people'], ['Helper_B', 'people'],
  ['Caveman', 'people'], ['Farmer_A', 'people'], ['Farmer_B', 'people'], ['Driver', 'people'],
  ['Survivalist', 'people'], ['Werewolf_Man', 'people'], ['Clown', 'people'], ['ToySoldier', 'people'],
  ['SpaceRanger', 'people'], ['Ninja', 'people'], ['Engineer', 'people'], ['Lorekeeper', 'people'],
  ['Knight', 'fantasy'], ['Paladin', 'fantasy'], ['Ranger', 'fantasy'], ['Rogue', 'fantasy'],
  ['Rogue_Hooded', 'fantasy'], ['Barbarian', 'fantasy'], ['Druid', 'fantasy'], ['Cleric', 'fantasy'],
  ['Vampire', 'fantasy'], ['Tiefling', 'fantasy'], ['PlantWarrior', 'fantasy'], ['AvianSwordsman', 'fantasy'],
  ['OrcRaider', 'monsters'], ['Werewolf_Wolf', 'monsters'], ['MonsterCostume', 'monsters'], ['Robot_One', 'monsters'],
  ['Robot_Two', 'monsters'], ['Skeleton_Minion', 'monsters'], ['Skeleton_Warrior', 'monsters'],
  ['Skeleton_Rogue', 'monsters'], ['Skeleton_Mage', 'monsters'], ['Necromancer', 'monsters'],
].map(([id, group]) => ({ id, group }));
export const CHAR_IDS = CHARS.map((c) => c.id);

// Parts never shown (weapon-like or not for children).
const DROP = { Ranger: ['quiver'], Rogue_Hooded: ['mask'] };
// Characters whose head can't take another hat (cap or helmet built into the head, or a
// head shape hats don't fit). Checked with the contact sheet (tools/sheet.cjs hats).
export const NO_HAT = ['Protagonist_A', 'Protagonist_B', 'Robot_One', 'Robot_Two', 'MonsterCostume',
  'Werewolf_Wolf', 'SpaceRanger'];
// Characters that keep their texture outside the model file.
const TEXTURE_FILE = { OrcRaider: 'OrcRaider_texture.png' };

// Accessories: [source character, part roles].
export const HATS = {
  cap: ['Hiker', ['hat']], witch: ['Witch', ['hat']], pointy: ['Helper_A', ['hat']], elf: ['Helper_B', ['hat']],
  bear: ['Barbarian', ['bearhat']], helmet: ['Knight', ['helmet']], clown: ['Clown', ['hat']],
  straw: ['Farmer_A', ['hat']], cowboy: ['Farmer_B', ['hat']], soldier: ['ToySoldier', ['hat']],
  wizard: ['Skeleton_Mage', ['hat']], headband: ['Ninja', ['headband']],
  space: ['SpaceRanger_FlightMode', ['helmet', 'helmet_visor']],
};
export const GLASSES = {
  square: ['Protagonist_A', ['glasses']], round: ['Witch', ['glasses']], reading: ['Lorekeeper', ['glasses']],
  sun: ['Driver', ['sunglasses']], goggles: ['Engineer', ['goggles']],
};
export const BACKS = {
  pack: ['Hiker', ['backpack']], packA: ['Protagonist_A', ['backpack']], packB: ['Protagonist_B', ['backpack']],
  satchel: ['Druid', ['backpack']], tools: ['Engineer', ['backpack']], books: ['Lorekeeper', ['backpack']],
  warpack: ['OrcRaider', ['warpack']], jetpack: ['SpaceRanger_FlightMode', ['jetpack', 'jetpack_wingleft', 'jetpack_wingright']],
  key: ['ToySoldier', ['windupkey']], wings: ['Vampire', ['wingleft', 'wingright']],
  cape: ['Superhero', ['cape']], capeKnight: ['Knight', ['cape']], capeRanger: ['Ranger', ['cape']],
  capeRogue: ['Rogue', ['cape']], capePaladin: ['Paladin', ['cape']],
};
// Which of a character's own parts belong to which slot.
const SLOT_ROLES = {
  hat: ['hat', 'bearhat', 'helmet', 'helmetvisor', 'helmet_visor', 'crown', 'headband', 'hood'],
  glasses: ['glasses', 'goggles', 'sunglasses'],
  back: ['backpack', 'cape', 'warpack', 'jetpack', 'jetpack_wingleft', 'jetpack_wingright', 'windupkey', 'wingleft', 'wingright'],
};

// Palettes (index -1 = the character's own colour).
// Skin: four tones. The two darkest ('#7d4c2e', '#563322', index 4 and 5) were removed on
// 2026-11-25 (owner: the figures' black eyes disappear on them). A figure saved with one
// of them gets the darkest tone that is left (normalize). Don't reorder this list.
export const SKIN = ['#f7cfb0', '#eab38b', '#cf9469', '#a86c45'];
const SKIN_REMOVED = 2;
export const HAIR = ['#2a2220', '#5b3a24', '#8f5b30', '#c98b45', '#ecca72', '#d4582c', '#c3c8d2', '#7c5ce0', '#3f9be8', '#ff7ad9'];
export const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#3f7cff', '#9b6bff', '#ff7ad9', '#4cbf5a', '#e0453a', '#f2f4f8', '#2f3444'];

export const DEFAULT = { v: 2, char: 'Protagonist_A', hat: 'own', glasses: 'own', back: 'own',
  skin: -1, hair: -1, main: -1, legs: -1, acc: -1 };

// Anything stored or sent is checked against the catalogue (no free text).
export function normalize(c) {
  const o = { ...DEFAULT };
  if (!c || typeof c !== 'object') return o;
  if (CHAR_IDS.includes(c.char)) o.char = c.char;
  const slot = (v, list) => (v === 'own' || v === 'none' || (typeof v === 'string' && Object.hasOwn(list, v)) ? v : 'own');
  o.hat = NO_HAT.includes(o.char) ? 'own' : slot(c.hat, HATS);
  o.glasses = slot(c.glasses, GLASSES);
  o.back = slot(c.back, BACKS);
  const idx = (v, list) => (Number.isInteger(v) && v >= -1 && v < list.length ? v : -1);
  const oldDark = Number.isInteger(c.skin) && c.skin >= SKIN.length && c.skin < SKIN.length + SKIN_REMOVED;
  o.skin = oldDark ? SKIN.length - 1 : idx(c.skin, SKIN); o.hair = idx(c.hair, HAIR);
  o.main = idx(c.main, COLORS); o.legs = idx(c.legs, COLORS); o.acc = idx(c.acc, COLORS);
  return o;
}

// ------------------------------------------------------------------ shells: free set + prices
// Owner decisions 2026-11-25 (docs/figures-shells-world.md): 12 characters are free from
// the start, the others cost 150–400 shells (rarer = more), accessories 40–150, ALL
// colours are free, and so are each character's own accessories ('own') and 'none'.
// Whatever is free at launch stays free: never move an id from FREE_CHARS into PRICES.
export const FREE_CHARS = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch', 'Helper_A', 'Helper_B',
  'Knight', 'Rogue', 'Druid', 'OrcRaider', 'Skeleton_Minion', 'Robot_One'];
export const PRICES = {
  char: {
    Farmer_A: 150, Farmer_B: 150,
    Superhero: 200, Caveman: 200, Driver: 200, Survivalist: 200, Clown: 200, Engineer: 200, Lorekeeper: 200,
    Ranger: 200, Rogue_Hooded: 200, Cleric: 200,
    MagicalGirl: 250, Werewolf_Man: 250, ToySoldier: 250, Paladin: 250, Barbarian: 250,
    Skeleton_Warrior: 250, Skeleton_Rogue: 250,
    Ninja: 300, Vampire: 300, Tiefling: 300, Robot_Two: 300, Skeleton_Mage: 300,
    SpaceRanger: 350, PlantWarrior: 350, AvianSwordsman: 350, Werewolf_Wolf: 350,
    MonsterCostume: 400, Necromancer: 400,
  },
  hat: { cap: 40, straw: 40, pointy: 50, elf: 50, witch: 60, clown: 60, headband: 60, cowboy: 80,
    wizard: 90, bear: 100, helmet: 100, soldier: 100, space: 150 },
  glasses: { square: 40, round: 40, reading: 50, goggles: 70, sun: 80 },
  back: { pack: 40, packA: 40, packB: 40, satchel: 50, books: 60, tools: 70, key: 80, capeRanger: 80,
    capeRogue: 80, warpack: 90, capeKnight: 90, capePaladin: 90, cape: 120, jetpack: 150, wings: 150 },
};
export const SLOTS = ['char', 'hat', 'glasses', 'back'];
/** Price in shells of one catalogue entry (0 = free). slot: 'char' | 'hat' | 'glasses' | 'back'. */
export function priceOf(slot, id) {
  if (id === 'own' || id === 'none') return 0;
  if (slot === 'char' && FREE_CHARS.includes(id)) return 0;
  return (PRICES[slot] && Object.hasOwn(PRICES[slot], id)) ? PRICES[slot][id] : 0;
}
/** The id under which an unlocked entry is stored in the shells module ("char:Ninja"). */
export const unlockId = (slot, id) => `${slot}:${id}`;
export function isUnlocked(slot, id, owned = ownedItems()) {
  return priceOf(slot, id) === 0 || owned.includes(unlockId(slot, id));
}
/** The parts of a config this child has not unlocked: [{ slot, id, price }]. */
export function lockedParts(config, owned = ownedItems()) {
  const cfg = normalize(config);
  return SLOTS.filter((slot) => !isUnlocked(slot, cfg[slot], owned))
    .map((slot) => ({ slot, id: cfg[slot], price: priceOf(slot, cfg[slot]) }));
}

// ------------------------------------------------------------------ the saved figure
/** The figure saved on this device (normalized), or null when there is none. */
export function readSavedFigure() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || !CHAR_IDS.includes(raw.char)) return null;
    return normalize(raw);
  } catch (_) { return null; }
}
export function saveFigure(config) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(config))); return true; } catch (_) { return false; }
}
/**
 * The figure a game shows for this child: the saved figure when everything in it is
 * unlocked. A locked accessory falls back to the character's own; a locked character (or
 * no saved figure) gives null → the game's fallback hero.
 */
export function playerConfig(owned = ownedItems()) {
  const saved = readSavedFigure();
  if (!saved || !isUnlocked('char', saved.char, owned)) return null;
  for (const slot of ['hat', 'glasses', 'back']) if (!isUnlocked(slot, saved[slot], owned)) saved[slot] = 'own';
  return saved;
}

export function randomConfig(char) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n) => Math.floor(Math.random() * n);
  return normalize({ char: char || pick(CHAR_IDS),
    hat: Math.random() < 0.6 ? 'own' : pick(['none', ...Object.keys(HATS)]),
    glasses: Math.random() < 0.7 ? 'own' : pick(['none', ...Object.keys(GLASSES)]),
    back: Math.random() < 0.5 ? 'own' : pick(['none', ...Object.keys(BACKS)]),
    skin: rnd(SKIN.length), hair: rnd(HAIR.length), main: rnd(COLORS.length),
    legs: Math.random() < 0.5 ? -1 : rnd(COLORS.length), acc: Math.random() < 0.5 ? -1 : rnd(COLORS.length) });
}

// ------------------------------------------------------------------ loading
const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map();
function loadFigure(base, name) {
  const key = base + name;
  if (!cache.has(key)) {
    cache.set(key, loader.loadAsync(`${base}chars/${name}.glb`).then(async (g) => {
      if (TEXTURE_FILE[name]) {
        const t = await texLoader.loadAsync(`${base}chars/${TEXTURE_FILE[name]}`);
        t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
        g.scene.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ map: t }); });
      }
      return prepare(g.scene);
    }));
  }
  return cache.get(key);
}

// Part role from the object name ("Hiker_Hat", "Paladin_ArmLeft_1", "SpaceRanger_Helmet_Visor").
const ROLE_RE = /(JetPack_WingLeft|JetPack_WingRight|Helmet_Visor|HelmetVisor|BearHat|WindupKey|Sunglasses|Headband|HolyWater|Backpack|Warpack|Jetpack|Goggles|Glasses|WingLeft|WingRight|ArmLeft|ArmRight|LegLeft|LegRight|Helmet|Crown|Hood|Hat|Cape|Cloak|Mask|Quiver|Tail|Eyes|Jaw|Skull|Chest|Body|Head)(_\d+)*$/;
function roleOf(name) {
  if (/Cube\.583/.test(name)) return 'head';           // Helper_A's unnamed parts
  if (/Cylinder\.242/.test(name)) return 'hat';
  const m = ROLE_RE.exec(name || '');
  return m ? m[1].toLowerCase() : null;
}

// Per character: its parts with the palette cells they use (8 × 4 grid), its palette
// image, the cells' mean colours, and whether it has human skin (skin + hair colours).
function prepare(scene) {
  const parts = {};
  let image = null;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const r = roleOf(o.name) || roleOf(o.parent?.name);
    if (!r) return;
    // onMesh: a rigid part hanging on another part (jetpack wings, helmet visor) comes
    // along when that part is copied.
    const entry = { mesh: o, cells: new Map(), bone: o.isSkinnedMesh ? null : o.parent.name, plain: !o.material.map,
      onMesh: !o.isSkinnedMesh && !!o.parent?.isMesh };
    if (o.material.map) {
      image ||= o.material.map.image;
      const uv = o.geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const k = Math.min(3, Math.floor(uv.getY(i) * 4)) * 8 + Math.min(7, Math.floor(uv.getX(i) * 8));
        entry.cells.set(k, (entry.cells.get(k) || 0) + 1);
      }
    }
    (parts[r] ||= []).push(entry);
  });
  const cellColor = cellColors(image);
  const h0 = hsl(cellColor[0]);
  const skin = (parts.head || []).some((p) => p.cells.has(0)) && h0.h > 0.02 && h0.h < 0.12 && h0.s > 0.3 && h0.l > 0.55;
  return { scene, parts, image, cellColor, skin };
}

// Mean colour of each palette cell. glTF textures are not flipped (flipY = false): UV
// v = 0 is the top row of the image, so cell row r is image row r from the top.
function cellColors(image) {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (image) g.drawImage(image, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, out = [];
  for (let k = 0; k < 32; k++) {
    const i = ((Math.floor(k / 8) * 16 + 8) * S + (k % 8) * 8 + 4) * 4;
    out.push(new THREE.Color(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255));
  }
  return out;
}
const hsl = (col) => { const h = {}; col.getHSL(h); return h; };

// The main colour of some parts: the cell covering most of them, weighted towards clear
// colours (a yellow jacket beats grey trousers) — a big grey area still wins (armour).
function mainCell(fig, roles, exclude = [], skipSkin = fig.skin) {
  const count = new Map();
  for (const r of roles) for (const p of fig.parts[r] || []) for (const [k, n] of p.cells) count.set(k, (count.get(k) || 0) + n);
  let best = -1, bestN = 0;
  for (const [k, n] of count) {
    if ((skipSkin && k === 0) || exclude.includes(k)) continue;
    const h = hsl(fig.cellColor[k]);
    if (h.l < 0.15 || h.l > 0.92) continue;
    const score = n * (0.35 + h.s);
    if (score > bestN) { best = k; bestN = score; }
  }
  return best;
}

// Hair: the head's cells that aren't skin and aren't the near-black eyes.
function hairCells(fig) {
  const out = new Set();
  for (const p of fig.parts.head || []) for (const k of p.cells.keys()) if (k !== 0 && hsl(fig.cellColor[k]).l > 0.1) out.add(k);
  return out;
}

// A recoloured copy of a palette (256 px is plenty for 8 × 4 gradient cells).
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
        const f = Math.min(1.6, (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 / ml);   // keeps the gradient
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

// What the builder page may offer for a character.
export async function charInfo(char, base = ASSET_BASE) {
  const f = await loadFigure(base, char);
  const has = (slot) => SLOT_ROLES[slot].some((r) => f.parts[r] && !(DROP[char] || []).includes(r));
  return { skin: f.skin, hair: f.skin, ownHat: has('hat'), ownGlasses: has('glasses'), ownBack: has('back'),
    hats: !NO_HAT.includes(char) };
}

// ------------------------------------------------------------------ building
// opts.base: path to the assets folder (with chars/); opts.lambert: cheaper material;
// opts.hide: slots a game doesn't want to show (['hat', 'glasses', 'back']).
export async function buildFigure(config, opts = {}) {
  const cfg = normalize(config);
  for (const slot of opts.hide || []) if (slot === 'hat' || slot === 'glasses' || slot === 'back') cfg[slot] = 'none';
  const base = opts.base || ASSET_BASE;
  const extra = [];
  if (cfg.hat !== 'own' && cfg.hat !== 'none') extra.push(['hat', ...HATS[cfg.hat]]);
  if (cfg.glasses !== 'own' && cfg.glasses !== 'none') extra.push(['glasses', ...GLASSES[cfg.glasses]]);
  if (cfg.back !== 'own' && cfg.back !== 'none') extra.push(['back', ...BACKS[cfg.back]]);
  const names = [...new Set([cfg.char, ...extra.map((e) => e[1])])];
  const figs = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await loadFigure(base, n)])));
  const me = figs[cfg.char];

  // The character itself, minus dropped parts and the slots being replaced or emptied.
  const remove = new Set(DROP[cfg.char] || []);
  for (const slot of ['hat', 'glasses', 'back']) if (cfg[slot] !== 'own') SLOT_ROLES[slot].forEach((r) => remove.add(r));
  const root = cloneSkinned(me.scene);
  let skeleton = null, holder = null;
  const drop = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const r = roleOf(o.name) || roleOf(o.parent?.name);
    if (remove.has(r)) drop.push(o);
    else if (o.isSkinnedMesh && !skeleton) { skeleton = o.skeleton; holder = o.parent; }
  });
  drop.forEach((o) => o.parent.remove(o));
  const bones = Object.fromEntries(skeleton.bones.map((b) => [b.name, b]));
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push({ mesh: o, fig: cfg.char }); });

  // Accessories from other characters. Bones have the same names everywhere, but their
  // rest scale differs between characters (the toy soldier's head bone shrinks his tall
  // hat; on another head it came out 1.8 m tall). So each accessory is scaled by
  // (source bone scale / target bone scale) at the bone it hangs on.
  root.updateMatrixWorld(true);
  const ws = (o) => o.getWorldScale(new THREE.Vector3());
  for (const [slot, figName, roles] of extra) {
    figs[figName].scene.updateMatrixWorld(true);
    for (const r of roles) for (const p of figs[figName].parts[r] || []) {
      if (p.onMesh) continue;                                              // copied with its parent
      const src = p.mesh, m = src.clone();
      if (p.bone) {                                                        // rigid: same bone
        const tb = bones[p.bone];
        if (tb) {
          const k = ws(src.parent).divide(ws(tb));
          m.scale.multiply(k); m.position.multiply(k);
          tb.add(m);
        } else holder.add(m);
      } else {
        const inv = src.skeleton.boneInverses.map((bi, i) => {
          const sb = src.skeleton.bones[i], tb = bones[sb.name];
          if (!tb) return bi;
          const k = ws(sb).divide(ws(tb));
          return new THREE.Matrix4().makeScale(k.x, k.y, k.z).multiply(bi);
        });
        m.bind(new THREE.Skeleton(src.skeleton.bones.map((b) => bones[b.name]), inv), src.bindMatrix);
        holder.add(m);
      }
      // userData.figureSlot marks an added accessory (tools/render_accessory_thumbs.cjs shows only these).
      m.traverse((o) => { if (o.isMesh) { o.userData.figureSlot = slot; meshes.push({ mesh: o, fig: figName, plain: !o.material.map }); } });
    }
  }

  // Colours: one recoloured palette per source character.
  const rules = new Map();
  const rule = (fig, cell, hex) => { if (cell >= 0) (rules.get(fig) || rules.set(fig, new Map()).get(fig)).set(cell, hex); };
  if (me.skin && cfg.skin >= 0) rule(cfg.char, 0, SKIN[cfg.skin]);
  if (me.skin && cfg.hair >= 0) for (const k of hairCells(me)) rule(cfg.char, k, HAIR[cfg.hair]);
  const mc = mainCell(me, ['body', 'chest', 'cloak']);
  if (cfg.main >= 0) rule(cfg.char, mc, COLORS[cfg.main]);
  if (cfg.legs >= 0) rule(cfg.char, mainCell(me, ['legleft', 'legright'], [mc]), COLORS[cfg.legs]);
  if (cfg.acc >= 0) {
    // Accessory colour: the main cell of each accessory (added or the character's own).
    for (const [, figName, roles] of extra) {
      if (figName === cfg.char) continue;
      rule(figName, mainCell(figs[figName], roles, [], false), COLORS[cfg.acc]);
    }
    for (const slot of ['hat', 'back']) if (cfg[slot] === 'own') {
      const roles = SLOT_ROLES[slot].filter((r) => me.parts[r]);
      if (roles.length) rule(cfg.char, mainCell(me, roles, [mc]), COLORS[cfg.acc]);
    }
  }

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

// The shared animation clips, in two files: 'General' (Idle_A, Interact, PickUp, Throw …,
// 0.8 MB) and 'MovementBasic' (Walking_A, Running_A, Jump_Full_Short …, 0.7 MB).
// loadClips() loads both, as games do. loadClipSet(name) loads one file: 'General',
// 'MovementBasic', or 'Mini' (Idle_A + Jump_Full_Short only, 0.06 MB, for the live figure
// on the landing and profile pages; made by tools/make_mini_anim.py).
const clipSets = new Map();
export function loadClipSet(name, base = ASSET_BASE) {
  const key = base + name;
  if (!clipSets.has(key)) {
    clipSets.set(key, loader.loadAsync(`${base}anim/Rig_Medium_${name}.glb`)
      .then((g) => Object.fromEntries(g.animations.map((a) => [a.name, a]))));
  }
  return clipSets.get(key);
}
let clipsP = null;
export function loadClips(base = ASSET_BASE) {
  clipsP ||= Promise.all(['General', 'MovementBasic'].map((n) => loadClipSet(n, base)))
    .then((sets) => Object.assign({}, ...sets));
  return clipsP;
}

// ------------------------------------------------------------------ for games
/**
 * The child's figure for a game, ready to add to the scene.
 *
 *   opts.fallback  the game's own hero: a catalogue character id ('Ranger') or a config
 *                  object. Used when the child has no saved figure (or it can't be shown).
 *                  It needs no unlocking. Not in the catalogue → the default character.
 *   opts.lambert   MeshLambertMaterial instead of MeshStandardMaterial (cheaper).
 *   opts.hide      accessory slots this game doesn't show: ['hat', 'glasses', 'back'].
 *   opts.clips     false = don't load the shared animations (the game brings its own).
 *   opts.base      asset folder, default '/assets/figures/'.
 *
 * → { root, clips, config, own, dispose() }
 *   root    THREE.Group on the Rig_Medium skeleton, feet at y = 0, about 1.2 units tall
 *   clips   { Idle_A, Walking_A, Running_A, Jump_Full_Short, Interact, … } (shared files)
 *   own     true = the child's saved figure, false = the fallback
 * Loads one character file (0.2–0.6 MB; one more per accessory taken from another
 * character) plus the two shared animation files (1.4 MB, cached across games).
 */
export async function loadPlayerFigure(opts = {}) {
  const base = opts.base || ASSET_BASE;
  const build = { base, lambert: !!opts.lambert, hide: opts.hide || [] };
  const fb = opts.fallback;
  const fallback = normalize(typeof fb === 'string' ? { char: fb } : fb);
  let mine = null;
  try { mine = playerConfig(); } catch (_) { /* no storage: fallback */ }
  const clipsP = opts.clips === false ? Promise.resolve({}) : loadClips(base);
  let fig = null, own = false;
  if (mine) {
    try { fig = await buildFigure(mine, build); own = true; } catch (err) { console.warn('krabsy-figure: saved figure failed, using the fallback', err); }
  }
  if (!fig) fig = await buildFigure(fallback, build);
  return { root: fig.root, clips: await clipsP, config: fig.config, own, dispose: fig.dispose };
}

// For tools / QA: a character's parts with the palette cells they use and their colours.
export async function inspectFigure(name, base = ASSET_BASE) {
  const f = await loadFigure(base, name);
  return { skin: f.skin, parts: Object.fromEntries(Object.entries(f.parts).map(([r, ps]) => [r, ps.flatMap((p) =>
    [...p.cells].map(([k, n]) => `${k}:${n}:#${f.cellColor[k].getHexString()}`))])) };
}
