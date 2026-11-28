// The 3D look of a room (side view), built from KayKit models (src/models.js,
// assets/models/README.md): Block Bits ground blocks, a Dungeon back wall with torches,
// banners and barrels, and one model per puzzle object. Players stand at z = 0; the ground
// is two blocks deep (z −1 … +1), the back wall stands behind it.
import * as THREE from 'three';
import { W, H } from './levels.js';
import { fit, unitGeometry } from './models.js';

export const TEAL = 0x2ee6c0, CORAL = 0xff8585, AMBER = 0xffcf5e;
export const BUTTON_W = 1.6, BUTTON_H = 0.3;   // the big floor button (game.js uses the same box)

// Per room: top block (has free space above), body block, sky colour.
const THEMES = [
  { top: 'dirt_with_grass', body: 'stone', sky: 0x1c2740 },
  { top: 'wood', body: 'bricks_B', sky: 0x241d2b },
  { top: 'bricks_A', body: 'stone_dark', sky: 0x17162e },
];
const WALLS = ['wall', 'wall', 'wall', 'wall_window_closed', 'wall_arched', 'wall_cracked'];

function rng(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function textTex(text, color, bg) {
  return canvasTex(128, 128, (g, w, h) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = color; g.font = '900 84px "Fredoka One", Nunito, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}

export function buildRoom(scene, room, world, models) {
  const theme = THEMES[room.theme % THEMES.length];
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };
  const rand = rng(room.id);
  const solid = (x, y) => x < 0 || x >= W || y < 0 || y >= H || room.grid[y][x] === '#';

  // ── ground blocks (instanced, two rows deep) ─────────────────────────────────────
  const tops = [], bodies = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (room.grid[y][x] !== '#') continue;
    (y + 1 < H && !solid(x, y + 1) ? tops : bodies).push([x, y]);
  }
  const m = new THREE.Matrix4();
  for (const [name, cells] of [[theme.top, tops], [theme.body, bodies]]) {
    if (!cells.length) continue;
    const { geometry, material } = models.mesh(name);
    const geo = keep(unitGeometry(geometry));
    const inst = new THREE.InstancedMesh(geo, material, cells.length * 2);
    let i = 0;
    for (const [x, y] of cells) for (const z of [-0.5, 0.5]) { m.makeTranslation(x + 0.5, y + 0.5, z); inst.setMatrixAt(i++, m); }
    inst.receiveShadow = true; inst.castShadow = true;
    group.add(inst);
  }

  // ── back wall (Dungeon pieces, 4 × 4) ────────────────────────────────────────────
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    const name = y < 2 ? 'wall' : WALLS[Math.floor(rand() * WALLS.length)];
    // 4.5 high on a 4 grid: each row covers the dark top edge of the row below it
    const w = fit(models.clone(name), 4, 4.5, 0.6);
    w.position.set(x + 2, y - 0.25, -1.3 + y * 0.004);
    group.add(w);
  }

  // ── bottomless gaps: a dark shaft fading into the depth ──────────────────────────
  const shaftTex = keep(canvasTex(8, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(10,10,22,0)'); gr.addColorStop(0.1, 'rgba(10,10,22,0.88)'); gr.addColorStop(0.3, 'rgba(6,6,14,1)'); gr.addColorStop(1, 'rgba(6,6,14,1)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));
  const shaftM = keep(new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false }));
  for (let x = 0; x < W; x++) {
    if (solid(x, 0)) continue;
    // the floor height of the solid columns on both edges of this gap (not just the neighbours:
    // a wide gap's middle columns have no solid neighbour)
    let top = 0;
    for (const d of [-1, 1]) {
      let nx = x;
      while (nx >= 0 && nx < W && !solid(nx, 0)) nx += d;
      for (let y = 0; y < H && solid(nx, y); y++) top = Math.max(top, y + 1);
    }
    const h = top + 2;   // from just above the floor line down to below the room
    for (const z of [-0.98, 0.99]) {      // in front of the back wall, and over the open front
      const p = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.02, h)), shaftM);
      p.position.set(x + 0.5, top - h / 2, z);
      p.renderOrder = 2;
      group.add(p);
    }
  }

  // ── ladders ───────────────────────────────────────────────────────────────────────
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (room.grid[y][x] !== 'H') continue;
    const l = fit(models.clone('ladder'), 0.75, 1.02, 0.15);
    l.position.set(x + 0.5, y - 0.01, -0.8);
    group.add(l);
  }

  // ── decoration: torches and banners on the wall, barrels and crates on the floor ──
  const busy = new Set();
  for (const o of room.objects) for (let dx = -2; dx <= 2; dx++) busy.add(Math.floor(o.x ?? o.x0) + dx);
  for (const k of ['climber', 'strong']) busy.add(Math.floor(room.spawn[k][0]));
  const floorAt = (x) => { for (let y = H - 2; y > 0; y--) if (solid(x, y) && !solid(x, y + 1) && !solid(x, y + 2) && !solid(x, y + 3)) return y + 1; return -1; };
  let lastTorch = -9;
  for (let x = 2; x < W - 2; x++) {
    const fy = floorAt(x);
    if (fy < 0 || room.grid[fy]?.[x] === 'H') continue;
    if (x - lastTorch >= 6 && rand() < 0.5) {
      const t = fit(models.clone('torch_mounted'), null, 0.9, null);
      t.position.set(x + 0.5, fy + 2.0, -0.95);
      group.add(t);
      const glow = new THREE.PointLight(0xffb060, 3, 4.5, 1.6);
      glow.position.set(x + 0.5, fy + 2.7, -0.5);
      group.add(glow);
      lastTorch = x;
      continue;
    }
    if (busy.has(x)) continue;
    const r = rand();
    if (r < 0.08) {
      const b = fit(models.clone(rand() < 0.5 ? 'banner_patternA_red' : 'banner_shield_blue'), null, 1.8, null);
      b.position.set(x + 0.5, fy + 1.2, -0.97);
      group.add(b);
    } else if (r < 0.16) {
      const b = fit(models.clone('barrel_large'), 0.7, null, null);
      b.position.set(x + 0.5, fy, -0.62);
      group.add(b);
      busy.add(x + 1);
    } else if (r < 0.2) {
      const b = fit(models.clone('crates_stacked'), 0.95, null, null);
      b.position.set(x + 0.5, fy, -0.55);
      group.add(b);
      busy.add(x + 1);
    }
  }

  // ── puzzle objects ─────────────────────────────────────────────────────────────────
  const views = new Map();
  for (const o of room.objects) {
    const v = objectView(o, models, keep, room);
    if (v) { group.add(v.node); views.set(o.id, v); }
  }

  return {
    group, views, theme,
    crateView() {
      const c = fit(models.clone('box_small'), 0.98, 0.98, 0.98);
      const holder = new THREE.Group();
      c.position.y = -0.49;
      holder.add(c);
      group.add(holder);
      return holder;    // positioned at the crate's centre
    },
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
}

