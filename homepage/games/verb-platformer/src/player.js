import * as THREE from 'three';
import { loadAudio, playSfx } from './assets.js';
import { createPlayerCharacter } from './player-character.js';

// Tuned for a "snappy" platformer feel rather than realism.
const MOVE_SPEED   = 6.0;     // m/s on the ground
const JUMP_SPEED   = 11.0;    // m/s instantaneous on jump
const GRAVITY      = 28.0;    // m/s^2  (Rapier world gravity is separate; this drives the kinematic vy directly)
const MAX_FALL     = 35.0;    // terminal velocity clamp
const COYOTE_TIME  = 0.12;    // grace window (s) to still jump just after leaving the ground (walk/slide off a ledge)

export async function createPlayer(scene, world, RAPIER, spawn = { x: 0, y: 5, z: 0 }) {
  // Visual + animation are owned by player-character.js. Future character swaps touch only
  // that module — capsule, controller, gravity, jumps, rider-delta, teleport all stay here.
  const character = await createPlayerCharacter(scene);

  // Capsule-ish: half-height 0.4, radius 0.3. Translation = capsule center. DO NOT CHANGE THIS
  // without re-tuning gap distances + jump arcs in every level. The visual mesh is scaled to
  // fit this capsule, not the other way around.
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(spawn.x, spawn.y, spawn.z);
  const body = world.createRigidBody(bodyDesc);
  const collider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.4, 0.3),
    body,
  );

  // Rapier KinematicCharacterController handles slide + slope + step internally.
  const ctrl = world.createCharacterController(0.02);
  ctrl.setApplyImpulsesToDynamicBodies(true);
  ctrl.enableAutostep(0.3, 0.2, true);
  ctrl.enableSnapToGround(0.4);

  const sfxJump = loadAudio('./assets/sounds/jump.ogg', { volume: 0.5 });

  const state = {
    vy: 0,
    grounded: false,
    coyote: 0,        // seconds of jump-grace remaining after leaving the ground
  };

  const moveDir = new THREE.Vector3();
  const desiredMove = new THREE.Vector3();

  function update(dt, input, camera, riderDelta = null, controlsLocked = false) {
    // --- Horizontal intent (camera-relative) ---
    const fwd = camera.getForwardXZ(new THREE.Vector3());
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);

    // controlsLocked: the player committed to a wrong answer — freeze steering and jumping so they
    // ride the crumbling block down instead of escaping. Gravity below still runs, so they fall.
    moveDir.set(0, 0, 0);
    if (!controlsLocked) {
      moveDir.addScaledVector(fwd,  -input.move.y)
             .addScaledVector(right,  input.move.x);
      if (moveDir.lengthSq() > 1) moveDir.normalize();
    }

    // --- Coyote time --- keep the jump window open for a few frames after leaving the ground, so
    // walking (or sliding off a moving platform) a hair too late still lets you rescue with a jump.
    // state.grounded here is last frame's result; refresh the window while grounded, else count down.
    if (state.grounded) state.coyote = COYOTE_TIME;
    else state.coyote = Math.max(0, state.coyote - dt);

    // --- Jump --- ground OR within the coyote window; no air jumps. Always consume the buffered
    // press so a jump queued mid-crumble doesn't fire on the next respawn, but ignore it while
    // locked (committed to a wrong-answer fall — coyote must not rescue that).
    if (input.consumeJump() && (state.grounded || state.coyote > 0) && !controlsLocked) {
      state.vy = JUMP_SPEED;
      state.grounded = false;
      state.coyote = 0;          // consume the window so a single press can't double-jump
      playSfx(sfxJump);
    }

    // --- Vertical integration (manual; controller is kinematic, gravity handled here) ---
    state.vy -= GRAVITY * dt;
    if (state.vy < -MAX_FALL) state.vy = -MAX_FALL;

    desiredMove.set(
      moveDir.x * MOVE_SPEED * dt,
      state.vy * dt,
      moveDir.z * MOVE_SPEED * dt,
    );

    ctrl.computeColliderMovement(collider, desiredMove);
    const corrected = ctrl.computedMovement();

    // Apply the platform "rider" delta AFTER the controller's resolution: snap-to-ground would
    // otherwise pull the player back down to the platform's pre-step y when the platform moves
    // up (the platform body hasn't stepped yet during computeColliderMovement). Adding the delta
    // straight into setNextKinematicTranslation means the player and platform bodies teleport by
    // the same amount during world.step(), preserving their relative position exactly.
    const t = body.translation();
    const rd = riderDelta;
    const newX = t.x + corrected.x + (rd ? rd.dx : 0);
    const newY = t.y + corrected.y + (rd ? rd.dy : 0);
    const newZ = t.z + corrected.z + (rd ? rd.dz : 0);
    body.setNextKinematicTranslation({ x: newX, y: newY, z: newZ });

    // Refresh grounded after the move resolves; zero downward vy on landing.
    state.grounded = ctrl.computedGrounded();
    if (state.grounded && state.vy < 0) state.vy = 0;

    // --- Visual sync. Mesh feet sit at capsule-center − 0.7 (capsule half-height 0.4 + radius
    // 0.3). The character module owns the scaled Ranger; we just push its root position.
    character.root.position.set(newX, newY - 0.7, newZ);

    // --- Animation state + facing. Translates the physics state into the three named states
    // the character module exposes. Facing only updates when actually moving so the character
    // doesn't snap to a default orientation when standing still.
    if (!state.grounded) {
      character.setState('jumping');
    } else if (moveDir.lengthSq() > 0.001) {
      character.setState('walking');
      const yaw = Math.atan2(moveDir.x, moveDir.z);
      character.setFacing(yaw);
    } else {
      character.setState('idle');
    }
    character.update(dt);
  }

  function getPosition() {
    const t = body.translation();
    return { x: t.x, y: t.y - 0.7, z: t.z };
  }

  function teleport(pos) {
    body.setNextKinematicTranslation({ x: pos.x, y: pos.y + 0.7, z: pos.z });
    body.setTranslation({ x: pos.x, y: pos.y + 0.7, z: pos.z }, true);
    state.vy = 0;
  }

  // Instantaneous push, e.g. by a swinging hammer. Teleports the body to absorb the residual
  // overlap, mirrors the move to the next-translation so the queued kinematic motion stays
  // consistent, and syncs the character mesh so there's no one-frame visual lag. If the push
  // is upward we kill downward vy (otherwise the player keeps falling back into the head).
  function applyPush(dx, dy, dz) {
    const t = body.translation();
    const nx = t.x + dx, ny = t.y + dy, nz = t.z + dz;
    body.setTranslation({ x: nx, y: ny, z: nz }, true);
    body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    character.root.position.set(nx, ny - 0.7, nz);
    if (dy > 0 && state.vy < 0) state.vy = 0;
  }

  return { mesh: character.root, body, collider, update, getPosition, teleport, applyPush, state };
}
