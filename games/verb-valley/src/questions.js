// Question deck shared by every station (school, well, sell crate).
//
// Source: the site question engine (homepage/lib/krabsy-questions.js, 'quiz'
// shape, topic from ?topic=) when the game runs on krabsy.com; the inline
// lists in verbs.js in local dev, where /lib/ does not exist.
//
// A UNIT is what one station visit asks:
//   verbs        → a pair: go → ___ → ___ (asks went), then go → went → ___
//                  (asks gone). Chain order, owner decision 2026-11-21.
//   other topics → a single sentence gap: My birthday is ___ July.
// unit  = { item, kind: 'pair' | 'gap', chain: {base, past, pp} | null, steps }
// step  = { display, answer, options[3], teach }
//   display = { kind: 'trio', base, slots: [text|null, text|null], askIndex }
//           | { kind: 'gap', sentence }
//   teach   = line shown after a WRONG answer (never names grammar terms).
//             On the first step of a pair it stops at "go → went → ___":
//             the next step asks the 3rd form, so it must not be revealed.
//
// Missed items live in state.school.missed (persisted). They come back as
// the first unit of the next class, and once during the same day at a
// station a few units later (Verb Kitchen's sink re-ask).

import { VERBS, PREPS } from './verbs.js';

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export let source = 'inline';
export let topic = 'irregular_verbs';
let pool = [];            // all units, by item
let order = [];           // deck order (items)
let cursor = 0;
const reask = [];         // { item, wait } — missed today, asked again soon

// ── building units ─────────────────────────────────────────────────────
function pairUnit(base, past, pp, optPast, optPp) {
  const chain = { base, past, pp };
  return {
    item: base, kind: 'pair', chain,
    steps: [
      { display: { kind: 'trio', base, slots: [null, null], askIndex: 0 },
        answer: past, options: optPast, teach: `${base} → ${past} → ___` },
      { display: { kind: 'trio', base, slots: [past, null], askIndex: 1 },
        answer: pp, options: optPp, teach: `${base} → ${past} → ${pp}` },
    ],
  };
}

function gapUnit(item, sentence, answer, options, teach) {
  return { item, kind: 'gap', chain: null,
    // teach for a gap = the sentence; quiz.js writes the answer into the gap.
    steps: [{ display: { kind: 'gap', sentence }, answer, options, teach: teach || sentence }] };
}

// Inline distractors: regularised form, the other irregular form, -s/-en.
function inlineOptions(v, ask) {
  const correct = ask === 'past' ? v.past : v.pp;
  const other = ask === 'past' ? v.pp : v.past;
  const regular = v.v.endsWith('e') ? v.v + 'd' : v.v + 'ed';
  const wrong = [];
  for (const c of [other, regular, v.v + 's', v.v + 'en', v.v + 't']) {
    if (c !== correct && !wrong.includes(c) && wrong.length < 2) wrong.push(c);
  }
  return shuffle([correct, ...wrong]);
}

function inlinePool() {
  if (topic === 'prepositions') {
    return PREPS.map((p, i) => gapUnit(`prep${i}`, p.q, p.a, shuffle(p.opts.slice(0, 3))));
  }
  // The inline list is ordered by frequency: the first half counts as tier 1.
  return VERBS.map((v, i) => ({ ...pairUnit(v.v, v.past, v.pp, inlineOptions(v, 'past'), inlineOptions(v, 'pp')),
    tier: i < VERBS.length / 2 ? 1 : 2 }));
}

async function enginePool() {
  const KQ = await import('/lib/krabsy-questions.js');
  topic = KQ.topicFromUrl();
  const set = await KQ.getQuizSet({ topic, count: 1000, withOptions: 3 });
  const out = [];
  if (topic === 'irregular_verbs') {
    const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
    for (let i = 1; i < set.length; i++) {
      if (!set[i].followUp) continue;
      const a = set[i - 1], b = set[i];
      const c = b.teach?.chain;
      if (!c || a.display.kind !== 'trio' || b.display.kind !== 'trio') continue;
      out.push({ ...pairUnit(c.base, c.past, c.participle, a.options.slice(0, 3), b.options.slice(0, 3)),
        tier: tierOf.get(c.base) ?? 9 });
    }
  } else {
    for (const q of set) {
      if (q.display.kind !== 'gap' || q.options.length < 3) continue;
      out.push(gapUnit(q.item, q.display.sentence, q.answer, q.options.slice(0, 3)));
    }
  }
  return out;
}

