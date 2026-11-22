import * as THREE from 'three';

// Orbit-style third-person camera. yaw=around-Y, pitch=elevation.
// Position derived each frame from spherical offset around the target.
export function createFollowCamera(camera) {
  const state = {
    yaw: 0,
    pitch: 0.5,             // ~28deg — tilted further down so floor-painted question text is visible from a few platforms back
    distance: 7,
    height: 1.2,            // raise look-at slightly above feet
    sensitivity: 0.0025,
    pitchMin: -0.4,
    pitchMax: 1.2,
    smoothPos: 0.18,        // 0..1, higher = snappier
    yawFollow: 5,           // how fast the camera swings behind the aim (1/s); lower = more lag
    mouseHoldMs: 350,       // the mouse counts as "in use" this long after its last movement
  };

  const tmpTarget = new THREE.Vector3();
  const tmpDesired = new THREE.Vector3();

  // Two yaws (owner decision 2026-11-21):
  //   state.aimYaw — where the MOUSE points. The character turns to it at once and W runs
  //                  along it.
  //   state.yaw    — where the camera really is. It trails aimYaw (yawFollow), so a fast
  //                  flick shows the character's side for a moment until the camera is
  //                  behind it again.
  // With keys only, neither changes: the camera holds still and the character turns to
  // wherever it is steered. When the mouse moves again after a pause, aimYaw first jumps to
  // the direction the character is facing, so the camera swings round behind it.
  state.aimYaw = state.yaw;
  let lastLookT = -1e9, lastUpdateT = performance.now();
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function mouseActive() {
    return performance.now() - lastLookT < state.mouseHoldMs;
  }

  // facingYaw: the character's current facing (atan2(x, z) of its forward), or null.
  function applyLook(deltaX, deltaY, facingYaw = null) {
    if (deltaX) {
      if (!mouseActive() && facingYaw != null) {
        // camera yaw whose forward equals that facing, taken the short way round
        state.aimYaw = state.yaw + wrap(facingYaw - Math.PI - state.yaw);
      }
      lastLookT = performance.now();
      state.aimYaw -= deltaX * state.sensitivity;
    }
    state.pitch += deltaY * state.sensitivity;
    state.pitch = Math.max(state.pitchMin, Math.min(state.pitchMax, state.pitch));
  }

  function update(targetPos) {
    const now = performance.now();
    const dt = Math.min((now - lastUpdateT) / 1000, 0.1);
    lastUpdateT = now;
    state.yaw += (state.aimYaw - state.yaw) * (1 - Math.exp(-dt * state.yawFollow));

    tmpTarget.set(targetPos.x, targetPos.y + state.height, targetPos.z);

    // Spherical-ish offset: behind-and-above target.
    const cx = Math.cos(state.pitch) * state.distance;
    const cy = Math.sin(state.pitch) * state.distance;
    tmpDesired.set(
      tmpTarget.x + Math.sin(state.yaw) * cx,
      tmpTarget.y + cy,
      tmpTarget.z + Math.cos(state.yaw) * cx,
    );

    camera.position.lerp(tmpDesired, state.smoothPos);
    camera.lookAt(tmpTarget);
  }

  // Forward direction on the XZ plane of the AIM (see above), ignoring pitch.
  // Used by player to turn movement input into world-space velocity.
  function getForwardXZ(out) {
    out.set(-Math.sin(state.aimYaw), 0, -Math.cos(state.aimYaw));
    return out;
  }

  return { state, applyLook, update, getForwardXZ, mouseActive };
}
