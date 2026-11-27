// Verb Kitchen clip: Burger Bar. Close on a sizzling patty, the chef plates it
// (slow motion), whip pan to the hatch, serve (coins, camera kick), pull back
// to the sink: two right answers (2nd form, then 3rd form), the plate is clean.
// ~9 s, loops.
//
// The PLAY is real: moves go through the game's QA hook (window.__VK, src/qa.js)
// and its input path (game.keys / interactE / spacePress). The CAMERA is not the
// game's: a movie rig (shots, slow motion, shake) takes over the 3D camera
// (owner 2026-11-27: "a bit more exciting, not everything exactly as in the game").
module.exports = {
  viewport: { width: 960, height: 540 },
  scale: 2,
  maxSeconds: 14,
  seed: 2,          // take → took → taken (probe other seeds with --probe)
  crf: 26,
  // section → the game as that section's wrapper page opens it
  url: (section) => ({
    'de': '/games/verb-kitchen/?lang=de&topic=irregular_verbs',
    'es': '/games/verb-kitchen/?lang=es&topic=irregular_verbs',
    'en/spanish': '/games/verb-kitchen/?lang=en&topic=es_ser',
  }[section]),

  async setup(page) {
    await page.waitForFunction(() => window.__VK && document.getElementById('startScreen'), null, { timeout: 90000 });
    await page.evaluate(() => {
      // promo framing: no menu buttons or help overlays, the game itself only
      const css = document.createElement('style');
      // the quiz card a bit larger so its words stay readable in a small tile
      // HUD off too: at card size it is only specks next to the card's own badges
      css.textContent = '#topbar,#tickets,#muteBtn,#quitBtn,#tutorial,#hint,#quizKeys,.fxbubble{display:none!important}' +
        '#quizCard{zoom:1.3}' +
        '@keyframes clipPunch{0%{transform:scale(1)}35%{transform:scale(1.07)}100%{transform:scale(1)}}' +
        '#quiz.clip-punch #quizCard{animation:clipPunch .38s ease-out}';
      document.head.appendChild(css);
      try { localStorage.setItem('krabsy_vkitchen_sound', '0'); } catch (e) { /* sound is off in clips anyway */ }
    });
    await page.evaluate(() => window.__VK.startLevel(1, { skipCountdown: true }));
    await page.waitForFunction(() => window.__VK.game.running && window.__VK.game.world, null, { timeout: 90000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const VK = window.__VK, g = VK.game, W = g.world;
      VK.setNoSpawn(true);
      VK.clearTickets();
      VK.spawnTicket('hamburger');
      VK.spawnTicket('cheeseburger');
      const stoves = W.stations.filter((s) => s.type === 'stove').sort((a, b) => a.row - b.row);
      const cook = (st, t) => { VK.give('patty_raw'); st.startCooking(g.chef.carried); VK.clearHands(); st.cookT = t; };
      cook(stoves[0], 9.9);   // "ready!" right as the chef arrives
      cook(stoves[1], 4);     // still sizzling
      VK.dirtyPlates(1);
      VK.givePlate(['bun']);
      VK.teleport(4, 1);
      VK.face(1, 0);
      window.__clipSetup = true;
    });
    await page.waitForFunction(() => window.__clipSetup);
    await page.evaluate(() => window.__VK.tick(0.6));   // tickets slide in, settle
    await page.evaluate(installDirector);
  },
};

