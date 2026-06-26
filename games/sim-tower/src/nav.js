// Room navigation grid (collision). Marks furniture-footprint cells as blocked
// so residents path around them on free floor cells. Tiny grids → BFS is trivial.
import { footprintOf, GROUND } from './loader.js';

// Furniture that you cannot walk through (everything with a real footprint
// except flat rugs). Floors/walls are handled separately.
const BLOCK = new Set([
  'couch_pillows', 'couch', 'armchair', 'armchair_pillows',
  'chair_desk_A', 'chair_desk_B', 'chair_A', 'chair_B',
  'desk_decorated', 'desk', 'table_low_decorated',
  'cabinet_medium', 'cabinet_small', 'cabinet_medium_decorated', 'cabinet_small_decorated',
  'lamp_standing', 'bed_single_A', 'bed_single_B', 'bed_double_A', 'bed_double_B',
]);
const isFloorModel = (m) => m === 'Floor' || GROUND.has(m) || /^floor|^tile_/.test(m);

const ck = (c, r) => c + ',' + r;

export function buildRoomNav(level) {
  const { cols, rows, tile } = level.grid;
  const DEFAULT = level.catalog;
  const floorCells = new Set();
  const blocked = new Set();
  const footprintByObj = new Map();

  for (const o of level.objects) {
    const pack = o.pack || DEFAULT;
    const [w, d] = footprintOf(pack, o.model, tile);
    footprintByObj.set(o, [w, d]);
    for (let c = o.col; c < o.col + w; c++) {
      for (let r = o.row; r < o.row + d; r++) {
        if (isFloorModel(o.model)) floorCells.add(ck(c, r));
        if (BLOCK.has(o.model)) blocked.add(ck(c, r));
      }
    }
  }

  const inGrid = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
  const hasFloor = floorCells.size > 0;
  const walkable = (c, r) => inGrid(c, r) && !blocked.has(ck(c, r)) && (!hasFloor || floorCells.has(ck(c, r)));

  const cellCenter = (c, r) => ({ x: (c - (cols - 1) / 2) * tile, z: (r - (rows - 1) / 2) * tile });
  const worldToCell = (x, z) => ({
    c: Math.max(0, Math.min(cols - 1, Math.round(x / tile + (cols - 1) / 2))),
    r: Math.max(0, Math.min(rows - 1, Math.round(z / tile + (rows - 1) / 2))),
  });

  function nearestWalkable(c, r) {
    if (walkable(c, r)) return { c, r };
    for (let rad = 1; rad < cols + rows; rad++) {
      for (let dc = -rad; dc <= rad; dc++) for (let dr = -rad; dr <= rad; dr++) {
        if (Math.abs(dc) + Math.abs(dr) !== rad) continue;
        if (walkable(c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
    }
    return { c, r };
  }

  // BFS path (4-connectivity) of walkable cells, inclusive. `from` may be blocked
  // (e.g. leaving a seat) — we seed its walkable neighbours.
  function pathCells(from, to) {
    const tk = ck(to.c, to.r);
    if (!walkable(to.c, to.r)) { const w = nearestWalkable(to.c, to.r); to = w; }
    const start = walkable(from.c, from.r) ? from : nearestWalkable(from.c, from.r);
    const q = [start];
    const prev = new Map([[ck(start.c, start.r), null]]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const cur = q.shift();
      if (cur.c === to.c && cur.r === to.r) break;
      for (const [dc, dr] of dirs) {
        const nc = cur.c + dc, nr = cur.r + dr, k = ck(nc, nr);
        if (!walkable(nc, nr) || prev.has(k)) continue;
        prev.set(k, cur); q.push({ c: nc, r: nr });
      }
    }
    if (!prev.has(ck(to.c, to.r))) return [to];   // unreachable → go direct (rare)
    const out = []; let cur = to;
    while (cur) { out.unshift(cur); cur = prev.get(ck(cur.c, cur.r)); }
    return out;
  }

  /** A walkable cell adjacent to a piece's footprint, preferring the front (+row). */
  function approachCell(o) {
    const [w, d] = footprintByObj.get(o) || [1, 1];
    const cands = [];
    for (let c = o.col; c < o.col + w; c++) cands.push({ c, r: o.row + d, pref: 3 });   // front
    for (let r = o.row; r < o.row + d; r++) { cands.push({ c: o.col - 1, r, pref: 1 }); cands.push({ c: o.col + w, r, pref: 1 }); } // sides
    for (let c = o.col; c < o.col + w; c++) cands.push({ c, r: o.row - 1, pref: 0 });   // back
    cands.sort((a, b) => b.pref - a.pref);
    for (const cc of cands) if (walkable(cc.c, cc.r)) return { c: cc.c, r: cc.r };
    return nearestWalkable(o.col, o.row + d);
  }

  /** The piece's own cell adjacent to an approach cell (a single clean step on/off). */
  function seatCellFor(o, approach) {
    const [w, d] = footprintByObj.get(o) || [1, 1];
    const c = Math.max(o.col, Math.min(o.col + w - 1, approach.c));
    const r = Math.max(o.row, Math.min(o.row + d - 1, approach.r));
    return { c, r };
  }

  // a few free walkable cells in the front rows (for wander points)
  function frontCells(n = 2) {
    const out = [];
    for (let r = rows - 1; r >= 0 && out.length < n * 3; r--)
      for (let c = 0; c < cols; c++) if (walkable(c, r)) out.push({ c, r });
    return out;
  }

  return { cols, rows, tile, blocked, floorCells, walkable, cellCenter, worldToCell, nearestWalkable, pathCells, approachCell, seatCellFor, frontCells, footprintByObj };
}
