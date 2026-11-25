// Question source (adapted from Verb Dungeon's src/questions.js).
// Uses the site engine (homepage/lib/krabsy-questions.js) when the game runs on the
// site; falls back to the inline verb list in local dev (no /lib/ there).
//
// getQuizSet has no tier filter (its `difficulty` is the same for every verb), so
// all pairs are fetched once and sorted into one pool per tier using the tiers from
// getChainSet. Egg rarity → tier comes from balance.js (RARITY[r].tier).
//
// A step: { key, base, past, pp, ask: 'past' | 'pp', answer, options[3], full? }
// A pair: { base, past, pp, tier, steps: [2nd-form step, 3rd-form step] }
// Common/uncommon eggs ask only steps[0] with `full: true` (no 3rd-form question
// follows, so the feedback may show the whole chain). Rare and above ask both steps:
// chain order (owner decision 2026-11-21): the 3rd form only right after the 2nd,
// with the 2nd filled in (go → went → ___).
// Any topic (docs/game-contract.md): the topic comes from ?topic= (default
// irregular_verbs). Verbs keep the pairs above. Other topics ask sentences with one
// gap (display.kind 'gap'): a step is then { kind: 'gap', item, form, topic,
// sentence, plain, hint, answer, accepts, options, teach }; the egg's tier picks the
// sentence's difficulty (1–3), and rare+ eggs ask two different sentences instead of
// the 2nd → 3rd form pair. ?difficulty=N (difficultyFromUrl) overrides the tiers:
// every egg then draws from the engine's filtered set.
import { VERBS } from './verbs.js';
import { lang } from './i18n.js';

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fromEngine(q) {
  const c = q.teach && q.teach.chain;
  if (!c || q.display.kind !== 'trio' || q.options.length < 3) return null;
  const ask = q.display.askIndex === 0 ? 'past' : 'pp';
  return { key: `${c.base}|${ask}`, base: c.base, past: c.past, pp: c.participle, ask,
    answer: q.answer, options: q.options.slice(0, 3), accepts: q.accepts || [q.answer],
    item: q.item || c.base, form: q.form || (ask === 'past' ? 'past' : 'participle'), topic: q.topic || 'irregular_verbs' };
}
function fromEngineGap(q) {
  if (!q || !q.display || q.display.kind !== 'gap' || !q.options || q.options.length < 2) return null;
  const d = q.display;
  return { kind: 'gap', key: q.id || q.item, base: q.item || q.id, item: q.item || q.id, form: q.form || 'default', topic: q.topic,
    sentence: d.sentence, plain: d.plain || d.sentence, hint: d.hint || '', answer: q.answer, accepts: q.accepts || [q.answer],
    options: q.options.slice(0, 3), teach: (q.teach && q.teach.line) || '', difficulty: q.difficulty || 1 };
}
function fromInline(v, ask) {
  const answer = ask === 'past' ? v.past : v.pp;
  const wrong = shuffle([...new Set((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer))]).slice(0, 2);
  return { key: `${v.v}|${ask}`, base: v.v, past: v.past, pp: v.pp, ask, answer,
    options: shuffle([answer, ...wrong]) };
}
const pairOf = (q2, q3, tier) => ({ base: q2.base, past: q2.past, pp: q2.pp, tier, steps: [q2, q3] });

