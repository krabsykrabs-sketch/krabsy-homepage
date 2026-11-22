// The 3D TV studio: the backdrop only. Question, answer boxes and team labels are HTML
// over the canvas (main.js), so text stays sharp on any projector.
// Layout: podiums in a row at z = 0, the host on a small stage to the left, the big
// screen behind them, furniture at the sides. Camera: one wide shot; short moves happen
// only between questions (reveal, standings), never while the class reads.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const CHAR_FILES = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch'];
const HOST_FILE = 'Superhero';
const FURNITURE = ['couch_pillows', 'lamp_standing', 'shelf_B_large_decorated', 'rug_oval_A',
  'cactus_medium_A', 'pictureframe_large_A', 'armchair_pillows', 'table_low_decorated'];

class Char {
  constructor(template, clips) {
    this.root = cloneSkinned(template);
    this.root.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const [n, c] of Object.entries(clips)) this.actions[n] = this.mixer.clipAction(c);
    this.current = null; this.queue = null; this.bob = 0;
    this.mixer.addEventListener('finished', () => {
      if (this.queue) { const q = this.queue; this.queue = null; this.play(q.name, q.opts); }
    });
  }
  play(name, { once = false, fade = 0.2, speed = 1, reps = 1, then = 'Idle_A' } = {}) {
    const next = this.actions[name];
    if (!next) return;
    const prev = this.current && this.actions[this.current];
    next.reset();
    next.setLoop(once ? THREE.LoopRepeat : THREE.LoopRepeat, once ? reps : Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.play();
    if (prev && prev !== next) prev.crossFadeTo(next, fade, false);
    this.current = name;
    this.queue = once ? { name: then, opts: {} } : null;
  }
  cheer() { this.play('Jump_Full_Short', { once: true, reps: 3, speed: 1.15 }); }
  sad() { this.play('Hit_A', { once: true, then: 'Idle_B' }); }
  idle() { this.play('Idle_A'); }
}

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

