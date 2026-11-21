import { Sound } from './audio.js';
import { CONFIG } from './config.js';
import { Level } from './level.js';
import { Effects } from './effects.js';
import { Questions } from './questions.js';

// The forge: the game's question moment. It is self-paced — the player opens it when
// they want coins (any time during build or battle), answers as many questions as
// they have hammers for, and closes it again. Every wave refills the hammers.
//
//   right answer → coins fly in from the castle, next question follows by itself
//   wrong answer → no coins, the full chain is shown, the player presses "next"
//                  when ready; the question comes back a little later
//
// Either way the hammer is used up, so guessing does not pay. While the forge is open
// during a battle the game runs in slow motion (CONFIG.forge.battleTimeScale):
// thinking is safe-ish but not free, like Verb Kitchen's sink.
//
// state.forge = { open, hammers, q, stage: 'idle'|'ask'|'right'|'wrong', picked, timer }
// state.stats = { asked, right }

export const Forge = {
  newState() {
    return { open: false, hammers: CONFIG.forge.hammersPerWave, q: null, stage: 'idle', picked: -1, timer: 0 };
  },

  refill(state) {
    state.forge.hammers = CONFIG.forge.hammersPerWave;
  },

  canOpen(state) {
    return (state.phase === 'BUILD' || state.phase === 'BATTLE') && state.forge.hammers > 0;
  },

  toggle(state) {
    if (state.forge.open) this.close(state);
    else this.open(state);
  },

  open(state) {
    if (state.forge.open || !this.canOpen(state)) return;
    state.forge.open = true;
    state.placement.active = false;
    state.placement.towerType = null;
    state.selectedTower = null;
    state.buildCell = null;
    Sound.play('click');
    this._ask(state);
  },

  close(state) {
    const f = state.forge;
    f.open = false;
    f.q = null;
    f.stage = 'idle';
    f.picked = -1;
  },

  _ask(state) {
    const f = state.forge;
    f.q = Questions.next();
    f.stage = 'ask';
    f.picked = -1;
    f.timer = 0;
  },

  answer(state, index) {
    const f = state.forge;
    if (!f.open || f.stage !== 'ask' || !f.q) return;
    if (index < 0 || index >= f.q.options.length) return;
    f.picked = index;
    f.hammers -= 1;
    state.stats.asked += 1;

    if (index === f.q.correctIndex) {
      state.stats.right += 1;
      f.stage = 'right';
      f.timer = 1.1;
      Sound.play('quizCorrect');
      // Coins are forged at the castle and fly to the purse.
      const goal = Level.current.goals[0];
      Effects.spawnFlyingCoins({ x: goal.x, y: goal.y }, CONFIG.forge.coinsPerRight);
    } else {
      Questions.markWrong(f.q);
      f.stage = 'wrong';
      Sound.play('quizWrong');
    }
  },

  // After the feedback: another question while hammers remain, else close.
  next(state) {
    const f = state.forge;
    if (!f.open || (f.stage !== 'right' && f.stage !== 'wrong')) return;
    if (f.hammers > 0) this._ask(state);
    else this.close(state);
  },

  // dt is real time (not slowed), so the feedback pause feels the same in battle.
  update(dt, state) {
    const f = state.forge;
    if (!f.open) return;
    if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') { this.close(state); return; }
    if (f.stage === 'right') {
      f.timer -= dt;
      if (f.timer <= 0) this.next(state);
    }
  },
};
