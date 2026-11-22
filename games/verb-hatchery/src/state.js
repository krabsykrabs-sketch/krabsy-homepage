// Game state and rules: pure data, no drawing. Saved to localStorage.
// Every number comes from balance.js.
import {
  RARITIES, RARITY, SPECIES_STEP, GRAB_BONUS_SECONDS, RELEASE_SECONDS, AWAY,
  START, UPGRADES, MAX_PENS, MAX_INCUBATORS, price, GOALS, GOALS_SHOWN, endlessGoal,
} from './balance.js';

const SAVE_KEY = 'krabsy_hatchery_save';
const VERSION = 2; // 2 = open-world version (v1 belt saves are dropped)

const zeroR = () => Object.fromEntries(RARITIES.map((r) => [r, 0]));

export function newState(now = Date.now()) {
  const s = {
    v: VERSION, coins: 0, earned: 0, lastSave: now, created: now,
    up: { pen: 0, incubator: 0, hatchSpeed: 0, shoes: 0, backpack: 0 },
    carry: [],                                  // rarities of the eggs in the backpack
    look: 'A',                                  // which character (player.js LOOKS)
    pens: Array(MAX_PENS).fill(null),          // { sp } or null
    incubators: Array(MAX_INCUBATORS).fill(null), // { rarity, start, dur, sp? }
    book: {},                                   // speciesId → times hatched
    stats: { grabbed: 0, grabbedR: zeroR(), home: 0, bonk: 0, stolen: 0, hatched: 0, hatchedR: zeroR(), lost: 0,
      answers: 0, correct: 0, streak: 0, best: 0, upgrades: 0 },
    goals: { active: [], next: 0, stars: 0 },
  };
  fillGoals(s);
  return s;
}

// ── save / load (every access in try/catch: storage may be blocked) ──
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== VERSION) return null;
    // Arrays may be shorter if the balance grew; pad them.
    while (s.pens.length < MAX_PENS) s.pens.push(null);
    while (s.incubators.length < MAX_INCUBATORS) s.incubators.push(null);
    const fresh = newState();
    s.up = { ...fresh.up, ...s.up };
    s.stats = { ...fresh.stats, ...s.stats };
    s.carry = s.carry || [];
    return s;
  } catch (_) { return null; }
}
export function save(s, now = Date.now()) {
  s.lastSave = now;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
}
export function wipe() { try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ } }

// ── counts and income ──
export const pensOwned = (s) => START.pens + s.up.pen;
export const incubatorsOwned = (s) => START.incubators + s.up.incubator;
export const speciesIndex = (sp) => +sp.split('-')[1];
export const speciesRarity = (sp) => sp.split('-')[0];
export function speciesIncome(sp) {
  return RARITY[speciesRarity(sp)].income * (1 + SPECIES_STEP * speciesIndex(sp));
}
export function cps(s) {
  let c = 0;
  for (let i = 0; i < pensOwned(s); i++) if (s.pens[i]) c += speciesIncome(s.pens[i].sp);
  return c;
}
export function addCoins(s, n) { s.coins += n; s.earned += n; }

// Income for dt seconds of play.
export function tick(s, dt) {
  const n = cps(s) * dt;
  if (n > 0) addCoins(s, n);
  return n;
}

// Coins earned while away (time since the last save), capped and at a lower rate.
export function applyAway(s, now = Date.now()) {
  const secs = Math.max(0, (now - (s.lastSave || now)) / 1000);
  if (secs < AWAY.minSeconds) return { seconds: secs, coins: 0 };
  const coins = cps(s) * Math.min(secs, AWAY.capSeconds) * AWAY.rate;
  addCoins(s, coins);
  return { seconds: secs, coins, capped: secs > AWAY.capSeconds };
}

// ── zones, player ──
export const zoneOpen = (s, zone) => s.goals.stars >= zone.stars;
export function rollRarity(zone, rnd = Math.random) {
  const w = zone.weights, sum = w.reduce((a, b) => a + b, 0);
  let x = rnd() * sum;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return RARITIES[i]; }
  return RARITIES[w.findIndex((v) => v > 0)];
}
export const backpackSize = (s) => START.backpack + s.up.backpack;
export const speedFactor = (s) => Math.pow(UPGRADES.shoes.factor, s.up.shoes);

// A right answer: the egg goes into the backpack. Returns the bonus, or null if full.
export function pickUp(s, rarity) {
  if (s.carry.length >= backpackSize(s)) return null;
  s.carry.push(rarity);
  s.stats.grabbed++; s.stats.grabbedR[rarity]++;
  const bonus = Math.round(Math.max(RARITY[rarity].grabBonus, GRAB_BONUS_SECONDS * cps(s)));
  addCoins(s, bonus);
  return { bonus };
}
// A thief got the top egg.
export function stealTop(s) { s.stats.stolen++; return s.carry.pop() || null; }
export function bonked(s) { s.stats.bonk++; }

