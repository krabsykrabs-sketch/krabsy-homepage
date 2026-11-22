// Procedural creatures: a round body, eyes, a mouth and a few parts, all from
// primitives. Each species ('rare-2') is built from a seeded random generator, so
// it always looks the same. Rarer species get more parts, shiny materials, a glow
// and a little dance. Names are built from syllables and checked against a
// blocklist (English, German, Spanish).
import * as THREE from 'three';
import { RARITY } from './balance.js';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ── names ──
const START_SYL = ['Wob', 'Fluff', 'Bop', 'Zib', 'Snor', 'Mim', 'Tum', 'Gloo', 'Squee', 'Bim', 'Nib',
  'Pom', 'Wig', 'Dob', 'Lul', 'Zig', 'Crab', 'Fiz', 'Mop', 'Bun', 'Jel', 'Plim', 'Kip', 'Tof', 'Wum', 'Yip'];
const END_SYL = ['bo', 'ington', 'let', 'sy', 'kin', 'ble', 'per', 'oo', 'zle', 'ly', 'muff', 'dle', 'pip',
  'nik', 'bert', 'ella', 'kins', 'wick', 'ster', 'ino'];
const TITLE = {
  common: ['Little', 'Tiny', 'Sleepy', 'Happy', 'Fuzzy', 'Wobbly', 'Bouncy', 'Chubby'],
  uncommon: ['Fuzzy', 'Bouncy', 'Giggly', 'Sneaky', 'Jolly', 'Wiggly'],
  rare: ['Sir', 'Lady', 'Captain', 'Sparkly', 'Lucky'],
  epic: ['Professor', 'Captain', 'Cosmic', 'Mighty', 'Wizard'],
  legendary: ['King', 'Queen', 'Golden', 'Grand', 'Royal'],
};
// Substrings that must never appear in a name (lowercase, spaces removed).
// English, German, Spanish. Generous on purpose: a false hit only means another try.
export const BLOCKLIST = [
  'ass', 'arse', 'butt', 'poo', 'pee', 'piss', 'shit', 'fuck', 'fuk', 'cum', 'dick', 'cock', 'tit',
  'fag', 'nig', 'sex', 'porn', 'slut', 'whore', 'bitch', 'damn', 'crap', 'wank', 'twat', 'cunt', 'kill',
  'nazi', 'hitler', 'kkk', 'rape', 'anal', 'anus', 'boob', 'nud', 'nak', 'turd', 'fart', 'bum', 'gay',
  'kack', 'scheis', 'schei', 'arsch', 'fick', 'pimmel', 'penis', 'muschi', 'fotz', 'hure', 'nutte',
  'wichs', 'spast', 'mong', 'depp', 'doof', 'idiot', 'dumm', 'blöd', 'furz', 'pups', 'titt',
  'puta', 'puto', 'caca', 'pedo', 'culo', 'mierda', 'coño', 'cono', 'polla', 'verga', 'teta', 'pito',
  'chocho', 'joder', 'mamon', 'cabron', 'pendej', 'marica', 'zorra', 'perra', 'tonto', 'gilip', 'pis',
  'mear', 'cag', 'nalga',
];
export function isClean(name) {
  const s = name.toLowerCase().replace(/[^a-zäöüñß]/g, '');
  return !BLOCKLIST.some((b) => s.includes(b));
}
const nameCache = new Map();
export function speciesName(sp) {
  if (nameCache.has(sp)) return nameCache.get(sp);
  const rarity = sp.split('-')[0];
  const r = rng(`name:${sp}`);
  let name = '';
  for (let tries = 0; tries < 50; tries++) {
    const core = pick(r, START_SYL) + pick(r, END_SYL);
    name = `${pick(r, TITLE[rarity])} ${core}`;
    if (isClean(name) && !/(.)\1\1/i.test(name) && ![...nameCache.values()].includes(name)) break;
  }
  nameCache.set(sp, name);
  return name;
}

