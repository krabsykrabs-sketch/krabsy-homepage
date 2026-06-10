// Bundled level data — runs via file:// without a static server.
// Tile grid + path traced from ToolPack/map/background.png (1472×1288, 64px tiles → 23×20).
// Sky band rows 0-2 are 'obstacle' so towers can't be placed in the painted-over sky strip.
// Path is the 2-tile-wide U-shape baked into the background art.
window.LEVEL1 = {
  name: "Meadow",
  tagline: "A gentle stroll to start.",
  gridWidth: 23,
  gridHeight: 20,
  tileKey: { 0: "ground", 1: "path", 2: "water", 3: "obstacle", 4: "spawn", 5: "goal" },
  // Background image is rendered behind the tile grid. The colored tile fills are still
  // drawn (very faintly) only where useful — see renderer.js.
  background: null, // 3D version builds the board procedurally — no 2D background image
  // Pixels per world tile. Background draws at this scale * gridWidth.
  tilePixelSize: 64,
  tiles: [
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [4,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [4,1,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,5],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,5],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ],
  paths: [
    {
      spawnWeight: 1,
      // 2-tile-wide path. Enemy.update adds +0.5 to waypoint coords (tile-center
      // movement), so these are written shifted -0.5 to land on the path centerline.
      // Centerlines: left vertical x=5, right vertical x=13, top y=9, bottom y=17,
      // entry y=13. Exit at right edge x=23.
      waypoints: [[-0.5, 12.5], [4.5, 12.5], [4.5, 8.5], [12.5, 8.5], [12.5, 16.5], [22.5, 16.5]]
    }
  ],
  startingLives: 10,
  startingCoins: 60,
  totalWaves: 20,
  enemyScaling: {
    baseEnemyHealth: 30,
    healthPerWave: 15,
    baseEnemyCount: 5,
    enemiesPerWave: 1.5,
    baseEnemySpeed: 2
  },
  economy: {
    baseCoinsPerKill: 1,
    waveCompletionBonus: 10
  },
  quiz: {
    questionsPerWave: 2,
    coinsPerCorrectAnswer: 5
  }
};
