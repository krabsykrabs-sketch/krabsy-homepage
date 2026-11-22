import * as THREE from 'three';
import { initPhysics } from './physics.js';
import { createControls } from './controls.js';
import { createFollowCamera } from './camera.js';
import { createPlayer } from './player.js';
import { loadLevel } from './level-loader.js';
import { ParticleSystem, preloadParticles } from './particles.js';
import { loadAudio, loadTexture, playSfx } from './assets.js';
import { resolveSky } from './sky-presets.js';
import { preloadScenery, buildScenery } from './scenery.js';
import { playApplause } from './celebrate.js';

// Sky-islands constants. The platforms float high above a cloud sea; CLOUD_Y is the visible
// cloud deck. FALL_Y is where a fall counts (sound, respawn timer): well above the deck, so
// the respawn stays as quick as it was with a high deck. The character keeps dropping for the
// short respawn delay and disappears into the clouds — it is never left standing in the air.
const CLOUD_Y   = -10;
const FALL_Y    = -5;
const FIXED_DT  = 1 / 60;
const RESPAWN_DELAY_MS = 350;
const COMPLETE_DELAY_MS = 2000;

// Shared colours of the procedural sky + clouds. The values come from the level's sky
// (src/sky-presets.js) and are written into these objects by applySky(); the shaders hold
// references to them. The fog colour is reused by the sky dome's lower band, the cloud deck's
// far-fade and the scene fog, so all three meet with no seam.
const SKY_ZENITH  = new THREE.Color();   // overhead
const SKY_HORIZON = new THREE.Color();   // haze at the horizon (= fog colour)
const CLOUD_LIT   = new THREE.Color();   // sunlit cloud tops
const CLOUD_SHADE = new THREE.Color();   // creases of the cloud sea (a mid value, see sky-presets.js)
const SUN_COLOR   = new THREE.Color();
const SUN_DIR     = new THREE.Vector3(0, 1, 0);   // towards the sun

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

  // Hemisphere fill instead of a flat ambient: tops get the sky colour, undersides the warm
  // bounce from the clouds, so the sides of the platforms are shaded. No shadow maps.
  const hemi = new THREE.HemisphereLight(0xd9e9ff, 0xbfa590, 0.95);
  scene.add(hemi);
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
        uSunDir:  { value: SUN_DIR },
        uSunColor: { value: SUN_COLOR },
        uStars:   { value: 0 },
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
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uStars;
        varying vec3 vDir;
        float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float t = clamp(d.y, 0.0, 1.0);          // 0 at horizon, 1 straight up
          float haze = pow(1.0 - t, 1.6);
          vec3 col = mix(uZenith, uHorizon, haze);
          if (uStars > 0.0) {
            // a few stars: one per cell of a coarse grid on the dome, only well above the haze
            vec3 g = d * 120.0;
            vec3 cell = floor(g);
            float h = hash3(cell);
            float star = step(0.975, h) * smoothstep(0.3, 0.05, length(fract(g) - 0.5));
            col += vec3(1.0, 0.96, 0.88) * star * uStars * (0.5 + 0.5 * fract(h * 37.0)) * smoothstep(0.12, 0.45, d.y);
          }
          // sun: wide warm glow, tighter halo, disc
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(s, 6.0) * 0.16 + pow(s, 48.0) * 0.3);
          col = mix(col, uSunColor * 1.15 + 0.1, smoothstep(0.9989, 0.9993, s));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
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
      uSunXZ:   { value: new THREE.Vector2(1, 0) },
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
      uniform vec2 uSunXZ;
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
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main() {
        // The deck is a height field h; comparing it with a sample taken a step towards the
        // sun says which side of a billow we are on: sun side = lit, far side = shade. That
        // gives the sea a mid-value body with cream highlights instead of a white sheet.
        vec2 p = vWorld * 0.018 + vec2(uTime * 0.008, uTime * 0.005);
        float h  = fbm(p);
        float hs = fbm(p + uSunXZ * 0.09);
        float facing = clamp((h - hs) * 5.0 + 0.3, 0.0, 1.0);
        float crest = smoothstep(0.42, 0.8, h);
        float lit = clamp(facing * 0.7 + crest * 0.35, 0.0, 1.0);
        lit = mix(lit, 1.0, smoothstep(0.6, 0.95, noise(p * 3.1 + 7.0)) * 0.2 * crest);
        vec3 col = mix(uShade, uLit, lit);
        // far away the billows flatten into a soft band
        float dist = length(vLocal);
        col = mix(col, mix(uShade, uLit, 0.42), smoothstep(90.0, 260.0, dist) * 0.65);
        float rim = smoothstep(250.0, 470.0, dist);
        gl_FragColor = vec4(mix(col, uHorizon, rim), 1.0);
        #include <colorspace_fragment>
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

  // Writes a level's sky (see src/sky-presets.js) into the shared colours, lights and fog.
  function applySky(sky) {
    SKY_ZENITH.set(sky.zenith);
    SKY_HORIZON.set(sky.fog);
    CLOUD_LIT.set(sky.cloudLit);
    CLOUD_SHADE.set(sky.cloudShade);
    SUN_COLOR.set(sky.sun);
    SUN_DIR.set(sky.sunDir[0], sky.sunDir[1], sky.sunDir[2]).normalize();
    skyDome.material.uniforms.uStars.value = sky.stars;
    const sxz = cloudMat.uniforms.uSunXZ.value.set(SUN_DIR.x, SUN_DIR.z);
    if (sxz.lengthSq() < 1e-4) sxz.set(1, 0); else sxz.normalize();
    scene.fog.color.set(sky.fog);
    scene.fog.near = sky.fogNear;
    scene.fog.far = sky.fogFar;
    scene.background.set(sky.fog);
    hemi.color.set(sky.hemiSky);
    hemi.groundColor.set(sky.hemiGround);
    hemi.intensity = sky.hemiIntensity;
    sun.color.set(sky.light);
    sun.intensity = sky.lightIntensity;
    // The light comes from the sun's side, but always steeply (64° or more): a low light
    // leaves the tops of the platforms dark and puts a white glare on them when the player
    // looks towards the sun.
    const flat = Math.hypot(SUN_DIR.x, SUN_DIR.z) || 1;
    const up = Math.max(SUN_DIR.y, 0.9);
    const k = Math.sqrt(1 - up * up) / flat;
    sun.position.set(SUN_DIR.x * k, up, SUN_DIR.z * k).multiplyScalar(30);
  }
  applySky(resolveSky(null));

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
  let sinking = false;           // fell below FALL_Y: keeps dropping into the clouds until the respawn
  let scenery = null;            // background islands, puffs, deck shadows of the current level
  let sceneryToken = 0;          // a newer level start cancels a scenery build still in flight
  let paused = false;            // shell hook (pause card, first-run hint): no physics, no clock
  let levelTime = 0;             // seconds played in this level (stops while paused and at the flag)
  let timing = false;

  // Start loading the scenery models now; levels do not wait for them (see startLevel).
  preloadScenery().catch(e => console.warn('[krabsy3d] scenery not available', e));

  function disposeScenery() {
    sceneryToken++;
    scenery?.dispose();
    scenery = null;
  }

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
    disposeScenery();
    sinking = false;
    player.mesh.visible = true;
    const sky = resolveSky(data.sky);
    applySky(sky);
    currentLevelData = data;
    lastCheckpoint = null;
    gatesCleared = 0;
    currentLevel = await loadLevel(scene, world, RAPIER, particles, sfx, data, {
      onGateCleared: (gateIdx, checkpointPos, question) => {
        gatesCleared = gateIdx + 1;
        if (checkpointPos) lastCheckpoint = checkpointPos;
        currentLevel?.markCleared(gateIdx);
        // The spectators nearby cheer, with applause (none when nobody is in range / lite mode).
        const cheered = scenery?.cheer(player.getPosition()) || 0;
        if (cheered) playApplause(Math.min(1, cheered / 2));
        onGateCleared(gatesCleared, currentLevel.gateCount, question);
      },
      onGateWrong: (gateIdx, question, opt) => {
        // Commit the player to the fall: freeze controls so they can't hop off the crumbling block.
        controlsLocked = true;
        onGateWrong(question, opt, gateIdx);
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
        onFall('hazard');
        respawn();
      },
    }, {
      setHudQuestion: (text) => setHudQuestion?.(text),
    });
    player.teleport(initialSpawn());
    alive = true;
    lockedOut = false;
    controlsLocked = false;
    levelTime = 0;
    timing = true;
    // Editor-format levels have no gate progression — skip the initial progress paint so the
    // HUD doesn't flash "Gate 1 / 0". The UI hides the progress bar when total is 0.
    onGateCleared(0, currentLevel.gateCount);

    // Scenery is decoration: build it without holding up the level start. Placement is
    // derived from the level's pieces and seeded by its id, so it looks the same every time.
    const token = sceneryToken;
    buildScenery(scene, currentLevel, { cloudY: CLOUD_Y, sky, seed: data.id || 'level' }).then(s => {
      if (token !== sceneryToken) s.dispose();
      else scenery = s;
    }).catch(e => console.warn('[krabsy3d] scenery failed', e));
  }

  function respawn() {
    alive = false;
    lockedOut = true;
    setTimeout(() => {
      if (!currentLevel) return;   // left for the title screen in the meantime
      // Reset the level first (restore any answer blocks that crumbled/fell while the player was
      // attempting the gate), then drop them onto the approach platform to try the question again.
      currentLevel?.reset?.();
      player.teleport(respawnPosition());
      sinking = false;
      player.mesh.visible = true;
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
    disposeScenery();
    sinking = false;
    player.mesh.visible = false;   // nobody stands in the sky behind the title screen
    particles.clear();
    currentLevelData = null;
    lastCheckpoint = null;
    gatesCleared = 0;
    timing = false;
    paused = false;
    setHudQuestion?.(null);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Dev hook for automated play-tests: read-only view of the running level and player.
  window.__krabsyDebug = { level: () => currentLevel, scenery: () => scenery, player, alive: () => alive, input, world, RAPIER, followCam, renderer };

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

    // Paused: the world stands still (no physics, no movers, no clock); the picture stays.
    if (paused) {
      input.consumeLook();
      renderer.render(scene, camera);
      return;
    }
    acc += dt;
    if (timing) levelTime += dt;

    input.update();
    const look = input.consumeLook();
    if (look.x || look.y) followCam.applyLook(look.x, look.y, player.state.facingYaw);
    // Touch: the camera follows the character (no mouse to aim with), see camera.js.
    if (input.isTouch && alive && !controlsLocked && Math.hypot(input.move.x, input.move.y) > 0.2) {
      followCam.autoFollow(dt, player.state.facingYaw, Math.max(0, -input.move.y));
    }

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
      window.__krabsyDebug.onStep?.();   // play-test bot hook (tools/bot-test.cjs)
      if (alive) player.update(FIXED_DT, input, followCam, riderDelta, controlsLocked);
      // After a fall the character keeps dropping (no steering) until it is under the clouds.
      else if (sinking) player.update(FIXED_DT, input, followCam, null, true);
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
    if (sinking) {
      // The camera stays where the fall was counted and watches the character go down.
      followCam.update({ x: playerPos.x, y: Math.max(playerPos.y, FALL_Y), z: playerPos.z });
      if (player.mesh.visible && playerPos.y < CLOUD_Y + 0.4) {
        player.mesh.visible = false;
        particles.spawnSplash({ x: playerPos.x, y: CLOUD_Y, z: playerPos.z });
      }
    } else {
      followCam.update(playerPos);
    }

    // Keep the sky dome + cloud sea centred on the camera so the world reads as endless.
    skyDome.position.copy(camera.position);
    cloudSea.position.set(camera.position.x, CLOUD_Y, camera.position.z);

    if (currentLevel) currentLevel.update(dt, playerPos, player.state.grounded);
    scenery?.update(dt, playerPos);
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
        sinking = true;
        playSfx(sfx.fall);
        onFall(controlsLocked ? 'wrong' : 'gap');
        respawn();
      } else if (currentLevel.flagReached(playerPos)) {
        alive = false;
        lockedOut = true;
        timing = false;
        onComplete(currentLevelData.id);
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(now => { last = now; frame(now); });

  return {
    startLevel,
    stopGame,
    // Pause hook for the shell. Resuming drops a jump pressed while the game stood still.
    setPaused(p) {
      paused = !!p;
      if (!paused) { input.consumeJump(); input.consumeLook(); acc = 0; }
    },
    isPaused: () => paused,
    getTime: () => levelTime,
    // Every gate's question of the running level (the results screen builds full chains from them).
    getGateQuestions: () => (currentLevel?.gates || []).map(g => g.question || g.gate?.question).filter(Boolean),
    input,
    // Capture the mouse (desktop). Must be called from a click or key handler.
    lockPointer() {
      if (input.isTouch || document.pointerLockElement === canvas) return;
      try { canvas.requestPointerLock()?.catch?.(() => {}); } catch (_) { /* not allowed right now */ }
    },
    setHandlers(h) {
      if (h.onComplete)     onComplete     = h.onComplete;
      if (h.onFall)         onFall         = h.onFall;
      if (h.onGateCleared)  onGateCleared  = h.onGateCleared;
      if (h.onGateWrong)    onGateWrong    = h.onGateWrong;
      if (h.setHudQuestion) setHudQuestion = h.setHudQuestion;
    },
  };
}
