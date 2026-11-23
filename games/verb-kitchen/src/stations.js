// Stations hold state + item visuals; the interaction *rules* live in game.js.
import * as THREE from 'three';
import { TILE, getModel, measureModel } from './models.js';
import { ITEMS, DISHES, matchDish, isBurgerDish, PIZZA_TOPPING_MODELS, BURGER_LAYER_ORDER, BURGER_LAYER_MODELS, POT_LAYERS, POT_VEG_MODELS, SANDWICH_MODEL, SANDWICH_LAYER_MODELS, SOUP_COLORS, SUNDAE_BALLS } from './recipes.js';
import { audio } from './audio.js';

// ---------- items ----------
// `n` (optional, > 1) = a STACK of identical items on one tile (the 3 bread
// slices a cut loaf leaves on the board). Taken one at a time: Station.takeOne.
export function makeIngredient(id, n = 1) { return n > 1 ? { type: 'ing', id, n } : { type: 'ing', id }; }
export function makePlate(contents = [], dirty = false) {
  return { type: 'plate', contents, dirty, dish: matchDish(contents) };
}

const ITEM_SCALE = 0.95;
const sauceMat = new THREE.MeshStandardMaterial({ color: 0xd2402e, roughness: 0.85 });

// ---------- serving vessel (per level) ----------
// Most levels plate on a `plate`; the soup level serves in a `bowl` instead.
// One module-level switch (set by game.startLevel) so every render path — the
// carried/served vessel, the rack stack, the dirty-sink pile — uses the right
// model without threading it through makePlate everywhere.
let VESSEL = 'plate';
export function setVessel(v) { VESSEL = (v === 'bowl') ? 'bowl' : 'plate'; }
const vesselModel = (dirty) => VESSEL === 'bowl'
  ? (dirty ? 'bowl_dirty' : 'bowl')
  : (dirty ? 'plate_dirty' : 'plate');

// Pizzas read better small: the dough model alone is nearly plate-sized.
const PIZZA_SCALE = 0.72;

/** Unscaled rolled dough + optional red sauce disc (crust stays visible). */
function saucedParts(withSauce = true) {
  const g = new THREE.Group();
  const base = getModel('food_ingredient_dough_base');
  g.add(base);
  const m = measureModel('food_ingredient_dough_base');
  if (withSauce) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(m.radius * 0.68, m.radius * 0.68, 0.03, 20), sauceMat);
    disc.position.y = m.height + 0.012;
    g.add(disc);
  }
  return { g, m };
}

/** Pizza-in-progress: rolled dough + any subset of {sauce, cheese, mushroom},
 *  always layered bottom→top in the SAME order — so the look depends only on
 *  WHICH toppings are present, never the order they were added.
 *  Bits stay INSIDE the sauce disc (radius 0.68): centers ≤ 0.42·r. */
function composePizza(toppings) {
  const has = (t) => toppings.includes(t);
  const { g, m } = saucedParts(has('sauce'));
  const scatter = (model, spots, scale, y) => {
    for (const [sx, sz] of spots) {
      const bit = getModel(model);
      bit.scale.setScalar(scale);
      bit.position.set(sx * m.radius, y, sz * m.radius);
      bit.rotation.y = (sx * 7 + sz * 13) % (Math.PI * 2);
      g.add(bit);
    }
  };
  // cheese layer: few BIG readable pieces
  if (has('cheese')) scatter(PIZZA_TOPPING_MODELS.cheese,
    [[-0.06, 0.18], [0.24, -0.14], [-0.26, -0.18]],
    0.7, m.height + 0.045);
  if (has('mushroom')) scatter(PIZZA_TOPPING_MODELS.mushroom,
    [[0.04, -0.32], [-0.3, 0.1], [0.3, 0.18], [0, 0]],
    0.45, m.height + 0.075);
  g.scale.setScalar(PIZZA_SCALE);
  return g;
}

