// Plays the whole level (3 rooms) in headless Chromium and checks it.
//
//   node games/duo-coop/tools/play-test.cjs [base-url] [out-dir] [--only desktop|touch]
//   base-url default http://localhost:8930/games/duo-coop/ (tools/serve.py)
//
// Playwright: PLAYWRIGHT_DIR (default ~/.npm/_npx/e78b33305587cb7c/node_modules/), browser:
// CHROME (default the ms-playwright chromium-1234). api.krabsy.com is blocked (host rule).
//
// Software WebGL runs at ~4 fps, so the bot switches the game to manual stepping
// (debug.manual) and moves the simulation with debug.advance(); it presses the same input
// pads the keyboard and touch buttons use; it answers with the quick-answer keys (1 2 3 /
// 8 9 0) on desktop and by tapping the chips on touch.
// Runs: desktop 1366×768 (keyboard) and tablet 1024×768 (touch: ?touch=1, hasTouch, the
// touch buttons are tapped once for real). Fails on any console error or failed request.
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const req = createRequire(process.env.PLAYWRIGHT_DIR || (process.env.HOME + '/.npm/_npx/e78b33305587cb7c/node_modules/'));
const { chromium } = req('playwright');

const BASE = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://localhost:8930/games/duo-coop/';
const OUT = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : path.join(require('os').tmpdir(), 'duo-shots');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const EXTRA = process.env.QUERY || '';
fs.mkdirSync(OUT, { recursive: true });

const RUNS = [
  { name: 'desktop', viewport: { width: 1366, height: 768 }, touch: false, query: '?lang=en' },
  { name: 'touch', viewport: { width: 1024, height: 768 }, touch: true, query: '?lang=de&touch=1' },
].filter((r) => !ONLY || r.name === ONLY);

function fail(msg) { throw new Error(msg); }

