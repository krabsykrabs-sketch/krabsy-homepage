import { Level, HEX, hexCenter } from './level.js';

// Placement grid. One hex = one building spot. A cell is *structurally valid* if it is
// plain grass (no road, water, scenery or castle); that never changes after level load.
// A cell is *occupied* when a tower sits on it. *Available* = valid AND not occupied.
// Cell coordinates are (cellX = column, cellY = row) in odd-r offset layout.

export const Grid = {
  cellsX: 0,
  cellsY: 0,
  structuralValid: [],           // [cellY][cellX] boolean
  towerByCell: new Map(),        // key "cx,cy" → Tower

  init(level) {
    this.cellsX = level.cols;
    this.cellsY = level.rows;
    this.structuralValid = [];
    this.towerByCell.clear();
    for (let cy = 0; cy < this.cellsY; cy++) {
      const row = new Array(this.cellsX);
      for (let cx = 0; cx < this.cellsX; cx++) row[cx] = Level.cellType(cx, cy) === 'ground';
      this.structuralValid[cy] = row;
    }
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

  // Nearest hex to a world point. May return a cell outside the board (check inBounds).
  worldToPlacementCell(wx, wy) {
    const r0 = Math.round((wy - HEX.RADIUS) / HEX.ROW);
    let best = null, bestD = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const c0 = Math.round((wx - 1 - (r & 1)) / HEX.WIDTH);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const p = hexCenter(c, r);
        const d = (p.x - wx) ** 2 + (p.y - wy) ** 2;
        if (d < bestD) { bestD = d; best = { cellX: c, cellY: r }; }
      }
    }
    return best;
  },

  placementCellToWorld(cellX, cellY) {
    const p = hexCenter(cellX, cellY);
    return { centerX: p.x, centerY: p.y };
  },
};
