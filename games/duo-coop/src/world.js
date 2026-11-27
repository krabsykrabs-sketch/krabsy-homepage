// The 3D look of a room (side view): tiles, back wall, ladders and every puzzle object.
// Everything is built from primitives with canvas textures: no model files, so the room
// costs nothing to load. Players stand at z = 0; tiles reach from z −1.2 to +1.2.
import * as THREE from 'three';
import { W, H } from './levels.js';

const DEPTH = 2.4;
export const TEAL = 0x2ee6c0, CORAL = 0xff8585, AMBER = 0xffcf5e;

const THEMES = [
  { side: 0x5b6f8f, top: 0x7fd6b5, wall: '#2b3a55', brick: '#33456a', sky: 0x1c2740, accent: TEAL },
  { side: 0x7a6152, top: 0xe6c27a, wall: '#3a2f3f', brick: '#4a3b4d', sky: 0x241d2b, accent: AMBER },
  { side: 0x5d5a8a, top: 0xa89cf0, wall: '#262445', brick: '#302d58', sky: 0x17162e, accent: CORAL },
];

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  tex.anisotropy = 4;
  return tex;
}

function brickTex(theme) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = theme.wall; g.fillRect(0, 0, w, h);
    const bh = 32, bw = 64;
    for (let r = 0; r < h / bh; r++) {
      for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0);
        g.fillStyle = theme.brick;
        g.globalAlpha = 0.55 + ((r * 7 + c * 13) % 5) * 0.09;
        g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
    g.globalAlpha = 1;
  }, [W / 4, H / 4]);
}

function crateTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c98b45'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b37638';
    for (let i = 0; i < 4; i++) g.fillRect(0, i * 32 + 2, w, 26);
    g.strokeStyle = '#7a4a22'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
    g.lineWidth = 10; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke();
  });
}

function textTex(text, color, bg) {
  return canvasTex(128, 128, (g, w, h) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = color; g.font = '900 84px "Fredoka One", Nunito, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
  });
}

const lam = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

export function buildRoom(scene, room, world) {
  const theme = THEMES[room.theme % THEMES.length];
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];
  const keep = (o) => { disposables.push(o); return o; };

  // back wall
  const wallTex = keep(brickTex(theme));
  const back = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, H)), keep(lam(0xffffff, { map: wallTex })));
  back.position.set(W / 2, H / 2, -DEPTH / 2);
  back.receiveShadow = true;
  group.add(back);

  // tiles + top caps (instanced)
  const cells = [], caps = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (room.grid[y][x] !== '#') continue;
    cells.push([x, y]);
    if (y + 1 < H && room.grid[y + 1][x] !== '#') caps.push([x, y]);
  }
  const boxG = keep(new THREE.BoxGeometry(1, 1, DEPTH));
  const tiles = new THREE.InstancedMesh(boxG, keep(lam(0xffffff)), cells.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  cells.forEach(([x, y], i) => {
    m.makeTranslation(x + 0.5, y + 0.5, 0);
    tiles.setMatrixAt(i, m);
    col.setHex(theme.side).multiplyScalar(0.86 + ((x * 31 + y * 17) % 7) * 0.035);
    tiles.setColorAt(i, col);
  });
  tiles.receiveShadow = true;
  group.add(tiles);
  if (caps.length) {
    const capG = keep(new THREE.BoxGeometry(1.02, 0.16, DEPTH + 0.04));
    const capM = new THREE.InstancedMesh(capG, keep(lam(theme.top)), caps.length);
    caps.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, y + 1 - 0.07, 0); capM.setMatrixAt(i, m); });
    capM.receiveShadow = true;
    group.add(capM);
  }

  // ladders
  const wood = keep(lam(0xb98250));
  const railG = keep(new THREE.BoxGeometry(0.08, 1, 0.08));
  const rungG = keep(new THREE.BoxGeometry(0.62, 0.07, 0.07));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (room.grid[y][x] !== 'H') continue;
    for (const s of [-0.32, 0.32]) {
      const r = new THREE.Mesh(railG, wood); r.position.set(x + 0.5 + s, y + 0.5, -0.75); group.add(r);
    }
    for (const k of [0.25, 0.75]) {
      const r = new THREE.Mesh(rungG, wood); r.position.set(x + 0.5, y + k, -0.75); group.add(r);
    }
  }

  const views = new Map();
  for (const o of room.objects) {
    const v = objectView(o, theme, keep);
    if (v) { group.add(v.node); views.set(o.id, v); }
  }

  return {
    group, views, theme,
    crateView() {
      const tex = keep(crateTex());
      const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(1, 1, 1)), keep(lam(0xffffff, { map: tex })));
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    },
    dispose() {
      scene.remove(group);
      for (const d of disposables) d.dispose?.();
    },
  };
}

