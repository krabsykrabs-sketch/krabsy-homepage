// Placement grid. The world tile map is partitioned into coarse 3×3 placement cells,
// aligned to the map origin. A cell is *structurally valid* if all 9 underlying tiles are
// ground; that flag never changes after level load. A cell is *occupied* when a tower
// sits on it — that flag flips on place/sell. *Available* = valid AND not occupied.

const Grid = {
  cellsX: 0,
  cellsY: 0,
  structuralValid: [],           // [cellY][cellX] boolean
  towerByCell: new Map(),        // key "cx,cy" → Tower

  init(level) {
    const size = CONFIG.placementCellSize;
    this.cellsX = Math.floor(level.gridWidth / size);
    this.cellsY = Math.floor(level.gridHeight / size);
    this.structuralValid = [];
    this.towerByCell.clear();

    for (let cy = 0; cy < this.cellsY; cy++) {
      const row = new Array(this.cellsX);
      for (let cx = 0; cx < this.cellsX; cx++) {
        row[cx] = this._allGround(cx, cy, size);
      }
      this.structuralValid[cy] = row;
    }
  },

  _allGround(cx, cy, size) {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const type = Level.tileTypeAt(cx * size + dx, cy * size + dy);
        if (type !== 'ground') return false;
      }
    }
    return true;
  },

  inBounds(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.cellsX && cy < this.cellsY;
  },

  isStructurallyValid(cx, cy) {
    return this.inBounds(cx, cy) && this.structuralValid[cy][cx];
  },

  isOccupied(cx, cy) {
    return this.towerByCell.has(`${cx},${cy}`);
  },

  isAvailable(cx, cy) {
    return this.isStructurallyValid(cx, cy) && !this.isOccupied(cx, cy);
  },

  occupy(cx, cy, tower) {
    this.towerByCell.set(`${cx},${cy}`, tower);
  },

  free(cx, cy) {
    this.towerByCell.delete(`${cx},${cy}`);
  },

  towerAtCell(cx, cy) {
    return this.towerByCell.get(`${cx},${cy}`) || null;
  },

  worldToPlacementCell(wx, wy) {
    const size = CONFIG.placementCellSize;
    return { cellX: Math.floor(wx / size), cellY: Math.floor(wy / size) };
  },

  placementCellToWorld(cellX, cellY) {
    const size = CONFIG.placementCellSize;
    return {
      centerX: cellX * size + size / 2,
      centerY: cellY * size + size / 2,
    };
  },
};
