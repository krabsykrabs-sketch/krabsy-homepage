// Verb Towers clip: level "Two Gates" (summer), the game's real wave 4. The
// camera walks with one skeleton into the towers' fire; the question card slides in and a right
// answer sends coins into the purse, 31 → 40, exactly a frost tower; the camera
// swoops to an empty hex, the tower goes up and freezes the column (slow
// motion); pull back to the castle. ~9 s, loops.
//
// The PLAY is the real game (window.__td in js/main.js: waves, towers, the
// forge question card, coins); the CAMERA is a movie rig that replaces the
// renderer's own camera for the clip.
module.exports = {
  // under 760 px wide the question card is the game's horizontal strip (phone
  // layout): a row of big words that reads in a small tile, unlike the tall side panel
  viewport: { width: 736, height: 414 },
  scale: 2.6,
  maxSeconds: 14,
  seed: 3,           // Math.random seed: which questions and paths
  crf: 26,
  url: (section) => ({
    'de': '/games/tower-defense/?lang=de&topic=irregular_verbs&q=high',
    'es': '/games/tower-defense/?lang=es&topic=irregular_verbs&q=high',
    'en/spanish': '/games/tower-defense/?lang=en&topic=es_ser&q=high',
  }[section]),

  // before the game's code: seeded Math.random (?seed=N), no intro cards or
  // tutorial, and the game's own frame loop switched off (the director steps it)
  initScript: () => {
    const seed = parseInt(new URLSearchParams(location.search).get('seed') || '1', 10);
    let s = (seed * 2654435761) >>> 0 || 1;
    Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    try {
      for (const t of ['basic', 'catapult', 'cannon', 'freeze']) localStorage.setItem('td3d_tower_seen_' + t, '1');
      localStorage.setItem('td3d_tutorial_done', '1');
      localStorage.setItem('td3d_stars_training', '3');
    } catch (e) { /* storage blocked: intro cards would show */ }
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => (window.__clipOwnsLoop && cb.name === 'gameLoop' ? 0 : raf(cb));
  },

  async setup(page) {
    await page.waitForFunction(() => window.__td && window.__td.Renderer.camera && window.__td.Renderer._camBase, null, { timeout: 90000 });
    await page.evaluate(() => {
      const css = document.createElement('style');
      css.textContent =
        // only the purse stays of the HUD; the dock, coach and banners go
        '#top-hud .hud-lives,#phase-label,#top-hud .hud-wave,#fit-btn,#speed-btn,#mute-btn,#end-game-btn,' +
        '#dock-row,#tower-info,#tower-pop,#coach,#wave-banner,#danger-vignette{display:none!important}' +
        '#top-hud .hud-coins{zoom:1.35}' +
        // the question card: larger, and it slides in / out on cue
        // (scale/translate are separate properties: the card's own transform animations stay intact)
        '#forge-panel{transition:translate .45s cubic-bezier(.2,1.3,.4,1),opacity .3s}' +
        'body.clip-noforge #forge-panel{translate:0 140%;opacity:0}';
      document.head.appendChild(css);
      document.body.classList.add('clip-noforge');
      window.__clipOwnsLoop = true;
      const T = window.__td;
      T.startGame(4);                       // "Two Gates"
    });
    await page.waitForTimeout(1500);
    await page.evaluate(installDirector);
  },
};