// ---- runs in the page --------------------------------------------------------
function installDirector() {
  const VK = window.__VK, g = VK.game, W = g.world, cam = g.camera;
  const TILE = 2;
  const log = [];
  g.qaFrozen = true;               // the director runs the game's update itself (slow motion)
  cam.clearViewOffset();
  const chefTile = () => ({ col: Math.round(g.chef.pos.x / TILE + W.offX), row: Math.round(g.chef.pos.z / TILE + W.offZ) });
  const setKeys = (x, z) => { g.keys.a = x < 0; g.keys.d = x > 0; g.keys.w = z < 0; g.keys.s = z > 0; };
  const bfs = (goal) => {
    const s = chefTile();
    const seen = new Set([s.col + ',' + s.row]);
    const q = [{ c: s.col, r: s.row, p: [] }];
    while (q.length) {
      const cur = q.shift();
      const p = cur.p.concat([{ col: cur.c, row: cur.r }]);
      if (cur.c === goal.col && cur.r === goal.row) return p;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.c + dx, nr = cur.r + dz, k = nc + ',' + nr;
        if (seen.has(k) || !W.isWalkable(nc, nr)) continue;
        seen.add(k); q.push({ c: nc, r: nr, p });
      }
    }
    return null;
  };
  const station = (type, pick = 0) => W.stations.filter((s) => s.type === type).sort((a, b) => a.row - b.row || a.col - b.col)[pick];

  // ---- camera rig: orbit (yaw, pitch, dist, fov) around a target, all smoothed.
  // yaw 0 / pitch 56° = the game's own view direction.
  const D0 = cam.position.length();          // the game's fitted distance
  const FOV0 = cam.fov;
  const rig = { tx: 0, ty: 0, tz: 0, yaw: 0, pitch: 56, dist: D0, fov: FOV0 };
  let goal = { ...rig }, follow = null, stiff = 3, shake = 0, shakeT = 0;
  const where = (what) => {
    if (what === 'chef') return { x: g.chef.pos.x, y: 1.0, z: g.chef.pos.z };
    if (what && what.pos) return { x: what.pos.x, y: (what.topY || 1), z: what.pos.z };
    return what;                              // {x,y,z}
  };
  // shot({ on, dist (× game distance), pitch, yaw, fov, stiff, cut })
  const shot = (o) => () => {
    follow = o.on === 'chef' ? 'chef' : null;
    const t = where(o.on);
    goal = { tx: t.x, ty: t.y, tz: t.z, yaw: o.yaw ?? 0, pitch: o.pitch ?? 56, dist: (o.dist ?? 1) * D0, fov: o.fov ?? FOV0 };
    stiff = o.stiff ?? 3;
    if (o.cut) Object.assign(rig, goal);
    log.push(`shot ${o.name || ''}`);
    return true;
  };
  const kick = (amt = 0.35) => () => { shake = amt; return true; };
  const applyCamera = (dt) => {
    if (follow) { const t = where('chef'); goal.tx = t.x; goal.ty = t.y; goal.tz = t.z; }
    const a = 1 - Math.exp(-dt * stiff);
    for (const k of Object.keys(rig)) rig[k] += (goal[k] - rig[k]) * a;
    shakeT += dt; shake *= Math.exp(-dt * 7);
    const sx = Math.sin(shakeT * 61) * shake, sy = Math.cos(shakeT * 47) * shake;
    const p = rig.pitch * Math.PI / 180, y = rig.yaw * Math.PI / 180;
    cam.position.set(rig.tx + Math.sin(y) * Math.cos(p) * rig.dist + sx,
                     rig.ty + Math.sin(p) * rig.dist + sy,
                     rig.tz + Math.cos(y) * Math.cos(p) * rig.dist);
    cam.fov = rig.fov;
    cam.updateProjectionMatrix();
    const look = cam.position.clone(); look.set(rig.tx + sx * 0.5, rig.ty + sy * 0.5, rig.tz);
    cam.lookAt(look);
    cam.updateMatrixWorld();
  };

  // ---- the play: each action runs every frame until it returns true
  let speed = 1;
  const slowmo = (v) => () => { speed = v; return true; };
  const walk = (col, row, face) => {
    let path = null, i = 1, push = 0;
    return () => {
      if (!path) { path = bfs({ col, row }) || [{ col, row }]; log.push(`walk ${col},${row} (${path.length} tiles)`); }
      if (i < path.length) {
        const c = W.tileWorld(path[i].col, path[i].row);
        const dx = c.x - g.chef.pos.x, dz = c.z - g.chef.pos.z, d = Math.hypot(dx, dz);
        const last = i === path.length - 1;
        if (d < (last ? 0.2 : 0.5)) { i++; return false; }
        const t = Math.max(0.25, d * 0.4);
        setKeys(dx > t ? 1 : dx < -t ? -1 : 0, dz > t ? 1 : dz < -t ? -1 : 0);
        if (!g.keys.a && !g.keys.d && !g.keys.w && !g.keys.s) setKeys(Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0, Math.abs(dx) > Math.abs(dz) ? 0 : Math.sign(dz));
        return false;
      }
      if (push < 3) { setKeys(face[0], face[1]); push++; return false; }   // lean into the station = turn to it
      setKeys(0, 0); VK.face(face[0], face[1]);
      return true;
    };
  };
  const wait = (s) => { let t = s; return (dt) => (t -= dt) <= 0; };
  const until = (fn) => () => !!fn();
  const pressE = () => () => { g.interactE(); log.push(`E → ${g.carried()}`); return true; };
  const wash = () => () => { g.spacePress(); log.push(`sink open=${g.questionOpen}`); return true; };
  const quizEl = document.getElementById('quiz');
  const answer = () => () => {
    const q = g.quiz.current;
    if (!q) return false;
    const idx = q.chips.indexOf(q.answer);
    g.quiz.lockUntil = 0;
    g.quiz.answer(idx);
    quizEl.classList.remove('clip-punch'); void quizEl.offsetWidth; quizEl.classList.add('clip-punch');
    log.push(`answer ${q.answer} (${q.chips.join('/')})`);
    return true;
  };

  const stove = station('stove', 0), hatch = station('hatch', 1), sink = station('sink'), rack = station('rack');
  const script = [
    // 1 — close and low on the sizzling patty, slow push in; the chef walks in
    shot({ name: 'stove close', on: stove, dist: 0.36, pitch: 30, yaw: -14, fov: FOV0, stiff: 1.2, cut: true }),
    shot({ name: 'stove push', on: stove, dist: 0.3, pitch: 32, yaw: -6, stiff: 1.2 }),
    walk(6, 1, [1, 0]),
    until(() => stove.state === 'ready'),
    wait(0.15),
    // 2 — plating in slow motion, a small punch in
    slowmo(0.35),
    shot({ name: 'plate punch', on: stove, dist: 0.25, pitch: 38, yaw: -4, stiff: 5 }),
    pressE(),
    wait(0.32),
    slowmo(1),
    // 3 — whip pan after the chef to the hatch
    shot({ name: 'follow', on: 'chef', dist: 0.5, pitch: 42, yaw: 18, stiff: 5 }),
    walk(2, 1, [0, -1]),
    shot({ name: 'hatch', on: hatch, dist: 0.42, pitch: 44, yaw: 44, stiff: 6 }),
    wait(0.12),
    pressE(),                    // serve → coins
    kick(0.32),
    wait(0.5),
    // 4 — pull back and travel to the sink
    shot({ name: 'to sink', on: 'chef', dist: 0.62, pitch: 50, yaw: -6, stiff: 3.5 }),
    walk(5, 1, [0, -1]),
    wait(0.1),
    wash(),                      // take → [___] → ___
    shot({ name: 'quiz drift', on: sink, dist: 0.55, pitch: 46, yaw: 14, stiff: 0.8 }),
    wait(0.95),
    answer(),
    wait(1.1),                   // take → took → [___]
    answer(),
    until(() => !g.questionOpen),
    // 5 — the clean plate lands on the rack
    shot({ name: 'rack', on: rack, dist: 0.38, pitch: 52, yaw: 28, stiff: 4 }),
    wait(1.0),
  ];
  let k = 0;
  window.__clip = {
    log,
    start() { log.push('start ' + JSON.stringify(chefTile())); },
    // one video frame: returns the game-time speed for the page clock, 0 = done
    step(dt) {
      const gdt = dt * speed;
      while (k < script.length && script[k](gdt)) k++;
      if (k >= script.length) { setKeys(0, 0); return 0; }
      g.update(gdt);
      // the stations' floating progress bars look blocky in close-ups: off
      for (const st of W.stations) if (st.ring) st.ring.visible = false;
      W.highlight.visible = false;   // the teal target square too
      applyCamera(dt);
      g.renderer.render(g.scene, cam);
      return speed;
    },
  };
}
