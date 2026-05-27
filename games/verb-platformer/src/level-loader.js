import * as THREE from 'three';
import { loadModel } from './assets.js';
import { addStaticBox, addKinematicBox, addStaticTrimesh } from './physics.js';
import { spawnGate, LANE_OFFSETS } from './gates.js';
import { spawnStyledGate } from './qa-styles.js';
import { buildQuestionQueue, getQuestion, formatPrompt } from './data/questions.js';
import { CATALOG_BY_TYPE, urlFor, defaultColorFor } from './kaykit-catalog.js';

// Legacy size→KayKit mapping. The four .js levels in src/levels/ use 'small'/'medium'/'large'
// shorthand for their platforms — we resolve those names to KayKit 2x2x1/4x4x1/6x6x1 (blue,
// the editor's "safe" default). Height = 1 unit (KayKit anchors at the bottom of the mesh, so
// the renderer offsets the mesh down by `height` to put the walkable top at the requested y).
const PLATFORM_DEFS = {
  small:  { url: urlFor('platform_2x2x1', 'blue'), half: { x: 1.0, y: 0.5, z: 1.0 }, height: 1.0 },
  medium: { url: urlFor('platform_4x4x1', 'blue'), half: { x: 2.0, y: 0.5, z: 2.0 }, height: 1.0 },
  large:  { url: urlFor('platform_6x6x1', 'blue'), half: { x: 3.0, y: 0.5, z: 3.0 }, height: 1.0 },
};

// Default flag for editor levels that omit an explicit `objects[]` flag entry but provide a
// top-level `data.flag.position`. KayKit's tall flag reads best as a level-goal landmark.
const DEFAULT_FLAG_TYPE  = 'flag_C';
const DEFAULT_FLAG_COLOR = 'blue';
const FLAG_REACH = 1.6;
// On respawn the player is dropped onto the approach platform's known walkable top. We mirror the
// level's start spawn, which places the feet 1 unit above the starter block's top (spawn y=2 over
// a top at y=1) and lands perfectly — every block is the same height, so the same 1-unit drop
// works on any approach platform.
const RESPAWN_LIFT = 1.0;
// Reusable Box3 / Vec3 / Quaternion for hazard AABB tests + kinematic body updates — avoids
// per-frame allocations in the hot loop.
const _box3 = new THREE.Box3();
const _tmpVec3 = new THREE.Vector3();
const _tmpVec3B = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpQuatB = new THREE.Quaternion();

// Question bubble: same translucent rounded shape as the answer bubbles (Style 3, picked as the
// winning presentation) but in a distinct colour. Sizes itself to its text so "write → ___"
// doesn't truncate while shorter prompts stay compact.
const Q_BUBBLE_H = 1.3;
const Q_BUBBLE_MIN_W = 2.5;
const Q_BUBBLE_Y = 4.5;
const Q_BUBBLE_TINT = 'rgba(255, 138, 70, 0.9)';   // coral — matches the Krabsy brand orange
const Q_BUBBLE_FONT_PX = 220;
const Q_BUBBLE_PAD_PX = 140;
function makeQuestionBubble(prompt) {
  const H = 512;
  const font = `bold ${Q_BUBBLE_FONT_PX}px Arial, sans-serif`;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textW = measure.measureText(prompt).width;
  const W = Math.max(900, Math.ceil(textW + 2 * Q_BUBBLE_PAD_PX));

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const r = 90;
  ctx.fillStyle = Q_BUBBLE_TINT;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(prompt, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const planeW = Math.max(Q_BUBBLE_MIN_W, Q_BUBBLE_H * (W / H));
  const geo = new THREE.PlaneGeometry(planeW, Q_BUBBLE_H);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, opacity: 0.95,
  });
  return new THREE.Mesh(geo, mat);
}

// Small flat floor label for the test bench — e.g. "STYLE 3" — on the approach platform.
function makeFloorTag(text) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1a2435';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.fillStyle = '#1a2435';
  ctx.font = 'bold 140px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const geo = new THREE.PlaneGeometry(1.0, 0.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;     // lie flat, text upright when read from +Z
  return mesh;
}

async function spawnPlatform(scene, world, RAPIER, p) {
  const def = PLATFORM_DEFS[p.size];
  if (!def) throw new Error(`unknown platform size: ${p.size}`);
  const mesh = await loadModel(def.url);
  const [x, y, z] = p.position;
  // Universal convention: data Y = the mesh's bottom anchor. The mesh sits AT y; the walkable
  // top is at y + def.height. Collider spans from y to y + 2*halfY, so its center is y+halfY.
  mesh.position.set(x, y, z);
  scene.add(mesh);
  const phys = addStaticBox(world, RAPIER, { x, y: y + def.half.y, z }, def.half);
  // Optional floor tag — sits just above the walkable top surface (y + height).
  let tagMesh = null;
  if (p.floorLabel) {
    tagMesh = makeFloorTag(p.floorLabel);
    tagMesh.position.set(x, y + def.height + 0.03, z - def.half.z * 0.3);
    tagMesh.renderOrder = 1;
    scene.add(tagMesh);
  }
  return { mesh, body: phys.body, position: p.position, size: p.size, half: def.half, height: def.height, tagMesh };
}

// Platform that oscillates sinusoidally along one axis. Its collider is a FIXED body that we
// teleport each step (NOT a kinematic body): Rapier's character controller applies special
// "moving ground" handling to a kinematic body the player stands on, which cancels the player's
// own steering input (computedMovement ≈ 0). A fixed collider reads as plain static ground, so
// steering works, and the player is carried by the manually-applied rider delta instead.
// `prePhysics` teleports the collider; `postPhysics` syncs the visual mesh to the same formula.
class MovingPlatform {
  constructor(mesh, body, basePos, def, motion) {
    this.mesh = mesh;
    this.body = body;
    this.basePos = basePos;     // layout-space {x, y, z} (platform top)
    this.def = def;             // PLATFORM_DEFS entry — for height/half offsets
    this.motion = motion;       // { axis: 'x'|'y'|'z', amplitude, period, phase }
  }

  _offset(elapsed) {
    const t = (elapsed + (this.motion.phase || 0)) / this.motion.period;
    return Math.sin(t * Math.PI * 2) * this.motion.amplitude;
  }

  _animatedPos(elapsed) {
    const p = { x: this.basePos.x, y: this.basePos.y, z: this.basePos.z };
    p[this.motion.axis] += this._offset(elapsed);
    return p;
  }

