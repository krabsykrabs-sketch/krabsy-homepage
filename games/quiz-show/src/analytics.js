// Analytics for the Quiz Room (docs/game-analytics.md). Game id: 'quiz-room'.
// • The teacher page sends the game events (/lib/krabsy-game-events.js): level_start /
//   level_end for the quiz. Only counts and slugs, never names.
// • Child pages send answer counts: the same {type:'krabsy:attempt'} message
//   krabsy-stats.js announces, sent by recordAttempt() itself: each child's answers go
//   into the learning stats of their own browser (and their class, if they joined one).
//   Owner's recommended default (2026-11-22), see CLAUDE.md.
const GAME = 'quiz-room';
let send = null;
const ready = import('/lib/krabsy-game-events.js').then((m) => { send = m.gameEvent; }).catch(() => {});

export const analytics = {
  log: [], // QA: what was sent
  event(name, data) {
    this.log.push({ name, data });
    ready.then(() => { try { send?.(GAME, name, data); } catch (_) {} });
  },
  // One answer of this child, on their own device: into their learning stats (and, if
  // they joined a class, to the class: krabsy-stats.js does that). Falls back to the
  // bare answer count when the site library isn't there (local dev without /lib/).
  record(word, correct) {
    this.log.push({ name: 'record', data: { ...word, correct: !!correct } });
    import('/lib/krabsy-stats.js')
      .then((m) => m.recordAttempt(word.item, word.form, !!correct, GAME, word.topic))
      .catch(() => this.attempt(correct));
  },
  attempt(correct) {
    const msg = { type: 'krabsy:attempt', correct: !!correct, source: GAME };
    this.log.push({ name: 'attempt', data: { correct: !!correct } });
    try { window.dispatchEvent(new CustomEvent('krabsy:attempt', { detail: msg })); } catch (_) {}
    try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, window.location.origin); } catch (_) {}
  },
};
