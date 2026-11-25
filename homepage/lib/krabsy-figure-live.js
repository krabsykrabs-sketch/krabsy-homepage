/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — one live 3D figure on a normal page (not in a game).

   Used by the landing pages (krabsy-landing-figure.js: the figure standing
   freely next to the featured game) and the profile page (krabsy-profile.js:
   the figure on its stage). This file is small and has NO static three.js
   import: a page first asks liveFigureAllowed() / hasWebGL() (cheap), and
   only createLiveFigure() loads three.js (0.7 MB), krabsy-figure.js, one
   character and a small animation file (idle + jump). The page needs the import map
   for 'three' and 'three/addons/'.

     const live = await createLiveFigure({ canvas, box, config });
     live.play('Interact');            // a one-shot clip over the idle loop
     live.wave();                      // wave with the right hand
     live.spin(0.9);                   // one turn around itself
     live.hop(0.5);                    // a little jump (procedural)
     await live.setFigure(config);     // another figure on the same spot

   The loop draws at most `fps` frames a second and stops while the tab is
   hidden or the box is off-screen. Nothing here throws into the page: the
   caller wraps createLiveFigure() in try/catch and keeps its picture.
   ────────────────────────────────────────────────────────────────────────── */

/** Cheap checks before any 3D file is loaded. false = keep the picture.
    reason: 'save-data' | 'reduced-motion' | 'slow-network' | 'small-device' | null */
