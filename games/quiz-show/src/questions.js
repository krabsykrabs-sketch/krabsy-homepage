// Builds the quiz for a room, in the teacher's browser. Uses the site question engine
// (homepage/lib/krabsy-questions.js, 'quiz' shape, 4 options, default chain order); falls
// back to the inline lists (src/verbs.js, src/preps.js) when the engine is not reachable
// or with ?offline=1. The room server (api/quiz_room.py) gets the list as it is.
//
// A question (server format):
//   { kind: 'trio' | 'gap',
//     base, slots: [past|null, pp|null], askIndex,   // trio: go → ___ → ___
//     sentence,                                      // gap: 'My birthday is ___ July.'
//     options[4], correct (index),
//     teach,      // after-answer line; never the 3rd form after a 2nd-form question
//                 // whose 3rd form comes next (chain order)
//     item, topic, form, followUp, chain? {base, past, pp} (for the review) }
// Verb questions come in units: [2nd form] or [2nd form, 3rd form]. A unit is never split.
import { VERBS } from './verbs.js';
import { PREPS } from './preps.js';
import { lang } from './i18n.js';

export const TOPICS = ['irregular_verbs', 'prepositions', 'en_present_simple', 'en_present_progressive', 'en_simple_past', 'en_present_perfect', 'es_ser', 'es_estar', 'es_ser_estar', 'es_tener'];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fullLine = (c) => `${c.base} → ${c.past} → ${c.pp}`;

function withCorrect(q, options, answer) {
  return { ...q, options, correct: options.indexOf(answer) };
}

function fromEngine(r) {
  const base = { item: r.item, topic: r.topic, form: r.form, followUp: !!r.followUp };
  if (r.display.kind === 'trio') {
    const c = r.teach.chain;
    return withCorrect({ ...base, kind: 'trio', base: r.display.base, askIndex: r.display.askIndex,
      slots: r.display.slots.map((s) => s.text), teach: r.teach.line || '',
      chain: c ? { base: c.base, past: c.past, pp: c.participle } : undefined }, r.options.slice(), r.answer);
  }
  // The engine writes the rule in the stored site language (krabsy_lang); the room's own
  // language may come from ?lang=, so take the inline copy in that language if there is one.
  const own = PREPS.find((p) => p.id === r.item), l = lang();
  return withCorrect({ ...base, kind: 'gap', sentence: r.display.sentence,
    teach: own && (l === 'de' || l === 'es') ? own[l] : (r.teach.line || '') }, r.options.slice(), r.answer);
}

function engineUnits(recs) {
  const units = [];
  for (const r of recs) {
    const q = fromEngine(r);
    const last = units[units.length - 1];
    if (q.followUp && last && last.length === 1 && last[0].item === q.item) last.push(q);
    else units.push([q]);
  }
  return units;
}

function inlineVerbUnits(tiers) {
  // The inline list has no tiers: its first 30 verbs are the most common ones (≈ tier 1).
  const pool = !tiers || tiers.includes(1) ? VERBS.slice() : VERBS.slice(30);
  return shuffle(pool).map((v) => {
    const chain = { base: v.v, past: v.past, pp: v.pp };
    const mk = (ask) => {
      const answer = ask === 'past' ? v.past : v.pp;
      const wrong = shuffle([...new Set((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer))]).slice(0, 3);
      return withCorrect({ item: v.v, topic: 'irregular_verbs', form: ask === 'past' ? 'past' : 'participle',
        kind: 'trio', base: v.v, chain, askIndex: ask === 'past' ? 0 : 1 }, shuffle([answer, ...wrong]), answer);
    };
    const a = mk('past'), b = mk('pp');
    a.slots = [null, null]; a.teach = `${v.v} → ${v.past} → ___`;
    b.slots = [v.past, null]; b.teach = fullLine(chain); b.followUp = true;
    return [a, b];
  }).filter((u) => u.every((q) => q.options.length === 4 && q.correct >= 0));
}

function inlinePrepUnits(levels) {
  const l = lang();
  const pool = PREPS.filter((p) => !levels || levels.includes(p.l));
  return shuffle(pool.slice()).map((p) => [withCorrect({ item: p.id, topic: 'prepositions', form: 'default',
    kind: 'gap', sentence: p.s, teach: l === 'es' ? p.es : p.de }, shuffle([p.a, ...p.w]), p.a)]);
}

export let source = 'inline';

// Units for a topic and difficulty (verb tiers 1–3 / preposition levels 1–3).
export async function loadUnits(topic, levels) {
  const offline = new URLSearchParams(location.search).has('offline');
  if (!offline) {
    try {
      const KQ = await import('/lib/krabsy-questions.js');
      let units;
      if (topic === 'irregular_verbs') {
        units = engineUnits(await KQ.getQuizSet({ topic, count: 1000, withOptions: 4 }));
        const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
        units = units.filter((u) => !levels || levels.includes(tierOf.get(u[0].item) ?? 3));
      } else {
        units = engineUnits(await KQ.getQuizSet({ topic, count: 1000, withOptions: 4, difficulty: levels, lang: lang() }));
      }
      units = units.filter((u) => u.every((q) => q.correct >= 0));
      if (units.length >= 3) { source = 'engine'; return units; }
    } catch (_) { /* local file or offline: inline lists */ }
  }
  source = 'inline';
  if (topic === 'prepositions') return inlinePrepUnits(levels);
  if (topic === 'irregular_verbs') return inlineVerbUnits(levels);
  return []; // newer topics have no inline copy: they need the site engine
}

// A pair cut to its 2nd-form question: then the full chain may be taught.
export function single(unit) {
  const q = { ...unit[0] };
  if (q.chain) q.teach = fullLine(q.chain);
  return [q];
}

// `count` questions from the units; pairs are never split (a pair that doesn't fit is
// cut to its 2nd-form question, which then teaches the whole chain).
export function takeQuestions(units, count) {
  const out = [];
  let filled = 0;
  for (const u0 of units) {
    if (filled >= count) break;
    const u = filled + u0.length > count ? single(u0) : u0;
    out.push(...u); filled += u.length;
  }
  return out;
}
