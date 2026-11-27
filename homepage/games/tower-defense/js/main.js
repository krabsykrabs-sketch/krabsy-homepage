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
import { Track } from './analytics.js';

// Entry point: initialize subsystems, own the central state, run the game loop + phase
// machine. Phase table (spec):
//   MENU → BUILD → BATTLE → WAVE_COMPLETE → BUILD (next wave) or VICTORY
//   The forge card (questions for coins) is always on screen while a level runs.
//   GAME_OVER triggers from any gameplay phase when lives hit 0.
//   End-game button → MENU (ends current run).

// Level catalogue — resolved in init() once the level scripts have run.
export let LEVELS = [];
// The guided training level sits before level 1 as index -1, so the real levels keep
// their numbers (stars, records and analytics stay as they were).
export let TRAINING = null;
export const TRAINING_INDEX = -1;
export function levelAt(i) { return i === TRAINING_INDEX ? TRAINING : LEVELS[i]; }
export let currentLevelIndex = 0;

function highscoreKey(levelIndex) {
  if (levelIndex === TRAINING_INDEX) return 'td3d_highscore_training';
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
  // Game speed: the player's speed button (1 or 2), battle only.
  timeScale: 1,
  speed: 1,

  // A free hex the player tapped: the next tower card builds right there.
  buildCell: null,
  // Tower card under the mouse / long-pressed: its range is previewed at buildCell.
  previewType: null,
  // Tutorial coach: { key, target } and cells to highlight (see tutorial.js).
  hint: null,
  hintCells: [],
  // Seconds left of the defeat / victory scene before the end panel shows (tap skips).
  endT: 0,
  // Stars earned by the last victory (1–3), 0 otherwise.
  starsEarned: 0,

  // Save highscore only once per run-end; cleared on resetRun.
  highscoreSaved: false,
};

let lastTime = 0;
let canvas = null;

// UI scale: on screens bigger than a laptop the HUD, cards, question card and menus grow
// with the window (CSS zoom via --ui), so they don't shrink into the corners of a big
// monitor. Never below 1, so laptops, tablets and phones keep the tested layout.
function applyUiScale() {
  const s = Math.min(window.innerWidth / 1366, window.innerHeight / 800);
  const ui = Math.max(1, Math.min(2.2, Math.round(s * 20) / 20));
  document.documentElement.style.setProperty('--ui', String(ui));
}
applyUiScale();
window.addEventListener('resize', applyUiScale);

