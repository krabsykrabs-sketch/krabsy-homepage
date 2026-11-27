/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — rewards: gifts instead of a shop (owner decision 2026-11-25)
   ES module, no DOM, no three.js. Concept: docs/figures-shells-world.md
   ("Rewards instead of a shop"); for games: docs/game-contract.md ("Gifts").

   Figures and accessories can't be bought. A child owns the 12 free figures
   and gets everything else as a GIFT (a random figure or accessory it doesn't
   own yet):

     shells      every 150 shells collected (lifetime `earned`, krabsy-shells.js)
     milestones  50 / 200 / 500 / 1000 right answers · 10 / 50 words that sit
                 (every answered form at mastery ≥ 4) · Verb-Diplom bronze /
                 silver / gold · a second topic tried
     days        3 / 7 / 14 / 30 practice days (a calendar day with at least
                 10 answers; the days don't have to follow each other)
     weeks       one gift for every new calendar week with a practice day,
                 from the second such week on
     games       grantGift() — found in a 3D game (chest, egg, flag …)

   Storage, on this device only:
     krabsy_shells_v1.owned    what the child owns (unchanged: everything bought
                               in the old shop or migrated from a game stays)
     krabsy_rewards_v1         { v, init, shellGifts, done:[keys], day, dayAnswers,
                                 days, lastDay, weeks, lastWeek, game:{day,n:{}},
                                 log:[{ id, src, t, shown, seen }] }
   The rewards have their own key because older cached copies of
   krabsy-shells.js rewrite krabsy_shells_v1 with only the fields they know.
   Every call reads and writes storage directly (no module cache): this file
   is loaded under several URLs and inside game iframes.

   Nothing here may throw into a game or a drill: every public function is
   safe without storage (private mode) and outside a browser.
   ────────────────────────────────────────────────────────────────────────── */
import { currentLang } from './krabsy-lang.js?v=2026-11-27';
import { FREE_CHARS, PRICES, NO_HAT, GIFT_IDS, parseId, sourceChar, itemName, itemImage,
  CHAR_IDS } from './krabsy-figure-catalog.js';

const KEY = 'krabsy_rewards_v1';
const SHELLS_KEY = 'krabsy_shells_v1';
const STATS_KEY = 'krabsy_stats_v2';
const DIPLOM_KEY = 'krabsy_verb_diplom';
const FIGURE_KEY = 'krabsy_figure_v2';

export const SHELLS_PER_GIFT = 150;     // lifetime shells per surprise gift
export const FIRST_RUN_MAX = 5;         // gifts at most when the rewards start for a child who already practised
export const DAY_ANSWERS = 10;          // answers that make a calendar day a practice day
export const GAME_GIFTS_PER_DAY = 2;    // gifts one game may give per calendar day
const UNFIT_WEIGHT = 0.2;               // a lone gift that doesn't fit the current figure: 5 × less likely
const LOG_MAX = 80;
const SAFE_MASTERY = 4;                 // "sitzt": every answered form at mastery ≥ 4 (as on the profile page)

/** The milestones, in the order they are shown. `kind`: what the gift is ('char' = a figure). */
export const MILESTONES = [
  { key: 'right:50', type: 'right', n: 50 },
  { key: 'right:200', type: 'right', n: 200 },
  { key: 'right:500', type: 'right', n: 500, kind: 'char' },
  { key: 'right:1000', type: 'right', n: 1000, kind: 'char' },
  { key: 'safe:10', type: 'safe', n: 10 },
  { key: 'safe:50', type: 'safe', n: 50, kind: 'char' },
  { key: 'topics:2', type: 'topics', n: 2 },
  { key: 'diplom:bronze', type: 'diplom', level: 'bronze', n: 1 },
  { key: 'diplom:silver', type: 'diplom', level: 'silver', n: 1, kind: 'char' },
  { key: 'diplom:gold', type: 'diplom', level: 'gold', n: 1, kind: 'char' },
];
export const DAY_GOALS = [3, 7, 14, 30];

/* ── storage ────────────────────────────────────────────────────────────── */
const int = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const p2 = (n) => String(n).padStart(2, '0');
function today(d = new Date()) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
/** ISO week of a local date: "2026-W48". */
function weekOf(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${p2(Math.ceil(((t - y0) / 86400000 + 1) / 7))}`;
}
function readJson(key) {
  try { const o = JSON.parse(localStorage.getItem(key) || 'null'); return o && typeof o === 'object' ? o : null; } catch (_) { return null; }
}
const ID_RE = /^[a-z]+:[A-Za-z0-9_]{1,40}$/;

function read() {
  const o = readJson(KEY) || {};
  const s = { v: 1, init: !!o.init, shellGifts: int(o.shellGifts), done: [], day: today(), dayAnswers: 0,
    days: int(o.days), lastDay: typeof o.lastDay === 'string' ? o.lastDay : '',
    weeks: int(o.weeks), lastWeek: typeof o.lastWeek === 'string' ? o.lastWeek : '',
    game: { day: today(), n: {} }, log: [] };
  if (Array.isArray(o.done)) s.done = [...new Set(o.done.filter((k) => typeof k === 'string' && k.length < 40))].slice(0, 200);
  if (o.day === s.day) s.dayAnswers = int(o.dayAnswers);
  if (o.game && o.game.day === s.day && o.game.n && typeof o.game.n === 'object') {
    for (const [k, v] of Object.entries(o.game.n).slice(0, 40)) if (/^[a-z0-9-]{1,40}$/.test(k)) s.game.n[k] = int(v);
  }
  if (Array.isArray(o.log)) {
    s.log = o.log.filter((e) => e && typeof e.id === 'string' && ID_RE.test(e.id))
      .map((e) => ({ id: e.id, src: typeof e.src === 'string' ? e.src.slice(0, 60) : '', t: int(e.t), shown: e.shown ? 1 : 0, seen: e.seen ? 1 : 0 }))
      .slice(-LOG_MAX);
  }
  return s;
}
function write(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; }
}
// The starter accessories every child owns (keep in sync with STARTER_ITEMS in
// krabsy-shells.js; copied, not imported, so an older cached krabsy-shells.js can't break this).
const STARTER_ITEMS = ['hat:cap', 'glasses:round', 'back:pack', 'back:capeKnight'];
function readShells() {
  const o = readJson(SHELLS_KEY) || {};
  const owned = Array.isArray(o.owned) ? o.owned.filter((x) => typeof x === 'string' && ID_RE.test(x)) : [];
  return { raw: o, earned: Math.max(int(o.earned), int(o.balance)), owned: [...new Set([...STARTER_ITEMS, ...owned])] };
}
/** Add ids to krabsy_shells_v1.owned, keeping every other field as it is. */
function addOwned(ids) {
  try {
    const o = readJson(SHELLS_KEY) || { v: 1, balance: 0, earned: 0 };
    const owned = Array.isArray(o.owned) ? o.owned.filter((x) => typeof x === 'string') : [];
    for (const id of ids) if (!owned.includes(id)) owned.push(id);
    o.owned = owned;
    localStorage.setItem(SHELLS_KEY, JSON.stringify(o));
    return true;
  } catch (_) { return false; }
}
function announce(gifts) {
  try { window.dispatchEvent(new CustomEvent('krabsy:gift', { detail: { gifts } })); } catch (_) { /* no window */ }
}

/* ── what the child has done (read from the other modules' storage) ──────── */
function progress() {
  const out = { right: 0, safe: 0, topics: 0, diplom: { bronze: false, silver: false, gold: false } };
  const st = readJson(STATS_KEY);
  if (st && st.overall) out.right = int(st.overall.total_correct);
  if (st && st.items && typeof st.items === 'object') {
    for (const [topic, items] of Object.entries(st.items)) {
      if (!items || typeof items !== 'object') continue;
      let any = false;
      for (const forms of Object.values(items)) {
        const f = Object.values(forms || {}).filter((r) => r && r.attempts > 0);
        if (!f.length) continue;
        any = true;
        const complete = topic !== 'irregular_verbs' || f.length >= 2;      // a verb: both forms
        if (complete && f.every((r) => (r.mastery || 0) >= SAFE_MASTERY)) out.safe++;
      }
      if (any) out.topics++;
    }
  }
  const dp = readJson(DIPLOM_KEY);
  if (dp) for (const k of Object.keys(out.diplom)) out.diplom[k] = !!(dp[k] && dp[k].passed);
  return out;
}
function milestoneValue(m, p) {
  if (m.type === 'diplom') return p.diplom[m.level] ? 1 : 0;
  return p[m.type] || 0;
}

/* ── picking a gift ─────────────────────────────────────────────────────── */
function currentChar() {
  const f = readJson(FIGURE_KEY);
  return f && CHAR_IDS.includes(f.char) ? f.char : FREE_CHARS[0];
}
/** Can the child's current figure wear this entry? (A figure always "fits".) */
function fits(id, char) {
  const it = parseId(id);
  if (!it) return false;
  if (it.slot === 'char') return true;
  if (it.slot === 'hat' && NO_HAT.includes(char)) return false;       // a head no other hat fits
  return sourceChar(it.slot, it.key) !== char;                         // it wears this one already
}
const isOwned = (id, owned) => {
  const it = parseId(id);
  return !it || (it.slot === 'char' && FREE_CHARS.includes(it.key)) || owned.includes(id);
};
const rarity = (id) => { const it = parseId(id); return (it && PRICES[it.slot][it.key]) || 100; };

/**
 * A random entry the child doesn't own, or null when it owns everything.
 *   kind   'char' | 'item' | undefined: what it should be if possible
 *   fit    true (a gift that comes alone): accessories that fit the child's current figure
 *          are 5 × as likely as the others, so "Anziehen" mostly works. (Every accessory
 *          fits at least one of the 12 free figures, so no gift is ever useless; a hat for
 *          a child whose figure can't wear hats is just less likely.)
 *   first  the child's first gift ever: a figure
 * Rarity = the old shop price: within figures and within accessories the chance is
 * (cheapest / price)², so simple things come first and the rare ones stay special.
 * Without `kind`: a figure with 40 %, an accessory with 60 %.
 */
function pickRandom(owned, { kind, fit, first, rng = Math.random } = {}) {
  const left = GIFT_IDS.filter((id) => !isOwned(id, owned));
  if (!left.length) return null;
  const char = currentChar();
  const chars = left.filter((id) => id.startsWith('char:'));
  const items = left.filter((id) => !id.startsWith('char:'));
  let want = kind || (first ? 'char' : (rng() < 0.4 ? 'char' : 'item'));
  let pool = want === 'char' ? chars : items;
  if (!pool.length) pool = want === 'char' ? items : chars;
  if (!pool.length) pool = left;
  const min = Math.min(...pool.map(rarity));
  const w = pool.map((id) => (min / rarity(id)) ** 2 * (fit && !fits(id, char) ? UNFIT_WEIGHT : 1));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

/** true when the child's current figure can wear this entry (a figure always fits). */
export function giftFits(id) {
  try { return fits(id, currentChar()); } catch (_) { return false; }
}
/** What a game or the popup needs to show an entry: { id, slot, key, name, image }. */
export function giftInfo(id, lang) {
  const it = parseId(id);
  if (!it) return null;
  return { id, slot: it.slot, key: it.key, name: itemName(it.slot, it.key, lang || currentLang()), image: itemImage(it.slot, it.key) };
}

/* ── the rules ──────────────────────────────────────────────────────────── */
// Grants everything that is due. `s` = rewards state (changed in place), returns the new
// log entries. `full`: also check the milestones (reads the stats blob).
function settle(s, full) {
  const sh = readShells();
  const owned = sh.owned.slice();
  const fresh = [];
  const give = (src, kind) => {
    const id = pickRandom(owned, { kind, fit: fresh.length === 0, first: !s.log.length && !owned.length && !fresh.length });
    if (!id) return false;
    owned.push(id);
    fresh.push({ id, src, t: Date.now(), shown: 0, seen: 0 });
    return true;
  };
  const dueShells = Math.floor(sh.earned / SHELLS_PER_GIFT);

  if (!s.init && !sh.earned && !sh.owned.length && !readJson(STATS_KEY)) {
    // A visitor who never answered anything: nothing to give, nothing is stored.
  } else if (!s.init) {
    // First run. A child who already practised gets what the shells and milestones so far
    // are worth, but at most FIRST_RUN_MAX gifts at once; all of it then counts as given.
    s.init = true;
    const p = progress();
    const due = [];
    for (let i = 0; i < dueShells; i++) due.push(['shells', undefined]);
    for (const m of MILESTONES) if (milestoneValue(m, p) >= m.n) { due.push([m.key, m.kind]); s.done.push(m.key); }
    for (const [src, kind] of due.slice(0, FIRST_RUN_MAX)) give(src, kind);
    s.shellGifts = dueShells;
  } else {
    // (guard: never more than 3 shell gifts in one go, e.g. after an edited save)
    let n = 0;
    while (s.shellGifts < dueShells && n < 3) { s.shellGifts++; n++; give('shells'); }
    if (s.shellGifts < dueShells) s.shellGifts = dueShells;
    if (full) {
      const todo = MILESTONES.filter((m) => !s.done.includes(m.key));
      if (todo.length) {
        const p = progress();
        for (const m of todo) if (milestoneValue(m, p) >= m.n) { s.done.push(m.key); give(m.key, m.kind); }
      }
    }
  }
  // Practice days and weeks (counted in noteAnswer).
  for (const n of DAY_GOALS) {
    const key = `days:${n}`;
    if (s.days >= n && !s.done.includes(key)) { s.done.push(key); give(key, n >= 14 ? 'char' : undefined); }
  }
  if (s.weeks >= 2) {
    const key = `week:${s.lastWeek}`;
    if (!s.done.includes(key)) {
      s.done = s.done.filter((k) => !k.startsWith('week:'));          // only the last week is kept
      s.done.push(key); give('week');
    }
  }
  if (fresh.length) { if (!addOwned(fresh.map((e) => e.id))) return []; s.log = [...s.log, ...fresh].slice(-LOG_MAX); }
  return fresh;
}

function run(full, answered) {
  try {
    const s = read();
    const before = JSON.stringify(s);
    if (answered) {
      s.dayAnswers += 1;
      if (s.dayAnswers >= DAY_ANSWERS && s.lastDay !== s.day) {
        s.lastDay = s.day; s.days += 1;
        const w = weekOf();
        if (w !== s.lastWeek) { s.lastWeek = w; s.weeks += 1; }
      }
    }
    const fresh = settle(s, full || !s.init || (answered && s.dayAnswers % 5 === 0));
    if (JSON.stringify(s) !== before && !write(s)) return [];
    if (fresh.length) announce(fresh.map((e) => e.id));
    return fresh.map((e) => ({ ...giftInfo(e.id), source: e.src }));
  } catch (_) { return []; }
}

/** Give everything that is due now. Returns the new gifts ([] most of the time). Called on
    every site page (by the header counter) and after answers. */
export function syncRewards() { return run(true, false); }

/** One answer was recorded (called by recordAttempt in krabsy-stats.js, right or wrong:
    practising counts). Returns the gifts this answer earned. */
export function noteAnswer() { return run(false, true); }

/**
 * A gift found in a game.
 *   grantGift({ source: 'verb-dungeon', id: 'hat:wizard' })   this entry
 *   grantGift({ source: 'verb-dungeon' })                     a random one ({ kind: 'char' | 'item' } optional)
 * → { ok: true, id, slot, key, name, image, source }  the child owns it now
 *   { ok: false, reason: 'owned' | 'limit' | 'nothing' | 'unknown' | 'storage', … }
 * At most GAME_GIFTS_PER_DAY gifts per game and calendar day. Never throws.
 */
export function grantGift({ source, id, kind } = {}) {
  try {
    const src = String(source || 'game').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'game';
    const s = read();
    const owned = readShells().owned;
    if (id != null && !parseId(id)) return { ok: false, reason: 'unknown' };
    if (id != null && isOwned(id, owned)) return { ok: false, reason: 'owned', ...giftInfo(id) };
    if ((s.game.n[src] || 0) >= GAME_GIFTS_PER_DAY) return { ok: false, reason: 'limit' };
    const got = id != null ? id : pickRandom(owned, { kind: kind === 'char' || kind === 'item' ? kind : undefined, fit: true });
    if (!got) return { ok: false, reason: 'nothing' };
    if (!addOwned([got])) return { ok: false, reason: 'storage' };
    s.game.n[src] = (s.game.n[src] || 0) + 1;
    s.log = [...s.log, { id: got, src: `game:${src}`, t: Date.now(), shown: 0, seen: 0 }].slice(-LOG_MAX);
    write(s);
    announce([got]);
    return { ok: true, ...giftInfo(got), source: `game:${src}` };
  } catch (_) { return { ok: false, reason: 'storage' }; }
}

/**
 * What a game may show BEFORE it gives the gift (in the chest, on the flag …): the entry
 * grantGift would give. With `id`: that entry, or null when the child owns it already.
 * Without: a random one. null also when this game gave its gifts for today. Give exactly
 * this entry afterwards: grantGift({ source, id: gift.id }).
 */
export function pickGift({ source, id, kind } = {}) {
  try {
    const src = String(source || 'game').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'game';
    if ((read().game.n[src] || 0) >= GAME_GIFTS_PER_DAY) return null;
    const owned = readShells().owned;
    if (id != null) return parseId(id) && !isOwned(id, owned) ? giftInfo(id) : null;
    const got = pickRandom(owned, { kind: kind === 'char' || kind === 'item' ? kind : undefined, fit: true });
    return got ? giftInfo(got) : null;
  } catch (_) { return null; }
}

/** true when the child owns this entry ("hat:wizard"); the free figures count. */
export function ownsGift(id) {
  try { return !!parseId(id) && isOwned(id, readShells().owned); } catch (_) { return false; }
}

/* ── for the pages ──────────────────────────────────────────────────────── */
/**
 * Everything the figure page, the profile and the header show:
 * { earned, perGift, into, toNext,                     shells towards the next surprise
 *   chars: { have, total }, items: { have, total },    collected
 *   recent: [{ id, slot, key, source, t }],            newest first
 *   unseen: [ids]   (the "Neu" badges),  pending: n   (gifts the popup has not shown),
 *   days, dayAnswers, weeks,
 *   goals: [{ key, type, n, have, level? }] }          the next goal of each kind
 */
export function getRewards() {
  const empty = { earned: 0, perGift: SHELLS_PER_GIFT, into: 0, toNext: SHELLS_PER_GIFT,
    chars: { have: FREE_CHARS.length, total: CHAR_IDS.length }, items: { have: 0, total: 0 },
    recent: [], unseen: [], pending: 0, days: 0, dayAnswers: 0, weeks: 0, goals: [], complete: false };
  try {
    const s = read(), sh = readShells();
    const mine = sh.owned.map(parseId).filter(Boolean);
    const out = { ...empty };
    out.earned = sh.earned;
    out.into = sh.earned % SHELLS_PER_GIFT; out.toNext = SHELLS_PER_GIFT - out.into;
    out.chars = { have: new Set([...FREE_CHARS, ...mine.filter((i) => i.slot === 'char').map((i) => i.key)]).size, total: CHAR_IDS.length };
    out.items = { have: mine.filter((i) => i.slot !== 'char').length, total: GIFT_IDS.filter((id) => !id.startsWith('char:')).length };
    out.complete = !GIFT_IDS.some((id) => !isOwned(id, sh.owned));
    out.recent = s.log.slice().reverse().map((e) => ({ ...parseId(e.id), id: e.id, source: e.src, t: e.t })).filter((e) => e.slot);
    out.unseen = [...new Set(s.log.filter((e) => !e.seen).map((e) => e.id))];
    out.pending = s.log.filter((e) => !e.shown).length;
    out.days = s.days; out.dayAnswers = s.dayAnswers; out.weeks = s.weeks;
    const p = progress();
    const next = (type) => MILESTONES.find((m) => m.type === type && !s.done.includes(m.key) && milestoneValue(m, p) < m.n);
    for (const type of ['right', 'safe', 'diplom', 'topics']) {
      const m = next(type);
      if (m) out.goals.push({ key: m.key, type, n: m.n, have: Math.min(m.n, milestoneValue(m, p)), level: m.level });
    }
    const d = DAY_GOALS.find((n) => s.days < n);
    if (d) out.goals.splice(1, 0, { key: `days:${d}`, type: 'days', n: d, have: s.days });
    return out;
  } catch (_) { return empty; }
}

/** Ids of the gifts that still carry their "Neu" badge (cheap: no stats are read). */
export function unseenGifts() {
  try { return [...new Set(read().log.filter((e) => !e.seen).map((e) => e.id))]; } catch (_) { return []; }
}

/** Cheap version for the header: { pending, unseen } (numbers), no stats are read. */
export function giftBadge() {
  try {
    const log = read().log;
    return { pending: log.filter((e) => !e.shown).length, unseen: log.filter((e) => !e.seen).length };
  } catch (_) { return { pending: 0, unseen: 0 }; }
}

/** The gifts the popup has not shown yet (oldest first); they count as shown from now on. */
export function takePending() {
  try {
    const s = read();
    const list = s.log.filter((e) => !e.shown);
    if (!list.length) return [];
    for (const e of s.log) e.shown = 1;
    write(s);
    return list.map((e) => ({ ...giftInfo(e.id), source: e.src }));
  } catch (_) { return []; }
}

/** The child has seen these entries on the figure page: their "Neu" badge goes. No ids = all. */
export function markSeen(ids) {
  try {
    const s = read();
    let n = 0;
    for (const e of s.log) if (!e.seen && (!ids || ids.includes(e.id))) { e.seen = 1; n++; }
    if (n && write(s)) announce([]);
  } catch (_) { /* nothing to mark */ }
}

/** fn() whenever gifts or what the child owns change: here, in a game iframe, in another tab. */
export function onRewardsChange(fn) {
  const call = () => { try { fn(); } catch (_) { /* listener's problem */ } };
  const onStorage = (e) => { if (!e || e.key === KEY || e.key === SHELLS_KEY || e.key === null) call(); };
  try {
    window.addEventListener('krabsy:gift', call);
    window.addEventListener('krabsy:shells', call);
    window.addEventListener('storage', onStorage);
  } catch (_) { /* no window */ }
  return () => {
    try {
      window.removeEventListener('krabsy:gift', call);
      window.removeEventListener('krabsy:shells', call);
      window.removeEventListener('storage', onStorage);
    } catch (_) { /* no window */ }
  };
}
