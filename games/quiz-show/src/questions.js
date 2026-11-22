// Question source for the show. Uses the site question engine
// (homepage/lib/krabsy-questions.js, 'quiz' shape, 4 options, default chain order)
// when the game runs on the site or under tools/serve.py (which maps /lib and /data
// to ../../homepage). Falls back to the inline lists (src/verbs.js, src/preps.js)
// when the engine is not reachable, or with ?offline=1.
//
// A question (the show's own shape, built from either source):
//   { item, topic, form,            // form: 'past' | 'participle' | 'default'
//     kind: 'trio' | 'gap',
//     base, slots: [past|null, pp|null], askIndex,   // trio: go → ___ → ___
//     sentence,                                      // gap: 'My birthday is ___ July.'
//     answer, options[4],
//     teach,        // line shown after the answer (never the 3rd form after a 2nd-form
//                   // question that is followed by its 3rd form: chain order)
//     followUp }    // true on the 3rd-form question right after its 2nd form
// A unit is [q] or [2nd form, 3rd form] (verbs). Pairs never straddle a round.
import { VERBS } from './verbs.js';
import { PREPS } from './preps.js';
import { lang } from './i18n.js';

export const TOPICS = ['irregular_verbs', 'prepositions'];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fullLine = (c) => `${c.base} → ${c.past} → ${c.pp}`;

function fromEngine(r) {
  const q = { item: r.item, topic: r.topic, form: r.form, answer: r.answer,
    options: r.options.slice(), followUp: !!r.followUp };
  if (r.display.kind === 'trio') {
    const c = r.teach.chain;
    Object.assign(q, { kind: 'trio', base: r.display.base, askIndex: r.display.askIndex,
      slots: r.display.slots.map((s) => s.text), chain: c && { base: c.base, past: c.past, pp: c.participle },
      teach: r.teach.line });
  } else {
    // The engine writes the rule in the stored site language (krabsy_lang); the show's
    // own language may come from ?lang=, so take the inline copy in that language if any.
    const own = PREPS.find((p) => p.id === r.item), l = lang();
    Object.assign(q, { kind: 'gap', sentence: r.display.sentence,
      teach: own && (l === 'de' || l === 'es') ? own[l] : r.teach.line });
  }
  return q;
}

// Engine records come as units already (a pair = two adjacent records, the 2nd `followUp`).
function engineUnits(recs) {
  const units = [];
  for (let i = 0; i < recs.length; i++) {
    const q = fromEngine(recs[i]);
    if (q.followUp && units.length && units[units.length - 1].length === 1
        && units[units.length - 1][0].item === q.item) units[units.length - 1].push(q);
    else units.push([q]);
  }
  return units;
}

function inlineVerbUnits() {
  // First 30 inline verbs are the most common ones; take those first.
  const pool = [...shuffle(VERBS.slice(0, 30)), ...shuffle(VERBS.slice(30))];
  return pool.map((v) => {
    const chain = { base: v.v, past: v.past, pp: v.pp };
    const mk = (ask) => {
      const answer = ask === 'past' ? v.past : v.pp;
      const wrong = shuffle([...new Set((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer))]).slice(0, 3);
      return { item: v.v, topic: 'irregular_verbs', form: ask === 'past' ? 'past' : 'participle',
        kind: 'trio', base: v.v, chain, askIndex: ask === 'past' ? 0 : 1, answer,
        options: shuffle([answer, ...wrong]) };
    };
    const a = mk('past'), b = mk('pp');
    a.slots = [null, null]; a.teach = `${v.v} → ${v.past} → ___`;
    b.slots = [v.past, null]; b.teach = fullLine(chain); b.followUp = true;
    return [a, b];
  }).filter((u) => u.every((q) => q.options.length === 4));
}

function inlinePrepUnits() {
  const l = lang();
  const pool = [...shuffle(PREPS.slice(0, 17)), ...shuffle(PREPS.slice(17))];
  return pool.map((p) => [{ item: p.id, topic: 'prepositions', form: 'default', kind: 'gap',
    sentence: p.s, answer: p.a, options: shuffle([p.a, ...p.w]), teach: l === 'es' ? p.es : p.de }]);
}

// A pair cut to its 2nd-form question: then the full chain may be taught.
function single(unit) {
  const q = { ...unit[0] };
  if (q.chain) q.teach = fullLine(q.chain);
  return [q];
}

export let source = 'inline';

// counts = { r1, r2, final } in questions. Returns { r1: unit[], r2: unit[], final: unit[] }.
export async function loadShow(topic, counts) {
  let units = null;
  const offline = new URLSearchParams(location.search).has('offline');
  if (!offline) {
    try {
      const KQ = await import('/lib/krabsy-questions.js');
      // Ask for everything, then prefer the easier verb tiers (a class plays together,
      // so common verbs first). Prepositions: difficulty is per example, keep the mix.
      const recs = await KQ.getQuizSet({ topic, count: 1000, withOptions: 4 });
      units = engineUnits(recs);
      if (topic === 'irregular_verbs') {
        const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
        const t = (u) => tierOf.get(u[0].item) ?? 9;
        // tiers 1 and 2 shuffled together first, then the rest (stable sort keeps the shuffle)
        units.sort((a, b) => Math.min(t(a), 2) - Math.min(t(b), 2));
      }
      if (units.length < 8) throw new Error('too few');
      source = 'engine';
    } catch (_) { units = null; }
  }
  if (!units) {
    source = 'inline';
    units = topic === 'prepositions' ? inlinePrepUnits() : inlineVerbUnits();
  }
  // Pairs first (for rounds 1 and 2), whatever is left serves the final as singles.
  const pairs = units.filter((u) => u.length === 2);
  const singles = units.filter((u) => u.length === 1);
  const take = (n) => {
    const out = []; let filled = 0;
    const src = topic === 'irregular_verbs' && pairs.length ? pairs : singles;
    while (filled < n && (src.length || singles.length)) {
      let u = (src.length ? src : singles).shift();
      if (filled + u.length > n) u = single(u);
      out.push(u); filled += u.length;
    }
    return out;
  };
  const r1 = take(counts.r1), r2 = take(counts.r2);
  const final = [];
  while (final.length < counts.final && (singles.length || pairs.length)) {
    final.push(single(singles.length ? singles.shift() : pairs.shift()));
  }
  return { r1, r2, final };
}
