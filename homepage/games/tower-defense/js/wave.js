import { Sound } from './audio.js';
import { Track } from './analytics.js';
import { Level } from './level.js';
import { Effects } from './effects.js';
import { Enemy } from './enemy.js';
import { state } from './main.js';

// Wave system. Owns the BATTLE-phase spawn loop and triggers the BUILD→BATTLE and
// BATTLE→WAVE_COMPLETE transitions. Balance formulas and boss cadence come from the
// level JSON's enemyScaling / economy sections — see spec "Wave System".

export const Wave = {
  // Boss waves are listed per level (level.bossWaves); they contain bosses only.
  isBossWave(n) {
    const list = Level.current && Level.current.bossWaves;
    return list ? list.includes(n) : n % 5 === 0;
  },

  // Begin the next wave. Assumes state.phase === 'BUILD'.
  startNext(state) {
    if (state.gate && !state.gate.start) return; // training: not yet
    const lvl = Level.current;
    state.currentWave += 1;
    state.phase = 'BATTLE';

    const n = state.currentWave;
    const s = lvl.enemyScaling;

    const enemyCount    = s.baseEnemyCount + Math.floor((n - 1) * s.enemiesPerWave);
    const waveBaseHP    = s.baseEnemyHealth + (n - 1) * s.healthPerWave;
    const enemySpeed    = s.baseEnemySpeed + (n - 1) * (s.speedPerWave ?? 0.04);
    const spawnInterval = Math.max(0.5, (s.spawnInterval ?? 1.2) - (n - 1) * 0.04);
    const boss          = this.isBossWave(n);

    const queue = [];
    if (boss) {
      // Boss waves are bosses ONLY — few, tough, slow-spawning enemies.
      const bossCount = Math.max(1, Math.round(enemyCount / (s.enemiesPerBoss ?? 3)));
      const bossHP = waveBaseHP * (s.bossHealthFactor ?? 3.5);
      for (let i = 0; i < bossCount; i++) {
        queue.push({ hp: bossHP, speed: enemySpeed, path: this._pickPath(lvl), isBoss: true });
      }
    } else {
      for (let i = 0; i < enemyCount; i++) {
        // Per-enemy health variation: uniform in [0.5× .. 1.5×] waveBaseHP.
        const hp = waveBaseHP * (0.5 + Math.random());
        queue.push({ hp, speed: enemySpeed, path: this._pickPath(lvl), isBoss: false });
      }
    }

    state.wave = {
      isSpawning: true,
      queue,
      timer: 0, // first spawn fires immediately
      interval: boss ? spawnInterval * 2.5 : spawnInterval,
    };
    Sound.play('waveStart');
    Track.waveStart(state);
  },

  update(dt, state) {
    const w = state.wave;
    if (!w) return;

    if (w.isSpawning) {
      w.timer -= dt;
      while (w.timer <= 0 && w.queue.length > 0) {
        const spec = w.queue.shift();
        state.enemies.push(new Enemy({
          path: spec.path,
          maxHealth: spec.hp,
          baseSpeed: spec.speed,
          isBoss: spec.isBoss,
        }));
        if (w.queue.length === 0) {
          w.isSpawning = false;
          break;
        }
        w.timer += w.interval;
      }
    }

    // Wave completion check (spec: "!isSpawning && enemiesAlive <= 0 && waveInProgress").
    if (!w.isSpawning && state.enemies.length === 0) {
      this._completeWave(state);
    }
  },

  _completeWave(state) {
    const lvl = Level.current;
    // Bonus arrives via flying coins (spec). The coin-counter value updates when the
    // first coin in the batch reaches the HUD, giving the satisfying "count ticks up"
    // moment. Flying source is the middle of the map — approximately under the overlay.
    Effects.spawnFlyingCoins(
      { x: lvl.gridWidth / 2, y: lvl.gridHeight / 2 },
      lvl.economy.waveCompletionBonus,
    );
    state.wave = null;

    // BATTLE → WAVE_COMPLETE → (BUILD | VICTORY); main.js makes that last step.
    state.phase = 'WAVE_COMPLETE';
    state.waveCompleteTimer = 1.8;
    Track.waveEnd(state);
    Sound.play('waveComplete');
  },

  _pickPath(lvl) {
    const paths = lvl.paths;
    let total = 0;
    for (const p of paths) total += p.spawnWeight;
    let r = Math.random() * total;
    for (const p of paths) {
      if ((r -= p.spawnWeight) <= 0) return p;
    }
    return paths[0];
  },
};