export function liveFigureBlocked({ motion = true } = {}) {
  try {
    const c = navigator.connection || {};
    if (c.saveData) return 'save-data';
    if (motion && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced-motion';
    if (c.effectiveType === 'slow-2g' || c.effectiveType === '2g') return 'slow-network';
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'small-device';
  } catch (_) { /* unknown: allowed */ }
  return null;
}

/** Is there WebGL? strict = only with a real graphics chip (no software drawing, which
    would keep a slow computer's processor busy). Uses a throw-away canvas. */
export function hasWebGL(strict = false) {
  try {
    const c = document.createElement('canvas');
    const attrs = { failIfMajorPerformanceCaveat: strict };
    const gl = c.getContext('webgl2', attrs) || c.getContext('webgl', attrs);
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch (_) { return false; }
}

/** Run fn after the page has loaded and the browser is idle. */
export function whenIdle(fn, timeout = 2500) {
  const idle = () => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}

/**
 * opts.canvas     the <canvas> (transparent)
 * opts.box        the element whose size the canvas follows (default: the canvas)
 * opts.config     figure config (krabsy-figure.js); default: the child's own figure
 * opts.configFrom (F) => config, when the config needs krabsy-figure.js (F) to be made
 * opts.fps        frames per second, default 30
 * opts.maxRatio   cap for devicePixelRatio, default 2
 * opts.maxSize    cap for the longer side of the drawing buffer in px, default 640
 * opts.still      true = no running animation (reduced motion): one pose, redrawn on kick()
 * opts.shadow     true = a soft round shadow under the feet
 * opts.sets       animation files to load now, default ['Mini'] (Idle_A + Jump_Full_Short,
 *                 0.06 MB); the games' full files are 'General' and 'MovementBasic' (1.5 MB)
 * opts.place      (camera, aspect) => void — where the camera stands (called on resize)
 * opts.lights     { sky, ground, hemi, sun } colours / strengths
 *
 * → { THREE, F, scene, camera, renderer, turn, clips, config,
 *     yaw, kick(), play(), wave(), spin(), hop(), busy, setFigure(), addClips(), onTick(), dispose() }
 */
export async function createLiveFigure(opts) {
  const { canvas } = opts;
  const box = opts.box || canvas;
  const fps = opts.fps || 30, still = !!opts.still;
  const [THREE, F] = await Promise.all([import('three'), import('/lib/krabsy-figure.js')]);
  const loadSet = (n) => (F.loadClipSet ? F.loadClipSet(n) : F.loadClips());   // an older cached krabsy-figure.js
  const sets = opts.sets || ['Mini'];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearAlpha(0);
  const scene = new THREE.Scene();
  const L = { sky: '#dfe9ff', ground: '#3a2d58', hemi: 1.5, sun: 1.6, ...(opts.lights || {}) };
  scene.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemi));
  const sun = new THREE.DirectionalLight('#ffffff', L.sun); sun.position.set(3, 6, 5); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const turn = new THREE.Group(); scene.add(turn);

  let blob = null;
  if (opts.shadow) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(38,36,60,0.34)'); grad.addColorStop(0.6, 'rgba(38,36,60,0.14)'); grad.addColorStop(1, 'rgba(38,36,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blob = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.01; scene.add(blob);
  }

  const clips = {};
  const addClips = async (name) => Object.assign(clips, await loadSet(name));

  // ---- the figure on the spot (replaced by setFigure)
  let fig = null, mixer = null, idle = null, hips = null, oneShot = null;
  const bones = {}, poses = [];
  function mount(next) {
    if (fig) { turn.remove(fig.root); mixer.stopAllAction(); fig.dispose(); }
    fig = next; turn.add(fig.root);
    for (const k of Object.keys(bones)) delete bones[k];
    fig.root.traverse((o) => { if (o.isBone && !bones[o.name]) bones[o.name] = o; });
    hips = bones.hips || null;
    mixer = new THREE.AnimationMixer(fig.root);
    mixer.addEventListener('finished', (e) => {
      if (e.action !== oneShot) return;
      oneShot = null;
      if (idle) { idle.reset().fadeIn(0.25).play(); e.action.fadeOut(0.25); } else e.action.stop();
    });
    idle = clips.Idle_A ? mixer.clipAction(clips.Idle_A) : null;
    if (idle) idle.play();
    if (still) mixer.update(0.4);
  }
  const build = (config) => F.buildFigure(config || F.playerConfig() || F.DEFAULT);
  const [first] = await Promise.all([build(opts.config || (opts.configFrom && opts.configFrom(F))), ...sets.map(addClips)]);
  mount(first);

  // ---- moves
  let yaw = opts.yaw || 0, spinT = null, hopT = null, waveT = null;
  const qa = new THREE.Quaternion(), ea = new THREE.Euler();
  /** Play a clip once over the idle loop. false when the clip isn't loaded (yet). */
  function play(name, { fade = 0.15 } = {}) {
    if (still || !clips[name] || !mixer) return false;
    const a = mixer.clipAction(clips[name]);
    if (oneShot && oneShot !== a) oneShot.fadeOut(fade);
    a.reset().setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.fadeIn(fade).play();
    if (idle) idle.fadeOut(fade);
    oneShot = a; kick();
    return true;
  }
  /** One turn around itself in `dur` seconds; half() is called once, at the back view. */
  function spin(dur = 0.9, { half = null, squash = 0 } = {}) {
    if (still) { if (half) half(); kick(); return; }
    spinT = { t: 0, dur, half, squash }; kick();
  }
  /** A small jump straight up (height in scene units; the figure is about 2 tall). */
  function hop(height = 0.45, dur = 0.5, delay = 0) {
    if (still) return;
    hopT = { t: -delay, dur, height }; kick();
  }
  /** Wave with the right hand for `dur` seconds. The shared animation files have no wave,
      so the arm bones are turned on top of the running clip (values found by eye). */
  function wave(dur = 1.7) {
    if (still || !bones.upperarmr || !bones.lowerarmr) return false;
    waveT = { t: 0, dur }; kick();
    return true;
  }
  function waveArm() {
    const { t, dur } = waveT;
    const w = Math.min(1, t / 0.22, (dur - t) / 0.28);              // arm up, wave, arm down
    const k = w * w * (3 - 2 * w);
    ea.set(1.75, 0, -0.45); qa.setFromEuler(ea).premultiply(bones.upperarmr.quaternion);
    bones.upperarmr.quaternion.slerp(qa, k);
    ea.set(0, 0, -0.55 + 0.5 * Math.sin(t * 12.5)); qa.setFromEuler(ea).premultiply(bones.lowerarmr.quaternion);
    bones.lowerarmr.quaternion.slerp(qa, k);
  }
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  function step(dt) {
    let extra = 0, s = 1, y = 0;
    if (spinT) {
      spinT.t += dt;
      const k = Math.min(1, spinT.t / spinT.dur);
      if (spinT.half && k >= 0.5) { const h = spinT.half; spinT.half = null; h(); }
      extra = ease(k) * Math.PI * 2;
      s = 1 - spinT.squash * Math.sin(Math.PI * k);
      if (k >= 1) spinT = null;
    }
    if (hopT) {
      hopT.t += dt;
      const k = Math.min(1, Math.max(0, hopT.t / hopT.dur));
      y = hopT.height * 4 * k * (1 - k);
      if (k >= 1) hopT = null;
    }
    turn.rotation.y = yaw + extra; turn.scale.setScalar(s); turn.position.y = y;
    mixer.update(dt);
    if (waveT) { waveT.t += dt; if (waveT.t >= waveT.dur) waveT = null; else waveArm(); }
    for (const fn of poses) fn(dt, bones);
    if (blob) {
      // the shadow shrinks and fades while the figure is in the air
      const up = y + (hips ? Math.max(0, hips.position.y - 0.42) : 0);
      const k = 1 / (1 + up * 1.4);
      blob.scale.setScalar(k * s); blob.material.opacity = k;
    }
  }

  // ---- loop: at most `fps` frames a second, only while visible
  const ticks = [];
  let visible = true, raf = 0, last = 0, disposed = false, held = null;
  const gap = 1000 / fps - 4;
  function draw(dt) {
    for (const fn of ticks) fn(dt);
    step(dt);
    renderer.render(scene, camera);
  }
  function frame(now) {
    raf = 0;
    if (disposed) return;
    const el = now - last;
    if (el >= gap) {
      last = now;
      draw(still && !held ? 0 : Math.min(0.1, el / 1000));
    }
    // (a move started inside draw() has already asked for the next frame via kick())
    if (!raf && visible && !document.hidden && (!still || held)) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !disposed) { if (!last || performance.now() - last > 200) last = performance.now() - gap; raf = requestAnimationFrame(frame); } }

  function resize() {
    const r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const maxRatio = opts.maxRatio || 2, maxSize = opts.maxSize || 640;
    const ratio = Math.min(devicePixelRatio || 1, maxRatio, maxSize / Math.max(r.width, r.height));
    renderer.setPixelRatio(ratio);
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    if (opts.place) opts.place(camera, camera.aspect);
    camera.updateProjectionMatrix();
    draw(0);
  }
  let ro = null, io = null;
  try { ro = new ResizeObserver(resize); ro.observe(box); } catch (_) { addEventListener('resize', resize); }
  try { io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }); io.observe(box); } catch (_) { /* always on */ }
  const onVis = () => kick();
  document.addEventListener('visibilitychange', onVis);
  resize();
  kick();

  return {
    THREE, F, scene, camera, renderer, turn, clips,
    get config() { return fig.config; },
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    /** true while a one-shot clip, a spin or a hop is running */
    get busy() { return !!(oneShot || spinT || hopT || waveT); },
    /** keep the loop running in `still` mode (while the child drags the figure) */
    hold(on) { held = on || null; if (on) kick(); },
    kick, play, spin, hop, wave, addClips, resize,
    /** fn(dt) runs before every drawn frame; return value ignored */
    onTick(fn) { ticks.push(fn); },
    /** fn(dt, bones) runs after the animation, before drawing: turn single bones on top
        of the running clip (bones by name: upperarmr, lowerarmr, head …) */
    onPose(fn) { poses.push(fn); },
    async setFigure(config, { at = null } = {}) {
      const next = await build(config);
      if (disposed) { next.dispose(); return; }
      if (at) at(() => mount(next)); else { mount(next); kick(); }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      if (fig) fig.dispose();
      renderer.dispose();
    },
  };
}
