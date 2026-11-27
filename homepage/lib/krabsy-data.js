/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Shared Data Loader
   ES module. Loads /data/irregular-verbs.json and /data/ui_<lang>.json,
   caches them, and exposes derived views.

   All paths resolve relative to this module's own location, so any page
   (drills/, tools/, reference/, stats/, the homepage) can import via the
   right relative path and the loader still finds /data/ correctly.

   Usage:
     import { loadVerbs, loadStrings, loadVerbTable, getQuestions,
              currentLang, setLang } from '/lib/krabsy-data.js';
     const verbs = await loadVerbs();
     const ui = await loadStrings();
   ────────────────────────────────────────────────────────────────────────── */

import { getOverall, readTopicItems } from './krabsy-stats.js';
import { rankItems } from './krabsy-smart.js';
import { TOPICS as REGISTRY_TOPICS, FALLBACK_UI, currentLang, pickLang } from './krabsy-lang.js?v=2026-11-27';

const DATA_BASE = new URL('/data/', import.meta.url);

/* ── Language ───────────────────────────────────────────────────────────── */
/* One helper for the whole site (krabsy-lang.js); re-exported here because the
   drill pages read everything from this module. */
export { currentLang, setLang, pickLang } from './krabsy-lang.js?v=2026-11-27';

/* ── Verb questions ─────────────────────────────────────────────────────── */

let _verbsPromise = null;

export function loadVerbs() {
  if (!_verbsPromise) {
    const url = new URL('irregular-verbs.json', DATA_BASE);
    _verbsPromise = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load verbs: ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        _verbsPromise = null; // allow retry on next call
        throw err;
      });
  }
  return _verbsPromise;
}

/* ── Preposition use cases ──────────────────────────────────────────────── */

let _prepositionsPromise = null;

export function loadPrepositions() {
  if (!_prepositionsPromise) {
    const url = new URL('prepositions.json', DATA_BASE);
    _prepositionsPromise = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load prepositions: ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        _prepositionsPromise = null; // allow retry on next call
        throw err;
      });
  }
  return _prepositionsPromise;
}

/* ── Teacher practice links (2026-11-25) ────────────────────────────────────
   ?difficulty=N in the page URL (a game frame gets it from its wrapper page)
   limits every question source to level ≤ N: sentence topics by the question's
   difficulty (1–3), irregular verbs by the verb's tier (1 = everyday verbs).
   If fewer than LINK_LEVEL_MIN questions remain, the filter is dropped rather
   than leaving a game without questions. */
export const LINK_LEVEL_MIN = 6;

/** Level from the link (1–3) or null. */
export function linkLevel() {
  try {
    const v = parseInt(new URLSearchParams(window.location.search).get('difficulty'), 10);
    return v >= 1 && v <= 3 ? v : null;
  } catch (_) {
    return null;
  }
}

async function _applyLinkLevel(topic, list) {
  const lvl = linkLevel();
  if (!lvl || !list.length) return list;
  let keep;
  if (topic === 'irregular_verbs') {
    const tier = new Map((await loadVerbTable()).map((r) => [r.verb, r.tier || 1]));
    keep = list.filter((q) => (tier.get(q.verb) || 1) <= lvl);
  } else {
    keep = list.filter((q) => (q.difficulty || 1) <= lvl);
  }
  return keep.length >= LINK_LEVEL_MIN ? keep : list;
}

/* ── Question topics: registry (format v2, docs/vision.md) ──────────────────
   Every topic a game or drill can ask, from data/topics.json via the
   generated lib/krabsy-registry.js (tools/krabsy_registry.py): `subject`
   (sections.json subjects), `learn` = the language being learned (the
   sentences), `level`, `shapes`, and `file` = a gap-topic file in /data/
   (format v2, content/FORMAT.md); the two original topics keep their own
   loaders and formats. The interface language is currentLang().
   The API reads the same topics.json (api/catalog.py). */

const TOPIC_REGISTRY = Object.fromEntries(Object.entries(REGISTRY_TOPICS).map(([id, t]) => [id,
  { subject: t.subject, learn: t.learn, level: t.level, shapes: t.shapes, ...(t.file ? { file: t.file } : {}) }]));