/** Visible burger build: bun bottom, real layers, bun top when complete. */
// Burger stack from a contents list (must include 'bun'). `closed` adds the top
// bun (a complete, servable burger). Works on a plate (baseY = plate top) OR as
// a standalone plate-less burgerwip (baseY = 0). Fillings are ~10% bigger than
// before so each ingredient (patty / cheese slice / lettuce) reads inside the bun.
function composeBurger(contents, closed, baseY = 0) {
  const g = new THREE.Group();
  let y = baseY;
  const bb = getModel('food_ingredient_bun_bottom');
  bb.position.y = y;
  g.add(bb);
  y += Math.max(0.1, measureModel('food_ingredient_bun_bottom').height * 0.85);
  const S = 0.86;
  for (const layer of BURGER_LAYER_ORDER) {
    if (!contents.includes(layer)) continue;
    const model = BURGER_LAYER_MODELS[layer];
    const mm = measureModel(model);
    const lm = getModel(model);
    lm.scale.setScalar(S);
    // some models (cheese slice) have their origin ABOVE the geometry (minY<0),
    // which sinks them into the layer below — lift each so it rests on `y`
    lm.position.y = y - (mm.minY || 0) * S;
    g.add(lm);
    y += Math.max(0.08, mm.height * S * 0.8);
  }
  if (closed) {
    const bt = getModel('food_ingredient_bun_top');
    bt.position.y = y;
    g.add(bt);
  }
  return g;
}

/** Pot-in-progress: the empty pot (`pot_B`) + a soup SURFACE + the chopped veg
 *  resting in it, always in canonical order (order-free, like composePizza).
 *  The surface colour comes from the veg SET only (recipes.SOUP_COLORS):
 *  one veg = clear water, a complete recipe = water that turns into the recipe
 *  colour while it boils (Station.update), a boiled soup (`cooked`) = the full
 *  recipe colour, filled a little higher. The surface sits INSIDE the rim: its
 *  radius is the pot's inner wall (≈0.40 of the model), not the bounding box
 *  (0.70 — that includes the handles and made the soup stick out). */
const POT_SCALE = 0.9;
const POT_INNER_R = 0.37;            // pot_B inner wall radius near the top (model units)
const POT_H = 0.5;                   // pot_B height (model units)
function composePot(veg, broth, cooked = false) {
  const g = new THREE.Group();
  const pot = getModel('pot_B');
  pot.scale.multiplyScalar(POT_SCALE);
  g.add(pot);
  const r = POT_INNER_R * POT_SCALE;
  const level = POT_H * POT_SCALE * (cooked ? 0.8 : 0.72);
  if (broth) {
    const mat = new THREE.MeshStandardMaterial({ color: SOUP_COLORS[broth] || broth, roughness: cooked ? 0.55 : 0.25 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.04, 24), mat);
    disc.position.y = level;
    g.add(disc);
    g.userData.brothMat = mat;
  }
  // chopped bits floating on the surface, spread around the centre
  const spots = { carrot: [0.34, 0.1], potato: [-0.05, -0.36], onion: [-0.34, 0.14], mushroom: [0.28, -0.26] };
  for (const t of POT_LAYERS) {
    if (!veg.includes(t)) continue;
    const bit = getModel(POT_VEG_MODELS[t]);
    bit.scale.setScalar(cooked ? 0.4 : 0.45);
    const [sx, sz] = spots[t] || [0, 0];
    bit.position.set(sx * r, level - 0.03, sz * r);
    bit.rotation.y = (sx * 9 + sz * 11) % (Math.PI * 2);
    g.add(bit);
  }
  return g;
}

/** A served soup: the clean bowl + the soup surface (recipe colour) + a couple
 *  of its veg bits. Bowl inner radius ≈0.40, height 0.30 (model units). */
function composeBowlSoup(def) {
  const g = new THREE.Group();
  g.add(getModel('bowl'));
  const mat = new THREE.MeshStandardMaterial({ color: SOUP_COLORS[def.soup], roughness: 0.55 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.33, 0.04, 24), mat);
  disc.position.y = 0.22;
  g.add(disc);
  (def.veg || []).forEach((t, i) => {
    const bit = getModel(POT_VEG_MODELS[t]);
    bit.scale.setScalar(0.36);
    bit.position.set(i ? -0.13 : 0.12, 0.2, i ? 0.08 : -0.06);
    bit.rotation.y = i * 2.1 + 0.4;
    g.add(bit);
  });
  return g;
}

/** A bread slice lying FLAT (the model stands upright, origin at its bottom
 *  edge): tipped onto its back and centred, resting on y = 0. */
