// Projectile entity. Two variants share the class:
//   - *directional* (basic, circleShooter): optionally homing, checks per-enemy hits, uses
//     pierce/maxDistance/lifetime for destruction.
//   - *AoE* (cannon): flies in a straight line toward a snapshotted targetPosition; on
//     arrival, damages every enemy within aoeRadius with linear falloff and explodes.

class Projectile {
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
      this.hitsLeft =
        this.pierceMode === 'none'   ? 1 :
        this.pierceMode === 'hitTwo' ? 2 :
        /* infinite */                 Infinity;

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
      if (!e.isAlive) continue;
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
    this.isAlive = false;
  }

  _updateDirectional(dt, state) {
    // Re-aim while homing and target alive. First hit disables homing permanently.
    if (this.homing && this.target && this.target.isAlive) {
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
      if (!e.isAlive) continue;
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

        // Spec: on first hit, stop homing and reset startPosition so piercing projectiles
        // get full range from the hit point onward.
        if (this.hitEnemies.size === 1) {
          this.homing = false;
          this.startPosition = { x: this.position.x, y: this.position.y };
        }

        if (this.hitsLeft <= 0) { this.isAlive = false; return; }
      }
    }
  }
}
