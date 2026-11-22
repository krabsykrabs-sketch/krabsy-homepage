// The 3D quiz room, shared by the child page (follow camera, own avatar walks) and the
// teacher page (overview camera, nobody of its own). Avatars are KayKit characters with a
// name tag; during a question an "answered" dot (same colour for everyone) or a thinking
// bubble floats over each head.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PlayArea, PADS } from './play.js';

export const AVATARS = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch', 'Superhero', 'Helper_A', 'Helper_B', 'Caveman'];
export const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#b18cff', '#5fb4ff', '#ff9f43', '#7ee06a', '#ff7ad9'];
const FURNITURE = ['couch_pillows', 'lamp_standing', 'shelf_B_large_decorated', 'rug_oval_A',
  'cactus_medium_A', 'armchair_pillows', 'table_low_decorated'];
export const ANIM = { idle: 0, walk: 1, run: 2, jump: 3 };
// Emotes (keys 1–4 after answering, or the buttons): bubble + animation.
export const EMOTES = [
  { icon: '👋', clip: 'Interact', dur: 1.4 },          // wave
  { icon: '💃', clip: 'Walking_A', dur: 2.4, spin: true }, // dance
  { icon: '🎉', clip: 'Jump_Full_Short', dur: 1.6 },   // cheer
  { icon: '👍', clip: 'Use_Item', dur: 1.4 },          // thumbs up
];
const CLIP = ['Idle_A', 'Walking_A', 'Running_A', 'Jump_Idle'];

// Room size (floor from -W..W, -D..D). Small enough that everyone stays in view.
export const W = 15, D = 10;
// Solid things (circles: x, z, r) avatars can't walk through.
const SOLIDS = [];

const loader = new GLTFLoader();
const modelCache = new Map();
let clips = null;

function lambert(root) {
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!swapped.has(o.material)) {
      const s = o.material;
      swapped.set(s, new THREE.MeshLambertMaterial({ map: s.map, color: s.color }));
    }
    o.material = swapped.get(o.material);
    o.castShadow = true; o.receiveShadow = true;
  });
  return root;
}

async function loadClips() {
  if (clips) return clips;
  const [g, m] = await Promise.all(['General', 'MovementBasic'].map((n) => loader.loadAsync(`assets/anim/Rig_Medium_${n}.glb`)));
  clips = {};
  for (const a of [...g.animations, ...m.animations]) clips[a.name] = a;
  return clips;
}

// Avatar models are loaded when first needed (a room rarely uses all eight).
function loadModel(i) {
  const name = AVATARS[((i % AVATARS.length) + AVATARS.length) % AVATARS.length];
  if (!modelCache.has(name)) {
    modelCache.set(name, loader.loadAsync(`assets/chars/${name}.glb`).then((g) => lambert(g.scene)));
  }
  return modelCache.get(name);
}