export async function initQuestions() {
  topic = new URLSearchParams(location.search).get('topic') || 'irregular_verbs';
  try {
    const units = await Promise.race([
      enginePool(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    if (units.length >= 8) { pool = units; source = 'engine'; }
  } catch { /* local dev / offline: inline lists */ }
  if (source !== 'engine') {
    if (topic !== 'prepositions') topic = 'irregular_verbs';
    pool = inlinePool();
  }
  // Easy first: each tier shuffled, lower tiers ahead. The deck reshuffles
  // completely once it has gone round.
  order = [...new Set(pool.map((u) => u.tier ?? 1))].sort((a, b) => a - b)
    .flatMap((t) => shuffle(pool.filter((u) => (u.tier ?? 1) === t).map((u) => u.item)));
  cursor = 0;
  return { source, topic, size: pool.length };
}

const byItem = (item) => pool.find((u) => u.item === item);

// Fresh copy with reshuffled options, so a re-asked unit doesn't repeat the
// chip positions.
function fresh(u) {
  return { ...u, steps: u.steps.map((s) => ({ ...s, options: shuffle(s.options.slice()) })) };
}

// Next unit for a station. `avoid` = items already asked in this sitting.
export function nextUnit(avoid = []) {
  // A verb missed today comes back after a few other units.
  for (const r of reask) r.wait--;
  const due = reask.findIndex((r) => r.wait <= 0 && !avoid.includes(r.item));
  if (due >= 0) {
    const [r] = reask.splice(due, 1);
    const u = byItem(r.item);
    if (u) return { ...fresh(u), isReview: true };
  }
  for (let guard = 0; guard < order.length; guard++) {
    const item = order[cursor];
    cursor = (cursor + 1) % order.length;
    if (cursor === 0) shuffle(order);
    if (!avoid.includes(item)) return fresh(byItem(item));
  }
  return fresh(pool[0]);
}

// The class opens with yesterday's misses (up to `max` units).
export function reviewUnits(state, max) {
  const out = [];
  for (const item of state.school.missed) {
    const u = byItem(item);
    if (u) out.push({ ...fresh(u), isReview: true });
    if (out.length >= max) break;
  }
  return out;
}

// Book-keeping after one answered step. Returns nothing; mutates state.
export function recordStep(state, unit, stepIndex, correct) {
  const today = state.today;
  today.asked += 1;
  if (correct) today.correct += 1;
  if (!correct) {
    if (!state.school.missed.includes(unit.item)) state.school.missed.push(unit.item);
    if (!today.missed.includes(unit.item)) today.missed.push(unit.item);
    if (!reask.some((r) => r.item === unit.item)) reask.push({ item: unit.item, wait: 3 });
  }
}

// After a whole unit: a review item answered fully right graduates.
export function recordUnit(state, unit, allCorrect) {
  if (allCorrect && unit.isReview) {
    state.school.missed = state.school.missed.filter((m) => m !== unit.item);
    const k = reask.findIndex((r) => r.item === unit.item);
    if (k >= 0) reask.splice(k, 1);
  }
}

// New day: today's re-ask queue is dropped; the class review takes over.
export function resetDay() { reask.length = 0; }

// The line the sleep card shows for a missed item.
export function chainLine(item) {
  const u = byItem(item);
  if (!u) return item;
  if (u.chain) return `${u.chain.base} → ${u.chain.past} → ${u.chain.pp}`;
  return u.steps[0].teach;
}

export const _qa = { get pool() { return pool; }, get reask() { return reask; } };
