// Game events for the site's analytics dashboard (master session, docs/game-analytics.md).
// Counts and game states only: no words, no answers' content, nothing about the player.
//
// The site helper /lib/krabsy-game-events.js posts each event to the wrapper page, whose
// tracker sends it on. Outside the site (local dev without /lib, file://) the import
// fails and every call is a no-op. Without a parent page (bot, tests) the helper only
// dispatches a DOM event, so nothing leaves the browser.

const GAME = 'verb-towers';
let send = () => {};
import('/lib/krabsy-game-events.js')
  .then((m) => { if (typeof m.gameEvent === 'function') send = m.gameEvent; })
  .catch(() => { /* not on the site: stay silent */ });

// Per-run counters. `level` is 1-based like the menu.
const run = {
  level: 0, active: false, seconds: 0, startCoins: 0, spent: 0, refunds: 0,
  towersBuilt: 0, leaked: 0, waveAsked: 0, waveRight: 0,
};

function emit(name, data) {
  try { send(GAME, name, data); } catch (_) { /* analytics must never break the game */ }
}

export const Track = {
  levelStart(levelIndex, state) {
    Object.assign(run, {
      level: levelIndex + 1, active: true, seconds: 0, startCoins: state.coins, spent: 0,
      refunds: 0, towersBuilt: 0, leaked: 0, waveAsked: 0, waveRight: 0,
    });
    emit('level_start', { level: run.level });
  },

  // Active play time (wall clock while a level runs).
  tick(realDt) { if (run.active) run.seconds += realDt; },

  waveStart(state) {
    if (!run.active) return;
    run.leaked = 0;
    emit('wave_start', {
      level: run.level, wave: state.currentWave, coins: state.coins, lives: state.lives,
      towers: state.towers.length,
    });
  },

  leak() { if (run.active) run.leaked += 1; },

  waveEnd(state) {
    if (!run.active) return;
    emit('wave_end', {
      level: run.level, wave: state.currentWave, lives: state.lives, coins: state.coins,
      leaked: run.leaked,
      answers: state.stats.asked - run.waveAsked, correct: state.stats.right - run.waveRight,
    });
    run.waveAsked = state.stats.asked;
    run.waveRight = state.stats.right;
  },

  built(state, tower, cost) {
    if (!run.active) return;
    run.spent += cost;
    run.towersBuilt += 1;
    emit('tower_built', {
      level: run.level, wave: state.currentWave, tower: tower.type, cost, coins_left: state.coins,
    });
  },

  upgraded(state, tower, cost) {
    if (!run.active) return;
    run.spent += cost;
    emit('tower_upgraded', {
      level: run.level, wave: state.currentWave, tower: tower.type, tier: tower.upgradeLevel + 1,
      cost, coins_left: state.coins,
    });
  },

  sold(state, tower, refund) {
    if (!run.active) return;
    run.refunds += refund;
    emit('tower_sold', { level: run.level, wave: state.currentWave, tower: tower.type, refund });
  },

  notEnoughCoins(state, type) {
    if (!run.active) return;
    emit('not_enough_coins', { level: run.level, wave: state.currentWave, tower: type });
  },

  levelEnd(state, won) {
    if (!run.active) return;
    run.active = false;
    emit('level_end', {
      level: run.level, result: won ? 'won' : 'lost', stars: won ? state.starsEarned : 0,
      wave: state.currentWave, lives: state.lives, seconds: Math.round(run.seconds),
      answers: state.stats.asked, correct: state.stats.right,
      // Income: everything the player has or spent, minus the start money and refunds.
      coins_earned: Math.max(0, state.coins + run.spent - run.refunds - run.startCoins),
      towers_built: run.towersBuilt,
    });
  },

  // Back to the menu mid-level: no event (the dashboard counts it as "left").
  abandon() { run.active = false; },
};