function flatSlice(def) {
  const g = new THREE.Group();
  const mm = measureModel(def.model);
  const s = def.scale || 1;
  const m = getModel(def.model, def.tint || null);
  m.scale.setScalar(s);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, SLICE_THICK * s / 2, mm.height * s / 2);
  g.add(m);
  return g;
}
const SLICE_THICK = 0.1;             // Tiny Treats bread_slice thickness (model units)
const SANDWICH_ORDER = ['cheese_chopped', 'lettuce_chopped', 'tomato_slices'];

/** Sandwich build on a slice of toast (contents must include 'toast'): an
 *  open-faced toast with the real filling layers while it is being built; a
 *  filling set that matches a dish (`closed`) shows the finished sandwich. */
function composeSandwich(contents, closed, baseY = 0) {
  const g = new THREE.Group();
  if (closed) {
    const sw = getModel(SANDWICH_MODEL);
    sw.scale.setScalar(1.45);
    sw.position.y = baseY;
    g.add(sw);
    return g;
  }
  const toast = flatSlice(ITEMS.toast);
  toast.position.y = baseY;
  g.add(toast);
  let y = baseY + SLICE_THICK * ITEMS.toast.scale;
  const S = 0.78;
  for (const layer of SANDWICH_ORDER) {
    if (!contents.includes(layer)) continue;
    const model = SANDWICH_LAYER_MODELS[layer];
    const mm = measureModel(model);
    const lm = getModel(model);
    lm.scale.setScalar(S);
    lm.position.y = y - (mm.minY || 0) * S;   // low-origin models (cheese slice) rest on `y`
    g.add(lm);
    y += Math.max(0.06, mm.height * S * 0.8);
  }
  return g;
}

/** The ice-cream scoop (L7's one tool), optionally with a ball of ice cream in
 *  it. The model stands on its handle with the cup opening sideways (−z):
 *  handle y −0.24…0.25, cup centre at y ≈ 0.5.
 *  Lying (in hand / on a counter): tipped onto its back so the cup opens
 *  UPWARD and the ball sits in it; turned a little so it reads from the
 *  camera and in the icons. Upright (`upright`, in the scoop stand): handle
 *  down in the cup of the stand, the ball perched on top. */
export const SCOOP_SCALE = 1.35;
function composeScoop(ballId, upright = false) {
  const g = new THREE.Group();
  const tool = getModel('icecream_scoop');
  const ball = ballId ? getModel(ITEMS[ballId].model) : null;
  if (ball) ball.scale.setScalar(0.92);
  if (upright) {
    tool.rotation.y = Math.PI;                 // cup opening toward the camera
    tool.position.y = 0.27;                    // handle end near the bottom of the stand's cup
    g.add(tool);
    if (ball) { ball.position.set(0, 0.27 + 0.56, 0.04); g.add(ball); }
  } else {
    const lie = new THREE.Group();
    tool.rotation.x = Math.PI / 2;             // (x, y, z) → (x, −z, y): cup up, head toward +z
    tool.position.set(0, 0.13, -0.22);         // rest on the surface, centred lengthwise
    lie.add(tool);
    if (ball) { ball.position.set(0, 0.1, 0.28); lie.add(ball); }
    lie.rotation.y = -0.6;
    g.add(lie);
  }
  g.scale.setScalar(SCOOP_SCALE);
  return g;
}

/** A sundae bowl (L7): the clean bowl + exactly what is in it — the balls
 *  side by side (canonical flavour order), then the toppings: the cherry on
 *  top, the waffle standing at the back, the cookie stick leaning out on the
 *  right. Works for a part-built bowl and a finished sundae alike. */
function composeSundae(contents) {
  const g = new THREE.Group();
  g.add(getModel('bowl'));
  const FLOOR = 0.06;
  const balls = SUNDAE_BALLS.filter((id) => contents.includes(id));
  const BALL = [1, 1.2, 0.98, 0.88][balls.length];             // one ball fills the bowl, three share it
  const spots = [[], [[0, 0]], [[-0.2, 0.03], [0.2, 0.03]], [[-0.2, -0.1], [0.2, -0.1], [0, 0.2]]][balls.length];
  balls.forEach((id, i) => {
    const b = getModel(ITEMS[id].model);
    b.scale.setScalar(BALL);
    b.position.set(spots[i][0], FLOOR, spots[i][1]);
    b.rotation.y = i * 2.1;
    g.add(b);
  });
  const top = balls.length ? FLOOR + 0.36 * BALL : FLOOR;      // top of the balls
  if (contents.includes('waffle')) {
    const w = getModel('icecream_waffle');
    w.scale.setScalar(0.95);
    w.rotation.set(-1.15, 0, 0.12);            // standing, leaning back
    w.position.set(-0.1, top + 0.08, -0.26);
    g.add(w);
  }
  if (contents.includes('cookiestick')) {
    const c = getModel('icecream_cookiestick');
    c.scale.setScalar(1.35);
    c.rotation.set(-0.25, 0, -0.5);            // leaning out to the right
    c.position.set(0.27, top + 0.12, -0.12);
    g.add(c);
  }
  if (contents.includes('cherry')) {
    const c = getModel('icecream_cherry');
    c.scale.setScalar(1.1);
    // on top of the single ball / in the dip between several
    c.position.set(0, balls.length > 1 ? top - 0.07 : top - 0.03, balls.length === 3 ? 0.03 : 0.02);
    g.add(c);
  }
  return g;
}

