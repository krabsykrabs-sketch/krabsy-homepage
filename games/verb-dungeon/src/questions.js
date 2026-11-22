// Question source. Uses the site question engine (homepage/lib/krabsy-questions.js,
// 'quiz' shape) when the game runs on the site; falls back to the inline verb list
// in local dev, where /lib/ does not exist.
// A question: { key, base, past, pp, ask: 'past' | 'pp', answer, options[3], full? }
// A pair:     { base, past, pp, steps: [2nd-form question, 3rd-form question] }
// Doors ask a whole pair, one step after the other in the same plate; chests ask a
// single 2nd-form question (`single()`), whose feedback then shows the full chain.
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

const pairOf = (q2, q3) => ({ base: q2.base, past: q2.past, pp: q2.pp, steps: [q2, q3] });

export let source = 'inline';
export let tierInfo = ''; // QA: the tiers of the engine pairs in use

// Returns `count` verb pairs for a level. tiers = difficulty filter for the engine.
export async function loadPairs({ count = 10, tiers } = {}) {
  try {
    const KQ = await import('/lib/krabsy-questions.js');
    const topic = KQ.topicFromUrl();
    if (topic !== 'irregular_verbs') throw new Error('only verbs so far');
    // The engine returns each verb as two records in a row: the 2nd-form question,
    // then the 3rd-form one marked `followUp` (chainOrder, on by default). All verbs
    // are fetched, because the level's difficulty comes from the verb tiers (the
    // chain set has `tier` per verb; the quiz records' `difficulty` is the same for all).
    const set = await KQ.getQuizSet({ topic, count: 1000, withOptions: 3 });
    const tierOf = new Map((await KQ.getChainSet({ topic, shuffle: false })).map((r) => [r.verb, r.tier]));
    const all = [];
    for (let i = 1; i < set.length; i++) {
      if (!set[i].followUp) continue;
      const q2 = fromEngine(set[i - 1]), q3 = fromEngine(set[i]);
      if (q2 && q3 && q2.ask === 'past' && q3.ask === 'pp' && q2.base === q3.base) {
        all.push({ ...pairOf(q2, q3), tier: tierOf.get(q2.base) ?? 9 });
      }
    }
    // The level's tiers first; if they are too few, fill up with the easiest others.
    const fits = (p) => !tiers || tiers.includes(p.tier);
    const rest = all.filter((p) => !fits(p)).sort((a, b) => a.tier - b.tier);
    const out = [...all.filter(fits), ...rest].slice(0, count);
    tierInfo = out.map((p) => p.tier).join('');
    if (out.length >= 5) { source = 'engine'; return out; }
  } catch (_) { /* local dev or offline: use the inline list */ }
  source = 'inline';
  // Inline list has no tiers: level 1 takes the first 30 verbs (most common ones).
  const hard = tiers && Math.max(...tiers) > 1;
  const pool = shuffle(hard ? VERBS.slice() : VERBS.slice(0, 30)).slice(0, count);
  return pool.map((v) => pairOf(fromInline(v, 'past'), fromInline(v, 'pp')));
}

const fresh = (q) => ({ ...q, options: shuffle(q.options.slice()), tried: null });

// A missed verb comes back at a later door: the same pair, fresh option order.
export function again(pair) {
  return { ...pair, missed: false, retry: true, steps: pair.steps.map(fresh) };
}
// Chest question: the pair's 2nd form only. `full` = no 3rd-form question follows,
// so the feedback may show the whole chain.
export function single(pair) {
  return { ...fresh(pair.steps[0]), full: true };
}
