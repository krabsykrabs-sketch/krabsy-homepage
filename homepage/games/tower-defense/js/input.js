import { Sound } from './audio.js';
import { Forge } from './forge.js';
import { CONFIG, TOWER_ORDER } from './config.js';
import { Level } from './level.js';
import { Tower } from './tower.js';
import { Renderer } from './renderer.js';
import { Grid } from './grid.js';
import { Wave } from './wave.js';
import { state, sellTower, isTowerLocked } from './main.js';
import { Track } from './analytics.js';

// Mouse, touch, and keyboard handling. Placement is allowed during BUILD and BATTLE
// (you can keep building while enemies attack); terminal and overlay phases block it.

export const Input = {
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseDrag(e));
    window.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('mouseleave', () => { state.mouseWorld = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
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

  // Camera moves (zoom, pan) work while a level is on screen.
  _cameraAllowed() {
    return state.phase === 'BUILD' || state.phase === 'BATTLE' || state.phase === 'WAVE_COMPLETE';
  },

  // A tap / click on the board: select a tower, choose a hex, or build.
  _tap(clientX, clientY) {
    if (!this._gameAcceptsInput()) return;
    const gate = state.gate;
    if (gate) {
      // Training: only the tower and the hexes the coach points at react.
      const tower = Renderer.pickTower(clientX, clientY);
      if (tower) { if (tower === gate.tower) { state.selectedTower = tower; state.buildCell = null; } return; }
      const w = this._screenToWorld(clientX, clientY);
      if (!w) return;
      const { cellX, cellY } = Grid.worldToPlacementCell(w.x, w.y);
      if (gate.tower && gate.tower.cellX === cellX && gate.tower.cellY === cellY) {
        state.selectedTower = gate.tower; state.buildCell = null; return;
      }
      if (!gate.cells.some((c) => c.cellX === cellX && c.cellY === cellY)) return;
      this._handleClick(w);
      return;
    }
    if (this._selectTowerAt(clientX, clientY)) return;
    const w = this._screenToWorld(clientX, clientY);
    if (!w) return;
    this._handleClick(w);
  },

  // Mouse: a short click acts on release; dragging pans the map (left button after a
  // few pixels, right / middle button at once). The wheel zooms toward the pointer.
  _onMouseDown(e) {
    if (e.button > 2) return;
    this._drag = {
      x: e.clientX, y: e.clientY, button: e.button,
      moved: e.button !== 0,
      grab: this._cameraAllowed() ? Renderer.screenToWorld(e.clientX, e.clientY) : null,
    };
  },

  _onMouseDrag(e) {
    const d = this._drag;
    if (!d || !d.grab) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (d.moved) {
      Renderer.panTo(e.clientX, e.clientY, d.grab);
      this.canvas.style.cursor = 'grabbing';
    }
  },

  _onMouseUp(e) {
    const d = this._drag;
    this._drag = null;
    this.canvas.style.cursor = '';
    if (!d || d.moved) return;
    if (d.button === 0) this._tap(d.x, d.y);
    else if (d.button === 2) this.cancelPlacement();
  },

  _onWheel(e) {
    e.preventDefault();
    if (!this._cameraAllowed()) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 30 : 1);
    Renderer.zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.0015));
  },

  // Touch: one finger taps (on release, if it did not move) or drags the map; two
  // fingers pinch to zoom and move the map together.
  _onTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    e.preventDefault();
    state.mouseWorld = null;
    const cam = this._cameraAllowed();
    if (e.touches.length === 1 && !this._touch) {
      const t = e.touches[0];
      this._touch = { x: t.clientX, y: t.clientY, moved: false, pinched: false,
        grab: cam ? Renderer.screenToWorld(t.clientX, t.clientY) : null };
    } else if (e.touches.length >= 2 && this._touch) {
      this._touch.pinched = true;
      this._startPinch(e);
    }
  },

  _pinchInfo(e) {
    const a = e.touches[0], b = e.touches[1];
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
      dist: Math.max(10, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) };
  },

  _startPinch(e) {
    const p = this._pinchInfo(e);
    this._touch.pinch = { dist: p.dist, grab: this._cameraAllowed() ? Renderer.screenToWorld(p.x, p.y) : null };
  },

  _onTouchMove(e) {
    e.preventDefault();
    const t = this._touch;
    if (!t) return;
    if (e.touches.length >= 2 && t.pinch) {
      const p = this._pinchInfo(e);
      if (!t.pinch.grab) return;
      Renderer.zoomAt(p.x, p.y, p.dist / t.pinch.dist);
      Renderer.panTo(p.x, p.y, t.pinch.grab);
      t.pinch.dist = p.dist;
      return;
    }
    if (e.touches.length === 1 && !t.pinched && t.grab) {
      const f = e.touches[0];
      if (!t.moved && Math.hypot(f.clientX - t.x, f.clientY - t.y) > 10) t.moved = true;
      if (t.moved) Renderer.panTo(f.clientX, f.clientY, t.grab);
    }
  },

  _onTouchEnd(e) {
    e.preventDefault();
    const t = this._touch;
    if (!t) return;
    if (e.touches.length > 0) {
      // A pinch lost one finger: wait until all are up; no tap from this gesture.
      if (t.pinch && e.touches.length === 1) t.pinch = null;
      return;
    }
    this._touch = null;
    if (!t.moved && !t.pinched) this._tap(t.x, t.y);
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
    if (isTowerLocked(type)) return false;
    if (!Grid.isAvailable(cellX, cellY)) return false;
    if (state.coins < def.cost) return false;

    state.coins -= def.cost;
    const tower = new Tower(type, cellX, cellY);
    state.towers.push(tower);
    Grid.occupy(cellX, cellY, tower);
    Track.built(state, tower, def.cost);
    state.buildCell = null;
    // Not selected automatically: the info panel would cover the board on small screens.
    state.selectedTower = null;
    Sound.play('place');
    return true;
  },

  _onKeyDown(e) {
    // Q / W / E answer the forge question (1–4 stay the tower keys).
    const answerKey = { q: 0, w: 1, e: 2 }[e.key.toLowerCase()];
    if (answerKey !== undefined && !e.ctrlKey && !e.metaKey && !e.altKey) {
      Forge.answer(state, answerKey);
      return;
    }

    if (e.key === 'Escape') { if (state.gate) return; this.cancelPlacement(); state.selectedTower = null; state.buildCell = null; return; }

    if (e.key === ' ') {
      if (state.phase === 'BUILD') { Wave.startNext(state); e.preventDefault(); }
      return;
    }

    if (!this._gameAcceptsInput()) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedTower && !state.gate) {
      sellTower(state.selectedTower);
      e.preventDefault();
      return;
    }

    // + / − zoom in and out around the middle of the map.
    if ((e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') && this._cameraAllowed()) {
      const r = this.canvas.getBoundingClientRect();
      Renderer.zoomAt(r.left + r.width * 0.42, r.top + r.height / 2, e.key === '-' || e.key === '_' ? 1 / 1.25 : 1.25);
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
    if (isTowerLocked(type) || (state.gate && !state.gate.cards.includes(type))) { Sound.play('nope'); return; }
    // A building spot is already chosen: build there straight away.
    if (state.buildCell) {
      if (!this._place(type, state.buildCell.cellX, state.buildCell.cellY)) {
        Sound.play('click');
        if (state.coins < CONFIG.TOWERS[type].cost) Forge.noCoins(state, type);
      }
      return;
    }
    Sound.play('click');
    if (state.placement.active && state.placement.towerType === type) {
      this.cancelPlacement();
      return;
    }
    if (state.coins < CONFIG.TOWERS[type].cost) { Forge.noCoins(state, type); return; }
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