  prePhysics(elapsed) {
    // Convention: basePos.y is the mesh-bottom anchor; collider center is anchor + halfY.
    // Teleport the FIXED body (no kinematic velocity → controller treats it as static ground).
    const p = this._animatedPos(elapsed);
    this.body.setTranslation({ x: p.x, y: p.y + this.def.half.y, z: p.z }, true);
  }

  postPhysics(elapsed) {
    const p = this._animatedPos(elapsed);
    this.mesh.position.set(p.x, p.y, p.z);
  }
}

async function spawnMovingPlatform(scene, world, RAPIER, p) {
  const def = PLATFORM_DEFS[p.size];
  if (!def) throw new Error(`unknown moving platform size: ${p.size}`);
  const mesh = await loadModel(def.url);
  const [x, y, z] = p.position;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  // FIXED, not kinematic — see the MovingPlatform class comment (KCC cancels steering on
  // kinematic ground). We teleport it each step via setTranslation; the rider delta does the carry.
  const phys = addStaticBox(world, RAPIER, { x, y: y + def.half.y, z }, def.half);
  const motion = {
    axis:      p.axis      || 'x',
    amplitude: p.amplitude || 2,
    period:    p.period    || 3,
    phase:     p.phase     || 0,
  };
  return new MovingPlatform(mesh, phys.body, { x, y, z }, def, motion);
}

async function spawnFlag(scene, pos) {
  // Default legacy flag = tall blue KayKit flag, anchored at the pole base (mesh minY = 0).
  const mesh = await loadModel(urlFor(DEFAULT_FLAG_TYPE, DEFAULT_FLAG_COLOR));
  const [x, y, z] = pos;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return { mesh, pos: { x, y, z } };
}

function buildGateOptions(question) {
  const entries = [
    { text: question.correct,  correct: true  },
    { text: question.wrong[0], correct: false },
    { text: question.wrong[1], correct: false },
  ];
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }
  return LANE_OFFSETS.map((offset, i) => ({
    text: entries[i].text,
    correct: entries[i].correct,
    offset,
  }));
}

export async function loadLevel(scene, world, RAPIER, particles, sfx, data, callbacks = {}, uiHooks = {}) {
  // Editor-format levels (objects[] + spawn/flag at top level) take a separate code path.
  // The legacy layout[] format below is preserved for the original gate-bubble levels.
  if (Array.isArray(data.objects)) {
    return loadEditorLevel(scene, world, RAPIER, particles, sfx, data, callbacks, uiHooks);
  }
  const layout = data.layout;
  const gateEntries = layout.filter(e => e.type === 'gate');
  // Only build a shuffled question queue if any gate is missing an explicit verb.
  const needsQueue = gateEntries.some(g => !g.verb);
  const questionQueue = needsQueue
    ? buildQuestionQueue(data.verbs, gateEntries.length, data.repeatsAllowed || 1)
    : [];

  const platforms = [];
  const movingPlatforms = [];
  const gates = [];           // { gate, checkpointPos, question, layoutIndex, hudQuestion? }
  const extras = [];          // free scene objects to remove on dispose (banners, walls, etc.)
  let spawn = null;
  let flag = null;
  let qIdx = 0;

  const previousPlatform = (i) => {
    for (let j = i - 1; j >= 0; j--) if (layout[j].type === 'platform') return layout[j];
    return null;
  };
  const nextPlatform = (i) => {
    for (let j = i + 1; j < layout.length; j++) if (layout[j].type === 'platform') return layout[j];
    return null;
  };

  // Pass 1: spawn platforms, spawn, flag (no gates yet).
  for (let i = 0; i < layout.length; i++) {
    const e = layout[i];
    if (e.type === 'spawn') {
      spawn = e.position;
    } else if (e.type === 'platform') {
      const p = await spawnPlatform(scene, world, RAPIER, e);
      platforms.push(p);
    } else if (e.type === 'moving') {
      const mp = await spawnMovingPlatform(scene, world, RAPIER, e);
      movingPlatforms.push(mp);
    } else if (e.type === 'flag') {
      flag = await spawnFlag(scene, e.position);
    }
  }

  // Pass 2: gates.
  for (let i = 0; i < layout.length; i++) {
    const e = layout[i];
    if (e.type !== 'gate') continue;

    const question = e.verb ? getQuestion(e.verb) : questionQueue[qIdx];
    const options = buildGateOptions(question);

    const checkpoint = nextPlatform(i);
    const checkpointPos = checkpoint
      ? { x: checkpoint.position[0], y: checkpoint.position[1], z: checkpoint.position[2] }
      : null;
    const approachLayout = previousPlatform(i);
    // approachPos.y represents the WALKABLE TOP of the approach platform so banners/arches/etc.
    // spawned by qa-styles sit on top of it (rather than at its base under the new bottom-anchor
    // convention).
    const approachPos = approachLayout
      ? {
          x: approachLayout.position[0],
          y: approachLayout.position[1] + (PLATFORM_DEFS[approachLayout.size]?.height || 0),
          z: approachLayout.position[2],
        }
      : null;

    const myGateIndex = qIdx;
    const gateData = {
      position: e.position,
      options,
      question: { verb: question.verb, correct: question.correct },
    };
    const gateCallbacks = {
      onCleared: () => callbacks.onGateCleared?.(myGateIndex, checkpointPos),
      onWrong:   (g, opt) => callbacks.onGateWrong?.(myGateIndex, gateData.question, opt),
    };

    let gate, gateExtras = [], hudQuestion = null;
    if (e.style) {
      const styled = await spawnStyledGate(e.style, scene, world, RAPIER, particles, sfx, gateData, gateCallbacks, { approachPos });
      gate = styled.gate;
      gateExtras = styled.extras || [];
      hudQuestion = styled.hudQuestion || null;
    } else {
      gate = await spawnGate(scene, world, RAPIER, particles, sfx, gateData, gateCallbacks);
      const banner = makeQuestionBubble(formatPrompt(question.verb));
      const [gx, gy, gz] = e.position;
      banner.position.set(gx, gy + Q_BUBBLE_Y, gz);
      scene.add(banner);
      gateExtras = [banner];
    }

    gates.push({ gate, checkpointPos, approachPos, question, layoutIndex: i, hudQuestion });
    extras.push(...gateExtras);
    qIdx++;
  }

  return new LoadedLevel(scene, world, platforms, movingPlatforms, gates, flag, extras, spawn, uiHooks);
}

export class LoadedLevel {
  constructor(scene, world, platforms, movingPlatforms, gates, flag, extras, spawn, uiHooks) {
    this.scene = scene;
    this.world = world;
    this.platforms = platforms;
    this.movingPlatforms = movingPlatforms;
    this.gates = gates;
    this.flag = flag;
    this.extras = extras;
    this.spawn = spawn;
    this.uiHooks = uiHooks || {};
    this.clearedCount = 0;
    this._lastHudText = null;
    this.elapsed = 0;
  }

