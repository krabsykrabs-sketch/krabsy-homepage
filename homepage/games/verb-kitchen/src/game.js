// Core game orchestrator: scene, loop, interactions, scoring, round flow.
import * as THREE from 'three';
import { withRetry } from './retry.js';
import { TILE, preloadRestaurant, charUnlocked, loadChefAssets } from './models.js';
import { ITEMS, DISHES, matchDish, canPlate, combine, itemModelNames, isPotItem, potRecipeHint } from './recipes.js';
import { LEVELS, levelModelNames } from './levels.js';
import { World } from './world.js';
import { Chef, preloadChef } from './chef.js';
import { Helper } from './helper.js';
import { makeIngredient, makePlate, buildItemMesh, drawRing, setVessel } from './stations.js';
import { Orders } from './orders.js';
import { SinkQuiz } from './sink.js';
import { loadQuestionEngine } from './verbs.js';
import { FX } from './fx.js';
import { modelIcon, itemIcon } from './icons.js';
import { Tutorial } from './tutorial.js';
import { MistakePointer } from './pointer.js';
import { ui } from './ui.js';
import { audio } from './audio.js';
import { t } from './i18n.js';

const CHOP_TIME = 1.4;
const PLATE_RETURN_DELAY = 5;
const FIT_MAX_Y = 2.6;           // camera fit ignores the tall upper walls (the hatch window stays in view)
const ANSWERS_PER_PLATE = 2;       // one verb per plate: its 2nd form, then its 3rd (see sink.js)

export class Game {
  constructor(renderer, save, onRoundEnd) {
    this.renderer = renderer;
    this.save = save;
    this.onRoundEnd = onRoundEnd;
    this.scene = null;
    this.camera = null;
    this.running = false;
    this.keys = {};
    this.qaFrozen = false;
    this.fpsAvg = 60;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('resize', () => this.onResize());
  }

  async preload(level) {
    // The recipe card IS the loading screen now (see startLevel), so no
    // separate full-screen loader here — just resolve when assets are ready.
    let charName = 'rogue';
    try {
      const c = localStorage.getItem('krabsy_vkitchen_char');
      if (c && charUnlocked(c, this.save)) charName = c;
    } catch (e) {}
    // editor-JSON levels: fetch the scene, preload exactly the models it places
    // (+ the gameplay item models / board knife) instead of the ASCII set.
    let decorModels;
    if (level.jsonUrl) {
      if (!level.scene) level.scene = await withRetry(async () => {
        const r = await fetch(level.jsonUrl, { cache: 'no-cache' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }, level.jsonUrl);
      decorModels = [...new Set(level.scene.objects.map((o) => o.model)), 'knife',
        ...(level.props || []).map((p) => p.model)];   // + code-side decor props
    } else {
      decorModels = levelModelNames(level);
    }
    const tasks = [
      preloadRestaurant([...decorModels, ...itemModelNames(level)]),
      preloadChef(charName),
      loadQuestionEngine(),            // site question engine (chain-order pairs); inline fallback
    ];
    // co-op levels load a SECOND character for the helper (kept apart from the
    // player's so the two chefs read as different people)
    if (level.coop) tasks.push(loadChefAssets(level.coop.char).then((a) => { this._helperAssets = a; }));
    await Promise.all(tasks);
  }

  async startLevel(levelIdx, opts = {}) {
    this.levelIdx = levelIdx;
    this.level = LEVELS[levelIdx];
    // The recipe card doubles as the loading screen: it appears immediately
    // with a pizza-building animation, and the "Let's cook!" button only
    // unlocks once all assets (models + the recipe image) have loaded.
    // ui.showTutorial calls load() again when the player taps "Try again"
    // after a download failed; it only resolves once everything has loaded.
    const load = () => this.preload(this.level);
    if (!opts.skipCountdown) await ui.showTutorial(this.level, load);
    else await load();

    // --- scene ---
    this.disposeScene();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1430);
    this.scene.fog = new THREE.Fog(0x0c1430, 40, 80);

    setVessel(this.level.vessel || 'plate');   // soup serves in bowls, not plates
    this.world = new World(this.level);
    this.scene.add(this.world.group);

    const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x303a55, 1.15);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const ext = Math.max(this.world.cols, this.world.rows) * TILE * 0.65;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);

    // --- camera: fixed angled top-down, fit whole kitchen ---
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    this.fitCamera();

    // --- actors ---
    this.chef = new Chef(this.world);
    this.chef.pos.copy(this.world.spawn);
    this.scene.add(this.chef.obj);

    // co-op helper: a second chef driven by a bot brain (see helper.js)
    if (this.level.coop) {
      const hc = new Chef(this.world, this._helperAssets);
      hc.speedScale = this.level.coop.moveSpeed != null ? this.level.coop.moveSpeed : 0.55;
      const sp = this.level.coop.spawn;
      hc.pos.copy(sp ? this.world.tileWorld(sp.col, sp.row) : this.world.spawn);
      this.scene.add(hc.obj);
      this.helper = new Helper(this, hc, this.level.coop);
    } else {
      this.helper = null;
    }

    if (this.fx) this.fx.hushSays();         // a line still up from the previous round
    this.fx = new FX(this.scene, this.camera, this.renderer);
    this.pointer = new MistakePointer(this.scene);
    this.quiz = new SinkQuiz(this);
    this.orders = new Orders(this.level);

    this.sinkStation = this.world.stations.find((s) => s.type === 'sink');
    this.rackStation = this.world.stations.find((s) => s.type === 'rack');
    this.hatchStation = this.world.stations.find((s) => s.type === 'hatch');
    this.rackStation.plates = this.level.plates;
    this.sinkStation.dirtyPlates = this.level.startDirty || 0;   // start with a dirty plate to wash
    this.rackStation.refreshStack();
    this.sinkStation.refreshStack();
    for (const s of this.world.startItems || []) {
      const st = this.world.stationAtTile(s.c, s.r);
      if (st) st.setItem(s.item === 'plate' ? makePlate([]) : makeIngredient(s.item), false);
    }

    // --- round state ---
    this.score = 0;
    this.combo = 0;
    this.elapsed = 0;                // count-UP clock (deliver all orders fast!)
    this.washProgress = 0;           // correct answers banked toward the next clean plate
    this.washTarget = ANSWERS_PER_PLATE;
    this.washesCompleted = 0;        // plates fully washed this round (for the tutorial)
    this.questionOpen = false;
    this.plateReturns = [];          // timers for dirty plates in transit
    this.roundOver = false;
    this.lastHint = null;
    // co-op: the helper introduces itself once, shortly after the round starts
    this.helperIntroT = this.helper && this.level.coop.intro ? 0.6 : null;

    // guided step-by-step tutorial on the salad level (banner + pointer arrow)
    if (this.level.guided) this.tutorial = new Tutorial(this);
    else { this.tutorial = null; ui.tutorialHide(); }

