// Stations hold state + item visuals; the interaction *rules* live in game.js.
import * as THREE from 'three';
import { TILE, getModel } from './models.js';
import { ITEMS, DISHES, matchDish } from './recipes.js';
import { audio } from './audio.js';

// ---------- items ----------
export function makeIngredient(id) { return { type: 'ing', id }; }
export function makePlate(contents = [], dirty = false) {
  return { type: 'plate', contents, dirty, dish: matchDish(contents) };
}

const ITEM_SCALE = 0.95;

/** Build the visual for any logical item (ingredient or plate w/ stack). */
export function buildItemMesh(item) {
  const g = new THREE.Group();
  if (!item) return g;
  if (item.type === 'ing') {
    const def = ITEMS[item.id];
    const m = getModel(def.model, def.tint || null);
    m.scale.setScalar(ITEM_SCALE);
    g.add(m);
  } else {
    const plate = getModel(item.dirty ? 'plate_dirty' : 'plate');
    g.add(plate);
    if (!item.dirty) {
      if (item.dish && DISHES[item.dish].model) {
        const dm = getModel(DISHES[item.dish].model);
        dm.scale.setScalar(0.92);
        dm.position.y = 0.08;
        g.add(dm);
      } else {
        item.contents.forEach((id, i) => {
          const def = ITEMS[id];
          const m = getModel(def.model, def.tint || null);
          m.scale.setScalar(0.8);
          m.position.y = 0.08 + i * 0.16;
          m.rotation.y = i * 0.9;
          g.add(m);
        });
      }
    }
  }
  return g;
}

// ---------- progress ring (canvas sprite above stoves/boards) ----------
export function makeRingSprite() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.setScalar(1.1);
  spr.renderOrder = 5;
  spr.userData = { cv, tex };
  spr.visible = false;
  return spr;
}
export function drawRing(spr, frac, color = '#2ee6c0', warn = false) {
  const { cv, tex } = spr.userData;
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 64, 64);
  c.beginPath(); c.arc(32, 32, 24, 0, Math.PI * 2);
  c.fillStyle = 'rgba(10,16,38,.78)'; c.fill();
  c.beginPath(); c.moveTo(32, 32);
  c.arc(32, 32, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
  c.closePath(); c.fillStyle = color; c.fill();
  if (warn) {
    c.font = '34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('!', 32, 34);
  }
  tex.needsUpdate = true;
}

// ---------- station ----------
export class Station {
  /** type: counter|crate|board|stove|oven|sink|rack|trash|hatch */
  constructor(type, col, row, worldPos, topY) {
    this.type = type;
    this.col = col; this.row = row;
    this.pos = worldPos;            // tile center, y = 0
    this.topY = topY;               // where items sit
    this.item = null;
    this.itemMesh = null;
    this.holder = new THREE.Group();
    this.holder.position.set(worldPos.x, topY, worldPos.z);

    // crate
    this.crateItem = null;
    // board
    this.progress = 0;
    // stove / oven
    this.cookT = 0; this.burnT = 0; this.state = 'idle';  // idle|cooking|ready|burnt
    this.ring = null;
    // rack / sink
    this.plates = 0;
    this.dirtyPlates = 0;
    this.stackGroup = null;
  }

  setItem(item, bounce = true) {
    if (this.itemMesh) this.holder.remove(this.itemMesh);
    this.item = item;
    this.itemMesh = item ? buildItemMesh(item) : null;
    if (this.itemMesh) {
      this.holder.add(this.itemMesh);
      if (bounce) {
        this.itemMesh.position.y = 0.35;
        this.itemMesh.userData.drop = 0.35;
      }
    }
    if (this.type === 'board') this.progress = 0;
  }

  takeItem() {
    const it = this.item;
    this.setItem(null);
    return it;
  }

  /** Refresh plate stack visuals on rack/sink. */
  refreshStack() {
    if (this.stackGroup) this.holder.remove(this.stackGroup);
    this.stackGroup = new THREE.Group();
    const n = this.type === 'rack' ? this.plates : this.dirtyPlates;
    const model = this.type === 'rack' ? 'plate' : 'plate_dirty';
    for (let i = 0; i < Math.min(n, 5); i++) {
      const p = getModel(model);
      p.position.y = i * 0.14;
      p.rotation.y = i * 0.5;
      if (this.type === 'sink') p.position.set(0.45, 0.02 + i * 0.14, -0.3);
      this.stackGroup.add(p);
    }
    this.holder.add(this.stackGroup);
  }

  /** Per-frame: cooking logic + item drop animation. Returns events. */
  update(dt, paused) {
    const ev = [];
    if (this.itemMesh && this.itemMesh.userData.drop > 0) {
      this.itemMesh.userData.drop -= dt * 2.2;
      const k = Math.max(0, this.itemMesh.userData.drop);
      this.itemMesh.position.y = k * k * 8 * 0.35;
    }
    if ((this.type === 'stove' || this.type === 'oven') && !paused) {
      const def = this.item && this.item.type === 'ing' ? ITEMS[this.item.id] : null;
      if (this.state === 'cooking' && def && (def.cookTo || def.bakeTo)) {
        const total = def.cookTime || def.bakeTime;
        this.cookT += dt;
        if (this.cookT >= total) {
          this.setItem(makeIngredient(def.cookTo || def.bakeTo), false);
          this.state = 'ready'; this.burnT = 0;
          ev.push('ready');
        }
      } else if (this.state === 'ready' && def && def.burnTo) {
        this.burnT += dt;
        if (this.burnT >= def.burnTime) {
          this.setItem(makeIngredient(def.burnTo), false);
          this.state = 'burnt';
          ev.push('burnt');
        }
      }
      if (this.ring) {
        if (this.state === 'cooking') {
          const total = (ITEMS[this.item.id].cookTime || ITEMS[this.item.id].bakeTime);
          this.ring.visible = true;
          drawRing(this.ring, this.cookT / total, '#ffcf5e');
        } else if (this.state === 'ready' && ITEMS[this.item.id]?.burnTo) {
          const frac = this.burnT / ITEMS[this.item.id].burnTime;
          this.ring.visible = true;
          drawRing(this.ring, frac, frac > 0.55 ? '#ff8585' : '#2ee6c0', frac > 0.55);
        } else {
          this.ring.visible = false;
        }
      }
    }
    return ev;
  }

  /** Put a cookable on the stove/oven. */
  startCooking(item) {
    this.setItem(item, false);
    const def = ITEMS[item.id];
    if (def.cookTo || def.bakeTo) { this.state = 'cooking'; this.cookT = 0; }
    else if (def.burnTo) { this.state = 'ready'; this.burnT = 0; }
    else this.state = 'idle';
    if (this.type === 'stove') audio.sizzle(true);
  }

  clearCooking() {
    const it = this.takeItem();
    this.state = 'idle'; this.cookT = 0; this.burnT = 0;
    if (this.ring) this.ring.visible = false;
    return it;
  }
}
