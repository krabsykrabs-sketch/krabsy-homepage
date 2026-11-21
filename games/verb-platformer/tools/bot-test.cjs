// Automated play-test: a bot walks a level from spawn to flag in a headless browser.
//
//   node tools/bot-test.cjs <base-url> <level.json> [more levels…] [--shots <dir>] [--timeout <s>]
//   e.g. node tools/bot-test.cjs http://localhost:8902/games/verb-platformer/ assets/levels/zigzag.json
//
// The level is loaded through ?level=editor (same path as the editor's Playtest button).
// The bot follows `botPath` in the level JSON (written by tools/make_levels.py): a list of
// waypoints  { p: [x, y, z] }            walk/jump there (y = feet height)
//            { gate: 'gate_1' }          go to that gate's correct answer block
//            { ride: 'platform_7' }      get onto that moving platform
//            { …, reach: 4 }             only leave the ground when the target is this close
//            { …, hammer: 'hammer_1' }   wait until that hammer has swung clear
// It jumps when the floor ends or a step is in the way (ray casts into the physics world).
// Needs Playwright; set PLAYWRIGHT to its module path if it is not installed here.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); if (i < 0) return dflt; const v = args[i + 1]; args.splice(i, 2); return v; };
const shots = opt('--shots', null);
const timeoutS = parseFloat(opt('--timeout', '240'));
const [base, ...files] = args;