/** Build the visual for one ingredient (handles composed items). */
function ingredientMesh(id) {
  const def = ITEMS[id];
  if (def.compose === 'scoop') return composeScoop(def.holds);
  if (def.compose === 'pizza') return composePizza(def.toppings);
  if (def.compose === 'burger') return composeBurger(def.expandsTo, !!def.dish, 0);
  if (def.compose === 'pot') return composePot(def.veg, def.broth, !!def.cooked);
  if (def.compose === 'bowlsoup') return composeBowlSoup(def);
  if (def.compose === 'sandwich') return composeSandwich(def.expandsTo, !!def.dish, 0);
  if (def.flat) return flatSlice(def);
  const m = getModel(def.model, def.tint || null);
  if (def.scale) m.scale.multiplyScalar(def.scale);
  if (def.lay) {
    // lay a standing model on its side: tip it 90° about z (its long axis then
    // runs along x) and rest the now-lowest side on y = 0
    const g = new THREE.Group();
    m.rotation.z = Math.PI / 2;
    const mm = measureModel(def.model);
    m.position.y = mm.radius * (def.scale || 1) * 0.98;
    g.add(m);
    return g;
  }
  return m;
}

/** A stack of `n` identical items (bread slices on the board): shingled like
 *  fanned cards — each slice sits a bit higher and further along, slightly
 *  turned — so every slice's edge shows and the player can COUNT what's left
 *  (3 → 2 → 1). */
function stackMesh(id, n) {
  const g = new THREE.Group();
  const step = 0.2;
  for (let i = 0; i < n; i++) {
    const m = ingredientMesh(id);
    const k = i - (n - 1) / 2;
    m.position.set(k * step, i * 0.07, -k * 0.05);
    m.rotation.y = k * 0.28;
    g.add(m);
  }
  return g;
}

/** A slice standing upright in a toaster slot (the toaster holder sits at the
 *  toaster's top edge): deep in the slot while it toasts, popped up when done. */
function toasterSliceMesh(id, state) {
  const def = ITEMS[id];
  const g = new THREE.Group();
  const m = getModel(def.model, def.tint || null);
  m.scale.setScalar(TOASTER_SCALE);
  const h = measureModel(def.model).height * TOASTER_SCALE;
  m.position.set(0, -h * (state === 'cooking' ? 0.62 : 0.3), TOASTER_SLOT_Z);
  g.add(m);
  return g;
}
export const TOASTER_SCALE = 1.5;    // Tiny Treats toaster on a KayKit counter
const TOASTER_SLOT_Z = 0;

