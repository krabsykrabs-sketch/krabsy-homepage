// KayKit Adventurers character on a hardcoded waypoint routine — kinematic,
// no physics. Same rig + clip approach as verb-kitchen (Rig_Medium clips applied
// to an Adventurers character via SkeletonUtils.clone). Characters live in a
// room's "actors" group (room-local, unscaled) and walk furniture-derived points.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from './config.js';
import { buildRoomNav } from './nav.js';

const C = 'assets/characters/';
const CHAR_FILES = ['Rogue.glb', 'Knight.glb', 'Mage.glb', 'Ranger.glb'];
const ANIM_FILES = ['Rig_Medium_MovementBasic.glb', 'Rig_Medium_General.glb', 'Rig_Medium_Simulation.glb'];

const gltfLoader = new GLTFLoader();
const charScenes = [];           // resolved Adventurers character scenes
let clips = null;                // name → AnimationClip (shared, retarget by bone name)

function loadGLTF(url) {
  return new Promise((res, rej) => gltfLoader.load(url, res, undefined,
    (e) => rej(new Error('char load ' + url + ': ' + (e?.message || e)))));
}

export async function preloadCharacters() {
  if (clips) return;
  const [chars, anims] = await Promise.all([
    Promise.all(CHAR_FILES.map((f) => loadGLTF(C + f))),
    Promise.all(ANIM_FILES.map((f) => loadGLTF(C + f))),
  ]);
  chars.forEach((g) => charScenes.push(g.scene));
  clips = {};
  for (const g of anims) for (const c of g.animations) clips[c.name] = c;
}

// pick the first clip name that exists (clip sets vary)
function pick(...names) { for (const n of names) if (clips[n]) return clips[n]; return null; }

// ── waypoint derivation (runtime, not authored) ──────────────────────────
const SIT_MODELS = new Set([
  'couch_pillows', 'couch', 'chair_desk_B', 'chair_desk_A', 'chair_A', 'chair_B',
  'armchair', 'armchair_pillows', 'bed_single_A', 'bed_single_B', 'bed_double_A', 'bed_double_B',
]);
const STAND_MODELS = new Set([
  'desk_decorated', 'desk', 'table_low_decorated', 'cabinet_medium', 'cabinet_small',
  'lamp_standing', 'rug_rectangle_stripes_A',
]);

/**
 * Build a routine of waypoints + a nav grid for a room. Waypoints target FREE
 * approach cells (so residents path to them without crossing furniture); a sit
 * waypoint's final `pos` is on the seat (the resident steps onto it to sit, but
 * never traverses furniture to get there). Returns { waypoints, nav }.
 */
export function deriveWaypoints(room) {
  const level = room.level;
  const nav = buildRoomNav(level);
  const sq = CONFIG.DEPTH_SQUASH;
  const isDeskChair = (m) => m === 'chair_desk_B' || m === 'chair_desk_A';
  const cellPos = (cell) => { const p = nav.cellCenter(cell.c, cell.r); return new THREE.Vector3(p.x, 0, p.z * sq); };
  // sit on the piece's cell that is adjacent to the approach (one clean step on/off),
  // nudged a little deeper into the piece so the sit pose reads as "on it".
  const seatPos = (seatCell) => { const p = nav.cellCenter(seatCell.c, seatCell.r); return new THREE.Vector3(p.x, 0, (p.z - nav.tile * 0.12) * sq); };

  const pts = [];
  for (const o of level.objects) {
    const sit = SIT_MODELS.has(o.model);
    const stand = STAND_MODELS.has(o.model) && !/^rug/.test(o.model);
    if (!sit && !stand) continue;
    const approach = nav.approachCell(o);
    if (sit) {
      const desk = isDeskChair(o.model);
      const seatCell = nav.seatCellFor(o, approach);
      pts.push({ cell: approach, pos: seatPos(seatCell), action: 'sit', face: desk ? -1 : +1, lounge: !desk });
    } else {
      pts.push({ cell: approach, pos: cellPos(approach), action: 'idle', face: +1 });
    }
  }
  // a couple of wander points along the front walkway (spread left↔right)
  const fronts = nav.frontCells(6);
  if (fronts.length) {
    const byCol = [...fronts].sort((a, b) => a.c - b.c);
    const picks = [byCol[0], byCol[byCol.length - 1]].filter((v, i, a) => a.indexOf(v) === i);
    for (const cell of picks) pts.push({ cell, pos: cellPos(cell), action: 'idle', face: +1 });
  }
  if (!pts.length && fronts.length) pts.push({ cell: fronts[0], pos: cellPos(fronts[0]), action: 'idle', face: +1 });
  return { waypoints: pts, nav };
}