function botMain(wps) {
  const D = window.__krabsyDebug;
  const bot = window.__bot = { i: 0, deaths: 0, done: false, stuck: 0, log: [], t: 0 };
  let last = null, lastProgressT = performance.now(), jumpCooldown = 0, seen = null, lastSide = 0;
  const ray = (ox, oy, oz, dx, dy, dz, len) => {
    const r = new D.RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    return D.world.castRay(r, len, true, undefined, undefined, D.player.collider);
  };
  function target(L, wp) {
    if (wp.gate) {
      const g = L.gates.find(g => g.id === wp.gate);
      const o = g.gate.options.find(o => o.correct);
      return { x: o.pos.x, y: o.top, z: o.pos.z };
    }
    if (wp.ride) {
      const p = L.platforms.find(p => p.id === wp.ride);
      return { x: p.pos.x, y: p.top, z: p.pos.z };
    }
    return { x: wp.p[0], y: wp.p[1], z: wp.p[2] };
  }
  // Runs once per physics step (not per rendered frame), so a slow headless browser does not
  // make the bot late at edges.
  function tick() {
    if (bot.done) return;
    const L = D.level();
    if (!L) return;
    if (!document.getElementById('level-complete').hidden) { bot.done = true; D.input.virtual.x = D.input.virtual.y = 0; return; }
    const p = D.player.getPosition();
    const grounded = D.player.state.grounded;
    const v = D.input.virtual;
    if (!D.alive()) {
      if (seen) { bot.log.push(`died heading to wp ${bot.i} at ${seen.x.toFixed(1)},${seen.y.toFixed(1)},${seen.z.toFixed(1)}`); seen = null; }
      v.x = v.y = 0; last = null; return;
    }
    if (grounded) seen = { x: p.x, y: p.y, z: p.z };
    if (last === null || Math.hypot(p.x - last.x, p.z - last.z) > 4) {
      // (re)spawned: continue from the nearest waypoint at or before the current one
      if (last !== null || bot.i > 0) bot.deaths++;
      let best = 0, bestD = 1e9;
      for (let k = 0; k <= bot.i && k < wps.length; k++) {
        const t = target(L, wps[k]);
        const d = Math.hypot(t.x - p.x, t.z - p.z) + Math.abs(t.y - p.y);
        if (d <= bestD + 0.01) { bestD = d; best = k; }
      }
      bot.i = bestD < 1.2 ? Math.min(best + 1, wps.length - 1) : best;
      bot.log.push(`respawn at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} -> wp ${bot.i}`);
      lastProgressT = performance.now();
    }
    last = { x: p.x, z: p.z };
    if (performance.now() - lastProgressT > 25000) { bot.stuck++; lastProgressT = performance.now(); bot.log.push(`stuck at wp ${bot.i} pos ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); }

    const wp = wps[Math.min(bot.i, wps.length - 1)];
    const t = target(L, wp);
    const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
    if (grounded && dist < (wp.ride ? 0.7 : 0.55) && Math.abs(t.y - p.y) < 0.6) {
      // on an answer block: stay until the game has counted it (it checks once per frame)
      if (wp.gate && !L.gates.find(g => g.id === wp.gate).gate.cleared) { v.x = v.y = 0; D.input.update(); return; }
      if (bot.i < wps.length - 1) { bot.i++; lastProgressT = performance.now(); }
      return;
    }
    let ux = dist > 1e-3 ? dx / dist : 0, uz = dist > 1e-3 ? dz / dist : 0;
    let go = true;
    if (grounded) {
      // hammer in the way? wait until its head is well to one side of the line we walk
      if (wp.hammer) {
        const h = L.hazards.find(h => h.id === wp.hammer);
        const hb = h?.pushyBody?.translation();
        if (hb) {
          const side = (hb.x - h.basePos.x) * -uz + (hb.z - h.basePos.z) * ux;   // sideways offset from our line
          const near = Math.hypot(h.basePos.x - p.x, h.basePos.z - p.z);
          // go only while the head is far out AND still swinging outwards
          const outward = Math.abs(side) > Math.abs(lastSide) + 1e-4;
          lastSide = side;
          if (near < 4.6 && near > 2.4 && !(Math.abs(side) > 2.9 && outward)) go = false;
        }
      }
      const floorAhead = ray(p.x + ux * 0.55, p.y + 0.4, p.z + uz * 0.55, 0, -1, 0, 0.9);
      const wall = ray(p.x, p.y + 0.25, p.z, ux, 0, uz, 0.75);
      const needJump = !floorAhead || wall;
      if (needJump) {
        const reachOk = wp.reach == null || (dist < wp.reach && Math.abs(t.y - p.y) < 1.3);
        if (!reachOk) go = false;
        else if (go && jumpCooldown <= 0) { D.input.jumpPressed = true; jumpCooldown = 15; }
      }
    }
    jumpCooldown--;
    // slow down for the last bit so we do not overshoot small platforms
    const speed = go ? (dist < 0.8 && grounded ? 0.75 : 1) : 0;   // 0.75 still beats a -3 conveyor
    v.x = ux * speed; v.y = uz * speed;
    D.input.update();   // apply the stick now; the game itself reads input only once per frame
  }
  D.onStep = tick;
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let failed = 0;
  for (const file of files) {
    const lvl = JSON.parse(fs.readFileSync(file, 'utf8'));
    const name = path.basename(file, '.json');
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 620 } })).newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + 'index.html');
    await page.evaluate(l => localStorage.setItem('krabsy_3d_editor_level', JSON.stringify(l)), lvl);
    await page.goto(base + 'index.html?level=editor');
    await page.waitForFunction(() => window.__krabsyDebug?.level() && window.__krabsyDebug.alive(), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    if (!lvl.botPath) { console.log(`${name}: no botPath in the level file`); failed++; continue; }
    await page.evaluate(botMain, lvl.botPath);
    const t0 = Date.now();
    let nextShot = 0, state;
    for (;;) {
      await page.waitForTimeout(1000);
      state = await page.evaluate(() => ({ ...window.__bot, pos: window.__krabsyDebug.player.getPosition(),
        gates: `${window.__krabsyDebug.level()?.clearedCount ?? '-'}/${window.__krabsyDebug.level()?.gateCount ?? '-'}` }));
      const el = (Date.now() - t0) / 1000;
      if (shots && state.i >= nextShot) { await page.screenshot({ path: path.join(shots, `${name}-wp${String(state.i).padStart(2, '0')}.png`) }); nextShot = state.i + Math.ceil(lvl.botPath.length / 6); }
      if (state.done || el > timeoutS || state.stuck >= 2) break;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    const ok = state.done && errs.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${state.done ? 'reached the flag' : `stopped at waypoint ${state.i}/${lvl.botPath.length}`} in ${secs}s, deaths ${state.deaths}, gates ${state.gates}` +
      (errs.length ? ` errors: ${errs.join(' | ')}` : ''));
    if (!ok || state.deaths) console.log('  ' + state.log.slice(-8).join('\n  '));
    if (shots && !state.done) await page.screenshot({ path: path.join(shots, `${name}-FAIL.png`) });
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
