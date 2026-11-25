// The creature collection (assets/creatures/creatures.json, built by
// tools/creatures/build.cjs): 60 creatures, each with its own zone and rarity.
// A creature id is the roster id ('fox'); the golden bonus version is the id with
// a trailing '*' ('fox*'): it earns more and has its own mark in the Book.
// Models are loaded only when a creature is first shown (pens, hatching), then
// cached; the Book and the banners use the small icons.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { RARITIES } from './balance.js';
import { lang } from './i18n.js';

const BASE = 'assets/creatures/';
const data = await fetch(`${BASE}creatures.json`).then((r) => r.json()).catch(() => ({ creatures: [] }));

export const ROSTER = data.creatures
  .slice()
  .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
export const BY_ID = Object.fromEntries(ROSTER.map((c) => [c.id, c]));

export const isGolden = (sp) => typeof sp === 'string' && sp.endsWith('*');
export const baseId = (sp) => (isGolden(sp) ? sp.slice(0, -1) : sp);
export const entry = (sp) => BY_ID[baseId(sp)] || null;
export const isRosterId = (sp) => !!entry(sp);

export const rosterRarity = (sp) => entry(sp)?.rarity || 'common';
export const creaturesOf = (zone, rarity) => ROSTER.filter((c) => c.zone === zone && (!rarity || c.rarity === rarity));

// The name in the player's language; golden versions get sparkles around it.
export function rosterName(sp) {
  const c = entry(sp);
  if (!c) return '???';
  const n = c.name[lang] || c.name.en;
  return isGolden(sp) ? `✨ ${n} ✨` : n;
}
export const iconUrl = (sp, silhouette = false) => {
  const c = entry(sp);
  return c ? BASE + (silhouette ? c.silhouette : c.icon) : '';
};

// ── models ──
const loader = new GLTFLoader();
const cache = new Map(); // id → Promise<{ scene, clips }>
function load(id) {
  if (!cache.has(id)) {
    const c = BY_ID[id];
    cache.set(id, loader.loadAsync(BASE + c.file).then((g) => {
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.frustumCulled = false;
        for (const m of [].concat(o.material)) { if ('metalness' in m) m.metalness = 0; }
      });
      return { scene: g.scene, clips: Object.fromEntries(g.animations.map((a) => [a.name, a])) };
    }));
  }
  return cache.get(id);
}
// Load a few models ahead (e.g. a zone's creatures when an egg is picked up there).
export function preload(ids) { for (const id of ids) if (BY_ID[id]) load(id).catch(() => {}); }

const GOLD = new THREE.Color(0xffc93c);
// A creature group at its real size (manifest `scale` = height in metres), standing on
// y = 0, looking at +z. The model arrives a moment later if it is not cached yet.
export function buildRosterCreature(sp) {
  const c = entry(sp), golden = isGolden(sp);
  const g = new THREE.Group(), inner = new THREE.Group();
  g.add(inner);
  const h = c.scale, lift = c.hover || 0;
  g.userData = { inner, sp, real: true, height: h + lift, look: { dance: 'hop' }, phase: Math.random() * 10,
    nextTrick: 2 + Math.random() * 5, lift, move: c.move };
  load(c.id).then(({ scene, clips }) => {
    const body = cloneSkinned(scene);
    body.scale.setScalar(h / (c.size[1] || 1));
    if (golden) body.traverse((o) => {
      if (!o.isMesh) return;
      o.material = [].concat(o.material).map((m) => {
        const k = m.clone();
        if (k.color) k.color.lerp(GOLD, 0.65);
        if ('metalness' in k) { k.metalness = 0.45; k.roughness = 0.3; }
        if (k.emissive) { k.emissive.copy(GOLD); k.emissiveIntensity = 0.25; }
        return k;
      });
      if (o.material.length === 1) o.material = o.material[0];
    });
    inner.add(body);
    const mixer = new THREE.AnimationMixer(body), actions = {};
    for (const [std, name] of Object.entries(c.clips)) if (clips[name]) actions[std] = mixer.clipAction(clips[name]);
    const idle = actions.idle || Object.values(actions)[0];
    if (idle) idle.play(); // (always play a clip: some models stand on their nose in the bind pose)
    Object.assign(g.userData, { mixer, actions, current: idle });
    mixer.update(Math.random() * 2);
  }).catch(() => { /* a missing model: the pen stays empty-looking but the game goes on */ });
  return g;
}

// Idle, now and then a trick (jump, eat, fun); swimmers and flyers bob in the air.
export function animateRoster(g, t, dt, excited = 0) {
  const u = g.userData;
  if (u.lift) u.inner.position.y = u.lift + Math.sin(t * 1.6 + u.phase) * 0.12;
  if (!u.mixer) return;
  u.nextTrick -= dt * (1 + excited);
  if (u.nextTrick <= 0) {
    u.nextTrick = 4 + Math.random() * 6;
    const pool = ['jump', 'eat', 'fun'].filter((n) => u.actions[n]);
    if (pool.length) rosterTrick(g, pool[Math.floor(Math.random() * pool.length)]);
  }
  if (u.backT !== undefined) {
    u.backT -= dt;
    if (u.backT <= 0 && u.actions.idle) {
      const idle = u.actions.idle; idle.reset().play(); u.current.crossFadeTo(idle, 0.25, false); u.current = idle; u.backT = undefined;
    }
  }
  u.mixer.update(dt);
}
export function rosterTrick(g, name) {
  const u = g.userData, a = u.actions && (u.actions[name] || u.actions.jump || u.actions.fun);
  if (!a || a === u.current) return;
  a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
  if (u.current) u.current.crossFadeTo(a, 0.2, false);
  u.current = a;
  u.backT = Math.max(0.6, a.getClip().duration - 0.2);
}
