import { Sound } from './audio.js';
import { Track } from './analytics.js';
import { CONFIG, getTierForHealth } from './config.js';
import { Effects } from './effects.js';
import { state } from './main.js';

// Enemy entity.
//   step 2: waypoint walking
//   step 4: takeDamage + die + damage tint
//   step 5: freeze state + permanent-slow flag
//   step 7: tier transformation (Titan → Brute → Warrior → …)
//   step 8: flying-coin rewards on kill (tier-transformation coins still pay immediately)

export class Enemy {
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
    // Normal enemies rise out of the ground first (visual: Spawn_Ground animation).
    // Until they are up, towers ignore them and nothing can hurt or freeze them.
    // Bosses simply appear.
    this.spawnTimer = isBoss ? 0 : CONFIG.enemySpawnRise;
    this.stunTimer = this.spawnTimer;
    this.damageTintTimer = 0;

    const first = path.waypoints[0];
    this.position = { x: first.x, y: first.y };
    this.direction = { x: 1, y: 0 };
    this.currentWaypointIndex = 1;

    // Animation state (slime sprite). frameTime advances while moving; on freeze it pauses.
    this.animFrame = 0;
    this.animTimer = Math.random() * 0.5; // desync slimes so they don't bob in lockstep
    this.facing = 'right';                // one of 'down','up','left','right'
  }

  update(dt, state) {
    if (this.damageTintTimer > 0) this.damageTintTimer -= dt;
    if (this.spawnTimer > 0) this.spawnTimer -= dt;
    if (!this.isAlive || this.isDying) return;

    if (this.isFrozen) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) this.unfreeze();
      return; // frozen pose — animation paused
    }

    if (this.stunTimer > 0) { this.stunTimer -= dt; return; }
    if (this.currentWaypointIndex >= this.path.waypoints.length) return;

    const wp = this.path.waypoints[this.currentWaypointIndex];
    const tx = wp.x;
    const ty = wp.y;
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

  // Where this enemy will be in t seconds if nothing changes: it waits out a freeze or
  // stun, then walks on along its road at its current speed. Used by the catapult and
  // the cannon to aim ahead (a boulder flies up to ~0.7 s).
  predictPosition(t) {
    const wait = this.isFrozen ? Math.max(0, this.freezeTimer) : Math.max(0, this.stunTimer || 0, this.spawnTimer || 0);
    let travel = Math.max(0, t - wait) * this.moveSpeed;
    let x = this.position.x, y = this.position.y;
    const wps = this.path.waypoints;
    for (let i = this.currentWaypointIndex; travel > 0 && i < wps.length; i++) {
      const dx = wps[i].x - x, dy = wps[i].y - y, d = Math.hypot(dx, dy);
      if (d >= travel) { x += dx / d * travel; y += dy / d * travel; travel = 0; }
      else { x = wps[i].x; y = wps[i].y; travel -= d; }
    }
    return { x, y };
  }

  applyFreeze(duration, applyPermanentSlow) {
    if (this.spawnTimer > 0) return; // still rising out of the ground
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
    // Untouchable while rising out of the ground: no tower may camp the spawn point.
    if (this.spawnTimer > 0) return;
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
    Sound.play('transform');

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
      if (this.coinReward > 0) Effects.spawnFlyingCoins(this.position, this.coinReward);
      Sound.play('enemyDie');
    }
  }

  reachEnd(state) {
    this.isAlive = false;
    if (state) {
      state.lives = Math.max(0, state.lives - 1);
      Track.leak();
      Effects.spawnCastleHit(this.position);
      Effects.spawnScreenFlash();
      Sound.play('castleHit');
    }
  }
}
