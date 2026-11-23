// Render a single preloaded restaurant model to a small icon (data URL) for the
// station help bubbles — so "bring a plate / use a bun" shows the ACTUAL game
// object instead of an emoji. Reuses the offscreen-render trick from
// portraits.js; cached per model name (these models never change in a session).
import * as THREE from 'three';
import { getModel } from './models.js';
import { buildItemMesh, makeIngredient } from './stations.js';

const S = 128;                       // icon render size (square)
const cache = new Map();             // model name → data URL
let renderer = null, scene = null, cam = null;

function ensure() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(S, S, false);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x39406a, 1.5));
  const d = new THREE.DirectionalLight(0xfff4e2, 1.9);
  d.position.set(-2, 5, 3);
  scene.add(d);
  cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
}

/** Cached data-URL icon of a preloaded restaurant model, framed from a high
 *  3/4 angle so even a flat plate still reads clearly as a plate. */
export function modelIcon(name) {
  return renderIcon(name, () => getModel(name));
}

/** Icon of a game ITEM exactly as it looks in the kitchen (recipes.ITEMS id:
 *  tints, flat toast, lay-flat carrot, composed builds all included). Used by
 *  the order tickets and the crate hint pill. Cached per item id. */
export function itemIcon(id) {
  // a lower, side-on view than the plate icons: a bun then reads as a domed
  // bun and a patty as a flat brown disc (top-down, both were brown circles)
  return renderIcon('item:' + id, () => buildItemMesh(makeIngredient(id)), ITEM_DIR, 1.25);
}
const PLATE_DIR = new THREE.Vector3(0, 0.95, 0.5).normalize();   // look down ~62°, slight front tilt
const ITEM_DIR = new THREE.Vector3(0.25, 0.62, 1).normalize();   // ~31° down, a little from the right

function renderIcon(key, build, dirIn = PLATE_DIR, zoom = 1) {
  if (cache.has(key)) return cache.get(key);
  ensure();
  const obj = build();
  scene.add(obj);
  obj.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius || 0.5;

  const dir = dirIn;
  const half = THREE.MathUtils.degToRad(28 / 2);
  const dist = (radius / Math.sin(half)) * 1.02 / zoom;      // fit the bounding sphere (+ zoom in on items)
  cam.position.copy(center).addScaledVector(dir, dist);
  cam.lookAt(center);
  cam.updateProjectionMatrix();

  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(obj);
  cache.set(key, url);
  return url;
}
