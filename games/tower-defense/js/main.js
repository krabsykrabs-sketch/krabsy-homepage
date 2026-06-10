// Entry point: initialize subsystems, own the central state, run the game loop + phase
// machine. Phase table (spec):
//   MENU → BUILD → BATTLE → WAVE_COMPLETE → QUIZ → BUILD (next wave) or VICTORY
//   GAME_OVER triggers from any gameplay phase when lives hit 0.
//   End-game button → MENU (ends current run).

const HIGHSCORE_KEY = 'td_highscore_level_0';

const state = {
  phase: 'MENU',
  enemies: [],
  towers: [],
  projectiles: [],
  effects: [],
  lives: 10,
  coins: 60,
  currentWave: 0,

  placement: { active: false, towerType: null },
  selectedTower: null,
  mouseWorld: null,

  wave: null,
  waveCompleteTimer: 0,
  quiz: null,

  // Save highscore only once per run-end; cleared on resetRun.
  highscoreSaved: false,
};

let lastTime = 0;
let canvas = null;

function init() {
  canvas = document.getElementById('game-canvas');

  if (!window.LEVEL1) {
    console.error('LEVEL1 data missing — make sure levels/level1.js is loaded.');
    return;
  }

  Level.load(window.LEVEL1);
  Grid.init(Level.current);

  // Seed initial stats from the level so the start menu can render a best-wave number
  // without the game having started. The run itself re-seeds these in resetRun.
  state.lives = Level.current.startingLives;
  state.coins = Level.current.startingCoins;

  Renderer.init(canvas);
  UI.init();
  Input.init(canvas);

  // Kick off asset loading. The game loop runs immediately; rendering falls back to
  // colored shapes for the first few frames until images arrive.
  Assets.load().then(() => {
    // Trigger a resize so smoothing flag is reapplied with imageSmoothingEnabled=false
    // — some browsers reset on first drawImage with new bitmap.
    Renderer.resize();
  });

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function resetRun() {
  state.phase = 'BUILD';
  state.enemies.length = 0;
  state.towers.length = 0;
  state.projectiles.length = 0;
  state.effects.length = 0;
  state.lives = Level.current.startingLives;
  state.coins = Level.current.startingCoins;
  state.currentWave = 0;
  state.placement.active = false;
  state.placement.towerType = null;
  state.selectedTower = null;
  state.wave = null;
  state.waveCompleteTimer = 0;
  state.quiz = null;
  state.highscoreSaved = false;
  Grid.init(Level.current);
}

function startGame() {
  resetRun();
}

function endGame() {
  resetRun();
  state.phase = 'MENU';
}

// ── Highscore ─────────────────────────────────────────────────────────

function getHighscore() {
  try {
    return parseInt(localStorage.getItem(HIGHSCORE_KEY) || '0', 10) || 0;
  } catch { return 0; }
}

function saveHighscore() {
  if (state.highscoreSaved) return;
  try {
    const best = getHighscore();
    if (state.currentWave > best) {
      localStorage.setItem(HIGHSCORE_KEY, String(state.currentWave));
    }
  } catch { /* localStorage disabled — silently skip */ }
  state.highscoreSaved = true;
}

// ── Tower actions (step 9) ────────────────────────────────────────────

function upgradeTower(tower) {
  if (!tower) return;
  const up = tower.nextUpgrade();
  if (!up) return;
  if (state.coins < up.cost) return;
  state.coins -= up.cost;
  tower.upgrade();
}

function sellTower(tower) {
  if (!tower) return;
  const refund = tower.sellValue();
  state.coins += refund;
  Grid.free(tower.cellX, tower.cellY);
  const idx = state.towers.indexOf(tower);
  if (idx >= 0) state.towers.splice(idx, 1);
  if (state.selectedTower === tower) state.selectedTower = null;
}

// ── Game loop ─────────────────────────────────────────────────────────

function update(dt) {
  if (state.phase === 'MENU') {
    UI.update(state);
    return;
  }
  if (state.phase === 'GAME_OVER' || state.phase === 'VICTORY') {
    saveHighscore();
    // Effects still tick so any tail-end flashes / particles fade gracefully under the overlay.
    Effects.update(dt, state);
    UI.update(state);
    return;
  }

  if (state.phase === 'BATTLE') {
    Wave.update(dt, state);
  } else if (state.phase === 'WAVE_COMPLETE') {
    state.waveCompleteTimer -= dt;
    if (state.waveCompleteTimer <= 0) Quiz.start(state);
  } else if (state.phase === 'QUIZ') {
    Quiz.update(dt, state);
  }

  for (const t of state.towers)      t.update(dt, state);
  for (const p of state.projectiles) p.update(dt, state);
  for (const e of state.enemies)     e.update(dt, state);
  Effects.update(dt, state);

  state.enemies = state.enemies.filter(e => e.isAlive);
  state.projectiles = state.projectiles.filter(p => p.isAlive);

  if (state.lives <= 0 && state.phase !== 'VICTORY') {
    state.phase = 'GAME_OVER';
  }

  // Drop stale placement/selection when the game leaves an interactive phase.
  if (state.phase !== 'BUILD' && state.phase !== 'BATTLE') {
    if (state.placement.active) Input.cancelPlacement();
    state.selectedTower = null;
  }

  if (state.selectedTower && !state.towers.includes(state.selectedTower)) {
    state.selectedTower = null;
  }

  UI.update(state);
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  Renderer.render(state);
  requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