export let source = 'inline';
export let topic = 'irregular_verbs'; // the topic actually played
export let isVerbs = true;           // verb pairs (trio) or gap sentences
let linkDiff = null;                 // ?difficulty=N from a teacher link: overrides the egg tiers
let KQ = null;               // the engine module, if loaded
const pools = { 1: [], 2: [], 3: [] };
const queue = { 1: [], 2: [], 3: [] }; // missed verbs, asked again soon
let recent = [];             // last few questions asked (qid), to avoid repeats
// Repeat guard (docs/tutor-platform-v2.md §2.1, owner report 2026-11-25: the same
// Forest question three times in a row). Memory is per QUESTION (a gap sentence's id,
// a verb's base), a fixed window, never cleared by a small pool.
const RECENT_MAX = 8;
const qid = (p) => (p.gap ? p.steps[0].key : p.base);
const lastAsked = new Map();  // qid → turn number, to pick an item's least-recent sentence
let turn = 0;
function remember(p) {
  const id = qid(p);
  recent = [id, ...recent.filter((x) => x !== id)].slice(0, RECENT_MAX);
  lastAsked.set(id, ++turn);
}
// Too recent for this pool? The window shrinks for small pools so a pick always exists.
function isRecent(p, pool) {
  const w = Math.min(RECENT_MAX, Math.max(0, pool.length - 1));
  return recent.slice(0, w).includes(qid(p));
}
// The site's smart mix (docs/phase1-game-wiring.md): per tier a short queue of verbs
// this player should see now (still wrong / new / due again), refilled when empty, so
// answers from the last eggs count for the next ones.
const smart = { 1: [], 2: [], 3: [] }, smartBusy = {};
function refillSmart(t) {
  if (!KQ || smartBusy[t] || linkDiff) return;
  smartBusy[t] = true;
  const req = isVerbs ? KQ.getChainSet({ topic: 'irregular_verbs', tiers: [t], count: 6, smart: true }).then((set) => set.map((r) => r.verb))
    : KQ.getQuizSet({ topic, count: 8, withOptions: 3, lang, smart: true }).then((set) => set.map((q) => q.item || q.id));
  req.then((ids) => { smart[t] = ids.filter((v) => pools[t].some((p) => p.base === v)); })
    .catch(() => {})
    .finally(() => { smartBusy[t] = false; });
}

export async function init() {
  try {
    KQ = await import('/lib/krabsy-questions.js');
    topic = KQ.topicFromUrl();
    linkDiff = (KQ.difficultyFromUrl && KQ.difficultyFromUrl()) || null;
    if (topic !== 'irregular_verbs') {
      // a sentence topic: pools by difficulty (or all in every pool for a teacher's ?difficulty)
      const gaps = (await KQ.getQuizSet({ topic, count: 1000, withOptions: 3, lang })).map(fromEngineGap).filter(Boolean);
      if (gaps.length < 4) throw new Error('too few questions for ' + topic);
      for (const g of gaps) {
        const t = Math.min(3, Math.max(1, g.difficulty));
        if (linkDiff) for (const k of [1, 2, 3]) pools[k].push({ base: g.item, tier: k, gap: true, steps: [g] });
        else pools[t].push({ base: g.item, tier: t, gap: true, steps: [g] });
      }
      // A tier with fewer than 4 sentences would repeat itself: merge it into the one below.
      if (!linkDiff) for (const k of [3, 2]) {
        if (pools[k].length && pools[k].length < 4) { pools[k - 1].push(...pools[k].map((p) => ({ ...p, tier: k - 1 }))); pools[k].length = 0; }
      }
      isVerbs = false; source = 'engine';
      for (const k of [1, 2, 3]) refillSmart(k);
      return;
    }
    const set = await KQ.getQuizSet({ topic, count: 1000, withOptions: 3, lang });
    const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
    let n = 0;
    for (let i = 1; i < set.length; i++) {
      if (!set[i].followUp) continue;
      const q2 = fromEngine(set[i - 1]), q3 = fromEngine(set[i]);
      if (q2 && q3 && q2.ask === 'past' && q3.ask === 'pp' && q2.base === q3.base) {
        const t = Math.min(3, Math.max(1, tierOf.get(q2.base) || 1));
        if (linkDiff) for (const k of [1, 2, 3]) pools[k].push(pairOf(q2, q3, k)); // (a teacher's ?difficulty: the engine already filtered)
        else pools[t].push(pairOf(q2, q3, t));
        n++;
      }
    }
    if (n >= 20 && pools[1].length) { source = 'engine'; for (const t of [1, 2, 3]) refillSmart(t); return; }
  } catch (_) { /* local dev or offline */ }
  KQ = null;
  source = 'inline'; topic = 'irregular_verbs'; isVerbs = true; linkDiff = null;
  for (const t of [1, 2, 3]) pools[t].length = 0;
  // The inline list has no tiers: the first 30 verbs (most common) are tier 1,
  // the rest tier 2 and 3.
  VERBS.forEach((v, i) => {
    const t = i < 30 ? 1 : i < 40 ? 2 : 3;
    pools[t].push(pairOf(fromInline(v, 'past'), fromInline(v, 'pp'), t));
  });
}