// The big screen's idle picture: a logo drawn into a canvas texture.
function logoTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1024, 512);
  grd.addColorStop(0, '#1b3d78'); grd.addColorStop(1, '#3a1d6e');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  g.globalAlpha = 0.12; g.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(512, 256); g.arc(512, 256, 900, i * Math.PI / 7, (i + 0.5) * Math.PI / 7); g.fill(); }
  g.globalAlpha = 1; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 120px "Fredoka One", sans-serif'; g.fillStyle = '#ffcf5e';
  g.fillText('KRABSY', 512, 210);
  g.font = '700 84px "Fredoka One", sans-serif'; g.fillStyle = '#2ee6c0';
  g.fillText('QUIZ SHOW', 512, 320);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Studio {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b1430');
    this.scene.fog = new THREE.Fog('#0b1430', 26, 60);
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
    this.wide = { pos: new THREE.Vector3(0, 6.2, 16.5), look: new THREE.Vector3(0, 5.5, 0) };
    this.camPos = this.wide.pos.clone(); this.camLook = this.wide.look.clone();
    this.target = { pos: this.wide.pos.clone(), look: this.wide.look.clone() };
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.chars = []; this.podiums = []; this.spots = []; this.confetti = null;
    this.time = 0;
    this._build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _build() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#bcd4ff', '#2a1d48', 1.1));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(4, 12, 9); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -6, near: 1, far: 40 });
    s.add(key);

    // Floor: dark glossy stage disc on a darker studio floor, with a glowing rim.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshLambertMaterial({ color: '#141d3d' }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.3, 0.4, 64),
      new THREE.MeshPhongMaterial({ color: '#24305e', shininess: 80, specular: '#556' }));
    stage.position.y = 0.2; stage.receiveShadow = true; s.add(stage);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(11.15, 0.08, 8, 96),
      new THREE.MeshBasicMaterial({ color: '#2ee6c0' }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.41; s.add(rim);
    this.rim = rim;

    // Back wall with the big screen.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshLambertMaterial({ color: '#18224a' }));
    wall.position.set(0, 10, -9); s.add(wall);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(15.6, 8.4, 0.3), new THREE.MeshLambertMaterial({ color: '#0a0f24' }));
    frame.position.set(0, 7.2, -8.7); s.add(frame);
    this.screenMat = new THREE.MeshBasicMaterial({ map: logoTexture() });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(15, 7.8), this.screenMat);
    screen.position.set(0, 7.2, -8.5); s.add(screen);
    // Light strips around the screen (they flash on reveals).
    this.strips = [];
    for (const [x, y, w, h] of [[0, 11.55, 16.2, 0.18], [0, 2.85, 16.2, 0.18], [-8.1, 7.2, 0.18, 8.7], [8.1, 7.2, 0.18, 8.7]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: '#ffcf5e' }));
      m.position.set(x, y, -8.45); s.add(m); this.strips.push(m);
    }
    // Columns of bulbs at the sides of the wall.
    this.bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.16, 10, 8);
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffcf5e' }));
      b.position.set(side * 10.5, 1.5 + i * 1.15, -8.6); s.add(b); this.bulbs.push(b);
    }

    // Stage lights: beams from above (additive cones) that sway.
    const beamGeo = new THREE.ConeGeometry(2.2, 16, 24, 1, true);
    beamGeo.translate(0, -8, 0);
    const colors = ['#2ee6c0', '#ff8585', '#ffcf5e', '#b18cff', '#2ee6c0', '#ff8585'];
    colors.forEach((c, i) => {
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.set(-12.5 + i * 5, 16, -5); s.add(beam);
      this.spots.push({ beam, phase: i * 1.3 });
    });
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    const files = [...CHAR_FILES.map((f) => `assets/chars/${f}.glb`), `assets/chars/${HOST_FILE}.glb`,
      'assets/anim/Rig_Medium_General.glb', 'assets/anim/Rig_Medium_MovementBasic.glb',
      ...FURNITURE.map((f) => `assets/furniture/${f}.gltf`)];
    let done = 0;
    const res = await Promise.all(files.map((f) => loader.loadAsync(f).then((g) => { done++; onProgress?.(done / files.length); return g; })));
    this.charTpl = res.slice(0, 4).map((g) => lambert(g.scene));
    this.hostTpl = lambert(res[4].scene);
    this.clips = {};
    for (const a of [...res[5].animations, ...res[6].animations]) this.clips[a.name] = a;
    this.furn = {};
    FURNITURE.forEach((f, i) => { this.furn[f] = lambert(res[7 + i].scene); });
    this._dress();
    // Host on a small stage at the left front.
    this.host = new Char(this.hostTpl, this.clips);
    this.host.root.position.set(-8.4, 0.4, 3.2);
    this.host.root.rotation.y = 0.55;
    this.host.root.scale.setScalar(1.35);
    this.scene.add(this.host.root); this.host.idle();
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.3, 32), new THREE.MeshLambertMaterial({ color: '#ffcf5e' }));
    plinth.position.set(-8.4, 0.25, 3.2); this.scene.add(plinth);
  }

  _dress() {
    const put = (name, x, z, rot = 0, sc = 1.6, y = 0) => {
      const o = this.furn[name].clone(true); o.position.set(x, y, z); o.rotation.y = rot; o.scale.setScalar(sc);
      this.scene.add(o); return o;
    };
    put('couch_pillows', -15, -4, 0.5, 2);
    put('armchair_pillows', 15.5, -3.5, -0.6, 2);
    put('table_low_decorated', -12.8, -1.5, 0.3, 1.8);
    put('lamp_standing', -17.5, -6.5, 0, 2.2);
    put('lamp_standing', 17.5, -6.5, 0, 2.2);
    put('shelf_B_large_decorated', -13.5, -8.2, 0, 2);
    put('shelf_B_large_decorated', 13.5, -8.2, 0, 2);
    put('cactus_medium_A', 12.3, -6, 0, 2);
    put('cactus_medium_A', -11.6, -6.5, 1, 1.8);
    put('rug_oval_A', 13.5, -1.8, 0.2, 2.2);
  }

  // Podiums with one contestant each. teams: [{ color }]
  setTeams(teams) {
    for (const p of this.podiums) this.scene.remove(p.group);
    this.podiums = []; this.chars = [];
    const n = teams.length, gap = n === 2 ? 6.4 : n === 3 ? 5.4 : 4.4;
    teams.forEach((t, i) => {
      const x = (i - (n - 1) / 2) * gap + 1.2;
      const g = new THREE.Group(); g.position.set(x, 0.4, 0.6);
      const col = new THREE.Color(t.color);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 1.6, 6),
        new THREE.MeshLambertMaterial({ color: '#1e2a55' }));
      body.position.y = 0.8; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.29, 1.33, 0.38, 6),
        new THREE.MeshBasicMaterial({ color: col }));
      band.position.y = 1.15; g.add(band);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 6),
        new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.7) }));
      top.position.y = 1.66; top.receiveShadow = true; g.add(top);
      // Buzzer lamp on the front (lights up when the team buzzes / locks in).
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#33406e' }));
      lamp.position.set(0, 1.72, 0.85); g.add(lamp);
      const light = new THREE.PointLight(col, 0, 6);
      light.position.set(0, 3.2, 1.6); g.add(light);
      this.scene.add(g);
      const c = new Char(this.charTpl[i % 4], this.clips);
      c.root.position.set(0, 1.72, -0.1); c.root.scale.setScalar(1.15);
      g.add(c.root); c.idle();
      c.mixer.setTime(Math.random() * 2);
      this.chars.push(c);
      this.podiums.push({ group: g, band, lamp, light, color: col, glow: 0, lift: 0, liftTarget: 0 });
    });
  }

  // Screen position (px) of a point above/below a podium, for the HTML labels.
  podiumScreen(i, y = 0) {
    const p = this.podiums[i];
    if (!p) return null;
    const v = new THREE.Vector3(0, y, 0.9);
    p.group.localToWorld(v); v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }

  lamp(i, on) { const p = this.podiums[i]; if (p) p.glow = on ? 1 : 0; }
  lampsOff() { this.podiums.forEach((p) => { p.glow = 0; }); }
  cheer(i) { this.chars[i]?.cheer(); this.lamp(i, true); }
  sad(i) { this.chars[i]?.sad(); }
  hostTalk() { this.host?.play('Interact', { once: true }); }
  hostCheer() { this.host?.cheer(); }

  // Standings: podiums rise by rank (0 = lowest).
  setLift(lifts) { this.podiums.forEach((p, i) => { p.liftTarget = lifts ? lifts[i] : 0; }); }

  flash(color = '#ffcf5e') { this.flashT = 1; this.flashCol = new THREE.Color(color); }

  focus(i) { // short camera push toward a podium (between questions only)
    if (i == null || !this.podiums[i]) { this.target.pos.copy(this.wide.pos); this.target.look.copy(this.wide.look); return; }
    const x = this.podiums[i].group.position.x;
    this.target.pos.set(this.wide.pos.x + x * 0.25, this.wide.pos.y - 0.4, this.wide.pos.z - 1.5);
    this.target.look.set(x * 0.35, this.wide.look.y - 0.3, 0);
  }

  clearConfetti() { if (this.confetti) this.confetti.visible = false; }

  confettiBurst(colors = ['#2ee6c0', '#ff8585', '#ffcf5e', '#b18cff', '#ffffff']) {
    const N = 420;
    if (!this.confetti) {
      const geo = new THREE.PlaneGeometry(0.22, 0.12);
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      this.confetti = new THREE.InstancedMesh(geo, mat, N);
      this.confetti.frustumCulled = false;
      this.scene.add(this.confetti);
      this.cf = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
    }
    const c = new THREE.Color();
    this.cf.forEach((k, i) => {
      k.p.set((Math.random() - 0.5) * 22, 13 + Math.random() * 5, (Math.random() - 0.5) * 6 - 1);
      k.v.set((Math.random() - 0.5) * 2, -1 - Math.random() * 2.5, (Math.random() - 0.5));
      k.w.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      k.life = 5 + Math.random() * 2;
      this.confetti.setColorAt(i, c.set(colors[i % colors.length]));
    });
    this.confetti.instanceColor.needsUpdate = true;
    this.confetti.visible = true;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Narrower than 16:9: pull back so all podiums stay in the frame.
    const k = Math.max(1, (16 / 9) / this.camera.aspect);
    this.wide.pos.set(0, 6.2 + (k - 1) * 3, 16.5 * k);
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    const e = 1 - Math.exp(-dt * 2.2);
    this.camPos.lerp(this.target.pos, e); this.camLook.lerp(this.target.look, e);
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    for (const sp of this.spots) {
      sp.beam.rotation.z = Math.sin(t * 0.5 + sp.phase) * 0.35;
      sp.beam.rotation.x = 0.25 + Math.sin(t * 0.37 + sp.phase) * 0.12;
    }
    this.bulbs.forEach((b, i) => { b.material.color.setHSL(0.12, 1, (Math.sin(t * 4 - i * 0.7) > 0.2) ? 0.7 : 0.3); });
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 1.2);
      const on = Math.sin(this.flashT * 30) > 0;
      for (const s of this.strips) s.material.color.copy(on ? this.flashCol : new THREE.Color('#ffcf5e'));
      this.rim.material.color.copy(on ? this.flashCol : new THREE.Color('#2ee6c0'));
    }
    for (const p of this.podiums) {
      const pulse = p.glow ? 0.75 + 0.25 * Math.sin(t * 8) : 0;
      p.lamp.material.color.copy(p.glow ? p.color : new THREE.Color('#33406e')).multiplyScalar(p.glow ? 1 : 1);
      p.light.intensity += ((p.glow ? 14 * pulse : 0) - p.light.intensity) * Math.min(1, dt * 10);
      p.lift += (p.liftTarget - p.lift) * Math.min(1, dt * 3);
      p.group.position.y = 0.4 + p.lift;
    }
    for (const c of this.chars) c.mixer.update(dt);
    this.host?.mixer.update(dt);
    if (this.confetti?.visible) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
      let alive = 0;
      this.cf.forEach((k, i) => {
        k.life -= dt;
        if (k.life > 0) alive++;
        k.v.y = Math.max(k.v.y - dt * 1.5, -2.6);
        k.p.addScaledVector(k.v, dt); k.p.x += Math.sin(t * 2 + i) * dt * 0.6;
        k.r.x += k.w.x * dt; k.r.y += k.w.y * dt; k.r.z += k.w.z * dt;
        m.compose(k.p, q.setFromEuler(k.r), k.life > 0 && k.p.y > 0 ? one : new THREE.Vector3(0, 0, 0));
        this.confetti.setMatrixAt(i, m);
      });
      this.confetti.instanceMatrix.needsUpdate = true;
      if (!alive) this.confetti.visible = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
