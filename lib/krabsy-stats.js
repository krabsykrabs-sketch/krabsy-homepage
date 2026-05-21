/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Stats Module
   ES module. Records per-item mastery across drills and tools.

   ── Active schema (v2) ──────────────────────────────────────────────────
   Storage: localStorage["krabsy_stats_v2"] — single JSON blob, versioned.

   Shape:
   {
     "version": 2,
     "items": {
       "<topic>": {
         "<itemId>": {
           "<form>": { "attempts", "correct", "mastery", "last_seen" }
         }
       }
     },
     "overall": {
       "total_attempts", "total_correct",
       "best_streak", "current_streak",
       "first_seen", "sessions",
       "_last_attempt_iso"
     }
   }

   `items` is topic-namespaced so multiple grammar topics (irregular verbs,
   prepositions, …) can coexist. The `overall` block is cross-topic.

   The arcade games do NOT call this module. Only drills and tools that have
   a clear right/wrong moment record stats.

   Usage:
     import { recordAttempt, getOverall, hasData, ... } from '/lib/krabsy-stats.js';
     recordAttempt('fly', 'past', true, 'sprint', 'irregular_verbs');

   ── Historical schema (v1) ──────────────────────────────────────────────
   Storage: localStorage["krabsy_stats_v1"] (now migrated and removed).
   Kept here as a comment so old data layouts can be recognised during debugging.

     {
       "version": 1,
       "verbs": {
         "<verbId>": {
           "<form>": { "attempts", "correct", "mastery", "last_seen" }
         }
       },
       "overall": { ...same fields as v2 overall... }
     }

   Migration: see migrateV1toV2() below. Idempotent, non-destructive,
   backs up v1 data to krabsy_stats_v1_backup before transforming.
   ────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY        = 'krabsy_stats_v2';
const STORAGE_KEY_V1     = 'krabsy_stats_v1';
const STORAGE_KEY_BACKUP = 'krabsy_stats_v1_backup';
const DEFAULT_TOPIC      = 'irregular_verbs';
const DECAY_DAYS         = 14;
const SESSION_GAP_MIN    = 30;

let _state = null;
let _decayDone = false;

/* ── Migration v1 → v2 ──────────────────────────────────────────────────── */

function migrateV1toV2() {
  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY_V1); } catch (_) { return; /* private mode */ }
  if (!raw) return;                                  // no v1 data

  // v2 already populated — don't overwrite, just leave v1 alone for safety.
  try { if (localStorage.getItem(STORAGE_KEY)) return; } catch (_) { return; }

  try {
    const v1 = JSON.parse(raw);
    if (!v1 || v1.version !== 1 || !v1.verbs) {
      console.warn('krabsy-stats: v1 data exists but has unexpected shape, skipping migration');
      return;
    }

    // Backup BEFORE transforming. If this throws (quota), bail and leave v1 in place.
    try { localStorage.setItem(STORAGE_KEY_BACKUP, raw); }
    catch (err) {
      console.warn('krabsy-stats: could not write v1 backup, skipping migration', err);
      return;
    }

    const v2 = {
      version: 2,
      items: {
        [DEFAULT_TOPIC]: v1.verbs,
      },
      overall: v1.overall || _emptyOverall(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2));
    localStorage.removeItem(STORAGE_KEY_V1);

    console.info('krabsy-stats: migrated v1 → v2, backup at ' + STORAGE_KEY_BACKUP);
  } catch (err) {
    console.error('krabsy-stats: migration failed, leaving v1 intact', err);
    // v1 stays in place; later _load() will find no v2 and start fresh in-memory.
  }
}

// Run migration once, eagerly, at module load — before any API call.
migrateV1toV2();

/* ── State load/save ────────────────────────────────────────────────────── */

function _emptyOverall() {
  return {
    total_attempts: 0,
    total_correct: 0,
    best_streak: 0,
    current_streak: 0,
    first_seen: null,
    sessions: 0,
    _last_attempt_iso: null,
  };
}

function _emptyState() {
  return {
    version: 2,
    items: {},
    overall: _emptyOverall(),
  };
}

function _load() {
  if (_state) return _state;

  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { /* private mode */ }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 2 && parsed.items && parsed.overall) {
        _state = parsed;
      }
    } catch (_) { /* corrupted blob — fall through to empty */ }
  }

  if (!_state) _state = _emptyState();

  if (!_decayDone) {
    _decayDone = true;  // set first to prevent re-entry from runDecay
    _runDecayInternal();
  }
  return _state;
}

