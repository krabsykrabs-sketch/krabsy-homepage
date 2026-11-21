import { Sound } from './audio.js';
import { Forge } from './forge.js';
import { CONFIG, TOWER_ORDER } from './config.js';
import { Level } from './level.js';
import { Tower } from './tower.js';
import { Renderer } from './renderer.js';
import { Grid } from './grid.js';
import { Wave } from './wave.js';
import { state, sellTower } from './main.js';

// Mouse, touch, and keyboard handling. Placement is allowed during BUILD and BATTLE
// (you can keep building while enemies attack); terminal and overlay phases block it.

export const Input = {
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mouseleave', () => { state.mouseWorld = null; });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); this.cancelPlacement(); });
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
  },

  // 3D: raycast the cursor onto the ground plane. Returns tile coords {x, y} or
  // null when the ray misses the ground (e.g. pointing at the sky).
  _screenToWorld(clientX, clientY) {
    return Renderer.screenToWorld(clientX, clientY);
  },

  _gameAcceptsInput() {
    // Placement / selection are live during BUILD and BATTLE. WAVE_COMPLETE shows a
    // modal overlay; GAME_OVER and VICTORY are terminal.
    return state.phase === 'BUILD' || state.phase === 'BATTLE';
  },

  _onMouseMove(e) {
    state.mouseWorld = this._screenToWorld(e.clientX, e.clientY);
  },

  _onMouseDown(e) {
    if (e.button !== 0) return;
    if (!this._gameAcceptsInput()) return;
    if (this._selectTowerAt(e.clientX, e.clientY)) return;
    const w = this._screenToWorld(e.clientX, e.clientY);
    if (!w) return;
    this._handleClick(w);
  },

  _onTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    if (!this._gameAcceptsInput()) return;
    e.preventDefault();
    const t = e.touches[0];
    state.mouseWorld = null;
    if (this._selectTowerAt(t.clientX, t.clientY)) return;
    const w = this._screenToWorld(t.clientX, t.clientY);
    if (!w) return;
    this._handleClick(w);
  },

  // When not placing, a click on a tower model selects that tower.
  _selectTowerAt(clientX, clientY) {
    if (state.placement.active) return false;
    const tower = Renderer.pickTower(clientX, clientY);
    if (!tower) return false;
    state.selectedTower = tower;
    state.buildCell = null;
    return true;
  },

  _handleClick(worldPos) {
    if (worldPos.x < 0 || worldPos.y < 0) return;
    const level = Level.current;
    if (worldPos.x >= level.gridWidth || worldPos.y >= level.gridHeight) return;

    const { cellX, cellY } = Grid.worldToPlacementCell(worldPos.x, worldPos.y);

    // Card first, then hex.
    if (state.placement.active) {
      if (this._place(state.placement.towerType, cellX, cellY)) this.cancelPlacement();
      return;
    }

    // Hex first: tap a tower to select it, tap free grass to choose a building spot
    // (the tower cards then build right there). Tapping it again lets go.
    const t = Grid.towerAtCell(cellX, cellY);
    state.selectedTower = t || null;
    const same = state.buildCell && state.buildCell.cellX === cellX && state.buildCell.cellY === cellY;
    state.buildCell = (!t && !same && Grid.isAvailable(cellX, cellY)) ? { cellX, cellY } : null;
    if (state.buildCell) Sound.play('click');
  },

  // Build a tower on a cell if it is free and affordable. Returns true when built.
  _place(type, cellX, cellY) {
    const def = CONFIG.TOWERS[type];
    if (!def) return false;
    if (!Grid.isAvailable(cellX, cellY)) return false;
    if (state.coins < def.cost) return false;

    state.coins -= def.cost;
    const tower = new Tower(type, cellX, cellY);
    state.towers.push(tower);
    Grid.occupy(cellX, cellY, tower);
    state.buildCell = null;
    state.selectedTower = tower;
    Sound.play('place');
    return true;
  },

  _onKeyDown(e) {
    // While the forge is open the keyboard answers questions.
    if (state.forge.open) {
      const f = state.forge;
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') { Forge.close(state); return; }
      if (f.stage === 'ask') {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= f.q.options.length) Forge.answer(state, n - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        Forge.next(state);
      }
      if (e.key === ' ') e.preventDefault();
      return;
    }
    if (e.key === 'f' || e.key === 'F') { Forge.open(state); return; }

    if (e.key === 'Escape') { this.cancelPlacement(); state.selectedTower = null; state.buildCell = null; return; }

    if (e.key === ' ') {
      if (state.phase === 'BUILD') { Wave.startNext(state); e.preventDefault(); }
      return;
    }

    if (!this._gameAcceptsInput()) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedTower) {
      sellTower(state.selectedTower);
      e.preventDefault();
      return;
    }

    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= TOWER_ORDER.length) {
      this.toggleTowerPlacement(TOWER_ORDER[n - 1]);
    }
  },

  toggleTowerPlacement(type) {
    if (!CONFIG.TOWERS[type]) return;
    if (!this._gameAcceptsInput()) return;
    // A building spot is already chosen: build there straight away.
    if (state.buildCell) {
      if (!this._place(type, state.buildCell.cellX, state.buildCell.cellY)) Sound.play('click');
      return;
    }
    Sound.play('click');
    if (state.placement.active && state.placement.towerType === type) {
      this.cancelPlacement();
      return;
    }
    if (state.coins < CONFIG.TOWERS[type].cost) return;
    state.placement.active = true;
    state.placement.towerType = type;
    state.selectedTower = null;
    state.buildCell = null;
  },

  cancelPlacement() {
    state.placement.active = false;
    state.placement.towerType = null;
  },
};
