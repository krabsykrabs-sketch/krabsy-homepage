// Level 6 — "Winter Pass". Snow. The longest road, three crossings of the board,
// a frozen lake between the first two lanes.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
// Road cells were generated with tools/hex-path.py from a few anchor cells.
window.LEVEL6 = {
  name: "Winter Pass",
  tagline: "The longest road, in the snow.",
  cols: 15,
  rows: 11,
  seed: 53,
  season: "winter",
  sceneryDensity: 1.3,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1],
        [9, 1], [10, 1], [11, 1], [12, 1], [13, 2], [13, 3], [12, 3], [12, 4], [11, 4],
        [10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 5],
        [2, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
        [10, 7], [11, 7], [12, 8], [12, 9], [13, 9], [14, 9],
      ],
    },
  ],
  water: [[6, 2], [7, 2], [8, 2], [9, 2], [6, 3], [7, 3], [8, 3], [3, 9], [4, 9], [3, 10], [4, 10], [5, 10]],
  startingLives: 10,
  startingCoins: 70,
  totalWaves: 12,
  bossWaves: [6, 12],
  enemyScaling: {
    baseEnemyHealth: 58,
    healthPerWave: 40,
    baseEnemyCount: 5,
    enemiesPerWave: 1.1,
    baseEnemySpeed: 2.2,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 5 },
};