export class Character {
  constructor(index, waypoints, nav = null) {
    this.nav = nav;
    this.path = null;        // array of THREE.Vector3 sub-points to the current waypoint
    this.pathI = 0;
    this.obj = new THREE.Group();
    const scene = charScenes[index % charScenes.length];
    this.body = skeletonClone(scene);
    this.body.scale.setScalar(CONFIG.CHAR_SCALE);
    this.body.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.obj.add(this.body);

    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = {};
    const reg = (key, clip) => { if (clip) this.actions[key] = this.mixer.clipAction(clip); };
    reg('idle', pick('Idle_A', 'Idle_B'));
    reg('walk', pick('Walking_C', 'Walking_B', 'Walking_A', 'Running_A'));
    reg('sit', pick('Sit_Chair_Idle', 'Sit_Floor_Idle', 'Idle_B'));
    // one-shot gesture beats played while standing idle
    this.gestureNames = [];
    for (const g of [['interact', 'Interact'], ['pickup', 'PickUp'], ['useitem', 'Use_Item']]) {
      const clip = pick(g[1]);
      if (clip) { reg(g[0], clip); this.actions[g[0]].setLoop(THREE.LoopOnce, 1); this.actions[g[0]].clampWhenFinished = true; this.gestureNames.push(g[0]); }
    }
    this.current = null;

    this.waypoints = waypoints;
    this.wi = index % waypoints.length;
    this.state = 'perform';
    this.timer = 0.6 + (index % 4) * 0.5;        // stagger first move
    this.heading = 0;
    this.tmp = new THREE.Vector3();
    this.speed = CONFIG.CHAR_SPEED * (1 + (((index * 0.37) % 1) * 2 - 1) * CONFIG.SPEED_JITTER); // deterministic per-index jitter
    this.gestureT = 0;        // countdown to next idle gesture
    this.gesturing = 0;       // >0 while a gesture one-shot is playing
    this.play('idle');
  }

  play(name, fade = 0.18) {
    const next = this.actions[name] || this.actions.idle;
    if (!next || this.current === next) return;
    next.reset().fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  randomPerform() { return CONFIG.PERFORM_MIN + Math.random() * (CONFIG.PERFORM_MAX - CONFIG.PERFORM_MIN); }

  /** Cell-path to the current waypoint (then a final straight step to wp.pos).
   *  When leaving a seat, start the path from the remembered (free) approach cell
   *  so dismounting is a clean adjacent step, never a line across other furniture. */
  buildPath(wp) {
    const pts = [];
    this.bfsCells = [];
    if (this.nav) {
      const from = this.parkedApproach || this.nav.worldToCell(this.obj.position.x, this.obj.position.z);
      this.parkedApproach = null;
      const cells = this.nav.pathCells(from, wp.cell || from);
      this.bfsCells = cells;
      for (const cell of cells) { const p = this.nav.cellCenter(cell.c, cell.r); pts.push(new THREE.Vector3(p.x, 0, p.z * CONFIG.DEPTH_SQUASH)); }
    }
    pts.push(wp.pos.clone());          // exact final spot (seat / stand point)
    this.path = pts; this.pathI = 0;
  }

  arrive(wp) {
    this.state = 'perform';
    this.timer = this.randomPerform();
    this.obj.position.x = wp.pos.x; this.obj.position.z = wp.pos.z;
    this.path = null;
    this.parkedApproach = (wp.action === 'sit') ? wp.cell : null;   // leave a seat via its free approach cell
    if (wp.action === 'sit') {
      this.obj.position.y = wp.lounge ? CONFIG.LOUNGE_SIT_LIFT : 0;
      this.play('sit');
    } else {
      this.obj.position.y = 0;
      this.play('idle');
      this.gestureT = CONFIG.GESTURE_FIRST_MIN + (((this.wi * 0.61) % 1) * (CONFIG.GESTURE_GAP_MAX - CONFIG.GESTURE_GAP_MIN));
      this.gesturing = 0;
    }
    if (wp.face) this.faceTo(0, wp.face);
  }

  update(dt) {
    this.mixer.update(dt);
    const wp = this.waypoints[this.wi];
    if (!wp) return;

    if (this.state === 'walk') {
      if (!this.path) this.buildPath(wp);
      const target = this.path[this.pathI];
      this.tmp.copy(target).sub(this.obj.position); this.tmp.y = 0;
      const dist = this.tmp.length();
      if (dist <= CONFIG.ARRIVE_EPS) {
        this.pathI++;
        if (this.pathI >= this.path.length) { this.arrive(wp); return; }
      } else {
        const step = Math.min(dist, this.speed * dt);
        this.tmp.normalize();
        this.obj.position.addScaledVector(this.tmp, step);
        this.faceTo(this.tmp.x, this.tmp.z, dt);
        this.play('walk');
      }
    } else { // perform
      this.timer -= dt;
      if (wp.action !== 'sit') this.tickGesture(dt);
      if (this.timer <= 0) {
        this.wi = (this.wi + 1) % this.waypoints.length;
        this.state = 'walk';
        this.obj.position.y = 0;
        this.gesturing = 0;
        this.path = null;
        this.play('walk');
      }
    }
  }

  /** Occasional one-shot gesture (Interact/PickUp/Use_Item) while standing idle. */
  tickGesture(dt) {
    if (!CONFIG.GESTURE_ENABLED || !this.gestureNames.length) return;
    if (this.gesturing > 0) {
      this.gesturing -= dt;
      if (this.gesturing <= 0) {
        this.play('idle');
        this.gestureT = CONFIG.GESTURE_GAP_MIN + (((this.wi * 0.29 + this.timer) % 1) * (CONFIG.GESTURE_GAP_MAX - CONFIG.GESTURE_GAP_MIN));
      }
      return;
    }
    this.gestureT -= dt;
    if (this.gestureT <= 0 && this.timer > 1.2) {   // don't start a gesture if about to leave
      const name = this.gestureNames[(this.gestureCount = (this.gestureCount | 0) + 1) % this.gestureNames.length];
      const act = this.actions[name];
      this.gesturing = act.getClip().duration;
      this.play(name, 0.14);
    }
  }

  faceTo(dx, dz, dt) {
    const target = Math.atan2(dx, dz);
    let d = target - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const k = dt ? Math.min(1, CONFIG.CHAR_TURN_LERP * dt) : 1;
    this.heading += d * k;
    this.obj.rotation.y = this.heading;
  }
}