// ── puzzle objects ───────────────────────────────────────────────────────────────────
// Each view: { node, update(state, dt) } where state is the game's object state.
function objectView(o, theme, keep) {
  const node = new THREE.Group();
  const metal = keep(lam(0x8b93a8));
  const dark = keep(lam(0x3a4152));
  const onM = keep(lam(TEAL, { emissive: TEAL, emissiveIntensity: 0.45 }));
  const offM = keep(lam(CORAL, { emissive: CORAL, emissiveIntensity: 0.25 }));
  const amberM = keep(lam(AMBER, { emissive: AMBER, emissiveIntensity: 0.25 }));
  const box = (w, h, d, mat) => new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), mat);
  let t = Math.random() * 6;

  switch (o.type) {
    case 'lever': case 'heavylever': {
      const big = o.type === 'heavylever';
      node.position.set(o.x + 0.5, o.y, -0.2);
      const base = box(big ? 0.9 : 0.6, 0.22, 0.5, big ? dark : metal);
      base.position.y = 0.11; node.add(base);
      const pivot = new THREE.Group(); pivot.position.y = 0.2; node.add(pivot);
      const stick = box(0.09, big ? 0.95 : 0.7, 0.09, big ? keep(lam(0x6b5a3a)) : metal);
      stick.position.y = (big ? 0.95 : 0.7) / 2; pivot.add(stick);
      const ball = new THREE.Mesh(keep(new THREE.SphereGeometry(big ? 0.16 : 0.12, 14, 10)), offM);
      ball.position.y = big ? 0.98 : 0.72; pivot.add(ball);
      if (big) { const w = box(0.26, 0.26, 0.26, amberM); w.position.set(0, 0.05, 0.28); node.add(w); }
      let a = -0.6;
      return { node, update(s, dt) {
        const target = s.on ? 0.6 : -0.6;
        a += (target - a) * Math.min(1, dt * 10);
        pivot.rotation.z = a;
        ball.material = s.on ? onM : offM;
      } };
    }
    case 'switch': {
      node.position.set(o.x + 0.5, o.y + 0.55, -1.15);
      const plate = box(0.55, 0.55, 0.12, dark); node.add(plate);
      const btn = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 18)), offM);
      btn.rotation.x = Math.PI / 2; btn.position.z = 0.1; node.add(btn);
      return { node, update(s) { btn.material = s.on ? onM : offM; btn.position.z = s.on ? 0.05 : 0.1; } };
    }
    case 'post': {
      node.position.set(o.x + 0.5, o.y, -0.3);
      const pole = box(0.12, 1.25, 0.12, keep(lam(0x8a5a32))); pole.position.y = 0.62; node.add(pole);
      const sign = box(0.7, 0.42, 0.08, keep(lam(0xe6c27a))); sign.position.set(0, 1.15, 0.08); node.add(sign);
      const plank = box(0.5, 0.08, 0.04, keep(lam(0x8a5a32)));
      for (const k of [-0.1, 0.05, 0.2]) { const p = plank.clone(); p.position.set(0, 1.0 + k * 0.8, 0.13); node.add(p); }
      const lamp = new THREE.Mesh(keep(new THREE.SphereGeometry(0.1, 12, 8)), offM);
      lamp.position.y = 1.45; node.add(lamp);
      return { node, update(s) { lamp.material = s.on ? onM : offM; } };
    }
    case 'door': case 'locked': {
      node.position.set(o.x + 0.5, o.y, 0);
      const slab = new THREE.Group(); node.add(slab);
      const d = box(0.9, o.h, 1.6, keep(lam(o.type === 'locked' ? 0x9a6b3f : 0xd8676b)));
      d.position.y = o.h / 2; slab.add(d);
      for (let i = 1; i < o.h; i++) { const b = box(0.94, 0.08, 1.64, dark); b.position.y = i; slab.add(b); }
      if (o.type === 'locked') {
        const lock = box(0.5, 0.6, 0.1, amberM); lock.position.set(0, o.h / 2, 0.85); slab.add(lock);
        const hole = box(0.1, 0.24, 0.04, dark); hole.position.set(0, o.h / 2 - 0.05, 0.91); slab.add(hole);
      } else {
        const dot = new THREE.Mesh(keep(new THREE.SphereGeometry(0.12, 12, 8)), offM);
        dot.position.set(0, o.h / 2, 0.84); slab.add(dot);
      }
      let lift = 0;
      return { node, update(s, dt) {
        const target = s.open ? o.h - 0.05 : 0;
        lift += (target - lift) * Math.min(1, dt * 6);
        slab.position.y = lift;
      } };
    }
    case 'gate': {
      node.position.set(o.x + 0.5, o.y, 0);
      const bars = new THREE.Group(); node.add(bars);
      const barM = keep(lam(0x6d7386));
      // seen from the side: vertical bars across the 1-wide opening, cross bars, a heavy foot
      for (const x of [-0.33, -0.11, 0.11, 0.33]) {
        const b = box(0.09, o.h, 1.5, barM); b.position.set(x, o.h / 2, 0); bars.add(b);
      }
      for (let i = 1; i < o.h; i += 1) { const b = box(0.9, 0.1, 1.55, barM); b.position.y = i; bars.add(b); }
      const foot = box(0.94, 0.22, 1.6, dark); foot.position.y = 0.11; bars.add(foot);
      const weight = box(0.5, 0.5, 0.5, amberM); weight.position.set(0, o.h + 0.6, 1.3); node.add(weight);
      let lift = 0;
      return { node, update(s, dt) {
        const target = s.open ? o.h - 0.6 : 0;
        lift += (target - lift) * Math.min(1, dt * (s.open ? 5 : 9));
        bars.position.y = lift;
        weight.material = s.propped ? onM : amberM;
      } };
    }
    case 'bridge': {
      node.position.set(0, 0, 0);
      const ghostM = keep(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.22, depthWrite: false }));
      const plankM = keep(lam(0xb98250));
      const planks = [];
      for (let x = o.x0; x <= o.x1; x++) {
        const p = box(0.98, 0.3, 2.0, ghostM);
        p.position.set(x + 0.5, o.y + 0.85, 0);
        node.add(p); planks.push(p);
      }
      let grow = 0;
      return { node, update(s, dt) {
        if (s.on) grow = Math.min(1, grow + dt * 2.2);
        planks.forEach((p, i) => {
          const k = Math.max(0, Math.min(1, grow * planks.length - i));
          if (s.on && k > 0) { p.material = plankM; p.scale.set(1, 1, k); }
          else { p.material = ghostM; p.scale.set(1, 1, 1); }
        });
      } };
    }
    case 'key': {
      node.position.set(o.x + 0.5, o.y + 0.55, 0.2);
      const k = new THREE.Group(); node.add(k);
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.06, 10, 20)), amberM);
      ring.position.x = -0.18; k.add(ring);
      const shaft = box(0.4, 0.08, 0.08, amberM); shaft.position.x = 0.1; k.add(shaft);
      const bit = box(0.08, 0.16, 0.08, amberM); bit.position.set(0.26, -0.08, 0); k.add(bit);
      return { node, key: k, update(s, dt) {
        t += dt;
        k.visible = !s.taken;
        k.rotation.y = t * 1.6;
        k.position.y = Math.sin(t * 2.4) * 0.08;
      } };
    }
    case 'portal': {
      node.position.set(o.x + 0.5, o.y + 1.0, -0.3);
      const ringOff = keep(lam(0x59607a));
      const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.85, 0.12, 12, 36)), ringOff);
      node.add(ring);
      const discM = keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }));
      const disc = new THREE.Mesh(keep(new THREE.CircleGeometry(0.76, 32)), discM);
      node.add(disc);
      const swirl = new THREE.Mesh(keep(new THREE.RingGeometry(0.2, 0.62, 24, 1, 0, Math.PI * 1.2)),
        keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })));
      swirl.position.z = 0.02; node.add(swirl);
      return { node, update(s, dt) {
        t += dt;
        ring.material = s.active ? onM : ringOff;
        discM.opacity = s.active ? 0.45 + Math.sin(t * 3) * 0.1 : 0.06;
        swirl.material.opacity = s.active ? 0.5 : 0;
        swirl.rotation.z = -t * 3;
      } };
    }
    case 'cage': {
      node.position.set(o.x + 0.5, o.y, 0);
      const barM = keep(lam(0x6d7386));
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) {
        const b = box(0.07, 1.25, 0.07, barM); b.position.set(sx, 0.55, sz); node.add(b);
      }
      const roof = box(1.3, 0.1, 1.3, barM); roof.position.y = 1.2; node.add(roof);
      const chain = box(0.05, 3, 0.05, dark); chain.position.y = 2.7; node.add(chain);
      const floor = box(1.3, 0.08, 1.3, barM); floor.position.y = -0.04; node.add(floor);
      let open = 0;
      return { node, update(s, dt) {
        if (s.on) open = Math.min(1, open + dt * 3);
        floor.rotation.z = -open * 1.4;
        floor.position.x = -open * 0.5;
      } };
    }
    case 'exit': {
      node.position.set(o.x, o.y, -0.9);
      const frameM = keep(lam(0xe6c27a));
      const left = box(0.2, 2.3, 0.3, frameM); left.position.set(-1.05, 1.15, 0); node.add(left);
      const right = left.clone(); right.position.x = 1.05; node.add(right);
      const top = box(2.3, 0.25, 0.3, frameM); top.position.set(0, 2.35, 0); node.add(top);
      const lightM = keep(new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0 }));
      const light = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.9, 2.2)), lightM);
      light.position.set(0, 1.1, -0.05); node.add(light);
      const doorM = keep(lam(0xd8676b));
      const dl = box(0.95, 2.2, 0.12, doorM); dl.position.set(-0.48, 1.1, 0.05); node.add(dl);
      const dr = dl.clone(); dr.position.x = 0.48; node.add(dr);
      const star = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(textTex('★', '#ffcf5e')), depthWrite: false })));
      star.scale.set(0.8, 0.8, 1); star.position.set(0, 2.85, 0.3); node.add(star);
      let open = 0;
      return { node, update(s, dt) {
        t += dt;
        if (s.open) open = Math.min(1, open + dt * 2);
        dl.position.x = -0.48 - open * 0.9; dr.position.x = 0.48 + open * 0.9;
        dl.scale.x = dr.scale.x = 1 - open * 0.85;
        lightM.opacity = open * (0.55 + Math.sin(t * 3) * 0.12);
        star.material.rotation = Math.sin(t * 2) * 0.2;
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

/** A small floating key that a player carries. */
export function carriedKey() {
  const k = new THREE.Group();
  const m = lam(AMBER, { emissive: AMBER, emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 8, 16), m); ring.position.x = -0.14; k.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), m); shaft.position.x = 0.08; k.add(shaft);
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), m); bit.position.set(0.2, -0.06, 0); k.add(bit);
  return k;
}