// ── looks ──
const PALETTE = {
  common: [0xffb4a2, 0xa8e6cf, 0xffd3b6, 0xdcedc1, 0xb5d8ff, 0xf6c6ea, 0xfff1a8, 0xc9b6ff],
  uncommon: [0x6fdc7a, 0x4fd1c5, 0x9be15d, 0x3fc1a5, 0x7ed957, 0x58c48f],
  rare: [0x5aa8ff, 0x3f7cff, 0x45c4ff, 0x6f8cff, 0x2ee6c0],
  epic: [0xb57bff, 0xd65bff, 0x8f5bff, 0xff6fd8],
  legendary: [0xffcf5e, 0xffb020, 0xffe08a],
};
const PARTS_BY_RARITY = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 4 };
const PART_KINDS = ['catEars', 'bunnyEars', 'roundEars', 'horns', 'antennae', 'claws', 'wings', 'tail', 'spikes', 'feet', 'tuft'];
const HAT = { rare: 'party', epic: ['topHat', 'wizard'], legendary: 'crown' };

export function speciesLook(sp) {
  const rarity = sp.split('-')[0];
  const idx = +sp.split('-')[1];
  const r = rng(`look:${sp}`);
  const pal = PALETTE[rarity];
  const color = pal[idx % pal.length];
  const second = pal[(idx + 2) % pal.length];
  const body = pick(r, ['round', 'egg', 'pear', 'wide', 'tall']);
  const kinds = PART_KINDS.slice();
  const parts = [];
  // At most one kind of ears/head part.
  const head = new Set(['catEars', 'bunnyEars', 'roundEars', 'horns', 'antennae', 'tuft']);
  while (parts.length < PARTS_BY_RARITY[rarity] && kinds.length) {
    const k = kinds.splice(Math.floor(r() * kinds.length), 1)[0];
    if (head.has(k) && parts.some((p) => head.has(p))) continue;
    parts.push(k);
  }
  let hat = HAT[rarity] || null;
  if (Array.isArray(hat)) hat = hat[idx % hat.length];
  if (hat && hat !== 'crown') { // hats sit where ears would be
    for (let i = parts.length - 1; i >= 0; i--) if (head.has(parts[i]) && parts[i] !== 'antennae') parts.splice(i, 1);
  }
  return {
    rarity, color, second, body, parts, hat,
    eyes: rarity === 'epic' && idx % 2 ? 3 : (rarity === 'rare' && idx === 4 ? 1 : 2),
    belly: r() < 0.6,
    spots: r() < 0.4,
    shiny: ['rare', 'epic', 'legendary'].includes(rarity),
    glow: ['epic', 'legendary'].includes(rarity),
    dance: rarity === 'legendary' ? 'spin' : rarity === 'epic' ? 'sway' : 'hop',
  };
}