  get gateCount() { return this.gates.length; }

  markCleared(idx) {
    // Called by the parent (game.js onGateCleared) so we know what to display in the HUD.
    if (idx + 1 > this.clearedCount) this.clearedCount = idx + 1;
  }

  // Respawn point for the gate the player is currently attempting (0-based index == gatesCleared):
  // the top-centre of the approach platform just before that gate's three answer blocks. It's a
  // known, solid surface, so the player lands cleanly on top instead of inside a block, and is
  // placed before the gate — re-attempting (and re-answering) the question after each death.
  // Clamped to the last gate so a fall after clearing everything (heading to the flag) still
  // returns the player near the end rather than back at the level spawn.
  getRespawnPos(gatesCleared) {
    if (this.gates.length === 0) return null;
    const idx = Math.min(gatesCleared, this.gates.length - 1);
    const a = this.gates[idx]?.approachPos;
    if (!a) return null;
    return { x: a.x, y: a.y + RESPAWN_LIFT, z: a.z };
  }

  // Restore every gate's answer blocks to their original positions and idle state. Called on
  // respawn so the level resets — blocks that crumbled/fell while the player was attempting a
  // gate are back, and the gate is fully playable again.
  reset() {
    for (const g of this.gates) g.gate.reset?.();
  }

  // Called by game.js once per FIXED_DT step, BEFORE the player's controller pass. Only advances
  // the platform clock — it deliberately does NOT queue the moving platforms' next translation
  // (see stepMovingPlatforms for why).
  prePhysics(fixedDt) {
    this.elapsed += fixedDt;
  }

  // Called AFTER the player's computeColliderMovement but before world.step(): we teleport the
  // platforms here so that during the controller pass they're still at the pose the rider delta was
  // computed against (their previous-step position), keeping player and platform exactly in sync.
  // (The steering fix itself is the FIXED collider — see MovingPlatform — not this ordering.)
  stepMovingPlatforms() {
    for (const mp of this.movingPlatforms) mp.prePhysics(this.elapsed);
  }

  // Determines which moving platform (if any) the player is currently standing on, and returns
  // the platform's translation delta during the NEXT physics step ({dx, dy, dz}). Caller adds
  // this to the player's desired movement so the player rides along instead of sliding off.
  // Must be called BEFORE prePhysics() — uses this.elapsed as the "current" platform position.
  findRiderDelta(playerPos, playerGrounded, fixedDt) {
    if (!playerGrounded) return null;
    for (const mp of this.movingPlatforms) {
      const now  = mp._animatedPos(this.elapsed);
      const half = mp.def.half;
      // now.y is the mesh-bottom anchor; the player stands on the walkable top (anchor + height).
      // Comparing the player's feet against the *top* (not the anchor) is what lets a rider on a
      // horizontally sliding ferry — or a vertical bobber — be detected so the carry-delta below
      // is applied. Testing against now.y left ~1.0 of error and the rider was never matched, so
      // the player slid off.
      const topY = now.y + mp.def.height;
      if (Math.abs(playerPos.x - now.x) > half.x) continue;
      if (Math.abs(playerPos.z - now.z) > half.z) continue;
      if (Math.abs(playerPos.y - topY) > 0.4)     continue;
      const next = mp._animatedPos(this.elapsed + fixedDt);
      return { dx: next.x - now.x, dy: next.y - now.y, dz: next.z - now.z };
    }
    return null;
  }

  update(dt, playerPos, playerGrounded) {
    for (const mp of this.movingPlatforms) mp.postPhysics(this.elapsed);
    for (const g of this.gates) g.gate.update(dt, playerPos, playerGrounded);
    if (this.flag?.mesh) this.flag.mesh.rotation.y += dt * 1.2;

    // Drive the persistent HUD question (Style 5). Show the next un-cleared gate's hudQuestion,
    // if any; clear otherwise. Idempotent — only call setHudQuestion when the text actually changes.
    let wantHud = null;
    for (let i = this.clearedCount; i < this.gates.length; i++) {
      const g = this.gates[i];
      if (g.hudQuestion) { wantHud = g.hudQuestion; break; }
      // Don't peek past the next un-cleared gate — only show the HUD for the one the player is
      // currently approaching, not a Style-5 gate that's still 4 gates away.
      break;
    }
    if (wantHud !== this._lastHudText) {
      this._lastHudText = wantHud;
      this.uiHooks.setHudQuestion?.(wantHud);
    }
  }

  flagReached(playerPos) {
    if (!this.flag) return false;
    const dx = playerPos.x - this.flag.pos.x;
    const dz = playerPos.z - this.flag.pos.z;
    const dy = playerPos.y - this.flag.pos.y;
    return (dx * dx + dz * dz) < (FLAG_REACH * FLAG_REACH) && Math.abs(dy) < 2.5;
  }

  dispose() {
    for (const p of this.platforms) {
      this.scene.remove(p.mesh);
      if (p.tagMesh) this.scene.remove(p.tagMesh);
      this.world.removeRigidBody(p.body);
    }
    for (const mp of this.movingPlatforms) {
      this.scene.remove(mp.mesh);
      this.world.removeRigidBody(mp.body);
    }
    for (const g of this.gates) g.gate.dispose();
    for (const e of this.extras) this.scene.remove(e);
    if (this.flag) this.scene.remove(this.flag.mesh);
    this.uiHooks.setHudQuestion?.(null);
    this.platforms = [];
    this.movingPlatforms = [];
    this.gates = [];
    this.extras = [];
    this.flag = null;
  }
}

// =================================================================
// Editor-format loader.
//
// Each entry in data.objects is loaded standalone with its own per-instance id, position,
// rotation, scale. The "answer gate" concept is no longer a fused 3-platform construct;
// instead each platform-falling instance independently falls on contact unless its
// `correctAnswer: true` flag is set. Answer-label objects float as Style-3 bubbles above the
// position they describe (optionally attachedTo a specific platform id, in which case the
// label's position is interpreted as offset from that platform and the label follows it
// through shake/fall animations).
// =================================================================

const ANSWER_BUBBLE_TINT = 'rgba(110, 180, 255, 0.85)';   // Style 3 sky-blue
const ANSWER_BUBBLE_TEXT = '#ffffff';

