// Level 4 — "Lakeside". Autumn. The road loops around a lake: towers on the shore
// reach two stretches of road, but the lake takes away building spots.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
// Road cells were generated with tools/hex-path.py from a few anchor cells.
window.LEVEL4 = {
  name: "Lakeside",
  tagline: "Autumn by the lake.",
  cols: 14,
  rows: 10,
  seed: 11,
  season: "fall",
  sceneryDensity: 1.8,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
        [9, 1], [10, 1], [11, 2], [12, 2], [12, 3], [12, 4], [11, 5], [11, 6], [10, 6],
        [9, 6], [8, 6], [7, 6], [6, 6], [5, 7], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8],
      ],
    },
  ],
  water: [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4]],
  startingLives: 10,
  startingCoins: 60,
  totalWaves: 10,
  towers: ['basic', 'catapult', 'cannon', 'freeze'],
  newTower: 'freeze',
  bossWaves: [5, 10],
  enemyScaling: {
    baseEnemyHealth: 63,
    healthPerWave: 47,
    baseEnemyCount: 5,
    enemiesPerWave: 1.2,
    baseEnemySpeed: 2.2,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 3 },
};