/** Build the visual for any logical item (ingredient or plate w/ stack). */
export function buildItemMesh(item) {
  const g = new THREE.Group();
  if (!item) return g;
  if (item.type === 'ing') {
    const m = item.n > 1 ? stackMesh(item.id, item.n) : ingredientMesh(item.id);
    m.scale.multiplyScalar(ITEM_SCALE);
    // lift models whose origin sits above their geometry (cheese slice) so they
    // rest on the surface instead of sinking into the board / counter
    const def = ITEMS[item.id];
    if (def.model && !def.flat && !def.lay) {
      const mm = measureModel(def.model);
      if (mm.minY < -0.001) m.position.y -= mm.minY * ITEM_SCALE * (def.scale || 1);
    }
    g.add(m);
    return g;
  }
  // plate / bowl (the serving vessel is per-level)
  const isBowl = VESSEL === 'bowl';
  if (item.dirty) { g.add(getModel(vesselModel(true))); return g; }
  // A filled SOUP bowl: bowl + soup surface in the recipe colour (no nesting).
  const soup = isBowl && item.contents.find((id) => ITEMS[id] && ITEMS[id].compose === 'bowlsoup');
  if (soup) { g.add(composeBowlSoup(ITEMS[soup])); return g; }
  // A SUNDAE bowl (L7), part-built or finished: bowl + its balls and toppings.
  if (isBowl && item.contents.some((id) => ITEMS[id] && ITEMS[id].sundae)) {
    g.add(composeSundae(item.contents));
    return g;
  }
  const plate = getModel(vesselModel(false));
  g.add(plate);
  const PLATE_TOP = 0.08;
  if (item.dish && DISHES[item.dish].model) {
    // baked pizzas keep the finished plated model (small — see PIZZA_SCALE)
    const dm = getModel(DISHES[item.dish].model, DISHES[item.dish].model_tint || null);
    dm.scale.setScalar(DISHES[item.dish].model_scale || 0.66);
    dm.position.y = PLATE_TOP;
    g.add(dm);
  } else if (item.contents.includes('bun')) {
    g.add(composeBurger(item.contents, isBurgerDish(item.dish), PLATE_TOP));
  } else if (item.contents.includes('toast')) {
    g.add(composeSandwich(item.contents, false, PLATE_TOP));   // a dish set took the branch above
  } else {
    // salad & loose items: arranged side by side, not stacked
    const n = item.contents.length;
    item.contents.forEach((id, i) => {
      const m = ingredientMesh(id);
      m.scale.multiplyScalar(0.72);
      const ang = (i / Math.max(1, n)) * Math.PI * 2 + 0.7;
      const r = n > 1 ? 0.16 : 0;
      m.position.set(Math.cos(ang) * r, PLATE_TOP + 0.02, Math.sin(ang) * r);
      m.rotation.y = i * 1.7;
      g.add(m);
    });
  }
  return g;
}

// ---------- progress bar (canvas sprite above stoves/boards) ----------
export function makeRingSprite() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 32;
  const tex = new THREE.CanvasTexture(cv);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  spr.scale.set(1.6, 0.4, 1);
  spr.renderOrder = 5;
  spr.userData = { cv, tex };
  spr.visible = false;
  return spr;
}
export function drawRing(spr, frac, color = '#2ee6c0', warn = false) {
  const { cv, tex } = spr.userData;
  const c = cv.getContext('2d');
  const W = 128, H = 32, R = H / 2;
  c.clearRect(0, 0, W, H);
  // track
  c.beginPath(); c.roundRect(0, 0, W, H, R);
  c.fillStyle = 'rgba(10,16,38,.78)'; c.fill();
  // fill
  const pad = 5;
  const fw = (W - pad * 2) * Math.min(1, frac);
  if (fw > 1) {
    c.beginPath(); c.roundRect(pad, pad, Math.max(fw, H - pad * 2), H - pad * 2, R - pad);
    c.fillStyle = color; c.fill();
  }
  if (warn) {
    c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText('!', W / 2, H / 2 + 1);
  }
  tex.needsUpdate = true;
}

