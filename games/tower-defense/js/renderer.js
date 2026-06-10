// Canvas renderer. All game-world drawing happens here; UI is HTML/CSS.
// World uses tile coordinates; viewport.scale converts tiles → pixels.

// Slime sprite multipliers. Visual scale is decoupled from e.radius (collision)
// so we can resize sprites without touching gameplay.
const SLIME_VIS_SCALE   = 7.8;  // sprite drawn this many × e.radius
const SLIME_FEET_OFFSET = 1.17; // visible-feet offset below cy, in e.radius units
const SLIME_FEET_FRAC   = 0.66; // vertical position of visible feet within the 64px frame

const Renderer = {
  canvas: null,
  ctx: null,
  viewport: { scale: 1 },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Pixel-art assets — disable smoothing so upscaled sprites stay crisp.
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    const level = Level.current;
    // canvas sits inside #canvas-frame inside #game-container. Measure the container
    // (since canvas-frame sizes to the canvas, using it would be circular).
    const container = document.getElementById('game-container');
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    if (!level) {
      this.canvas.width = cw;
      this.canvas.height = ch;
      this.viewport.scale = 1;
      return;
    }

    const aspect = level.gridWidth / level.gridHeight;
    let w = cw;
    let h = w / aspect;
    if (h > ch) { h = ch; w = h * aspect; }

    this.canvas.width = Math.floor(w);
    this.canvas.height = Math.floor(h);
    this.viewport.scale = this.canvas.width / level.gridWidth;
    // Re-disable smoothing — Canvas resets the flag on size change.
    this.ctx.imageSmoothingEnabled = false;
  },

  render(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!Level.current) return;

    this._drawTiles(Level.current);
    if (state.placement.active) this._drawPlacementOverlay(state);
    if (state.selectedTower) this._drawRangeRing(state.selectedTower);
    this._drawTowers(state);
    this._drawProjectiles(state.projectiles);
    this._drawEnemies(state.enemies);
    this._drawEffects(state.effects);
    if (state.placement.active && state.mouseWorld) this._drawGhost(state);
  },

  // ─── Tiles ────────────────────────────────────────────────────────────

  _drawTiles(level) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const bg = (typeof Assets !== 'undefined') ? Assets.images.mapBg : null;

    if (bg) {
      // Pixel art — draw the whole background image to the world rect, no per-tile fills.
      ctx.drawImage(bg, 0, 0, level.gridWidth * s, level.gridHeight * s);

      // Spawn / goal markers still drawn on top so the player can see entry + exit.
      for (let y = 0; y < level.gridHeight; y++) {
        for (let x = 0; x < level.gridWidth; x++) {
          const type = level.tileKey[level.tiles[y][x]];
          if      (type === 'spawn') this._drawSpawnMarker(x, y, s);
          else if (type === 'goal')  this._drawGoalMarker(x, y, s);
        }
      }
      return;
    }

    // Fallback: colored tiles (placeholder mode).
    for (let y = 0; y < level.gridHeight; y++) {
      for (let x = 0; x < level.gridWidth; x++) {
        const type = level.tileKey[level.tiles[y][x]];
        ctx.fillStyle = CONFIG.colors[type] || CONFIG.colors.ground;
        ctx.fillRect(x * s, y * s, s, s);

        if (type === 'spawn') this._drawSpawnMarker(x, y, s);
        else if (type === 'goal') this._drawGoalMarker(x, y, s);
        else if (type === 'obstacle') this._drawObstacle(x, y, s);
      }
    }

    ctx.strokeStyle = CONFIG.colors.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= level.gridWidth; x++) {
      ctx.moveTo(x * s, 0); ctx.lineTo(x * s, level.gridHeight * s);
    }
    for (let y = 0; y <= level.gridHeight; y++) {
      ctx.moveTo(0, y * s); ctx.lineTo(level.gridWidth * s, y * s);
    }
    ctx.stroke();
  },

  _drawSpawnMarker(x, y, s) {
    const ctx = this.ctx;
    const cx = x * s + s / 2, cy = y * s + s / 2;
    ctx.fillStyle = CONFIG.colors.spawnMarker;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.22, cy - s * 0.25);
    ctx.lineTo(cx + s * 0.28, cy);
    ctx.lineTo(cx - s * 0.22, cy + s * 0.25);
    ctx.closePath();
    ctx.fill();
  },

  _drawGoalMarker(x, y, s) {
    const ctx = this.ctx;
    ctx.strokeStyle = CONFIG.colors.goalMarker;
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x * s + s * 0.25, y * s + s * 0.25);
    ctx.lineTo(x * s + s * 0.75, y * s + s * 0.75);
    ctx.moveTo(x * s + s * 0.75, y * s + s * 0.25);
    ctx.lineTo(x * s + s * 0.25, y * s + s * 0.75);
    ctx.stroke();
  },

  _drawObstacle(x, y, s) {
    const ctx = this.ctx;
    ctx.fillStyle = CONFIG.colors.obstacleDot;
    ctx.beginPath();
    ctx.arc(x * s + s / 2, y * s + s / 2, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  },

  // ─── Placement overlay ────────────────────────────────────────────────

  _drawPlacementOverlay(state) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const cellSize = CONFIG.placementCellSize * s;

    for (let cy = 0; cy < Grid.cellsY; cy++) {
      for (let cx = 0; cx < Grid.cellsX; cx++) {
        const available = Grid.isAvailable(cx, cy);
        ctx.fillStyle = available
          ? CONFIG.colors.overlayAvailable
          : CONFIG.colors.overlayUnavailable;
        ctx.fillRect(cx * cellSize, cy * cellSize, cellSize, cellSize);
      }
    }

    ctx.strokeStyle = CONFIG.colors.overlayCellLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cx = 0; cx <= Grid.cellsX; cx++) {
      ctx.moveTo(cx * cellSize, 0);
      ctx.lineTo(cx * cellSize, Grid.cellsY * cellSize);
    }
    for (let cy = 0; cy <= Grid.cellsY; cy++) {
      ctx.moveTo(0, cy * cellSize);
      ctx.lineTo(Grid.cellsX * cellSize, cy * cellSize);
    }
    ctx.stroke();
  },

  // ─── Towers ───────────────────────────────────────────────────────────

  _drawTowers(state) {
    for (const t of state.towers) this._drawTower(t, t === state.selectedTower);
  },

  _drawTower(t, selected) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const cx = t.position.x * s;
    const cy = t.position.y * s;
    const r = CONFIG.placementCellSize * s * 0.42;

    // Soft shadow under the farmer to seat them on the ground.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.95, r * 1.05, r * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    // Layered farmer (idle pose, facing target). Falls back to placeholder shape
    // when assets aren't loaded yet.
    const drew = this._drawFarmer(t, cx, cy, s);
    if (!drew) {
      const def = CONFIG.TOWERS[t.type];
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      this._drawTowerBadge(t, cx, cy, r);
    } else {
      // Type tag — small colored dot so the player can still tell tower types apart
      // before they read the upgrade panel.
      const def = CONFIG.TOWERS[t.type];
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(cx + r * 0.85, cy + r * 0.85, r * 0.20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.stroke();
    }

    if (selected) {
      ctx.strokeStyle = CONFIG.colors.towerSelectedRing;
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.25, r * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  // Draw the layered farmer. Sheets are 16×16 grid of 64px frames; idle uses
  // frame 0 (down), 16 (up), 32 (side, mirrored for left). Returns true on
  // successful draw, false if the body sheet hasn't loaded yet (caller falls back).
  _drawFarmer(t, cx, cy, s) {
    if (typeof Assets === 'undefined' || !t.outfit) return false;
    const body = Assets.farmerLayer('body', t.outfit.body);
    if (!body) return false;

    const frameIdx = this._farmerIdleFrame(t.facing);
    const flip     = (t.facing === 'left');

    // The farmer sprite frame is 64×64 but the visible character only fills the
    // top ~70% — feet sit around y≈45/64 of the frame, with empty padding below.
    // Scale the frame to ~2.4× the placement cell so the character fills the cell,
    // and anchor the visible feet (not the frame's bottom edge) to the shadow.
    const cell = CONFIG.placementCellSize * s;
    const drawSize = cell * 2.16;
    const drawW = drawSize;
    const drawH = drawSize;
    const FEET_FRAC = 0.70; // vertical position of feet within the 64px frame
    const dx = cx - drawW / 2;
    // Shadow center sits at cy + cell * 0.399 (see _drawTower); drop feet a bit
    // lower so they sit inside the shadow rather than on its top edge.
    const dy = cy + cell * 0.55 - drawH * FEET_FRAC;

    const sx = (frameIdx % 16) * 64;
    const sy = Math.floor(frameIdx / 16) * 64;

    const ctx = this.ctx;
    if (flip) {
      ctx.save();
      ctx.translate(dx + drawW, dy);
      ctx.scale(-1, 1);
      for (const slot of FARMER_LAYER_ORDER) {
        const img = Assets.farmerLayer(slot, t.outfit[slot]);
        if (img) ctx.drawImage(img, sx, sy, 64, 64, 0, 0, drawW, drawH);
      }
      ctx.restore();
    } else {
      for (const slot of FARMER_LAYER_ORDER) {
        const img = Assets.farmerLayer(slot, t.outfit[slot]);
        if (img) ctx.drawImage(img, sx, sy, 64, 64, dx, dy, drawW, drawH);
      }
    }
    return true;
  },

  _farmerIdleFrame(facing) {
    if (facing === 'down') return 0;
    if (facing === 'up')   return 16;
    return 32; // side (right or left — caller flips for left)
  },

  _drawTowerBadge(t, cx, cy, r) {
    const ctx = this.ctx;
    if (t.type === 'basic') {
      // Triangle barrel pointing at the current target.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t.rotation);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(r * 0.95, 0);
      ctx.lineTo(0, -r * 0.35);
      ctx.lineTo(0, r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (t.type === 'circleShooter') {
      // Dots around the edge.
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t.type === 'cannon') {
      // Square "barrel" on top, rotated toward target.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t.rotation);
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-r * 0.25, -r * 0.3, r * 1.0, r * 0.6);
      ctx.restore();
    } else if (t.type === 'freeze') {
      // Snowflake-ish asterisk.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7);
        ctx.stroke();
      }
    }
  },

  _drawRangeRing(tower) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const cx = tower.position.x * s;
    const cy = tower.position.y * s;
    const r = tower.range * s;

    ctx.fillStyle = CONFIG.colors.rangeRing;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = CONFIG.colors.rangeRingBorder;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.stroke();
  },

  // ─── Ghost preview ────────────────────────────────────────────────────

  _drawGhost(state) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const w = state.mouseWorld;
    if (!w) return;
    const { cellX, cellY } = Grid.worldToPlacementCell(w.x, w.y);
    if (!Grid.inBounds(cellX, cellY)) return;

    const valid = Grid.isAvailable(cellX, cellY);
    const def = CONFIG.TOWERS[state.placement.towerType];
    const center = Grid.placementCellToWorld(cellX, cellY);
    const cx = center.centerX * s;
    const cy = center.centerY * s;
    const r = CONFIG.placementCellSize * s * 0.42;

    // Range preview — only on valid cells, to cut visual noise.
    if (valid) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.arc(cx, cy, def.range * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.stroke();
    }

    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = valid ? CONFIG.colors.ghostValid : CONFIG.colors.ghostInvalid;
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  },

  // ─── Projectiles ──────────────────────────────────────────────────────

  _drawProjectiles(projectiles) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    for (const p of projectiles) {
      if (!p.isAlive) continue;
      const cx = p.position.x * s;
      const cy = p.position.y * s;
      const r = Math.max(2, s * 0.1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },

  // ─── Enemies ──────────────────────────────────────────────────────────

  _drawEnemies(enemies) {
    const ctx = this.ctx;
    const s = this.viewport.scale;
    const slimeSheet = (typeof Assets !== 'undefined') ? Assets.images.slimeWalk : null;

    for (const e of enemies) {
      if (!e.isAlive) continue;
      const radius = e.radius * s;
      const cx = e.position.x * s;
      const cy = e.position.y * s;

      if (slimeSheet) {
        this._drawSlime(e, slimeSheet, cx, cy, s);
      } else {
        ctx.fillStyle = this._enemyColor(e);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = e.isFrozen ? 'rgba(60,120,180,0.85)' : 'rgba(0,0,0,0.55)';
        ctx.lineWidth = Math.max(1, s * 0.04);
        ctx.stroke();
      }

      if (e.isBoss || e.currentHealth < e.maxHealth) {
        const bw = Math.max(radius * 6.5, e.isBoss ? s * 2 : 0);
        const bh = Math.max(2, s * 0.08);
        const bx = cx - bw / 2;
        // Sprite top is at cy + radius * (FEET_OFFSET - VIS_SCALE * FEET_FRAC) — bar sits just above.
        const by = cy + radius * (SLIME_FEET_OFFSET - SLIME_VIS_SCALE * SLIME_FEET_FRAC) - bh - 2;
        const frac = Math.max(0, e.currentHealth / e.maxHealth);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = frac > 0.5 ? '#4caf50' : frac > 0.2 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(bx, by, bw * frac, bh);
      }
    }
  },

  // Slime sheet layout (per character.json):
  //   row 0 = walk-down (frames 0-3), row 1 = walk-up (8-11),
  //   row 2 = walk-right (16-19), row 3 = walk-left (24-27). 64px frames, 8 cols.
  _drawSlime(e, sheet, cx, cy, s) {
    const ctx = this.ctx;
    // Visual size scales with tier. Visual scale is decoupled from the collision
    // radius (e.radius) so growing the sprite doesn't change hit detection.
    const drawW = e.radius * s * SLIME_VIS_SCALE;
    const drawH = drawW;
    // Anchor the visible feet (not the frame's bottom edge — slime sits in the top
    // ~⅔ of the 64px frame with empty padding below) at a fixed offset below cy.
    const dx = cx - drawW / 2;
    const dy = cy + e.radius * s * SLIME_FEET_OFFSET - drawH * SLIME_FEET_FRAC;

    const dir = e.facing || 'down';
    const baseFrame = dir === 'down' ? 0 : dir === 'up' ? 8 : dir === 'right' ? 16 : 24;
    const frame = baseFrame + (e.animFrame % 4);
    const sx = (frame % 8) * 64;
    const sy = Math.floor(frame / 8) * 64;

    // Color tints — damage flash, freeze blue. Apply via globalCompositeOperation overlay.
    if (e.damageTintTimer > 0) {
      ctx.save();
      ctx.drawImage(sheet, sx, sy, 64, 64, dx, dy, drawW, drawH);
      // Multiply a red wash on top of the just-drawn region.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 60, 60, 0.55)';
      ctx.fillRect(dx, dy, drawW, drawH);
      ctx.restore();
      return;
    }
    if (e.isFrozen) {
      ctx.save();
      ctx.drawImage(sheet, sx, sy, 64, 64, dx, dy, drawW, drawH);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(128, 204, 255, 0.55)';
      ctx.fillRect(dx, dy, drawW, drawH);
      ctx.restore();
      return;
    }
    if (e.isPermanentlySlowed) {
      ctx.save();
      ctx.drawImage(sheet, sx, sy, 64, 64, dx, dy, drawW, drawH);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(128, 204, 255, 0.22)';
      ctx.fillRect(dx, dy, drawW, drawH);
      ctx.restore();
      return;
    }
    ctx.drawImage(sheet, sx, sy, 64, 64, dx, dy, drawW, drawH);
  },

  _enemyColor(e) {
    if (e.damageTintTimer > 0) return '#ff4040';
    if (e.isFrozen) return 'rgba(128, 204, 255, 1)';
    if (e.isPermanentlySlowed) {
      // 30% blend toward freeze blue (spec).
      return this._blend(e.tier.color, '#80ccff', 0.3);
    }
    return e.tier.color;
  },

  _blend(hexA, hexB, t) {
    const a = this._hex(hexA), b = this._hex(hexB);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return `rgb(${r},${g},${bl})`;
  },

  _hex(h) {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
  },

  // ─── Effects ──────────────────────────────────────────────────────────

  _drawEffects(effects) {
    const s = this.viewport.scale;
    // Resolve the HUD coin counter's canvas-pixel center once per frame so flying coins
    // can animate to it without re-measuring the DOM per coin.
    const coinTarget = this._getCoinTargetCanvasPos();
    for (const fx of effects) {
      if      (fx.kind === 'ring')     this._drawRing(fx, s);
      else if (fx.kind === 'poof')     this._drawPoof(fx, s);
      else if (fx.kind === 'particle') this._drawParticle(fx, s);
      else if (fx.kind === 'coin' && coinTarget) this._drawCoin(fx, s, coinTarget);
      else if (fx.kind === 'screenFlash') this._drawScreenFlash(fx);
    }
  },

  _drawRing(fx, s) {
    const ctx = this.ctx;
    const t = fx.elapsed / fx.duration;
    const r = (fx.startRadius + (fx.endRadius - fx.startRadius) * t) * s;
    const alpha = fx.fadeOut ? (1 - t) : 1;
    const cx = fx.position.x * s;
    const cy = fx.position.y * s;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (fx.fill) {
      ctx.fillStyle = fx.fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fx.stroke) {
      ctx.strokeStyle = fx.stroke;
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  _drawPoof(fx, s) {
    const ctx = this.ctx;
    const t = fx.elapsed / fx.duration;
    const x = (fx.position.x + fx.velocity.x * t) * s;
    const y = (fx.position.y + fx.velocity.y * t) * s;
    const radius = fx.startRadius * s * (1 - t * 0.25);
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fx.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawCoin(fx, s, target) {
    if (fx.elapsed <= 0) return; // staggered release; still waiting its turn
    const ctx = this.ctx;
    const t = Math.min(1, fx.elapsed / fx.duration);
    // Ease-in on travel so coins accelerate out of the burst.
    const ease = t * t * (3 - 2 * t); // smoothstep
    const startX = (fx.worldStart.x + fx.spread.x) * s;
    const startY = (fx.worldStart.y + fx.spread.y) * s;
    const x = startX + (target.x - startX) * ease;
    const arcLift = fx.arcHeight * s * 4 * t * (1 - t); // parabola peak at t=0.5
    const y = startY + (target.y - startY) * ease - arcLift;

    const r = Math.max(3.5, s * 0.22);
    ctx.save();
    // Shadow on the canvas directly beneath the coin's travel — cheap depth cue.
    ctx.fillStyle = '#e0a828';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd447';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _getCoinTargetCanvasPos() {
    const el = document.getElementById('coin-count');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - canvasRect.left,
      y: rect.top + rect.height / 2 - canvasRect.top,
    };
  },

  _drawParticle(fx, s) {
    const ctx = this.ctx;
    const t = fx.elapsed / fx.duration;
    if (t < 0) return;
    // Linear damp the velocity so particles slow as they fade — nicer arc than pure linear.
    const damp = 1 - t * 0.4;
    const x = (fx.position.x + fx.velocity.x * fx.elapsed * damp) * s;
    const y = (fx.position.y + fx.velocity.y * fx.elapsed * damp) * s;
    const radius = Math.max(1, fx.startRadius * s * (1 - t));
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fx.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawScreenFlash(fx) {
    const ctx = this.ctx;
    const t = fx.elapsed / fx.duration;
    // Sharp start, softer fade — matches "flash" feel better than linear.
    const alpha = Math.max(0, (1 - t) ** 1.5) * 0.9;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const innerR = Math.min(w, h) * 0.35;
    const outerR = Math.hypot(w, h) * 0.65;
    const gradient = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    gradient.addColorStop(0, 'rgba(255, 40, 40, 0)');
    gradient.addColorStop(0.7, 'rgba(255, 40, 40, 0.55)');
    gradient.addColorStop(1, 'rgba(200, 0, 0, 0.95)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  },
};