function tagTexture(name, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = '700 64px "Fredoka One", sans-serif';
  const w = Math.min(500, g.measureText(name).width + 60);
  g.fillStyle = 'rgba(8,14,36,.82)';
  g.beginPath(); g.roundRect((512 - w) / 2, 18, w, 92, 46); g.fill();
  g.lineWidth = 8; g.strokeStyle = color; g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 256, 66, 460);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function iconTexture(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (kind.startsWith('emo:')) {                 // emote bubble with an emoji
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(64, 58, 52, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(44, 100); g.lineTo(64, 124); g.lineTo(80, 100); g.fill();
    g.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(kind.slice(4), 64, 62);
  } else if (kind === 'dot') {
    const grd = g.createRadialGradient(64, 64, 10, 64, 64, 60);
    grd.addColorStop(0, '#fff6cf'); grd.addColorStop(0.45, '#ffcf5e'); grd.addColorStop(1, 'rgba(255,207,94,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffcf5e'; g.beginPath(); g.arc(64, 64, 30, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke();
  } else { // thinking bubble
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(64, 54, 54, 40, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(36, 104, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5b6b92';
    for (const x of [38, 64, 90]) { g.beginPath(); g.arc(x, 54, 9, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ICONS = {};
const icon = (k) => (ICONS[k] ||= iconTexture(k));

const BLOB_GEO = new THREE.CircleGeometry(0.55, 20);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });

export class Avatar {
  constructor(room, info) {
    this.room = room;
    this.pid = info.pid;
    this.root = new THREE.Group();
    this.target = new THREE.Vector3();
    this.targetRot = 0;
    this.anim = 0;
    this.mixer = null; this.actions = {}; this.current = null;
    // Coloured ring under the feet: the player's colour, easy to spot from above.
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: COLORS[info.color % COLORS.length], transparent: true, opacity: 0.9 }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.03;
    this.root.add(this.ring);
    // Blob shadow: other children's avatars don't cast real shadows (performance: with 30
    // avatars the shadow pass would draw every character a second time).
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT);
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.02; this.blob.renderOrder = 1;
    this.root.add(this.blob);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.tag.scale.set(2.6, 0.65, 1); this.tag.position.y = 3.05; this.tag.renderOrder = 10;
    this.root.add(this.tag);
    this.emo = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.emo.scale.set(1.1, 1.1, 1); this.emo.position.y = 4.1; this.emo.renderOrder = 12; this.emo.visible = false;
    this.root.add(this.emo);
    this.emoteT = 0; this.emote_ = null; this.speed = 0;
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    this.mark.scale.set(0.8, 0.8, 1); this.mark.position.y = 3.85; this.mark.renderOrder = 11; this.mark.visible = false;
    this.root.add(this.mark);
    this.setInfo(info);
    room.scene.add(this.root);
    this.ready = loadModel(info.avatar).then((tpl) => {
      if (this.disposed) return;
      this.model = cloneSkinned(tpl);
      const real = room.mode === 'child' && info.pid === room.myPid;   // only your own avatar
      this.model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = real; o.receiveShadow = false; } });
      this.blob.visible = !real;
      this.model.scale.setScalar(1.0);
      this.root.add(this.model);
      this.mixer = new THREE.AnimationMixer(this.model);
      for (const n of [...CLIP, ...EMOTES.map((e) => e.clip)]) if (clips[n]) this.actions[n] = this.mixer.clipAction(clips[n]);
      this.play(CLIP[this.anim]);
      this.mixer.setTime(Math.random() * 2);
    });
  }

  setInfo(info) {
    this.info = info;
    const key = `${info.name}|${info.color}`;
    if (this.tagKey !== key) {
      this.tagKey = key;
      this.tag.material.map?.dispose();
      this.tag.material.map = tagTexture(info.name, COLORS[info.color % COLORS.length]);
      this.tag.material.needsUpdate = true;
      this.ring.material.color.set(COLORS[info.color % COLORS.length]);
    }
    this.root.visible = info.online !== false;
  }

  // 'dot' (answered), 'think' (question open, not answered) or null.
  setMark(kind) {
    if (this.markKind === kind) return;
    this.markKind = kind;
    this.mark.visible = !!kind;
    if (kind) { this.mark.material.map = icon(kind); this.mark.material.needsUpdate = true; this.markT = 0; }
  }

  play(name, fade = 0.18) {
    if (!this.mixer || this.current === name || !this.actions[name]) return;
    const next = this.actions[name], prev = this.current && this.actions[this.current];
    next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (prev) prev.crossFadeTo(next, fade, false);
    this.current = name;
  }

  setAnim(a) {
    this.anim = a;
    if (this.emoteT > 0 && a <= ANIM.idle) return;     // an emote plays while standing
    if (this.emoteT > 0) this.endEmote();
    this.play(CLIP[a] || CLIP[0]);
  }

  emote(e) {
    const E = EMOTES[e];
    if (!E) return;
    this.emote_ = E; this.emoteT = E.dur;
    this.emo.material.map = icon(`emo:${E.icon}`); this.emo.material.needsUpdate = true;
    this.emo.visible = true;
    this.current = null; this.play(E.clip, 0.1);
  }

  endEmote() {
    this.emoteT = 0; this.emote_ = null; this.emo.visible = false;
    if (this.model) this.model.rotation.y = 0;
    this.current = null; this.play(CLIP[this.anim] || CLIP[0]);
  }

  update(dt, remote) {
    if (remote) {
      const k = 1 - Math.exp(-dt * 12);
      this.root.position.lerp(this.target, k);
      let d = this.targetRot - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * k;
    }
    // Name tag and mark stay upright; the mark bobs.
    if (this.mark.visible) {
      this.markT = (this.markT || 0) + dt;
      const pop = Math.min(1, this.markT * 5);
      const s = (this.markKind === 'dot' ? 0.75 : 0.95) * (0.6 + 0.4 * pop);
      this.mark.scale.set(s, s, 1);
      this.mark.position.y = 3.85 + Math.sin(this.markT * 3) * 0.08;
    }
    if (this.emoteT > 0) {
      this.emoteT -= dt;
      const k = Math.min(1, (this.emote_.dur - this.emoteT) * 6);
      this.emo.scale.setScalar(1.1 * k);
      this.emo.position.y = (this.mark.visible ? 4.7 : 4.0) + Math.sin(this.emoteT * 6) * 0.06;
      if (this.emote_.spin && this.model) this.model.rotation.y += dt * 9;
      if (this.emoteT <= 0) this.endEmote();
    }
    this.mixer?.update(dt);
  }

  dispose() {
    this.disposed = true;
    this.room.scene.remove(this.root);
    this.tag.material.map?.dispose();
  }
}

function logoTexture(text1 = 'KRABSY', text2 = 'QUIZ ROOM') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 512);
  grd.addColorStop(0, '#1b3d78'); grd.addColorStop(1, '#3a1d6e');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.globalAlpha = 0.12; g.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(512, 256); g.arc(512, 256, 900, i * Math.PI / 7, (i + 0.5) * Math.PI / 7); g.fill(); }
  g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 130px "Fredoka One", sans-serif'; g.fillStyle = '#ffcf5e'; g.fillText(text1, 512, 200);
  g.font = '700 92px "Fredoka One", sans-serif'; g.fillStyle = '#2ee6c0'; g.fillText(text2, 512, 330);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Room {
  constructor(canvas, { mode = 'child' } = {}) {
    this.mode = mode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1430');
    this.camera = new THREE.PerspectiveCamera(mode === 'teacher' ? 38 : 50, 16 / 9, 0.1, 200);
    this.avatars = new Map();
    this.me = null;           // own Avatar (child page)
    this.time = 0;
    this.camPos = new THREE.Vector3(0, 12, 16); this.camLook = new THREE.Vector3();
    this._build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#c8dcff', '#3a2d58', 1.25));
    const sun = new THREE.DirectionalLight('#ffffff', 1.5);
    sun.position.set(6, 16, 10); sun.castShadow = true;
    this.sun = sun;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -W - 2, right: W + 2, top: D + 4, bottom: -D - 4, near: 1, far: 50 });
    s.add(sun);

    // Floor: checker of two soft blues inside a teal border, outside darker.
    const fc = document.createElement('canvas'); fc.width = fc.height = 256;
    const fg = fc.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      fg.fillStyle = (x + y) % 2 ? '#2b3b74' : '#33478a'; fg.fillRect(x * 32, y * 32, 32, 32);
    }
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(1 / 8, 1 / 8);   // shape UVs are in metres
    ft.magFilter = THREE.NearestFilter;
    // The floor has four holes: the foam pits under the answer pads (play.js).
    // Shape coordinates (x, y) become world (x, 0, -y) after the rotation.
    const rect = (x0, y0, x1, y1, path) => { path.moveTo(x0, y0); path.lineTo(x1, y0); path.lineTo(x1, y1); path.lineTo(x0, y1); path.lineTo(x0, y0); return path; };
    const floorShape = rect(-W, -D, W, D, new THREE.Shape());
    for (const x of PADS.x) floorShape.holes.push(rect(x - PADS.half, -PADS.z - PADS.half, x + PADS.half, -PADS.z + PADS.half, new THREE.Path()));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), new THREE.MeshLambertMaterial({ map: ft }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const outerShape = rect(-60, -60, 60, 60, new THREE.Shape());
    outerShape.holes.push(rect(-W, -D, W, D, new THREE.Path()));
    const outer = new THREE.Mesh(new THREE.ShapeGeometry(outerShape), new THREE.MeshLambertMaterial({ color: '#131c3d' }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; s.add(outer);

    // Low walls on three sides (front stays open for the camera), teal top edge.
    const wallMat = new THREE.MeshLambertMaterial({ color: '#1d2a5c' });
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#2ee6c0' });
    const wall = (x, z, w, d, h = 1.2) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; s.add(m);
      const e = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), edgeMat);
      e.position.set(x, h + 0.04, z); s.add(e);
    };
    wall(0, -D - 0.25, W * 2 + 1, 0.5, 4.5);
    wall(-W - 0.25, 0, 0.5, D * 2, 1.2);
    wall(W + 0.25, 0, 0.5, D * 2, 1.2);

    // The big screen on the back wall.
    this.screenMat = new THREE.MeshBasicMaterial({ map: logoTexture() });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.2), this.screenMat);
    screen.position.set(0, 7.2, -D - 0.1); s.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(12.8, 6, 0.3), new THREE.MeshLambertMaterial({ color: '#0a0f24' }));
    frame.position.set(0, 7.2, -D - 0.3); s.add(frame);
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W * 2 + 1, 10), new THREE.MeshLambertMaterial({ color: '#18224a' }));
    backWall.position.set(0, 7, -D - 0.5); s.add(backWall);

    this.play = new PlayArea(s);
    this.frozen = false;

    // Bulb strips beside the screen.
    this.bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.14, 10, 8);
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffcf5e' }));
      b.position.set(side * 7, 4.8 + i * 0.7, -D - 0.05); s.add(b); this.bulbs.push(b);
    }
  }

  async load() {
    await loadClips();
    const fur = await Promise.all(FURNITURE.map((f) => loader.loadAsync(`assets/furniture/${f}.gltf`).then((g) => lambert(g.scene))));
    const F = Object.fromEntries(FURNITURE.map((f, i) => [f, fur[i]]));
    const put = (name, x, z, rot = 0, sc = 1.6, solid = 0) => {
      const o = F[name].clone(true); o.position.set(x, 0, z); o.rotation.y = rot; o.scale.setScalar(sc);
      this.scene.add(o);
      if (solid) SOLIDS.push([x, z, solid]);
    };
    SOLIDS.length = 0;
    put('couch_pillows', -11.5, -7.5, 0, 2, 1.6);
    put('armchair_pillows', 12, -6.5, -0.5, 2, 1.0);
    put('table_low_decorated', -9, -5, 0, 1.8, 0.9);
    put('lamp_standing', -14, -9, 0, 2.2, 0.4);
    put('lamp_standing', 14, -9, 0, 2.2, 0.4);
    put('shelf_B_large_decorated', -4.5, -9.4, 0, 1.8, 0);
    put('shelf_B_large_decorated', 4.5, -9.4, 0, 1.8, 0);
    put('cactus_medium_A', 13.5, 8.5, 0, 2, 0.5);
    put('cactus_medium_A', -14, -4, 1, 1.8, 0.5);
    // Compile the shaders now (behind the join screen), not on the first frames in the room.
    try { await this.renderer.compileAsync(this.scene, this.camera); } catch (_) { /* older browsers */ }
  }

  // The big screen: the logo, or a question (bonus round) in big letters.
  setScreen(text = null) {
    this.screenMat.map?.dispose();
    if (!text) { this.screenMat.map = logoTexture(); this.screenMat.needsUpdate = true; return; }
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#f7f9ff'; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffcf5e'; g.fillRect(0, 0, 1024, 90);
    g.fillStyle = '#3a2600'; g.font = '700 58px "Fredoka One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.title || '', 512, 48);
    g.fillStyle = '#0d1b3d';
    let size = 110;
    g.font = `700 ${size}px "Fredoka One", sans-serif`;
    // Wrap long sentences on two lines.
    const words = text.line.split(' ');
    let lines = [text.line];
    while (size > 40) {
      g.font = `700 ${size}px "Fredoka One", sans-serif`;
      if (g.measureText(text.line).width <= 960) { lines = [text.line]; break; }
      const half = Math.ceil(words.length / 2);
      lines = [words.slice(0, half).join(' '), words.slice(half).join(' ')];
      if (Math.max(...lines.map((l) => g.measureText(l).width)) <= 960) break;
      size -= 8;
    }
    lines.forEach((l, i) => g.fillText(l, 512, 300 + (i - (lines.length - 1) / 2) * size * 1.1));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    this.screenMat.map = t; this.screenMat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- avatars
  syncPlayers(list, myPid) {
    this.myPid = myPid;
    const seen = new Set();
    for (const info of list) {
      seen.add(info.pid);
      let a = this.avatars.get(info.pid);
      if (!a) {
        a = new Avatar(this, info);
        const spawn = info.pid === myPid ? randomSpawn() : null;
        if (spawn) { a.root.position.copy(spawn); a.target.copy(spawn); }
        this.avatars.set(info.pid, a);
        if (info.pid === myPid) this.me = a;
      } else a.setInfo(info);
    }
    for (const [pid, a] of this.avatars) if (!seen.has(pid)) { a.dispose(); this.avatars.delete(pid); }
  }

  applyPositions(s) {
    for (const [pid, x, y, z, r, an] of s) {
      const a = this.avatars.get(pid);
      if (!a || a === this.me) continue;
      const first = a.target.lengthSq() === 0 && a.root.position.lengthSq() === 0;
      a.target.set(x, y, z); a.targetRot = r;
      if (first) { a.root.position.set(x, y, z); a.root.rotation.y = r; }
      if (a.anim !== an) a.setAnim(an);
    }
  }

  // marks: Map pid → 'dot' | 'think' | null
  setMarks(fn) { for (const [pid, a] of this.avatars) a.setMark(fn(pid)); }

  // ---------------------------------------------------------------- frame
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Automatic quality steps for slow devices (a full class on cheap Chromebooks): if the
  // frame rate stays under ~24 fps for 4 s, first render at 1× pixel ratio, then switch
  // the sun's shadows off. Never goes back up (no flicker between steps).
  adapt(dt) {
    if (this.quality >= 2) return;
    this.slowT = (this.slowT || 0) + (dt > 0.042 ? dt : -dt * 0.5);
    this.slowT = Math.max(0, this.slowT);
    if (this.slowT < 4) return;
    this.slowT = 0;
    this.quality = (this.quality || 0) + 1;
    if (this.quality === 1) { this.renderer.setPixelRatio(1); this.resize(); }
    if (this.quality === 2) { this.sun.castShadow = false; }
    console.info('[quiz-room] quality step', this.quality);
  }

  update(dt) {
    dt = Math.max(0, dt);
    this.time += dt;
    this.adapt(dt);
    this.bulbs.forEach((b, i) => { b.material.color.setHSL(0.12, 1, (Math.sin(this.time * 4 - i * 0.7) > 0.2) ? 0.72 : 0.32); });
    for (const a of this.avatars.values()) a.update(dt, a !== this.me);
    this.play.update(dt, this.avatars.values(), this.mode === 'child' ? this.me : null, this.frozen);
    // Camera: child = follows its own avatar from behind and above; teacher = overview.
    let pos, look;
    if (this.mode === 'teacher' || !this.me) {
      const k = Math.max(1, (16 / 9) / this.camera.aspect);
      pos = new THREE.Vector3(0, 25 * k, 25 * k); look = new THREE.Vector3(0, 0, 5.5); // room in the upper part, panels below
    } else {
      const p = this.me.root.position;
      pos = new THREE.Vector3(p.x * 0.85, 9.5, p.z + 12); look = new THREE.Vector3(p.x * 0.9, 1.2, p.z - 2);
    }
    const e = Math.min(1, Math.max(0, 1 - Math.exp(-dt * 4)));   // never outside 0..1 (a negative dt made the camera fly off)
    this.camPos.lerp(pos, e); this.camLook.lerp(look, e);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
  }
}

