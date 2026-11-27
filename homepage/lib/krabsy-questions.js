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
   SMART MIX (classroom concept phase 1, docs/classroom-concept.md §4)
     Pass `smart: true` to getQuizSet / getChainSet: instead of a random
     pick, the round mixes words this child still gets wrong, new words
     from their level, and known words that are due again (krabsy-smart.js,
     reads the child's stats). Games should also record every answer:
       import { recordAttempt } from '/lib/krabsy-stats.js';
       recordAttempt(q.item, q.form, correct, '<game-id>', q.topic);
     (`item` is on every quiz record; chain records use `verb` and the
     forms 'past' / 'participle'.)
   Games that must also run from file:// keep a small inline fallback:
     let chains; try { chains = await KQ.getChainSet(…); }
                 catch (_) { chains = INLINE_FALLBACK; }
   ────────────────────────────────────────────────────────────────────────── */

import {
  getQuestions as _rawQuestions,
  loadVerbTable as _loadVerbTable,
  currentLang as _currentLang,
  pickLang as _pickLang,
  TOPIC_IDS as _TOPIC_IDS,
  linkLevel as _linkLevel,
  LINK_LEVEL_MIN as _LINK_LEVEL_MIN,
  topicInfo as _topicInfo,
  registerTopic,
} from '/lib/krabsy-data.js';
import { readTopicItems as _readTopicItems } from '/lib/krabsy-stats.js';
import { rankItems as _rankItems } from '/lib/krabsy-smart.js';

/* ── topic helpers ──────────────────────────────────────────────────────── */

/** All topic ids (live: grows with registerTopic). The registry lives in
    krabsy-data.js; a topic's `learn` says which language it teaches. */
export const TOPICS = _TOPIC_IDS;
export { registerTopic };

/** Level from a teacher practice link (?difficulty=1–3) or null. getQuizSet and
    getChainSet apply it on their own; games only need it to skip their own caps. */
export function difficultyFromUrl() {
  return _linkLevel();
}

/** { learn, level, shapes, file? } or null. */
export function topicInfo(topic) {
  return _topicInfo(topic);
}

/** Which shapes a topic can serve. Chain games skip topics without
    chains; new topics are 'quiz' only. */
export function topicSupports(topic, shape) {
  const info = _topicInfo(topic);
  return !!info && info.shapes.includes(shape);
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

/* Smart order: ids ranked by krabsy-smart.js for a round of `count` items.
   Returns a Map id → rank (lower = sooner). */
function _smartRank(topic, candidates, count) {
  const ids = _rankItems({ candidates, stats: _readTopicItems(topic), count });
  return new Map(ids.map((id, i) => [id, i]));
}

/* ── 'chain' shape ──────────────────────────────────────────────────────── */

/**
 * One record per verb, all forms + per-form distractors.
 *   { verb, past, participle, past_alt[], participle_alt[],
 *     distractors: { past[], participle[] },
 *     meaning, meanings: { de, es, … }, tier, morph_type }
 *
 * Options:
 *   topic    default 'irregular_verbs' (the only chain topic today;
 *            unsupported topics THROW — chain games catch and fall back)
 *   count    max records (default: all)
 *   tiers    array of tiers to include (default: all)
 *   maxLen   max character length across all forms (layout constraint —
 *            Verb Snake uses 7, Verb Flow 9)
 *   shuffle  default true
 *   ids      only these verbs (e.g. a teacher's word list)
 *   smart    order by the smart mix instead of at random (needs `count`
 *            to size the mix; without it the whole set is ranked)
 */
export async function getChainSet(opts = {}) {
  const {
    topic = 'irregular_verbs',
    count,
    tiers,
    maxLen,
    ids,
    smart = false,
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
  // Teacher practice link (?difficulty=N): verb tiers 1…N replace the caller's tiers
  // (unless that leaves too few verbs).
  const lvl = _linkLevel();
  let useTiers = tiers;
  if (lvl) {
    const linked = [1, 2, 3].filter((t) => t <= lvl);
    const n = rows.filter((r) => r.past && r.participle && linked.includes(r.tier)).length;
    if (n >= _LINK_LEVEL_MIN) useTiers = linked;
  }
  let out = rows
    .filter((r) => r.past && r.participle)
    .filter((r) => (useTiers ? useTiers.includes(r.tier) : true))
    .filter((r) => (ids ? ids.includes(r.verb) : true))
    .filter((r) => (maxLen
      ? Math.max(r.verb.length, r.past.length, r.participle.length) <= maxLen
      : true))
    .map((r) => ({
      ...r,
      distractors: wrong.get(r.verb) || { past: [], participle: [] },
    }));
  if (smart) {
    const rank = _smartRank(topic, out.map((r) => ({ id: r.verb, tier: r.tier })),
      typeof count === 'number' ? count : out.length);
    out.sort((a, b) => rank.get(a.verb) - rank.get(b.verb));
    if (typeof count === 'number') out = out.slice(0, count);
    if (shuffle) _shuffle(out);
    return out;
  }
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
 *     | { kind: 'gap', sentence,             // sentence with ___ gap
 *         plain, hint }                      // sentence = plain + " (hint)";
 *                                            // hint in the interface language
 *                                            // ("Yo soy ___. (tall)"), '' if none
 *     answer,            // canonical correct string
 *     learnLang,         // language being learned: 'en', 'es', …
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
 *   ids          only these items (verb base forms / preposition use-case
 *                ids), e.g. a teacher's word list
 *   smart        order by the smart mix instead of at random (see top)
 *   lang         interface language for hints and teach lines ('en' | 'de'
 *                | 'es'); default: the stored site language. Games with
 *                their own ?lang= pass it here.
 *
 * Every record also carries `item` (verb base form or use-case id) — the
 * id to pass to recordAttempt(item, form, correct, source, topic).
 */
export async function getQuizSet(opts = {}) {
  const {
    topic = 'irregular_verbs',
    count = 8,
    withOptions = 3,
    difficulty,
    forms,
    uniqueBy = 'verb',
    ids,
    smart = false,
    shuffle = true,
  } = opts;
  if (!topicSupports(topic, 'quiz')) {
    throw new Error(`krabsy-questions: topic "${topic}" has no quiz shape`);
  }
  const allowPast = !forms || forms.includes('past');
  const chainOrder = topic === 'irregular_verbs' && allowPast
    && (opts.chainOrder !== undefined ? !!opts.chainOrder : true);
  const lang = opts.lang || _currentLang();
  const learnLang = _topicInfo(topic).learn;
  const raw = await _rawQuestions({ topic, difficulty, ids, shuffle: true, lang });
  const itemOf = (q) => q.useCaseId || q.verb;

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
      const sentence = q.context_sentence || q.prompt;
      display = {
        kind: 'gap',
        sentence,
        plain: q.sentence_plain || sentence,
        hint: q.hint_text || '',
        hints: q.hints || {},          // { lang: text } — for games that switch language
      };
      teach = {
        line: _pickLang(q.meanings, lang) || q.pattern || null,
        lines: q.meanings || {},       // { lang: text } — same, unresolved
        chain: null,
      };
    }
    return {
      id: q.id,
      item: itemOf(q),
      topic,
      learnLang,
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
  let fill = [];
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
    const extra = []; // further questions of an item already used
    for (const q of raw) {
      const dedupKey = uniqueBy === 'verb' ? itemOf(q) : q.id; // one per item (verb / use case)
      const rec = build(q);
      if (!rec) continue;
      if (seen.has(dedupKey)) { extra.push([rec]); continue; }
      seen.add(dedupKey);
      units.push([rec]);
    }
    // Small topics (few items, many sentences each): one question per item
    // is the preference, not a cap — further sentences fill up the set
    // (appended after ordering, below) so a game asking for 10 gets 10.
    if (units.length < count) fill = extra;
  }

  if (smart && units.length) {
    // Rank items (verbs / use cases); a verb pair is two questions.
    const tierOf = new Map();
    if (table) for (const r of table.values()) tierOf.set(r.verb, r.tier);
    const cands = [];
    const seenItem = new Set();
    for (const u of units) {
      const id = u[0].item;
      if (seenItem.has(id)) continue;
      seenItem.add(id);
      cands.push({ id, tier: tierOf.get(id) || 1 });
    }
    const perUnit = chainOrder ? 2 : 1;
    const rank = _smartRank(topic, cands, Math.max(1, Math.ceil(count / perUnit)));
    units.sort((a, b) => rank.get(a[0].item) - rank.get(b[0].item));
  } else if (shuffle) {
    _shuffle(units);
  }
  if (fill.length) units.push(...(shuffle ? _shuffle(fill) : fill));
  const chosen = [];
  let filled = 0;
  for (const u of units) {
    if (filled >= count) break;
    // A pair that does not fit any more is cut to its 2nd-form question,
    // which then teaches the full chain (no 3rd form follows). Never a lone
    // 3rd form.
    if (filled + u.length > count) {
      const first = u[0];
      const chain = first.teach.chain;
      chosen.push([chain ? { ...first, teach: { line: `${chain.base} → ${chain.past} → ${chain.participle}`, chain } } : first]);
      filled += 1;
      continue;
    }
    chosen.push(u);
    filled += u.length;
  }
  // Smart rounds were taken in rank order — mix them so practice words
  // don't all come first (pairs stay together).
  if (smart && shuffle) _shuffle(chosen);
  return chosen.flat();
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
