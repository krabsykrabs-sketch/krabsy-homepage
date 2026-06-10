// Dynamic farm geometry + actions: the tillable field, crops by stage, trees,
// wild berries. All mutations go through the action functions, which return
// {ok, reason} so game.js (and the QA harness) can assert outcomes. The school
// gate is enforced one level up in game.js — this module is pure farm logic.

import * as THREE from 'three';
import { LAYOUT, CROPS, TREE_REGROW_DAYS } from './config.js';
import { makeDotTexture } from './world.js';

const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
const MAT = {
  soilDry: lambert(0x9a6b42),
  soilWet: lambert(0x5e3f26),
  grassPatch: lambert(0x7fbf5c),
  trunk: lambert(0x7a5230),
  stump: lambert(0x8a6240),
  leaf: lambert(0x3f8f33),
  leaf2: lambert(0x55a844),
  berry: lambert(0xe03a4e),
  stem: lambert(0x4f9b3a),
};

export function createFarm(scene, state) {
  const { cols, rows, gap, cx, cz } = LAYOUT.field;

  const plotCenter = (i) => ({
    x: cx + ((i % cols) - (cols - 1) / 2) * gap,
    z: cz + (Math.floor(i / cols) - (rows - 1) / 2) * gap,
  });

  // ── Plot meshes: one group per tile, rebuilt from state on change ─────
  const plotGroups = state.plots.map((_, i) => {
    const g = new THREE.Group();
    const { x, z } = plotCenter(i);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  });

  // Sparkle points hovering over ready crops.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(state.plots.length * 3 * 3);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkles = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xfff3a0, size: 0.34, map: makeDotTexture(), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(sparkles);

  function cropMesh(type, stage) {
    const def = CROPS[type];
    const g = new THREE.Group();
    const t = Math.min(1, stage / def.days);          // 0..1 growth
    const ready = stage >= def.days;
    if (stage === 0) {
      // seeded: a little mound with a speck
      const mound = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), MAT.soilDry);
      mound.position.y = 0.1; mound.scale.y = 0.5; g.add(mound);
      const speck = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), lambert(0xf5e9c8));
      speck.position.y = 0.18; g.add(speck);
      return g;
    }
    // sprout stem for every crop
    const stemH = 0.25 + t * 0.45;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, stemH, 6), MAT.stem);
    stem.position.y = stemH / 2 + 0.06; g.add(stem);
    // leaves
    for (const a of [0.5, 2.6, 4.4]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1 + t * 0.1, 6, 5), MAT.leaf2);
      leaf.scale.set(1.6, 0.5, 0.8);
      leaf.position.set(Math.cos(a) * 0.18, stemH * 0.55, Math.sin(a) * 0.18);
      leaf.rotation.y = -a;
      g.add(leaf);
    }
    if (t > 0.5) {
      // the fruit/body appears in the second half of growth; shape comes
      // from the crop definition so new catalogue entries need no code
      const shape = def.shape ?? 'ball';
      const size = 0.12 + (t - 0.5) * (shape === 'ground' ? 0.9 : 0.5);
      const col = ready ? def.ripe : def.color;
      let fruit;
      if (shape === 'gem') {
        fruit = new THREE.Mesh(new THREE.OctahedronGeometry(size), lambert(col));
        fruit.position.y = stemH + size * 0.8;
      } else if (shape === 'cluster') {
        fruit = new THREE.Group();
        for (const a of [0, 2.1, 4.2]) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 8, 6), lambert(col));
          ball.position.set(Math.cos(a) * 0.16, stemH * (0.5 + 0.2 * Math.sin(a)), Math.sin(a) * 0.16);
          fruit.add(ball);
        }
      } else if (shape === 'tall') {
        // sunflower-style: head on top of an extra-tall stem
        fruit = new THREE.Group();
        const extra = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6), MAT.stem);
        extra.position.y = stemH + 0.25; fruit.add(extra);
        const head = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), lambert(col));
        head.scale.z = 0.45; head.position.y = stemH + 0.5 + size * 0.4; fruit.add(head);
        const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.45, 8, 6), lambert(0x7a5230));
        core.scale.z = 0.5; core.position.set(0, stemH + 0.5 + size * 0.4, size * 0.35); fruit.add(core);
      } else if (shape === 'ground') {
        fruit = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), lambert(col));
        fruit.scale.y = 0.75;
        fruit.position.y = size * 0.6;
      } else {
        fruit = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), lambert(col));
        fruit.scale.y = 0.9;
        fruit.position.y = stemH + size * 0.6;
      }
      fruit.castShadow = true;
      g.add(fruit);
    }
    return g;
  }

  function refreshPlot(i) {
    const g = plotGroups[i];
    const p = state.plots[i];
    g.clear();
    if (!p.tilled) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), MAT.grassPatch);
      patch.rotation.x = -Math.PI / 2; patch.position.y = 0.015;
      g.add(patch);
      return;
    }
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.4), p.watered ? MAT.soilWet : MAT.soilDry);
    soil.position.y = 0.07; soil.receiveShadow = true;
    g.add(soil);
    if (p.crop) {
      const cm = cropMesh(p.crop, p.stage);
      cm.position.y = 0.14;
      cm.userData.isCrop = true;
      g.add(cm);
    }
  }

  function refreshAll() { state.plots.forEach((_, i) => refreshPlot(i)); refreshTrees(); refreshBerries(); refreshHay(); }

  // ── Trees ─────────────────────────────────────────────────────────────
  const treeGroups = LAYOUT.trees.map((t) => {
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    scene.add(g);
    return g;
  });

  function refreshTrees() {
    state.trees.forEach((t, i) => {
      const g = treeGroups[i];
      g.clear();
      if (t.chopped) {
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 10), MAT.stump);
        stump.position.y = 0.25; stump.castShadow = true; g.add(stump);
        return;
      }
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 8), MAT.trunk);
      trunk.position.y = 1.1; trunk.castShadow = true; g.add(trunk);
      const blobs = [[0, 2.8, 0, 1.25], [0.7, 2.3, 0.3, 0.8], [-0.6, 2.4, -0.2, 0.85]];
      for (const [x, y, z, r] of blobs) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), MAT.leaf);
        leaf.position.set(x, y, z); leaf.castShadow = true; g.add(leaf);
      }
    });
  }

  // ── Hay meadow ────────────────────────────────────────────────────────
  const hayCenter = (i) => ({
    x: LAYOUT.hay.cx + ((i % LAYOUT.hay.cols) - (LAYOUT.hay.cols - 1) / 2) * LAYOUT.hay.gap,
    z: LAYOUT.hay.cz + (Math.floor(i / LAYOUT.hay.cols) - (LAYOUT.hay.rows - 1) / 2) * LAYOUT.hay.gap,
  });
  const hayGroups = state.hay.map((_, i) => {
    const g = new THREE.Group();
    const { x, z } = hayCenter(i);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  });

  function refreshHayTile(i) {
    const g = hayGroups[i];
    const h = state.hay[i];
    g.clear();
    // base patch: wet stubble shows dark soil
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25),
      h.cut && h.watered ? MAT.soilWet : lambert(0xa8b860));
    patch.rotation.x = -Math.PI / 2; patch.position.y = 0.02;
    g.add(patch);
    if (!h.cut) {
      // tall hay: a few golden blades, deterministic per tile
      for (let b = 0; b < 5; b++) {
        const a = (i * 2.39996 + b * 1.3) % (Math.PI * 2);
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.95 + (b % 3) * 0.18, 5), lambert(b % 2 ? 0xd8c25e : 0xc8b04e));
        blade.position.set(Math.cos(a) * 0.38, 0.5, Math.sin(a) * 0.38);
        blade.rotation.z = Math.cos(a) * 0.15;
        g.add(blade);
      }
    } else {
      // stubble
      for (let b = 0; b < 3; b++) {
        const a = (i * 2.39996 + b * 2.1) % (Math.PI * 2);
        const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 5), lambert(0xb8a04e));
        stub.position.set(Math.cos(a) * 0.3, 0.08, Math.sin(a) * 0.3);
        g.add(stub);
      }
    }
  }
  function refreshHay() { state.hay.forEach((_, i) => refreshHayTile(i)); }

  function nearestHay(pos, range) {
    let best = -1, bd = range;
    state.hay.forEach((_, i) => {
      const { x, z } = hayCenter(i);
      const d = Math.hypot(pos.x - x, pos.z - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ── Berries ───────────────────────────────────────────────────────────
  let berryGroups = [];
  function refreshBerries() {
    for (const g of berryGroups) scene.remove(g);
    berryGroups = state.berries.map((b) => {
      const g = new THREE.Group();
      if (!b.taken) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), MAT.leaf2);
        bush.position.y = 0.26; bush.scale.y = 0.75; g.add(bush);
        for (const [dx, dy, dz] of [[0.12, 0.4, 0.12], [-0.15, 0.35, 0], [0.02, 0.3, -0.16]]) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), MAT.berry);
          ball.position.set(dx, dy, dz); g.add(ball);
        }
      }
      g.position.set(b.x, 0, b.z);
      scene.add(g);
      return g;
    });
  }

  // ── Queries used for interaction targeting ────────────────────────────
  function nearestPlot(pos, range) {
    let best = -1, bd = range;
    state.plots.forEach((_, i) => {
      const { x, z } = plotCenter(i);
      const d = Math.hypot(pos.x - x, pos.z - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function nearestTree(pos, range) {
    let best = -1, bd = range;
    LAYOUT.trees.forEach((t, i) => {
      if (state.trees[i].chopped) return;
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function nearestBerry(pos, range) {
    let best = -1, bd = range;
    state.berries.forEach((b, i) => {
      if (b.taken) return;
      const d = Math.hypot(pos.x - b.x, pos.z - b.z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ── Actions (no gate here — game.js gates) ────────────────────────────
  const actions = {
    till(i) {
      const p = state.plots[i];
      if (!p || p.tilled) return { ok: false, reason: 'already-tilled' };
      p.tilled = true; refreshPlot(i);
      return { ok: true };
    },
    plant(i, type) {
      const p = state.plots[i];
      if (!p || !p.tilled) return { ok: false, reason: 'not-tilled' };
      if (p.crop) return { ok: false, reason: 'occupied' };
      if (!CROPS[type]) return { ok: false, reason: 'unknown-crop' };
      if ((state.seeds[type] ?? 0) < 1) return { ok: false, reason: 'no-seeds' };
      state.seeds[type] -= 1;
      p.crop = type; p.stage = 0; p.watered = false;
      refreshPlot(i);
      return { ok: true };
    },
    water(i) {
      const p = state.plots[i];
      if (!p || !p.tilled) return { ok: false, reason: 'not-tilled' };
      if (p.watered) return { ok: false, reason: 'already-watered' };
      p.watered = true; refreshPlot(i);
      return { ok: true };
    },
    harvest(i) {
      const p = state.plots[i];
      if (!p || !p.crop) return { ok: false, reason: 'no-crop' };
      const def = CROPS[p.crop];
      if (p.stage < def.days) return { ok: false, reason: 'not-ready' };
      const type = p.crop;
      state.inventory[type] = (state.inventory[type] ?? 0) + 1;
      p.crop = null; p.stage = 0; p.watered = false;
      refreshPlot(i);
      return { ok: true, type };
    },
    chop(i) {
      const t = state.trees[i];
      if (!t || t.chopped) return { ok: false, reason: 'no-tree' };
      if (!state.tools.axe) return { ok: false, reason: 'no-axe' };
      t.chopped = true; t.regrowDay = state.day + TREE_REGROW_DAYS;
      state.inventory.wood = (state.inventory.wood ?? 0) + 3;
      refreshTrees();
      return { ok: true, wood: 3 };
    },
    cutHay(i) {
      const h = state.hay[i];
      if (!h || h.cut) return { ok: false, reason: 'no-hay' };
      h.cut = true;
      state.inventory.hay = (state.inventory.hay ?? 0) + 1;
      refreshHayTile(i);
      return { ok: true };
    },
    waterHay(i) {
      const h = state.hay[i];
      if (!h || !h.cut) return { ok: false, reason: 'not-cut' };
      if (h.watered) return { ok: false, reason: 'already-watered' };
      h.watered = true;
      refreshHayTile(i);
      return { ok: true };
    },
    pickBerry(i) {
      const b = state.berries[i];
      if (!b || b.taken) return { ok: false, reason: 'no-berry' };
      b.taken = true;
      state.inventory.berry = (state.inventory.berry ?? 0) + 1;
      refreshBerries();
      return { ok: true };
    },
  };

  // ── Per-frame: bob ready crops + drive sparkles ───────────────────────
  function update(clock) {
    let s = 0;
    const arr = sparkGeo.attributes.position.array;
    state.plots.forEach((p, i) => {
      if (!p.crop) return;
      const def = CROPS[p.crop];
      if (p.stage < def.days) return;
      const g = plotGroups[i];
      const crop = g.children.find((c) => c.userData.isCrop);
      if (crop) crop.position.y = 0.14 + Math.abs(Math.sin(clock * 2.4 + i)) * 0.1;
      const { x, z } = plotCenter(i);
      for (let j = 0; j < 3; j++) {
        const ph = clock * 1.6 + i + j * 2.1;
        arr[s * 3] = x + Math.sin(ph) * 0.4;
        arr[s * 3 + 1] = 1.0 + Math.sin(ph * 1.7) * 0.25;
        arr[s * 3 + 2] = z + Math.cos(ph * 0.9) * 0.4;
        s++;
      }
    });
    sparkGeo.setDrawRange(0, s);
    sparkGeo.attributes.position.needsUpdate = true;
  }

  refreshAll();
  return { plotCenter, hayCenter, nearestPlot, nearestTree, nearestBerry, nearestHay, actions, refreshAll, update };
}
