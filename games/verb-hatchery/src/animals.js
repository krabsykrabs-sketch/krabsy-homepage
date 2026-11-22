// Hatched creatures as animated animals (Quirky Series – FREE Animals,
// Omabuarts; licence not confirmed yet, files kept out of git, see ../.gitignore).
// If the files are missing, creatures.js keeps the code-built creatures.
//
// The same 8 animals appear in every rarity, each rarity a fancier version:
// common = plain, uncommon = pastel colour, rare = party hat + shine,
// epic = glow + top hat / wizard hat, legendary = gold + crown. 26 species.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const ANIMALS = ['Herring', 'Muskrat', 'Sparrow', 'Gecko', 'Pudu', 'Colobus', 'Taipan', 'Inkfish'];
// species index within a rarity → animal
export const SPECIES_ANIMAL = {
  common:    ['Muskrat', 'Sparrow', 'Gecko', 'Herring', 'Pudu', 'Colobus', 'Taipan', 'Inkfish'],
  uncommon:  ['Sparrow', 'Muskrat', 'Gecko', 'Pudu', 'Herring', 'Colobus'],
  rare:      ['Pudu', 'Colobus', 'Taipan', 'Gecko', 'Inkfish'],
  epic:      ['Inkfish', 'Taipan', 'Colobus', 'Sparrow'],
  legendary: ['Pudu', 'Inkfish', 'Colobus'],
};
const TINT = [0x9fe8ff, 0xffb4d8, 0xb8ffb0, 0xffe08a, 0xc9b6ff, 0x9ff5e0];
const GLOW = [0xb57bff, 0xff6fd8, 0x6f8cff, 0x2ee6c0];
const TRICKS = ['Bounce', 'Spin', 'Eat', 'Sit', 'Clicked', 'Idle_B', 'Idle_C', 'Jump', 'Roll'];
const SIZE = 1.0; // longest side after normalising (pens scale it ×1.5)

let models = null; // name → { scene, clips, size }
export const animalsReady = () => !!models;

export async function loadAnimals() {
  const loader = new GLTFLoader();
  const out = {};
  await Promise.all(ANIMALS.map(async (n) => {
    const g = await loader.loadAsync(`assets/animals/${n}_Animations.glb`);
    const box = new THREE.Box3().setFromObject(g.scene);
    const s = box.getSize(new THREE.Vector3());
    out[n] = { scene: g.scene, clips: Object.fromEntries(g.animations.map((c) => [c.name, c])), size: Math.max(s.x, s.y, s.z), height: s.y };
  }));
  models = out;
}

export function animalOf(sp) {
  const [r, i] = sp.split('-');
  return SPECIES_ANIMAL[r][+i % SPECIES_ANIMAL[r].length];
}

const sil = new THREE.MeshBasicMaterial({ color: 0x3a4a6a });
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
function part(geo, mat, x, y, z, sx, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; return m;
}
const G = { cone: new THREE.ConeGeometry(1, 1, 12), cyl: new THREE.CylinderGeometry(1, 1, 1, 14), sph: new THREE.SphereGeometry(1, 10, 8) };
function addHat(g, kind, top, silhouette) {
  const S = (m) => (silhouette ? sil : m);
  if (kind === 'party') {
    const h = part(G.cone, S(M(0xff8585)), 0.04, top + 0.13, 0, 0.11, 0.26, 0.11); h.rotation.z = -0.15; g.add(h);
    g.add(part(G.sph, S(M(0xffcf5e)), 0.07, top + 0.27, 0, 0.04));
  } else if (kind === 'topHat') {
    const k = S(M(0x22223a, { roughness: 0.3 }));
    g.add(part(G.cyl, k, 0, top + 0.01, 0, 0.2, 0.025, 0.2));
    g.add(part(G.cyl, k, 0, top + 0.13, 0, 0.12, 0.22, 0.12));
    g.add(part(G.cyl, S(M(0xff8585)), 0, top + 0.05, 0, 0.125, 0.04, 0.125));
  } else if (kind === 'wizard') {
    const k = S(M(0x4a2a8a));
    g.add(part(G.cyl, k, 0, top + 0.01, 0, 0.22, 0.02, 0.22));
    const h = part(G.cone, k, 0, top + 0.2, 0, 0.14, 0.36, 0.14); h.rotation.z = -0.2; g.add(h);
  } else if (kind === 'crown') {
    const gold = S(M(0xffd54a, { metalness: 0.6, roughness: 0.25, emissive: 0xffa000, emissiveIntensity: 0.3 }));
    g.add(part(G.cyl, gold, 0, top + 0.03, 0, 0.16, 0.08, 0.16));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(part(G.cone, gold, Math.sin(a) * 0.13, top + 0.12, Math.cos(a) * 0.13, 0.04, 0.1, 0.04));
    }
  }
}

