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

/* ── UI strings ─────────────────────────────────────────────────────────── */

const _stringsPromises = new Map();

export function loadStrings(lang) {
  const effectiveLang = lang || getLang();
  if (!_stringsPromises.has(effectiveLang)) {
    const url = new URL(`ui_${effectiveLang}.json`, DATA_BASE);
    const p = fetch(url, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) {
          // Fall back to German if the requested language isn't available yet.
          if (effectiveLang !== DEFAULT_LANG) return loadStrings(DEFAULT_LANG);
          throw new Error(`Failed to load strings (${effectiveLang}): ${r.status}`);
        }
        return r.json();
      })
      .catch((err) => {
        _stringsPromises.delete(effectiveLang);
        throw err;
      });
    _stringsPromises.set(effectiveLang, p);
  }
  return _stringsPromises.get(effectiveLang);
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
 * Filter questions by criteria. All filters optional.
 *   type:        "fill_gap" | "type_form"
 *   difficulty:  number | number[]
 *   verbIds:     string[] (verb base forms — note: not the question ID,
 *                the brief calls these "verb ids", which are base verbs)
 *   form:        "past" | "participle"
 *   shuffle:     boolean (default false)
 *   limit:       number (applied after shuffle)
 */
export async function getQuestions(opts = {}) {
  const { type, difficulty, verbIds, form, shuffle = false, limit } = opts;
  const all = await loadVerbs();

  const diffSet = difficulty == null
    ? null
    : new Set(Array.isArray(difficulty) ? difficulty : [difficulty]);
  const verbSet = verbIds && verbIds.length ? new Set(verbIds) : null;

  let out = all.filter((q) => {
    if (type && q.type !== type) return false;
    if (diffSet && !diffSet.has(q.difficulty)) return false;
    if (verbSet && !verbSet.has(q.verb)) return false;
    if (form && q.form !== form) return false;
    return true;
  });

  if (shuffle) out = _shuffle(out.slice());
  if (typeof limit === 'number' && limit >= 0) out = out.slice(0, limit);
  return out;
}

/* ── Utilities ──────────────────────────────────────────────────────────── */

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
 * Look up a single verb's row in the derived table. Returns null if missing.
 */
export async function getVerbRow(verb) {
  const table = await loadVerbTable();
  return table.find((t) => t.verb === verb) || null;
}

/**
 * Clear the in-memory caches. Useful for tests; not needed in production.
 */
export function _resetCache() {
  _verbsPromise = null;
  _tablePromise = null;
  _stringsPromises.clear();
}
