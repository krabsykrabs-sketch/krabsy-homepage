// Curated subset of the canonical Krabsy irregular-verb catalogue
// (content/irregular-verbs.json — forms match, e.g. British get→got→got).
import { pick, shuffle } from './utils.js';

export const VERBS = [
  { v: 'go', past: 'went', pp: 'gone' },
  { v: 'see', past: 'saw', pp: 'seen' },
  { v: 'eat', past: 'ate', pp: 'eaten' },
  { v: 'run', past: 'ran', pp: 'run' },
  { v: 'come', past: 'came', pp: 'come' },
  { v: 'make', past: 'made', pp: 'made' },
  { v: 'say', past: 'said', pp: 'said' },
  { v: 'take', past: 'took', pp: 'taken' },
  { v: 'give', past: 'gave', pp: 'given' },
  { v: 'know', past: 'knew', pp: 'known' },
  { v: 'find', past: 'found', pp: 'found' },
  { v: 'feel', past: 'felt', pp: 'felt' },
  { v: 'get', past: 'got', pp: 'got' },
  { v: 'hold', past: 'held', pp: 'held' },
  { v: 'keep', past: 'kept', pp: 'kept' },
  { v: 'leave', past: 'left', pp: 'left' },
  { v: 'lose', past: 'lost', pp: 'lost' },
  { v: 'meet', past: 'met', pp: 'met' },
  { v: 'pay', past: 'paid', pp: 'paid' },
  { v: 'sleep', past: 'slept', pp: 'slept' },
  { v: 'stand', past: 'stood', pp: 'stood' },
  { v: 'win', past: 'won', pp: 'won' },
  { v: 'tell', past: 'told', pp: 'told' },
  { v: 'think', past: 'thought', pp: 'thought' },
  { v: 'bring', past: 'brought', pp: 'brought' },
  { v: 'buy', past: 'bought', pp: 'bought' },
  { v: 'catch', past: 'caught', pp: 'caught' },
  { v: 'teach', past: 'taught', pp: 'taught' },
  { v: 'fight', past: 'fought', pp: 'fought' },
  { v: 'break', past: 'broke', pp: 'broken' },
  { v: 'speak', past: 'spoke', pp: 'spoken' },
  { v: 'write', past: 'wrote', pp: 'written' },
  { v: 'ride', past: 'rode', pp: 'ridden' },
  { v: 'wear', past: 'wore', pp: 'worn' },
  { v: 'throw', past: 'threw', pp: 'thrown' },
  { v: 'drink', past: 'drank', pp: 'drunk' },
  { v: 'swim', past: 'swam', pp: 'swum' },
  { v: 'sing', past: 'sang', pp: 'sung' },
  { v: 'begin', past: 'began', pp: 'begun' },
  { v: 'fly', past: 'flew', pp: 'flown' },
  { v: 'draw', past: 'drew', pp: 'drawn' },
  { v: 'fall', past: 'fell', pp: 'fallen' },
];

const byName = Object.fromEntries(VERBS.map((x) => [x.v, x]));
const names = (list) => list.map((n) => byName[n]);

export const POOL_EASY = names(['go', 'see', 'eat', 'run', 'come', 'make', 'say']);
export const POOL_MEDIUM = names(['take', 'give', 'know', 'find', 'feel', 'get', 'hold',
  'keep', 'leave', 'lose', 'meet', 'pay', 'sleep', 'stand', 'win', 'tell']);
export const POOL_HARD = names(['think', 'bring', 'buy', 'catch', 'teach', 'fight', 'break',
  'speak', 'write', 'ride', 'wear', 'throw', 'drink', 'swim', 'sing', 'begin', 'fly', 'draw', 'fall']);
// hard verbs whose past ≠ participle (good for the rune-door puzzle)
export const POOL_DISTINCT = names(['break', 'speak', 'write', 'ride', 'wear', 'throw',
  'drink', 'swim', 'sing', 'begin', 'fly', 'draw', 'fall']);

// what a learner would produce if the verb were regular: "goed", "runned", "thinked"
export function regularize(v) {
  if (v.endsWith('e')) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  if (/^[a-z]{2,4}$/.test(v) && /[aeiou][bdgmnprt]$/.test(v) && !/[aeiou]{2}[bdgmnprt]$/.test(v))
    return v + v[v.length - 1] + 'ed';
  return v + 'ed';
}

function mangleCandidates(verb, slot) {
  const correct = verb[slot];
  const other = slot === 'past' ? verb.pp : verb.past;
  const out = [regularize(verb.v)];
  if (other !== correct) out.push(other);            // the swapped form — classic mix-up
  out.push(correct + 'ed');                          // "wented"
  if (!correct.endsWith('n')) out.push(correct + (correct.endsWith('e') ? 'n' : 'en')); // "thoughten"
  // a same-letter form borrowed from another verb ("sang" for "saw")
  const cross = VERBS.filter((x) => x.v !== verb.v && x[slot][0] === correct[0] && x[slot] !== correct);
  if (cross.length) out.push(pick(cross)[slot]);
  return [...new Set(out)].filter((w) => w !== correct && w !== verb.v);
}

// One challenge for a gate: pick a verb from `pool` (avoiding `used` when possible),
// blank either the past or the participle (or both for the final chest).
export function makeChallenge(pool, used = new Set(), { double = false } = {}) {
  let candidates = pool.filter((x) => !used.has(x.v));
  if (!candidates.length) candidates = pool;
  const verb = pick(candidates);

  if (double) {
    const correct = { text: `${verb.past} · ${verb.pp}`, correct: true };
    const reg = regularize(verb.v);
    const wrongPairs = [];
    wrongPairs.push(`${reg} · ${reg}`);
    if (verb.past !== verb.pp) wrongPairs.push(`${verb.pp} · ${verb.past}`);
    else wrongPairs.push(`${verb.past} · ${verb.past.replace(/t$/, 'nk')}`); // "thought · thounk"-style giggle
    wrongPairs.push(`${verb.v}ed · ${verb.v}en`);
    const opts = shuffle([correct, ...shuffle(wrongPairs).slice(0, 2).map((t) => ({ text: t, correct: false }))]);
    return { verb, slot: 'both', options: opts };
  }

  const slot = Math.random() < 0.5 ? 'past' : 'pp';
  const correct = verb[slot];
  const distractors = shuffle(mangleCandidates(verb, slot)).slice(0, 2);
  const options = shuffle([
    { text: correct, correct: true },
    ...distractors.map((t) => ({ text: t, correct: false })),
  ]);
  return { verb, slot, options };
}

// Rune-door puzzle: three full chains for one verb, only one is correctly formed.
export function makeRuneChallenge(used = new Set()) {
  let candidates = POOL_DISTINCT.filter((x) => !used.has(x.v));
  if (!candidates.length) candidates = POOL_DISTINCT;
  const verb = pick(candidates);
  const reg = regularize(verb.v);
  const flawed = shuffle([
    { past: reg, pp: verb.pp },           // regularized past
    { past: verb.past, pp: verb.past },   // past reused as participle
    { past: verb.pp, pp: verb.pp },       // participle leaked into past
    { past: verb.past, pp: reg },         // regularized participle
  ]).slice(0, 2);
  const chains = shuffle([
    { past: verb.past, pp: verb.pp, correct: true },
    ...flawed.map((f) => ({ ...f, correct: false })),
  ]);
  return { verb, chains };
}
