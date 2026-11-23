import { Grid } from './grid.js';
import { Level } from './level.js';

// First-time coach for level 1. No text wall: one short line at a time, tied to what
// the player should do next, plus a pulse on the thing to press. Each step reacts to
// the game state, so doing things in another order never gets the player stuck.
//
//   1. tap a glowing hex next to the road      (state.hintCells)
//   2. pick a tower                            (pulse: tower cards)
//   3. start the wave                          (pulse: start button)
//   4. the question card arrives the first time the money runs out (or after wave 1):
//      answer it for coins                     (pulse: forge card)
//   5. once an upgrade is affordable: tap the tower with the ⬆ (its hex glows), then
//      press the upgrade button                (pulse: upgrade button)
//      → tutorial finished, never shown again (also when the level ends)
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

    const upgraded = state.towers.some((t) => t.upgradeLevel > 0);
    if (state.stats.asked > 0 && (upgraded || state.phase === 'VICTORY' || state.phase === 'GAME_OVER')) {
      this._finish();
      return;
    }
    if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') return;

    const wave = state.currentWave;

    if (state.phase === 'BUILD' && wave === 0 && state.towers.length === 0) {
      if (state.buildCell) {
        state.hint = { key: 'tutPickTower', target: 'towers' };
      } else {
        state.hint = { key: 'tutTapCell', target: null };
        state.hintCells = Level.current.tutorialCells
          .filter(([c, r]) => Grid.isAvailable(c, r))
          .map(([c, r]) => ({ cellX: c, cellY: r }));
      }
      return;
    }

    // The card has just arrived: answer it.
    if (!state.forge.hidden && state.stats.asked === 0) {
      if (state.forge.stage === 'ask') state.hint = { key: 'tutForge', target: 'forge' };
      return;
    }

    // Upgrades: as soon as one is affordable (comes before "start the wave").
    if (state.stats.asked > 0) {
      const sel = state.selectedTower;
      const canUp = (t) => { const up = t.nextUpgrade(); return up && state.coins >= up.cost; };
      if (sel && canUp(sel)) {
        state.hint = { key: 'tutUpgradeBtn', target: 'upgrade' };
        return;
      }
      const ready = state.towers.filter(canUp);
      if (ready.length) {
        state.hint = { key: 'tutUpgradeTap', target: null };
        state.hintCells = ready.map((t) => ({ cellX: t.cellX, cellY: t.cellY }));
        return;
      }
    }

    if (state.phase === 'BUILD' && wave === 0) state.hint = { key: 'tutStart', target: 'start' };
  },
};
