// Save system + the single authoritative advanceDay() the whole game funnels
// through. State is plain JSON in localStorage, versioned so v1.1 schema bumps
// can migrate instead of wiping farms.

import { SAVE_KEY, SAVE_VERSION, TIME, LAYOUT, CROPS, SELLABLE, TREE_REGROW_DAYS } from './config.js';

const FIELD_TILES = LAYOUT.field.cols * LAYOUT.field.rows;

export function createNewState() {
  return {
    version: SAVE_VERSION,
    day: 1,
    timeMin: TIME.WAKE,
    coins: 30,
    schooledDay: 0,                  // last day class was attended (0 = never)
    tools: { hoe: true, can: true, axe: false },
    seeds: { turnip: 3, tomato: 0, pumpkin: 0, starfruit: 0 },
    inventory: { turnip: 0, tomato: 0, pumpkin: 0, starfruit: 0, wood: 0, berry: 0 },
    crate: {},                       // produce dropped in the shipping crate, sold on sleep
    plots: Array.from({ length: FIELD_TILES }, () => ({
      tilled: false, crop: null, stage: 0, watered: false,
    })),
    trees: LAYOUT.trees.map(() => ({ chopped: false, regrowDay: 0 })),
    berries: spawnBerries(1),
    school: { missed: [], stickers: 0, totalCorrect: 0, classesAttended: 0, lastReview: null },
    sound: true,
  };
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
  // No prior versions yet; if schema mismatches, start fresh but keep nothing.
  if (!s) return null;
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

  // 4. New day.
  state.day += 1;
  state.timeMin = TIME.WAKE;
  state.berries = spawnBerries(state.day);

  return { earned, sold, grew, ripened, day: state.day };
}
