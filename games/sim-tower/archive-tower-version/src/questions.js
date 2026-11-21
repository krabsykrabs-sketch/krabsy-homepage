// Question source for the resident 💬 quiz. ENGINE-FIRST (site convention):
// when served from the homepage, the shared engine /lib/krabsy-questions.js
// provides the canonical catalogue (155 verbs / 99 prepositions, ?topic=
// support); the small inline set below is the caught-exception fallback for
// file:// and the standalone dev server, where /lib 404s.
// Both paths emit the same record: { text, options[3], answer, cap? }.
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// ── shared engine (loads in the background; inline set serves until then) ──
let enginePool = null;   // [{text, options, answer, cap}] from the catalogue

/** Engine quiz record → this game's shape. Trio displays render like the
 *  inline chains: the non-asked form filled in, the asked one blank. */
function fromEngine(q) {
  const cap = (q.teach && q.teach.line) || null;
  if (q.display.kind === 'gap') return { text: q.display.sentence, options: q.options, answer: q.answer, cap };
  const ch = q.teach && q.teach.chain;
  if (!ch) return null;
  const text = q.display.askIndex === 0
    ? `${ch.base} → ___ → ${ch.participle}`
    : `${ch.base} → ${ch.past} → ___`;
  return { text, options: q.options, answer: q.answer, cap };
}

(async () => {
  try {
    const KQ = await import('/lib/krabsy-questions.js');
    const t = new URLSearchParams(location.search).get('topic');
    // explicit ?topic= narrows the pool; default = the mixed preps+verbs quiz
    const topics = KQ.TOPICS.includes(t) ? [t] : ['prepositions', 'irregular_verbs'];
    const sets = await Promise.all(topics.map((topic) => KQ.getQuizSet({ topic, count: 40, withOptions: 3 })));
    const mapped = sets.flat().map(fromEngine).filter(Boolean);
    if (mapped.length >= 6) enginePool = mapped;
  } catch (_) { /* file:// or the standalone dev server — keep the inline set */ }
})();

/** A random question (not among the last few), options pre-shuffled. */
export function pickQuestion() {
  if (enginePool) {
    let q, guard = 0;
    do { q = enginePool[Math.floor(Math.random() * enginePool.length)]; } while (recent.includes(q) && ++guard < 20);
    recent.push(q); if (recent.length > 6) recent.shift();
    return { text: q.text, options: shuffle([...q.options]), answer: q.answer, cap: q.cap };
  }
  let q, guard = 0;
  do { q = ALL[Math.floor(Math.random() * ALL.length)]; } while (recent.includes(q) && ++guard < 20);
  recent.push(q); if (recent.length > 6) recent.shift();
  return { text: q.t, options: shuffle([q.a, ...q.d]), answer: q.a, cap: q.cap || null };
}
