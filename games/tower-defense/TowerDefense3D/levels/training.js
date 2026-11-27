// Training — a very short, fully guided level before level 1 (owner, 2026-11-27).
// One straight road, two small waves. Every step is forced by the coach
// (js/tutorial.js): the player can only do the one thing it asks for.
// Hex map, odd-r offset cells [column, row]; see js/level.js for the format.
window.LEVEL_TRAINING = {
  name: "Training",
  training: true,
  cols: 11,
  rows: 5,
  seed: 3,
  paths: [
    {
      spawnWeight: 1,
      cells: [
        [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2],
      ],
    },
  ],
  startingLives: 10,
  startingCoins: 30,      // exactly one archer tower
  totalWaves: 2,
  towers: ['basic'],      // towers in the dock (the rest arrive in later levels)
  bossWaves: [],
  orePerWave: 99,         // wrong answers never run the card out; it closes after
  trainingRightAnswers: 2, // this many right answers (12 bonus + 2 × 9 = the 30-coin upgrade)
  clear: [[4, 1], [3, 1], [5, 1], [3, 3], [4, 3], [5, 3]],
  enemyScaling: {
    baseEnemyHealth: 26,
    healthPerWave: 14,
    baseEnemyCount: 2,
    enemiesPerWave: 1,
    baseEnemySpeed: 1.4,
    speedPerWave: 0,
  },
  economy: { baseCoinsPerKill: 0, waveCompletionBonus: 12 },
};