function randomSpawn() {
  return new THREE.Vector3((Math.random() - 0.5) * 10, 0, 2 + Math.random() * 5);
}

// ------------------------------------------------------------------ local player
// Moves the child's own avatar: WASD / arrows, Shift = run, Space = jump. Screen
// directions (the camera looks straight ahead), so "up" is always into the room.
// Uses the play area for ground heights: steps and the tower, the slide (pushes you
// down), trampolines (landing = big bounce) and the ball pit (sink in, slower).
export class Controller {
  constructor(room) {
    this.room = room;
    this.keys = new Set();
    this.vy = 0; this.enabled = true;
    this.anim = ANIM.idle;
    this.push = new THREE.Vector2();   // slide momentum
    this.touch = { x: 0, z: 0 };       // touch stick (src/touch.js)
    this.touchRun = false; this.touchJump = false;
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift'].includes(k)) {
        this.keys.add(k);
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  teleport(v) {
    const a = this.room.me;
    if (!a) return;
    a.root.position.copy(v); this.vy = 0; this.push.set(0, 0);
  }

  update(dt) {
    const a = this.room.me;
    if (!a) return;
    const play = this.room.play;
    const k = this.keys;
    let x = 0, z = 0;
    if (this.enabled) {
      if (k.has('a') || k.has('arrowleft')) x -= 1;
      if (k.has('d') || k.has('arrowright')) x += 1;
      if (k.has('w') || k.has('arrowup')) z -= 1;
      if (k.has('s') || k.has('arrowdown')) z += 1;
      x += this.touch.x; z += this.touch.z;
    }
    const len = Math.hypot(x, z);
    const run = k.has('shift') || this.touchRun;
    const p = a.root.position;
    const here = play.ground(p.x, p.z, p.y);
    const onGround = p.y <= here.h + 0.02;
    let speed = run ? 7.5 : 4.6;
    if (here.kind === 'pit' && onGround) speed *= 0.55;

    // Horizontal move, axis by axis so you slide along box sides.
    let mx = 0, mz = 0;
    if (len > 0.1) {
      mx = (x / Math.max(1, len)) * speed * dt; mz = (z / Math.max(1, len)) * speed * dt;
      let d = Math.atan2(x, z) - a.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.root.rotation.y += d * Math.min(1, dt * 12);
    }
    // The slide pushes you down (+z); momentum fades on other ground.
    if (here.kind === 'slide' && onGround) this.push.y = Math.min(12, this.push.y + 16 * dt);
    else this.push.multiplyScalar(Math.exp(-dt * (onGround ? 3 : 0.5)));
    mx += this.push.x * dt; mz += this.push.y * dt;
    const prev = { x: p.x, z: p.z };
    if (!play.blocked(p.x + mx, p.z, p.y)) p.x += mx;
    if (!play.blocked(p.x, p.z + mz, p.y)) p.z += mz;
    play.clampPit(p, prev);
    a.speed = Math.hypot(mx, mz) / Math.max(dt, 1e-3);

    // Jump, gravity, ground.
    if (this.enabled && (k.has(' ') || this.touchJump) && onGround) this.vy = 6.5;
    this.vy -= 18 * dt;
    p.y += this.vy * dt;
    const g = play.ground(p.x, p.z, Math.max(p.y, here.h));
    if (p.y <= g.h) {
      if (g.kind === 'tramp' && this.vy < -2) {
        this.vy = Math.min(14, -this.vy * 0.9 + 4);   // bounce higher each time, up to a limit
        play.bounce(play.trampAt(p.x, p.z));
        p.y = g.h;
      } else {
        p.y = g.h; this.vy = Math.max(this.vy, 0);
      }
    }
    // Walls and furniture.
    p.x = Math.max(-W + 0.6, Math.min(W - 0.6, p.x));
    p.z = Math.max(-D + 0.6, Math.min(D - 0.4, p.z));
    for (const [sx, sz, r] of SOLIDS) {
      const dx = p.x - sx, dz = p.z - sz, dd = Math.hypot(dx, dz), min = r + 0.45;
      if (dd < min && dd > 1e-4) { p.x = sx + dx / dd * min; p.z = sz + dz / dd * min; }
    }
    const air = p.y > g.h + 0.05;
    const anim = air ? ANIM.jump : len > 0.1 ? (run ? ANIM.run : ANIM.walk) : ANIM.idle;
    if (anim !== this.anim) { this.anim = anim; a.setAnim(anim); }
  }

  // What to send to the server.
  state() {
    const a = this.room.me;
    if (!a) return null;
    const p = a.root.position;
    return { p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: +a.root.rotation.y.toFixed(2), a: this.anim };
  }
}
