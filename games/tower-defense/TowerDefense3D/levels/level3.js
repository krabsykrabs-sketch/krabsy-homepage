// Level 3 — "The Long March". A serpentine road that snakes across the whole
// board four times before exiting east. Long walks for the enemies, but they
// come fast, tough, and in greater numbers. Built programmatically like level 2.
(function () {
  const W = 23, H = 20;
  const t = [];
  for (let y = 0; y < H; y++) t.push(new Array(W).fill(y < 3 ? 3 : 0));

  const rect = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[y][x] = v;
  };

  rect(0, 4, 18, 5, 1);      // lane 1, eastbound
  rect(17, 4, 18, 9, 1);     // down
  rect(4, 8, 18, 9, 1);      // lane 2, westbound
  rect(4, 8, 5, 13, 1);      // down
  rect(4, 12, 18, 13, 1);    // lane 3, eastbound
  rect(17, 12, 18, 17, 1);   // down
  rect(17, 16, 22, 17, 1);   // exit lane, east

  rect(0, 4, 0, 5, 4);       // spawn (west edge, top lane)
  rect(22, 16, 22, 17, 5);   // goal (east edge, bottom lane)

  rect(1, 15, 2, 18, 2);     // pond, bottom-left

  // Scattered trees on the remaining meadow strips.
  for (const [x, y] of [[1, 10], [21, 7], [21, 12], [10, 18], [14, 6], [8, 15]]) t[y][x] = 3;

  window.LEVEL3 = {
    name: "The Long March",
    tagline: "Four laps of trouble.",
    gridWidth: W,
    gridHeight: H,
    tileKey: { 0: "ground", 1: "path", 2: "water", 3: "obstacle", 4: "spawn", 5: "goal" },
    background: null,
    tilePixelSize: 64,
    tiles: t,
    paths: [
      {
        spawnWeight: 1,
        waypoints: [
          [-0.5, 4.5], [17.5, 4.5], [17.5, 8.5], [4.5, 8.5],
          [4.5, 12.5], [17.5, 12.5], [17.5, 16.5], [22.5, 16.5],
        ],
      },
    ],
    startingLives: 8,
    startingCoins: 85,
    totalWaves: 25,
    enemyScaling: {
      baseEnemyHealth: 40,
      healthPerWave: 22,
      baseEnemyCount: 6,
      enemiesPerWave: 2,
      baseEnemySpeed: 2.2,
    },
    economy: { baseCoinsPerKill: 1, waveCompletionBonus: 14 },
    quiz: { questionsPerWave: 2, coinsPerCorrectAnswer: 5 },
  };
})();
