import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = new Map();
const texCache = new Map();

function loadOnce(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }));
  }
  return cache.get(url);
}

// Returns a fresh clone of the scene each call so callers can mutate freely.
export async function loadModel(url) {
  const gltf = await loadOnce(url);
  const scene = gltf.scene.clone(true);
  scene.traverse(o => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return scene;
}

export async function preload(urls) {
  await Promise.all(urls.map(loadOnce));
}

export function loadTexture(url, { colorSpace = THREE.SRGBColorSpace, mapping } = {}) {
  if (texCache.has(url)) return texCache.get(url);
  const tex = texLoader.load(url);
  tex.colorSpace = colorSpace;
  if (mapping) tex.mapping = mapping;
  texCache.set(url, tex);
  return tex;
}

// Canvas-text → Sprite. Used for floating asset labels in the showroom.
export function makeLabel(text, { color = '#ffffff', bg = 'rgba(0,0,0,0.55)' } = {}) {
  const padding = 16;
  const fontSize = 44;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  const w = Math.ceil(ctx.measureText(text).width) + padding * 2;
  const h = fontSize + padding;
  c.width = w; c.height = h;
  // re-set font after canvas resize (resize clears state)
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padding, h / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  // Width to keep readable; height proportional.
  const worldW = 1.4;
  sprite.scale.set(worldW, worldW * (h / w), 1);
  sprite.renderOrder = 999;
  return sprite;
}

export function loadAudio(url, { volume = 1, loop = false } = {}) {
  const a = new Audio(url);
  a.volume = volume;
  a.loop = loop;
  return a;
}

// Cheap "play overlapping" — clones the audio element so rapid triggers don't cut each other off.
export function playSfx(audio) {
  const clone = audio.cloneNode();
  clone.volume = audio.volume;
  clone.play().catch(() => {});
}

export { THREE };
