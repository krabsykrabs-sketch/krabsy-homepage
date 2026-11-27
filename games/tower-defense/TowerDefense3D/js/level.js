import { TOWER_ORDER } from './config.js';
// Level loading for hex maps.
//
// A level file (levels/levelN.js, classic script → window.LEVELN) describes a board of
// pointy-top hexes in "odd-r" offset coordinates: cell (c, r), odd rows shifted half a
// hex to the right. It lists one or more enemy paths as chains of adjacent cells; the
// first cell of a path is the spawn, the last one holds the castle.
//
// World units: one hex is 2 units wide (KayKit Medieval Hexagon tiles), rows are √3
// apart. Game logic stays 2D: world (x, y) maps to scene (x, 0, y).

const R3 = Math.sqrt(3);

export const HEX = {
  WIDTH: 2,        // flat side to flat side
  ROW: R3,         // distance between rows
  RADIUS: 2 / R3,  // centre to corner
};

// Direction index k → neighbour. 0=E, 1=NE, 2=NW, 3=W, 4=SW, 5=SE (north = -y).
// A tile rotated by k·60° around the up axis has its "E" side pointing in direction k.
export function hexNeighbor(c, r, k) {
  const odd = r & 1;
  switch (k) {
    case 0: return [c + 1, r];
    case 1: return [c + odd, r - 1];
    case 2: return [c + odd - 1, r - 1];
    case 3: return [c - 1, r];
    case 4: return [c + odd - 1, r + 1];
    default: return [c + odd, r + 1];
  }
}

export function hexCenter(c, r) {
  return { x: 1 + c * HEX.WIDTH + (r & 1), y: HEX.RADIUS + r * HEX.ROW };
}

const key = (c, r) => `${c},${r}`;

// Scenery models that fill a whole hex (the cell is then not buildable).
const SCENERY_NEAR = ['trees_A_medium', 'trees_B_medium', 'trees_A_small', 'trees_A_large'];
const SCENERY_FAR = [
  'trees_A_large', 'trees_B_large', 'trees_A_large', 'trees_B_medium', 'trees_A_medium',
  'hills_A_trees', 'hills_B_trees', 'mountain_A_grass_trees',
];

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export const Level = {
  current: null,

  load(data) {
    const cols = data.cols, rows = data.rows;
    const cells = new Map();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.set(key(c, r), { c, r, type: 'ground', conn: new Set(), model: null, rot: 0 });
      }
    }
    const cellOf = (c, r) => {
      const cell = cells.get(key(c, r));
      if (!cell) throw new Error(`Level "${data.name}": cell ${c},${r} is outside the board`);
      return cell;
    };

    // Paths: mark cells, record which sides the road leaves through, build waypoints.
    const paths = data.paths.map((p) => {
      const list = p.cells;
      list.forEach(([c, r], i) => {
        const cell = cellOf(c, r);
        if (i === 0) cell.type = 'spawn';
        else if (i === list.length - 1) cell.type = 'goal';
        else if (cell.type === 'ground') cell.type = 'path';
        if (i === 0) return;
        const [pc, pr] = list[i - 1];
        let dir = -1;
        for (let k = 0; k < 6; k++) {
          const [nc, nr] = hexNeighbor(pc, pr, k);
          if (nc === c && nr === r) dir = k;
        }
        if (dir < 0) throw new Error(`Level "${data.name}": ${pc},${pr} → ${c},${r} are not neighbours`);
        cellOf(pc, pr).conn.add(dir);
        cell.conn.add((dir + 3) % 6);
      });

      const waypoints = list.map(([c, r]) => hexCenter(c, r));
      // Stop at the castle gate instead of its centre.
      const n = waypoints.length;
      const a = waypoints[n - 2], b = waypoints[n - 1];
      waypoints[n - 1] = { x: a.x + (b.x - a.x) * 0.55, y: a.y + (b.y - a.y) * 0.55 };
      return { spawnWeight: p.spawnWeight, waypoints };
    });

    for (const [c, r] of data.water || []) cellOf(c, r).type = 'water';

    // Scenery: forests and hills fill the land away from the road. Cells touching the
    // road always stay free so there is room to build.
    const roadCenters = [];
    for (const cell of cells.values()) {
      if (cell.type !== 'ground') roadCenters.push(hexCenter(cell.c, cell.r));
    }
    const keepFree = new Set((data.clear || []).map(([c, r]) => key(c, r)));
    const rnd = seededRandom(data.seed || 1);
    for (const cell of cells.values()) {
      if (cell.type !== 'ground') continue;
      const p = hexCenter(cell.c, cell.r);
      let d = Infinity;
      for (const q of roadCenters) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y));
      const roll = rnd(), pick = rnd(), turn = rnd();
      if (keepFree.has(key(cell.c, cell.r)) || d < 2.1) continue;
      const near = d < 4.1;
      const dense = data.sceneryDensity || 1;
      if (roll > (near ? 0.2 : 0.62) * dense) continue;
      const pool = near ? SCENERY_NEAR : SCENERY_FAR;
      cell.type = 'scenery';
      cell.model = pool[Math.floor(pick * pool.length)];
      cell.rot = Math.floor(turn * 6) * Math.PI / 3;
    }

    // The bottom-left corner stays free for the question card (owner, 2026-11-27): no
    // building spots there, just forest. tools/check-turns.mjs checks that no road
    // runs through it; the camera moves the map only if a spot would still be covered.
    const cf = data.cornerFree || { cols: 5, rows: 3 };
    const rndCorner = seededRandom((data.seed || 1) + 99);
    for (const cell of cells.values()) {
      if (cell.type !== 'ground' || cell.c >= cf.cols || cell.r < rows - cf.rows) continue;
      cell.type = 'scenery';
      cell.model = SCENERY_FAR[Math.floor(rndCorner() * SCENERY_FAR.length)];
      cell.rot = Math.floor(rndCorner() * 6) * Math.PI / 3;
    }

    this.current = {
      name: data.name,
      season: data.season || 'summer',
      cols, rows, cells,
      gridWidth: cols * HEX.WIDTH + 1,
      gridHeight: (rows - 1) * HEX.ROW + 2 * HEX.RADIUS,
      paths,
      // Castle positions (one per path end), e.g. where forged coins fly from.
      goals: data.paths.map(p => hexCenter(...p.cells[p.cells.length - 1])),
      startingLives: data.startingLives,
      startingCoins: data.startingCoins,
      totalWaves: data.totalWaves,
      bossWaves: data.bossWaves || [data.totalWaves],
      // Building spots the training coach highlights.
      tutorialCells: data.tutorialCells || [],
      enemyScaling: data.enemyScaling,
      economy: data.economy,
      // Training level: fully guided (js/tutorial.js); answers per wave override.
      training: !!data.training,
      orePerWave: data.orePerWave,
      trainingRightAnswers: data.trainingRightAnswers || 0,
      // Towers in the dock (levels introduce them one by one); all when not given.
      towers: data.towers || TOWER_ORDER.slice(),
      newTower: data.newTower || null,
    };
    return this.current;
  },

  cellAt(c, r) {
    return this.current ? this.current.cells.get(key(c, r)) || null : null;
  },

  // 'ground' | 'path' | 'spawn' | 'goal' | 'water' | 'scenery' | null (off board)
  cellType(c, r) {
    const cell = this.cellAt(c, r);
    return cell ? cell.type : null;
  },
};
