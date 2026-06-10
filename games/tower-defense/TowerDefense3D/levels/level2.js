// Level 2 — "Crossroads". One road in from the west; at the central junction it
// splits north and south, each branch exiting east. Two goals to defend at once.
// The tile grid is built programmatically: 0 ground, 1 path, 2 water, 3 obstacle,
// 4 spawn, 5 goal. Rows 0-2 stay the obstacle ridge (backdrop hills + trees).
(function () {
  const W = 23, H = 20;
  const t = [];
  for (let y = 0; y < H; y++) t.push(new Array(W).fill(y < 3 ? 3 : 0));

  const rect = (x0, y0, x1, y1, v) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t[y][x] = v;
  };

  rect(0, 11, 11, 12, 1);    // west entry corridor
  rect(10, 5, 11, 12, 1);    // trunk north
  rect(10, 11, 11, 18, 1);   // trunk south
  rect(10, 5, 22, 6, 1);     // north branch east
  rect(10, 17, 22, 18, 1);   // south branch east

  rect(0, 11, 0, 12, 4);     // spawn (west edge)
  rect(22, 5, 22, 6, 5);     // goal north
  rect(22, 17, 22, 18, 5);   // goal south

  rect(2, 5, 5, 7, 2);       // lake, top-left
  rect(15, 11, 18, 13, 2);   // pond between the branches

  // Lone trees for cover variety.
  for (const [x, y] of [[2, 16], [6, 17], [20, 11], [16, 8]]) t[y][x] = 3;

  window.LEVEL2 = {
    name: "Crossroads",
    tagline: "One road in, two roads out.",
    gridWidth: W,
    gridHeight: H,
    tileKey: { 0: "ground", 1: "path", 2: "water", 3: "obstacle", 4: "spawn", 5: "goal" },
    background: null,
    tilePixelSize: 64,
    tiles: t,
    paths: [
      { spawnWeight: 1, waypoints: [[-0.5, 11.5], [10.5, 11.5], [10.5, 5.5], [22.5, 5.5]] },
      { spawnWeight: 1, waypoints: [[-0.5, 11.5], [10.5, 11.5], [10.5, 17.5], [22.5, 17.5]] },
    ],
    startingLives: 10,
    startingCoins: 75,
    totalWaves: 20,
    enemyScaling: {
      baseEnemyHealth: 35,
      healthPerWave: 18,
      baseEnemyCount: 6,
      enemiesPerWave: 1.8,
      baseEnemySpeed: 2,
    },
    economy: { baseCoinsPerKill: 1, waveCompletionBonus: 12 },
    quiz: { questionsPerWave: 2, coinsPerCorrectAnswer: 5 },
  };
})();