const fresh = (q) => ({ ...q, options: shuffle(q.options.slice()) });

// The pair for an egg of the given tier. Missed questions of that tier come first
// (after at least one other egg), then the smart mix, then random ones not asked
// recently. `avoid` (a qid) is never returned when anything else exists; `noQueue`
// (the second sentence of a rare egg) leaves the missed queue alone.
export function nextPair(tier, avoid = null, noQueue = false) {
  let t = tier;
  while (t > 1 && !pools[t].length) t--;
  if (!pools[t].length) t = [1, 2, 3].find((k) => pools[k].length) || 1; // (a topic without easy sentences)
  const pool = pools[t];
  const ok = (p) => p && qid(p) !== avoid && !isRecent(p, pool);
  const q = queue[t];
  if (!noQueue) {
    const i = q.findIndex((e) => e.wait <= 0 && qid(e.pair) !== avoid && !recent.slice(0, 3).includes(qid(e.pair)));
    if (i >= 0) { const e = q.splice(i, 1)[0]; remember(e.pair); return withFresh(e.pair); }
    q.forEach((e) => e.wait--);
  }
  let pick = null;
  // the smart mix first (site only): ids are items; take that item's least-recent sentence
  while (smart[t].length && !pick) {
    const v = smart[t].shift();
    const cands = pool.filter((p) => p.base === v && ok(p));
    if (cands.length) pick = cands.sort((a, b) => (lastAsked.get(qid(a)) || 0) - (lastAsked.get(qid(b)) || 0))[0];
  }
  if (!smart[t].length) refillSmart(t);
  if (!pick) {
    const fresh = pool.filter(ok);
    const from = fresh.length ? fresh : pool.filter((p) => qid(p) !== avoid);
    const list = from.length ? from : pool;
    // prefer what was asked longest ago (never-asked first), random among equals
    const oldest = Math.min(...list.map((p) => lastAsked.get(qid(p)) || 0));
    const best = list.filter((p) => (lastAsked.get(qid(p)) || 0) === oldest);
    pick = best[Math.floor(Math.random() * best.length)];
  }
  remember(pick);
  return withFresh(pick);
}
function withFresh(p) { return { ...p, steps: p.steps.map(fresh) }; }

// A missed verb comes back on one of the next eggs of the same tier.
export function missed(pair) {
  const q = queue[pair.tier] || queue[1];
  if (!q.some((e) => qid(e.pair) === qid(pair))) q.push({ pair, wait: 2 });
}

// Steps to ask for an egg: one 2nd-form step (common/uncommon) or the pair.
// For sentence topics a rare+ egg asks two different sentences of its tier (a
// topic-neutral version of the 2nd → 3rd form pair).
export function stepsFor(pair, isPair) {
  if (pair.gap) {
    if (!isPair) return [pair.steps[0]];
    const other = nextPair(pair.tier, qid(pair), true);
    return [pair.steps[0], other.steps[0]];
  }
  return isPair ? pair.steps : [{ ...pair.steps[0], full: true }];
}

// Site statistics + spaced repetition (no-op in local dev).
let statsMod = null;
import('/lib/krabsy-stats.js').then((m) => { statsMod = m; }).catch(() => {});
export function record(step, correct) {
  try {
    if (statsMod) statsMod.recordAttempt(step.item || step.base, step.form || (step.ask === 'past' ? 'past' : 'participle'),
      correct, 'verb-hatchery', step.topic || topic);
  } catch (_) { /* never break the game */ }
}

// Test hooks (tests/repeat-test.mjs): load pools directly, inspect state.
export const _test = {
  load(gaps) { KQ = null; isVerbs = false; source = 'test'; recent = []; lastAsked.clear(); turn = 0;
    for (const k of [1, 2, 3]) { pools[k].length = 0; queue[k].length = 0; smart[k].length = 0; }
    for (const g of gaps) { const t = Math.min(3, Math.max(1, g.difficulty || 1)); pools[t].push({ base: g.item, tier: t, gap: true, steps: [g] }); }
    for (const k of [3, 2]) if (pools[k].length && pools[k].length < 4) { pools[k - 1].push(...pools[k].map((p) => ({ ...p, tier: k - 1 }))); pools[k].length = 0; } },
  pools, queue, qid,
};