// Builds a translucent rounded "Style 3" answer bubble for the new mechanic.
// fontSize selects canvas font px; color overrides the tint hue (keeps alpha).
function makeAnswerLabelMesh(text, { fontSize = 'medium', color = 'white' } = {}) {
  const FONT_PX = { small: 200, medium: 280, large: 360 }[fontSize] ?? 280;
  const HEIGHT_W = { small: 0.45, medium: 0.6, large: 0.8 }[fontSize] ?? 0.6;
  const TINT = ({
    white:  ANSWER_BUBBLE_TINT,
    red:    'rgba(255, 110, 110, 0.85)',
    green:  'rgba(110, 220, 130, 0.85)',
    blue:   'rgba(110, 180, 255, 0.85)',
    yellow: 'rgba(255, 215, 90, 0.85)',
  })[color] ?? ANSWER_BUBBLE_TINT;

  const H = 512;
  const font = `bold ${FONT_PX}px Arial, sans-serif`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textW = measure.measureText(text || '').width;
  const PAD_PX = 110;
  const W = Math.max(700, Math.ceil(textW + 2 * PAD_PX));

  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const r = 80;
  ctx.fillStyle = TINT;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(W, 0, W, H, r);
  ctx.arcTo(W, H, 0, H, r);
  ctx.arcTo(0, H, 0, 0, r);
  ctx.arcTo(0, 0, W, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ANSWER_BUBBLE_TEXT;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '', W / 2, H / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const planeW = Math.max(1.0, HEIGHT_W * (W / H));
  const geo = new THREE.PlaneGeometry(planeW, HEIGHT_W);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, fog: false,
    side: THREE.DoubleSide, opacity: 0.95,
  });
  return { mesh: new THREE.Mesh(geo, mat), mat };
}

// Apply a rotation + uniform scale to a mesh. `rot` may be either a scalar (degrees around Y —
// the backward-compatible form, since most placements only ever cared about yaw) or an object
// { x, y, z } giving degrees around each axis. Euler order is YXZ so a level-author's mental
// model of "first tilt forward, then yaw, then roll" matches what they see in the editor.
function applyTransform(mesh, rot, scale) {
  const e = eulerXYZRad(rot);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.set(e.x, e.y, e.z);
  const s = scale || 1;
  mesh.scale.set(s, s, s);
}

// Normalize a rotation value (scalar Y degrees OR { x, y, z } degrees) into radians per axis.
function eulerXYZRad(rot) {
  if (rot == null) return { x: 0, y: 0, z: 0 };
  if (typeof rot === 'number') return { x: 0, y: rot * Math.PI / 180, z: 0 };
  return {
    x: ((rot.x || 0)) * Math.PI / 180,
    y: ((rot.y || 0)) * Math.PI / 180,
    z: ((rot.z || 0)) * Math.PI / 180,
  };
}

// Convenience for callers that have the obj data and need its full rotation triplet.
function rotationOf(obj) {
  return {
    x: obj.rotationX || 0,
    y: obj.rotation  || 0,
    z: obj.rotationZ || 0,
  };
}

// Walk a freshly-cloned Three.js model (root identity) and concatenate every child mesh's
// triangle data into a single (vertices, indices) pair, in the root's local frame. Vertices
// can then be passed to Rapier's trimesh collider.
//
// The model passed in MUST have an identity transform on its root (the function uses each
// child's matrixWorld relative to that identity). Caller applies scale to the returned
// vertices if the asset is scaled.
// Build a trimesh collider (vertices + indices) from a fresh GLTF clone with `scale` and a
// 3-axis rotation baked into the vertices so the static collider lines up with the rendered
// mesh. `rot` accepts either the legacy scalar (degrees around Y) or { x, y, z } degrees per
// axis. Uses Euler order YXZ to match applyTransform.
async function buildTrimeshForUrl(url, scale, rot) {
  const tmpl = await loadModel(url);
  const { vertices, indices } = extractTrimeshFromModel(tmpl);
  const e = eulerXYZRad(rot);
  const hasRot = (e.x !== 0 || e.y !== 0 || e.z !== 0);
  if (scale !== 1 || hasRot) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(e.x, e.y, e.z, 'YXZ'));
    const v = new THREE.Vector3();
    for (let i = 0; i < vertices.length; i += 3) {
      v.set(vertices[i] * scale, vertices[i + 1] * scale, vertices[i + 2] * scale).applyMatrix4(m);
      vertices[i]     = v.x;
      vertices[i + 1] = v.y;
      vertices[i + 2] = v.z;
    }
  }
  return { vertices, indices };
}

function extractTrimeshFromModel(root) {
  root.updateMatrixWorld(true);
  const positions = [];
  const indices = [];
  let vertOffset = 0;
  const v = new THREE.Vector3();
  root.traverse(child => {
    if (!child.isMesh || !child.geometry) return;
    const geo = child.geometry;
    const pos = geo.attributes?.position;
    if (!pos) return;
    const m = child.matrixWorld;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      positions.push(v.x, v.y, v.z);
    }
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + vertOffset);
    } else {
      // Non-indexed geometry: each consecutive triplet is one triangle.
      for (let i = 0; i < pos.count; i++) indices.push(i + vertOffset);
    }
    vertOffset += pos.count;
  });
  return { vertices: new Float32Array(positions), indices: new Uint32Array(indices) };
}

