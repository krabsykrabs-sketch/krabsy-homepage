import { Grid } from './grid.js';
import { Level } from './level.js';

// First-time coach for level 1. No text wall: one short line at a time, tied to what
// the player should do next, plus a pulse on the thing to press. Each step reacts to
// the game state, so doing things in another order never gets the player stuck.
// Written for players who have never played a tower defense (owner, 2026-11-27).
//
//   1. arrows run along the road to the castle: "skeletons walk this road to your
//      castle"; tap a glowing hex next to it          (state.hintRoad, hintCells)
//   2. pick the archer tower (the others are locked until one stands)
//                                                      (pulse: archer card)
//   3. "your tower shoots by itself at anything in its circle" — start the wave
//                                                      (pulse: start; range circle)
//   4. wave 1: watch the tower shoot                   (range circle)
//   5. the question card arrives the first time the money runs out (or after
//      wave 1): answer it for coins                    (pulse: forge card)
//   6. once an upgrade is affordable: tap the tower with the badge, then press
//      the upgrade button                              (pulse: upgrade button)
//   7. build a second tower next to the road           (hintCells)
//      → tutorial finished, never shown again (also when the level ends)
//
// Sets state.hint = { key, target } (key = i18n string, target = what pulses),
// state.hintCells = [{ cellX, cellY }], state.hintRoad (road arrows) and
// state.hintRange (a tower whose range circle is shown).

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
    state.hintRoad = false;
    state.hintRange = null;
    if (levelIndex !== 0 || this.isDone()) return;

    const upgraded = state.towers.some((t) => t.upgradeLevel > 0);
    const ended = state.phase === 'VICTORY' || state.phase === 'GAME_OVER';
    if (state.stats.asked > 0 && ((upgraded && state.towers.length >= 2) || ended)) {
      this._finish();
      return;
    }
    if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') return;

    const wave = state.currentWave;
    const freeNearRoad = () => Level.current.tutorialCells
      .filter(([c, r]) => Grid.isAvailable(c, r))
      .map(([c, r]) => ({ cellX: c, cellY: r }));

    // 1–2: the goal, then the first tower (an archer).
    if (state.phase === 'BUILD' && wave === 0 && state.towers.length === 0) {
      state.hintRoad = true;
      if (state.buildCell) {
        state.hint = { key: 'tutPickTower', target: 'tower:basic' };
      } else {
        state.hint = { key: 'tutTapCell', target: null };
        state.hintCells = freeNearRoad();
      }
      return;
    }

    // 5: the card has just arrived: answer it.
    if (!state.forge.hidden && state.stats.asked === 0) {
      if (state.forge.stage === 'ask') state.hint = { key: 'tutForge', target: 'forge' };
      return;
    }

    // 6: upgrades, as soon as one is affordable (comes before "start the wave").
    if (state.stats.asked > 0) {
      const sel = state.selectedTower;
      const canUp = (t) => { const up = t.nextUpgrade(); return up && state.coins >= up.cost; };
      if (!upgraded && sel && canUp(sel)) {
        state.hint = { key: 'tutUpgradeBtn', target: 'upgrade' };
        return;
      }
      const ready = upgraded ? [] : state.towers.filter(canUp);
      if (ready.length) {
        state.hint = { key: 'tutUpgradeTap', target: null };
        state.hintCells = ready.map((t) => ({ cellX: t.cellX, cellY: t.cellY }));
        return;
      }
      // 7: a second tower once there is money for it.
      if (upgraded && state.towers.length < 2 && state.coins >= 30) {
        state.hint = { key: state.buildCell ? 'tutPickTower2' : 'tutMoreTowers', target: state.buildCell ? 'towers' : null };
        if (!state.buildCell) state.hintCells = freeNearRoad();
        return;
      }
    }

    // 3–4: the first tower stands; it shoots by itself at what is in its circle.
    const first = state.towers[0];
    if (state.phase === 'BUILD' && wave === 0) {
      state.hint = { key: 'tutStart', target: 'start' };
      state.hintRange = first || null;
      return;
    }
    if (state.phase === 'BATTLE' && wave === 1 && state.stats.asked === 0) {
      state.hint = { key: 'tutWatch', target: null };
      state.hintRange = first || null;
    }
  },
};