// Tinted copies of a model's materials (portal off = grey, locked door = darker …).
function tint(obj, color, keep, extra = {}) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = keep(o.material.clone());
    o.material.color.multiply(new THREE.Color(color));
    Object.assign(o.material, extra);
  });
  return obj;
}
function findNode(obj, name) { let f = null; obj.traverse((o) => { if (!f && o.name === name) f = o; }); return f; }

// Each view: { node, update(state, dt) }; state is the game's object state.
function objectView(o, models, keep, room) {
  const node = new THREE.Group();
  let t = Math.random() * 6;
  const glowM = () => keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));

  switch (o.type) {
    case 'lever': case 'liftlever': case 'toggle': {
      const model = models.clone('lever_floor_base_yellow');
      const handle = findNode(model, 'lever_floor_yellow');
      node.add(fit(model, null, 1.0, null));
      node.position.set(o.x + 0.5, o.y, -0.35);
      let a = -0.7;
      return { node, update(s, dt) {
        a += ((s.on ? 0.7 : -0.7) - a) * Math.min(1, dt * 10);
        if (handle) handle.rotation.z = a;
      } };
    }
    case 'plate': {
      // the hold plate (level 4): a yellow floor button sunk flush with the floor; its cap
      // goes down while weight is on it and comes back up without
      const model = models.clone('button_base_yellow');
      const cap = findNode(model, 'button_yellow');
      node.add(fit(model, BUTTON_W, null, BUTTON_W));
      node.position.set(o.x + 0.5, o.y - 0.17, 0);
      return { node, update(s) { if (cap) cap.position.y = -0.2 * (s.press || 0); } };
    }
    case 'button': {
      // The big red floor button (Platformer button_base_red, ~0.3 high): the strong one's
      // weight presses its cap down slowly; when it is down it turns teal (game.js 'button').
      const model = models.clone('button_base_red');
      const cap = findNode(model, 'button_red');
      if (cap) cap.traverse((m) => { if (m.isMesh) m.material = keep(m.material.clone()); });
      node.add(fit(model, BUTTON_W, null, BUTTON_W));
      node.position.set(o.x + 0.5, o.y, 0);
      const teal = new THREE.Color(TEAL);
      return { node, update(s) {
        if (!cap) return;
        cap.position.y = -0.2 * (s.press || 0);            // model units: the cap sinks 0.2
        cap.traverse((m) => {
          if (!m.isMesh) return;
          m.material.emissive = s.on ? teal : new THREE.Color(0);
          m.material.emissiveIntensity = s.on ? 0.6 : 0;
        });
      } };
    }
    case 'switch': {
      const model = models.clone('lever_wall_base_A_blue');
      const handle = findNode(model, 'lever_wall_A_blue');
      node.add(fit(model, null, 0.75, null));
      node.position.set(o.x + 0.5, o.y + 0.25, -0.95);
      let a = 0;
      return { node, update(s, dt) {
        a += ((s.on ? Math.PI / 2 : 0) - a) * Math.min(1, dt * 10);
        if (handle) handle.rotation.z = a;
      } };
    }
    case 'post': {
      const sign = fit(models.clone('signage_arrow_stand_yellow'), null, 1.5, null);
      node.add(sign);
      node.position.set(o.x + 0.5, o.y, -0.4);
      node.rotation.y = -0.35;
      let turn = 0;
      return { node, update(s, dt) {    // the arrow swings round to the bridge once it is built
        turn += ((s.on ? Math.PI : 0) - turn) * Math.min(1, dt * 5);
        sign.rotation.y = turn;
      } };
    }
    case 'door': case 'locked': {
      // An iron double gate across the path (the two leaves of the KayKit arch gate, hinged
      // at the front and the back of the opening); both leaves swing open in walking
      // direction (+x), so they lie along the path when the door is open.
      node.position.set(o.x + 0.5, o.y, 0);
      const across = new THREE.Group();
      across.rotation.y = -Math.PI / 2;          // the gate's width now runs along z (depth)
      node.add(across);
      const half = 0.78;
      const leaves = [];
      for (const [part, side] of [['arch_gate_right', -1], ['arch_gate_left', 1]]) {
        const hinge = new THREE.Group();
        hinge.position.x = side * half;
        const leaf = models.part('arch_gate', part);      // hinge at its origin
        const holder = new THREE.Group();
        holder.add(leaf);
        holder.scale.set(half / 1.5, o.h / 3, 1.3);
        hinge.add(holder);
        across.add(hinge);
        leaves.push({ hinge, side });
      }
      let open = 0;
      return { node, update(s, dt) {
        open += ((s.open ? 1 : 0) - open) * Math.min(1, dt * 4);
        for (const l of leaves) l.hinge.rotation.y = -l.side * open * 1.5;
      } };
    }
    case 'crack': {
      // A cracked rock wall (Block Bits stone with copper seams); the strong one punches it:
      // the blocks burst away from the fist and a rubble pile stays.
      node.position.set(o.x + 0.5, o.y, 0);
      const { geometry, material } = models.mesh('stone_with_copper');
      const geo = keep(unitGeometry(geometry));
      const pieces = [];
      for (let i = 0; i < o.h; i++) for (const z of [-0.5, 0.5]) {
        const m = new THREE.Mesh(geo, material);
        m.castShadow = true; m.receiveShadow = true;
        m.position.set(0, i + 0.5, z);
        node.add(m);
        pieces.push({ m, v: new THREE.Vector3(), spin: new THREE.Vector3() });
      }
      const rubble = fit(models.clone('rubble_large'), 1.5, null, 1.6);
      rubble.position.set(0, 0, -0.1);
      rubble.visible = false;
      node.add(rubble);
      let since = -1;
      return { node, update(s, dt) {
        if (s.open && since < 0) {
          since = 0;
          const dir = s.brokeFrom || 1;
          pieces.forEach((p, i) => {
            p.v.set(dir * (2.5 + Math.random() * 3), 3 + Math.random() * 4 - i * 0.3, (Math.random() - 0.5) * 3);
            p.spin.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4);
          });
          rubble.visible = true;
        }
        if (since < 0) return;
        since += dt;
        for (const p of pieces) {
          if (!p.m.visible) continue;
          p.v.y -= 22 * dt;
          p.m.position.addScaledVector(p.v, dt);
          p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt; p.m.rotation.z += p.spin.z * dt;
          p.m.scale.setScalar(Math.max(0.01, 1 - since * 0.8));
          if (since > 1.2) p.m.visible = false;
        }
        rubble.scale.setScalar(Math.min(1, since * 4));
      } };
    }
    case 'bridge': {
      const ghostM = keep(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.25, depthWrite: false }));
      const planks = [];
      for (let x = o.x0; x <= o.x1; x++) {
        const real = fit(models.clone('floor_wood_1x1'), 1.0, 0.5, 2.0);
        real.position.set(x + 0.5, o.y + 0.5, 0);
        const ghost = new THREE.Mesh(keep(new THREE.BoxGeometry(0.96, 0.4, 1.9)), ghostM);
        ghost.position.set(x + 0.5, o.y + 0.75, 0);
        node.add(real, ghost);
        planks.push({ real, ghost });
      }
      let grow = 0;
      return { node, update(s, dt) {
        if (s.on) grow = Math.min(1, grow + dt * 2.2);
        planks.forEach((p, i) => {
          const k = Math.max(0, Math.min(1, grow * planks.length - i));
          p.real.visible = s.on && k > 0;
          p.real.scale.set(1, 1, Math.max(0.01, k));
          p.ghost.visible = !(s.on && k > 0);
        });
      } };
    }
    case 'key': {
      // Floats until collected; then it flies in an arc to its locked door (KEY_FLIGHT in
      // game.js), spinning, and disappears into the lock as the door opens.
      node.position.set(o.x + 0.5, o.y + 0.35, 0.1);
      // gold and glowing, so it stands out against the grey walls (and in flight)
      const k = tint(fit(models.clone('key'), 0.75, null, null), 0xffd877, keep, { emissive: new THREE.Color(AMBER), emissiveIntensity: 0.35 });
      const glowTex = keep(canvasTex(64, 64, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, 'rgba(255,220,120,0.9)'); gr.addColorStop(1, 'rgba(255,207,94,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }));
      const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false })));
      glow.scale.set(1.1, 1.1, 1);
      glow.position.y = 0.1;
      const spin = new THREE.Group(); spin.add(glow, k); node.add(spin);
      const door = room.objects.find((d) => d.id === o.opens);
      const to = door ? new THREE.Vector3(door.x + 0.5 - node.position.x, door.y + door.h / 2 - node.position.y, 0.6)
        : new THREE.Vector3();
      let fly = -1;
      return { node, update(s, dt) {
        t += dt;
        if (s.taken && fly < 0) fly = 0;
        if (fly < 0) {
          spin.rotation.y = t * 1.6;
          spin.position.y = Math.sin(t * 2.4) * 0.08;
          return;
        }
        fly = Math.min(1, fly + dt / 1.3);
        const e = fly * fly * (3 - 2 * fly);                 // ease in-out
        spin.position.set(to.x * e, to.y * e + Math.sin(Math.PI * e) * 2.5, to.z * e);
        spin.rotation.y += dt * 14;
        spin.scale.setScalar(fly > 0.85 ? Math.max(0.01, (1 - fly) / 0.15) : 1 + Math.sin(Math.PI * e) * 0.4);
        spin.visible = fly < 1;
      } };
    }
    case 'portal': {
      node.position.set(o.x + 0.5, o.y, -0.35);
      const on = fit(models.clone('hoop_yellow'), null, 2.35, null);
      const off = tint(fit(models.clone('hoop_yellow'), null, 2.35, null), 0x6f7488, keep);
      node.add(on, off);
      const box = new THREE.Box3().setFromObject(on);
      const r = (box.max.x - box.min.x) / 2;
      const discM = glowM();
      const disc = new THREE.Mesh(keep(new THREE.CircleGeometry(r * 0.82, 32)), discM);
      disc.position.set(0, box.max.y - r, 0);
      node.add(disc);
      const swirlM = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      const swirl = new THREE.Mesh(keep(new THREE.RingGeometry(r * 0.25, r * 0.7, 24, 1, 0, Math.PI * 1.2)), swirlM);
      swirl.position.set(0, box.max.y - r, 0.02);
      node.add(swirl);
      return { node, update(s, dt) {
        t += dt;
        on.visible = !!s.active; off.visible = !s.active;
        discM.opacity = s.active ? 0.45 + Math.sin(t * 3) * 0.1 : 0;
        swirlM.opacity = s.active ? 0.5 : 0;
        swirl.rotation.z = -t * 3;
      } };
    }
    case 'lift': {
      // A wooden platform (two Platformer floor_wood pieces) on four chains, one at each
      // corner, up to the ceiling. The chains are single links (Platformer chain_link),
      // alternately turned, never stretched: links come and go as the lift moves.
      const plat = new THREE.Group();
      for (let i = 0; i < o.w; i++) {
        const piece = fit(models.clone('floor_wood_1x1'), 1.0, 0.5, 2.0);
        piece.position.set(i + 0.5, 0, 0);
        plat.add(piece);
      }
      node.add(plat);
      const { geometry, material } = models.mesh('chain_link');
      const geo = keep(geometry.clone());
      geo.computeBoundingBox();
      const lh = geo.boundingBox.max.y - geo.boundingBox.min.y;     // one link, model units
      const S = 0.2;                                                 // link scale
      const pitch = lh * S * 0.72;                                   // interlocking links
      const corners = [[0.12, 0.88], [0.12, -0.88], [o.w - 0.12, 0.88], [o.w - 0.12, -0.88]];
      const perChain = Math.ceil((H + 1) / pitch);
      const links = new THREE.InstancedMesh(geo, material, corners.length * perChain);
      links.castShadow = true;
      node.add(links);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
      const sc = new THREE.Vector3(S, S, S), pos = new THREE.Vector3(), none = new THREE.Quaternion();
      node.position.set(o.x, (o.start === 'up' ? o.y1 : o.y0) - 0.5, 0);
      let lastTop = null;
      return { node, update(s) {
        node.position.y = s.top - 0.5;
        if (lastTop === s.top) return;
        lastTop = s.top;
        // from the platform (local y 0.5) up to the ceiling (world y H − 1)
        const n = Math.max(0, Math.floor(((H - 1) - s.top) / pitch));
        let i = 0;
        for (const [cx, cz] of corners) {
          for (let k = 0; k < n; k++) {
            pos.set(cx, 0.5 + (k + 0.5) * pitch, cz);
            q.copy(k % 2 ? turn : none);
            m4.compose(pos, q, sc);
            links.setMatrixAt(i++, m4);
          }
        }
        links.count = i;
        links.instanceMatrix.needsUpdate = true;
      } };
    }
    case 'cage': {
      node.position.set(o.x + 0.5, o.y + 1, 0);
      const chain = fit(models.clone('chain_full'), null, 2.2, null);
      node.add(chain);
      let up = 0;
      return { node, update(s, dt) {     // the chain pulls up once the crate is let go
        if (s.on) up = Math.min(1.2, up + dt * 2);
        chain.position.y = up;
      } };
    }
    case 'exit': {
      node.position.set(o.x, o.y, -0.7);
      const arch = models.clone('arch_gate');
      const left = findNode(arch, 'arch_gate_left'), right = findNode(arch, 'arch_gate_right');
      node.add(fit(arch, 2.5, null, null));
      const lightM = glowM();
      const light = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.5, 1.9)), lightM);
      light.position.set(0, 0.95, -0.12);
      node.add(light);
      let open = 0;
      return { node, update(s, dt) {
        t += dt;
        if (s.open) open = Math.min(1, open + dt * 1.5);
        if (left) left.rotation.y = open * 1.7;
        if (right) right.rotation.y = -open * 1.7;
        lightM.opacity = open * (0.45 + Math.sin(t * 3) * 0.1);
      } };
    }
  }
  return null;
}

/** "?" marker sprite for objects still waiting for an answer. */
export function questionMarker(keep = (x) => x) {
  const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(textTex('?', '#1e2433', '#ffcf5e')), depthWrite: false, depthTest: false })));
  s.scale.set(0.55, 0.55, 1);
  s.renderOrder = 10;
  return s;
}
