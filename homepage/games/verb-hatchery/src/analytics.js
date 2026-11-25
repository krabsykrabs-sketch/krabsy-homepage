// Game events for the site dashboard (docs/game-analytics.md). On the site the
// game runs in an iframe and /lib/krabsy-game-events.js posts to the wrapper; in
// local dev the import fails and events only go to the console (?debug).
//
// This game has no levels, so a "level" = the next star: level = stars + 1.
// level_start when the game opens and after each star; level_end (result 'won')
// when a goal gives a star. Leaving before the next star counts as "left".
const GAME = 'verb-hatchery';
let send = null;
const debug = /[?&]debug/.test(location.search);
import('/lib/krabsy-game-events.js').then((m) => { send = m.gameEvent; }).catch(() => {});

// every event carries the topic (docs/game-contract.md 9)
const TOPIC = (() => { try { return (new URLSearchParams(location.search).get('topic') || 'irregular_verbs').replace(/[^a-z0-9_-]/g, '').slice(0, 32); } catch (_) { return 'irregular_verbs'; } })();
export function ev(name, data = {}) {
  data = { topic: TOPIC, ...data };
  try {
    if (debug) console.log('[event]', name, data);
    if (send) send(GAME, name, data);
  } catch (_) { /* analytics must never break the game */ }
}

// Per-level counters (reset at every level_start).
let lv = null;
export function levelStart(level) {
  lv = { level, t0: performance.now(), answers: 0, correct: 0 };
  ev('level_start', { level });
}
export function countAnswer(correct) {
  if (!lv) return;
  lv.answers++; if (correct) lv.correct++;
  visit.answers++; if (correct) visit.correct++;
}
export function levelEnd(extra) {
  if (!lv) return;
  ev('level_end', { level: lv.level, result: 'won', seconds: Math.round((performance.now() - lv.t0) / 1000),
    answers: lv.answers, correct: lv.correct, ...extra });
  lv = null;
}

// Once per visit, when the page is hidden or closed.
const visit = { t0: performance.now(), answers: 0, correct: 0, grabbed: 0, hatched: 0 };
let summarySent = false;
export function countVisit(key) { visit[key]++; }
export function onSummary(getExtra) {
  const fire = () => {
    if (summarySent) return;
    summarySent = true;
    ev('session_summary', { level: lv ? lv.level : 0, seconds: Math.round((performance.now() - visit.t0) / 1000),
      answers: visit.answers, correct: visit.correct, eggs_grabbed: visit.grabbed, hatched: visit.hatched, ...getExtra() });
  };
  addEventListener('pagehide', fire);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') fire(); });
}
