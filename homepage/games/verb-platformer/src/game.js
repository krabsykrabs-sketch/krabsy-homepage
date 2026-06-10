import * as THREE from 'three';
import { initPhysics } from './physics.js';
import { createControls } from './controls.js';
import { createFollowCamera } from './camera.js';
import { createPlayer } from './player.js';
import { loadLevel } from './level-loader.js';
import { ParticleSystem, preloadParticles } from './particles.js';
import { loadAudio, loadTexture, playSfx } from './assets.js';

// Sky-islands constants. The platforms float above a soft cloud sea; CLOUD_Y is the visible
// cloud deck and FALL_Y mirrors it so the player drops out the moment their feet pass the clouds.
const CLOUD_Y   = -2;
const FALL_Y    = CLOUD_Y;
const FIXED_DT  = 1 / 60;
const RESPAWN_DELAY_MS = 350;
const COMPLETE_DELAY_MS = 2000;

// Shared palette for the procedural sky + clouds. The horizon haze is reused by the sky dome's
// lower band, the cloud deck's far-fade, and the scene fog so all three meet with no seam.
const SKY_ZENITH  = new THREE.Color('#2f7ae0');   // deep blue overhead
const SKY_HORIZON = new THREE.Color('#dcefff');   // pale haze at the horizon
const CLOUD_LIT   = new THREE.Color('#ffffff');   // sunlit cloud tops
const CLOUD_SHADE = new THREE.Color('#b9c9e0');   // soft blue-grey creases

