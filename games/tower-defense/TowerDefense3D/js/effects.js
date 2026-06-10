// Visual effects that live on the canvas.
//   - ring:  expanding ring (freeze burst, cannon explosion)
//   - poof:  tier-transformation cloud (5-8 white/gray puffs)
//   - coin:  flying coin arcing from a world position to the HUD coin counter
//
// Flying coins carry the reward amount on the *first* coin in a batch. When that coin
// arrives at the HUD, its amount is added to state.coins — that's what creates the
// "coins fly in, then the counter updates" feel the spec asks for.

const Effects = {
  update(dt, state) {
    for (const fx of state.effects) {
      fx.elapsed += dt;
      if (fx.elapsed >= fx.duration) {
        if (fx.kind === 'coin' && fx.rewardOnArrive > 0) {
          state.coins += fx.rewardOnArrive;
          Sound.play('coin');
        }
        fx.isAlive = false;
      }
    }
    state.effects = state.effects.filter(fx => fx.isAlive);
  },

  spawnFreezeBurst(position, range) {
    state.effects.push({
      kind: 'ring',
      position: { x: position.x, y: position.y },
      startRadius: range * 0.1,
      endRadius: range,
      duration: 0.25,
      elapsed: 0,
      fill: 'rgba(128, 204, 255, 0.30)',
      stroke: 'rgba(180, 225, 255, 0.85)',
      fadeOut: true,
      isAlive: true,
    });
  },

  spawnExplosion(position, aoeRadius) {
    state.effects.push({
      kind: 'ring',
      position: { x: position.x, y: position.y },
      startRadius: aoeRadius * 0.3,
      endRadius: aoeRadius,
      duration: 0.3,
      elapsed: 0,
      fill: 'rgba(255, 170, 60, 0.45)',
      stroke: 'rgba(255, 220, 120, 0.95)',
      fadeOut: true,
      isAlive: true,
    });
  },

  // 5-8 small white/gray circles expanding outward from the enemy position over 0.15s.
  spawnPoof(position) {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const travel = 0.25 + Math.random() * 0.4;
      const g = 205 + Math.floor(Math.random() * 50);
      state.effects.push({
        kind: 'poof',
        position: { x: position.x, y: position.y },
        velocity: { x: Math.cos(angle) * travel, y: Math.sin(angle) * travel },
        startRadius: 0.12 + Math.random() * 0.1,
        duration: 0.15,
        elapsed: 0,
        color: `rgb(${g}, ${g}, ${g + Math.floor(Math.random() * 10)})`,
        isAlive: true,
      });
    }
  },

  // Spawn a small batch of coin icons that arc from `worldPos` to the HUD coin counter.
  // Only the first coin carries the reward — when it arrives, state.coins += amount.
  // Max ~10 active coins (spec cap). When saturated we still guarantee the reward-carrier
  // so coins can't silently get eaten by the cap.
  spawnFlyingCoins(worldPos, amount) {
    const desired = Math.min(Math.max(3, amount), 10);
    const existing = this._activeCoinCount();
    const room = Math.max(1, 10 - existing);
    const toSpawn = Math.min(desired, room);

    if (toSpawn === 0) {
      // Impossible with room >= 1, but just in case — grant the reward so it's not lost.
      state.coins += amount;
      return;
    }

    for (let i = 0; i < toSpawn; i++) {
      state.effects.push({
        kind: 'coin',
        worldStart: { x: worldPos.x, y: worldPos.y },
        spread: {
          x: (Math.random() - 0.5) * 0.6,
          y: (Math.random() - 0.5) * 0.4,
        },
        arcHeight: 0.9 + Math.random() * 0.6,
        duration: 0.55 + Math.random() * 0.2,
        // Negative elapsed = delay before the coin starts flying (staggered release).
        elapsed: -i * 0.045,
        rewardOnArrive: i === 0 ? amount : 0,
        isAlive: true,
      });
    }
  },

  _activeCoinCount() {
    let n = 0;
    for (const fx of state.effects) if (fx.kind === 'coin') n++;
    return n;
  },

  // 8-12 small tier-colored circles shooting outward on enemy death. Shrink + fade.
  // Particle cap (~50) enforced — oldest particles drop out via natural expiry.
  spawnKillParticles(position, color) {
    if (this._activeParticleCount() > 45) return; // leave room for the next burst
    const count = 8 + Math.floor(Math.random() * 5); // 8-12
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.2; // world units / second
      state.effects.push({
        kind: 'particle',
        position: { x: position.x, y: position.y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        startRadius: 0.08 + Math.random() * 0.08,
        duration: 0.3 + Math.random() * 0.2,
        elapsed: 0,
        color,
        isAlive: true,
      });
    }
  },

  _activeParticleCount() {
    let n = 0;
    for (const fx of state.effects) if (fx.kind === 'particle') n++;
    return n;
  },

  // Red vignette flash when a life is lost. 0.35s, fading. Drawn once globally —
  // multiple overlapping flashes would just look muddy, so dedupe to a single one.
  spawnScreenFlash() {
    for (const fx of state.effects) {
      if (fx.kind === 'screenFlash') { fx.elapsed = 0; return; } // refresh existing
    }
    state.effects.push({
      kind: 'screenFlash',
      duration: 0.35,
      elapsed: 0,
      isAlive: true,
    });
  },
};
