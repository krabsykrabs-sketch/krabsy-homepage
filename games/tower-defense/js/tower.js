// Tower entity. Step 5 adds circleShooter (burst), cannon (AoE), and freeze (pulse)
// firing. Each variant has its own update path; targeting logic is shared by all except
// freeze (which pulses on any non-frozen enemy in range).

class Tower {
  constructor(type, cellX, cellY) {
    const def = CONFIG.TOWERS[type];
    if (!def) throw new Error(`Unknown tower type: ${type}`);

    this.type = type;
    this.cellX = cellX;
    this.cellY = cellY;
    const c = Grid.placementCellToWorld(cellX, cellY);
    this.position = { x: c.centerX, y: c.centerY };

    this.range = def.range;
    this.fireRate = def.fireRate;
    this.damage = def.damage;
    this.projectileSpeed = def.projectileSpeed || 0;
    this.pierceMode = def.pierceMode || 'none';
    this.projectileRangeMultiplier = def.projectileRangeMultiplier || 1;
    this.aoeRadius = def.aoeRadius || 0;
    this.projectilesPerBurst = def.projectilesPerBurst || 1;
    this.freezeDuration = def.freezeDuration || 0;
    this.freezeCooldown = def.freezeCooldown || 0;
    this.permanentSlow = false;

    this.upgradeLevel = 0;
    this.totalInvested = def.cost;

    this.rotation = 0;
    this.fireCooldown = 1 / (this.fireRate || 1);
    this.currentTarget = null;

    // Visual: random farmer outfit, default facing the path. Overridden each frame
    // when the tower has a target (4-way facing for the layered character).
    this.outfit = (typeof Assets !== 'undefined') ? Assets.randomOutfit() : null;
    this.facing = 'down';

    // Freeze-tower state.
    this.freezeReady = true;
    this.freezeTimer = 0;
    this.pendingFreezeTimer = null; // 0.15s delay between burst visual and the actual freeze
  }

  update(dt, state) {
    if (this.type === 'freeze') { this._updateFreeze(dt, state); return; }

    this._updateTarget(state.enemies);
    // circleShooter fires omnidirectionally — don't rotate its body.
    if (this.currentTarget && this.type !== 'circleShooter') this._faceTarget();

    this.fireCooldown -= dt;
    if (this.fireCooldown <= 0 && this.currentTarget) {
      this._fire(state);
      this.fireCooldown = 1 / this.fireRate;
    }
  }

