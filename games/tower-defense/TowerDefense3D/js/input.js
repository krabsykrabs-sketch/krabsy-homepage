// Mouse, touch, and keyboard handling. Placement is allowed during BUILD and BATTLE
// (you can keep building while enemies attack); terminal and overlay phases block it.

const Input = {
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
    const w = this._screenToWorld(e.clientX, e.clientY);
    if (!w) return;
    this._handleClick(w);
  },

  _onTouchStart(e) {
    if (!e.touches || !e.touches[0]) return;
    if (!this._gameAcceptsInput()) return;
    e.preventDefault();
    const t = e.touches[0];
    const w = this._screenToWorld(t.clientX, t.clientY);
    state.mouseWorld = null;
    if (!w) return;
    this._handleClick(w);
  },

  _handleClick(worldPos) {
    if (worldPos.x < 0 || worldPos.y < 0) return;
    const level = Level.current;
    if (worldPos.x >= level.gridWidth || worldPos.y >= level.gridHeight) return;

    const { cellX, cellY } = Grid.worldToPlacementCell(worldPos.x, worldPos.y);

    if (state.placement.active) {
      this._tryPlace(cellX, cellY);
      return;
    }

    const t = Grid.towerAtCell(cellX, cellY);
    state.selectedTower = t || null;
  },

  _tryPlace(cellX, cellY) {
    const type = state.placement.towerType;
    const def = CONFIG.TOWERS[type];
    if (!def) { this.cancelPlacement(); return; }

    if (!Grid.isAvailable(cellX, cellY)) return;
    if (state.coins < def.cost) return;

    state.coins -= def.cost;
    const tower = new Tower(type, cellX, cellY);
    state.towers.push(tower);
    Grid.occupy(cellX, cellY, tower);
    this.cancelPlacement();
    state.selectedTower = tower;
    Sound.play('place');
  },

  _onKeyDown(e) {
    if (e.key === 'Escape') { this.cancelPlacement(); state.selectedTower = null; return; }

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
    Sound.play('click');
    if (state.placement.active && state.placement.towerType === type) {
      this.cancelPlacement();
      return;
    }
    if (state.coins < CONFIG.TOWERS[type].cost) return;
    state.placement.active = true;
    state.placement.towerType = type;
    state.selectedTower = null;
  },

  cancelPlacement() {
    state.placement.active = false;
    state.placement.towerType = null;
  },
};