// ---- runs in the page --------------------------------------------------------
function installDirector() {
  const T = window.__td, S = T.state, R = T.Renderer, cam = R.camera;
  const log = [];
  const W = (c, r) => { const p = T.Grid.placementCellToWorld(c, r); return { x: p.centerX, y: 0.4, z: p.centerY }; };
  const firstFree = (list) => list.find(([c, r]) => T.Grid.isAvailable(c, r));

  // ---- the board: towers along the shared road (5,4)…(9,4), a free hex kept for the frost tower
  S.coins = 999;
  const build = (type, list) => { const at = firstFree(list); if (at) T.Input._place(type, at[0], at[1]); return at; };
  build('basic', [[6, 3], [7, 3], [6, 5]]);
  build('catapult', [[8, 5], [9, 5], [8, 3]]);
  build('basic', [[10, 4], [10, 5], [10, 2]]);
  build('cannon', [[11, 3], [11, 4], [11, 1]]);
  build('basic', [[4, 1], [5, 2], [3, 2]]);
  build('basic', [[3, 6], [2, 7], [4, 7]]);
  const frostAt = firstFree([[7, 5], [7, 3], [6, 5], [8, 3]]);
  S.coins = 31;
  R._upMat.visible = false;    // the "can upgrade" badges are huge in close-ups

  // the game's own wave 4 of this level (count, spacing, health, speed as in play;
  // owner 2026-11-28: one by one with gaps, not a crowd), a few more of the same
  // so it doesn't run dry during the clip; already marching when the clip starts
  S.currentWave = 3;
  T.Wave.startNext(S);
  const q = S.wave.queue;
  for (let i = 0, n = q.length; i < 6; i++) q.push({ ...q[i % n], path: T.Level.current.paths[i % 2] });
  for (let i = 0; i < 300; i++) T.step(1 / 30, 1 / 30);   // 10 s pre-roll (no frames)

  const road = [W(5, 4), W(9, 4)];
  // ---- camera rig: orbit (yaw, pitch, dist, fov) around a target, smoothed.
  // yaw 0 / pitch = the game's own view direction from the south.
  const b = R._camBase;
  const bdx = b.pos.x - b.target.x, bdy = b.pos.y - b.target.y, bdz = b.pos.z - b.target.z;
  const D0 = Math.hypot(bdx, bdy, bdz);
  const P0 = Math.asin(bdy / D0) * 180 / Math.PI;
  const YAW0 = Math.atan2(bdx, bdz) * 180 / Math.PI;
  const FOV0 = cam.fov;
  const rig = { tx: b.target.x, ty: 0, tz: b.target.z, yaw: 0, pitch: P0, dist: D0, fov: FOV0 };
  let goal = { ...rig }, stiff = 3, shake = 0, shakeT = 0, track = null, follow = false, hero = null;
  // one skeleton the camera walks with: the one closest to the crossroads that has
  // not passed it yet; when it falls, the next one nearest the camera's aim
  const alive = (e) => e && e.isAlive && !e.isDying && !(e.spawnTimer > 0);
  const pickHero = (near) => {
    let best = null, bd = Infinity;
    for (const e of S.enemies) {
      if (!alive(e)) continue;
      const d = Math.hypot(e.position.x - near.x, e.position.y - near.z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  };
  const shot = (o) => () => {
    const t = o.at;
    goal = { tx: t.x, ty: t.y ?? 0.4, tz: t.z, yaw: o.yaw ?? 0, pitch: o.pitch ?? P0, dist: (o.dist ?? 1) * D0, fov: o.fov ?? FOV0 };
    stiff = o.stiff ?? 3;
    track = o.track || null;       // { to:{x,z}, secs } — the target glides there (dolly)
    follow = !!o.follow;           // walk with one skeleton (hero)
    if (follow && !alive(hero)) hero = pickHero(t);
    if (track) track.t = 0, track.from = { x: t.x, z: t.z };
    if (o.cut) Object.assign(rig, goal);
    log.push(`shot ${o.name}`);
    return true;
  };
  const kick = (a) => () => { shake = a; return true; };
  R._applyCamera = function (state, dt) {
    const rdt = 1 / 30;
    if (track) {
      track.t = Math.min(track.secs, track.t + rdt);
      const k = track.t / track.secs, e = k * k * (3 - 2 * k);
      goal.tx = track.from.x + (track.to.x - track.from.x) * e;
      goal.tz = track.from.z + (track.to.z - track.from.z) * e;
    }
    if (follow) {
      if (!alive(hero)) hero = pickHero({ x: rig.tx, z: rig.tz });
      if (hero) { goal.tx = hero.position.x + 1.2; goal.tz = hero.position.y; }   // a little room ahead
    }
    const a = 1 - Math.exp(-rdt * stiff);
    for (const key of Object.keys(rig)) rig[key] += (goal[key] - rig[key]) * a;
    shakeT += rdt; shake *= Math.exp(-rdt * 7);
    const sx = Math.sin(shakeT * 61) * shake, sy = Math.cos(shakeT * 47) * shake;
    const p = rig.pitch * Math.PI / 180, y = (rig.yaw + YAW0) * Math.PI / 180;
    cam.position.set(rig.tx + Math.sin(y) * Math.cos(p) * rig.dist + sx,
                     rig.ty + Math.sin(p) * rig.dist + sy,
                     rig.tz + Math.cos(y) * Math.cos(p) * rig.dist);
    cam.fov = rig.fov; cam.updateProjectionMatrix();
    cam.lookAt(rig.tx + sx * 0.5, rig.ty + sy * 0.5, rig.tz);
    cam.updateMatrixWorld();
  };

  // ---- the script
  let speed = 1;
  const slowmo = (v) => () => { speed = v; return true; };
  const wait = (s) => { let t = s; return (dt) => (t -= dt) <= 0; };
  const until = (fn, max = 3) => { let t = max; return (dt) => !!fn() || (t -= dt) <= 0; };
  const card = (on) => () => { document.body.classList.toggle('clip-noforge', !on); return true; };
  const answer = () => () => {
    const f = S.forge;
    if (f.stage !== 'ask' || !f.q) return false;
    const btn = document.querySelector(`.forge-answer[data-index="${f.q.correctIndex}"]`);
    T.Forge.answer(S, f.q.correctIndex);
    log.push(`answer ${btn ? btn.textContent.trim() : f.q.correctIndex} → coins ${S.coins}`);
    return true;
  };
  const buildFrost = () => () => {
    const ok = frostAt && T.Input._place('freeze', frostAt[0], frostAt[1]);
    log.push(`frost tower at ${frostAt} ${ok ? 'built' : 'FAILED'} (coins ${S.coins})`);
    return true;
  };
  const anyFrozen = () => S.enemies.some((e) => e.isFrozen);

  const mid = W(7, 4), castle = W(13, 8);
  const script = [
    // 1 — low along the road, the column marching into the arrows
    shot({ name: 'follow', at: W(4, 3), dist: 0.34, pitch: 26, yaw: -24, stiff: 2.4, cut: true, follow: true }),
    wait(2.6),
    // 2 — card in, answer, coins into the purse
    shot({ name: 'rise', at: mid, dist: 0.55, pitch: 38, yaw: -16, stiff: 1.6 }),
    card(true),
    wait(0.9),
    answer(),
    wait(1.0),
    card(false),
    // 3 — swoop to the free hex, the frost tower goes up, freeze in slow motion
    shot({ name: 'swoop', at: frostAt ? W(frostAt[0], frostAt[1]) : mid, dist: 0.3, pitch: 30, yaw: 24, stiff: 4 }),
    // build when a skeleton is coming into the frost tower's reach
    until(() => S.enemies.some((e) => alive(e) && frostAt &&
      Math.hypot(e.position.x - W(frostAt[0], frostAt[1]).x, e.position.y - W(frostAt[0], frostAt[1]).z) < 4.5), 2.5),
    buildFrost(),
    kick(0.18),
    until(anyFrozen, 2.5),
    slowmo(0.35),
    kick(0.12),
    wait(0.35),
    slowmo(1),
    // 4 — pull back toward the castle
    shot({ name: 'hero', at: { x: (mid.x + castle.x) / 2, z: (mid.z + castle.z) / 2 }, dist: 0.62, pitch: 34, yaw: 12, stiff: 1.4 }),
    wait(1.6),
  ];
  let k = 0;
  window.__clip = {
    log,
    start() { log.push(`start: towers ${S.towers.length}, enemies ${S.enemies.length} (+${S.wave ? S.wave.queue.length : 0} to come), coins ${S.coins}, frost spot ${frostAt}`); },
    step(dt) {
      const gdt = dt * speed;
      while (k < script.length && script[k](gdt)) k++;
      if (k >= script.length) return 0;
      T.step(gdt, gdt);
      R.render(S);
      return speed;
    },
  };
}