function _save() {
  if (!_state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (_) { /* quota / private mode — silently drop */ }
}

/* ── Time helpers ───────────────────────────────────────────────────────── */

function _nowIso() { return new Date().toISOString(); }

function _daysSince(iso) {
  if (!iso) return Infinity;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86400000);
}

/* ── Decay ──────────────────────────────────────────────────────────────── */

function _runDecayInternal() {
  if (!_state) return;
  const today = _nowIso();
  let changed = false;
  for (const topic of Object.keys(_state.items)) {
    const itemsInTopic = _state.items[topic];
    for (const itemId of Object.keys(itemsInTopic)) {
      const forms = itemsInTopic[itemId];
      for (const form of Object.keys(forms)) {
        const rec = forms[form];
        if (!rec || !rec.last_seen) continue;
        if (rec.mastery > 0 && _daysSince(rec.last_seen) > DECAY_DAYS) {
          rec.mastery = Math.max(0, rec.mastery - 1);
          rec.last_seen = today;
          changed = true;
        }
      }
    }
  }
  if (changed) _save();
}

/** Idempotent decay pass. Called automatically on first load. Runs across all topics. */
export function runDecay() {
  _load();
  _runDecayInternal();
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Record one answer.
 *   itemId  — opaque per-topic identifier (e.g. "fly" for irregular_verbs).
 *   form    — "past" | "participle"  (or future topic-specific form keys)
 *   correct — boolean
 *   source  — module name, e.g. "sprint", "flashcards" (not stored)
 *   topic   — topic key; defaults to "irregular_verbs" for back-compat.
 */
export function recordAttempt(itemId, form, correct, source, topic = DEFAULT_TOPIC) {
  if (!itemId || (form !== 'past' && form !== 'participle')) return;
  const s = _load();
  const now = _nowIso();

  // Session tracking — gap of > 30 min counts as a new session.
  const last = s.overall._last_attempt_iso;
  if (!last) {
    s.overall.sessions += 1;
    if (!s.overall.first_seen) s.overall.first_seen = now;
  } else {
    const gapMin = (Date.now() - new Date(last).getTime()) / 60000;
    if (gapMin > SESSION_GAP_MIN) s.overall.sessions += 1;
  }
  s.overall._last_attempt_iso = now;

  // Per-(topic, item, form) record.
  if (!s.items[topic]) s.items[topic] = {};
  const itemsInTopic = s.items[topic];
  if (!itemsInTopic[itemId]) itemsInTopic[itemId] = {};
  if (!itemsInTopic[itemId][form]) {
    itemsInTopic[itemId][form] = { attempts: 0, correct: 0, mastery: 0, last_seen: now };
  }
  const rec = itemsInTopic[itemId][form];
  rec.attempts += 1;
  rec.last_seen = now;
  if (correct) {
    rec.correct += 1;
    rec.mastery = Math.min(5, rec.mastery + 1);
  } else {
    rec.mastery = Math.max(0, rec.mastery - 1);
  }

  // Overall + streak (cross-topic)
  s.overall.total_attempts += 1;
  if (correct) {
    s.overall.total_correct += 1;
    s.overall.current_streak += 1;
    if (s.overall.current_streak > s.overall.best_streak) {
      s.overall.best_streak = s.overall.current_streak;
    }
  } else {
    s.overall.current_streak = 0;
  }

  _save();
}

/**
 * Returns { past: {...}, participle: {...} } or null if no record yet.
 * Both inner objects have shape { attempts, correct, mastery, last_seen }.
 */
export function getItemStats(itemId, topic = DEFAULT_TOPIC) {
  const s = _load();
  const t = s.items[topic];
  if (!t) return null;
  return t[itemId] || null;
}

// DEPRECATED — use getItemStats(itemId, topic) instead.
// Kept as an alias so any caller that wasn't updated still works.
export function getVerbStats(verbId) {
  return getItemStats(verbId, DEFAULT_TOPIC);
}

function _flattenRows(topic = null) {
  const s = _load();
  const rows = [];
  const topics = topic ? (s.items[topic] ? [topic] : []) : Object.keys(s.items);
  for (const t of topics) {
    const itemsInTopic = s.items[t];
    for (const itemId of Object.keys(itemsInTopic)) {
      const forms = itemsInTopic[itemId];
      for (const form of Object.keys(forms)) {
        const rec = forms[form];
        rows.push({
          verb: itemId,       // kept as `verb` for back-compat with renderers
          form,
          topic: t,
          mastery: rec.mastery,
          last_seen: rec.last_seen,
          attempts: rec.attempts,
          correct: rec.correct,
        });
      }
    }
  }
  return rows;
}

/**
 * Lowest mastery first; tie-break by most-recently-seen so freshly-struggled
 * pairs surface above old stale ones.
 *   topic — null = across all topics; specific key = that topic only.
 */
export function getStrugglers(n = 10, topic = null) {
  const rows = _flattenRows(topic);
  rows.sort((a, b) => {
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
  return rows.slice(0, n);
}

/**
 * Highest mastery first; tie-break by most-recent.
 *   topic — null = across all topics; specific key = that topic only.
 */
export function getMastered(n = 10, topic = null) {
  const rows = _flattenRows(topic);
  rows.sort((a, b) => {
    if (a.mastery !== b.mastery) return b.mastery - a.mastery;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
  return rows.slice(0, n);
}

/**
 * High-level summary for the stats page and progress widget.
 *   accuracy is a number in [0, 1].
 *   topic   — null = cross-topic totals (from stored overall block);
 *             specific key = totals computed on the fly over that topic's items.
 *             Per-topic streaks/sessions aren't tracked, so those fields
 *             come back as null when a topic is specified.
 */
export function getOverall(topic = null) {
  const s = _load();
  if (topic == null) {
    const o = s.overall;
    const accuracy = o.total_attempts > 0 ? o.total_correct / o.total_attempts : 0;
    return {
      total_attempts: o.total_attempts,
      total_correct: o.total_correct,
      accuracy,
      best_streak: o.best_streak,
      current_streak: o.current_streak,
      sessions: o.sessions,
      first_seen: o.first_seen,
    };
  }
  // Per-topic: compute attempts/correct from items[topic].
  const itemsInTopic = s.items[topic] || {};
  let attempts = 0, correct = 0;
  for (const itemId of Object.keys(itemsInTopic)) {
    const forms = itemsInTopic[itemId];
    for (const form of Object.keys(forms)) {
      attempts += forms[form].attempts || 0;
      correct  += forms[form].correct  || 0;
    }
  }
  return {
    total_attempts: attempts,
    total_correct: correct,
    accuracy: attempts > 0 ? correct / attempts : 0,
    best_streak: null,
    current_streak: null,
    sessions: null,
    first_seen: null,
  };
}

/**
 * True iff at least one attempt has ever been recorded.
 *   topic — null = any topic; specific key = that topic only.
 */
export function hasData(topic = null) {
  const s = _load();
  if (topic == null) return s.overall.total_attempts > 0;
  const itemsInTopic = s.items[topic];
  if (!itemsInTopic) return false;
  for (const itemId of Object.keys(itemsInTopic)) {
    const forms = itemsInTopic[itemId];
    for (const form of Object.keys(forms)) {
      if ((forms[form].attempts || 0) > 0) return true;
    }
  }
  return false;
}

/**
 * Reset stats.
 *   topic — null = wipe everything (used by the Stats page reset button);
 *           specific key = wipe only that topic's items, leave others
 *           and the cross-topic overall block intact.
 */
export function reset(topic = null) {
  const s = _load();
  if (topic == null) {
    _state = _emptyState();
    _decayDone = true; // nothing to decay
  } else {
    if (s.items[topic]) delete s.items[topic];
  }
  _save();
}

/* ── Display helpers ────────────────────────────────────────────────────── */

/**
 * Display band for a mastery integer 0–5. Matches the mastery_bands keys
 * in ui_de.json so callers can do strings.mastery_bands[masteryBand(m)]
 * (looked up via numeric key, which is what ui_de.json uses).
 *
 * Returns 'neu' | 'lernend' | 'vertraut' | 'gemeistert'.
 */
export function masteryBand(mastery) {
  if (mastery <= 0) return 'neu';
  if (mastery <= 2) return 'lernend';
  if (mastery <= 4) return 'vertraut';
  return 'gemeistert';
}

/**
 * Per-item aggregate mastery (max of past and participle), 0 if no record.
 * Used by the verb reference table's "Dein Stand" column.
 */
export function verbAggregateMastery(verbId, topic = DEFAULT_TOPIC) {
  const v = getItemStats(verbId, topic);
  if (!v) return 0;
  const m1 = (v.past && v.past.mastery) || 0;
  const m2 = (v.participle && v.participle.mastery) || 0;
  return Math.max(m1, m2);
}

/* ── Test hooks ─────────────────────────────────────────────────────────── */

/** Internal: clear in-memory cache so the next call reloads from storage. */
export function _resetCache() {
  _state = null;
  _decayDone = false;
}
