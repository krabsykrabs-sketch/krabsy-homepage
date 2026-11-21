// Level 1 — "Meadow". One winding road from the west edge to the castle in the east.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
window.LEVEL1 = {
  name: "Meadow",
  tagline: "A gentle stroll to start.",
  cols: 13,
  rows: 9,
  seed: 7,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        [0, 2], [1, 2], [2, 2], [3, 2], [3, 3], [4, 4], [4, 5], [5, 6], [6, 6],
        [7, 6], [8, 6], [8, 5], [9, 4], [9, 3], [10, 2], [11, 2], [12, 2],
      ],
    },
  ],
  startingLives: 10,
  startingCoins: 60,
  totalWaves: 20,
  enemyScaling: {
    baseEnemyHealth: 30,
    healthPerWave: 15,
    baseEnemyCount: 5,
    enemiesPerWave: 1.5,
    baseEnemySpeed: 2,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 10 },
};
