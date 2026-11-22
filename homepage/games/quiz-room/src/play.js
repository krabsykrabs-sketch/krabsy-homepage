// The play area: things to do between questions. All harmless to others: avatars pass
// through each other, nothing traps anyone, everything resets when the next question starts.
//   • two trampolines (land on them = big bounce)
//   • a tower with steps and a slide
//   • a ball pit (wade in, you sink a little and slow down)
//   • three balls to kick, and a basketball hoop on the back wall
//   • the big red button: confetti over the whole room (server cooldown)
//   • a dance floor whose tiles light up under every avatar
//   • four answer pads A–D over a soft foam pit (the bonus round "run to the answer":
//     when the time is up the wrong pads sink into the pit, the right one shoots confetti)
// Ground heights and solids are used by the controller (room.js) for the own avatar.
import * as THREE from 'three';

const BALL_R = 0.38;
const HOOP_R = 0.55;
const PAD_TOP = 0.06, PAD_SUNK = -1.15, PIT_DEPTH = 1.6;
export const PAD_COLORS = ['#3f7cff', '#ff8a2b', '#22b85a', '#d94fc6'];
const BALL_COLORS = ['#ffcf5e', '#ff8585', '#5fb4ff', '#2ee6c0', '#b18cff', '#ff9f43', '#7ee06a'];
const TRAMP_R = 1.25, TRAMP_H = 0.55;

// ---------------------------------------------------------------- floor plan
// The room grows with the group (api/quiz_room.py SIZES; the server sends the scale).
// At scale s the floor is 2W × 2D = 30s × 20s m. Stations keep their size and move apart
// (each one shifted with its anchor point); things on the back wall stay on the wall.
// The answer pads grow a little: same numbers as PAD_X / PAD_Z / pad_half() on the server.
// Live bindings: room.js and the controller read these after every applyLayout().
export let W, D, PADS, HOOP, BUTTON, PIT, DANCE, BALL_SPAWN, BOXES, SLIDE, TRAMPS, BACK;
export function applyLayout(s = 1) {
  const sh = (ax, az) => [ax * (s - 1), az * (s - 1)];          // station shift
  W = 15 * s; D = 10 * s;
  BACK = -D;                                                     // back wall (z)
  const zb = -10 * (s - 1);                                      // shift for things on the back wall
  PADS = { x: [-6.6, -2.2, 2.2, 6.6].map((x) => x * s), z: 3.5 * s, half: +(1.8 + (s - 1) * 0.9).toFixed(3) };
  HOOP = new THREE.Vector3(7 * s, 3.6, -8.55 + zb);              // ring centre
  BUTTON = new THREE.Vector3(6.5 * s, 0, 7.2 * s);
  const [px, pz] = sh(-12.5, 6.8);
  PIT = { x0: -14.6 + px, x1: -10.4 + px, z0: 4.2 + pz, z1: 9.4 + pz, depth: 0.38 };
  DANCE = { x0: -3, z0: -8.8 + zb, n: 4, size: 1.5 };
  // Balls: 3, and more in a bigger room (server allows 8).
  const spawns = [[-1, -1.2], [-5.5, -2.5], [4.5, -1.5], [2, 6], [-7.5, 1], [9, 6.5], [-2, -5.5]];
  BALL_SPAWN = spawns.slice(0, s >= 1.5 ? 7 : s >= 1.25 ? 5 : 3).map(([x, z]) => [x * s, z * s]);
  const [tx, tz] = sh(11.3, -1.9);
  // Boxes you can stand on / bump into: [x0, x1, z0, z1, top].
  BOXES = [
    [9.0 + tx, 10.0 + tx, -3.2 + tz, -0.6 + tz, 0.8],           // step 1
    [10.0 + tx, 11.0 + tx, -3.2 + tz, -0.6 + tz, 1.6],          // step 2
    [11.0 + tx, 13.6 + tx, -3.2 + tz, -0.6 + tz, 2.4],          // tower top
    [PIT.x0 - 0.3, PIT.x1 + 0.3, PIT.z0 - 0.3, PIT.z0, 0.5],   // ball pit rims
    [PIT.x0 - 0.3, PIT.x1 + 0.3, PIT.z1, PIT.z1 + 0.3, 0.5],
    [PIT.x0 - 0.3, PIT.x0, PIT.z0, PIT.z1, 0.5],
    [PIT.x1, PIT.x1 + 0.3, PIT.z0, PIT.z1, 0.5],
  ];
  // The slide: from the tower top (h 2.4) down to the floor.
  SLIDE = { x0: 11.4 + tx, x1: 13.2 + tx, z0: -0.6 + tz, z1: 5.4 + tz, h: 2.4 };
  TRAMPS = [[-12.5 * s, -1.0 * s], [-12.3 * s, 2.3 * s]];
}
applyLayout(1);

