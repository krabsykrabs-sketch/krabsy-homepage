// What Verb Dungeon reports to the site (docs/phase1-game-wiring.md and
// docs/game-analytics.md in the repo root).
//
// 1. Every FIRST answer to a question goes to the shared word statistics (recordAttempt in
//    /lib/krabsy-stats.js): book (both forms), chest, boss stone, rune walls (first wall =
//    2nd form, back wall = 3rd), bridge rows (A = 2nd, B = 3rd). A retry of the same question
//    after a wrong choice is not recorded again; a missed verb that comes back at a later
//    room is a new question and is recorded again. The smart verb mix (questions.js) and
//    the site's statistics page read these stats.
// 2. Game events for the analytics dashboard (gameEvent in /lib/krabsy-game-events.js):
//    counts and game states only, no words, nothing about the player.
//      level_start  { level }
//      room_done    { level, room, type, seconds, hits_taken }      the hero leaves the room
//      player_dizzy { level, room, type }                           0 hearts, the room restarts
//      boss_round   { level, boss, result: 'right' | 'wrong', form: 'past' | 'pp', pips }
//      level_end    { level, result: 'won', stars, seconds, answers, correct, first_try,
//                     questions, coins, rooms, hits_taken, dizzy }
//    There is no "lost": 0 hearts restarts the room, so a level ends won or is left (a
//    level_start without level_end = "left"; the last room_done / player_dizzy shows where).
//    answers = every choice made (retries included), correct = the right ones, first_try =
//    questions right at the first choice, questions = questions solved (the stars' ratio).
// Without the site (local dev serves only the game folder, file://) the imports fail and
// nothing is sent. `?qa=` runs report nothing unless `&track=1` (QA of this module).
// `level` and `room` are 1-based.

const GAME = 'verb-dungeon';
const TOPIC = 'irregular_verbs';
const params = new URLSearchParams(location.search);
const ON = !params.has('qa') || params.has('track');

let send = () => {};
let record = () => {};
if (ON) {
  import('/lib/krabsy-game-events.js')
    .then((m) => { if (typeof m.gameEvent === 'function') send = m.gameEvent; })
    .catch(() => { /* not on the site */ });
  // Without ?v=: the question engine imports the same URL (one shared stats cache).
  import('/lib/krabsy-stats.js')
    .then((m) => { if (typeof m.recordAttempt === 'function') record = m.recordAttempt; })
    .catch(() => { /* not on the site */ });
}

const run = { level: 0, active: false, t0: 0, answers: 0, correct: 0, hits: 0, dizzy: 0, rooms: 0 };
const rm = { t0: 0, hits: 0 };

function emit(name, data) {
  if (!ON) return;
  try { send(GAME, name, data); } catch (_) { /* analytics must never break the game */ }
}
const secs = (s) => Math.max(0, Math.round(s));

export const Track = {
  // level: 1-based; clock: G.wall (runs always, also while a card is open).
  levelStart(level, clock) {
    Object.assign(run, { level, active: true, t0: clock, answers: 0, correct: 0, hits: 0, dizzy: 0, rooms: 0 });
    emit('level_start', { level });
  },
  // A fresh room (not a dizzy restart of the same room).
  roomStart(clock) { rm.t0 = clock; rm.hits = 0; },
  hit() { if (run.active) { rm.hits += 1; run.hits += 1; } },
  dizzy(room, type) {
    if (!run.active) return;
    run.dizzy += 1;
    emit('player_dizzy', { level: run.level, room, type });
  },
  roomDone(room, type, clock) {
    if (!run.active) return;
    run.rooms += 1;
    emit('room_done', { level: run.level, room, type, seconds: secs(clock - rm.t0), hits_taken: rm.hits });
  },
  bossRound(boss, right, form, pips) {
    if (!run.active) return;
    emit('boss_round', { level: run.level, boss, result: right ? 'right' : 'wrong', form, pips });
  },
  levelEnd({ stars, clock, firstTry, questions, coins }) {
    if (!run.active) return;
    run.active = false;
    emit('level_end', {
      level: run.level, result: 'won', stars, seconds: secs(clock - run.t0),
      answers: run.answers, correct: run.correct, first_try: firstTry, questions,
      coins, rooms: run.rooms, hits_taken: run.hits, dizzy: run.dizzy,
    });
  },
  // Every choice (card chip, rune door, bridge stone). first = the question's first choice:
  // only that one goes to the word statistics.
  answer(q, right, first) {
    if (!run.active) return;
    run.answers += 1;
    if (right) run.correct += 1;
    if (!first || !q || !q.base) return;
    try { record(q.item || q.base, q.ask === 'pp' ? 'participle' : 'past', !!right, GAME, TOPIC); } catch (_) { /* ignore */ }
  },
};
