// Both players' figures (docs/game-contract.md "The player's figure", "Hero choice").
// Player 1: 'mine' = the child's own figure via loadPlayerFigure (the Schülerin when they
// never picked one), or one of the free figures. Player 2: one of the free figures
// (FREE_CHARS), never saved as anybody's figure. Abilities come from the role, not the
// figure: the role only sets the size (climber small, strong one big).
// On file:// or a server without /lib + /assets/figures a simple built figure is used.
import * as THREE from 'three';

const FIGURE_MODULE = '/lib/krabsy-figure.js';
export const DEFAULT_FIGURE = 'Protagonist_A';
const FIG_HEIGHT = 2.2;      // KayKit figures: feet at 0, top of the head ~2.2 (hats don't count)
const FALLBACK_FREE = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch', 'Helper_A', 'Helper_B',
  'Knight', 'Rogue', 'Druid', 'OrcRaider', 'Skeleton_Minion', 'Robot_One'];

let modP = null;
export function figureModule() {
  if (!modP) {
    modP = (location.protocol.startsWith('http') ? import(FIGURE_MODULE) : Promise.reject(new Error('no http')))
      .catch((e) => { console.info('[duo] no figure module, built figures', e?.message || e); return null; });
  }
  return modP;
}

/** For the title screen: { mine: { char, own } | null, free: [ids], portrait(id), name(id, lang) }. */
export async function figureChoices() {
  const mod = await figureModule();
  if (!mod) return { mine: null, free: FALLBACK_FREE, portrait: () => null, name: (id) => id.replace(/_/g, ' '), available: false };
  let itemName = null;
  try { ({ itemName } = await import('/lib/krabsy-figure-catalog.js')); } catch (_) { /* names stay ids */ }
  let mine = { char: DEFAULT_FIGURE, own: false };
  try { const cfg = mod.playerConfig(); if (cfg) mine = { char: cfg.char, own: true }; } catch (_) { /* default */ }
  const base = mod.ASSET_BASE || '/assets/figures/';
  return { mine, free: mod.FREE_CHARS || FALLBACK_FREE, portrait: (id) => `${base}portraits/${id}.webp`,
    name: (id, lang) => (itemName ? itemName('char', id, lang) : id), available: true };
}

// State → clip (Rig_Medium shared clips).
const CLIPS = {
  idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', jump: 'Jump_Idle', climb: 'Walking_B',
  push: 'Walking_C', answer: 'Interact', smash: 'Throw', cheer: 'Spawn_Ground',
};

function builtFigure(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf2c9a5 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 4, 12), mat);
  body.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin);
  head.position.y = 0.98;
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1e2433 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), eyeM);
    e.position.set(s * 0.09, 1.0, 0.23); g.add(e);
  }
  g.add(body, head);
  return { root: g, clips: {}, own: false, dispose() { g.traverse((o) => { o.geometry?.dispose(); }); mat.dispose(); skin.dispose(); } };
}

/**
 * choice: 'mine' | a figure id. role: 'climber' | 'strong'. color: fallback colour.
 * → { root (Group to position), setState(name), update(dt), dispose(), char, own, built }
 */
export async function makeFigure(choice, look, color) {
  const mod = await figureModule();
  let fig = null, char = null, built = false;
  if (mod) {
    try {
      if (choice === 'mine') {
        fig = await mod.loadPlayerFigure({ fallback: DEFAULT_FIGURE, lambert: true });
        char = fig.config?.char || DEFAULT_FIGURE;
      } else {
        const [f, clips] = await Promise.all([
          mod.buildFigure(mod.normalize({ char: choice }), { lambert: true }),
          mod.loadClips(),
        ]);
        fig = { root: f.root, clips, own: false, dispose: f.dispose };
        char = choice;
      }
    } catch (e) { console.warn('[duo] figure failed, using a built one', e); fig = null; }
  }
  if (!fig) { fig = builtFigure(color); built = true; char = null; }

  const holder = new THREE.Group();
  const inner = new THREE.Group();          // turns to face left/right
  inner.add(fig.root);
  holder.add(inner);
  fig.root.scale.setScalar(look / (built ? 1.24 : FIG_HEIGHT));   // the stand-in is 1.24 tall
  fig.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });

  const mixer = new THREE.AnimationMixer(fig.root);
  const actions = {};
  for (const [state, clip] of Object.entries(CLIPS)) {
    const c = fig.clips?.[clip];
    if (c) actions[state] = mixer.clipAction(c);
  }
  let cur = null, curName = null, t = 0;
  function setState(name) {
    if (name === curName) return;
    const next = actions[name] || actions.idle || null;
    curName = name;
    if (next === cur) return;
    if (next) {
      next.reset();
      next.setEffectiveWeight(1);
      if (cur) next.crossFadeFrom(cur, 0.12, false);
      next.play();
    }
    cur = next;
  }
  let yaw = Math.PI / 2, targetYaw = Math.PI / 2;
  function face(dir, back = false, front = false) {
    targetYaw = front ? 0 : back ? Math.PI : (dir >= 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  function update(dt) {
    mixer.update(dt);
    t += dt;
    let d = targetYaw - yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    yaw += d * Math.min(1, dt * 14);
    inner.rotation.y = yaw;
    if (built) {   // the built figure bobs instead of animating
      const moving = curName === 'walk' || curName === 'run' || curName === 'push' || curName === 'climb';
      fig.root.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : 0;
    }
  }
  setState('idle');
  return {
    root: holder, setState, face, update, char, own: !!fig.own, built,
    dispose() { mixer.stopAllAction(); holder.parent?.remove(holder); try { fig.dispose?.(); } catch (_) { /* ignore */ } },
  };
}
