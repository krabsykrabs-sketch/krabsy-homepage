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

const DATA_BASE = new URL('../data/', import.meta.url);
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
            meaning_de: q.meaning_de || '',
          };
          byVerb.set(q.verb, entry);
        }
        if (!entry.meaning_de && q.meaning_de) entry.meaning_de = q.meaning_de;
        if (q.form === 'past' && !entry.past) entry.past = q.correct_answer;
        if (q.form === 'participle' && !entry.participle) entry.participle = q.correct_answer;
      }
      // Sort alphabetically by base form for stable iteration.
      return Array.from(byVerb.values()).sort((a, b) =>
        a.verb.localeCompare(b.verb)
      );
    });
  }
  return _tablePromise;
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
 * Convenience: pick `n` distinct verb base forms at random.
 * Useful for drills that draw a fresh random set of verbs each round.
 */
export async function pickRandomVerbs(n) {
  const table = await loadVerbTable();
  const verbs = table.map((t) => t.verb);
  return _shuffle(verbs.slice()).slice(0, n);
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