    ui.showScreen(null);
    ui.hud(true);
    ui.setCoins(0); ui.setCombo(0); ui.setTime(this.elapsed);
    ui.setPlates(this.rackStation.plates);
    ui.setOrders(0, this.orders.total);

    this._fitPts = null;             // re-sample now that start items + plates are placed
    this.onResize();
    if (!opts.skipCountdown) {
      this.renderOnce();
      await ui.countdown();
    }
    audio.music(this.levelIdx);
    this.clock = new THREE.Clock();
    this.running = true;
    if (!this._loopStarted) { this._loopStarted = true; this.loop(); }
  }

  /** World-space sample of the kitchen's actual geometry (walls, counters,
   *  stations), cached per level. Fitting real vertices instead of a guessed
   *  bounding box is what lets the camera zoom in tight. */
  kitchenPoints() {
    if (this._fitPts && this._fitPtsWorld === this.world) return this._fitPts;
    const g = this.world.group;
    g.updateMatrixWorld(true);
    const meshes = [];
    let total = 0;
    g.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
      let vis = true;
      for (let p = o.parent; p && p !== g; p = p.parent) if (!p.visible) { vis = false; break; }
      if (!vis) return;
      meshes.push(o); total += o.geometry.attributes.position.count;
    });
    const stride = Math.max(1, Math.floor(total / 7000));   // ~2.5k kept after the height cut
    const pts = [];
    const v = new THREE.Vector3();
    for (const m of meshes) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        // only what you play on: floor, counters, stations and the items on
        // them. The tall walls are backdrop — they may run under the HUD, which
        // buys a lot of zoom.
        if (v.y <= FIT_MAX_Y) pts.push(v.clone());
      }
    }
    // ~2.5k points is plenty for the fit and keeps a resize under a few ms
    const keep = Math.max(1, Math.ceil(pts.length / 2500));
    this._fitPts = keep > 1 ? pts.filter((_, i) => i % keep === 0) : pts;
    this._fitPtsWorld = this.world;
    return this._fitPts;
  }

  /** Where the HUD sits on screen, for the camera fit: `frame` = the usable
   *  screen margins, `blocks` = HUD rectangles (px) the kitchen must stay out
   *  of. On landscape screens (`sideHud`) the tickets stack in a column on the
   *  left and the tutorial card sits on the right; on portrait screens the
   *  tickets run along the top and the tutorial along the bottom. Space for
   *  all 3 tickets is always kept, so the camera never moves mid-round. */
  hudLayout(W, H) {
    const side = W / H >= 1.15 && W >= 600;
    document.body.classList.toggle('sideHud', side);
    // ticket size follows the screen (the CSS-only formula divided a length by
    // a number, which is invalid, so tickets never scaled)
    const ts = Math.min(2.2, Math.max(0.85, Math.min(W, H) / 700));
    document.documentElement.style.setProperty('--ticket-scale', ts.toFixed(3));
    const tk = document.getElementById('tickets');
    const m = tk && getComputedStyle(tk).transform.match(/matrix\(([^,]+)/);
    const s = m ? parseFloat(m[1]) || 1 : 1;             // rendered ticket scale
    const tw = 128 * s, th = 96 * s, gap = 10 * s;       // one ticket card
    const topbar = document.getElementById('topbar');
    const barBottom = (topbar && topbar.getBoundingClientRect().bottom) || 52;
    const tkTop = (tk && tk.getBoundingClientRect().top) || barBottom + 4;
    const pad = 8;
    const blocks = [];
    // the hint pill, bottom centre
    blocks.push({ x0: W / 2 - Math.min(270, W * 0.45), x1: W / 2 + Math.min(270, W * 0.45), y0: H - 52, y1: H });
    if (side) blocks.push({ x0: 0, x1: 10 + tw + pad, y0: 0, y1: tkTop + 3 * th + 2 * gap + pad });
    else blocks.push({ x0: 0, x1: 10 + 3 * tw + 2 * gap + pad, y0: 0, y1: tkTop + th + pad });
    const tut = document.getElementById('tutorial');
    if (this.level?.guided && tut) {
      const r = tut.getBoundingClientRect();
      // steps differ in length: leave room for a taller card than the current one
      const grow = side ? 40 : 16;
      blocks.push({ x0: r.left - pad - 14, x1: r.right + pad, y0: r.top - pad - grow, y1: r.bottom + pad + grow });
    }
    return { frame: { x0: 6, x1: W - 6, y0: barBottom + 4, y1: H - 6 }, blocks };
  }

  fitCamera() {
    const W = window.innerWidth, H = window.innerHeight;
    const cam = this.camera;
    const pitch = THREE.MathUtils.degToRad(56);
    const target = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const pts = this.kitchenPoints();
    const { frame, blocks } = this.hudLayout(W, H);
    const n = pts.length;
    const sx = new Float32Array(n), sy = new Float32Array(n);

    cam.aspect = W / H;
    cam.clearViewOffset();
    const p = new THREE.Vector3();
    let found = null;
    // project the kitchen at camera distance `dist`, then look for a 2D image
    // shift (view offset) that keeps every point on screen and out of every
    // HUD block. Returns the shift, or null if the kitchen is too big.
    const tryDist = (dist) => {
      cam.position.copy(target).addScaledVector(dir, dist);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < n; i++) {
        p.copy(pts[i]).project(cam);
        const x = (p.x + 1) / 2 * W, y = (1 - p.y) / 2 * H;
        sx[i] = x; sy[i] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      // a point lands at (x - ox, y - oy); the frame bounds the shift
      const oxLo = x1 - frame.x1, oxHi = x0 - frame.x0;
      const oyLo = y1 - frame.y1, oyHi = y0 - frame.y0;
      if (oxLo > oxHi || oyLo > oyHi) return null;
      const cx = (x0 + x1) / 2 - (frame.x0 + frame.x1) / 2;   // centred shift
      const cy = (y0 + y1) / 2 - (frame.y0 + frame.y1) / 2;
      const N = 12, cands = [];
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
        const ox = oxLo + (oxHi - oxLo) * i / N, oy = oyLo + (oyHi - oyLo) * j / N;
        cands.push({ ox, oy, d: (ox - cx) ** 2 + (oy - cy) ** 2 });
      }
      cands.push({ ox: Math.min(oxHi, Math.max(oxLo, cx)), oy: Math.min(oyHi, Math.max(oyLo, cy)), d: -1 });
      cands.sort((a, b) => a.d - b.d);
      for (const c of cands) {
        let ok = true;
        for (const b of blocks) {
          const bx0 = b.x0 + c.ox, bx1 = b.x1 + c.ox, by0 = b.y0 + c.oy, by1 = b.y1 + c.oy;
          for (let i = 0; i < n; i++) {
            if (sx[i] > bx0 && sx[i] < bx1 && sy[i] > by0 && sy[i] < by1) { ok = false; break; }
          }
          if (!ok) break;
        }
        if (ok) return c;
      }
      return null;
    };
    // closer camera = bigger kitchen; binary search the closest one that fits
    let lo = 3, hi = 80, best = null;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const c = tryDist(mid);
      if (c) { hi = mid; best = c; } else lo = mid;
    }
    found = tryDist(hi) || best || { ox: 0, oy: 0 };
    // a view offset is a pure 2D image shift: perspective unchanged, and
    // raycasts / project() (touch, FX pops) follow it automatically
    cam.setViewOffset(W, H, found.ox, found.oy, W, H);
    cam.updateProjectionMatrix();
  }

  onResize() {
    if (!this.camera) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.fitCamera();
  }

  // ---------- input ----------
  onKey(e, down) {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (down && this.quiz && this.quiz.open) {
      if (this.quiz.handleKey(e.key)) return;
    }
    this.keys[k] = down;
    if (!this.running || this.roundOver) return;
    if (down && !e.repeat) {
      if (k === 'e') this.interactE();
      if (k === ' ') this.spacePress();
    }
  }

  inputVector() {
    let x = 0, z = 0;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    if (this.keys['w'] || this.keys['arrowup']) z -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) z += 1;
    return { x, z };
  }

  targetStation() {
    const { col, row } = this.chef.targetTile();
    return this.world.stationAtTile(col, row);
  }

  // ---------- E: pick up / put down ----------
  interactE() {
    if (this.questionOpen) return;
    const st = this.targetStation();
    if (!st) return;
    const held = this.chef.carried;

    switch (st.type) {
      case 'crate': {
        // an ice-cream tub: only the scoop takes ice cream out of it
        if (ITEMS[st.crateItem].needsTool) { this.scoopAtTub(st, held); break; }
        if (!held) {
          const item = makeIngredient(st.crateItem);
          this.chef.setCarried(item, buildItemMesh(item));
        } else if (held.type === 'ing' && held.id === st.crateItem) {
          // put a mistakenly-grabbed ingredient back into its OWN box
          this.chef.setCarried(null);
          audio.putdown();
          this.fx.pop(st.pos.clone().setY(1.5), `${ITEMS[st.crateItem].emoji}↩`, 'var(--muted)');
        } else if (held.type === 'plate' && !held.dirty && ITEMS[st.crateItem].ontoPlate &&
                   canPlate(held.contents, st.crateItem)) {
          // carrying a plate (e.g. with a patty on it) to the bun box: a bun
          // goes straight onto the plate — no need to set the plate down first
          this.plateAdd(held, st.crateItem);
          this.chef.setCarried(held, buildItemMesh(held));
          if (held.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(1.4)); } else audio.putdown();
        } else this.reject(st);
        break;
      }
      case 'rack': {
        if (!held && st.plates > 0) {
          st.plates--; st.refreshStack();
          ui.setPlates(st.plates);
          const p = makePlate([]);
          this.chef.setCarried(p, buildItemMesh(p));
        } else if (held && held.type === 'ing' && ITEMS[held.id].plateable && st.plates > 0 && canPlate([], held.id)) {
          // grab a clean plate AND set the held item on it in one move
          st.plates--; st.refreshStack();
          ui.setPlates(st.plates);
          const p = makePlate([]);
          this.plateAdd(p, held.id);
          if (held.steam > 0) p.steam = held.steam;
          this.chef.setCarried(p, buildItemMesh(p));
          if (p.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); } else audio.clatter();
        } else if (held && held.type === 'plate' && !held.dirty && held.contents.length === 0) {
          st.plates++; st.refreshStack();
          ui.setPlates(st.plates);
          this.chef.setCarried(null);
          audio.clatter();
        } else if (st.plates === 0 && (!held || held.type === 'ing')) {
          // no clean plates left → the bubble shows a dirty one: wash it at the sink
          this.reject(st);
          if (this.sinkStation.dirtyPlates > 0) this.missing(st, [modelIcon(this.vesselIcon(true))], 'sink');
        } else this.reject(st);
        break;
      }
      case 'trash': {
        if (held && held.type === 'ing' && ITEMS[held.id].holds) {
          // a loaded scoop: the ball goes in the bin, the scoop stays in hand
          const empty = makeIngredient(ITEMS[held.id].emptyTo);
          this.chef.setCarried(empty, buildItemMesh(empty));
          audio.trash();
          this.fx.pop(st.pos.clone().setY(1.6), '🗑️', 'var(--muted)');
        } else if (held && held.type === 'ing' && ITEMS[held.id].reusable) {
          this.reject(st);            // the only ketchup bottle is not trash
        } else if (held && held.type === 'ing') {
          this.chef.setCarried(null);
          audio.trash();
          this.fx.pop(st.pos.clone().setY(1.6), '🗑️', 'var(--muted)');
        } else if (held && held.type === 'plate' && held.contents.length) {
          held.contents = []; held.dish = null;
          this.chef.setCarried(held, buildItemMesh(held));
          audio.trash();
        } else this.reject(st);
        break;
      }
      case 'hatch': {
        if (held && held.type === 'plate' && held.dish) {
          const res = this.orders.serve(held.dish);
          if (res) { this.serveSuccess(held, res, st); break; }
        }
        // trying to send out food that isn't on a plate → show the "use a plate" bubble
        if (held && held.type === 'ing') this.missing(st, [modelIcon(this.vesselIcon())], 'plate');
        this.reject(st);
        break;
      }
      case 'board': {
        // dump a chopped item from the board straight into a held composite (the
        // soup POT, a pizza base, a burger bun…) — combine, then clear the board.
        const boardInto = held && held.type === 'ing' && st.item && st.item.type === 'ing'
          ? combine(held.id, st.item.id) : null;
        if (boardInto) {
          st.takeOne();
          const r = makeIngredient(boardInto);
          this.chef.setCarried(r, buildItemMesh(r));
          this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
          audio.putdown();
          break;
        }
        // the other way round: a BASE lies on the board (a bun or toast parked
        // there, the pizza dough rolled there) and the held item goes onto it
        const ontoBoard = held && held.type === 'ing' && st.item && st.item.type === 'ing' && !(st.item.n > 1)
          ? combine(st.item.id, held.id) : null;
        if (ontoBoard) {
          st.setItem(makeIngredient(ontoBoard));
          if (!ITEMS[held.id].reusable) this.chef.setCarried(null);   // the ketchup bottle stays in hand
          this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
          audio.putdown();
          break;
        }
        // a slice back onto its stack (a cut loaf leaves up to 3 on the board)
        if (held && held.type === 'ing' && st.item && st.item.type === 'ing' && held.id === st.item.id &&
            ITEMS[held.id].stackMax && (st.item.n || 1) < ITEMS[held.id].stackMax) {
          st.setItem(makeIngredient(held.id, (st.item.n || 1) + 1), false);
          this.chef.setCarried(null);
          audio.putdown();
          break;
        }
        if (held && held.type === 'ing' && !st.item) {
          const def = ITEMS[held.id];
          // a raw choppable needs the matching tool; a cut/finished item can
          // just be parked here (set it down to free a hand, grab it later)
          if (!def.chopTo || (def.tool || 'knife') === (st.tool || 'knife')) {
            st.setItem(held);
            if (def.interim) st.progress = 0.5;   // resume the bar at halfway
            this.chef.setCarried(null);
          } else {
            // dough at a knife board (or veg at the rolling-pin board): point at the right one
            this.reject(st);
            this.missing(st, null, { board: def.tool || 'knife' });
          }
        } else if (held && held.type === 'plate' && !held.dirty && st.item && st.item.type === 'ing' &&
                   ITEMS[st.item.id].plateable && canPlate(held.contents, st.item.id)) {
          // scoop a chopped ingredient straight onto the plate in hand
          const ing = st.takeOne();
          this.plateAdd(held, ing.id);
          if (ing.steam > 0) held.steam = Math.max(held.steam || 0, ing.steam);
          this.chef.setCarried(held, buildItemMesh(held));
          if (held.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); }
        } else if (!held && st.item) {
          const it = st.takeOne();          // one slice off a stack, else the whole item
          this.chef.setCarried(it, buildItemMesh(it));
        } else this.reject(st);
        break;
      }
      case 'stove':
      case 'oven': {
        // SOUP: a pot lives permanently on the stove. Tip chopped veg in (it
        // auto-boils when a recipe is complete), then scoop the soup into a bowl.
        if (st.type === 'stove' && st.item && st.item.type === 'ing' && isPotItem(st.item.id)) {
          this.potStoveInteract(st, held); break;
        }
        const wantsBake = st.type === 'oven';
        // 1) put a raw item on to cook / bake
        if (held && held.type === 'ing' && !st.item) {
          const def = ITEMS[held.id];
          // a toaster only takes bread slices / toast, a stove everything else
          const ok = wantsBake ? !!def.bakeTo
            : ((!!def.cookTo || (!!def.burnTo && !def.bakeTo)) && (def.cooker || null) === (st.cooker || null));
          if (ok) { st.startCooking(held); this.chef.setCarried(null); }
          else {
            this.reject(st);
            // a pizza still missing sauce / cheese → show where they are
            if (wantsBake && (def.compose === 'pizza' || held.id === 'dough_base')) {
              const have = def.toppings || [];
              const need = [];
              if (!have.includes('sauce')) need.push('ketchup');
              if (!have.includes('cheese')) need.push('cheese_chopped');
              if (need.length) this.missing(st, need.map((id) => itemIcon(id)), ...need);
            } else if (st.cooker === 'toaster' && def.chopTo) {
              // a whole loaf at the toaster: slice it on a board first
              this.missing(st, [itemIcon('bread_slice')], { board: def.tool || 'knife' });
            }
          }
          break;
        }
        const ready = st.item && st.state === 'ready';
        const burnt = st.item && st.state === 'burnt';
        // 2) take a baked pizza — too hot for bare hands, needs an empty plate
        if (wantsBake && (ready || burnt)) {
          if (held && held.type === 'plate' && !held.dirty && held.contents.length === 0) {
            this.takeHotOntoPlate(st, held);
          } else { this.reject(st); this.missing(st, [modelIcon('plate')], 'plate'); }
          break;
        }
        // 3) take a cooked patty — a plate, or a bun (→ bun+patty). NOT bare hands.
        //    (Toast is fine in bare hands → case 4. A held filling goes straight
        //    onto the toast in the toaster.)
        const bareOk = ready && !held && ITEMS[st.item.id].bareHand;
        if (st.type === 'stove' && ready && !bareOk) {
          const ontoBurger = held && held.type === 'ing' &&
            (combine(held.id, st.item.id) || (st.cooker === 'toaster' && combine(st.item.id, held.id)));
          if (held && held.type === 'plate' && !held.dirty && canPlate(held.contents, st.item.id)) {
            this.takeHotOntoPlate(st, held);
          } else if (ontoBurger) {
            // slide the patty straight onto a held bun / partial burger
            const it = st.clearCooking();
            const carry = makeIngredient(ontoBurger);
            if (it.steam > 0) carry.steam = it.steam;
            this.chef.setCarried(carry, buildItemMesh(carry));
            this.updateSizzle();
            audio.putdown();
          } else if (st.cooker === 'toaster') this.reject(st);
          else { this.reject(st); this.missing(st, [modelIcon('plate'), itemIcon('bun')], 'plate', 'bun'); }
          break;
        }
        // 4) bare-hand take what's left: a burnt patty (→ trash) or a mid-cook item
        if (!held && st.item) {
          const wasBurnt = st.state === 'burnt';
          const it = st.clearCooking();
          this.chef.setCarried(it, buildItemMesh(it));
          if (wasBurnt) this.stopSmoke(st);
          this.updateSizzle();
          break;
        }
        this.reject(st);
        break;
      }
      case 'sink': {
        this.spacePress(true);       // E also opens the wash question
        break;
      }
      case 'counter': {
        this.counterInteract(st, held);
        break;
      }
    }
    this.refreshHint(true);
  }

  counterInteract(st, held) {
    // the scoop stand: the ice-cream scoop's home — nothing else goes here
    if (st.stand) {
      if (!held && st.item) {
        const it = st.takeItem();
        this.chef.setCarried(it, buildItemMesh(it));
      } else if (held && !st.item && held.type === 'ing' && ITEMS[held.id].scoopTool) {
        st.setItem(held);
        this.chef.setCarried(null);
      } else this.reject(st);
      return;
    }
    if (!held && st.item) {
      const it = st.takeOne();
      this.chef.setCarried(it, buildItemMesh(it));
      return;
    }
    if (held && !st.item) {
      st.setItem(held);
      this.chef.setCarried(null);
      return;
    }
    if (held && st.item) {
      // the ice-cream scoop and a bowl (either one may be the one lying here)
      const scoop = this.isScoop(held) ? held : this.isScoop(st.item) ? st.item : null;
      const bowl = held.type === 'plate' ? held : (st.item.type === 'plate' ? st.item : null);
      if (scoop && bowl) { this.scoopIntoBowl(st, scoop, bowl); return; }
      // plate on counter + plateable in hand
      if (st.item.type === 'plate' && !st.item.dirty && held.type === 'ing' &&
          ITEMS[held.id].plateable && canPlate(st.item.contents, held.id)) {
        this.plateAdd(st.item, held.id);
        if (held.steam > 0) st.item.steam = Math.max(st.item.steam || 0, held.steam);
        st.setItem(st.item);
        this.chef.setCarried(null);
        if (st.item.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); }
        return;
      }
      // plate in hand + plateable on counter
      if (held.type === 'plate' && !held.dirty && st.item.type === 'ing' &&
          ITEMS[st.item.id].plateable && canPlate(held.contents, st.item.id)) {
        const ing = st.takeItem();
        this.plateAdd(held, ing.id);
        if (ing.steam > 0) held.steam = Math.max(held.steam || 0, ing.steam);
        this.chef.setCarried(held, buildItemMesh(held));
        if (held.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); }
        return;
      }
      // pizza assembly: base on counter + addition in hand
      if (st.item.type === 'ing' && held.type === 'ing') {
        let result = combine(st.item.id, held.id);
        if (result) {
          st.setItem(makeIngredient(result));
          // reusable tools (ketchup bottle) stay in hand after use
          if (!ITEMS[held.id].reusable) this.chef.setCarried(null);
          this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
          return;
        }
        result = combine(held.id, st.item.id);
        if (result) {
          const r = makeIngredient(result);
          if (!ITEMS[st.item.id].reusable) st.takeItem();
          this.chef.setCarried(r, buildItemMesh(r));
          this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
          return;
        }
      }
    }
    this.reject(st);
  }

  isScoop(item) { return !!(item && item.type === 'ing' && ITEMS[item.id].scoopTool); }

  /** E at an ice-cream tub. Only the ONE scoop takes ice cream out: the empty
   *  scoop comes back loaded (same tool, a ball in it). A loaded scoop can put
   *  its ball back into its own tub. Empty hands / a bowl / anything else: the
   *  bubble shows the scoop and the pointer marks where it is. */
  scoopAtTub(st, held) {
    const ball = st.crateItem;
    if (this.isScoop(held) && !ITEMS[held.id].holds) {
      const full = makeIngredient(ITEMS[ball].loaded);
      this.chef.setCarried(full, buildItemMesh(full));
      this.fx.sparkle(st.pos.clone().setY(1.4));
    } else if (this.isScoop(held) && ITEMS[held.id].holds === ball) {
      const empty = makeIngredient(ITEMS[held.id].emptyTo);
      this.chef.setCarried(empty, buildItemMesh(empty));
      audio.putdown();
      this.fx.pop(st.pos.clone().setY(1.5), '↩', 'var(--muted)');
    } else if (this.isScoop(held)) {
      this.reject(st);                 // the scoop is full of another flavour
    } else {
      this.reject(st);
      this.missing(st, [itemIcon('scoop')], 'scoop');
    }
  }

  /** The scoop meets a bowl on a counter (the scoop in hand and the bowl on
   *  the counter, or the bowl in hand and the scoop lying there). A loaded
   *  scoop drops its ball into the bowl and is EMPTY again — the tool itself
   *  never goes into the bowl. An empty scoop: the bubble shows the ice cream
   *  and the pointer marks the tubs. */
  scoopIntoBowl(st, scoop, bowl) {
    const ball = ITEMS[scoop.id].holds;
    if (!ball) {
      this.reject(st);
      const tubs = this.world.stations.filter((s) => s.type === 'crate' && ITEMS[s.crateItem].needsTool).map((s) => s.crateItem);
      if (tubs.length) this.missing(st, tubs.map((id) => itemIcon(id)), ...tubs);
      return;
    }
    if (bowl.dirty || !canPlate(bowl.contents, ball)) { this.reject(st); return; }
    this.plateAdd(bowl, ball);
    const empty = makeIngredient(ITEMS[scoop.id].emptyTo);
    if (scoop === st.item) {             // bowl in hand, the loaded scoop lay on the counter
      st.setItem(empty, false);
      this.chef.setCarried(bowl, buildItemMesh(bowl));
    } else {                             // scoop in hand, the bowl stands on the counter
      st.setItem(bowl);
      this.chef.setCarried(empty, buildItemMesh(empty));
    }
    this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
    audio[bowl.dish ? 'ding' : 'putdown']();
  }

  reject(st) {
    audio.reject();
    if (st && st.itemMesh) {
      st.itemMesh.userData.drop = 0.12;   // little hop = "nope"
    }
  }

  /** Something is missing: the station's speech bubble shows WHAT (icons, may
   *  be null), and the mistake pointer lights up WHERE it is (see sourcesOf). */
  missing(st, icons, ...whats) {
    if (icons) this.fx.bubble(st.pos.clone().setY(st.topY + 1.15), icons);
    const p = this.chef.pos;
    const sts = [...new Set(whats.flatMap((w) => this.sourcesOf(w)))]
      .sort((a, b) => a.pos.distanceToSquared(p) - b.pos.distanceToSquared(p));
    this.pointer.show(sts);
  }

  /** The serving vessel's icon model (bowls on the soup level). */
  vesselIcon(dirty = false) {
    const v = this.level.vessel === 'bowl' ? 'bowl' : 'plate';
    return dirty ? v + '_dirty' : v;
  }

  /** Where the player can get `what` right now. 'plate' = clean plates (rack
   *  or an empty one set down somewhere; none left → the sink, wash one);
   *  'sink' = the sink; 'scoop' = wherever the ice-cream scoop lies;
   *  { board: tool } = the boards with that tool; anything
   *  else is an item id: its crate + every board/counter it lies on. */
  sourcesOf(what) {
    const S = this.world.stations;
    if (what === 'sink') return [this.sinkStation];
    if (what === 'plate') {
      const out = [];
      if (this.rackStation.plates > 0) out.push(this.rackStation);
      for (const s of S) {
        if (s.item && s.item.type === 'plate' && !s.item.dirty && s.item.contents.length === 0) out.push(s);
      }
      if (!out.length) out.push(this.sinkStation.dirtyPlates > 0 ? this.sinkStation : this.rackStation);
      return out;
    }
    if (what === 'scoop') return S.filter((s) => this.isScoop(s.item));
    if (what && what.board) return S.filter((s) => s.type === 'board' && (s.tool || 'knife') === what.board);
    return S.filter((s) => (s.type === 'crate' && s.crateItem === what) ||
      (s.item && s.item.type === 'ing' && s.item.id === what) ||
      (what === 'cheese_chopped' && s.type === 'crate' && s.crateItem === 'cheese'));
  }

  /** Add a plateable ingredient to a plate, unpacking combos (burgerwip → bun + fillings). */
  plateAdd(plate, ingId) {
    const parts = ITEMS[ingId].expandsTo || [ingId];
    for (const p of parts) plate.contents.push(p);
    plate.dish = matchDish(plate.contents);
  }

  /** Slide hot food (baked pizza / cooked patty) from stove/oven onto a plate. */
  takeHotOntoPlate(st, plate) {
    const wasBurnt = st.state === 'burnt';
    const it = st.clearCooking();
    plate.contents.push(it.id);
    plate.dish = matchDish(plate.contents);
    if (it.steam > 0) plate.steam = Math.max(plate.steam || 0, it.steam);
    this.chef.setCarried(plate, buildItemMesh(plate));
    if (wasBurnt) this.stopSmoke(st);
    this.updateSizzle();
    if (plate.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); }
  }

  /** Stove-pot interaction (soup): add a chopped veg, or scoop the boiled soup
   *  into a bowl. The pot is a permanent stove fixture — it can't be picked up;
   *  it empties (→ pot_empty) when scooped and is reused in place. */
  potStoveInteract(st, held) {
    const def = ITEMS[st.item.id];
    // cooked soup ready in the pot → scoop into an empty clean bowl
    if (def.scoop) {
      if (held && held.type === 'plate' && !held.dirty && held.contents.length === 0) {
        this.plateAdd(held, def.scoop);          // the bowl now holds the finished soup
        held.steam = 14;
        this.chef.setCarried(held, buildItemMesh(held));
        st.clearCooking();
        st.setItem(makeIngredient('pot_empty'), false);   // pot stays, empty, reusable
        this.updateSizzle();
        if (held.dish) { audio.ding(); this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5)); }
      } else { this.reject(st); this.missing(st, [modelIcon('bowl')], 'plate'); }
      return;
    }
    // still cooking — hands off
    if (st.state === 'cooking') { this.reject(st); return; }
    // tip a chopped veg into the pot (combine); a complete recipe auto-boils
    if (held && held.type === 'ing') {
      const result = combine(st.item.id, held.id);
      if (result) {
        st.setItem(makeIngredient(result), true);
        this.chef.setCarried(null);
        this.fx.sparkle(st.pos.clone().setY(st.topY + 0.5));
        audio.putdown();
        if (ITEMS[result].cookTo) { st.state = 'cooking'; st.cookT = 0; st.burnT = 0; audio.sizzle(true); }
        return;
      }
    }
    this.reject(st);
  }

  // ---------- Space: work station ----------
  spacePress(fromE = false) {
    if (this.questionOpen) return;
    const st = this.targetStation();
    if (st && st.type === 'sink') {
      if (st.dirtyPlates > 0) this.quiz.openQuestion();
      else { this.reject(null); this.fx.pop(st.pos.clone().setY(1.8), t('popNoDirty'), 'var(--teal)'); }
    }
  }

  workStations(dt) {
    this.chef.working = false;
    this.chopBoard = null;             // board whose resting tool is "in hand" this frame
    if (!this.keys[' '] || this.questionOpen) return;
    const st = this.targetStation();
    if (st && st.type === 'board' && st.item && st.item.type === 'ing') {
      const def = ITEMS[st.item.id];
      if (def.chopTo) {
        this.chef.working = true;
        this.chef.workTool = st.tool || 'knife';
        this.chopBoard = st;           // hide this board's resting tool while chopping

        const before = st.progress;
        st.progress += dt / (def.chopTime || CHOP_TIME);
        if (Math.floor(before * 5) !== Math.floor(st.progress * 5)) audio.chop();
        // two-stage chains share ONE continuous bar: swap to the interim
        // model at 50% without resetting progress, finish at 100%
        if (ITEMS[def.chopTo]?.interim) {
          if (st.progress >= 0.5) st.setItem(makeIngredient(def.chopTo), true, true);
        } else if (st.progress >= 1) {
          st.setItem(makeIngredient(def.chopTo, def.yield || 1));   // a cut loaf → 3 slices
          this.fx.sparkle(st.pos.clone().setY(st.topY + 0.4));
        }
      }
    }
  }

  // Two chefs can't slide through each other: push the player + helper apart
  // when their bodies overlap (axis-separated so neither shoves into a wall).
  resolveChefCollision() {
    const a = this.chef, b = this.helper.chef;
    const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
    let d = Math.hypot(dx, dz);
    const MIN = 0.92;                       // min centre distance (~2× body radius)
    if (d >= MIN) return;
    let ux, uz;
    if (d < 1e-4) { ux = 1; uz = 0; }       // exactly stacked → split along x
    else { ux = dx / d; uz = dz / d; }
    const push = (MIN - d) / 2 + 0.002;
    a.tryMove(ux * push, 0); a.tryMove(0, uz * push);
    b.tryMove(-ux * push, 0); b.tryMove(0, -uz * push);
  }

  // ---------- serving / scoring ----------
  serveSuccess(plate, res, hatch) {
    const d = DISHES[plate.dish];
    this.combo++;
    const bonus = Math.min(Math.max(this.combo - 1, 0), 3) * 5;
    const orderBonus = res.inOrder ? 5 : 0;     // served the oldest ticket first
    const tip = Math.round((res.tipFrac || 0) * 8);   // patience tip: fast serve = happy customer
    const gained = d.coins + bonus + orderBonus + tip;
    this.score += gained;
    this.chef.setCarried(null);
    audio.serve();
    ui.setCoins(this.score);
    ui.setCombo(this.combo);
    ui.setOrders(res.served, res.total);
    this.fx.coins(hatch.pos.clone().setY(1.8));
    this.fx.pop(hatch.pos.clone().setY(1.8), `+${gained} 🪙${bonus ? ' 🔥' : ''}${orderBonus ? ' 📋' : ''}${tip >= 6 ? ' 😊' : ''}`);
    if (this.orders.allServed()) {
      this.fx.pop(hatch.pos.clone().setY(2.3), t('popAllServed'), 'var(--teal)');
      setTimeout(() => { if (!this.roundOver) this.endRound(); }, 900);
    } else {
      // plate comes back dirty in a few seconds
      this.plateReturns.push(PLATE_RETURN_DELAY + Math.random() * 2);
    }
  }

  // ---------- sink callbacks ----------
  onQuestionOpen() {
    this.questionOpen = true;
    this.chef.frozen = true;
    audio.duck(true);
  }
  onQuestionClose() {
    this.questionOpen = false;
    this.chef.frozen = false;
    audio.duck(false);
  }
  /** One correct answer = 1/2 of a wash: the verb's 2nd form, then its 3rd.
   *  Progress is kept if the player leaves the sink mid-wash. */
  onWashCorrect() {
    this.washProgress++;
    if (this.washProgress >= ANSWERS_PER_PLATE) {
      this.washProgress = 0;
      this.washesCompleted++;
      this.sinkStation.dirtyPlates--;
      this.sinkStation.refreshStack();
      this.rackStation.plates++;
      this.rackStation.refreshStack();
      ui.setPlates(this.rackStation.plates);
      ui.setWashProgress(0, ANSWERS_PER_PLATE);
      audio.washComplete();                 // triumphant fanfare
      ui.confetti();                        // confetti burst over the quiz card
      this.fx.sparkle(this.rackStation.pos.clone().setY(this.rackStation.topY + 0.5));
      return { plateDone: true, noMoreDirty: this.sinkStation.dirtyPlates <= 0 };
    }
    ui.setWashProgress(this.washProgress, ANSWERS_PER_PLATE);
    return { plateDone: false };
  }
  /** A wrong answer: the plate stays dirty and its pair starts over (a new verb). */
  onWashWrong() {
    this.washProgress = 0;
    ui.setWashProgress(0, ANSWERS_PER_PLATE);
  }
  onPlateMissed(q) {
    // persist right away (onRoundEnd is the save hook) — quitting mid-round
    // must not lose the practice list
    if (!this.save.missed.includes(q.verb)) { this.save.missed.push(q.verb); this.onRoundEnd(this); }
  }
  /** A start-of-round practice ask answered right = recalled across rounds →
   *  the verb leaves the persisted list (it comes back if missed again). */
  onPracticeMastered(verb) {
    const i = this.save.missed.indexOf(verb);
    if (i >= 0) { this.save.missed.splice(i, 1); this.onRoundEnd(this); }
  }

  // ---------- smoke / alarm ----------
  startSmoke(st) {
    this.fx.smokeSources.add(st);
    audio.alarm(true);
  }
  stopSmoke(st) {
    this.fx.smokeSources.delete(st);
    if (this.fx.smokeSources.size === 0) audio.alarm(false);
  }
  updateSizzle() {
    const any = this.world.stations.some((s) => s.type === 'stove' && !s.cooker && (s.state === 'cooking' || s.state === 'ready'));
    audio.sizzle(any);
  }

  // hot food (fresh patty / baked pizza) breathes steam wherever it sits
  updateSteam(dt) {
    this.steamT = (this.steamT || 0) - dt;
    const emit = this.steamT <= 0;
    if (emit) this.steamT = 0.45;
    const tick = (item, pos) => {
      if (!item || !(item.steam > 0)) return;
      item.steam -= dt;
      if (emit) this.fx.steam(pos);
    };
    for (const st of this.world.stations) {
      tick(st.item, st.pos.clone().setY(st.topY + 0.35));
    }
    tick(this.chef.carried, this.chef.pos.clone().setY(1.7));
  }

  // ---------- hint bar ----------
  refreshHint(force = false) {
    const st = this.targetStation();
    const held = this.chef.carried;
    let text = '', icon = null, iconId = '';   // iconId: which item the pill's picture shows
    const bowlLevel = this.level.vessel === 'bowl';
    if (st) {
      if (st.type === 'crate' && ITEMS[st.crateItem].needsTool) {
        // an ice-cream tub: needs the scoop
        if (!this.isScoop(held)) { text = t('hintNeedScoop', '@'); iconId = 'scoop'; }
        else if (!ITEMS[held.id].holds) { text = t('hintScoopIce', '@'); iconId = st.crateItem; }
        else text = ITEMS[held.id].holds === st.crateItem ? t('hintScoopBack') : t('hintScoopFull');
      }
      else if (st.type === 'crate') {
        if (!held) { text = t('hintGrab', '@'); iconId = st.crateItem; }
        else if (held.type === 'plate' && !held.dirty && ITEMS[st.crateItem].ontoPlate && canPlate(held.contents, st.crateItem)) text = t(bowlLevel ? 'hintIntoBowl' : 'hintAddPlate');
      }
      else if (st.type === 'board') {
        const heldPlate = held && held.type === 'plate' && !held.dirty;
        if (held && held.type === 'ing' && st.item && st.item.type === 'ing' && combine(held.id, st.item.id)) text = ITEMS[held.id].compose === 'pot' || held.id === 'pot_empty' ? t('hintAddPot') : t('hintAddMix');
        else if (held && held.type === 'ing' && st.item && st.item.type === 'ing' && !(st.item.n > 1) && combine(st.item.id, held.id)) text = t('hintAddMix');
        else if (st.item && ITEMS[st.item.id]?.interim) text = t('hintHalfway');
        else if (st.item && ITEMS[st.item.id]?.chopTo) text = ITEMS[st.item.id].chopVerb ? t('hintRoll') : t('hintChop');
        else if (st.item && heldPlate && ITEMS[st.item.id]?.plateable && canPlate(held.contents, st.item.id)) text = t('hintAddPlate');
        else if (st.item && !held) text = t('hintTakeIt');
        else if (held && held.type === 'ing' && ITEMS[held.id].chopTo) {
          const need = ITEMS[held.id].tool || 'knife';
          if (need === (st.tool || 'knife')) text = t('hintPutBoard');
          else text = need === 'rollingpin' ? t('hintNeedsPin') : t('hintNeedsBoard');
        }
        else if (held && held.type === 'ing') text = t('hintSetDown');
      }
      else if (st.type === 'stove' || st.type === 'oven') {
        const emptyPlate = held && held.type === 'plate' && !held.dirty && held.contents.length === 0;
        const heldDef = held && held.type === 'ing' ? ITEMS[held.id] : null;
        const potOnStove = st.type === 'stove' && st.item && st.item.type === 'ing' && isPotItem(st.item.id);
        if (potOnStove) {
          const pdef = ITEMS[st.item.id];
          if (pdef.scoop) text = st.state === 'cooking' ? t('hintBoiling') : emptyPlate ? t('hintScoopSoup') : t('hintSoupReady');
          else if (st.state === 'cooking') text = t('hintBoiling');
          else if (held && held.type === 'ing' && combine(st.item.id, held.id)) text = t('hintAddPot');
          else text = potRecipeHint(pdef.veg || []);
        }
        else if (st.cooker === 'toaster') {
          const plate = held && held.type === 'plate' && !held.dirty;
          if (st.state === 'cooking') text = t('hintToasting');
          else if (st.state === 'ready') {
            text = !held ? t('hintTakeToast')
              : plate && canPlate(held.contents, st.item.id) ? t('hintAddPlate')
              : heldDef && combine(st.item.id, held.id) ? t('hintAddMix') : t('hintToastReady');
          }
          else if (st.state === 'burnt') text = held ? t('hintFreeHand') : t('hintBinToast');
          else if (heldDef && heldDef.cooker === 'toaster') text = t('hintToastIt');
          else if (held && (held.id === 'bread' || held.id === 'bread_half')) text = t('hintSliceFirst');
          else text = t('hintToaster');
        }
        else if (st.state === 'ready') {
          if (st.type === 'oven') text = emptyPlate ? t('hintPlatePizza') : t('hintTooHotPlate');
          else {
            const onBun = held && held.type === 'ing' && st.item && combine(held.id, st.item.id);
            text = emptyPlate ? t('hintPlatePatty') : onBun ? t('hintPattyBun') : t('hintTooHotPlateBun');
          }
        } else if (st.state === 'burnt') {
          if (st.type === 'oven') text = emptyPlate ? t('hintPlateTrash') : t('hintTooHotPlate');
          else text = held ? t('hintFreeHand') : t('hintBinBurnt');
        }
        else if (st.state === 'cooking') text = t('hintCooking');
        // a pizza still missing a must-have topping can't go in the oven yet
        else if (heldDef && st.type === 'oven' && !heldDef.bakeTo &&
                 (heldDef.compose === 'pizza' || held.id === 'dough_base')) {
          const have = heldDef.toppings || [];
          const need = [];
          if (!have.includes('sauce')) need.push('🥫');
          if (!have.includes('cheese')) need.push('🧀');
          text = t('hintAddFirst', need.join(' + '));
        }
        else if (held) text = t('hintStartCooking');
      }
      else if (st.type === 'sink') text = st.dirtyPlates > 0 ? t('hintWashPlate') : t('hintNoDirty');
      else if (st.type === 'rack') text = this.isScoop(held) ? t('hintBowlFirst') : held ? '' : t('hintTakePlate');
      else if (st.type === 'hatch') text = (held && held.type === 'plate' && held.dish) ? t('hintServe') : t('hintHatch');
      else if (st.type === 'trash') text = held ? t('hintThrowAway') : '';
      else if (st.type === 'counter' && st.stand) {
        if (!held && st.item) text = t('hintTakeScoop');
        else if (this.isScoop(held) && !st.item) text = t('hintParkScoop');
        else if (!st.item) text = t('hintScoopHome');
      }
      else if (st.type === 'counter') {
        const scoop = this.isScoop(held) ? held : this.isScoop(st.item) ? st.item : null;
        const bowl = held && held.type === 'plate' ? held : (st.item && st.item.type === 'plate' ? st.item : null);
        if (held && st.item && scoop && bowl) {
          const ball = ITEMS[scoop.id].holds;
          text = !ball ? t('hintScoopEmpty') : canPlate(bowl.contents, ball) ? t('hintIntoBowl') : t('hintAlreadyIn');
        }
        else if (held && st.item) text = t('hintCombine');
        else if (held) text = t('hintPutDown');
        else if (st.item) text = t('hintPickUp');
      }
    }
    if (iconId) icon = itemIcon(iconId);
    const key = text + '|' + iconId;
    if (key !== this.lastHint || force) {
      ui.hint(text, icon);
      this.lastHint = key;
    }
  }

  // ---------- main loop ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    if (!this.running || !this.scene) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.fpsAvg = this.fpsAvg * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05;
    if (!this.qaFrozen) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  renderOnce() {
    if (this.scene && this.camera) this.renderer.render(this.scene, this.camera);
  }

  update(dt) {
    if (this.roundOver) {
      this.chef.update(dt, { x: 0, z: 0 }, this.fx);
      if (this.helper) this.helper.chef.update(dt, { x: 0, z: 0 }, this.fx);
      this.fx.update(dt); return;
    }

    // count-UP clock — keeps running during sink questions, so quick verb
    // recall (and not dawdling at the sink) earns a better time
    this.elapsed += dt;
    ui.setTime(this.elapsed);

    this.chef.update(dt, this.questionOpen ? { x: 0, z: 0 } : this.inputVector(), this.fx);
    this.workStations(dt);
    if (this.helper) { this.helper.update(dt); this.resolveChefCollision(); }

    // stations (cooking pauses during questions)
    for (const st of this.world.stations) {
      for (const ev of st.update(dt, this.questionOpen)) {
        if (ev === 'ready') {
          audio.ding();
          this.fx.pop(st.pos.clone().setY(st.topY + 1), t('popReady'), 'var(--teal)');
          if (ITEMS[st.item.id]?.steamy) st.item.steam = 14;   // hot & ready
        }
        if (ev === 'burnt') { this.startSmoke(st); this.fx.pop(st.pos.clone().setY(st.topY + 1), t('popBurnt'), 'var(--coral)'); }
      }
      // the resting board tool vanishes while it's being used (it's "in the
      // chef's hand") and returns the moment chopping stops — for the player AND
      // the co-op helper's board
      if (st.toolMesh) st.toolMesh.visible = (st !== this.chopBoard && !(this.helper && st === this.helper.chopBoard));
      // cutting-board progress ring
      if (st.type === 'board' && st.ring) {
        const choppable = st.item && st.item.type === 'ing' && ITEMS[st.item.id].chopTo;
        st.ring.visible = !!(choppable && st.progress > 0);
        if (st.ring.visible) drawRing(st.ring, st.progress, '#ffcf5e');
      }
    }
    this.updateSizzle();
    this.updateSteam(dt);

    // orders stream in from the fixed queue (nothing expires — deliver them
    // all). While a sink question is open, patience drains at only 30%:
    // thinking at the sink is safe-ish, but not free.
    this.orders.update(this.questionOpen ? dt * 0.3 : dt);

    // frantic layer: kicks in when the kitchen is objectively drowning — a
    // customer nearly out of patience, or a full ticket rail with smoke.
    // Never during the sink question (that's the catch-your-breath moment).
    const frantic = !this.questionOpen &&
      (this.orders.anyHurry() || (this.orders.tickets.length >= 3 && this.fx.smokeSources.size > 0));
    audio.frantic(frantic);
    ui.setFrantic(frantic);

    // dirty plates in transit back to the sink
    for (let i = this.plateReturns.length - 1; i >= 0; i--) {
      this.plateReturns[i] -= dt;
      if (this.plateReturns[i] <= 0) {
        this.plateReturns.splice(i, 1);
        this.sinkStation.dirtyPlates++;
        this.sinkStation.refreshStack();
        audio.clatter();   // the dirty plate clatters onto the sink pile
      }
    }

    // target-tile highlight (NB: don't name a local `t` in this function — it
    // would shadow the i18n t() used by the ready/burnt pops above)
    const tile = this.chef.targetTile();
    const st = this.world.stationAtTile(tile.col, tile.row);
    this.world.highlight.visible = !!st;
    if (st) this.world.highlight.position.set(st.pos.x, 1.12, st.pos.z);

    if (this.tutorial) this.tutorial.update(dt);
    this.pointer.update(dt);
    if (this.helperIntroT != null) {
      this.helperIntroT -= dt;
      if (this.helperIntroT <= 0) {
        this.helperIntroT = null;
        const hc = this.helper.chef;
        this.fx.say(() => hc.pos.clone().setY(2.7), t(this.level.coop.intro), 5.5);
      }
    }
    this.refreshHint();
    this.fx.update(dt);
  }

  endRound() {
    this.roundOver = true;
    this.pointer.clear();
    this.fx.hushSays();
    ui.setFrantic(false);
    audio.stopAll();
    audio.serve();
    if (this.quiz.open) this.quiz.close();
    this.orders.clear();
    ui.hud(false);

    const lv = this.level;
    const time = this.elapsed;
    const [, s2, s3, sA] = lv.starTimes;     // s1 (1★) is now just "finish" — always ≥1
    let stars = 1;                            // completing the level always earns ≥1 star
    if (time <= s2) stars = 2;
    if (time <= s3) stars = 3;
    if (time <= sA) stars = 4;                // author star (hardest)
    const prevStars = this.save.stars[lv.id] || 0;
    const prevBest = this.save.bestTime[lv.id];      // best = FASTEST time (lower is better)
    const isNewBest = prevBest == null || time < prevBest;
    this.save.stars[lv.id] = Math.max(prevStars, stars);
    if (isNewBest) this.save.bestTime[lv.id] = time;
    this.onRoundEnd(this);

    ui.renderPost(lv, time, this.score, stars, this.quiz.missedThisRound, this.save.bestTime[lv.id],
      this.levelIdx < LEVELS.length - 1, isNewBest);
  }

  stopRound() {
    this.running = false;
    if (this.fx) this.fx.hushSays();
    if (this.pointer) this.pointer.clear();
    ui.setFrantic(false);
    audio.stopAll();
    if (this.quiz && this.quiz.open) this.quiz.close();
    if (this.orders) this.orders.clear();
    ui.hud(false);
  }

  disposeScene() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
      }
    });
    this.scene = null;
  }
}
