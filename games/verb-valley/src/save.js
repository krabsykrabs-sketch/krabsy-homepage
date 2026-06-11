// Save system + the single authoritative advanceDay() the whole game funnels
// through. State is plain JSON in localStorage, versioned so v1.1 schema bumps
// can migrate instead of wiping farms.

import { SAVE_KEY, SAVE_VERSION, TIME, LAYOUT, CROPS, SELLABLE, TREE_REGROW_DAYS, MINE_NODES } from './config.js';

const FIELD_TILES = LAYOUT.field.cols * LAYOUT.field.rows;
const HAY_TILES = LAYOUT.hay.cols * LAYOUT.hay.rows;

const zeroPerCrop = () => Object.fromEntries(Object.keys(CROPS).map((k) => [k, 0]));

export function createNewState() {
  return {
    version: SAVE_VERSION,
    day: 1,
    timeMin: TIME.WAKE,
    coins: 30,
    schooledDay: 0,                  // last day class was attended (0 = never)
    tools: { shovel: true, bucket: true, sword: true, axe: false, pickaxe: false, rod: false },
    seeds: { ...zeroPerCrop(), turnip: 3 },
    inventory: { ...zeroPerCrop(), wood: 0, berry: 0, hay: 0, stone: 0, gold: 0, gem: 0, fish: 0, goldfish: 0 },
    collection: {},                  // crop → true once harvested; the album
    crate: {},                       // legacy (pre-instant-selling saves)
    plots: Array.from({ length: FIELD_TILES }, () => ({
      tilled: false, crop: null, stage: 0, watered: false,
    })),
    // hay meadow: grown → scythe → cut (+1 hay) → water → regrows overnight
    hay: Array.from({ length: HAY_TILES }, () => ({ cut: false, watered: false })),
    trees: LAYOUT.trees.map(() => ({ chopped: false, regrowDay: 0 })),
    mine: LAYOUT.mine.map((_, i) => ({ type: rollNode(1, i), mined: false })),
    berries: spawnBerries(1),
    school: { missed: [], stickers: 0, totalCorrect: 0, classesAttended: 0, lastReview: null },
    sound: true,
  };
}

// Weighted node roll, deterministic per (day, slot) so reloads are stable.
export function rollNode(day, slot) {
  const entries = Object.entries(MINE_NODES);
  const total = entries.reduce((s, [, n]) => s + n.weight, 0);
  let h = (day * 374761393 + slot * 668265263) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  let r = (h % 1000) / 1000 * total;
  for (const [k, n] of entries) { r -= n.weight; if (r < 0) return k; }
  return 'stone';
}

// Berries are free pocket money that respawn daily. Stored as world positions
// so the renderer can place pickups; regenerated each morning in advanceDay.
function spawnBerries(day) {
  // Deterministic-ish scatter seeded by day so reloads are stable within a day.
  const out = [];
  const n = 3;
  for (let i = 0; i < n; i++) {
    const a = (day * 2.39996 + i * 1.7) % (Math.PI * 2);
    const r = 6 + ((day * 7 + i * 3) % 9);
    out.push({ x: Math.cos(a) * r, z: 4 + Math.sin(a) * r * 0.6, taken: false });
  }
  return out;
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== SAVE_VERSION) return migrate(s);
    return s;
  } catch { return null; }
}

function migrate(s) {
  if (!s) return null;
  if (s.version === 1) {
    // v1 → v2: hay meadow, crop album, scythe, expanded crop catalogue.
    const fresh = createNewState();
    s.tools = { ...fresh.tools, ...s.tools, scythe: true };
    s.seeds = { ...fresh.seeds, ...s.seeds };
    s.inventory = { ...fresh.inventory, ...s.inventory };
    s.hay = fresh.hay;
    // Best guess at album progress: anything currently held counts as grown.
    s.collection = {};
    for (const [k, n] of Object.entries(s.inventory)) if (CROPS[k] && n > 0) s.collection[k] = true;
    s.version = 2;
    return migrate(s);
  }
  if (s.version === 2) {
    // v2 → v3: asset rebuild — tool remap (hoe→shovel, can→bucket,
    // scythe→sword), quarry + fishing.
    const fresh = createNewState();
    const old = s.tools ?? {};
    s.tools = {
      shovel: old.hoe ?? true, bucket: old.can ?? true, sword: old.scythe ?? true,
      axe: old.axe ?? false, pickaxe: false, rod: false,
    };
    s.inventory = { ...fresh.inventory, ...s.inventory };
    s.mine = fresh.mine;
    s.version = 3;
    return s;
  }
  return null;
}

export function save(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}

export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
export function wipe() { localStorage.removeItem(SAVE_KEY); }

// ── The day advance — called on sleep. Returns a summary for the UI. ────
// Order matters: sell crate first (so the player sees today's earnings),
// then grow crops, regrow trees, respawn berries, reset clock.
export function advanceDay(state) {
  // 1. Sell everything in the shipping crate.
  let earned = 0;
  const sold = {};
  for (const [item, qty] of Object.entries(state.crate)) {
    if (!qty) continue;
    const unit = SELLABLE[item] ?? 0;
    earned += unit * qty;
    sold[item] = qty;
  }
  state.coins += earned;
  state.crate = {};

  // 2. Grow watered crops one stage; dry crops just pause (kind world).
  let grew = 0, ripened = 0;
  for (const p of state.plots) {
    if (!p.crop) continue;
    const def = CROPS[p.crop];
    if (p.stage >= def.days) { p.watered = false; continue; } // already ripe
    if (p.watered) {
      p.stage = Math.min(def.days, p.stage + 1);
      grew++;
      if (p.stage >= def.days) ripened++;
    }
    p.watered = false; // soil dries overnight
  }

  // 3. Regrow chopped trees whose timer is up.
  for (const t of state.trees) {
    if (t.chopped && state.day + 1 >= t.regrowDay) { t.chopped = false; t.regrowDay = 0; }
  }

  // 3b. Hay regrows overnight where the stubble was watered.
  let hayRegrown = 0;
  for (const h of state.hay) {
    if (h.cut && h.watered) { h.cut = false; hayRegrown++; }
    h.watered = false;
  }

  // 3c. Mined quarry nodes regrow overnight as a fresh weighted roll.
  let nodesRegrown = 0;
  state.mine.forEach((n, i) => {
    if (n.mined) { n.mined = false; n.type = rollNode(state.day + 1, i); nodesRegrown++; }
  });

  // 4. New day.
  state.day += 1;
  state.timeMin = TIME.WAKE;
  state.berries = spawnBerries(state.day);

  return { earned, sold, grew, ripened, hayRegrown, nodesRegrown, day: state.day };
}
