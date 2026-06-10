// Level loading. For MVP the level data is bundled into a global (window.LEVEL1) via
// levels/level1.js, which sidesteps the fetch()/CORS restrictions of opening index.html
// over file://. The authoritative data lives in levels/level1.json; the JS bundle mirrors it.

const Level = {
  current: null,

  load(data) {
    this.current = {
      name: data.name,
      gridWidth: data.gridWidth,
      gridHeight: data.gridHeight,
      tiles: data.tiles,
      tileKey: data.tileKey,
      // Optional asset-pack background; renderer falls back to colored tiles when absent.
      background: data.background || null,
      tilePixelSize: data.tilePixelSize || 64,
      paths: data.paths.map(p => ({
        spawnWeight: p.spawnWeight,
        waypoints: p.waypoints.map(([x, y]) => ({ x, y })),
      })),
      startingLives: data.startingLives,
      startingCoins: data.startingCoins,
      totalWaves: data.totalWaves,
      enemyScaling: data.enemyScaling,
      economy: data.economy,
      quiz: data.quiz,
    };
    return this.current;
  },

  tileTypeAt(tx, ty) {
    const lvl = this.current;
    if (!lvl) return null;
    if (tx < 0 || ty < 0 || tx >= lvl.gridWidth || ty >= lvl.gridHeight) return null;
    return lvl.tileKey[lvl.tiles[ty][tx]];
  },
};
