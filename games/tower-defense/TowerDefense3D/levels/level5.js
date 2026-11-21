// Level 5 — "Two Gates". Enemies come from two spawn points, north-west and
// south-west; the roads meet early and wind on to one castle in the south-east.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
// Road cells were generated with tools/hex-path.py from a few anchor cells.
window.LEVEL5 = {
  name: "Two Gates",
  tagline: "Enemies from two sides.",
  cols: 14,
  rows: 10,
  seed: 31,
  season: "summer",
  paths: [
    { spawnWeight: 1, cells: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [4, 3], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [9, 3], [10, 3], [11, 2], [12, 2], [12, 3], [13, 4], [12, 5], [12, 6], [12, 7], [13, 8]] },
    { spawnWeight: 1, cells: [[0, 8], [1, 8], [2, 8], [3, 8], [3, 7], [4, 6], [5, 6], [5, 5], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [9, 3], [10, 3], [11, 2], [12, 2], [12, 3], [13, 4], [12, 5], [12, 6], [12, 7], [13, 8]] },
  ],
  water: [[11, 0], [12, 0], [1, 4], [2, 4], [1, 5], [8, 7], [9, 7]],
  startingLives: 10,
  startingCoins: 70,
  totalWaves: 11,
  bossWaves: [6, 11],
  enemyScaling: {
    baseEnemyHealth: 50,
    healthPerWave: 36,
    baseEnemyCount: 5,
    enemiesPerWave: 1.0,
    baseEnemySpeed: 2.0,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 5 },
};
