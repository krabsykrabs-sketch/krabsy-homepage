// Wave system. Owns the BATTLE-phase spawn loop and triggers the BUILD→BATTLE and
// BATTLE→WAVE_COMPLETE transitions. Balance formulas and boss cadence come from the
// level JSON's enemyScaling / economy sections — see spec "Wave System".

const Wave = {
  isBossWave(n) { return n % 5 === 0; },

  // Begin the next wave. Assumes state.phase === 'BUILD'.
  startNext(state) {
    const lvl = Level.current;
    state.currentWave += 1;
    state.phase = 'BATTLE';

    const n = state.currentWave;
    const s = lvl.enemyScaling;

    const enemyCount    = s.baseEnemyCount + Math.floor((n - 1) * s.enemiesPerWave);
    const waveBaseHP    = s.baseEnemyHealth + (n - 1) * s.healthPerWave;
    const enemySpeed    = s.baseEnemySpeed + (n - 1) * 0.05;
    const spawnInterval = Math.max(0.3, 1 - (n - 1) * 0.03);
    const boss          = this.isBossWave(n);

    const queue = [];
    for (let i = 0; i < enemyCount; i++) {
      // Per-enemy health variation: uniform in [0.5× .. 1.5×] waveBaseHP.
      const hp = waveBaseHP * (0.5 + Math.random());
      queue.push({ hp, speed: enemySpeed, path: this._pickPath(lvl), isBoss: false });
    }
    if (boss) {
      queue.push({ hp: waveBaseHP, speed: enemySpeed, path: this._pickPath(lvl), isBoss: true });
    }

    state.wave = {
      isSpawning: true,
      queue,
      timer: 0, // first spawn fires immediately
      interval: spawnInterval,
    };
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

    // Phase table (spec): BATTLE → WAVE_COMPLETE → QUIZ → (BUILD | VICTORY).
    // Even the final wave goes through WAVE_COMPLETE and QUIZ — the quiz module is
    // responsible for the VICTORY transition once both questions are answered.
    state.phase = 'WAVE_COMPLETE';
    state.waveCompleteTimer = 2.0;
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