// Shared geometry (all creatures are built from these few shapes).
const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  torus: new THREE.TorusGeometry(1, 0.28, 8, 16, Math.PI),
  box: new THREE.BoxGeometry(1, 1, 1),
};
const matCache = new Map();
function mat(color, { shiny = false, emissive = 0, flat = false } = {}) {
  const key = `${color}|${shiny}|${emissive}|${flat}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: shiny ? 0.25 : 0.75, metalness: shiny ? 0.25 : 0,
      emissive: emissive || 0x000000, emissiveIntensity: emissive ? 0.35 : 0, flatShading: flat,
    }));
  }
  return matCache.get(key);
}
const WHITE = 0xffffff, BLACK = 0x1a1a2e, PINK = 0xff8fa3;

function mesh(geo, m, x, y, z, sx, sy, sz) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z); o.scale.set(sx, sy ?? sx, sz ?? sx);
  o.castShadow = true;
  return o;
}

const BODY = {
  round: { sx: 0.55, sy: 0.52, sz: 0.5, y: 0.52 },
  egg: { sx: 0.48, sy: 0.62, sz: 0.46, y: 0.62 },
  pear: { sx: 0.6, sy: 0.5, sz: 0.52, y: 0.5 },
  wide: { sx: 0.7, sy: 0.42, sz: 0.5, y: 0.42 },
  tall: { sx: 0.42, sy: 0.7, sz: 0.42, y: 0.7 },
};

// Builds a creature, about 1 unit tall, standing on y = 0, looking at +z.
// Returns a Group; group.userData.inner is the part to animate.
export function buildCreature(sp, { silhouette = false } = {}) {
  const L = speciesLook(sp);
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const sil = silhouette ? mat(0x3a4a6a) : null;
  const M = (c, o) => sil || mat(c, o);
  const shiny = L.shiny, emissive = L.glow ? L.color : 0;
  const bodyM = M(L.color, { shiny, emissive });
  const b = BODY[L.body];
  const top = b.y + b.sy; // top of the head
  const front = b.sz;

  const body = mesh(G.sphere, bodyM, 0, b.y, 0, b.sx, b.sy, b.sz);
  if (L.body === 'pear') body.scale.y *= 1;
  inner.add(body);
  if (L.belly) inner.add(mesh(G.sphere, M(WHITE, { shiny }), 0, b.y * 0.8, front * 0.55, b.sx * 0.62, b.sy * 0.55, b.sz * 0.5));
  if (L.spots) {
    for (let i = 0; i < 4; i++) {
      const a = 0.9 + i * 1.3;
      inner.add(mesh(G.sphereLo, M(L.second), Math.cos(a) * b.sx * 0.92, b.y + Math.sin(i * 2) * b.sy * 0.4,
        Math.sin(a) * b.sz * 0.92 - 0.05, 0.1, 0.1, 0.05));
    }
  }
  // eyes
  const eyeY = b.y + b.sy * 0.35, eyeZ = front * 0.86;
  const xs = L.eyes === 1 ? [0] : L.eyes === 3 ? [-0.2, 0, 0.2] : [-0.17, 0.17];
  for (const x of xs) {
    const big = L.eyes === 1 ? 1.5 : 1;
    const y = L.eyes === 3 && x === 0 ? eyeY + 0.12 : eyeY;
    inner.add(mesh(G.sphereLo, M(WHITE), x, y, eyeZ, 0.11 * big, 0.13 * big, 0.06));
    inner.add(mesh(G.sphereLo, M(BLACK), x, y - 0.01, eyeZ + 0.05, 0.065 * big, 0.08 * big, 0.04));
    if (!silhouette) inner.add(mesh(G.sphereLo, mat(WHITE), x + 0.025, y + 0.03, eyeZ + 0.085, 0.022, 0.022, 0.01));
  }
  // smile + cheeks
  const smile = mesh(G.torus, M(BLACK), 0, eyeY - 0.17, eyeZ - 0.02, 0.07, 0.07, 0.07);
  smile.rotation.z = Math.PI;
  inner.add(smile);
  if (!silhouette) for (const s of [-1, 1]) inner.add(mesh(G.sphereLo, mat(PINK), s * 0.27, eyeY - 0.12, eyeZ - 0.06, 0.06, 0.04, 0.02));

  const P = M(L.second, { shiny });
  for (const part of L.parts) {
    switch (part) {
      case 'catEars': for (const s of [-1, 1]) { const e = mesh(G.cone, M(L.color, { shiny }), s * b.sx * 0.5, top - 0.02, 0, 0.13, 0.25, 0.1); e.rotation.z = -s * 0.3; inner.add(e); } break;
      case 'bunnyEars': for (const s of [-1, 1]) { const e = mesh(G.sphere, M(L.color, { shiny }), s * 0.14, top + 0.18, -0.02, 0.08, 0.26, 0.05); e.rotation.z = -s * 0.18; inner.add(e); } break;
      case 'roundEars': for (const s of [-1, 1]) inner.add(mesh(G.sphere, P, s * b.sx * 0.65, top - 0.08, 0, 0.13, 0.13, 0.06)); break;
      case 'horns': for (const s of [-1, 1]) { const h = mesh(G.cone, M(0xfff5d6), s * 0.17, top + 0.04, 0, 0.06, 0.24, 0.06); h.rotation.z = -s * 0.35; inner.add(h); } break;
      case 'antennae': for (const s of [-1, 1]) {
        const st = mesh(G.cyl, M(BLACK), s * 0.12, top + 0.12, 0, 0.015, 0.28, 0.015); st.rotation.z = -s * 0.3; inner.add(st);
        inner.add(mesh(G.sphereLo, P, s * 0.17, top + 0.26, 0, 0.06)); } break;
      case 'claws': for (const s of [-1, 1]) {
        const arm = mesh(G.sphereLo, P, s * (b.sx + 0.08), b.y, 0.12, 0.08, 0.08, 0.08); inner.add(arm);
        for (const k of [-1, 1]) { const c = mesh(G.sphere, P, s * (b.sx + 0.2), b.y + 0.06 + k * 0.06, 0.2, 0.1, 0.05, 0.1); c.rotation.z = k * 0.4; inner.add(c); } } break;
      case 'wings': for (const s of [-1, 1]) { const w = mesh(G.sphere, M(WHITE, { shiny, emissive }), s * (b.sx + 0.05), b.y + 0.1, -0.15, 0.26, 0.14, 0.04); w.rotation.y = s * 0.6; w.rotation.z = s * 0.4; w.userData.wing = s; inner.add(w); } break;
      case 'tail': { const t = mesh(G.sphere, P, 0, b.y * 0.6, -b.sz - 0.08, 0.12, 0.12, 0.16); inner.add(t); break; }
      case 'spikes': for (let i = 0; i < 4; i++) { const s = mesh(G.cone, M(L.second), 0, b.y + b.sy * (0.7 - i * 0.35), -b.sz * (0.7 + i * 0.08), 0.07, 0.16, 0.07); s.rotation.x = -0.8 - i * 0.25; inner.add(s); } break;
      case 'feet': for (const s of [-1, 1]) inner.add(mesh(G.sphereLo, P, s * 0.2, 0.05, 0.1, 0.13, 0.07, 0.17)); break;
      case 'tuft': for (let i = -1; i <= 1; i++) { const f = mesh(G.cone, P, i * 0.06, top + 0.06, 0, 0.05, 0.16, 0.05); f.rotation.z = -i * 0.4; inner.add(f); } break;
    }
  }
  if (L.hat === 'party') {
    const h = mesh(G.cone, M(0xff8585), 0.06, top + 0.14, 0, 0.14, 0.32, 0.14); h.rotation.z = -0.15; inner.add(h);
    inner.add(mesh(G.sphereLo, M(0xffcf5e), 0.1, top + 0.31, 0, 0.05));
  } else if (L.hat === 'topHat') {
    inner.add(mesh(G.cyl, M(0x22223a, { shiny: true }), 0, top + 0.02, 0, 0.26, 0.03, 0.26));
    inner.add(mesh(G.cyl, M(0x22223a, { shiny: true }), 0, top + 0.17, 0, 0.16, 0.28, 0.16));
    inner.add(mesh(G.cyl, M(0xff8585), 0, top + 0.06, 0, 0.165, 0.05, 0.165));
  } else if (L.hat === 'wizard') {
    inner.add(mesh(G.cyl, M(0x4a2a8a), 0, top + 0.01, 0, 0.28, 0.025, 0.28));
    const h = mesh(G.cone, M(0x4a2a8a), 0, top + 0.24, 0, 0.18, 0.45, 0.18); h.rotation.z = -0.2; inner.add(h);
    inner.add(mesh(G.sphereLo, M(0xffcf5e, { emissive: 0xffcf5e }), 0.05, top + 0.2, 0.16, 0.035));
  } else if (L.hat === 'crown') {
    const gold = M(0xffd54a, { shiny: true, emissive: 0xffa000 });
    inner.add(mesh(G.cyl, gold, 0, top + 0.04, 0, 0.2, 0.1, 0.2));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      inner.add(mesh(G.cone, gold, Math.sin(a) * 0.17, top + 0.15, Math.cos(a) * 0.17, 0.05, 0.13, 0.05));
    }
    inner.add(mesh(G.sphereLo, M(0xff5577, { shiny: true }), 0, top + 0.05, 0.2, 0.04));
  }
  g.userData = { inner, look: L, sp, phase: Math.random() * 10, height: top };
  return g;
}

// Idle animation (call every frame). t = seconds.
export function animateCreature(g, t, dt, excited = 0) {
  const { inner, look, phase } = g.userData;
  const p = t * (1.6 + excited) + phase;
  if (look.dance === 'spin') {
    inner.position.y = Math.abs(Math.sin(p * 1.4)) * 0.12;
    inner.rotation.y = Math.sin(p * 0.5) * 0.6;
  } else if (look.dance === 'sway') {
    inner.rotation.z = Math.sin(p * 1.5) * 0.12;
    inner.position.y = Math.abs(Math.sin(p * 1.5)) * 0.05;
  } else {
    // little hop every few seconds
    const h = Math.max(0, Math.sin(p * 1.2) - 0.75) * 0.6;
    inner.position.y = h;
    const sq = 1 - Math.max(0, Math.sin(p * 1.2 + 1.6) - 0.85) * 0.5;
    inner.scale.set(1 + (1 - sq) * 0.5, sq, 1 + (1 - sq) * 0.5);
  }
  for (const c of inner.children) if (c.userData.wing) c.rotation.z = c.userData.wing * (0.4 + Math.sin(t * 9 + phase) * 0.35);
}

export function rarityColor(r) { return RARITY[r].css; }
