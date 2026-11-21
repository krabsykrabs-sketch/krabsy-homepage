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
import { Tutorial } from './tutorial.js';

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
  // Game speed: forge slow motion × the player's speed button (1 or 2, battle only).
  timeScale: 1,
  speed: 1,

  // A free hex the player tapped: the next tower card builds right there.
  buildCell: null,
  // Tutorial coach: { key, target } and cells to highlight (see tutorial.js).
  hint: null,
  hintCells: [],
  // Stars earned by the last victory (1–3), 0 otherwise.
  starsEarned: 0,

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
    const note = document.getElementById('loading-note');
    const progress = (f) => { if (note) note.textContent = `${t('loading')} ${Math.round(f * 100)} %`; };
    await Promise.all([Assets.load(progress), Characters.load(), Questions.init()]);
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
  state.buildCell = null;
  state.hint = null;
  state.hintCells = [];
  state.starsEarned = 0;
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

// Start the level after the current one (victory screen).
export function nextLevel() {
  if (currentLevelIndex + 1 < LEVELS.length) startGame(currentLevelIndex + 1);
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
    if (state.starsEarned > getStars(currentLevelIndex)) {
      localStorage.setItem(starsKey(currentLevelIndex), String(state.starsEarned));
    }
  } catch { /* localStorage disabled — silently skip */ }
  state.highscoreSaved = true;
}

// ── Stars and level unlocking ─────────────────────────────────────────
// A won level earns 1–3 stars by how many lives are left: 3 = at most one life lost,
// 2 = at least half left, 1 = won. One star on a level unlocks the next one.

function starsKey(levelIndex) {
  return `td3d_stars_level_${levelIndex}`;
}

export function starsFor(lives, maxLives) {
  if (lives >= maxLives - 1) return 3;
  if (lives >= maxLives / 2) return 2;
  return 1;
}

export function getStars(levelIndex = currentLevelIndex) {
  try {
    return parseInt(localStorage.getItem(starsKey(levelIndex)) || '0', 10) || 0;
  } catch { return 0; }
}

export function isUnlocked(levelIndex) {
  return levelIndex === 0 || getStars(levelIndex - 1) > 0;
}

export function hasNextLevel() {
  return currentLevelIndex + 1 < LEVELS.length;
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
  const battle = state.phase === 'BATTLE';
  state.timeScale = battle ? (state.forge.open ? CONFIG.forge.battleTimeScale : state.speed) : 1;
  dt *= state.timeScale;
  Tutorial.update(state, currentLevelIndex);

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
        state.starsEarned = starsFor(state.lives, Level.current.startingLives);
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
    state.buildCell = null;
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
window.__td = { state, Renderer, Level, Grid, Forge, Questions, Wave, Input, step: update, startGame };

window.addEventListener('load', init);
