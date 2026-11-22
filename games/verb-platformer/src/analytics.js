// What the platformer reports to the site (see docs/game-analytics.md and
// docs/phase1-game-wiring.md in the repo root).
//
// 1. Game events for the analytics dashboard: counts and game states only, no words, nothing
//    about the player. /lib/krabsy-game-events.js posts them to the wrapper page, whose tracker
//    sends them on. Without the site (local dev, file://) the import fails and nothing is sent;
//    without a parent page (bot, tests) the helper only fires a DOM event.
//      level_start  { level }
//      gate_passed  { level, gate, first_try, seconds }
//      wrong_answer { level, gate }
//      fell         { level, gate, cause: 'gap' | 'wrong' | 'hazard' }   gate = the one ahead
//      level_end    { level, result: 'won', stars, seconds, answers, correct, gates, falls }
//    Quitting needs no event: a level_start without level_end counts as "left", and the last
//    gate_passed / fell shows where.
// 2. Every first answer at a gate goes to the shared word statistics (recordAttempt), which the
//    smart verb mix (data/questions.js) and the site's statistics page read.
//
// `level` is the menu number (1-based). Editor playtests report nothing.

const GAME = 'verb-platformer';
let send = () => {};
let record = () => {};
import('/lib/krabsy-game-events.js')
  .then((m) => { if (typeof m.gameEvent === 'function') send = m.gameEvent; })
  .catch(() => { /* not on the site */ });
import('/lib/krabsy-stats.js')
  .then((m) => { if (typeof m.recordAttempt === 'function') record = m.recordAttempt; })
  .catch(() => { /* not on the site */ });

const run = { level: 0, active: false, falls: 0, answers: 0, correct: 0, lastPass: 0 };

function emit(name, data) {
  try { send(GAME, name, data); } catch (_) { /* analytics must never break the game */ }
}

export const Track = {
  // level: 1-based menu number, or 0 for a level outside the menu (editor) = report nothing.
  levelStart(level) {
    Object.assign(run, { level, active: level > 0, falls: 0, answers: 0, correct: 0, lastPass: 0 });
    if (run.active) emit('level_start', { level });
  },

  // gate: 1-based; firstTry: no wrong block at this gate before; seconds: level clock.
  gatePassed(gate, firstTry, seconds) {
    if (!run.active) return;
    run.answers += 1;
    run.correct += 1;
    emit('gate_passed', { level: run.level, gate, first_try: !!firstTry, seconds: Math.round(seconds) });
  },

  wrongAnswer(gate) {
    if (!run.active) return;
    run.answers += 1;
    emit('wrong_answer', { level: run.level, gate });
  },

  fell(gate, cause) {
    if (!run.active) return;
    run.falls += 1;
    emit('fell', { level: run.level, gate, cause });
  },

  levelEnd({ stars, seconds, gates }) {
    if (!run.active) return;
    run.active = false;
    emit('level_end', {
      level: run.level, result: 'won', stars, seconds: Math.round(seconds),
      answers: run.answers, correct: run.correct, gates, falls: run.falls,
    });
  },

  // Back to the menu or a restart mid-level: no event (the dashboard counts it as "left").
  abandon() { run.active = false; },

  // One record per question: the player's FIRST answer at a gate (retries after a fall are
  // not counted again). Not in editor playtests.
  answer(question, correct) {
    if (!run.active || !question?.verb) return;
    try { record(question.verb, question.form, !!correct, GAME, 'irregular_verbs'); } catch (_) { /* ignore */ }
  },
};
