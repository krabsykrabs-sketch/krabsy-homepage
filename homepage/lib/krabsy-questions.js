/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — game-facing question engine (thin adapter over krabsy-data.js)

   PURPOSE
   The speed drills already share one data source (krabsy-data.js
   getQuestions). GAMES historically inlined their own verb lists instead.
   This module is the bridge: games import it, declare the SHAPE they
   consume, and optionally read ?topic= from their URL — making every
   game topic-agnostic without per-game data plumbing.

   SHAPES
   • 'chain'  — one record per verb with all forms + distractors.
                Consumed by chain-mechanic games (Verb Flow, Verb Snake,
                Air Control). Today only irregular_verbs provides chains.
   • 'quiz'   — presentation-ready single questions for choice or typed
                input. Works for EVERY topic (verbs, prepositions, and
                future topics). This is what the 3D games' question UIs
                (blackboard, sink, word-plates…) should consume.

   PRESENTATION CONTRACT (user-mandated, follow strictly)
   Questions must NEVER require knowing grammar terminology. The Sprint
   drill is the canonical style:
       go  →  [___]  →  [___]
   …with the ASKED blank highlighted. The position in the chain IS the
   question ("2nd form / 3rd form"), never "what is the Past Participle
   of…". For sentence topics (prepositions), the gap in the sentence is
   the question:  "My birthday is ___ July."
   Each quiz record therefore carries a `display` object games can render
   directly, plus `teach` for the after-answer beat (the full chain /
   explanation — showing terminology in small print there is fine).

   Typed input ("typewriter", like Type Race) is a first-class answer
   mode: use `checkTyped(q, input)` instead of options.

   USAGE (inside a game's <script type="module"> or via dynamic import)
     const KQ = await import('/lib/krabsy-questions.js');
     const topic = KQ.topicFromUrl();                  // ?topic=… or default
     const chains = await KQ.getChainSet({ topic, maxLen: 7 });
     const quiz   = await KQ.getQuizSet({ topic, count: 8 });
   Games that must also run from file:// keep a small inline fallback:
     let chains; try { chains = await KQ.getChainSet(…); }
                 catch (_) { chains = INLINE_FALLBACK; }
   ────────────────────────────────────────────────────────────────────────── */

import {
  getQuestions as _rawQuestions,
  loadVerbTable as _loadVerbTable,
  getLang as _getLang,
} from '/lib/krabsy-data.js';

/* ── topic helpers ──────────────────────────────────────────────────────── */

export const TOPICS = ['irregular_verbs', 'prepositions'];

/** Which shapes a topic can serve. Future topics: add a row, games adapt
    automatically (chain games skip topics without chains). */
const SHAPE_SUPPORT = {
  irregular_verbs: ['chain', 'quiz'],
  prepositions: ['quiz'],
};

export function topicSupports(topic, shape) {
  return (SHAPE_SUPPORT[topic] || []).includes(shape);
}

/** Read ?topic= from the current URL (works inside game iframes too).
    Unknown values fall back to the default so a typo can't break a game. */
export function topicFromUrl(fallback = 'irregular_verbs') {
  try {
    const t = new URLSearchParams(window.location.search).get('topic');
    return TOPICS.includes(t) ? t : fallback;
  } catch (_) {
    return fallback;
  }
}

/* ── shared utils ───────────────────────────────────────────────────────── */

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function _norm(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/* ── 'chain' shape ──────────────────────────────────────────────────────── */

/**
 * One record per verb, all forms + per-form distractors.
 *   { verb, past, participle, past_alt[], participle_alt[],
 *     distractors: { past[], participle[] },
 *     meaning, meaning_de, meaning_es, tier, morph_type }
 *
 * Options:
 *   topic    default 'irregular_verbs' (the only chain topic today;
 *            unsupported topics THROW — chain games catch and fall back)
 *   count    max records (default: all)
 *   tiers    array of tiers to include (default: all)
 *   maxLen   max character length across all forms (layout constraint —
 *            Verb Snake uses 7, Verb Flow 9)
 *   shuffle  default true
 */
export async function getChainSet(opts = {}) {
  const {
    topic = 'irregular_verbs',
    count,
    tiers,
    maxLen,
    shuffle = true,
  } = opts;
  if (!topicSupports(topic, 'chain')) {
    throw new Error(`krabsy-questions: topic "${topic}" has no chain shape`);
  }
  const rows = await _loadVerbTable();
  // distractors come from the question items; index them per verb+form
  const raw = await _rawQuestions({ topic: 'irregular_verbs' });
  const wrong = new Map(); // verb -> {past:[], participle:[]}
  for (const q of raw) {
    let w = wrong.get(q.verb);
    if (!w) { w = { past: [], participle: [] }; wrong.set(q.verb, w); }
    if (Array.isArray(q.wrong_answers)) w[q.form] = q.wrong_answers.slice();
  }
  let out = rows
    .filter((r) => r.past && r.participle)
    .filter((r) => (tiers ? tiers.includes(r.tier) : true))
    .filter((r) => (maxLen
      ? Math.max(r.verb.length, r.past.length, r.participle.length) <= maxLen
      : true))
    .map((r) => ({
      ...r,
      distractors: wrong.get(r.verb) || { past: [], participle: [] },
    }));
  if (shuffle) _shuffle(out);
  if (typeof count === 'number') out = out.slice(0, count);
  return out;
}

/* ── 'quiz' shape ───────────────────────────────────────────────────────── */

/**
 * Presentation-ready questions for choice buttons OR typed input.
 *
 * Record:
 *   {
 *     id, topic, difficulty,
 *     display:
 *       { kind: 'trio', base, slots: [{ text|null }, { text|null }],
 *         askIndex }                         // verbs: go → ___ → ___
 *     | { kind: 'gap', sentence }            // sentence with ___ gap
 *     answer,            // canonical correct string
 *     accepts,           // [answer, ...alternates] for typed input
 *     options,           // shuffled strings incl. answer (withOptions long)
 *     correctIndex,      // index of answer within options
 *     teach: { line, chain|null, hideParticiple? }   // after-answer beat
 *     followUp?          // true on a 3rd-form question asked right after
 *                        // the same verb's 2nd form (chain order)
 *   }
 *
 * CHAIN ORDER (owner decision 2026-11-21, on by default for verbs)
 *   A verb's 3rd form is only asked directly after its 2nd form, and then
 *   the 2nd form is written in:  go → ___ → ___  (asks "went"), next
 *   go → went → ___  (asks "gone"). With both blanks empty, players kept
 *   answering the 2nd form when the 3rd was asked (attention, not
 *   knowledge). Showing the 2nd form on a lone 3rd-form question would give
 *   the answer away for the many verbs whose 2nd and 3rd forms are equal,
 *   so lone 3rd-form questions are not produced at all.
 *   On the 2nd-form question of such a pair, `teach.hideParticiple` is true
 *   and `teach.line` stops at "go → went → ___": after that answer a game
 *   must NOT reveal the 3rd form (teach.chain still holds it, for recaps
 *   after the follow-up). The pair stays adjacent through shuffling and
 *   counts as two questions toward `count`.
 *   Games that order questions themselves can pass `chainOrder: false`.
 *
 * Options:
 *   topic        default 'irregular_verbs'
 *   count        default 8
 *   withOptions  options per question, default 3
 *   difficulty   number|number[] passthrough filter
 *   forms        ['past','participle'] subset (verbs only). Asking for
 *                participle without past turns chain order off.
 *   uniqueBy     'verb' (default) — avoid asking the same verb twice/set
 *                (a chain-order pair counts as one verb)
 *   chainOrder   default true for irregular_verbs, see above
 *   shuffle      default true
 */
export async function getQuizSet(opts = {}) {
  const {
    topic = 'irregular_verbs',
    count = 8,
    withOptions = 3,
    difficulty,
    forms,
    uniqueBy = 'verb',
    shuffle = true,
  } = opts;
  if (!topicSupports(topic, 'quiz')) {
    throw new Error(`krabsy-questions: topic "${topic}" has no quiz shape`);
  }
  const allowPast = !forms || forms.includes('past');
  const chainOrder = topic === 'irregular_verbs' && allowPast
    && (opts.chainOrder !== undefined ? !!opts.chainOrder : true);
  const lang = _getLang();
  const raw = await _rawQuestions({ topic, difficulty, shuffle: true });

  // verb-table lookup for teach chains
  let table = null;
  if (topic === 'irregular_verbs') {
    const rows = await _loadVerbTable();
    table = new Map(rows.map((r) => [r.verb, r]));
  }

  // One raw question → one record (null if it cannot be asked).
  function build(q) {
    if (forms && q.form && q.form !== 'default' && !forms.includes(q.form)) return null;
    if (!q.correct_answer) return null;
    const accepts = [q.correct_answer, ...(q.correct_alt || [])].map(_norm);
    const wrongs = (q.wrong_answers || []).filter((w) => !accepts.includes(_norm(w)));
    if (wrongs.length < withOptions - 1) return null;
    const options = _shuffle([q.correct_answer, ...wrongs.slice(0, withOptions - 1)]);

    let display, teach;
    if (topic === 'irregular_verbs') {
      const row = table.get(q.verb);
      const askIndex = q.form === 'past' ? 0 : 1;
      display = {
        kind: 'trio',
        base: q.verb,
        slots: [{ text: null }, { text: null }],
        askIndex,
      };
      teach = {
        line: row ? `${row.verb} → ${row.past} → ${row.participle}` : null,
        chain: row ? { base: row.verb, past: row.past, participle: row.participle } : null,
      };
    } else {
      display = { kind: 'gap', sentence: q.context_sentence || q.prompt };
      teach = {
        line: (lang === 'es' ? q.meaning_es : q.meaning_de) || q.pattern || null,
        chain: null,
      };
    }
    return {
      id: q.id,
      topic,
      difficulty: q.difficulty,
      form: q.form || 'default',
      display,
      answer: q.correct_answer,
      accepts,
      options,
      correctIndex: options.indexOf(q.correct_answer),
      teach,
    };
  }

  // Units: a single record, or a [2nd form, 3rd form] pair (chain order).
  const units = [];
  if (chainOrder) {
    const pp = new Map(); // verb → raw participle question
    for (const q of raw) if (q.form === 'participle' && !pp.has(q.verb)) pp.set(q.verb, q);
    const usedVerb = new Set();
    for (const q of raw) {
      if (q.form !== 'past') continue;
      if (uniqueBy === 'verb' && usedVerb.has(q.verb)) continue;
      const first = build(q);
      if (!first) continue;
      usedVerb.add(q.verb);
      const second = pp.has(q.verb) ? build(pp.get(q.verb)) : null;
      const chain = first.teach.chain;
      if (!second || !chain) { units.push([first]); continue; }
      first.teach = { ...first.teach, hideParticiple: true,
        line: `${chain.base} → ${chain.past} → ___` };
      second.display = { ...second.display, slots: [{ text: chain.past }, { text: null }] };
      second.followUp = true;
      units.push([first, second]);
    }
  } else {
    const seen = new Set();
    for (const q of raw) {
      const dedupKey = uniqueBy === 'verb' ? q.verb : q.id;
      if (seen.has(dedupKey)) continue;
      const rec = build(q);
      if (!rec) continue;
      seen.add(dedupKey);
      units.push([rec]);
    }
  }

  if (shuffle) _shuffle(units);
  const out = [];
  for (const u of units) {
    if (out.length >= count) break;
    // A pair that does not fit any more is cut to its 2nd-form question,
    // which then teaches the full chain (no 3rd form follows). Never a lone
    // 3rd form.
    if (out.length + u.length > count) {
      const first = u[0];
      const chain = first.teach.chain;
      out.push(chain ? { ...first, teach: { line: `${chain.base} → ${chain.past} → ${chain.participle}`, chain } } : first);
      continue;
    }
    out.push(...u);
  }
  return out;
}

/** Typed-input ("typewriter") validation: trims, lowercases, collapses
    whitespace, and accepts alternates (burnt/burned). */
export function checkTyped(q, input) {
  return q.accepts.includes(_norm(input));
}

/** Render helper for the trio display as plain text, e.g. for HUDs/logs:
    "go → ___ → gone" with the asked slot kept blank. */
export function trioText(display) {
  if (display.kind !== 'trio') return '';
  const s = display.slots.map((sl, i) =>
    (sl.text != null ? sl.text : '___'));
  return `${display.base} → ${s[0]} → ${s[1]}`;
}