  _updateTarget(enemies) {
    if (this.currentTarget) {
      const t = this.currentTarget;
      if (!t.isAlive) {
        this.currentTarget = null;
      } else {
        const dx = t.position.x - this.position.x;
        const dy = t.position.y - this.position.y;
        if (Math.hypot(dx, dy) > this.range) this.currentTarget = null;
      }
    }
    if (this.currentTarget) return;

    let best = null;
    let bestDist = this.range;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const dx = e.position.x - this.position.x;
      const dy = e.position.y - this.position.y;
      const d = Math.hypot(dx, dy);
      if (d <= bestDist) { best = e; bestDist = d; }
    }
    this.currentTarget = best;
  }

  _faceTarget() {
    const dx = this.currentTarget.position.x - this.position.x;
    const dy = this.currentTarget.position.y - this.position.y;
    this.rotation = Math.atan2(dy, dx);
    // Sprite facing — 4-way for the layered farmer.
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
    else                              this.facing = dy < 0 ? 'up'   : 'down';
  }

  _fire(state) {
    if      (this.type === 'basic')         this._fireBasic(state);
    else if (this.type === 'circleShooter') this._fireCircleShooter(state);
    else if (this.type === 'cannon')        this._fireCannon(state);
  }

  _fireBasic(state) {
    state.projectiles.push(new Projectile({
      type: 'basic',
      position: this.position,
      target: this.currentTarget,
      speed: this.projectileSpeed,
      damage: this.damage,
      homing: true,
      pierceMode: this.pierceMode,
      maxDistance: this.range * this.projectileRangeMultiplier,
      color: CONFIG.colors.projectileBasic,
    }));
  }

  _fireCircleShooter(state) {
    const n = this.projectilesPerBurst;
    const maxDist = this.range * this.projectileRangeMultiplier;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      state.projectiles.push(new Projectile({
        type: 'circleShooter',
        position: this.position,
        direction: dir,
        speed: this.projectileSpeed,
        damage: this.damage,
        homing: false,
        pierceMode: this.pierceMode,
        maxDistance: maxDist,
        color: CONFIG.colors.projectileCircleShooter,
      }));
    }
  }

  _fireCannon(state) {
    // Snapshot target position at fire time. Projectile never re-aims.
    const tp = { x: this.currentTarget.position.x, y: this.currentTarget.position.y };
    state.projectiles.push(new Projectile({
      type: 'cannon',
      position: this.position,
      targetPosition: tp,
      speed: this.projectileSpeed,
      damage: this.damage,
      aoeRadius: this.aoeRadius,
      color: CONFIG.colors.projectileCannon,
    }));
  }

  // ── Freeze tower ────────────────────────────────────────────────────

  _updateFreeze(dt, state) {
    // Apply pending freeze after the 0.15s delay (lets the burst visual read first).
    if (this.pendingFreezeTimer !== null) {
      this.pendingFreezeTimer -= dt;
      if (this.pendingFreezeTimer <= 0) {
        this._applyFreezeInRange(state);
        this.pendingFreezeTimer = null;
      }
    }

    if (!this.freezeReady) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) this.freezeReady = true;
      return;
    }

    // Pulse if any non-frozen enemy is in range.
    if (!this._hasNonFrozenTarget(state.enemies)) return;

    this.freezeReady = false;
    this.freezeTimer = this.freezeCooldown;
    this.pendingFreezeTimer = 0.15;
    Effects.spawnFreezeBurst(this.position, this.range);
  }

  _hasNonFrozenTarget(enemies) {
    for (const e of enemies) {
      if (!e.isAlive || e.isFrozen) continue;
      if (this._inRange(e)) return true;
    }
    return false;
  }

  _applyFreezeInRange(state) {
    for (const e of state.enemies) {
      if (!e.isAlive || e.isFrozen) continue;
      if (this._inRange(e)) e.applyFreeze(this.freezeDuration, this.permanentSlow);
    }
  }

  _inRange(enemy) {
    const dx = enemy.position.x - this.position.x;
    const dy = enemy.position.y - this.position.y;
    return Math.hypot(dx, dy) <= this.range;
  }

  sellValue() {
    return Math.floor(this.totalInvested * 0.5);
  }

  // ── Upgrades (step 9) ───────────────────────────────────────────────

  nextUpgrade() {
    const def = CONFIG.TOWERS[this.type];
    return this.upgradeLevel < def.upgrades.length
      ? def.upgrades[this.upgradeLevel]
      : null;
  }

  // Apply the next upgrade's multipliers in place. Caller is responsible for
  // checking affordability and deducting coins.
  upgrade() {
    const up = this.nextUpgrade();
    if (!up) return false;

    this.damage    *= up.damageMultiplier;
    this.range     *= up.rangeMultiplier;
    this.fireRate  *= up.fireRateMultiplier;
    this.projectileRangeMultiplier *= up.projectileRangeMultiplier;
    this.aoeRadius *= up.aoeRadiusMultiplier;
    this.freezeDuration *= up.freezeDurationMultiplier;

    // Pierce only upgrades, never downgrades.
    if (up.pierceUpgrade && PIERCE_ORDER[up.pierceUpgrade] > PIERCE_ORDER[this.pierceMode]) {
      this.pierceMode = up.pierceUpgrade;
    }

    if (up.permanentSlow) this.permanentSlow = true;

    this.totalInvested += up.cost;
    this.upgradeLevel += 1;

    // Reset fire cooldown so the upgrade kicks in on the next natural shot, not instantly.
    if (this.fireRate > 0) this.fireCooldown = Math.max(this.fireCooldown, 1 / this.fireRate * 0.5);

    return true;
  }
}
