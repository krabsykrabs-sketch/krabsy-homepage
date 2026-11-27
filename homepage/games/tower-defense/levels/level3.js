// Level 3 — "The Long March". A serpentine road that crosses the board three times
// before it reaches the castle. Long walks for the enemies, but they come fast, tough,
// and in greater numbers.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
window.LEVEL3 = {
  name: "The Long March",
  tagline: "Three laps of trouble.",
  cols: 13,
  rows: 9,
  seed: 41,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        // lane 1, eastbound
        [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1],
        [11, 2],
        // lane 2, westbound
        [10, 3], [9, 3], [8, 3], [7, 3], [6, 3], [5, 3], [4, 3], [3, 3], [2, 3],
        [2, 4],
        // lane 3, eastbound
        [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [11, 6], [11, 7], [12, 7],
      ],
    },
  ],
  startingLives: 8,
  startingCoins: 60,
  totalWaves: 10,
  towers: ['basic', 'catapult', 'cannon'],
  newTower: 'cannon',
  bossWaves: [5, 10],
  enemyScaling: {
    baseEnemyHealth: 59,
    healthPerWave: 46,
    baseEnemyCount: 6,
    enemiesPerWave: 1.4,
    baseEnemySpeed: 2.3,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 3 },
};
