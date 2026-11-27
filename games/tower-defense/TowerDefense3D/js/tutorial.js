import { Grid } from './grid.js';
import { Level } from './level.js';

// The training level's coach (level index -1, see levels/training.js). Every step is
// forced: one short line, a pulse on the one thing to press, and state.gate lets the
// player do only that (input.js, ui.js, wave.js, forge.js and main.js check it).
//
//   1. arrows run along the road to the castle; tap the one glowing hex
//   2. pick the archer tower
//   3. its range circle: "it shoots by itself at anything in the circle"; start wave 1
//   4. wave 1: watch
//   5. the question card arrives: answer until the upgrade is paid
//   6. tap the tower, 7. press upgrade
//   8. start the last wave (answers allowed from now on)
//   9. wave 2: "you can answer during a wave too"
//      → won: training done (td3d_tutorial_done), level 1 opens
//
// Sets state.hint = { key, target, arg }, state.hintCells, state.hintRoad,
// state.hintRange and state.gate = { cells, cards, tower, start, upgrade, answers }.

const DONE_KEY = 'td3d_tutorial_done';

export const Tutorial = {
  _done: null,

  // True once the training (or the old level-1 tutorial) has been finished.
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

  update(state) {
    state.hint = null;
    state.hintCells = [];
    state.hintRoad = false;
    state.hintRange = null;
    state.gate = null;
    if (!Level.current || !Level.current.training) return;
    if (state.phase === 'VICTORY') { this._finish(); return; }
    if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') return;

    const gate = { cells: [], cards: [], tower: null, start: false, upgrade: false, answers: false };
    state.gate = gate;
    const wave = state.currentWave;
    const tower = state.towers[0] || null;
    const spots = Level.current.tutorialCells.map(([c, r]) => ({ cellX: c, cellY: r }));

    if (wave === 0) {
      if (!tower) {
        state.hintRoad = true;
        gate.cells = spots;
        if (state.buildCell) {
          state.hint = { key: 'tutPickTower', target: 'tower:basic' };
          gate.cards = ['basic'];
        } else {
          state.hint = { key: 'tutTapCell', target: null };
          state.hintCells = spots.filter((s) => Grid.isAvailable(s.cellX, s.cellY));
        }
        return;
      }
      if (state.phase === 'BUILD') {
        state.hint = { key: 'tutStart', target: 'start' };
        state.hintRange = tower;
        gate.start = true;
        return;
      }
    }
    if (state.phase === 'BATTLE' && wave === 1) {
      state.hint = { key: 'tutWatch', target: null };
      state.hintRange = tower;
      return;
    }

    if (state.phase === 'BUILD' && wave === 1 && tower) {
      const up = tower.nextUpgrade();
      if (tower.upgradeLevel === 0 && up) {
        if (state.coins < up.cost) {
          state.hint = { key: 'tutAnswer', target: 'forge', arg: up.cost };
          gate.answers = true;
        } else if (state.selectedTower !== tower) {
          state.hint = { key: 'tutUpgradeTap', target: null };
          state.hintCells = [{ cellX: tower.cellX, cellY: tower.cellY }];
          gate.tower = tower;
        } else {
          state.hint = { key: 'tutUpgradeBtn', target: 'upgrade' };
          gate.tower = tower;
          gate.upgrade = true;
        }
        return;
      }
      state.hint = { key: 'tutLastWave', target: 'start' };
      gate.start = true;
      gate.answers = true;
      return;
    }
    if (state.phase === 'BATTLE') {
      state.hint = { key: 'tutAnswerAnytime', target: null };
      gate.answers = true;
    }
  },
};
