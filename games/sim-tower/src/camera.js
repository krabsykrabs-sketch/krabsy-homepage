// Fixed cutaway camera. Orthographic + tiny tilt by default (sell depth with
// lighting, not angle); optionally a very-long-lens perspective. Auto-frames a
// target Box3 so the whole building fits with margin.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const DEG = Math.PI / 180;

export function makeCamera(aspect) {
  if (CONFIG.USE_PERSPECTIVE) {
    return new THREE.PerspectiveCamera(CONFIG.PERSPECTIVE_FOV, aspect, 0.1, 2000);
  }
  // placeholder frustum; frameCamera resizes it
  const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 2000);
  return cam;
}

/** Unit vector from the look target back toward the camera. */
function offsetDir() {
  const tilt = CONFIG.CAMERA_TILT_DEG * DEG;
  const yaw = CONFIG.CAMERA_YAW_DEG * DEG;
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(tilt),
    Math.sin(tilt),
    Math.cos(yaw) * Math.cos(tilt),
  ).normalize();
}

/**
 * Position + size the camera to frame `box` (THREE.Box3) at the given aspect.
 * `leftGutterFrac` reserves that fraction of the screen's width empty on the
 * left (for the build-mode panel): the whole building still fits, just pushed
 * into the right portion. Returns the look target for reuse (light targeting).
 */
export function frameCamera(camera, box, aspect, leftGutterFrac = 0) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dir = offsetDir();
  const gutter = Math.max(0, Math.min(0.6, leftGutterFrac));
  const usable = 1 - gutter;
  camera.up.set(0, 1, 0);

  if (camera.isOrthographicCamera) {
    const tilt = CONFIG.CAMERA_TILT_DEG * DEG;
    const projH = size.y * Math.cos(tilt) + size.z * Math.sin(tilt);
    const projW = size.x;
    // width must fit in the usable (right) fraction of the frustum
    const halfH = Math.max(projH / 2, (projW / 2) / (usable * aspect)) * CONFIG.ZOOM_MARGIN;
    const halfW = halfH * aspect;
    // shift the look target left so the building sits in the right `usable` band
    center.x -= gutter * halfW;
    camera.position.copy(center).addScaledVector(dir, CONFIG.CAMERA_DISTANCE);
    camera.lookAt(center);
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.near = -CONFIG.CAMERA_DISTANCE - size.length();
    camera.far = CONFIG.CAMERA_DISTANCE + size.length() * 2;
    camera.updateProjectionMatrix();
  } else {
    const vFov = camera.fov * DEG;
    const fitH = size.y / (2 * Math.tan(vFov / 2));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const fitW = (size.x / usable) / (2 * Math.tan(hFov / 2));
    const dist = Math.max(fitH, fitW) * CONFIG.ZOOM_MARGIN + size.z / 2;
    // pan: world units per screen-fraction at this distance
    const worldHalfW = Math.tan(hFov / 2) * dist;
    center.x -= gutter * worldHalfW;
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.near = 0.1; camera.far = dist * 3 + size.length();
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }
  return center;
}
