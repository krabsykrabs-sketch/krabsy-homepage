// Level 2 — "Crossroads". One road in from the west; at the junction it splits north
// and south, and each branch leads to its own castle. Two goals to defend at once.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
window.LEVEL2 = {
  name: "Crossroads",
  tagline: "One road in, two roads out.",
  cols: 13,
  rows: 9,
  seed: 23,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [5, 3], [6, 2],
        [7, 2], [8, 2], [9, 2], [10, 2], [11, 2], [12, 2],
      ],
    },
    {
      spawnWeight: 1,
      cells: [
        [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [5, 5], [6, 6],
        [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6],
      ],
    },
  ],
  startingLives: 10,
  startingCoins: 60,
  totalWaves: 9,
  towers: ['basic', 'catapult'],
  newTower: 'catapult',   // introduced with a card at the start of this level
  bossWaves: [5, 9],
  enemyScaling: {
    baseEnemyHealth: 36,
    healthPerWave: 22,
    baseEnemyCount: 4,
    enemiesPerWave: 0.8,
    baseEnemySpeed: 2.0,
  },
  economy: { baseCoinsPerKill: 1, waveCompletionBonus: 3 },
};
