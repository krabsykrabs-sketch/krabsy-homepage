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
import { VERBS } from './verbs.js';

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
    answer: q.answer, options: q.options.slice(0, 3) };
}
function fromInline(v, ask) {
  const answer = ask === 'past' ? v.past : v.pp;
  const wrong = shuffle([...new Set((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer))]).slice(0, 2);
  return { key: `${v.v}|${ask}`, base: v.v, past: v.past, pp: v.pp, ask, answer,
    options: shuffle([answer, ...wrong]) };
}
const pairOf = (q2, q3, tier) => ({ base: q2.base, past: q2.past, pp: q2.pp, tier, steps: [q2, q3] });

export let source = 'inline';
let KQ = null;               // the engine module, if loaded
const pools = { 1: [], 2: [], 3: [] };
const queue = { 1: [], 2: [], 3: [] }; // missed verbs, asked again soon
let recent = [];             // last few bases, to avoid repeats

export async function init() {
  try {
    KQ = await import('/lib/krabsy-questions.js');
    const topic = KQ.topicFromUrl();
    if (topic !== 'irregular_verbs') throw new Error('only verbs so far');
    const set = await KQ.getQuizSet({ topic, count: 1000, withOptions: 3 });
    const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
    let n = 0;
    for (let i = 1; i < set.length; i++) {
      if (!set[i].followUp) continue;
      const q2 = fromEngine(set[i - 1]), q3 = fromEngine(set[i]);
      if (q2 && q3 && q2.ask === 'past' && q3.ask === 'pp' && q2.base === q3.base) {
        const t = Math.min(3, Math.max(1, tierOf.get(q2.base) || 1));
        pools[t].push(pairOf(q2, q3, t)); n++;
      }
    }
    if (n >= 20 && pools[1].length) { source = 'engine'; return; }
  } catch (_) { /* local dev or offline */ }
  KQ = null;
  source = 'inline';
  for (const t of [1, 2, 3]) pools[t].length = 0;
  // The inline list has no tiers: the first 30 verbs (most common) are tier 1,
  // the rest tier 2 and 3.
  VERBS.forEach((v, i) => {
    const t = i < 30 ? 1 : i < 40 ? 2 : 3;
    pools[t].push(pairOf(fromInline(v, 'past'), fromInline(v, 'pp'), t));
  });
}

const fresh = (q) => ({ ...q, options: shuffle(q.options.slice()) });

// The pair for an egg of the given tier. Missed verbs of that tier come first
// (after at least one other egg), then random ones not asked recently.
export function nextPair(tier) {
  let t = tier;
  while (t > 1 && !pools[t].length) t--;
  const q = queue[t];
  if (q.length && q[0].wait <= 0) return withFresh(q.shift().pair);
  q.forEach((e) => e.wait--);
  const pool = pools[t];
  let pick = null;
  for (let tries = 0; tries < 8; tries++) {
    pick = pool[Math.floor(Math.random() * pool.length)];
    if (!recent.includes(pick.base)) break;
  }
  recent = [pick.base, ...recent].slice(0, Math.min(8, Math.floor(pool.length / 2)));
  return withFresh(pick);
}
function withFresh(p) { return { ...p, steps: p.steps.map(fresh) }; }

// A missed verb comes back on one of the next eggs of the same tier.
export function missed(pair) {
  const q = queue[pair.tier] || queue[1];
  if (!q.some((e) => e.pair.base === pair.base)) q.push({ pair, wait: 1 });
}

// Steps to ask for an egg: one 2nd-form step (common/uncommon) or the pair.
export function stepsFor(pair, isPair) {
  return isPair ? pair.steps : [{ ...pair.steps[0], full: true }];
}

// Site statistics + spaced repetition (no-op in local dev).
let statsMod = null;
import('/lib/krabsy-stats.js').then((m) => { statsMod = m; }).catch(() => {});
export function record(step, correct) {
  try {
    if (statsMod) statsMod.recordAttempt(step.base, step.ask === 'past' ? 'past' : 'participle',
      correct, 'verb-hatchery', 'irregular_verbs');
  } catch (_) { /* never break the game */ }
}
