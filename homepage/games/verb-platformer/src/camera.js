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
  };

  const tmpTarget = new THREE.Vector3();
  const tmpDesired = new THREE.Vector3();

  function applyLook(deltaX, deltaY) {
    state.yaw -= deltaX * state.sensitivity;
    state.pitch += deltaY * state.sensitivity;
    state.pitch = Math.max(state.pitchMin, Math.min(state.pitchMax, state.pitch));
  }

  function update(targetPos) {
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

  // Forward direction on the XZ plane (where the camera is looking, ignoring pitch).
  // Used by player to turn movement input into world-space velocity.
  function getForwardXZ(out) {
    out.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    return out;
  }

  return { state, applyLook, update, getForwardXZ };
}