async function loadEditorLevel(scene, world, RAPIER, particles, sfx, data, callbacks, uiHooks) {
  console.log('[editor-level] loading:', { id: data.id, name: data.name, objects: data.objects?.length });
  const platforms = [];          // { id, mesh, body, pos, half, top, def, scale, isFalling, correctAnswer, state, timer, fallVel, attachedLabels[] }
  const decoratives = [];        // { mesh } — no collider
  const solidDecor = [];         // { mesh, body } — static collider, no platform-top semantics
  const coins = [];              // { id, mesh, pos, collected }
  const labels = [];             // { id, mesh, mat, basePos, attachedTo? }
  const checkpoints = [];        // { id, pos }
  // EXTRA-pack additions:
  //   conveyors → platforms[] (with .behavior=='conveyor' + .params.speed) so findRiderDelta
  //               can apply a belt translation to a player standing on top.
  //   hazards   → independent list with mesh, basePos/rot, behavior, params, and optional
  //               static collider. update() animates them and checks AABB overlap with the
  //               player to fire callbacks.onHazardHit (game.js: respawn).
  const hazards = [];           // { id, mesh, behavior, params, basePos, baseRotY, halfXZ, halfY, def, isSolid }
  let flag = null;
  let spawn = null;
  if (data.spawn?.position) {
    const [x, y, z] = data.spawn.position;
    spawn = [x, y, z];
  }

  // Resolve every object. Order matters slightly: platforms first so labels' attachedTo lookups
  // succeed, but since attachedTo is just an id-string we resolve via a second pass anyway.
  for (const obj of data.objects) {
    const type = obj.type;
    if (type === 'answer-label') {
      const { mesh, mat } = makeAnswerLabelMesh(obj.text, { fontSize: obj.fontSize, color: obj.color });
      const [x, y, z] = obj.position;
      mesh.position.set(x, y, z);   // may be overwritten in pass 2 if attachedTo
      // Rotation around Y lets the level author orient labels for gates where the player's
      // direction of travel isn't south (-Z). For a gate the player approaches from +X, set
      // rotation: 90 so the label's plane faces the player head-on.
      mesh.rotation.y = (obj.rotation || 0) * Math.PI / 180;
      scene.add(mesh);
      labels.push({
        id: obj.id, mesh, mat,
        basePos: { x, y, z },
        offset: [x, y, z],
        attachedTo: obj.attachedTo || null,
      });
      continue;
    }
    if (type === 'checkpoint') {
      const [x, y, z] = obj.position;
      checkpoints.push({ id: obj.id, pos: { x, y, z } });
      continue;
    }
    const def = CATALOG_BY_TYPE[type];
    if (!def) {
      console.warn(`[editor-level] unknown object type: ${type}`);
      continue;
    }
    const [x, y, z] = obj.position;
    const scale = obj.scale ?? 1;
    const rot = rotationOf(obj);              // { x, y, z } degrees per axis
    const rotationDeg = rot.y;                // legacy yaw, used by code that only cares about Y
    // Resolve the color: explicit obj.color wins, otherwise pull the catalog default.
    const color = obj.color || def.defaultColor;
    const url = urlFor(type, color);

    if (def.kind === 'platform') {
      const mesh = await loadModel(url);
      const halfX = def.half.x * scale;
      const halfY = def.half.y * scale;
      const halfZ = def.half.z * scale;
      const height = def.height * scale;
      // Convention: y = mesh-bottom anchor. Mesh sits AT y; walkable top is at y + height.
      // We pick collider geometry per asset: 'box' (default, fast, ordinary slabs) or
      // 'trimesh' (slopes + holes — the collider must follow the mesh, not its AABB).
      let phys;
      if (def.colliderKind === 'trimesh') {
        const { vertices, indices } = await buildTrimeshForUrl(url, scale, rot);
        phys = addStaticTrimesh(world, RAPIER, { x, y, z }, vertices, indices);
      } else {
        phys = addStaticBox(world, RAPIER, { x, y: y + halfY, z }, { x: halfX, y: halfY, z: halfZ });
        if (rot.x || rot.y || rot.z) {
          // Build the platform's quaternion from the full 3-axis rotation (YXZ order matches
          // applyTransform). Older one-axis rotations still work because rot.x and rot.z default
          // to 0 — the resulting quaternion is the same yaw-only quaternion we used before.
          const e = eulerXYZRad(rot);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x, e.y, e.z, 'YXZ'));
          phys.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
        }
      }
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      // Red platforms fall on contact unless the author marked them as the correctAnswer.
      const isFalling = color === 'red' && obj.correctAnswer !== true;
      const platform = {
        id: obj.id,
        mesh, body: phys.body,
        pos: { x, y, z },
        half: { x: halfX, y: halfY, z: halfZ },
        top: y + height,            // the walkable top — used by the player-on-platform test
        height,
        def,
        scale,
        color,
        isFalling,
        correctAnswer: obj.correctAnswer === true,
        state: 'idle',
        timer: 0,
        fallVel: 0,
        attachedLabels: [],
      };
      // Conveyors: cache belt parameters so findRiderDelta can carry the rider along local +Z.
      // Direction is the platform's facing — a yaw of 0° means the belt runs along world +Z.
      if (def.behavior === 'conveyor') {
        platform.behavior = 'conveyor';
        platform.speed = (obj.speed !== undefined) ? obj.speed : (def.defaults?.speed ?? 3);
        const yaw = rotationDeg * Math.PI / 180;
        platform.beltDir = { x: Math.sin(yaw), z: Math.cos(yaw) };
      }
      platforms.push(platform);
    } else if (def.kind === 'hazard') {
      // Hazard family. Three runtime variants:
      //   - static / trap: trimesh collider, AABB-kill on touch (spike blocks, floor spikes).
      //   - ghost animated (rotator / cannon / pendulum without `pushy`): no collider, just an
      //     AABB-kill on touch (saw blades, swipers, etc.).
      //   - pushy animated (pendulum with `pushy: true`, i.e. hammers): a kinematic-position
      //     collider sized to the model's head region. The Rapier controller resolves the
      //     player against it as a moving wall — the player gets knocked away, and can fall
      //     off ledges. No AABB-kill.
      const mesh = await loadModel(url);
      const isSolid = (def.behavior === 'static' || def.behavior === 'trap');
      const isPushy = (def.behavior === 'pendulum' && def.pushy === true);

      // Reverted to plain mesh-anchor rotation: no pivot-group wrapper. Rotating around the
      // mesh's own origin should put the pivot at the model's natural anchor (Y=0 in mesh-
      // local), which for KayKit hammers sits in the chain region between the bottom link
      // and the head. Asking the user to clarify the desired pivot once they see this again.
      const localBox = new THREE.Box3().setFromObject(mesh);
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      const visualRoot = mesh;

      if (isSolid) {
        // Use a trimesh collider — spike block silhouettes are non-cuboid, and floor_spikes
        // pop-ups want the player to physically stand on the base, not the spike tips.
        const { vertices, indices } = await buildTrimeshForUrl(url, scale, rot);
        const phys = addStaticTrimesh(world, RAPIER, { x, y, z }, vertices, indices);
        solidDecor.push({ mesh, body: phys.body });   // reuse solidDecor for dispose bookkeeping
      }

      // Pushy pendulum: kinematic cuboid that sits at the model's HEAD region — for KayKit
      // hammers the head is in the upper half of the bbox (anchor near grip, head extends up
      // to localBox.max.y). We cover the top 50% of the model's height so the cuboid wraps
      // the hammerhead but not the chain/handle below it.
      let pushyBody = null;
      let headLocalCenter = null;
      let headHalf = null;
      if (isPushy) {
        const sizeX = (localBox.max.x - localBox.min.x);
        const sizeZ = (localBox.max.z - localBox.min.z);
        const fullH = (localBox.max.y - localBox.min.y);
        const headHeight = fullH * 0.5;                       // top half of the bbox
        const headCenterY = localBox.min.y + 0.75 * fullH;    // midpoint of that top half
        headLocalCenter = new THREE.Vector3(0, headCenterY, 0);
        headHalf = {
          x: sizeX * 0.5 * scale,
          y: headHeight * 0.5 * scale,
          z: sizeZ * 0.5 * scale,
        };
        const phys = addKinematicBox(world, RAPIER, { x: 0, y: 0, z: 0 }, headHalf);
        pushyBody = phys.body;
      }

      // Collect behavior parameters with catalog defaults as the fallback.
      const params = {};
      if (def.defaults) {
        for (const k of Object.keys(def.defaults)) {
          params[k] = (obj[k] !== undefined) ? obj[k] : def.defaults[k];
        }
      }
      const halfX = (def.half?.x ?? 0.5) * scale;
      const halfY = (def.half?.y ?? 0.5) * scale;
      const halfZ = (def.half?.z ?? 0.5) * scale;
      hazards.push({
        id: obj.id,
        mesh: visualRoot,                  // the THING the runtime rotates (group for pendulums, mesh otherwise)
        innerMesh: mesh,                   // always the GLTF mesh — used to read head-position via matrixWorld
        behavior: def.behavior || 'static',
        params,
        basePos: { x, y, z },
        // Full base rotation in radians per axis. Animations (pendulum swing, rotator spin)
        // compose with this so a tilted hammer still swings around its model-local Z axis.
        baseRot: eulerXYZRad(rot),
        halfXZ: Math.max(halfX, halfZ),
        halfY,
        def,
        isSolid,
        isPushy,
        pushyBody,                          // kinematic body to drive each frame (or null)
        headLocalCenter,                    // head center in mesh-local coords
        headHalf,                           // collider half-extents (info-only after creation)
      });
    } else if (def.kind === 'collectible') {
      const mesh = await loadModel(url);
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      coins.push({ id: obj.id, mesh, pos: { x, y, z }, collected: false });
    } else if (def.kind === 'flag') {
      const mesh = await loadModel(url);
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      flag = { id: obj.id, mesh, pos: { x, y, z } };
    } else if (def.kind === 'decor-solid') {
      const mesh = await loadModel(url);
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      const halfX = def.half.x * scale;
      const halfY = def.half.y * scale;
      const halfZ = def.half.z * scale;
      const phys = addStaticBox(world, RAPIER, { x, y: y + halfY, z }, { x: halfX, y: halfY, z: halfZ });
      if (rot.x || rot.y || rot.z) {
        const e = eulerXYZRad(rot);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e.x, e.y, e.z, 'YXZ'));
        phys.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
      }
      solidDecor.push({ mesh, body: phys.body });
    } else if (def.kind === 'decor') {
      const mesh = await loadModel(url);
      mesh.position.set(x, y, z);
      applyTransform(mesh, rot, scale);
      scene.add(mesh);
      // Build a trimesh collider straight from the asset geometry. Trimesh (not AABB) is the
      // right choice for the decor catalog: arches and hoops have holes the player needs to
      // pass through, while railings, barriers, pipes, signs, and struts have solid shapes
      // that should actually block movement.
      const { vertices, indices } = await buildTrimeshForUrl(url, scale, rot);
      const phys = addStaticTrimesh(world, RAPIER, { x, y, z }, vertices, indices);
      solidDecor.push({ mesh, body: phys.body });
    }
  }

  // Also accept the convenience top-level flag form (data.flag.position).
  if (!flag && data.flag?.position) {
    const [x, y, z] = data.flag.position;
    const mesh = await loadModel(urlFor(DEFAULT_FLAG_TYPE, DEFAULT_FLAG_COLOR));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    flag = { id: data.flag.id || 'flag_1', mesh, pos: { x, y, z } };
  }

  // Pass 2: link attachedTo labels to their platforms so they shake & fall together. When
  // attachedTo is set, the label's stored position is interpreted as an offset from the
  // platform's top-center, not a world position.
  for (const lbl of labels) {
    if (!lbl.attachedTo) continue;
    const host = platforms.find(p => p.id === lbl.attachedTo);
    if (!host) {
      console.warn(`[editor-level] answer-label ${lbl.id} attachedTo unknown platform ${lbl.attachedTo}`);
      continue;
    }
    const [ox, oy, oz] = lbl.offset;
    lbl.basePos = { x: host.pos.x + ox, y: host.pos.y + oy, z: host.pos.z + oz };
    lbl.mesh.position.set(lbl.basePos.x, lbl.basePos.y, lbl.basePos.z);
    host.attachedLabels.push(lbl);
  }

  // Fallback spawn if the file omitted one.
  if (!spawn) spawn = [0, 2, 0];

  console.log('[editor-level] loaded:', {
    platforms: platforms.length,
    decor: decoratives.length,
    solidDecor: solidDecor.length,
    coins: coins.length,
    labels: labels.length,
    checkpoints: checkpoints.length,
    flag: !!flag,
    spawn,
  });
  // If the data had objects but none of them resolved to a known catalog entry, the runtime
  // looks empty. Most likely cause: stale localStorage with pre-migration type names.
  const placed = platforms.length + decoratives.length + solidDecor.length + coins.length + hazards.length + (flag ? 1 : 0);
  if (data.objects.length > 0 && placed === 0) {
    console.warn(`[editor-level] all ${data.objects.length} objects in the draft failed to resolve (likely stale type names from the old editor). Open editor.html, place a new platform, and click Playtest again.`);
  }

  return new EditorLoadedLevel(scene, world, {
    platforms, decoratives, solidDecor, coins, labels, checkpoints, hazards, flag, spawn,
  }, uiHooks, callbacks);
}