/** Live list of topic ids (the same array object stays valid after
    registerTopic, so importers may keep a reference). */
export const TOPIC_IDS = Object.keys(TOPIC_REGISTRY);

/** { subject, learn, level, shapes, file? } for a topic id, or null. */
export function topicInfo(id) {
  return TOPIC_REGISTRY[id] || null;
}

/** Add a gap topic at runtime (tests, previews, a teacher's own list
    later). info: { learn, level?, file } — file is resolved against /data/
    unless it is an absolute URL. */
export function registerTopic(id, info) {
  if (!/^[a-z0-9_]{1,40}$/.test(id)) throw new Error(`registerTopic: bad id "${id}"`);
  TOPIC_REGISTRY[id] = { level: null, shapes: ['quiz'], ...info };
  if (!TOPIC_IDS.includes(id)) TOPIC_IDS.push(id);
  _gapTopicPromises.delete(id);
}

const _gapTopicPromises = new Map();

/** Load a gap topic file (format v2). Returns the parsed object. */
export function loadGapTopic(id) {
  const info = TOPIC_REGISTRY[id];
  if (!info || !info.file) return Promise.reject(new Error(`loadGapTopic: "${id}" is not a gap topic`));
  if (!_gapTopicPromises.has(id)) {
    const url = new URL(info.file, DATA_BASE);
    const p = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load topic ${id}: ${r.status}`);
        return r.json();
      })
      .then((def) => {
        if (def.format !== 2) throw new Error(`Topic ${id}: expected format 2`);
        return def;
      })
      .catch((err) => {
        _gapTopicPromises.delete(id); // allow retry on next call
        throw err;
      });
    _gapTopicPromises.set(id, p);
  }
  return _gapTopicPromises.get(id);
}

/* Gap topic (format v2) → question records in the same shape as the
   preposition records, so drills and games read them the same way.
   The hint (in the interface language) is appended to the sentence in
   brackets ("Yo soy ___. (tall)") so every renderer shows it; the parts
   are also kept apart (sentence_plain, hint_text) for renderers that want
   to style the hint. Texts per interface language stay maps (`hints`,
   `meanings`: { de, es, en, … }, contract rule 4); `hint_text` / `meaning`
   are the resolved strings for `lang`. */
function _adaptGapTopic(topicId, def, type, lang) {
  const effectiveType = type || 'fill_gap';
  const out = [];
  for (const it of def.items || []) {
    if (!Array.isArray(it.examples)) continue;
    const expl = it.explanation || {};
    for (let i = 0; i < it.examples.length; i++) {
      const ex = it.examples[i];
      const answers = Array.isArray(ex.answers) ? ex.answers : [];
      if (!answers.length) continue;
      const hint = pickLang(ex.hint, lang);
      const sentence = hint ? `${ex.sentence} (${hint})` : ex.sentence;
      const wrong = Array.isArray(ex.distractors) ? ex.distractors
        : Array.isArray(it.distractors) ? it.distractors : [];
      out.push({
        id:               `${it.id}_ex${i}`,
        topic:            topicId,
        verb:             it.label || it.id,     // back-compat field, see prepositions
        form:             'default',
        type:             effectiveType,
        difficulty:       ex.difficulty || 1,
        prompt:           sentence,
        correct_answer:   answers[0],
        correct_alt:      answers.slice(1),
        wrong_answers:    wrong.slice(),
        hint:             hint || it.label || '',
        context_sentence: sentence,
        sentence_plain:   ex.sentence,
        hint_text:        hint,
        hints:            ex.hint && typeof ex.hint === 'object' ? { ...ex.hint } : {},
        meaning:          pickLang(expl, lang),
        meanings:         { ...expl },
        learn_lang:       def.learn_lang,
        useCaseId:        it.id,                  // item id (stats, smart mix)
        group:            it.group,
        pattern:          it.label || '',
      });
    }
  }
  return out;
}

/* ── Topics (URL slug catalogue) ────────────────────────────────────────── */

let _topicsPromise = null;

/**
 * Load /data/topics.json. Returns an object keyed by topic id:
 *   {
 *     <topicId>: {
 *       de: "<slug>", es: "<slug>",
 *       display_name: { de, es },
 *       pages: { <pageId>: { de, es }, … }
 *     }
 *   }
 */
export function loadTopics() {
  if (!_topicsPromise) {
    const url = new URL('topics.json', DATA_BASE);
    _topicsPromise = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load topics: ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        _topicsPromise = null; // allow retry on next call
        throw err;
      });
  }
  return _topicsPromise;
}

/**
 * Return the URL slug for a topic in a given language, or null if unknown.
 *   getTopicSlug('irregular_verbs', 'de') → 'unregelmaessige-verben'
 */
export async function getTopicSlug(topicId, lang) {
  const topics = await loadTopics();
  const t = topics[topicId];
  if (!t || !t[lang]) return null;
  return t[lang];
}

/**
 * Reverse lookup: given a URL slug + language, return the topic id, or null.
 *   getTopicByName('verbos-irregulares', 'es') → 'irregular_verbs'
 */
export async function getTopicByName(slug, lang) {
  const topics = await loadTopics();
  for (const id of Object.keys(topics)) {
    if (topics[id] && topics[id][lang] === slug) return id;
  }
  return null;
}

/**
 * Per-page slug inside a topic. Returns null if the page id is unknown.
 *   getPageSlug('irregular_verbs', 'flashcards', 'de') → 'karteikarten'
 */
export async function getPageSlug(topicId, pageId, lang) {
  const topics = await loadTopics();
  const t = topics[topicId];
  if (!t || !t.pages || !t.pages[pageId]) return null;
  return t.pages[pageId][lang] || null;
}

/**
 * Full root-anchored URL for a topic page in a given language. The topic
 * hub itself is built by passing pageId=null:
 *   buildPageUrl('irregular_verbs', null,          'de') → '/de/unregelmaessige-verben/'
 *   buildPageUrl('irregular_verbs', 'flashcards',  'de') → '/de/unregelmaessige-verben/karteikarten/'
 */
export async function buildPageUrl(topicId, pageId, lang) {
  const topicSlug = await getTopicSlug(topicId, lang);
  if (!topicSlug) return null;
  if (pageId == null) return `/${lang}/${topicSlug}/`;
  const pageSlug = await getPageSlug(topicId, pageId, lang);
  if (!pageSlug) return null;
  return `/${lang}/${topicSlug}/${pageSlug}/`;
}

/* ── Games (platform-wide arcade catalogue) ─────────────────────────────── */

let _gamesPromise = null;

/**
 * Load /data/games.json. Returns an array of game objects:
 *   [{ id, name: { de, es }, tagline: { de, es }, thumbnail, topics: [...], status }]
 *
 * Games are platform-wide entertainment that may link to one or more topics
 * (see the `topics` array). The games hub at /<lang>/<spiele|juegos>/ lists
 * everything; topic hubs filter via getGamesForTopic().
 */
export function loadGames() {
  if (!_gamesPromise) {
    const url = new URL('games.json', DATA_BASE);
    _gamesPromise = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load games: ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        _gamesPromise = null; // allow retry on next call
        throw err;
      });
  }
  return _gamesPromise;
}

/** Full game list, in the order declared in games.json. */
export async function getAllGames() {
  return await loadGames();
}

/** Games whose `topics` array contains `topicId`. */
export async function getGamesForTopic(topicId) {
  const all = await loadGames();
  return all.filter((g) => Array.isArray(g.topics) && g.topics.includes(topicId));
}

/** Single game by id; null if not found. */
export async function getGameById(gameId) {
  const all = await loadGames();
  return all.find((g) => g.id === gameId) || null;
}

/* ── UI strings ─────────────────────────────────────────────────────────── */

// Cache key shape: `${effectiveLang}::${topic || '_base'}`. Each
// (lang, topic) combination caches independently. The base-language fetch
// itself is also cached so a (de, prep) lookup doesn't re-fetch ui_de.json
// after a (de, _base) lookup.
const _stringsPromises = new Map();
const _stringsBasePromises = new Map();

/** Fetch the raw ui_<lang>.json blob with the language-fallback recursion
 *  preserved. Returns the parsed JSON unchanged — the topic overlay is
 *  applied by the wrapper. */
function _loadStringsBase(lang) {
  if (!_stringsBasePromises.has(lang)) {
    const url = new URL(`ui_${lang}.json`, DATA_BASE);
    const p = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) {
          if (lang !== FALLBACK_UI) return _loadStringsBase(FALLBACK_UI);   // contract rule 5: → en
          throw new Error(`Failed to load strings (${lang}): ${r.status}`);
        }
        return r.json();
      })
      .catch((err) => {
        _stringsBasePromises.delete(lang);
        throw err;
      });
    _stringsBasePromises.set(lang, p);
  }
  return _stringsBasePromises.get(lang);
}

/**
 * Load UI strings for a language, optionally overlaid with a topic's
 * overrides. The base file (data/ui_<lang>.json) may carry an optional
 * top-level `topic_overrides` map. When `topic` is passed, the matching
 * entry under `topic_overrides[topic]` is deep-merged into the base; the
 * `topic_overrides` key is always stripped from the returned object so
 * callers never see it.
 *
 * Backwards-compatible: omitting `topic` returns the base strings exactly
 * as before (minus the `topic_overrides` key).
 */
export function loadStrings(lang, topic) {
  const effectiveLang = lang || currentLang();
  const cacheKey = `${effectiveLang}::${topic || '_base'}`;
  if (!_stringsPromises.has(cacheKey)) {
    const p = _loadStringsBase(effectiveLang).then((base) => {
      const { topic_overrides, ...rest } = base;
      if (!topic) return rest;
      const overrides = (topic_overrides && topic_overrides[topic]) || null;
      if (!overrides) return rest;
      return _deepMergeStrings(rest, overrides);
    }).catch((err) => {
      _stringsPromises.delete(cacheKey);
      throw err;
    });
    _stringsPromises.set(cacheKey, p);
  }
  return _stringsPromises.get(cacheKey);
}

/* ── Derived verb table ─────────────────────────────────────────────────── */

let _tablePromise = null;

export function loadVerbTable() {
  if (!_tablePromise) {
    _tablePromise = loadVerbs().then((qs) => {
      const byVerb = new Map();
      for (const q of qs) {
        let entry = byVerb.get(q.verb);
        if (!entry) {
          entry = {
            verb: q.verb,
            past: null,
            participle: null,
            past_alt: [],
            participle_alt: [],
            meaning_de: q.meaning_de || '',   // source fields (content/irregular-verbs.json, N8)
            meaning_es: q.meaning_es || '',
            tier: q.tier == null ? null : q.tier,
            morph_type: q.morph_type == null ? null : q.morph_type,
          };
          byVerb.set(q.verb, entry);
        }
        if (!entry.meaning_de && q.meaning_de) entry.meaning_de = q.meaning_de;
        if (!entry.meaning_es && q.meaning_es) entry.meaning_es = q.meaning_es;
        if (entry.tier == null && q.tier != null) entry.tier = q.tier;
        if (entry.morph_type == null && q.morph_type != null) entry.morph_type = q.morph_type;
        if (q.form === 'past' && !entry.past) {
          entry.past = q.correct_answer;
          if (Array.isArray(q.correct_alt)) entry.past_alt = q.correct_alt.slice();
        }
        if (q.form === 'participle' && !entry.participle) {
          entry.participle = q.correct_answer;
          if (Array.isArray(q.correct_alt)) entry.participle_alt = q.correct_alt.slice();
        }
      }
      // Resolve `meaning` to the current-language string. The verb table is
      // cached per page load and the lang toggle reloads the page, so this
      // stays consistent with whatever loadStrings() will fetch.
      // `meanings` is the per-language map (contract rule 4), built here from the
      // source's meaning_<lang> fields until the verb file carries a map (N8).
      const lang = currentLang();
      const rows = Array.from(byVerb.values()).map((r) => {
        const meanings = {};
        for (const [k, v] of Object.entries(r)) {
          const m = /^meaning_([a-z]{2,3})$/.exec(k);
          if (m && v) meanings[m[1]] = v;
        }
        return { ...r, meanings, meaning: pickLang(meanings, lang) };
      });
      // Sort alphabetically by base form for stable iteration.
      return rows.sort((a, b) => a.verb.localeCompare(b.verb));
    });
  }
  return _tablePromise;
}

/* ── Derived preposition reference ──────────────────────────────────────── */

let _prepositionReferencePromise = null;

/**
 * Categorised view of the preposition use cases for the reference page.
 * Returns an array of groups in the order each group first appears in the
 * source file, with the use cases inside each group preserved in source
 * order. Group labels are NOT resolved here — the reference page reads
 * them from /data/ui_<lang>.json. `explanations` is the per-language map,
 * `explanation` the text for the current language.
 */
export function loadPrepositionReference() {
  if (!_prepositionReferencePromise) {
    _prepositionReferencePromise = loadPrepositions()
      .then((useCases) => {
        const lang = currentLang();
        const byGroup = new Map();
        const order = [];
        for (const uc of useCases) {
          if (!byGroup.has(uc.group)) {
            byGroup.set(uc.group, []);
            order.push(uc.group);
          }
          const examples = Array.isArray(uc.examples) ? uc.examples : [];
          byGroup.get(uc.group).push({
            id: uc.id,
            pattern: uc.pattern,
            correct: uc.correct,
            level: typeof uc.level === 'number' ? uc.level : null,
            explanations: { ...(uc.explanation || {}) },
            explanation: pickLang(uc.explanation, lang),
            example_sentences: examples.map((ex) => ex.sentence),
            example_count: examples.length,
          });
        }
        return order.map((group) => ({ group, items: byGroup.get(group) }));
      })
      .catch((err) => {
        _prepositionReferencePromise = null; // allow retry on next call
        throw err;
      });
  }
  return _prepositionReferencePromise;
}

/* ── Tier weighting ─────────────────────────────────────────────────────── */

/**
 * Return tier mix (sum ≤ 1; tiers absent from the result get weight 0)
 * based on the user's cumulative attempt count.
 *
 * Bands (per product spec):
 *   <50:        100% tier 1
 *   50–199:     70% tier 1 / 30% tier 2
 *   200–499:    40 / 40 / 20
 *   500+:       30 / 40 / 30
 */
export function tierWeightsForAttempts(totalAttempts) {
  if (totalAttempts < 50)   return { 1: 1.0,  2: 0,    3: 0    };
  if (totalAttempts < 200)  return { 1: 0.7,  2: 0.3,  3: 0    };
  if (totalAttempts < 500)  return { 1: 0.4,  2: 0.4,  3: 0.2  };
  return                            { 1: 0.3, 2: 0.4,  3: 0.3 };
}

function _pickWeightedTier(weights, rng = Math.random) {
  const total = (weights[1] || 0) + (weights[2] || 0) + (weights[3] || 0);
  const r = rng() * total;
  let acc = 0;
  for (const t of [1, 2, 3]) {
    acc += (weights[t] || 0);
    if (r < acc) return t;
  }
  return 1;
}

/* ── Question filtering ─────────────────────────────────────────────────── */

/**
 * Synthesise verb-shaped question records from preposition use cases.
 * One record per example across all use cases. Iteration order: use cases
 * in file order, then examples in array order. `type` defaults to
 * "fill_gap" when undefined; the same value is stamped on every record so
 * downstream filtering can treat preposition records like verb records.
 *
 * Field-name note: `verb` carries the preposition pattern string for
 * back-compat with existing drill renderers that read `q.verb`. This is a
 * known wart. TODO: rename to a neutral field (itemLabel/subject) in a
 * future cleanup task that updates all drills at once.
 */
function _adaptPrepositionToQuestions(useCases, type) {
  const effectiveType = type || 'fill_gap';
  const out = [];
  for (const uc of useCases) {
    if (!Array.isArray(uc.examples)) continue;
    for (let i = 0; i < uc.examples.length; i++) {
      const ex = uc.examples[i];
      const valid = Array.isArray(ex.valid_answers) ? ex.valid_answers : [];
      out.push({
        id:               `${uc.id}_ex${i}`,
        topic:            'prepositions',
        verb:             uc.pattern,
        form:             'default',
        type:             effectiveType,
        difficulty:       ex.difficulty,
        prompt:           ex.sentence,
        correct_answer:   valid[0],
        correct_alt:      valid.slice(1),
        wrong_answers:    Array.isArray(uc.distractors) ? uc.distractors.slice() : [],
        hint:             uc.pattern,
        context_sentence: ex.sentence,
        meanings:         { ...(uc.explanation || {}) },   // { de, es, … } (resolve with pickLang)

        // Preposition-only extras (drills ignore today, available for later):
        useCaseId:        uc.id,
        group:            uc.group,
        pattern:          uc.pattern,
      });
    }
  }
  return out;
}

/**
 * Filter questions by criteria. All filters optional.
 *   topic:       "irregular_verbs" (default) | "prepositions"
 *   type:        "fill_gap" | "type_form"
 *   difficulty:  number | number[]
 *   ids:         string[] (per-topic identifiers — verb base forms for
 *                irregular_verbs, use-case ids for prepositions)
 *   verbIds:     deprecated alias for `ids`, kept for back-compat
 *   form:        "past" | "participle" | "default"
 *   shuffle:     boolean (default false)
 *   limit:       number (applied after shuffle)
 *   smart:       boolean (default false) — order by the smart mix instead of
 *                at random: words this child still gets wrong, new words from
 *                their level, due repeats (krabsy-smart.js,
 *                docs/classroom-concept.md §4). One question per word first,
 *                then further questions per word. Works with chainOrder.
 *
 * Throws on unknown topics so future topic additions fail loudly.
 */
export async function getQuestions(opts = {}) {
  const {
    topic = 'irregular_verbs',
    type,
    difficulty,
    ids,
    form,
    shuffle = false,
    limit,
    verbIds,
    chainOrder = false,
    smart = false,
  } = opts;
  const itemIds = ids ?? verbIds;

  const diffSet = difficulty == null
    ? null
    : new Set(Array.isArray(difficulty) ? difficulty : [difficulty]);
  const idSet = itemIds && itemIds.length ? new Set(itemIds) : null;

  let out;

  if (topic === 'irregular_verbs') {
    const all = await loadVerbs();
    out = all.filter((q) => {
      if (type && q.type !== type) return false;
      if (diffSet && !diffSet.has(q.difficulty)) return false;
      if (idSet && !idSet.has(q.verb)) return false;
      if (form && q.form !== form) return false;
      return true;
    });
  } else if (topic === 'prepositions') {
    const useCases = await loadPrepositions();
    const records = _adaptPrepositionToQuestions(useCases, type);
    out = records.filter((q) => {
      if (diffSet && !diffSet.has(q.difficulty)) return false;
      if (idSet && !idSet.has(q.useCaseId)) return false;
      if (form && q.form !== form) return false;
      return true;
    });
  } else if (TOPIC_REGISTRY[topic] && TOPIC_REGISTRY[topic].file) {
    const def = await loadGapTopic(topic);
    const records = _adaptGapTopic(topic, def, type, opts.lang || currentLang());
    out = records.filter((q) => {
      if (diffSet && !diffSet.has(q.difficulty)) return false;
      if (idSet && !idSet.has(q.useCaseId)) return false;
      if (form && q.form !== form) return false;
      return true;
    });
  } else {
    throw new Error(`getQuestions: unknown topic "${topic}"`);
  }

  out = await _applyLinkLevel(topic, out);   // teacher practice link (?difficulty=)

  if (smart) {
    const perItem = chainOrder && topic === 'irregular_verbs' && !form ? 2 : 1;
    const want = typeof limit === 'number' ? Math.max(1, Math.ceil(limit / perItem)) : null;
    out = await _smartOrder(topic, out, want, perItem);
  } else if (shuffle) {
    out = _shuffle(out.slice());
  }
  if (chainOrder && topic === 'irregular_verbs' && !form) return _chainOrder(out, limit);
  if (typeof limit === 'number' && limit >= 0) out = out.slice(0, limit);
  return out;
}

/* Item id of a question record (verb base form / preposition use case). */
function _itemOf(q) {
  return q.useCaseId || q.verb;
}

/* Smart order for getQuestions: rank the items in `list`, then emit one
   question per item in rank order, then a second round, … (so a word's
   questions don't cluster). With perItem = 2 (verb chain order) each verb
   keeps both of its forms together; _chainOrder pairs them afterwards. */
async function _smartOrder(topic, list, want, perItem) {
  const byItem = new Map();
  for (const q of _shuffle(list.slice())) {
    const id = _itemOf(q);
    if (!byItem.has(id)) byItem.set(id, []);
    byItem.get(id).push(q);
  }
  let tierOf = new Map();
  if (topic === 'irregular_verbs') {
    const table = await loadVerbTable();
    tierOf = new Map(table.map((r) => [r.verb, r.tier]));
  }
  const candidates = [...byItem.keys()].map((id) => ({ id, tier: tierOf.get(id) || 1 }));
  const ranked = rankItems({
    candidates,
    stats: readTopicItems(topic),
    count: want || candidates.length,
  });
  const out = [];
  if (perItem === 2) {
    for (const id of ranked) out.push(...byItem.get(id));   // _chainOrder pairs per verb
    return out;
  }
  for (let round = 0; out.length < list.length; round++) {
    let added = false;
    for (const id of ranked) {
      const qs = byItem.get(id);
      if (qs.length > round) { out.push(qs[round]); added = true; }
    }
    if (!added) break;
  }
  return out;
}

/**
 * All item ids of a topic in smart order (krabsy-smart.js): the first
 * `count` follow the practice / new / repeat mix, the rest follow in
 * fallback order. For decks (free practice, flashcards "all").
 *   topic: 'irregular_verbs' | 'prepositions'
 */
export async function pickSmartItems(topic = 'irregular_verbs', count = 20) {
  let candidates;
  if (topic === 'irregular_verbs') {
    const table = await loadVerbTable();
    candidates = table.map((r) => ({ id: r.verb, tier: r.tier || 1 }));
  } else if (topic === 'prepositions') {
    const useCases = await loadPrepositions();
    candidates = useCases.map((uc) => ({ id: uc.id, tier: 1 }));
  } else if (TOPIC_REGISTRY[topic] && TOPIC_REGISTRY[topic].file) {
    const def = await loadGapTopic(topic);
    candidates = (def.items || []).map((it) => ({ id: it.id, tier: 1 }));
  } else {
    throw new Error(`pickSmartItems: unknown topic "${topic}"`);
  }
  return rankItems({ candidates, stats: readTopicItems(topic), count });
}

/* Chain order (owner decision 2026-11-21): a verb's 3rd form is asked only
   directly after its 2nd form, and then with the 2nd form shown
   (go → went → ___). Asking the 3rd form with the 2nd blank made players
   answer the 2nd form. Lone 3rd-form questions are dropped (showing the 2nd
   form there would give the answer away for verbs like put → put → put).
   Added fields (copies, the cached data is not changed):
     chain_next: true   on a 2nd-form item whose 3rd form comes next — the
                        drill must not reveal the 3rd form after it
     chain_past: 'went' on the 3rd-form item — show it in the 2nd slot
   `limit` counts questions; a pair that does not fit is cut to its 2nd form. */
function _chainOrder(list, limit) {
  const pp = new Map();
  for (const q of list) if (q.form === 'participle' && !pp.has(q.verb)) pp.set(q.verb, q);
  const seen = new Set();
  const out = [];
  const max = typeof limit === 'number' && limit >= 0 ? limit : Infinity;
  for (const q of list) {
    if (out.length >= max) break;
    if (q.form !== 'past' || seen.has(q.verb)) continue;
    seen.add(q.verb);
    const third = pp.get(q.verb);
    if (third && out.length + 2 <= max) {
      out.push({ ...q, chain_next: true }, { ...third, chain_past: q.correct_answer });
    } else {
      out.push({ ...q });
    }
  }
  return out;
}

/* ── Utilities ──────────────────────────────────────────────────────────── */

/**
 * Deep-merge `overrides` into `base`, returning a new object. Plain-object
 * values are recursed; everything else (strings, numbers, booleans, null,
 * arrays) is replaced wholesale by `overrides[key]`. Arrays are never
 * merged — an override array replaces the base array entirely. Neither
 * input is mutated.
 */
function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function _deepMergeStrings(base, overrides) {
  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = base[k];
  }
  for (const k of Object.keys(overrides)) {
    const bv = base[k];
    const ov = overrides[k];
    if (_isPlainObject(bv) && _isPlainObject(ov)) {
      out[k] = _deepMergeStrings(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

/** Fisher–Yates in place; returns the array. */
function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick `n` distinct verb base forms with tier-weighted random selection.
 *
 * The mix is driven by the user's lifetime attempt count via getOverall():
 *   • newbies (<50 attempts) draw only tier-1 verbs;
 *   • later bands progressively introduce tier 2 and 3.
 * If a tier's bucket is exhausted (e.g. n > tier-1 verb count for a new
 * user), the remainder is topped up from the next non-empty tier so the
 * caller always gets n verbs when the catalog allows.
 *
 * Drills that don't want this behavior can call pickRandomVerbsUniform()
 * for the legacy uniform-shuffle pick.
 */
export async function pickRandomVerbs(n) {
  const table = await loadVerbTable();
  let totalAttempts = 0;
  try { totalAttempts = (getOverall() || {}).total_attempts || 0; }
  catch (_) { /* stats unavailable — treat as new user */ }
  const weights = tierWeightsForAttempts(totalAttempts);

  // Bucket verbs by tier; entries with no tier fall into tier 1 (safe default).
  const buckets = { 1: [], 2: [], 3: [] };
  for (const t of table) {
    const tier = (t.tier === 2 || t.tier === 3) ? t.tier : 1;
    buckets[tier].push(t.verb);
  }
  for (const k of [1, 2, 3]) buckets[k] = _shuffle(buckets[k].slice());

  const out = [];
  const used = new Set();
  let safety = n * 8;
  while (out.length < n && safety-- > 0) {
    let tier = _pickWeightedTier(weights);
    // Walk down tiers until we find a bucket with an unused verb.
    for (let step = 0; step < 3; step++) {
      const candidate = buckets[tier].pop();
      if (candidate !== undefined && !used.has(candidate)) {
        used.add(candidate);
        out.push(candidate);
        break;
      }
      // Bucket empty or duplicate — try the next tier (1→2→3→1)
      tier = (tier % 3) + 1;
    }
  }
  // Final top-up if some tiers are completely exhausted but others still have items
  if (out.length < n) {
    for (const k of [1, 2, 3]) {
      while (out.length < n && buckets[k].length) {
        const v = buckets[k].pop();
        if (!used.has(v)) { used.add(v); out.push(v); }
      }
    }
  }
  return out;
}

/** Uniform-random pick — kept for callers that don't want tier weighting. */
export async function pickRandomVerbsUniform(n) {
  const table = await loadVerbTable();
  return _shuffle(table.map((t) => t.verb)).slice(0, n);
}

/**
 * Uniform-random pick of `n` distinct preposition use-case ids. No tier
 * weighting — preposition use cases have no tier field (intentional for
 * v1; uniform random is the right default).
 */
export async function pickRandomPrepositions(n) {
  const useCases = await loadPrepositions();
  const ids = useCases.map((uc) => uc.id);
  return _shuffle(ids).slice(0, n);
}

/**
 * Look up a single verb's row in the derived table. Returns null if missing.
 */
export async function getVerbRow(verb) {
  const table = await loadVerbTable();
  return table.find((t) => t.verb === verb) || null;
}

/**
 * Look up a single preposition use-case by id. Returns the raw object from
 * loadPrepositions() (with examples[] preserved), or null if not found.
 */
export async function getPrepositionUseCase(id) {
  const useCases = await loadPrepositions();
  return useCases.find((uc) => uc.id === id) || null;
}

/**
 * Clear the in-memory caches. Useful for tests; not needed in production.
 */
export function _resetCache() {
  _verbsPromise = null;
  _tablePromise = null;
  _stringsPromises.clear();
  _stringsBasePromises.clear();
  _topicsPromise = null;
  _gamesPromise = null;
  _prepositionsPromise = null;
  _prepositionReferencePromise = null;
}
