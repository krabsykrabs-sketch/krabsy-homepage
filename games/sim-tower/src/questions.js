// Inline question set for the resident 💬 quiz — the standalone dev project
// can't reach homepage/lib/krabsy-questions.js, so (per Krabsy convention) the
// game carries a small inline copy shaped like the quiz engine's output:
//   { text, options[3], answer, cap? }
// Presentation mandate: sentence gaps or positional verb chains ("go → went →
// ___") — NEVER grammar terminology. `cap` is a small after-answer teach beat.

// prepositions (in/on/at) — sentence gaps
const PREPS = [
  { t: 'My birthday is ___ July.',        a: 'in', d: ['on', 'at'], cap: 'months → in' },
  { t: 'The lesson starts ___ 9 o\'clock.', a: 'at', d: ['in', 'on'], cap: 'clock times → at' },
  { t: 'We play football ___ Sunday.',    a: 'on', d: ['in', 'at'], cap: 'days → on' },
  { t: 'The cat sleeps ___ the sofa.',    a: 'on', d: ['in', 'at'], cap: 'on top of it → on' },
  { t: 'The milk is ___ the fridge.',     a: 'in', d: ['on', 'at'], cap: 'inside it → in' },
  { t: 'She waits ___ the bus stop.',     a: 'at', d: ['in', 'on'], cap: 'a place/point → at' },
  { t: 'It snows ___ winter.',            a: 'in', d: ['on', 'at'], cap: 'seasons → in' },
  { t: 'The picture hangs ___ the wall.', a: 'on', d: ['in', 'at'], cap: 'on a surface → on' },
  { t: 'He was born ___ 2014.',           a: 'in', d: ['on', 'at'], cap: 'years → in' },
  { t: 'School starts ___ Monday.',       a: 'on', d: ['in', 'at'], cap: 'days → on' },
  { t: 'The keys are ___ my bag.',        a: 'in', d: ['on', 'at'], cap: 'inside it → in' },
  { t: 'We meet ___ night.',              a: 'at', d: ['in', 'on'], cap: 'night → at' },
];

// irregular verbs — positional chain notation, ask the blank
const VERBS = [
  { t: 'go → went → ___',    a: 'gone',    d: ['goed', 'wented'] },
  { t: 'see → ___ → seen',   a: 'saw',     d: ['seed', 'sawed'] },
  { t: 'eat → ate → ___',    a: 'eaten',   d: ['eated', 'ate'] },
  { t: 'take → ___ → taken', a: 'took',    d: ['taked', 'tooked'] },
  { t: 'write → wrote → ___', a: 'written', d: ['writed', 'wrote'] },
  { t: 'come → ___ → come',  a: 'came',    d: ['comed', 'camed'] },
  { t: 'swim → swam → ___',  a: 'swum',    d: ['swimmed', 'swam'] },
  { t: 'buy → ___ → bought', a: 'bought',  d: ['buyed', 'brought'] },
  { t: 'fly → flew → ___',   a: 'flown',   d: ['flyed', 'flew'] },
  { t: 'drink → ___ → drunk', a: 'drank',  d: ['drinked', 'dranked'] },
  { t: 'make → made → ___',  a: 'made',    d: ['maked', 'maden'] },
  { t: 'run → ___ → run',    a: 'ran',     d: ['runned', 'ranned'] },
];

const ALL = [...PREPS, ...VERBS];
const recent = [];

/** A random question (not among the last few), options pre-shuffled. */
export function pickQuestion() {
  let q, guard = 0;
  do { q = ALL[Math.floor(Math.random() * ALL.length)]; } while (recent.includes(q) && ++guard < 20);
  recent.push(q); if (recent.length > 6) recent.shift();
  const options = [q.a, ...q.d];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return { text: q.t, options, answer: q.a, cap: q.cap || null };
}