// Builds an animal creature standing on y = 0, looking at +z. Same contract as
// creatures.js buildCreature: group.userData = { inner, sp, height, mixer, … }.
export function buildAnimal(sp, { silhouette = false } = {}) {
  const [rarity, idxS] = sp.split('-'); const idx = +idxS;
  const name = animalOf(sp), src = models[name];
  const g = new THREE.Group(), inner = new THREE.Group();
  g.add(inner);
  const body = cloneSkinned(src.scene);
  const grow = { common: 1, uncommon: 1.05, rare: 1.1, epic: 1.18, legendary: 1.28 }[rarity];
  const s = (SIZE / src.size) * grow;
  body.scale.setScalar(s);
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    if (silhouette) { o.material = sil; return; }
    const m = o.material.clone();
    if (rarity === 'uncommon') m.color.setHex(TINT[idx % TINT.length]);
    if (rarity === 'rare') { m.roughness = 0.3; m.metalness = 0.15; }
    if (rarity === 'epic') { m.emissive = new THREE.Color(GLOW[idx % GLOW.length]); m.emissiveIntensity = 0.45; }
    if (rarity === 'legendary') { m.color.setHex(0xffd54a); m.metalness = 0.65; m.roughness = 0.25; m.emissive = new THREE.Color(0xffa000); m.emissiveIntensity = 0.25; }
    o.material = m;
  });
  inner.add(body);
  const top = src.height * s;
  const hat = rarity === 'rare' ? 'party' : rarity === 'epic' ? (idx % 2 ? 'wizard' : 'topHat') : rarity === 'legendary' ? 'crown' : null;
  // the hat sits on the head: towards the front for long animals
  if (hat) {
    const hg = new THREE.Group();
    // hat parts are built around y = 0; the group sits on top of the head
    // (only the hat's size grows with the rarity, not its height)
    hg.position.set(0, top - 0.04, ['Herring', 'Gecko', 'Taipan'].includes(name) ? 0.18 : 0.08);
    addHat(hg, hat, 0, silhouette);
    hg.scale.setScalar(grow);
    inner.add(hg);
  }
  // the hat follows the head (or the body bone: most of these animals have no
  // head bone): remember where it sits in that bone's space
  let hatInfo = null;
  if (hat) {
    const hg = inner.children[inner.children.length - 1];
    const anchor = body.getObjectByName('head') || body.getObjectByName('body');
    if (anchor) {
      g.updateMatrixWorld(true);
      hatInfo = { hat: hg, anchor, offset: anchor.worldToLocal(hg.getWorldPosition(new THREE.Vector3())) };
    }
  }
  const mixer = new THREE.AnimationMixer(body);
  const actions = {};
  for (const [n, c] of Object.entries(src.clips)) actions[n] = mixer.clipAction(c);
  const idle = actions.Idle_A || Object.values(actions)[0];
  idle.play();
  g.userData = { inner, sp, animal: name, hatInfo, height: top + (hat ? 0.3 : 0), mixer, actions, current: idle,
    nextTrick: 2 + Math.random() * 5, phase: Math.random() * 10, look: { dance: rarity === 'legendary' ? 'spin' : 'hop' } };
  return g;
}

// Idle with a random trick every few seconds.
export function animateAnimal(g, t, dt, excited = 0) {
  const u = g.userData;
  u.nextTrick -= dt * (1 + excited);
  if (u.nextTrick <= 0) {
    const pool = TRICKS.filter((n) => u.actions[n]);
    const name = u.look.dance === 'spin' && Math.random() < 0.4 ? 'Spin' : pool[Math.floor(Math.random() * pool.length)];
    trick(g, name);
    u.nextTrick = 4 + Math.random() * 6;
  }
  if (u.backT !== undefined) {
    u.backT -= dt;
    if (u.backT <= 0) { const idle = u.actions.Idle_A; idle.reset().play(); u.current.crossFadeTo(idle, 0.25, false); u.current = idle; u.backT = undefined; }
  }
  u.mixer.update(dt);
  const h = u.hatInfo;
  if (h) {
    h.anchor.updateWorldMatrix(true, false);
    const w = h.anchor.localToWorld(h.offset.clone());
    u.inner.updateWorldMatrix(true, false);
    h.hat.position.copy(u.inner.worldToLocal(w));
  }
}
export function trick(g, name) {
  const u = g.userData, a = u.actions[name];
  if (!a || a === u.current) return;
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
  u.current.crossFadeTo(a, 0.2, false);
  u.current = a;
  u.backT = Math.max(0.6, a.getClip().duration - 0.2);
}
