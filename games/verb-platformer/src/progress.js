// Saved progress: one localStorage key, JSON.
//   krabsy_vp_progress = { v: 1, levels: { <level id>: { stars: 1–3, time: seconds|null } }, hint: true? }
// `stars` and `time` are each the best ever reached (they may come from different runs).
// The prototype's key `krabsy_3d_completed` (a list of level ids) is read once, turned into
// one-star entries without a time, and removed.
const KEY = 'krabsy_vp_progress';
const OLD_KEY = 'krabsy_3d_completed';

let cache = null;

function load() {
  if (cache) return cache;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { /* broken or blocked */ }
  if (!data || typeof data !== 'object' || typeof data.levels !== 'object' || !data.levels) {
    data = { v: 1, levels: {} };
  }
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (Array.isArray(old)) {
      for (const id of old) {
        if (typeof id === 'string' && !data.levels[id]) data.levels[id] = { stars: 1, time: null };
      }
      localStorage.removeItem(OLD_KEY);
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch (_) { /* ignore */ }
  cache = data;
  return data;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) { /* private mode: keep in memory */ }
}

/** Best result of a level, or null when it was never finished. */
export function getBest(id) {
  const e = load().levels[id];
  if (!e) return null;
  return { stars: Math.max(0, Math.min(3, e.stars | 0)), time: Number.isFinite(e.time) ? e.time : null };
}

/** Store a finished run. Returns { best, newBestTime, firstFinish }. */
export function saveResult(id, { stars, time }) {
  const data = load();
  const prev = data.levels[id];
  const prevTime = prev && Number.isFinite(prev.time) ? prev.time : null;
  const newBestTime = prevTime !== null && time < prevTime - 0.005;
  data.levels[id] = {
    stars: Math.max(prev?.stars | 0, stars),
    time: prevTime === null ? round2(time) : Math.min(prevTime, round2(time)),
  };
  save();
  return { best: getBest(id), newBestTime, firstFinish: !prev };
}

export function hintSeen() { return !!load().hint; }
export function markHintSeen() { load().hint = true; save(); }

/** Stars of a run: no wrong word = 3, one or two = 2, more = 1. */
export function starsFor(wrongAnswers) {
  return wrongAnswers === 0 ? 3 : wrongAnswers <= 2 ? 2 : 1;
}

/** 83.4 → "1:23" */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function round2(x) { return Math.round(x * 100) / 100; }