async function run(browser, cfg) {
  const ctx = await browser.newContext({ viewport: cfg.viewport, hasTouch: cfg.touch, isMobile: false });
  const page = await ctx.newPage();
  const errors = [];
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.text().startsWith('[duo]')) logs.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const t0 = Date.now();
  if (process.env.TRACE) {
    page.on('request', (r) => { if (/\.glb$/.test(r.url())) console.log(`  ${Date.now() - t0} ms request ${r.url().split('/').pop()}`); });
    page.on('requestfinished', (r) => { if (/\.glb$/.test(r.url())) console.log(`  ${Date.now() - t0} ms loaded ${r.url().split('/').pop()}`); });
  }
  const warnings = [];
  page.on('requestfailed', (r) => {
    if (!/api\.krabsy\.com/.test(r.url())) errors.push(`failed after ${Date.now() - t0} ms: ${r.url()} ${r.failure()?.errorText}`);
  });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + cfg.query + EXTRA);
  await page.waitForFunction(() => window.__duo && window.__duo.state() === 'menu', null, { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${cfg.name}-0-menu.png` });
  if (cfg.touch) await page.tap('#play-btn'); else await page.click('#play-btn');
  await page.waitForFunction(() => window.__duo.state() === 'playing' && window.__duo.game, null, { timeout: 90000 });
  await page.evaluate(() => window.__duo.game.manual(true));
  const figs = (await page.evaluate(() => window.__duo.game.players())).map((p) => `${p.figure}${p.built ? ' (built stand-in)' : ''}`);
  if (figs.some((f) => f.includes('stand-in'))) errors.push('a figure did not load: ' + figs.join(' + '));

  const G = (fn, ...a) => page.evaluate(([f, args]) => window.__duo.game[f](...args), [fn, a]);
  const P = async (pi) => (await G('players'))[pi];
  const cx = (p) => p.x + p.w / 2;
  const step = (s = 1 / 30) => G('advance', s);
  const held = new Set();      // the pads count presses, so press each button only once
  const btn = async (pi, b, on) => {
    const k = `${pi}:${b}`;
    if (on === held.has(k)) return;
    if (on) held.add(k); else held.delete(k);
    await G(on ? 'press' : 'release', pi, b);
  };
  let answers = 0, wrongs = 0;
  const trace = (what, p) => {
    if (process.env.TRACE) console.log(`  ${what}: x ${(p.x + p.w / 2).toFixed(2)} y ${p.y.toFixed(2)} ground ${p.onGround} climbing ${p.climbing}`);
    return p;
  };

  async function walkTo(pi, x, { tol = 0.14, max = 25, jump = true } = {}) {
    let stuck = 0, last = null;
    for (let t = 0; t < max; t += 1 / 30) {
      const p = await P(pi);
      const d = x - cx(p);
      if (Math.abs(d) < tol) break;
      if (last !== null && Math.abs(cx(p) - last) > 2) break;      // went through a portal
      const dir = d > 0 ? 'right' : 'left', other = d > 0 ? 'left' : 'right';
      if (Math.abs(d) < 0.6 && Math.abs(p.vx) > 1.2 && Math.sign(p.vx) === Math.sign(d)) {   // brake
        await btn(pi, dir, false); await btn(pi, other, false);
        await step(1 / 60);
        last = cx(p);
        continue;
      }
      await btn(pi, other, false); await btn(pi, dir, true);
      if (last !== null && Math.abs(cx(p) - last) < 0.004 && p.onGround) stuck++; else stuck = 0;
      if (jump && stuck > 4) { await btn(pi, 'up', true); await step(); await btn(pi, 'up', false); stuck = 0; }
      last = cx(p);
      await step(Math.max(1 / 120, Math.min(1 / 30, Math.abs(d) / 6)));
    }
    await btn(pi, 'left', false); await btn(pi, 'right', false);
    await step(0.25);
    for (let t = 0; t < 3 && !(await P(pi)).onGround; t += 0.1) await step(0.1);   // land first
    return trace(`walkTo ${pi} ${x}`, await P(pi));
  }
  async function hop(pi, dir = null, secs = 1.6) {
    if (dir) await btn(pi, dir, true);
    await btn(pi, 'up', true); await step(); await btn(pi, 'up', false);
    for (let t = 0; t < secs; t += 1 / 30) { await step(); const p = await P(pi); if (p.onGround && t > 0.15) break; }
    if (dir) await btn(pi, dir, false);
    await step(0.1);
    return trace(`hop ${pi} ${dir}`, await P(pi));
  }
  // run towards dir and jump once past atX (a run-up, like a child would)
  async function runJump(pi, dir, atX) {
    await btn(pi, dir, true);
    for (let t = 0; t < 4; t += 1 / 60) {
      await step(1 / 60);
      const p = await P(pi);
      if (dir === 'right' ? cx(p) >= atX : cx(p) <= atX) break;
    }
    return hop(pi, dir);
  }
  async function climb(pi, dir, toY) {
    const b = dir > 0 ? 'up' : 'down';
    await btn(pi, b, true);
    for (let t = 0; t < 8; t += 1 / 30) {
      await step();
      const p = await P(pi);
      if (dir > 0 ? p.y >= toY - 0.01 && !p.climbing : p.onGround && !p.climbing && t > 0.2) break;
    }
    await btn(pi, b, false);
    await step(0.2);
    return trace(`climb ${pi} ${toY}`, await P(pi));
  }
  async function answer(pi, right = true, shot = null) {
    await btn(pi, 'action', true); await step(1 / 60); await btn(pi, 'action', false);
    const card = await G('card', pi);
    if (!card) fail(`no card opened for player ${pi + 1}: ${JSON.stringify(await P(pi))}`);
    if (shot) { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${cfg.name}-${shot}.png` }); }
    const i = right ? card.correctIndex : (card.correctIndex + 1) % card.options.length;
    const sel = `.card.p${pi + 1} .chip >> nth=${i}`;
    if (cfg.touch) await page.tap(sel);
    else await page.keyboard.press([['1', '2', '3'], ['8', '9', '0']][pi][i]);   // quick-answer keys
    answers++; if (!right) wrongs++;
    if (!right && shot) { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${cfg.name}-${shot}-wrong.png` }); }
    await page.waitForFunction((n) => !document.querySelector(`.card.p${n}`) || document.querySelector(`.card.p${n}`).hidden, pi + 1, { timeout: 6000 });
    await step(0.1);
  }
  const objs = () => G('objects');
  async function expect(cond, msg) { if (!(await cond())) fail(msg); }
  async function shot(n) { await step(0); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${cfg.name}-${n}.png` }); }
  async function nextRoom(n) {
    await page.waitForTimeout(2100);
    await step(0.1);
    const st = await G('state');
    if (n && (await G('room')) !== n) fail(`expected room ${n}, game state ${st}, room ${await G('room')}`);
  }

  // touch buttons: one real tap each on player 2's jump and player 1's right
  if (cfg.touch) {
    const before = await P(1);
    await page.tap('[data-pad="1"][data-btn="up"]');
    await step(0.6);
    const after = await P(1);
    if (!(after.onGround)) fail('touch jump: player 2 not back on the ground');
    const box = await page.locator('[data-pad="0"][data-btn="right"]').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    if (before.y !== after.y) fail('touch jump moved the player vertically after landing');
  }

  // ── Room 1: levers and doors ────────────────────────────────────────────────────
  const C = 0, S = 1;   // climber = player 1, strong one = player 2 (default roles)
  await shot('1-start');
  await walkTo(C, 6.5);
  await climb(C, 1, 7);
  await walkTo(C, 3.5);
  await answer(C, false, '1-card');               // a wrong answer first: the lever stays off
  await expect(async () => !(await objs()).a.on, 'lever a turned on after a wrong answer');
  await answer(C, true);
  await expect(async () => (await objs()).A.open, 'door A did not open');
  await walkTo(C, 10.5);
  await walkTo(S, 13.5);
  await walkTo(C, 12, { jump: false });
  let p = await runJump(C, 'right', 14.6);
  if (cx(p) < 19) fail(`climber did not clear the pit (x ${cx(p).toFixed(2)})`);
  await walkTo(C, 20.5);
  await answer(C);
  await expect(async () => (await objs()).b.solid, 'bridge not built');
  await walkTo(S, 24.5);
  await answer(S, true, '1-gate');
  await expect(async () => (await P(S)).holding === 'G', 'strong one is not holding the gate');
  await walkTo(C, 27.5);
  await shot('1-holding');
  await answer(C);
  await expect(async () => (await objs()).G.propped, 'gate not propped');
  await walkTo(S, 29.2);
  await walkTo(C, 29.8);
  await answer(C);
  await walkTo(C, 29.9);
  await nextRoom(2);

  // ── Room 2: boxes ───────────────────────────────────────────────────────────────
  await shot('2-start');
  await walkTo(C, 4.5);
  await climb(C, 1, 7);
  await walkTo(C, 2.5);
  await answer(C);
  await expect(async () => (await P(C)).hasKey, 'climber has no key');
  await walkTo(C, 11.6);
  await answer(C);
  await expect(async () => (await objs()).L.open, 'locked door still closed');
  await walkTo(S, 14.62, { jump: false, max: 8 }); // pushes the crate against the step
  let bx = (await G('boxes'))[0];
  if (Math.abs(bx.x - 15) > 0.1) fail(`crate not at the step (x ${bx.x.toFixed(2)})`);
  await walkTo(S, 17.5);                           // climbs crate + step
  if ((await P(S)).y < 4.99) fail('strong one did not get onto the step');
  await answer(S);                                 // heavy lever: the cage opens
  await step(1.2);
  bx = (await G('boxes'))[1];
  if (bx.static || bx.y > 5.05) fail('caged crate did not fall');
  await walkTo(S, 23.5);                           // pushes it to the upper wall and climbs
  if ((await P(S)).y < 6.99) fail('strong one is not on the upper floor');
  await walkTo(C, 24.5);
  await answer(C);
  await expect(async () => (await objs()).O.active, 'portal not active');
  await shot('2-portal');
  await btn(C, 'action', true); await step(1 / 60); await btn(C, 'action', false); await step(0.1);
  if (cx(await P(C)) < 27) fail('climber did not go through the portal');
  await walkTo(S, 24.5);
  if (cx(await P(S)) < 27) fail('strong one did not go through the portal');
  await walkTo(C, 30.2);
  await answer(C);
  await walkTo(S, 29.6);
  await walkTo(C, 30.2);
  await nextRoom(3);

  // ── Room 3: together ────────────────────────────────────────────────────────────
  await shot('3-start');
  await walkTo(S, 4.6);
  await walkTo(C, 4.75, { jump: false, tol: 0.08 });
  p = await hop(C);
  if (Math.abs(p.y - 4.6) > 0.05) fail(`climber is not standing on the strong one's head (y ${p.y.toFixed(2)})`);
  await shot('3-on-head');
  p = await hop(C, 'left', 2);
  if (p.y < 6.99) fail(`climber did not reach the high ledge (y ${p.y.toFixed(2)})`);
  await walkTo(C, 2.5);
  await answer(C);
  await expect(async () => (await objs()).D.open, 'door D did not open');
  await walkTo(C, 13.5);
  await walkTo(S, 15.5);
  await answer(S);
  await walkTo(C, 19.5);
  await answer(C);
  await expect(async () => (await objs()).O.active, 'portal O not active');
  await walkTo(S, 12.5);                           // lets go of the gate, through the portal
  if (cx(await P(S)) < 17) fail('strong one did not come through the portal');
  await expect(async () => !(await objs()).G.open, 'gate stayed open after letting go');
  await walkTo(C, 22.5);
  await climb(C, 1, 9);
  await walkTo(C, 18.5);
  await answer(C);
  await expect(async () => (await P(C)).hasKey, 'no key from the tunnel');
  await walkTo(C, 23.6);
  await answer(C);
  await walkTo(S, 28.1);
  await walkTo(C, 28.9);
  await answer(C, true);
  await walkTo(C, 28.9);
  await page.waitForTimeout(2100);
  await step(0.1);
  await page.waitForFunction(() => window.__duo.state() === 'results', null, { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${cfg.name}-9-results.png` });
  const sum = await G('summary');
  const resultLine = await page.textContent('#sum-line');
  await ctx.close();
  return { sum, resultLine, answers, wrongs, errors, warnings, logs, figs };
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/home/janah/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    // api.krabsy.com is blocked by name (page.route would intercept every request, and
    // Chromium then reports streamed .glb fetches as ERR_ABORTED although they load)
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      '--host-resolver-rules=MAP api.krabsy.com 127.0.0.1:9'],
  });
  let ok = true;
  for (const cfg of RUNS) {
    const t0 = Date.now();
    try {
      const r = await run(browser, cfg);
      const bad = r.errors.length > 0;
      if (bad) ok = false;
      console.log(`${bad ? 'FAIL' : 'OK  '} ${cfg.name} ${cfg.viewport.width}×${cfg.viewport.height}: all 3 rooms, ${r.answers} answers (${r.wrongs} wrong on purpose), ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      console.log(`     results: ${r.resultLine} · figures: ${r.figs.join(' + ')}`);
      for (const l of r.logs) console.log('     ' + l);
      for (const e of r.errors) console.log('     ERROR ' + e);
      for (const w of r.warnings) console.log('     warning ' + w);
    } catch (e) {
      ok = false;
      console.log(`FAIL ${cfg.name}: ${e.message}`);
    }
  }
  await browser.close();
  console.log(ok ? 'ALL OK' : 'FAILED');
  process.exit(ok ? 0 : 1);
})();
