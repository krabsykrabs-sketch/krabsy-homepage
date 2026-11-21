import { Sound } from './audio.js';
import { CONFIG } from './config.js';
import { Level } from './level.js';
import { Effects } from './effects.js';
import { Questions } from './questions.js';

// The forge: the game's question moment and its main source of coins.
//
// One question is ALWAYS on screen in the forge card (side panel, or a strip above the
// dock on phones). The game never stops for it and it never times out: the player
// answers whenever they want coins — typically while the towers fight.
//
//   right answer → coins fly in from the castle; a streak pays a little extra;
//                  the next question follows after a short beat
//   wrong answer → no coins, the full chain is shown and the card is locked for a few
//                  seconds (guessing costs time; the pause is the teaching beat);
//                  the question comes back a little later
//
// Each wave brings a fixed amount of ore (CONFIG.forge.orePerWave); every answer uses
// one, right or wrong. That keeps the untimed build phase from being an endless coin
// farm and makes accuracy matter.
//
// state.forge = { ore, q, stage: 'ask'|'right'|'wrong'|'empty', picked, timer, lock,
//                 streak, lastGain }
// state.stats = { asked, right }

export const Forge = {
  newState() {
    return {
      ore: CONFIG.forge.orePerWave, q: null, stage: 'empty', picked: -1,
      timer: 0, lock: 0, streak: 0, lastGain: 0,
    };
  },

  // New wave cycle: fresh ore, and a question if the card was empty.
  refill(state) {
    const f = state.forge;
    f.ore = CONFIG.forge.orePerWave;
    if (f.stage === 'empty') this._ask(state);
  },

  active(state) {
    return state.phase === 'BUILD' || state.phase === 'BATTLE' || state.phase === 'WAVE_COMPLETE';
  },

  _ask(state) {
    const f = state.forge;
    if (f.ore <= 0) { f.q = null; f.stage = 'empty'; return; }
    f.q = Questions.next();
    f.stage = 'ask';
    f.picked = -1;
    f.timer = 0;
  },

  // Coins for the next right answer, including the streak bonus.
  reward(streak) {
    const c = CONFIG.forge;
    return c.coinsPerRight + Math.min(c.streakBonusMax, Math.floor(streak / c.streakEvery) * c.streakBonus);
  },

  answer(state, index) {
    const f = state.forge;
    if (!this.active(state) || f.stage !== 'ask' || !f.q) return;
    if (index < 0 || index >= f.q.options.length) return;
    f.picked = index;
    f.ore -= 1;
    state.stats.asked += 1;

    if (index === f.q.correctIndex) {
      state.stats.right += 1;
      f.lastGain = this.reward(f.streak);
      f.streak += 1;
      f.stage = 'right';
      f.timer = CONFIG.forge.rightPause;
      Sound.play('quizCorrect');
      // Coins burst out of the answer button and fly to the purse, so it is obvious
      // where they come from. Without a page (bot / tests) they start at the castle.
      const goal = Level.current.goals[0];
      Effects.spawnFlyingCoins({ x: goal.x, y: goal.y }, f.lastGain, this._buttonPoint(index));
    } else {
      Questions.markWrong(f.q);
      f.streak = 0;
      f.stage = 'wrong';
      f.timer = f.lock = CONFIG.forge.wrongLock;
      Sound.play('quizWrong');
    }
  },

  // Centre of an answer button in pixels relative to the canvas, or null.
  _buttonPoint(index) {
    if (typeof document === 'undefined') return null;
    const btn = document.querySelector(`.forge-answer[data-index="${index}"]`);
    const canvas = document.getElementById('game-canvas');
    if (!btn || !canvas) return null;
    const b = btn.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    if (b.width === 0) return null;
    return { x: b.left + b.width / 2 - c.left, y: b.top + b.height / 2 - c.top };
  },

  // dt is real time: the card keeps its own pace whatever the game speed is.
  update(dt, state) {
    const f = state.forge;
    if (!this.active(state)) return;
    if (f.stage === 'empty') {
      if (f.ore > 0) this._ask(state);
      return;
    }
    if (f.stage === 'right' || f.stage === 'wrong') {
      f.timer -= dt;
      if (f.timer <= 0) this._ask(state);
    }
  },
};