const ED_SHAKE_DURATION = 0.2;
const ED_FALL_DURATION  = 1.5;
const ED_SHAKE_AMP      = 0.06;
const ED_FALL_GRAVITY   = 22;

export class EditorLoadedLevel {
  constructor(scene, world, parts, uiHooks, callbacks) {
    this.scene = scene;
    this.world = world;
    this.platforms = parts.platforms;
    this.decoratives = parts.decoratives;
    this.solidDecor = parts.solidDecor;
    this.coins = parts.coins;
    this.labels = parts.labels;
    this.checkpoints = parts.checkpoints;
    this.hazards = parts.hazards || [];
    this.flag = parts.flag;
    this.spawn = parts.spawn;
    this.uiHooks = uiHooks || {};
    this.callbacks = callbacks || {};
    this.elapsed = 0;
    this.movingPlatforms = [];   // none yet in the editor format
    // Conveyor list — subset of platforms. Cached so findRiderDelta doesn't filter every step.
    this.conveyors = this.platforms.filter(p => p.behavior === 'conveyor');
  }

  // The new runtime has no "gate" progress concept — the level is a free-form playground that
  // ends when the player touches the flag. Return 0 so the caller can hide the progress UI.
  get gateCount() { return 0; }

  markCleared() {}

  // Runs ONCE per FIXED_DT step, BEFORE world.step() and the player's character-controller pass.
  // We advance hazard animations here (mesh transforms + kinematic-body positions) so the
  // collider the controller resolves against is already at this step's position — not the
  // previous step's. Doing this in update() instead caused a one-frame lag where the visible
  // hammer head would pass through the player while the collider trailed behind, and the
  // player suddenly got pushed only once the head was deep inside them.
  prePhysics(fixedDt) {
    this.elapsed += fixedDt;
    this._animateHazards();
  }

