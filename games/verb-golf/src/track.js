// What Verb Golf reports to the site (docs/game-analytics.md in the repo root).
// 1. Game events for the analytics dashboard (counts and states only, nothing about the player):
//      level_start { level }
//      hole_end    { level, hole, strokes, par, shots, penalties, gave_up }
//      level_end   { level, result: 'won', stars, seconds, answers, correct, strokes, par }
// 2. The first answer to every question goes to the shared word statistics (recordAttempt).
// Off the site (local dev) the imports fail and nothing is sent.
const GAME = 'verb-golf';
let send = () => {};
let record = () => {};
import('/lib/krabsy-game-events.js')
  .then((m) => { if (typeof m.gameEvent === 'function') send = m.gameEvent; })
  .catch(() => { /* not on the site */ });
import('/lib/krabsy-stats.js')
  .then((m) => { if (typeof m.recordAttempt === 'function') record = m.recordAttempt; })
  .catch(() => { /* not on the site */ });

export const log = []; // QA: everything that would be sent

function emit(name, data) {
  log.push([name, data]);
  try { send(GAME, name, data); } catch (_) { /* analytics must never break the game */ }
}

export const Track = {
  levelStart(level) { emit('level_start', { level }); },
  holeEnd(data) { emit('hole_end', data); },
  levelEnd(data) { emit('level_end', { result: 'won', ...data }); },
  answer(q, correct) {
    log.push(['answer', { verb: q.base, form: q.ask, correct }]);
    try { record(q.base, q.ask === 'past' ? 'past' : 'participle', !!correct, GAME, 'irregular_verbs'); } catch (_) { /* ignore */ }
  },
};