// ── incubators ──
export function freeIncubator(s) {
  for (let i = 0; i < incubatorsOwned(s); i++) if (!s.incubators[i]) return i;
  return -1;
}
export function hatchDuration(s, rarity) {
  return RARITY[rarity].hatch * Math.pow(UPGRADES.hatchSpeed.factor, s.up.hatchSpeed);
}
// At home on the egg pad: eggs move from the backpack into free incubators
// (the rarest first). Returns [{ index, rarity }].
export function deliver(s, now = Date.now()) {
  const out = [];
  s.carry.sort((a, b) => RARITIES.indexOf(a) - RARITIES.indexOf(b)); // rarest last = delivered first
  while (s.carry.length) {
    const i = freeIncubator(s);
    if (i < 0) break;
    const rarity = s.carry.pop();
    s.incubators[i] = { rarity, start: now, dur: hatchDuration(s, rarity) * 1000 };
    s.stats.home++;
    out.push({ index: i, rarity });
  }
  return out;
}
export function loseEgg(s) { s.stats.lost++; }
export function isReady(inc, now = Date.now()) {
  return !!inc && (inc.sp || now >= inc.start + inc.dur);
}
export function hatchLeft(inc, now = Date.now()) {
  return inc ? Math.max(0, inc.start + inc.dur - now) / 1000 : 0;
}
export function freePen(s) {
  for (let i = 0; i < pensOwned(s); i++) if (!s.pens[i]) return i;
  return -1;
}
// Hatch a ready egg. The creature goes into a free pen, or waits in the
// incubator (inc.sp set) until a pen is free.
export function hatch(s, i, rnd = Math.random) {
  const inc = s.incubators[i];
  if (!isReady(inc)) return null;
  let sp = inc.sp, isNew = false;
  if (!sp) {
    sp = `${inc.rarity}-${Math.floor(rnd() * RARITY[inc.rarity].species)}`;
    isNew = !s.book[sp];
    s.book[sp] = (s.book[sp] || 0) + 1;
    s.stats.hatched++; s.stats.hatchedR[inc.rarity]++;
  }
  const pen = freePen(s);
  if (pen < 0) { inc.sp = sp; return { sp, isNew, pen: -1, rarity: inc.rarity, waiting: true }; }
  s.pens[pen] = { sp };
  s.incubators[i] = null;
  return { sp, isNew, pen, rarity: inc.rarity, waiting: false };
}
export function release(s, pen) {
  const c = s.pens[pen];
  if (!c) return 0;
  const coins = Math.round(speciesIncome(c.sp) * RELEASE_SECONDS);
  s.pens[pen] = null;
  addCoins(s, coins);
  return coins;
}

// ── upgrades ──
export function upgradePrice(s, kind) { return price(kind, s.up[kind]); }
export function canBuy(s, kind) {
  return s.up[kind] < UPGRADES[kind].max && s.coins >= upgradePrice(s, kind);
}
export function isMaxed(s, kind) { return s.up[kind] >= UPGRADES[kind].max; }
export function buy(s, kind) {
  if (!canBuy(s, kind)) return false;
  s.coins -= upgradePrice(s, kind);
  s.up[kind]++;
  s.stats.upgrades++;
  return true;
}

// ── answers ──
export function recordAnswer(s, correct) {
  s.stats.answers++;
  if (correct) { s.stats.correct++; s.stats.streak++; s.stats.best = Math.max(s.stats.best, s.stats.streak); }
  else s.stats.streak = 0;
}

// ── goals ──
export const bookCount = (s) => Object.keys(s.book).length;
function counter(s, g) {
  const st = s.stats;
  switch (g.kind) {
    case 'grab': return st.grabbed;
    case 'grabR': return st.grabbedR[g.r];
    case 'home': return st.home;
    case 'bonk': return st.bonk;
    case 'hatch': return st.hatched;
    case 'hatchR': return st.hatchedR[g.r];
    case 'upgrades': return st.upgrades;
    case 'streak': return st.streak;
    case 'cps': return cps(s);
    case 'book': return bookCount(s);
    case 'pens': return pensOwned(s);
    default: return 0;
  }
}
const ABSOLUTE = new Set(['streak', 'cps', 'book', 'pens']);
function goalDef(k) { return k < GOALS.length ? GOALS[k] : endlessGoal(k - GOALS.length); }
function fillGoals(s) {
  while (s.goals.active.length < GOALS_SHOWN) {
    const g = goalDef(s.goals.next++);
    s.goals.active.push({ ...g, base: ABSOLUTE.has(g.kind) ? 0 : counter(s, g) });
  }
}
export function goalProgress(s, g) {
  const cur = Math.max(0, counter(s, g) - g.base);
  return { cur: Math.min(cur, g.n), n: g.n, done: cur >= g.n };
}
// Returns the goals completed now (each gives a star) and refills the list.
export function checkGoals(s) {
  const done = s.goals.active.filter((g) => goalProgress(s, g).done);
  if (!done.length) return [];
  s.goals.active = s.goals.active.filter((g) => !done.includes(g));
  s.goals.stars += done.length;
  fillGoals(s);
  return done;
}
