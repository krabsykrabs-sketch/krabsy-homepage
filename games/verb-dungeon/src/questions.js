// Question source. Uses the site question engine (homepage/lib/krabsy-questions.js,
// 'quiz' shape) when the game runs on the site; falls back to the inline verb list
// in local dev, where /lib/ does not exist.
// A question: { key, base, past, pp, ask: 'past' | 'pp', answer, options[3] }
// Chain order (owner decision 2026-11-21, from the Tower Defense play-test): a verb's
// 3rd form is only asked right after its 2nd form, and then the 2nd form is shown
// (`go → went → ___`). Asking the 3rd form with both blanks empty made players type
// the 2nd form, which tests attention, not knowledge.
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
  const wrong = shuffle((ask === 'past' ? v.wp : v.wpp).filter((w) => w !== answer)).slice(0, 2);
  return { key: `${v.v}|${ask}`, base: v.v, past: v.past, pp: v.pp, ask, answer,
    options: shuffle([answer, ...wrong]) };
}

export let source = 'inline';

// Returns `count` questions for a level. tiers = difficulty filter for the engine.
export async function loadQuestions({ count = 14, tiers } = {}) {
  try {
    const KQ = await import('/lib/krabsy-questions.js');
    const topic = KQ.topicFromUrl();
    if (topic !== 'irregular_verbs') throw new Error('only verbs so far');
    // The engine pairs each 3rd-form question right after its 2nd form (chainOrder,
    // on by default) and keeps the pair together, so the order below is kept.
    // Note: every catalogue question has the same `difficulty`, so the tier filter
    // usually returns nothing and the second call (all verbs) is used.
    let set = await KQ.getQuizSet({ topic, count, difficulty: tiers, withOptions: 3 });
    if (set.length < count) set = await KQ.getQuizSet({ topic, count, withOptions: 3 });
    const out = set.map(fromEngine).filter(Boolean);
    if (out.length >= 6) { source = 'engine'; return out; }
  } catch (_) { /* local dev or offline: use the inline list */ }
  source = 'inline';
  // Inline list has no tiers: level 1 takes the first half (most common verbs).
  const hard = tiers && Math.max(...tiers) > 1;
  const pool = shuffle(hard ? VERBS.slice() : VERBS.slice(0, 30)).slice(0, Math.ceil(count / 2));
  return pool.flatMap((v) => [fromInline(v, 'past'), fromInline(v, 'pp')]);
}

// A second question about a missed verb (same verb, same blank, fresh option order).
export function again(q) {
  return { ...q, options: shuffle(q.options.slice()), tried: null, retry: true };
}
