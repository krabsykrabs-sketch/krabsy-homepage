// Enemy entity.
//   step 2: waypoint walking
//   step 4: takeDamage + die + damage tint
//   step 5: freeze state + permanent-slow flag
//   step 7: tier transformation (Titan → Brute → Warrior → …)
//   step 8: flying-coin rewards on kill (tier-transformation coins still pay immediately)

class Enemy {
  constructor({ path, maxHealth, baseSpeed, isBoss = false }) {
    this.path = path;
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
    this.isBoss = isBoss;

    this.tier = isBoss ? CONFIG.bossType : getTierForHealth(maxHealth);
    this.baseSpeed = baseSpeed;
    this.baseMoveSpeed = baseSpeed * this.tier.speedMultiplier;
    this.moveSpeed = this.baseMoveSpeed;
    this.scale = this.tier.scale;
    this.radius = this.scale * CONFIG.enemyRadiusPerScale;
    this.coinReward = this.tier.coinReward;

    this.isAlive = true;
    this.isDying = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.isPermanentlySlowed = false;
    this.permanentSlowMultiplier = 1;
    this.stunTimer = 0;
    this.damageTintTimer = 0;

    const first = path.waypoints[0];
    this.position = { x: first.x + 0.5, y: first.y + 0.5 };
    this.direction = { x: 1, y: 0 };
    this.currentWaypointIndex = 1;

    // Animation state (slime sprite). frameTime advances while moving; on freeze it pauses.
    this.animFrame = 0;
    this.animTimer = Math.random() * 0.5; // desync slimes so they don't bob in lockstep
    this.facing = 'right';                // one of 'down','up','left','right'
  }

  update(dt, state) {
    if (this.damageTintTimer > 0) this.damageTintTimer -= dt;
    if (!this.isAlive || this.isDying) return;

    if (this.isFrozen) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) this.unfreeze();
      return; // frozen pose — animation paused
    }

    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (this.currentWaypointIndex >= this.path.waypoints.length) return;

    const wp = this.path.waypoints[this.currentWaypointIndex];
    const tx = wp.x + 0.5;
    const ty = wp.y + 0.5;
    const dx = tx - this.position.x;
    const dy = ty - this.position.y;
    const dist = Math.hypot(dx, dy);
    const step = this.moveSpeed * dt;

    if (dist <= step) {
      this.position.x = tx;
      this.position.y = ty;
      this.currentWaypointIndex++;
      if (this.currentWaypointIndex >= this.path.waypoints.length) {
        this.reachEnd(state);
      }
      return;
    }

    this.direction.x = dx / dist;
    this.direction.y = dy / dist;
    this.position.x += this.direction.x * step;
    this.position.y += this.direction.y * step;

    // Tick walk animation. Slime sheet has 4 walk frames per direction at 8 fps.
    this.animTimer += dt;
    const frameDur = 1 / 8;
    while (this.animTimer >= frameDur) {
      this.animTimer -= frameDur;
      this.animFrame = (this.animFrame + 1) % 4;
    }
    // Pick facing from dominant axis (4-way).
    if (Math.abs(dx) > Math.abs(dy)) this.facing = dx < 0 ? 'left' : 'right';
    else                              this.facing = dy < 0 ? 'up'   : 'down';
  }

  applyFreeze(duration, applyPermanentSlow) {
    this.isFrozen = true;
    this.freezeTimer = duration;
    if (applyPermanentSlow) {
      this.isPermanentlySlowed = true;
      this.permanentSlowMultiplier = 0.5;
    }
  }

  unfreeze() {
    this.isFrozen = false;
    this.moveSpeed = this.isPermanentlySlowed
      ? this.baseMoveSpeed * this.permanentSlowMultiplier
      : this.baseMoveSpeed;
  }

  takeDamage(amount, state) {
    if (!this.isAlive || this.isDying) return;
    this.currentHealth -= amount;
    this.damageTintTimer = 0.1;
    if (this.currentHealth <= 0) {
      this.die(state);
      return;
    }
    if (!this.isBoss) this._checkTierTransformation(state);
  }

  // Spec: if damage drops health below the current tier's threshold, downgrade in place.
  // Exactly one new enemy replaces the old — we mutate the same instance. Health carries
  // over; wave speed is inherited (effective speed = baseSpeed × newTier.speedMultiplier).
  // Permanent slow is inherited; frozen state is NOT.
  _checkTierTransformation(state) {
    const newTier = getTierForHealth(this.currentHealth);
    if (newTier.healthThreshold >= this.tier.healthThreshold) return;

    const coinDiff = this.tier.coinReward - newTier.coinReward;
    if (coinDiff > 0 && state) state.coins += coinDiff; // immediate, no flying coins

    Effects.spawnPoof(this.position);

    this.tier = newTier;
    this.scale = newTier.scale;
    this.radius = this.scale * CONFIG.enemyRadiusPerScale;
    this.coinReward = newTier.coinReward;
    this.baseMoveSpeed = this.baseSpeed * newTier.speedMultiplier;
    this.moveSpeed = this.isPermanentlySlowed
      ? this.baseMoveSpeed * this.permanentSlowMultiplier
      : this.baseMoveSpeed;

    if (this.isFrozen) this.unfreeze();

    this.stunTimer = 0.3;
  }

  die(state) {
    if (!this.isAlive || this.isDying) return;
    this.isAlive = false;
    if (state) {
      Effects.spawnKillParticles(this.position, this.tier.color);
      Effects.spawnFlyingCoins(this.position, this.coinReward);
    }
  }

  reachEnd(state) {
    this.isAlive = false;
    if (state) {
      state.lives = Math.max(0, state.lives - 1);
      Effects.spawnScreenFlash();
    }
  }
}