async function init() {
  canvas = document.getElementById('game-canvas');
  applyStatic();
  Sound.init();

  TRAINING = window.LEVEL_TRAINING || null;
  LEVELS = [window.LEVEL1, window.LEVEL2, window.LEVEL3, window.LEVEL4, window.LEVEL5, window.LEVEL6].filter(Boolean);
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

// Lives at which the low-lives warning starts (heartbeat, pulsing hearts, red edge).
export function dangerLives() {
  return Math.max(2, Math.round(Level.current.startingLives * 0.3));
}

// A new attempt at the current level (start, retry, next level).
export function resetRun() {
  clearRun();
  Track.levelStart(currentLevelIndex, state);
}

function clearRun() {
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
  // Training: the question card comes in after the first wave.
  state.forge = Forge.newState(currentLevelIndex === TRAINING_INDEX);
  state.stats = { asked: 0, right: 0 };
  state.timeScale = 1;
  state.buildCell = null;
  state.hint = null;
  state.hintCells = [];
  state.starsEarned = 0;
  state.endT = 0;
  state.intro = introFor(Level.current);
  Renderer.onRunReset();
  Questions.resetRun();
  state.highscoreSaved = false;
  Grid.init(Level.current);
}

export function startGame(levelIndex) {
  if (typeof levelIndex === 'number' && levelAt(levelIndex)) {
    currentLevelIndex = levelIndex;
    Level.load(levelAt(levelIndex));
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
  Track.abandon();
  clearRun();
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
  if (levelIndex === TRAINING_INDEX) return 'td3d_stars_training';
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

// ?unlock=all opens every level (for testing, and for teachers who want to pick one).
const UNLOCK_ALL = (() => {
  try { return new URLSearchParams(window.location.search).get('unlock') === 'all'; }
  catch { return false; }
})();

// Training is always open. Level 1 opens after the training — or at once for players
// who finished the old level-1 tutorial or already have stars there.
export function isUnlocked(levelIndex) {
  if (UNLOCK_ALL || levelIndex === TRAINING_INDEX) return true;
  if (levelIndex === 0) return getStars(TRAINING_INDEX) > 0 || Tutorial.isDone() || getStars(0) > 0;
  return getStars(levelIndex - 1) > 0;
}

// Archer first (owner, 2026-11-27): the other towers are weak openers, so they stay
// locked until an archer tower stands on the board (again after selling the last one).
export function isTowerLocked(type) {
  return type !== 'basic' && !state.towers.some((t) => t.type === 'basic');
}

// Towers arrive level by level (owner, 2026-11-27): training and level 1 = archer,
// level 2 adds the catapult, 3 the cannon, 4 frost. A new tower is introduced with a
// card at the start of its level, the first time only (state.intro).
export function availableTowers() {
  return Level.current ? Level.current.towers : [];
}
export function towerAvailable(type) {
  return availableTowers().includes(type);
}
function introKey(type) { return `td3d_tower_seen_${type}`; }
export function markIntroSeen() {
  if (!state.intro) return;
  try { localStorage.setItem(introKey(state.intro), '1'); } catch { /* storage blocked */ }
  state.intro = null;
}
function introFor(level) {
  const type = level.newTower;
  if (!type) return null;
  try { if (localStorage.getItem(introKey(type)) === '1') return null; } catch { /* show it */ }
  return type;
}

export function hasNextLevel() {
  return currentLevelIndex + 1 < LEVELS.length;
}

// ── Tower actions (step 9) ────────────────────────────────────────────

export function upgradeTower(tower) {
  if (!tower) return;
  if (state.gate && !state.gate.upgrade) return; // training: not yet
  const up = tower.nextUpgrade();
  if (!up) return;
  if (state.coins < up.cost) { Forge.noCoins(state, tower.type); return; }
  state.coins -= up.cost;
  tower.upgrade();
  Track.upgraded(state, tower, up.cost);
  tower.levelUpT = 0.45;
  Effects.spawnLevelUp(tower.position, tower.upgradeLevel);
  Sound.play('upgrade');
}

export function sellTower(tower) {
  if (!tower) return;
  if (state.gate) return; // no selling in the training
  const refund = tower.sellValue();
  state.coins += refund;
  Track.sold(state, tower, refund);
  Grid.free(tower.cellX, tower.cellY);
  const idx = state.towers.indexOf(tower);
  if (idx >= 0) state.towers.splice(idx, 1);
  if (state.selectedTower === tower) state.selectedTower = null;
  Sound.play('sell');
}

// ── Game loop ─────────────────────────────────────────────────────────

// dt is the game step (capped, so a slow frame cannot make enemies jump); realDt is
// wall-clock time for things that must not slow down on a slow device.
function update(dt, realDt = dt) {
  // The forge card runs on real time, whatever the game speed or frame rate.
  Forge.update(realDt, state);
  if (state.phase === 'BUILD' || state.phase === 'BATTLE' || state.phase === 'WAVE_COMPLETE') Track.tick(realDt);
  state.timeScale = state.phase === 'BATTLE' ? state.speed : 1;
  dt *= state.timeScale;
  Tutorial.update(state);

  if (state.phase === 'MENU') {
    UI.update(state);
    return;
  }
  // Music follows the game: calm in menus and while building, drums in battle,
  // silence (and a jingle) at the end; a heartbeat when lives run low.
  Sound.setMood({ BATTLE: 'battle', GAME_OVER: 'end', VICTORY: 'end' }[state.phase] || 'build');
  Sound.setDanger((state.phase === 'BUILD' || state.phase === 'BATTLE' || state.phase === 'WAVE_COMPLETE')
    && state.lives > 0 && state.lives <= dangerLives());

  if (state.phase === 'GAME_OVER' || state.phase === 'VICTORY') {
    if (state.endT > 0) state.endT = Math.max(0, state.endT - realDt);
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
        state.endT = 1.6;
        Sound.play('victory');
        Track.levelEnd(state, true);
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
    state.endT = 2.6;
    Sound.play('gameOver');
    Track.levelEnd(state, false);
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
  const elapsed = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  update(Math.min(elapsed, 0.05), Math.min(elapsed, 0.5));
  Renderer.render(state);
  requestAnimationFrame(gameLoop);
}

// Handle for automated play-tests and debugging in the browser console.
window.__td = { state, Renderer, Level, Grid, Forge, Questions, Wave, Input, CONFIG, step: update, startGame };

// A tap or key during the defeat / victory scene skips to the end panel.
for (const ev of ['pointerdown', 'keydown']) {
  window.addEventListener(ev, () => { if (state.endT > 0) state.endT = 0; });
}

window.addEventListener('load', init);