function confettiMesh(n) {
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
  m.frustumCulled = false; m.visible = false;
  return m;
}

export class PlayArea {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.balls = [];
    this.tiles = [];
    this.tramps = [];
    this.onKick = null;     // (b, p, v) → send to server
    this.onBoom = null;     // () → ask the server for confetti
    this.onSound = null;    // (name) → play a sound
    this.boomCool = 0;
    this.pads = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this._build();
  }

  // Remove everything this play area added (the room is rebuilt at a new size).
  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
    });
  }

  _build() {
    const s = this.group;
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const box = (x0, x1, z0, z1, h, mat, y0 = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h - y0, z1 - z0), mat);
      m.position.set((x0 + x1) / 2, (h + y0) / 2, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true; s.add(m); return m;
    };

    // Tower, steps and slide.
    const towerMat = lam('#ff9f43'), stepMat = lam('#ffcf5e'), slideMat = lam('#2ee6c0');
    for (const [x0, x1, z0, z1, h] of BOXES.slice(0, 3)) box(x0, x1, z0, z1, h, h > 2 ? towerMat : stepMat);
    const len = Math.hypot(SLIDE.z1 - SLIDE.z0, SLIDE.h);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(SLIDE.x1 - SLIDE.x0, 0.18, len), slideMat);
    slide.position.set((SLIDE.x0 + SLIDE.x1) / 2, SLIDE.h / 2, (SLIDE.z0 + SLIDE.z1) / 2);
    slide.rotation.x = Math.atan2(SLIDE.h, SLIDE.z1 - SLIDE.z0);
    slide.castShadow = slide.receiveShadow = true; s.add(slide);
    for (const x of [SLIDE.x0 - 0.06, SLIDE.x1 + 0.06]) {           // side rails
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, len), lam('#14a387'));
      r.position.set(x, SLIDE.h / 2 + 0.2, (SLIDE.z0 + SLIDE.z1) / 2); r.rotation.x = slide.rotation.x; s.add(r);
    }

    // Trampolines.
    for (const [x, z] of TRAMPS) {
      const g = new THREE.Group(); g.position.set(x, 0, z);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(TRAMP_R, 0.13, 10, 40), lam('#3f7cff'));
      frame.rotation.x = Math.PI / 2; frame.position.y = TRAMP_H; g.add(frame);
      const mat = new THREE.Mesh(new THREE.CircleGeometry(TRAMP_R - 0.05, 40), lam('#1b2453'));
      mat.rotation.x = -Math.PI / 2; mat.position.y = TRAMP_H - 0.02; g.add(mat);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, TRAMP_H), lam('#8aa0d6'));
        const a = i * Math.PI / 2 + Math.PI / 4;
        leg.position.set(Math.cos(a) * TRAMP_R, TRAMP_H / 2, Math.sin(a) * TRAMP_R); g.add(leg);
      }
      s.add(g);
      this.tramps.push({ x, z, mat, squash: 0 });
    }

    // Ball pit: rims + many small balls.
    const rimMat = lam('#ff7ad9');
    for (const b of BOXES.slice(3)) box(...b, rimMat);
    const n = 260;
    const pit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), lam('#ffffff'), n);
    const m4 = new THREE.Matrix4(), c = new THREE.Color();
    const cols = ['#ff8585', '#ffcf5e', '#2ee6c0', '#5fb4ff', '#b18cff', '#ff9f43'];
    for (let i = 0; i < n; i++) {
      m4.makeTranslation(PIT.x0 + 0.2 + Math.random() * (PIT.x1 - PIT.x0 - 0.4), 0.05 + Math.random() * 0.33,
        PIT.z0 + 0.2 + Math.random() * (PIT.z1 - PIT.z0 - 0.4));
      pit.setMatrixAt(i, m4); pit.setColorAt(i, c.set(cols[i % cols.length]));
    }
    pit.castShadow = false; pit.receiveShadow = true; s.add(pit);

    // Dance floor.
    for (let i = 0; i < DANCE.n; i++) for (let j = 0; j < DANCE.n; j++) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(DANCE.size - 0.08, DANCE.size - 0.08),
        new THREE.MeshBasicMaterial({ color: '#2a2f6a' }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(DANCE.x0 + (i + 0.5) * DANCE.size, 0.02, DANCE.z0 + (j + 0.5) * DANCE.size);
      s.add(tile);
      this.tiles.push({ tile, glow: 0, color: new THREE.Color(), base: new THREE.Color('#2a2f6a') });
    }

    // Basketball hoop on the back wall.
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 0.1), lam('#f7f9ff'));
    board.position.set(HOOP.x, HOOP.y + 0.6, BACK + 0.15); s.add(board);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.02), lam('#ff8585'));
    sq.position.set(HOOP.x, HOOP.y + 0.45, BACK + 0.21); s.add(sq);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(HOOP_R, 0.05, 8, 32), lam('#ff6a2b'));
    ring.rotation.x = Math.PI / 2; ring.position.copy(HOOP); s.add(ring);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(HOOP_R, HOOP_R * 0.6, 0.6, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.7 }));
    net.position.set(HOOP.x, HOOP.y - 0.3, HOOP.z); s.add(net);
    this.net = net;

    // The big red button.
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.35, 32), lam('#1d2a5c'));
    ped.position.set(BUTTON.x, 0.175, BUTTON.z); ped.castShadow = true; s.add(ped);
    this.button = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#ff2d3d', emissive: '#550008' }));
    this.button.position.set(BUTTON.x, 0.35, BUTTON.z); this.button.scale.y = 0.6; s.add(this.button);

    // Balls.
    const ballGeo = new THREE.SphereGeometry(BALL_R, 20, 14);
    BALL_SPAWN.forEach(([x, z], i) => {
      const m = new THREE.Mesh(ballGeo, lam(BALL_COLORS[i % BALL_COLORS.length]));
      m.castShadow = true; s.add(m);
      // A stripe so you can see it roll.
      const st = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 1.001, 0.04, 6, 24), lam('#ffffff'));
      m.add(st);
      this.balls.push({ m, p: new THREE.Vector3(x, BALL_R, z), v: new THREE.Vector3(), cool: 0, scored: 0, above: false });
    });

    // Answer pads over the foam pit (the floor has holes here, see Room._build).
    const pitWall = new THREE.MeshLambertMaterial({ color: '#2a1d58', side: THREE.DoubleSide });
    const foamCols = ['#ff8585', '#ffcf5e', '#2ee6c0', '#5fb4ff', '#b18cff', '#ffffff'];
    const foam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), lam('#ffffff'), 4 * 40);
    let fi = 0;
    const L = PADS.half * 2;
    PADS.x.forEach((x, i) => {
      for (const [dx, dz, ry] of [[0, -PADS.half, 0], [0, PADS.half, 0], [-PADS.half, 0, Math.PI / 2], [PADS.half, 0, Math.PI / 2]]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(L, PIT_DEPTH), pitWall);
        w.position.set(x + dx, -PIT_DEPTH / 2, PADS.z + dz); w.rotation.y = ry; s.add(w);
      }
      for (let k = 0; k < 40; k++) {
        m4.makeRotationY(Math.random() * 3).setPosition(x + (Math.random() - 0.5) * (L - 0.5), -PIT_DEPTH + 0.2 + Math.random() * 0.3,
          PADS.z + (Math.random() - 0.5) * (L - 0.5));
        foam.setMatrixAt(fi, m4); foam.setColorAt(fi, c.set(foamCols[k % foamCols.length])); fi++;
      }
      const g = new THREE.Group(); g.position.set(x, 0, PADS.z);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(L - 0.04, 0.25, L - 0.04), lam('#1d2a5c'));
      slab.position.y = PAD_TOP - 0.125; slab.receiveShadow = true; g.add(slab);
      const lc = document.createElement('canvas'); lc.width = lc.height = 256;
      const tex = new THREE.CanvasTexture(lc); tex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.1, L - 0.1), new THREE.MeshLambertMaterial({ map: tex, transparent: true }));
      label.rotation.x = -Math.PI / 2; label.position.y = PAD_TOP + 0.005; label.receiveShadow = true; g.add(label);
      s.add(g);
      // A sign above the pad with the same word: the floor gets covered when children
      // stand on it. Drawn over everything (depthTest off), so no avatar can hide it.
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 192;
      const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, depthTest: false, transparent: true }));
      const sw = Math.min(PADS.half * 2 + 0.2, 4.2);
      sign.scale.set(sw, sw * 192 / 512, 1);
      sign.position.set(x, 3.3, PADS.z - PADS.half * 0.6);
      sign.renderOrder = 10; sign.visible = false; s.add(sign);
      const pad = { i, x, g, lc, tex, sign, sc, stex, y: PAD_TOP, target: PAD_TOP, glow: 0, sinkT: 0 };
      this.pads.push(pad);
      this._drawPad(pad, null);
    });
    s.add(foam);

    // Confetti (button and baskets).
    this.confetti = confettiMesh(500);
    s.add(this.confetti);
    this.cf = Array.from({ length: 500 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
  }

  // ---------------------------------------------------------------- answer pads
  _drawPad(pad, word, state = '') {
    const g = pad.lc.getContext('2d'), S = 256;
    g.clearRect(0, 0, S, S);
    const col = PAD_COLORS[pad.i];
    g.globalAlpha = word ? 1 : 0.35;
    g.fillStyle = col; g.beginPath(); g.roundRect(6, 6, S - 12, S - 12, 26); g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 10; g.strokeStyle = state === 'right' ? '#ffffff' : 'rgba(255,255,255,.35)';
    g.beginPath(); g.roundRect(10, 10, S - 20, S - 20, 22); g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 92px "Fredoka One", sans-serif';
    g.fillText('ABCD'[pad.i], S / 2, word ? 82 : S / 2);
    if (word) {
      let size = 64;
      g.font = `700 ${size}px "Fredoka One", sans-serif`;
      while (g.measureText(word).width > S - 30 && size > 24) { size -= 4; g.font = `700 ${size}px "Fredoka One", sans-serif`; }
      g.fillText(word, S / 2, 172);
    }
    pad.tex.needsUpdate = true;
    // The sign: shown only while the pads carry words; after the reveal the right one stays
    // bright, the wrong ones fade.
    pad.sign.visible = !!word;
    if (!word) return;
    const c = pad.sc.getContext('2d'), w = pad.sc.width, h = pad.sc.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = col; c.beginPath(); c.roundRect(8, 8, w - 16, h - 16, 36); c.fill();
    c.lineWidth = 10; c.strokeStyle = state === 'right' ? '#ffffff' : 'rgba(10,18,44,.55)';
    c.beginPath(); c.roundRect(12, 12, w - 24, h - 24, 32); c.stroke();
    c.fillStyle = 'rgba(10,18,44,.35)'; c.beginPath(); c.arc(100, h / 2, 62, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '700 84px "Fredoka One", sans-serif'; c.fillText('ABCD'[pad.i], 100, h / 2 + 4);
    let size = 84;
    c.font = `700 ${size}px "Fredoka One", sans-serif`;
    while (c.measureText(word).width > w - 210 && size > 30) { size -= 4; c.font = `700 ${size}px "Fredoka One", sans-serif`; }
    c.fillText(word, (180 + w - 20) / 2, h / 2 + 4);
    pad.stex.needsUpdate = true;
    pad.sign.material.opacity = state === 'wrong' ? 0.3 : 1;
  }

  // options: the four answers (bonus question) or null (pads idle).
  setPads(options) {
    this.padWords = options;
    this.pads.forEach((p) => { p.target = PAD_TOP; p.sinkT = 0; this._drawPad(p, options ? options[p.i] : null); });
  }

  // Reveal: the wrong pads sink into the foam pit for a moment, the right one celebrates.
  sinkPads(correct) {
    this.pads.forEach((p) => {
      if (p.i === correct) { this._drawPad(p, this.padWords?.[p.i], 'right'); p.glow = 1; }
      else { p.target = PAD_SUNK; p.sinkT = 3.5; if (this.padWords) this._drawPad(p, this.padWords[p.i], 'wrong'); }
    });
    const right = this.pads[correct];
    if (right) this.burst(new THREE.Vector3(right.x, 0.5, PADS.z), 260);
  }

  padAt(x, z) {
    if (Math.abs(z - PADS.z) > PADS.half) return null;
    return this.pads.find((p) => Math.abs(x - p.x) <= PADS.half) || null;
  }

  // Inside a sunk pit you stay in the pit (no walking through its walls).
  clampPit(p, prev) {
    if (p.y > -0.15) return;
    const pad = this.padAt(prev.x, prev.z);
    if (!pad) return;
    const m = PADS.half - 0.35;
    p.x = Math.max(pad.x - m, Math.min(pad.x + m, p.x));
    p.z = Math.max(PADS.z - m, Math.min(PADS.z + m, p.z));
  }

  // ---------------------------------------------------------------- for the controller
  // Ground under (x, z) for a body whose feet are at y: the highest surface at most
  // `step` above the feet. Also says what the surface is.
  ground(x, z, y, step = 0.35) {
    let h = 0, kind = 'floor';
    const pad = this.padAt(x, z);
    if (pad) { h = pad.y; kind = 'pad'; }               // over a pit: the pad is the ground
    if (x > PIT.x0 && x < PIT.x1 && z > PIT.z0 && z < PIT.z1) { h = -PIT.depth; kind = 'pit'; }
    for (const [x0, x1, z0, z1, top] of BOXES) {
      if (x > x0 && x < x1 && z > z0 && z < z1 && top <= y + step && top > h) { h = top; kind = 'box'; }
    }
    if (x > SLIDE.x0 && x < SLIDE.x1 && z > SLIDE.z0 && z < SLIDE.z1) {
      const sh = SLIDE.h * (1 - (z - SLIDE.z0) / (SLIDE.z1 - SLIDE.z0)) + 0.09;
      if (sh <= y + step + 0.25 && sh > h) { h = sh; kind = 'slide'; }
    }
    for (const t of this.tramps) {
      if (Math.hypot(x - t.x, z - t.z) < TRAMP_R && TRAMP_H <= y + step && TRAMP_H > h) { h = TRAMP_H; kind = 'tramp'; }
    }
    return { h, kind };
  }

  // Is (x, z) blocked for feet at y (a box side or the slide side taller than a step)?
  blocked(x, z, y) {
    for (const [x0, x1, z0, z1, top] of BOXES) {
      if (x > x0 - 0.3 && x < x1 + 0.3 && z > z0 - 0.3 && z < z1 + 0.3 && top > y + 0.35) return true;
    }
    return false;
  }

  trampAt(x, z) { return this.tramps.find((t) => Math.hypot(x - t.x, z - t.z) < TRAMP_R); }
  bounce(t) { t.squash = 1; this.onSound?.('boing'); }

  // ---------------------------------------------------------------- events
  applyBall(b, p, v) {
    const ball = this.balls[b];
    if (!ball) return;
    ball.p.set(...p); ball.v.set(...v); ball.cool = 0.2;
  }

  reset() {
    BALL_SPAWN.forEach(([x, z], i) => { const b = this.balls[i]; b.p.set(x, BALL_R, z); b.v.set(0, 0, 0); });
  }

  burst(center = null, n = 500) {
    const c = new THREE.Color(), cols = ['#2ee6c0', '#ff8585', '#ffcf5e', '#b18cff', '#ffffff', '#5fb4ff'];
    for (let i = 0; i < n && i < this.cf.length; i++) {
      const k = this.cf[i];
      if (center) {
        k.p.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random(), (Math.random() - 0.5) * 1.5));
        k.v.set((Math.random() - 0.5) * 6, 3 + Math.random() * 5, (Math.random() - 0.5) * 6);
      } else {
        k.p.set((Math.random() - 0.5) * 2 * W, 9 + Math.random() * 5, (Math.random() - 0.5) * 2 * D);
        k.v.set((Math.random() - 0.5) * 2, -1 - Math.random() * 2, (Math.random() - 0.5));
      }
      k.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      k.life = 4 + Math.random() * 2;
      this.confetti.setColorAt(i, c.set(cols[i % cols.length]));
    }
    this.confetti.instanceColor.needsUpdate = true;
    this.confetti.visible = true;
  }

  // ---------------------------------------------------------------- frame
  // avatars: all Avatar objects (for dance tiles); me: own avatar or null; frozen: no kicks.
  update(dt, avatars, me, frozen = false) {
    this.t += dt;
    this.boomCool = Math.max(0, this.boomCool - dt);

    // Answer pads move toward their target; sunk ones come back up after a while.
    for (const p of this.pads) {
      if (p.sinkT > 0) { p.sinkT -= dt; if (p.sinkT <= 0) p.target = PAD_TOP; }
      const sp = p.target < p.y ? 3.2 : 1.6;
      p.y += Math.sign(p.target - p.y) * Math.min(Math.abs(p.target - p.y), sp * dt);
      p.g.position.y = p.y - PAD_TOP;
    }

    // Trampolines spring back.
    for (const t of this.tramps) {
      t.squash = Math.max(0, t.squash - dt * 4);
      t.mat.position.y = TRAMP_H - 0.02 - Math.sin(t.squash * Math.PI) * 0.25;
    }

    // Dance floor: tiles under avatars light up and fade.
    for (const a of avatars) {
      const p = a.root.position;
      const i = Math.floor((p.x - DANCE.x0) / DANCE.size), j = Math.floor((p.z - DANCE.z0) / DANCE.size);
      if (i >= 0 && i < DANCE.n && j >= 0 && j < DANCE.n && p.y < 0.3) {
        const tl = this.tiles[i * DANCE.n + j];
        if (tl.glow < 0.6) tl.color.setHSL(Math.random(), 0.9, 0.6);
        tl.glow = 1;
      }
    }
    for (const tl of this.tiles) {
      tl.glow = Math.max(0, tl.glow - dt * 0.9);
      tl.tile.material.color.copy(tl.base).lerp(tl.color, tl.glow);
    }

    // Big red button: the own avatar standing on it asks for confetti.
    let pressed = false;
    if (me && !frozen) {
      const p = me.root.position;
      if (Math.hypot(p.x - BUTTON.x, p.z - BUTTON.z) < 0.95 && p.y < 1.0) {
        pressed = true;
        if (this.boomCool <= 0) { this.boomCool = 2; this.onBoom?.(); }
      }
    }
    this.button.scale.y += ((pressed ? 0.25 : 0.6) - this.button.scale.y) * Math.min(1, dt * 12);

    // Balls.
    for (const [bi, b] of this.balls.entries()) {
      b.cool = Math.max(0, b.cool - dt);
      // Kick by the own avatar (others' kicks arrive as messages).
      if (me && !frozen && b.cool <= 0) {
        const p = me.root.position;
        const dx = b.p.x - p.x, dz = b.p.z - p.z, d = Math.hypot(dx, dz);
        if (d < BALL_R + 0.5 && b.p.y < p.y + 1.3 && b.p.y > p.y - 0.5) {
          const sp = me.speed || 0;
          const power = 6 + sp * 0.8;
          b.v.set(dx / (d || 1) * power, 3.5 + sp * 0.25, dz / (d || 1) * power);
          b.cool = 0.25;
          this.onKick?.(bi, [b.p.x, b.p.y, b.p.z], [b.v.x, b.v.y, b.v.z]);
          this.onSound?.('kick');
        }
      }
      b.v.y -= 15 * dt;
      const wasAbove = b.p.y > HOOP.y;
      b.p.addScaledVector(b.v, dt);
      // floor (and the pit is soft)
      const g = this.ground(b.p.x, b.p.z, b.p.y - BALL_R, 0.05).h;
      if (b.p.y - BALL_R < g) {
        b.p.y = g + BALL_R;
        if (b.v.y < 0) b.v.y = -b.v.y * (g < 0 ? 0.2 : 0.55);
        if (Math.abs(b.v.y) < 0.6) b.v.y = 0;
        const f = Math.exp(-dt * 1.6); b.v.x *= f; b.v.z *= f;
      }
      // walls
      const WX = W - 0.4, D0 = -D + 0.4, D1 = D - 0.4;
      if (b.p.x < -WX) { b.p.x = -WX; b.v.x = Math.abs(b.v.x) * 0.7; }
      if (b.p.x > WX) { b.p.x = WX; b.v.x = -Math.abs(b.v.x) * 0.7; }
      if (b.p.z < D0) { b.p.z = D0; b.v.z = Math.abs(b.v.z) * 0.7; }
      if (b.p.z > D1) { b.p.z = D1; b.v.z = -Math.abs(b.v.z) * 0.7; }
      // boxes: bounce off the sides
      for (const [x0, x1, z0, z1, top] of BOXES) {
        if (b.p.y - BALL_R < top && b.p.x > x0 - BALL_R && b.p.x < x1 + BALL_R && b.p.z > z0 - BALL_R && b.p.z < z1 + BALL_R) {
          const ex = Math.min(b.p.x - (x0 - BALL_R), (x1 + BALL_R) - b.p.x), ez = Math.min(b.p.z - (z0 - BALL_R), (z1 + BALL_R) - b.p.z);
          const ey = top - (b.p.y - BALL_R);
          if (ey < Math.min(ex, ez) && b.v.y <= 0) { b.p.y = top + BALL_R; b.v.y = -b.v.y * 0.5; }
          else if (ex < ez) { b.v.x = -b.v.x * 0.6; b.p.x += b.p.x < (x0 + x1) / 2 ? -ex : ex; }
          else { b.v.z = -b.v.z * 0.6; b.p.z += b.p.z < (z0 + z1) / 2 ? -ez : ez; }
        }
      }
      // backboard
      if (b.p.z < BACK + 0.25 + BALL_R && Math.abs(b.p.x - HOOP.x) < 1.1 && Math.abs(b.p.y - (HOOP.y + 0.6)) < 0.75) {
        b.p.z = BACK + 0.25 + BALL_R; b.v.z = Math.abs(b.v.z) * 0.6;
      }
      // basket: falls through the ring from above
      const dh = Math.hypot(b.p.x - HOOP.x, b.p.z - HOOP.z);
      if (wasAbove && b.p.y <= HOOP.y && b.v.y < 0 && dh < HOOP_R - 0.05 && b.scored <= 0) {
        b.scored = 1.5;
        this.burst(HOOP.clone(), 160);
        this.onSound?.('swish');
      }
      b.scored = Math.max(0, b.scored - dt);
      b.m.position.copy(b.p);
      b.m.rotation.x += b.v.z * dt / BALL_R;
      b.m.rotation.z -= b.v.x * dt / BALL_R;
    }
    this.net.scale.y = 1 + Math.max(0, ...this.balls.map((b) => b.scored)) * 0.3 * Math.sin(this.t * 20);

    // Confetti.
    if (this.confetti.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3();
      let alive = 0;
      this.cf.forEach((k, i) => {
        k.life -= dt;
        if (k.life > 0) alive++;
        k.v.y = Math.max(k.v.y - dt * 4, -2.6);
        k.v.x *= 0.99; k.v.z *= 0.99;
        k.p.addScaledVector(k.v, dt);
        k.r.x += k.w.x * dt; k.r.y += k.w.y * dt; k.r.z += k.w.z * dt;
        m.compose(k.p, q.setFromEuler(k.r), k.life > 0 && k.p.y > 0 ? one : zero);
        this.confetti.setMatrixAt(i, m);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
      if (!alive) this.confetti.visible = false;
    }
  }
}

// Where avatars land when the teacher calls everyone to the middle.
export function middleSpot() {
  const a = Math.random() * Math.PI * 2, r = (1 + Math.random() * 3) * Math.sqrt(W / 15);
  return new THREE.Vector3(Math.cos(a) * r, 0, 3 * (W / 15) + Math.sin(a) * r * 0.7);
}
