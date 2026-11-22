import { Grid } from './grid.js';
import { Level } from './level.js';

// First-time coach for level 1. No text wall: one short line at a time, tied to what
// the player should do next, plus a pulse on the thing to press. Each step reacts to
// the game state, so doing things in another order never gets the player stuck.
//
//   1. tap a glowing hex next to the road      (state.hintCells)
//   2. pick a tower                            (pulse: tower cards)
//   3. start the wave                          (pulse: start button)
//   4. answer the forge question for coins     (pulse: forge card)
//      → tutorial finished, never shown again
//
// Sets state.hint = { key, target } (key = i18n string, target = what pulses) and
// state.hintCells = [{ cellX, cellY }].

const DONE_KEY = 'td3d_tutorial_done';

export const Tutorial = {
  _done: null,

  isDone() {
    if (this._done === null) {
      try { this._done = localStorage.getItem(DONE_KEY) === '1'; }
      catch { this._done = false; }
    }
    return this._done;
  },

  _finish() {
    this._done = true;
    try { localStorage.setItem(DONE_KEY, '1'); } catch { /* storage blocked */ }
  },

  update(state, levelIndex) {
    state.hint = null;
    state.hintCells = [];
    if (levelIndex !== 0 || this.isDone()) return;
    if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') return;

    const wave = state.currentWave;

    // Finished once a wave has started and a question has been answered.
    if (wave >= 1 && state.stats.asked > 0) { this._finish(); return; }

    if (state.phase === 'BUILD' && wave === 0) {
      if (state.towers.length === 0) {
        if (state.buildCell) {
          state.hint = { key: 'tutPickTower', target: 'towers' };
        } else {
          state.hint = { key: 'tutTapCell', target: null };
          state.hintCells = Level.current.tutorialCells
            .filter(([c, r]) => Grid.isAvailable(c, r))
            .map(([c, r]) => ({ cellX: c, cellY: r }));
        }
      } else {
        state.hint = { key: 'tutStart', target: 'start' };
      }
      return;
    }

    // From the first battle on: point at the forge card until it has been used.
    if (state.forge.stage === 'ask') state.hint = { key: 'tutForge', target: 'forge' };
  },
};