  // No oscillating kinematic platforms in the editor format — conveyors are static colliders that
  // carry the rider through findRiderDelta, so there's nothing to queue after the controller pass.
  stepMovingPlatforms() {}

  // If the player is standing on a conveyor, return the per-step belt translation so the player
  // gets carried along. The belt direction is the conveyor's local +Z rotated by its yaw — set
  // when the conveyor was loaded. Negative `speed` reverses direction.
  findRiderDelta(playerPos, playerGrounded, fixedDt) {
    if (!playerGrounded) return null;
    for (const c of this.conveyors) {
      if (Math.abs(playerPos.x - c.pos.x) > c.half.x) continue;
      if (Math.abs(playerPos.z - c.pos.z) > c.half.z) continue;
      if (Math.abs(playerPos.y - c.top) > 0.4)        continue;
      const step = c.speed * fixedDt;
      return { dx: c.beltDir.x * step, dy: 0, dz: c.beltDir.z * step };
    }
    return null;
  }

  update(dt, playerPos, playerGrounded) {
    // Falling-platform state machine, per platform.
    for (const p of this.platforms) {
      if (p.state === 'shaking') {
        p.timer -= dt;
        const jx = (Math.random() - 0.5) * ED_SHAKE_AMP;
        const jz = (Math.random() - 0.5) * ED_SHAKE_AMP;
        p.mesh.position.x = p.pos.x + jx;
        p.mesh.position.z = p.pos.z + jz;
        for (const lbl of p.attachedLabels) {
          lbl.mesh.position.x = lbl.basePos.x + jx;
          lbl.mesh.position.z = lbl.basePos.z + jz;
        }
        if (p.timer <= 0) this._dropPlatform(p);
        continue;
      }
      if (p.state === 'falling') {
        p.fallVel += ED_FALL_GRAVITY * dt;
        const dy = p.fallVel * dt;
        p.mesh.position.y -= dy;
        for (const lbl of p.attachedLabels) lbl.mesh.position.y -= dy;
        const fade = Math.max(0, p.timer / ED_FALL_DURATION);
        for (const lbl of p.attachedLabels) lbl.mat.opacity = fade * 0.95;
        p.timer -= dt;
        if (p.timer <= 0) {
          this.scene.remove(p.mesh);
          for (const lbl of p.attachedLabels) this.scene.remove(lbl.mesh);
          p.state = 'gone';
        }
      }
    }

    // Contact: does the player stand on a falling platform that hasn't been triggered yet?
    if (playerGrounded) {
      for (const p of this.platforms) {
        if (!p.isFalling || p.state !== 'idle') continue;
        if (Math.abs(playerPos.x - p.pos.x) > p.half.x) continue;
        if (Math.abs(playerPos.z - p.pos.z) > p.half.z) continue;
        if (Math.abs(playerPos.y - p.top) > 0.3) continue;
        p.state = 'shaking';
        p.timer = ED_SHAKE_DURATION;
        this.callbacks.onWrongAnswer?.(p);
      }
    }

    // Coin spin + pickup.
    for (const c of this.coins) {
      if (c.collected) continue;
      c.mesh.rotation.y += dt * 2.0;
      const dx = playerPos.x - c.pos.x;
      const dy = playerPos.y - c.pos.y;
      const dz = playerPos.z - c.pos.z;
      if (dx * dx + dy * dy + dz * dz < 1.2 * 1.2) {
        c.collected = true;
        this.scene.remove(c.mesh);
      }
    }

    // Checkpoint detection — passing within 1.5 units sets last-checkpoint.
    for (const cp of this.checkpoints) {
      const dx = playerPos.x - cp.pos.x;
      const dy = playerPos.y - cp.pos.y;
      const dz = playerPos.z - cp.pos.z;
      if (dx * dx + dz * dz < 1.5 * 1.5 && Math.abs(dy) < 2.5) {
        this.callbacks.onCheckpoint?.(cp.pos);
      }
    }

    // Flag spin for visual interest.
    if (this.flag?.mesh) this.flag.mesh.rotation.y += dt * 1.2;

    // EXTRA pack: hazard hit detection (animation already happened in prePhysics).
    this._checkHazardHits(playerPos);
  }

  // Advance every animated hazard to the position it should be at this physics step. Called
  // from prePhysics so the queued kinematic motion is in place BEFORE world.step() and BEFORE
  // the character controller's resolution pass. The pushy body uses setNextKinematicTranslation
  // (NOT setTranslation) — Rapier's character controller derives a "moving wall" velocity from
  // the queued next-translation. A direct setTranslation teleports the body with zero velocity,
  // which the controller doesn't treat as something to push the player away from.
  _animateHazards() {
    const t = this.elapsed;
    for (const h of this.hazards) {
      if (h.behavior === 'pendulum') {
        const { period, amplitude, phase } = h.params;
        const omega = (2 * Math.PI) / Math.max(0.1, period);
        const ph    = (phase || 0) * Math.PI / 180;
        const angle = amplitude * Math.PI / 180 * Math.sin(omega * t + ph);
        h.mesh.rotation.order = 'YXZ';
        h.mesh.rotation.set(h.baseRot.x, h.baseRot.y, h.baseRot.z);
        h.mesh.rotateZ(angle);
        if (h.pushyBody && h.headLocalCenter) {
          h.mesh.updateMatrixWorld(true);
          const headWorld = _tmpVec3.copy(h.headLocalCenter).applyMatrix4(h.mesh.matrixWorld);
          h.pushyBody.setNextKinematicTranslation({ x: headWorld.x, y: headWorld.y, z: headWorld.z });
          // Use mesh.quaternion directly — Euler→Quaternion via mesh.rotation can drift on
          // composed rotations (rotateZ updates the quaternion in place; the matching Euler
          // is re-derived using rotation.order and can differ from the actual quaternion).
          const q = h.mesh.getWorldQuaternion(_tmpQuat);
          h.pushyBody.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        }
      } else if (h.behavior === 'rotator') {
        const radPerSec = (h.params.rpm || 0) * (2 * Math.PI / 60);
        h.mesh.rotation.order = 'YXZ';
        h.mesh.rotation.set(h.baseRot.x, h.baseRot.y + radPerSec * t, h.baseRot.z);
      } else if (h.behavior === 'trap') {
        const { period, onFraction, phase } = h.params;
        const cycle = ((t / Math.max(0.1, period)) + (phase || 0) / 360) % 1;
        const up = cycle < onFraction;
        h.mesh.visible = true;
        h.mesh.position.y = h.basePos.y + (up ? 0 : -h.halfY);
        h.trapUp = up;
      } else if (h.behavior === 'cannon') {
        const omega = (2 * Math.PI) / Math.max(0.1, h.params.interval);
        h.mesh.position.y = h.basePos.y + 0.05 * Math.sin(omega * t);
      }
    }
  }

