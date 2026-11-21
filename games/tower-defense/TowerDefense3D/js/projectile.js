import { Sound } from './audio.js';
import { CONFIG, CHAIN_HITS } from './config.js';
import { Effects } from './effects.js';
import { state } from './main.js';

// Projectile entity. Two variants share the class:
//   - *directional* (archer): homes in on its target. With a chain upgrade, a hit sends
//     the arrow on to the nearest enemy it has not hit yet (within CONFIG.chainRange);
//     with no enemy in reach, or no jumps left, it is gone.
//   - *AoE* (cannon): flies in a straight line toward a snapshotted targetPosition; on
//     arrival, damages every enemy within aoeRadius with linear falloff and explodes.

export class Projectile {
  constructor({
    type,
    position,
    // directional inputs:
    direction, target, homing, pierceMode, maxDistance,
    // AoE inputs:
    targetPosition, aoeRadius,
    // shared:
    speed, damage, color,
  }) {
    this.type = type;
    this.position = { x: position.x, y: position.y };
    this.startPosition = { x: position.x, y: position.y };
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.isAlive = true;
    this.lifetime = 0;

    this.isAoE = !!aoeRadius;

    if (this.isAoE) {
      this.targetPosition = { x: targetPosition.x, y: targetPosition.y };
      this.aoeRadius = aoeRadius;
      // Fixed direction — snapshot at fire time, never re-aims.
      const dx = this.targetPosition.x - position.x;
      const dy = this.targetPosition.y - position.y;
      const d = Math.hypot(dx, dy) || 1;
      this.direction = { x: dx / d, y: dy / d };
    } else {
      this.target = target || null;
      this.homing = !!homing;
      this.pierceMode = pierceMode || 'none';
      this.maxDistance = maxDistance;
      this.hitEnemies = new Set();
      this.hitsLeft = CHAIN_HITS[this.pierceMode] || 1;

      if (direction) {
        const dlen = Math.hypot(direction.x, direction.y) || 1;
        this.direction = { x: direction.x / dlen, y: direction.y / dlen };
      } else if (target) {
        const dx = target.position.x - position.x;
        const dy = target.position.y - position.y;
        const d = Math.hypot(dx, dy) || 1;
        this.direction = { x: dx / d, y: dy / d };
      } else {
        this.direction = { x: 1, y: 0 };
      }
    }
    this.rotation = Math.atan2(this.direction.y, this.direction.x);
  }

  update(dt, state) {
    this.lifetime += dt;
    if (this.lifetime >= 5) { this.isAlive = false; return; }
    if (this.isAoE) this._updateAoE(dt, state);
    else this._updateDirectional(dt, state);
  }

  _updateAoE(dt, state) {
    this.position.x += this.direction.x * this.speed * dt;
    this.position.y += this.direction.y * this.speed * dt;

    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    if (Math.hypot(dx, dy) <= CONFIG.projectileHitRadius) {
      this._explode(state);
    }
  }

  _explode(state) {
    for (const e of state.enemies) {
      if (!e.isAlive || e.spawnTimer > 0) continue;
      const dx = e.position.x - this.position.x;
      const dy = e.position.y - this.position.y;
      const d = Math.hypot(dx, dy);
      if (d <= this.aoeRadius) {
        // Spec: 100% damage at center, 50% at edge.
        const falloff = 1 - (d / this.aoeRadius) * 0.5;
        e.takeDamage(this.damage * falloff, state);
      }
    }
    Effects.spawnExplosion(this.position, this.aoeRadius);
    Sound.play('explosion');
    this.isAlive = false;
  }

  _updateDirectional(dt, state) {
    // Target gone (another tower got it first)? Pick the nearest enemy in reach rather
    // than flying off into nowhere; with none in reach the arrow simply ends.
    if (this.homing && (!this.target || !this.target.isAlive)) {
      this.target = this._nextChainTarget(state);
      if (!this.target) { this.isAlive = false; return; }
    }
    // Re-aim every frame while homing.
    if (this.homing && this.target) {
      const dx = this.target.position.x - this.position.x;
      const dy = this.target.position.y - this.position.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.001) {
        this.direction.x = dx / d;
        this.direction.y = dy / d;
        this.rotation = Math.atan2(dy, dx);
      }
    }

    this.position.x += this.direction.x * this.speed * dt;
    this.position.y += this.direction.y * this.speed * dt;

    const rx = this.position.x - this.startPosition.x;
    const ry = this.position.y - this.startPosition.y;
    if (Math.hypot(rx, ry) >= this.maxDistance) { this.isAlive = false; return; }

    const baseR = CONFIG.projectileHitRadius;
    for (const e of state.enemies) {
      if (!e.isAlive || e.spawnTimer > 0) continue;
      if (this.hitEnemies.has(e)) continue;
      const ex = e.position.x - this.position.x;
      const ey = e.position.y - this.position.y;
      // Enemies are now large relative to the base hit radius; include their visual
      // radius so shots connect on the surface instead of requiring a center-point hit.
      const r = baseR + e.radius;
      if (ex * ex + ey * ey <= r * r) {
        e.takeDamage(this.damage, state);
        this.hitEnemies.add(e);
        this.hitsLeft -= 1;

        if (this.hitsLeft <= 0) { this.isAlive = false; return; }
        // Chain on: home in on the nearest enemy not hit yet, or stop here.
        const next = this._nextChainTarget(state);
        if (!next) { this.isAlive = false; return; }
        this.target = next;
        this.homing = true;
        this.startPosition = { x: this.position.x, y: this.position.y };
        this.maxDistance = CONFIG.chainRange * 1.6;
        return;
      }
    }
  }

  _nextChainTarget(state) {
    let best = null, bestD = CONFIG.chainRange;
    for (const e of state.enemies) {
      if (!e.isAlive || e.spawnTimer > 0 || this.hitEnemies.has(e)) continue;
      const d = Math.hypot(e.position.x - this.position.x, e.position.y - this.position.y);
      if (d <= bestD) { best = e; bestD = d; }
    }
    return best;
  }
}
