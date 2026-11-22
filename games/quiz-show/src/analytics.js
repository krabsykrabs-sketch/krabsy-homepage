// Analytics for the show (docs/game-analytics.md). Game id: 'quiz-show'.
// • Game events via /lib/krabsy-game-events.js (standard level_start / level_end, one
//   "level" per round, plus show_end). Only counts and slugs; team names are never sent.
// • Answer counts: the same {type:'krabsy:attempt'} message krabsy-stats.js announces,
//   but WITHOUT recordAttempt(): on a class device the answers of a whole class must not
//   land in that browser's personal learning stats (brief, "Answers and stats").
const GAME = 'quiz-show';
let send = null;
const ready = import('/lib/krabsy-game-events.js').then((m) => { send = m.gameEvent; }).catch(() => {});

export const analytics = {
  log: [], // QA: what would have been sent
  reset() { this.log = []; },
  event(name, data) {
    this.log.push({ name, data });
    ready.then(() => { try { send?.(GAME, name, data); } catch (_) {} });
  },
  attempt(correct) {
    const msg = { type: 'krabsy:attempt', correct: !!correct, source: GAME };
    this.log.push({ name: 'attempt', data: { correct: !!correct } });
    try { window.dispatchEvent(new CustomEvent('krabsy:attempt', { detail: msg })); } catch (_) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, window.location.origin); } catch (_) {}
  },
};