  // Post-step depenetration for pushy hazards (hammers). The kinematic-body collider lets
  // Rapier's character controller resolve gentle contacts, but a fast-swinging head sweeps
  // an arc that the controller's next-frame prediction can miss — the head ends up overlapping
  // the player. We catch the residual overlap here and push the capsule out along the head's
  // OBB face. Called from the frame loop AFTER world.step().
  //
  // The capsule (radius 0.3, half-height 0.4) is approximated as two spheres at its cylinder
  // ends; each is tested vs the head's oriented box (center = mesh-local head center mapped to
  // world, rotation = mesh world quaternion, half-extents = h.headHalf). Pushes are applied
  // sequentially so the second test sees the first's correction.
  applyPushyForces(player) {
    const capR = 0.3;
    for (const h of this.hazards) {
      if (!h.isPushy || !h.headLocalCenter) continue;
      h.innerMesh.updateMatrixWorld(true);
      const headWorld = _tmpVec3.copy(h.headLocalCenter).applyMatrix4(h.innerMesh.matrixWorld);
      const q = h.innerMesh.getWorldQuaternion(_tmpQuat);
      const qInv = _tmpQuatB.copy(q).invert();
      const half = h.headHalf;
      for (const oy of [-0.4, 0.4]) {
        const t = player.body.translation();
        const local = _tmpVec3B.set(t.x - headWorld.x, t.y + oy - headWorld.y, t.z - headWorld.z).applyQuaternion(qInv);
        const cx = Math.max(-half.x, Math.min(half.x, local.x));
        const cy = Math.max(-half.y, Math.min(half.y, local.y));
        const cz = Math.max(-half.z, Math.min(half.z, local.z));
        const vx = local.x - cx, vy = local.y - cy, vz = local.z - cz;
        const distSq = vx * vx + vy * vy + vz * vz;
        let lx, ly, lz;
        if (distSq > 1e-8) {
          if (distSq >= capR * capR) continue;            // outside the padded OBB
          const d = Math.sqrt(distSq);
          const k = (capR - d) / d;
          lx = vx * k; ly = vy * k; lz = vz * k;
        } else {
          // Sphere center is inside the box — exit along the shortest axis.
          const ex = half.x - Math.abs(local.x);
          const ey = half.y - Math.abs(local.y);
          const ez = half.z - Math.abs(local.z);
          if (ex <= ey && ex <= ez)      { lx = Math.sign(local.x || 1) * (ex + capR); ly = 0; lz = 0; }
          else if (ey <= ez)             { lx = 0; ly = Math.sign(local.y || 1) * (ey + capR); lz = 0; }
          else                           { lx = 0; ly = 0; lz = Math.sign(local.z || 1) * (ez + capR); }
        }
        // Rotate the local push back to world and apply it through the player so the body,
        // the queued kinematic motion, and the character mesh all stay in sync.
        _tmpVec3B.set(lx, ly, lz).applyQuaternion(q);
        player.applyPush(_tmpVec3B.x, _tmpVec3B.y, _tmpVec3B.z);
      }
    }
  }

  // Hit detection: player point vs hazard AABB. Pendulums use a moving AABB recomputed from
  // the mesh's current world matrix; static hazards use the base AABB. Pushy hazards (hammers)
  // are skipped — the Rapier collider already handles them via the character controller.
  _checkHazardHits(playerPos) {
    if (!this.callbacks.onHazardHit) return;
    const pad = 0.45;   // player capsule radius
    for (const h of this.hazards) {
      if (h.isPushy) continue;
      if (h.behavior === 'trap' && h.trapUp === false) continue;
      const box = _box3.setFromObject(h.mesh);
      if (box.isEmpty()) continue;
      if (playerPos.x < box.min.x - pad || playerPos.x > box.max.x + pad) continue;
      if (playerPos.z < box.min.z - pad || playerPos.z > box.max.z + pad) continue;
      if (playerPos.y < box.min.y - pad || playerPos.y > box.max.y + pad) continue;
      this.callbacks.onHazardHit(h);
      return;
    }
  }

  _dropPlatform(p) {
    if (p.body) {
      this.world.removeRigidBody(p.body);
      p.body = null;
    }
    p.state = 'falling';
    p.timer = ED_FALL_DURATION;
    p.fallVel = 0;
  }

  flagReached(playerPos) {
    if (!this.flag) return false;
    const dx = playerPos.x - this.flag.pos.x;
    const dz = playerPos.z - this.flag.pos.z;
    const dy = playerPos.y - this.flag.pos.y;
    return (dx * dx + dz * dz) < (FLAG_REACH * FLAG_REACH) && Math.abs(dy) < 2.5;
  }

  dispose() {
    for (const p of this.platforms) {
      if (p.mesh.parent) this.scene.remove(p.mesh);
      if (p.body) this.world.removeRigidBody(p.body);
    }
    for (const d of this.decoratives) this.scene.remove(d.mesh);
    for (const s of this.solidDecor) {
      this.scene.remove(s.mesh);
      this.world.removeRigidBody(s.body);
    }
    for (const c of this.coins) if (!c.collected) this.scene.remove(c.mesh);
    for (const lbl of this.labels) if (lbl.mesh.parent) this.scene.remove(lbl.mesh);
    if (this.flag?.mesh) this.scene.remove(this.flag.mesh);
    // Hazards: static hazard colliders were registered into solidDecor (cleaned above). Animated
    // hazards' visual meshes are detached here. Pushy pendulums own a kinematic body of their
    // own — remove it explicitly so Rapier doesn't keep it around between level loads.
    for (const h of this.hazards) {
      if (h.mesh.parent) this.scene.remove(h.mesh);
      if (h.pushyBody)   this.world.removeRigidBody(h.pushyBody);
    }
    this.platforms = []; this.decoratives = []; this.solidDecor = [];
    this.coins = []; this.labels = []; this.checkpoints = []; this.hazards = []; this.flag = null;
  }
}
