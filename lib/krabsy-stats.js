/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — Stats Module
   ES module. Records per-verb mastery across drills and tools.

   Storage:  localStorage["krabsy_stats_v1"]  — single JSON blob, versioned.
   The arcade games do NOT call this module. Only drills and tools that have
   a clear right/wrong moment record stats.

   Usage:
     import { recordAttempt, getOverall, hasData, ... } from '/lib/krabsy-stats.js';
     recordAttempt('fly', 'past', true, 'sprint');
   ────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'krabsy_stats_v1';
const DECAY_DAYS = 14;
const SESSION_GAP_MIN = 30;

let _state = null;
let _decayDone = false;

/* ── State load/save ────────────────────────────────────────────────────── */

function _emptyState() {
  return {
    version: 1,
    verbs: {},
    overall: {
      total_attempts: 0,
      total_correct: 0,
      best_streak: 0,
      current_streak: 0,
      first_seen: null,
      sessions: 0,
      _last_attempt_iso: null,
    },
  };
}

function _load() {
  if (_state) return _state;

  let raw = null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { /* private mode */ }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) _state = parsed;
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
  for (const verb of Object.keys(_state.verbs)) {
    const forms = _state.verbs[verb];
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
  if (changed) _save();
}

/** Idempotent decay pass. Called automatically on first load. */
export function runDecay() {
  _load();
  _runDecayInternal();
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Record one answer.
 *   verbId  — base verb form, e.g. "fly", "go"
 *   form    — "past" | "participle"
 *   correct — boolean
 *   source  — module name, e.g. "sprint", "flashcards" (kept for future analytics; not stored)
 */
export function recordAttempt(verbId, form, correct, source) {
  if (!verbId || (form !== 'past' && form !== 'participle')) return;
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

  // Per-(verb, form) record
  if (!s.verbs[verbId]) s.verbs[verbId] = {};
  if (!s.verbs[verbId][form]) {
    s.verbs[verbId][form] = { attempts: 0, correct: 0, mastery: 0, last_seen: now };
  }
  const rec = s.verbs[verbId][form];
  rec.attempts += 1;
  rec.last_seen = now;
  if (correct) {
    rec.correct += 1;
    rec.mastery = Math.min(5, rec.mastery + 1);
  } else {
    rec.mastery = Math.max(0, rec.mastery - 1);
  }

  // Overall + streak
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
export function getVerbStats(verbId) {
  const s = _load();
  return s.verbs[verbId] || null;
}

function _flattenRows() {
  const s = _load();
  const rows = [];
  for (const verb of Object.keys(s.verbs)) {
    const forms = s.verbs[verb];
    for (const form of Object.keys(forms)) {
      const rec = forms[form];
      rows.push({
        verb,
        form,
        mastery: rec.mastery,
        last_seen: rec.last_seen,
        attempts: rec.attempts,
        correct: rec.correct,
      });
    }
  }
  return rows;
}

/**
 * Lowest mastery first; tie-break by most-recently-seen so freshly-struggled
 * pairs surface above old stale ones.
 */
export function getStrugglers(n = 10) {
  const rows = _flattenRows();
  rows.sort((a, b) => {
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
  return rows.slice(0, n);
}

/**
 * Highest mastery first; tie-break by most-recent.
 */
export function getMastered(n = 10) {
  const rows = _flattenRows();
  rows.sort((a, b) => {
    if (a.mastery !== b.mastery) return b.mastery - a.mastery;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
  return rows.slice(0, n);
}

/**
 * High-level summary for the stats page and progress widget.
 *   accuracy is a number in [0, 1].
 */
export function getOverall() {
  const s = _load();
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

/** True iff at least one attempt has ever been recorded. */
export function hasData() {
  return _load().overall.total_attempts > 0;
}

/** Wipe all stats. Used by the stats page reset button. */
export function reset() {
  _state = _emptyState();
  _decayDone = true; // nothing to decay
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
 * Per-verb aggregate mastery (max of past and participle), 0 if no record.
 * Used by the verb reference table's "Dein Stand" column.
 */
export function verbAggregateMastery(verbId) {
  const v = getVerbStats(verbId);
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