const _soupCol = new THREE.Color();

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
    // counter: 'scoop' = the scoop stand (L7) — only the ice-cream scoop goes here
    this.stand = null;
    // board
    this.progress = 0;
    // stove / oven (cooker: 'toaster' = a stove-type station for bread slices)
    this.cooker = null;
    this.cookT = 0; this.burnT = 0; this.state = 'idle';  // idle|cooking|ready|burnt
    this.ring = null;
    // rack / sink
    this.plates = 0;
    this.dirtyPlates = 0;
    this.stackGroup = null;
  }

  setItem(item, bounce = true, keepProgress = false) {
    if (this.itemMesh) this.holder.remove(this.itemMesh);
    this.item = item;
    // a toaster shows its slice standing in the slot (see refreshToasterItem)
    const inToaster = item && this.cooker === 'toaster' && item.type === 'ing' && ITEMS[item.id].flat;
    // the scoop stand (L7) holds the scoop upright, handle down
    const inStand = item && this.stand && item.type === 'ing' && ITEMS[item.id].scoopTool;
    this.itemMesh = !item ? null : inToaster ? toasterSliceMesh(item.id, this.state)
      : inStand ? composeScoop(ITEMS[item.id].holds, true) : buildItemMesh(item);
    if (inToaster) bounce = false;
    if (this.itemMesh) {
      // long items (pepperoni!) lie along the board, not across it
      if (this.type === 'board') this.itemMesh.rotation.y = this.rot || 0;
      this.holder.add(this.itemMesh);
      if (bounce) {
        this.itemMesh.position.y = 0.35;
        this.itemMesh.userData.drop = 0.35;
      }
    }
    if (this.type === 'board' && !keepProgress) this.progress = 0;
  }

  takeItem() {
    const it = this.item;
    this.setItem(null);
    return it;
  }

  /** Take ONE item: from a stack (item.n > 1) one comes off and the rest stay
   *  (re-rendered with one fewer); otherwise the whole item. */
  takeOne() {
    const it = this.item;
    if (it && it.type === 'ing' && it.n > 1) {
      const rest = it.n - 1;
      this.setItem(makeIngredient(it.id, rest), false, true);
      return makeIngredient(it.id);
    }
    return this.takeItem();
  }

  /** Refresh plate visuals on rack/sink. */
  refreshStack() {
    if (this.stackGroup) this.holder.remove(this.stackGroup);
    this.stackGroup = new THREE.Group();
    const isBowl = VESSEL === 'bowl';
    if (this.type === 'rack') {
      const n = Math.min(this.plates, 4);
      if (isBowl) {
        // clean bowls just nest in a stack where the dish rack used to be
        for (let i = 0; i < n; i++) {
          const b = getModel('bowl');
          b.position.set(0, 0.04 + i * 0.12, 0);
          this.stackGroup.add(b);
        }
      } else {
        // plates stand upright, side by side in the rack slots (0–4 visible)
        for (let i = 0; i < n; i++) {
          const p = getModel('plate');
          // on edge, face along the row (disc normal = x), all leaning the same way
          p.rotation.z = Math.PI / 2 - 0.12;
          p.position.set(-0.36 + i * 0.24, 0.42, 0);
          this.stackGroup.add(p);
        }
        this.stackGroup.rotation.y = (this.rot || 0) + Math.PI / 2;  // match the turned rack
      }
    } else {
      // dirty pile at the sink: bowls nest on the RIGHT, plates pile at the back
      for (let i = 0; i < Math.min(this.dirtyPlates, 4); i++) {
        const p = getModel(isBowl ? 'bowl_dirty' : 'plate_dirty');
        if (isBowl) p.position.set(0.5, 0.04 + i * 0.12, 0.2);
        else p.position.set(0.45, 0.02 + i * 0.14, -0.3);
        p.rotation.y = i * 0.5;
        this.stackGroup.add(p);
      }
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
        // a complete soup pot: the clear water turns into the recipe colour as it boils
        if (def.boilsTo && this.itemMesh) {
          const mat = this._brothMat(this.itemMesh);
          if (mat) mat.color.set(SOUP_COLORS.water).lerp(_soupCol.set(SOUP_COLORS[def.boilsTo]), Math.min(1, this.cookT / total));
        }
        if (this.cookT >= total) {
          this.state = 'ready'; this.burnT = 0;
          this.setItem(makeIngredient(def.cookTo || def.bakeTo), false);   // (toast pops up: state first)
          ev.push('ready');
        }
      } else if (this.state === 'ready' && def && def.burnTo) {
        this.burnT += dt;
        if (this.burnT >= def.burnTime) {
          this.state = 'burnt';
          this.setItem(makeIngredient(def.burnTo), false);
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

  _brothMat(mesh) {
    let mat = null;
    mesh.traverse((o) => { if (!mat && o.userData.brothMat) mat = o.userData.brothMat; });
    return mat;
  }

  /** Put a cookable on the stove/oven/toaster. */
  startCooking(item) {
    const def = ITEMS[item.id];
    if (def.cookTo || def.bakeTo) { this.state = 'cooking'; this.cookT = 0; }
    else if (def.burnTo) { this.state = 'ready'; this.burnT = 0; }
    else this.state = 'idle';
    this.setItem(item, false);       // after the state: a toaster slice sits by state
    if (this.type === 'stove' && this.cooker !== 'toaster') audio.sizzle(true);
  }

  clearCooking() {
    const it = this.takeItem();
    this.state = 'idle'; this.cookT = 0; this.burnT = 0;
    if (this.ring) this.ring.visible = false;
    return it;
  }
}
