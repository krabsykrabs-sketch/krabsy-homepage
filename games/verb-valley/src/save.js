// Save system + the single authoritative advanceDay() the whole game funnels
// through. State is plain JSON in localStorage, versioned so v1.1 schema bumps
// can migrate instead of wiping farms.

import { SAVE_KEY, SAVE_VERSION, TIME, LAYOUT, CROPS, SELLABLE, TREE_REGROW_DAYS, MINE_NODES, BUCKET_CAP } from './config.js';

const FIELD_TILES = LAYOUT.field.cols * LAYOUT.field.rows;
const HAY_TILES = LAYOUT.hay.cols * LAYOUT.hay.rows;

const zeroPerCrop = () => Object.fromEntries(Object.keys(CROPS).map((k) => [k, 0]));

export const freshToday = () => ({ asked: 0, correct: 0, missed: [], wells: 0, wellsFilled: 0,
  planted: 0, watered: 0, harvested: 0, hayCut: 0, sold: 0 });

export function createNewState() {
  return {
    version: SAVE_VERSION,
    day: 1,
    timeMin: TIME.WAKE,
    coins: 30,
    schooledDay: 0,                  // last day class was attended (0 = never)
    tools: { shovel: true, bucket: true, sword: true, axe: false, pickaxe: false, rod: false },
    // Carrots grow in one night: day 2 already brings a harvest.
    seeds: { ...zeroPerCrop(), carrot: 3, turnip: 2 },
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
    water: BUCKET_CAP,               // tiles the bucket can still water
    saleBonus: 0,                    // Krabsy's deal: +x on the next sale
    today: freshToday(),             // today's counters (sleep card, goals)
    goals: null,                     // { day, list } — see goals.js
    stars: 0,                        // all goal stars ever earned
    farmName: '',
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

// ── Save slots: several named farms per browser (shared school devices) ──
// Index at SLOTS_KEY = [{ id, name }]; each farm lives at `${SAVE_KEY}_${id}`.
// A save from before slots (plain SAVE_KEY) becomes slot 1 on first use.
const SLOTS_KEY = SAVE_KEY + '_slots';
export const MAX_SLOTS = 4;
let slotId = 1;
const keyOf = (id) => `${SAVE_KEY}_${id}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* blocked */ } },
};
function readSlots() {
  try { return JSON.parse(store.get(SLOTS_KEY)) ?? []; } catch { return []; }
}
function writeSlots(list) { store.set(SLOTS_KEY, JSON.stringify(list)); }
function migrateLegacy() {
  const legacy = store.get(SAVE_KEY);
  if (!legacy) return;
  const list = readSlots();
  const id = list.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  store.set(keyOf(id), legacy);
  list.push({ id, name: '' });
  writeSlots(list);
  store.del(SAVE_KEY);
}
/** Farms on this browser, with a few facts for the start screen. */
export function listSlots() {
  migrateLegacy();
  return readSlots().map((s) => {
    let day = 1, stars = 0;
    try { const st = JSON.parse(store.get(keyOf(s.id))); day = st?.day ?? 1; stars = st?.stars ?? 0; } catch { /* broken save */ }
    return { ...s, day, stars };
  });
}
export function useSlot(id) { slotId = id; }
export function currentSlot() { return slotId; }
/** New named farm; returns its id, or null when all slots are taken. */
export function createSlot(name) {
  migrateLegacy();
  const list = readSlots();
  if (list.length >= MAX_SLOTS) return null;
  const id = list.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  list.push({ id, name: String(name ?? '').trim().slice(0, 16) });
  writeSlots(list);
  slotId = id;
  return id;
}
export function deleteSlot(id) {
  writeSlots(readSlots().filter((s) => s.id !== id));
  store.del(keyOf(id));
}

export function load() {
  try {
    const raw = store.get(keyOf(slotId));
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
    return migrate(s);
  }
  if (s.version === 3) {
    // v3 → v4: question stations (bucket water, sale bonus, day stats).
    s.water = BUCKET_CAP;
    s.saleBonus = 0;
    s.today = freshToday();
    s.version = 4;
    return migrate(s);
  }
  if (s.version === 4) {
    // v4 → v5: daily goals + stars, farm name, more day counters.
    s.today = { ...freshToday(), ...s.today };
    s.goals = null;
    s.stars = 0;
    s.farmName = s.farmName ?? '';
    s.version = 5;
    return s;
  }
  return null;
}

export function save(state) { return store.set(keyOf(slotId), JSON.stringify(state)); }

export function hasSave() { return !!store.get(keyOf(slotId)); }
export function wipe() { store.del(keyOf(slotId)); }

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

  // 5. The day's English: shown on the sleep card, then reset.
  const english = state.today ?? freshToday();
  state.today = freshToday();

  return { earned, sold, grew, ripened, hayRegrown, nodesRegrown, day: state.day, english };
}
