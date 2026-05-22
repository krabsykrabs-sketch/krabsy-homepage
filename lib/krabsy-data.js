/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Shared Data Loader
   ES module. Loads /data/irregular-verbs.json and /data/ui_<lang>.json,
   caches them, and exposes derived views.

   All paths resolve relative to this module's own location, so any page
   (drills/, tools/, reference/, stats/, the homepage) can import via the
   right relative path and the loader still finds /data/ correctly.

   Usage:
     import { loadVerbs, loadStrings, loadVerbTable, getQuestions,
              getLang, setLang } from '/lib/krabsy-data.js';
     const verbs = await loadVerbs();
     const ui = await loadStrings();
   ────────────────────────────────────────────────────────────────────────── */

import { getOverall } from './krabsy-stats.js';

const DATA_BASE = new URL('/data/', import.meta.url);
const LANG_KEY = 'krabsy_lang';
const DEFAULT_LANG = 'de';

/* ── Language ───────────────────────────────────────────────────────────── */

export function getLang() {
  try {
    return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
  } catch (_) {
    return DEFAULT_LANG;
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (_) { /* private mode, etc. */ }
}

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
          if (lang !== DEFAULT_LANG) return _loadStringsBase(DEFAULT_LANG);
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
  const effectiveLang = lang || getLang();
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
            meaning_de: q.meaning_de || '',
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
      const lang = getLang();
      const rows = Array.from(byVerb.values()).map((r) => ({
        ...r,
        meaning: lang === 'es' ? (r.meaning_es || r.meaning_de || '')
                               : (r.meaning_de || r.meaning_es || ''),
      }));
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
 * them from /data/ui_<lang>.json. `explanation` resolves to the current
 * language at call time (same pattern as loadVerbTable's `meaning`).
 */
export function loadPrepositionReference() {
  if (!_prepositionReferencePromise) {
    _prepositionReferencePromise = loadPrepositions()
      .then((useCases) => {
        const lang = getLang();
        const byGroup = new Map();
        const order = [];
        for (const uc of useCases) {
          if (!byGroup.has(uc.group)) {
            byGroup.set(uc.group, []);
            order.push(uc.group);
          }
          const explanation_de = (uc.explanation && uc.explanation.de) || '';
          const explanation_es = (uc.explanation && uc.explanation.es) || '';
          const examples = Array.isArray(uc.examples) ? uc.examples : [];
          byGroup.get(uc.group).push({
            id: uc.id,
            pattern: uc.pattern,
            correct: uc.correct,
            level: typeof uc.level === 'number' ? uc.level : null,
            explanation_de,
            explanation_es,
            explanation: lang === 'es'
              ? (explanation_es || explanation_de)
              : (explanation_de || explanation_es),
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
        meaning_de:       (uc.explanation && uc.explanation.de) || '',
        meaning_es:       (uc.explanation && uc.explanation.es) || '',

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
  } else {
    throw new Error(`getQuestions: unknown topic "${topic}"`);
  }

  if (shuffle) out = _shuffle(out.slice());
  if (typeof limit === 'number' && limit >= 0) out = out.slice(0, limit);
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
