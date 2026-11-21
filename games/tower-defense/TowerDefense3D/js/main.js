import { Sound } from './audio.js';
import { CONFIG } from './config.js';
import { Level } from './level.js';
import { Assets } from './assets.js';
import { Characters } from './characters.js';
import { Renderer } from './renderer.js';
import { Input } from './input.js';
import { Grid } from './grid.js';
import { Forge } from './forge.js';
import { Questions } from './questions.js';
import { applyStatic, t } from './i18n.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { Wave } from './wave.js';

// Entry point: initialize subsystems, own the central state, run the game loop + phase
// machine. Phase table (spec):
//   MENU → BUILD → BATTLE → WAVE_COMPLETE → BUILD (next wave) or VICTORY
//   The forge (questions for coins) can be opened any time during BUILD and BATTLE.
//   GAME_OVER triggers from any gameplay phase when lives hit 0.
//   End-game button → MENU (ends current run).

// Level catalogue — resolved in init() once the level scripts have run.
export let LEVELS = [];
export let currentLevelIndex = 0;

function highscoreKey(levelIndex) {
  return `td3d_highscore_level_${levelIndex}`;
}

export const state = {
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

  forge: Forge.newState(),
  stats: { asked: 0, right: 0 },
  // 1 normally; lower while the forge is open during a battle (slow motion).
  timeScale: 1,

  // Save highscore only once per run-end; cleared on resetRun.
  highscoreSaved: false,
};

let lastTime = 0;
let canvas = null;

async function init() {
  canvas = document.getElementById('game-canvas');
  applyStatic();
  Sound.init();

  LEVELS = [window.LEVEL1, window.LEVEL2, window.LEVEL3].filter(Boolean);
  if (LEVELS.length === 0) {
    console.error('Level data missing — make sure levels/*.js are loaded.');
    return;
  }

  // Load level 1 as the menu backdrop; the actual run reloads via startGame(idx).
  Level.load(LEVELS[0]);
  Grid.init(Level.current);

  // Seed initial stats from the level so the start menu can render a best-wave number
  // without the game having started. The run itself re-seeds these in resetRun.
  state.lives = Level.current.startingLives;
  state.coins = Level.current.startingCoins;

  // Models first: the board, the towers and the dock thumbnails are built from them.
  try {
    await Promise.all([Assets.load(), Characters.load(), Questions.init()]);
  } catch (err) {
    console.error('Could not load the 3D models', err);
    const note = document.getElementById('loading-note');
    if (note) note.textContent = t('loadError');
    return;
  }

  Renderer.init(canvas);
  UI.init();
  Input.init(canvas);


  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

export function resetRun() {
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
  state.forge = Forge.newState();
  state.stats = { asked: 0, right: 0 };
  state.timeScale = 1;
  Questions.resetRun();
  state.highscoreSaved = false;
  Grid.init(Level.current);
}

export function startGame(levelIndex) {
  if (typeof levelIndex === 'number' && LEVELS[levelIndex]) {
    currentLevelIndex = levelIndex;
    Level.load(LEVELS[levelIndex]);
    Grid.init(Level.current);
    Renderer.setLevel();
    UI.onLevelChanged();
  }
  resetRun();
}

export function endGame() {
  resetRun();
  state.phase = 'MENU';
}

// ── Highscore ─────────────────────────────────────────────────────────

export function getHighscore(levelIndex = currentLevelIndex) {
  try {
    return parseInt(localStorage.getItem(highscoreKey(levelIndex)) || '0', 10) || 0;
  } catch { return 0; }
}

function saveHighscore() {
  if (state.highscoreSaved) return;
  try {
    const best = getHighscore();
    if (state.currentWave > best) {
      localStorage.setItem(highscoreKey(currentLevelIndex), String(state.currentWave));
    }
  } catch { /* localStorage disabled — silently skip */ }
  state.highscoreSaved = true;
}

// ── Tower actions (step 9) ────────────────────────────────────────────

export function upgradeTower(tower) {
  if (!tower) return;
  const up = tower.nextUpgrade();
  if (!up) return;
  if (state.coins < up.cost) return;
  state.coins -= up.cost;
  tower.upgrade();
  Sound.play('upgrade');
}

export function sellTower(tower) {
  if (!tower) return;
  const refund = tower.sellValue();
  state.coins += refund;
  Grid.free(tower.cellX, tower.cellY);
  const idx = state.towers.indexOf(tower);
  if (idx >= 0) state.towers.splice(idx, 1);
  if (state.selectedTower === tower) state.selectedTower = null;
  Sound.play('sell');
}

// ── Game loop ─────────────────────────────────────────────────────────

function update(dt) {
  // The forge runs on real time; everything else slows down while it is open in battle.
  Forge.update(dt, state);
  state.timeScale = (state.forge.open && state.phase === 'BATTLE') ? CONFIG.forge.battleTimeScale : 1;
  dt *= state.timeScale;

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
    if (state.waveCompleteTimer <= 0) {
      if (state.currentWave >= Level.current.totalWaves) {
        state.phase = 'VICTORY';
        Sound.play('victory');
      } else {
        state.phase = 'BUILD';
        Forge.refill(state);
      }
    }
  }

  for (const t of state.towers)      t.update(dt, state);
  for (const p of state.projectiles) p.update(dt, state);
  for (const e of state.enemies)     e.update(dt, state);
  Effects.update(dt, state);

  state.enemies = state.enemies.filter(e => e.isAlive);
  state.projectiles = state.projectiles.filter(p => p.isAlive);

  if (state.lives <= 0 && state.phase !== 'VICTORY') {
    state.phase = 'GAME_OVER';
    Sound.play('gameOver');
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

// Handle for automated play-tests and debugging in the browser console.
window.__td = { state, Renderer, Level, Grid, Forge, Questions };

window.addEventListener('load', init);
