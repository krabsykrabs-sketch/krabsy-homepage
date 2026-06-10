// Curated question bank for Professor Krabsy's class. Irregular verbs ordered
// roughly by frequency, plus a dozen preposition items for lesson variety.
// Forms verified against the canonical content/irregular-verbs.json catalogue.

export const VERBS = [
  { v: 'be',    past: 'was',    pp: 'been' },
  { v: 'have',  past: 'had',    pp: 'had' },
  { v: 'do',    past: 'did',    pp: 'done' },
  { v: 'go',    past: 'went',   pp: 'gone' },
  { v: 'say',   past: 'said',   pp: 'said' },
  { v: 'get',   past: 'got',    pp: 'gotten' },
  { v: 'make',  past: 'made',   pp: 'made' },
  { v: 'see',   past: 'saw',    pp: 'seen' },
  { v: 'come',  past: 'came',   pp: 'come' },
  { v: 'know',  past: 'knew',   pp: 'known' },
  { v: 'take',  past: 'took',   pp: 'taken' },
  { v: 'give',  past: 'gave',   pp: 'given' },
  { v: 'find',  past: 'found',  pp: 'found' },
  { v: 'think', past: 'thought',pp: 'thought' },
  { v: 'tell',  past: 'told',   pp: 'told' },
  { v: 'become',past: 'became', pp: 'become' },
  { v: 'show',  past: 'showed', pp: 'shown' },
  { v: 'leave', past: 'left',   pp: 'left' },
  { v: 'feel',  past: 'felt',   pp: 'felt' },
  { v: 'put',   past: 'put',    pp: 'put' },
  { v: 'bring', past: 'brought',pp: 'brought' },
  { v: 'begin', past: 'began',  pp: 'begun' },
  { v: 'keep',  past: 'kept',   pp: 'kept' },
  { v: 'hold',  past: 'held',   pp: 'held' },
  { v: 'write', past: 'wrote',  pp: 'written' },
  { v: 'eat',   past: 'ate',    pp: 'eaten' },
  { v: 'run',   past: 'ran',    pp: 'run' },
  { v: 'speak', past: 'spoke',  pp: 'spoken' },
  { v: 'drink', past: 'drank',  pp: 'drunk' },
  { v: 'drive', past: 'drove',  pp: 'driven' },
  { v: 'swim',  past: 'swam',   pp: 'swum' },
  { v: 'sing',  past: 'sang',   pp: 'sung' },
  { v: 'ring',  past: 'rang',   pp: 'rung' },
  { v: 'fly',   past: 'flew',   pp: 'flown' },
  { v: 'grow',  past: 'grew',   pp: 'grown' },
  { v: 'throw', past: 'threw',  pp: 'thrown' },
  { v: 'break', past: 'broke',  pp: 'broken' },
  { v: 'choose',past: 'chose',  pp: 'chosen' },
  { v: 'sleep', past: 'slept',  pp: 'slept' },
  { v: 'buy',   past: 'bought', pp: 'bought' },
  { v: 'catch', past: 'caught', pp: 'caught' },
  { v: 'teach', past: 'taught', pp: 'taught' },
];

export const PREPS = [
  { q: 'My birthday is ___ July.',          a: 'in', opts: ['in', 'on', 'at'] },
  { q: 'School starts ___ Monday.',         a: 'on', opts: ['on', 'in', 'at'] },
  { q: 'The bell rings ___ 8 o’clock.',a: 'at', opts: ['at', 'on', 'in'] },
  { q: 'We meet ___ the morning.',          a: 'in', opts: ['in', 'on', 'at'] },
  { q: 'The cat sleeps ___ the bed.',       a: 'on', opts: ['on', 'in', 'under'] },
  { q: 'The seeds are ___ the box.',        a: 'in', opts: ['in', 'on', 'at'] },
  { q: 'She was born ___ 2012.',            a: 'in', opts: ['in', 'on', 'at'] },
  { q: 'We go skiing ___ winter.',          a: 'in', opts: ['in', 'on', 'at'] },
  { q: 'Meet me ___ the bus stop.',         a: 'at', opts: ['at', 'in', 'on'] },
  { q: 'The picture hangs ___ the wall.',   a: 'on', opts: ['on', 'in', 'at'] },
  { q: 'I’ll see you ___ the weekend.',a: 'at', opts: ['at', 'in', 'on'] },
  { q: 'The frog sat ___ the pond.',        a: 'in', opts: ['in', 'on', 'at'] },
];

// Plausible wrong forms for a verb question. Mixes regularized forms, swapped
// past/participle, and a near-neighbour so distractors aren't gimmes.
function verbDistractors(verb, form) {
  const correct = form === 'past' ? verb.past : verb.pp;
  const other = form === 'past' ? verb.pp : verb.past;
  const regular = verb.v.endsWith('e') ? verb.v + 'd' : verb.v + 'ed';
  const pool = [other, regular, verb.v + 'ed', verb.v + 's', verb.v + 'en'];
  const out = [];
  for (const c of pool) {
    if (c !== correct && !out.includes(c) && out.length < 2) out.push(c);
  }
  // Guarantee two distractors.
  let i = 0;
  while (out.length < 2) { const c = verb.v + (['t', 'n', 'd'][i++] || 'x'); if (c !== correct && !out.includes(c)) out.push(c); }
  return out;
}

// Build one class's worth of questions. `count` questions, optionally led by a
// review question drawn from `reviewVerb` (a verb string the player missed).
// `seedRandom` is a 0..1 function so QA can make classes deterministic.
export function buildClass(count, reviewVerb, rng = Math.random) {
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const questions = [];

  const makeVerbQ = (verb, form, isReview = false) => {
    const correct = form === 'past' ? verb.past : verb.pp;
    const formWord = form === 'past' ? 'simple past' : 'past participle';
    const chips = shuffle([correct, ...verbDistractors(verb, form)]);
    return {
      kind: 'verb', verb: verb.v, form, isReview,
      prompt: `${formWord} of ${verb.v.toUpperCase()}?`,
      chain: `${verb.v} → ${verb.past} → ${verb.pp}`,
      chips, correct,
      color: form === 'past' ? 'teal' : 'coral',
    };
  };

  const makePrepQ = (p) => {
    const chips = shuffle(p.opts.slice(0, 3));
    return { kind: 'prep', prompt: p.q, chips, correct: p.a, color: 'amber',
             chain: `Correct: ${p.a}` };
  };

  // Lead with a review question if we have one and the verb is known.
  if (reviewVerb) {
    const v = VERBS.find((x) => x.v === reviewVerb);
    if (v) questions.push(makeVerbQ(v, rng() < 0.5 ? 'past' : 'pp', true));
  }

  const usedVerbs = new Set(reviewVerb ? [reviewVerb] : []);
  while (questions.length < count) {
    // ~1 in 4 is a preposition lesson for variety.
    if (rng() < 0.25) {
      questions.push(makePrepQ(pick(PREPS)));
    } else {
      let v = pick(VERBS), guard = 0;
      while (usedVerbs.has(v.v) && guard++ < 10) v = pick(VERBS);
      usedVerbs.add(v.v);
      questions.push(makeVerbQ(v, rng() < 0.5 ? 'past' : 'pp'));
    }
  }
  return questions.slice(0, count);
}
