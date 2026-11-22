// Analytics for the Quiz Room (docs/game-analytics.md). Game id: 'quiz-room'.
// • The teacher page sends the game events (/lib/krabsy-game-events.js): level_start /
//   level_end for the quiz. Only counts and slugs, never names.
// • Child pages send answer counts: the same {type:'krabsy:attempt'} message
//   krabsy-stats.js announces. (Whether to also call recordAttempt() is an open
//   question for the owner, see CLAUDE.md.)
const GAME = 'quiz-room';
let send = null;
const ready = import('/lib/krabsy-game-events.js').then((m) => { send = m.gameEvent; }).catch(() => {});

export const analytics = {
  log: [], // QA: what was sent
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