export async function createGame(canvas) {
  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- Scene + lighting + fog ----
  const scene = new THREE.Scene();
  scene.background = SKY_HORIZON.clone();   // fallback only — the sky dome fills the view
  // Fog tinted to the horizon haze so distant platforms melt into the same band the sky dome and
  // cloud deck fade to. Softer range than the old lagoon so nothing pops in or out abruptly.
  scene.fog = new THREE.Fog(SKY_HORIZON.clone(), 120, 420);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffe0b3, 0.95);
  sun.position.set(10, 20, 8);
  scene.add(sun);

  // ---- Sky islands (global, persists across levels) ----
  // Fully procedural — no textures. A gradient sky dome (deep blue overhead → pale horizon haze)
  // and an fbm-noise "cloud sea" plane below the platforms. Both follow the camera every frame
  // (see the frame loop) so the world feels endless, and both fade to SKY_HORIZON at the rim so
  // the cloud deck's far edge meets the dome's horizon band with no visible seam.
  const skyTime = { value: 0 };

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith:  { value: SKY_ZENITH },
        uHorizon: { value: SKY_HORIZON },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y, 0.0, 1.0);          // 0 at horizon, 1 straight up
          gl_FragColor = vec4(mix(uZenith, uHorizon, pow(1.0 - t, 1.6)), 1.0);
        }
      `,
    }),
  );
  skyDome.renderOrder = -2;
  scene.add(skyDome);

  // Cloud sea: one large horizontal plane. fbm over WORLD xz gives drifting puffs that stay
  // anchored to the world while the plane follows the camera; the rim fades (radially, in
  // plane-local space) to the horizon haze so the deck blends into the sky.
  const cloudMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime:    skyTime,
      uLit:     { value: CLOUD_LIT },
      uShade:   { value: CLOUD_SHADE },
      uHorizon: { value: SKY_HORIZON },
    },
    vertexShader: `
      varying vec2 vWorld;
      varying vec2 vLocal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xz;
        vLocal = position.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uLit;
      uniform vec3 uShade;
      uniform vec3 uHorizon;
      varying vec2 vWorld;
      varying vec2 vLocal;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vWorld * 0.018 + vec2(uTime * 0.008, uTime * 0.005);
        float puff = smoothstep(0.35, 0.72, fbm(p));
        vec3 col = mix(uShade, uLit, puff);
        col = mix(col, uLit, smoothstep(0.55, 0.9, fbm(p * 3.1 + 7.0)) * 0.35);
        float rim = smoothstep(250.0, 470.0, length(vLocal));
        gl_FragColor = vec4(mix(col, uHorizon, rim), 1.0);
      }
    `,
  });
  const cloudSea = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2),
    cloudMat,
  );
  cloudSea.position.y = CLOUD_Y;
  cloudSea.renderOrder = -1;
  scene.add(cloudSea);

  // ---- Camera ----
  // Far plane comfortably past the sky-dome radius (500) so the dome is never clipped.
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
  const followCam = createFollowCamera(camera);

  // ---- Physics ----
  const { RAPIER, world } = await initPhysics();

  // ---- Player (created once, teleported between levels and on respawn) ----
  const player = await createPlayer(scene, world, RAPIER, { x: 0, y: 50, z: 0 });

  // ---- Blob shadow ----
  const shadowTex = loadTexture('./assets/sprites/blob_shadow.png');
  const blobShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 }),
  );
  blobShadow.rotation.x = -Math.PI / 2;
  blobShadow.visible = false;
  scene.add(blobShadow);

  // ---- Particles + audio ----
  await preloadParticles();
  const particles = new ParticleSystem(scene);
  const sfx = {
    jump:    loadAudio('./assets/sounds/jump.ogg',  { volume: 0.5 }),
    fall:    loadAudio('./assets/sounds/fall.ogg',  { volume: 0.6 }),
    break:   loadAudio('./assets/sounds/break.ogg', { volume: 0.7 }),
    correct: loadAudio('./assets/sounds/coin.ogg',  { volume: 0.5 }),
  };

  // ---- Input ----
  const input = createControls(canvas);

  // ---- Resize ----
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  // ---- Game state ----
  let currentLevel = null;
  let currentLevelData = null;
  let alive = false;
  let lockedOut = false;
  let controlsLocked = false;    // true after a wrong answer: player can't steer/jump off the crumble
  let lastCheckpoint = null;     // { x, y, z } or null = use spawn
  let gatesCleared = 0;
  let onComplete = () => {};
  let onFall = () => {};
  let onGateCleared = () => {};
  let onGateWrong = () => {};
  let setHudQuestion = null;     // injected by setHandlers — used for Style-5 persistent HUD

  // The level's authored start point. Used for the initial placement only.
  function initialSpawn() {
    // Editor-format levels carry spawn at the top level; legacy layout-format levels embed it.
    if (currentLevelData.spawn?.position) {
      const s = currentLevelData.spawn.position;
      return { x: s[0], y: s[1], z: s[2] };
    }
    const s = currentLevelData.layout.find(e => e.type === 'spawn').position;
    return { x: s[0], y: s[1], z: s[2] };
  }

  // Where the player reappears after a death. Legacy gate levels respawn on the approach platform
  // before the current gate (a known top surface, so no spawning-inside-the-block) — re-attempting
  // that gate's question. Editor levels fall back to their last passed checkpoint, then the spawn.
  function respawnPosition() {
    const gatePos = currentLevel?.getRespawnPos?.(gatesCleared);
    if (gatePos) return gatePos;
    if (lastCheckpoint) return { ...lastCheckpoint };
    return initialSpawn();
  }

  async function startLevel(data) {
    if (currentLevel) {
      currentLevel.dispose();
      particles.clear();
    }
    currentLevelData = data;
    lastCheckpoint = null;
    gatesCleared = 0;
    currentLevel = await loadLevel(scene, world, RAPIER, particles, sfx, data, {
      onGateCleared: (gateIdx, checkpointPos) => {
        gatesCleared = gateIdx + 1;
        if (checkpointPos) lastCheckpoint = checkpointPos;
        currentLevel?.markCleared(gateIdx);
        onGateCleared(gatesCleared, currentLevel.gateCount);
      },
      onGateWrong: (gateIdx, question, opt) => {
        // Commit the player to the fall: freeze controls so they can't hop off the crumbling block.
        controlsLocked = true;
        onGateWrong(question, opt);
      },
      // Editor-format hooks — the new mechanic uses these directly.
      onCheckpoint: (pos) => { lastCheckpoint = { ...pos }; },
      onWrongAnswer: () => {}, // future: visual feedback for stepping on a falling answer
      // Touching a hazard (hammer, saw, spike, swiper, etc.) — same response as falling
      // out of the world: play the fall sound, notify, and respawn at last checkpoint.
      onHazardHit: () => {
        if (!alive || lockedOut) return;
        alive = false;
        playSfx(sfx.fall);
        onFall();
        respawn();
      },
    }, {
      setHudQuestion: (text) => setHudQuestion?.(text),
    });
    player.teleport(initialSpawn());
    alive = true;
    lockedOut = false;
    controlsLocked = false;
    // Editor-format levels have no gate progression — skip the initial progress paint so the
    // HUD doesn't flash "Gate 1 / 0". The UI hides the progress bar when total is 0.
    onGateCleared(0, currentLevel.gateCount);
  }

  function respawn() {
    alive = false;
    lockedOut = true;
    setTimeout(() => {
      // Reset the level first (restore any answer blocks that crumbled/fell while the player was
      // attempting the gate), then drop them onto the approach platform to try the question again.
      currentLevel?.reset?.();
      player.teleport(respawnPosition());
      alive = true;
      lockedOut = false;
      controlsLocked = false;
    }, RESPAWN_DELAY_MS);
  }

  function stopGame() {
    alive = false;
    lockedOut = true;
    if (currentLevel) {
      currentLevel.dispose();
      currentLevel = null;
    }
    particles.clear();
    currentLevelData = null;
    lastCheckpoint = null;
    gatesCleared = 0;
    setHudQuestion?.(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Dev hook: lets a URL param teleport the player after the level loads (for screenshots).
  window.addEventListener('krabsy-teleport', (e) => {
    if (currentLevel) player.teleport(e.detail);
  });

  // ---- Frame loop ----
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;

    input.update();
    const look = input.consumeLook();
    if (look.x || look.y) followCam.applyLook(look.x, look.y);

    // Advance the cloud drift on the wall clock — independent of the fixed-step loop so the sky
    // keeps flowing even when no physics tick lands this frame.
    skyTime.value += dt;

    while (acc >= FIXED_DT) {
      // Detect rider BEFORE advancing platforms — we use the platform's current pos to test
      // contact, then compute its movement over the upcoming step.
      let riderDelta = null;
      if (currentLevel && alive) {
        riderDelta = currentLevel.findRiderDelta(player.getPosition(), player.state.grounded, FIXED_DT);
      }
      if (currentLevel) currentLevel.prePhysics(FIXED_DT);
      if (alive) player.update(FIXED_DT, input, followCam, riderDelta, controlsLocked);
      // Teleport moving platforms AFTER the controller pass so they're still at the rider-assumed
      // pose during it (the platforms are fixed colliders, so they don't affect steering).
      if (currentLevel) currentLevel.stepMovingPlatforms(FIXED_DT);
      world.step();
      // Pushy-hazard depenetration: catch the case where a swinging hammer head sweeps
      // through the Rapier controller's prediction and ends up overlapping the player.
      if (alive && currentLevel?.applyPushyForces) currentLevel.applyPushyForces(player);
      acc -= FIXED_DT;
    }

    const playerPos = player.getPosition();
    followCam.update(playerPos);

    // Keep the sky dome + cloud sea centred on the camera so the world reads as endless.
    skyDome.position.copy(camera.position);
    cloudSea.position.set(camera.position.x, CLOUD_Y, camera.position.z);

    if (currentLevel) currentLevel.update(dt, playerPos, player.state.grounded);
    particles.update(dt);

    if (alive && player.state.grounded) {
      blobShadow.visible = true;
      blobShadow.position.set(playerPos.x, playerPos.y + 0.01, playerPos.z);
    } else {
      blobShadow.visible = false;
    }

    if (alive && !lockedOut && currentLevel) {
      if (playerPos.y < FALL_Y) {
        alive = false;
        particles.spawnSplash({ x: playerPos.x, y: CLOUD_Y, z: playerPos.z });
        playSfx(sfx.fall);
        onFall();
        respawn();
      } else if (currentLevel.flagReached(playerPos)) {
        alive = false;
        lockedOut = true;
        onComplete(currentLevelData.id);
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(now => { last = now; frame(now); });

  return {
    startLevel,
    stopGame,
    setHandlers(h) {
      if (h.onComplete)     onComplete     = h.onComplete;
      if (h.onFall)         onFall         = h.onFall;
      if (h.onGateCleared)  onGateCleared  = h.onGateCleared;
      if (h.onGateWrong)    onGateWrong    = h.onGateWrong;
      if (h.setHudQuestion) setHudQuestion = h.setHudQuestion;
    },
  };
}
