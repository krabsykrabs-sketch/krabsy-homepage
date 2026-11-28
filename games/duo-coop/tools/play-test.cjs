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

// desktop plays level 1, then levels 2 and 3 ("Next level"); touch plays level 1.
// --from N: start at level N (?level=N, desktop only) and play to the last level;
// --level2 = --from 2.
const FROM = process.argv.includes('--from') ? +process.argv[process.argv.indexOf('--from') + 1] : (process.argv.includes('--level2') ? 2 : 1);
const L2ONLY = FROM > 1;
const RUNS = [
  { name: 'desktop', viewport: { width: 1366, height: 768 }, touch: false, query: '?lang=en', level2: true },
  { name: 'touch', viewport: { width: 1024, height: 768 }, touch: true, query: '?lang=de&touch=1', level2: false },
].filter((r) => !ONLY || r.name === ONLY).filter((r) => !L2ONLY || r.name === 'desktop');

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
  await page.goto(BASE + cfg.query + (L2ONLY ? `&level=${FROM}` : '') + EXTRA);
  if (!L2ONLY) {
    await page.waitForFunction(() => window.__duo && window.__duo.state() === 'menu', null, { timeout: 60000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${cfg.name}-0-menu.png` });
    if (cfg.touch) await page.tap('#play-btn'); else await page.click('#play-btn');
  }
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
    await page.waitForFunction((n) => !document.querySelector(`.card.p${n}`) || document.querySelector(`.card.p${n}`).hidden, pi + 1, { timeout: 12000 });
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

  // the strong one on a big floor button: it must be standing on it, then it sinks (no card)
  async function pressButton(pi, id) {
    const before = (await objs())[id].on;
    if (before) fail(`button ${id} was already down`);
    for (let t = 0; t < 2.5 && !(await objs())[id].on; t += 0.1) await step(0.1);
    if (!(await objs())[id].on) fail(`button ${id} did not go down under the strong one (${JSON.stringify(await P(pi))})`);
    if (await G('card', pi)) fail('the big button asked a question');
    await shot(`button-${id}-${(await G('room'))}`);
    return trace(`pressButton ${pi} ${id}`, await P(pi));
  }

  // hop with the direction held only briefly (short jumps onto a crate, a head, a shelf)
  async function shortHop(pi, dir, hold = 0.2) {
    await btn(pi, 'up', true); await step(1 / 30); await btn(pi, 'up', false);
    await btn(pi, dir, true);
    for (let t = 0; t < hold; t += 1 / 60) await step(1 / 60);
    await btn(pi, dir, false);
    for (let t = 0; t < 2 && !(await P(pi)).onGround; t += 1 / 30) await step(1 / 30);
    await step(0.1);
    return trace(`shortHop ${pi} ${dir} ${hold}`, await P(pi));
  }

  // ══ Level 2 ═══════════════════════════════════════════════════════════════════════
  async function level2() {
    const C = 0, S = 1;
    // 2-1 Upstairs, downstairs: wall below and switch above at the same time
    await shot('L2-1-start');
    await walkTo(S, 8.5);
    await answer(S, true, 'L2-1-crack');                 // the strong one smashes the wall …
    await walkTo(C, 6.5);                                // … while the climber goes up
    await climb(C, 1, 7);
    await step(0.5);
    await expect(async () => (await objs()).G.open, '2-1: wall not smashed');
    await walkTo(C, 17.5);
    await answer(C);
    await expect(async () => (await objs()).D.open, '2-1: door D did not open');
    await walkTo(C, 19.5);
    await answer(C);
    await step(1.6);
    await expect(async () => (await objs()).L.open, '2-1: the key did not open the gate');
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await walkTo(C, 29.9);
    await nextRoom(2);

    // 2-2 Across the gap
    await shot('L2-2-start');
    await walkTo(C, 5, { jump: false });
    let p = await runJump(C, 'right', 9.6);
    if (cx(p) < 13) fail(`2-2: climber did not clear the gap (x ${cx(p).toFixed(2)})`);
    await walkTo(C, 15.5);
    await answer(C);
    await expect(async () => (await objs()).o.active, '2-2: portal not active');
    await walkTo(S, 6.5);
    await btn(S, 'action', true); await step(1 / 60); await btn(S, 'action', false); await step(0.1);
    if (Math.abs(cx(await P(S)) - 15.5) > 0.6) fail('2-2: strong one did not come through the portal');
    await walkTo(S, 14.5, { jump: false });
    await walkTo(S, 19.62, { jump: false, tol: 0.05 }); // pushes the crate to the step
    const bx = (await G('boxes'))[0];
    if (Math.abs(bx.x - 20.04) > 0.15) fail(`2-2: crate not at the step (x ${bx.x.toFixed(2)})`);
    await walkTo(S, 24.5);
    if ((await P(S)).y < 4.99) fail('2-2: strong one not on the step');
    await pressButton(S, 'h');
    await expect(async () => (await objs()).D.open, '2-2: the button did not open the door');
    await walkTo(C, 24.9);
    if ((await P(C)).y < 4.99) fail('2-2: climber not on the step');
    for (let i = 0; i < 3 && (await P(C)).y < 7.99; i++) { await walkTo(C, 24.75, { jump: false }); await shortHop(C, 'left', 0.25 + i * 0.1); }
    if ((await P(C)).y < 7.99) fail(`2-2: climber did not get onto the key shelf (y ${(await P(C)).y.toFixed(2)})`);
    await shot('L2-2-shelf');
    await walkTo(C, 22.6, { jump: false });
    await answer(C);
    await step(1.6);
    await expect(async () => (await objs()).L.open, '2-2: the key did not open the gate');
    await walkTo(S, 29.4);
    await walkTo(C, 30.3);
    await walkTo(C, 30.3);
    await nextRoom(3);

    // 2-3 Stack it up
    await shot('L2-3-start');
    await walkTo(C, 4.5);
    await climb(C, 1, 7);
    await walkTo(S, 6.5);                               // at the same time: the wall …
    await answer(S);
    await walkTo(C, 2.5);                               // … and the switch
    await answer(C);
    await expect(async () => (await objs()).D.open, '2-3: door D did not open');
    await expect(async () => (await objs()).G.open, '2-3: wall not smashed');
    await walkTo(S, 13.59, { jump: false });            // crate right beside the key shelf
    await shortHop(S, 'right', 0.12);
    await walkTo(S, 14.55, { jump: false, tol: 0.06 });  // the right half of the crate: beside the shelf
    if (Math.abs((await P(S)).y - 3.96) > 0.02) fail(`2-3: strong one not on the crate (y ${(await P(S)).y.toFixed(2)})`);
    const sx = cx(await P(S));
    await walkTo(C, sx - 0.9, { jump: false });
    for (let i = 0; i < 3 && Math.abs((await P(C)).y - 5.56) > 0.05; i++) { await walkTo(C, sx - 0.9, { jump: false }); await shortHop(C, 'right', 0.12 + i * 0.05); }
    if (Math.abs((await P(C)).y - 5.56) > 0.05) fail(`2-3: climber not on the strong one's head (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 14.6, { jump: false, tol: 0.06 });  // on the head, clear of the shelf above
    await shot('L2-3-on-head');
    await shortHop(C, 'left', 0.35);
    if ((await P(C)).y < 7.99) fail(`2-3: climber did not reach the key shelf (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 12.5, { jump: false });
    await answer(C);
    await step(1.6);
    await expect(async () => (await objs()).L.open, '2-3: the key did not open the gate');
    await walkTo(S, 12.5);                               // off the crate, round to its left side
    await walkTo(S, 18.59, { jump: false });             // crate to the platform
    await walkTo(S, 23.5);
    if ((await P(S)).y < 4.99) fail('2-3: strong one not on the platform');
    await walkTo(C, 23.0);
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await walkTo(C, 29.9);
    await page.waitForTimeout(2100);
    await step(0.1);
  }

  // ══ Level 3 ═══════════════════════════════════════════════════════════════════════
  async function level3() {
    const C = 0, S = 1;
    // 3-1 Going up
    await shot('L3-1-start');
    await walkTo(S, 7.5);                                // at the same time: the wall …
    await answer(S);
    await walkTo(C, 5.5, { jump: false });               // … and the climb to the key
    await climb(C, 1, 9);
    await walkTo(C, 7.5, { jump: false });
    await answer(C);
    await expect(async () => (await objs()).G.open, '3-1: wall not smashed');
    await walkTo(S, 10.9, { jump: false });              // onto the lift
    await walkTo(C, 8, { jump: false });
    let p = await runJump(C, 'right', 9.6);              // over the lift shaft
    if (p.y < 8.99) fail(`3-1: climber did not get onto the upper floor (y ${p.y.toFixed(2)})`);
    await walkTo(C, 13.5);
    await answer(C);
    await step(3);
    if (Math.abs((await P(S)).y - 9) > 0.05) fail(`3-1: the lift did not bring the strong one up (y ${(await P(S)).y.toFixed(2)})`);
    await shot('L3-1-lift');
    await walkTo(S, 18.5);
    await pressButton(S, 'h');
    await expect(async () => (await objs()).D.open, '3-1: the button did not open the door');
    await expect(async () => (await objs()).L.open, '3-1: the key did not open the gate');
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await nextRoom(2);

    // 3-2 Bridge and portal
    await shot('L3-2-start');
    await walkTo(S, 7.5);                                // the wall …
    await answer(S);
    await walkTo(C, 4.5, { jump: false });               // … and the portal on the ledge
    await climb(C, 1, 7);
    await walkTo(C, 2.5, { jump: false });
    await answer(C);
    await btn(C, 'action', true); await step(1 / 60); await btn(C, 'action', false); await step(0.2);
    if (Math.abs(cx(await P(C)) - 21.5) > 0.6) fail(`3-2: climber did not come out of the far portal (x ${cx(await P(C)).toFixed(2)})`);
    await expect(async () => (await objs()).G.open, '3-2: wall not smashed');
    await walkTo(C, 18.5, { jump: false });
    await answer(C);
    await step(0.5);
    await expect(async () => (await objs()).b.solid, '3-2: bridge not built');
    await walkTo(S, 23.5);
    if (cx(await P(S)) < 22) fail('3-2: strong one did not cross the bridge');
    await pressButton(S, 'h');
    await expect(async () => (await objs()).D.open, '3-2: the button did not open the door');
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await nextRoom(3);

    // 3-3 All together
    await shot('L3-3-start');
    await walkTo(S, 8.6, { jump: false });               // both onto the lift …
    await walkTo(C, 8.05, { jump: false, tol: 0.06 });
    await answer(C);                                     // … the climber pulls the lever riding along
    await step(2);
    if ((await P(S)).y < 5.99 || (await P(C)).y < 5.99) fail(`3-3: the lift did not bring both up (S ${(await P(S)).y.toFixed(2)}, C ${(await P(C)).y.toFixed(2)})`);
    await shot('L3-3-lift');
    await walkTo(S, 15.5);                               // the wall …
    await answer(S);
    await walkTo(C, 13.5, { jump: false });              // … and the climb to the switch
    await climb(C, 1, 10);
    await walkTo(C, 11.5, { jump: false });
    await answer(C);
    await expect(async () => (await objs()).D.open, '3-3: switch did not open the door');
    await expect(async () => (await objs()).G.open, '3-3: wall not smashed');
    await walkTo(S, 22.5, { jump: false });              // beside the key shelf
    await walkTo(C, 21.5, { jump: false });
    for (let i = 0; i < 3 && Math.abs((await P(C)).y - 7.6) > 0.05; i++) { await walkTo(C, 21.5, { jump: false }); await shortHop(C, 'right', 0.12 + i * 0.05); }
    if (Math.abs((await P(C)).y - 7.6) > 0.05) fail(`3-3: climber not on the strong one's head (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 22.6, { jump: false, tol: 0.06 });
    await shortHop(C, 'left', 0.35);
    if ((await P(C)).y < 9.99) fail(`3-3: climber did not reach the key slot (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 20.5, { jump: false });
    await answer(C);
    await step(1.6);
    await expect(async () => (await objs()).L.open, '3-3: the key did not open the gate');
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await page.waitForTimeout(2100);
    await step(0.1);
  }

  // ══ Level 4 "Think first" ═══════════════════════════════════════════════════════════
  async function level4() {
    const C = 0, S = 1;
    // 4-1 The stand-in: the crate holds the plate for the bridge
    await shot('L4-1-start');
    await walkTo(S, 4.45, { jump: false });             // the wall … (the climber meanwhile jumps the gap)
    await answer(S);
    await walkTo(C, 12.4);
    let p = await runJump(C, 'right', 12.8);
    if (cx(p) < 16) fail(`4-1: climber did not clear the gap (x ${cx(p).toFixed(2)})`);
    await walkTo(C, 18.5, { jump: false });
    await climb(C, 1, 8);
    await walkTo(C, 16.5, { jump: false });
    await answer(C);                                     // the key flies to gate G
    await expect(async () => (await objs()).W.open, '4-1: wall not smashed');
    await walkTo(S, 6.3, { jump: false });
    await expect(async () => !(await objs()).b.on, '4-1: bridge there before anything stands on the plate');
    await walkTo(S, 10.62, { jump: false, tol: 0.05 });  // push the crate onto the plate, against the step
    const bx = (await G('boxes'))[0];
    if (bx.x < 10.9 || bx.x > 11.1) fail(`4-1: crate not on the plate (x ${bx.x.toFixed(2)})`);
    await step(0.6);
    await expect(async () => (await objs()).b.solid, '4-1: the crate on the plate did not hold the bridge');
    await shot('L4-1-crate');
    await walkTo(S, 24.4);                               // over the crate, across the bridge
    if (cx(await P(S)) < 24) fail('4-1: strong one did not cross');
    await walkTo(C, 23.2, { jump: false });
    for (let i = 0; i < 3 && Math.abs((await P(C)).y - 5.6) > 0.05; i++) { await walkTo(C, 23.2, { jump: false }); await shortHop(C, 'right', 0.15 + i * 0.05); }
    if (Math.abs((await P(C)).y - 5.6) > 0.05) fail(`4-1: climber not on the head (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 24.6, { jump: false, tol: 0.06 });
    await shortHop(C, 'right', 0.3);
    if ((await P(C)).y < 7.99) fail(`4-1: climber did not reach the lever shelf (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 25.5, { jump: false });
    await answer(C);
    await expect(async () => (await objs()).D.open && (await objs()).G.open, '4-1: door or gate still shut');
    await walkTo(C, 22.6, { jump: false });             // down off the shelf (the wall is on its right), beside the strong one
    await walkTo(S, 29.2);
    await walkTo(C, 29.8);
    await nextRoom(2);

    // 4-2 Either / or: the climber goes through b first, then the toggle
    await shot('L4-2-start');
    await walkTo(C, 6.5, { jump: false });
    await climb(C, 1, 8);
    await walkTo(C, 13.5, { jump: false });
    if (cx(await P(C)) < 13) fail('4-2: climber did not get through door b');
    await walkTo(S, 9.5);
    await answer(S);                                     // the toggle: a opens, b shuts
    await step(0.3);
    await expect(async () => (await objs()).a.open && !(await objs()).b.open, '4-2: the toggle did not swap the doors');
    await walkTo(C, 15.5, { jump: false });
    await answer(C);                                     // release lever: the crate drops
    await step(1.2);
    if ((await G('boxes'))[0].static) fail('4-2: caged crate did not drop');
    await walkTo(S, 16.4, { jump: false });
    await walkTo(S, 21.59, { jump: false, tol: 0.05 });  // crate to the plateau
    if (Math.abs((await G('boxes'))[0].x - 22.04) > 0.15) fail(`4-2: crate not at the plateau (x ${(await G('boxes'))[0].x.toFixed(2)})`);
    await walkTo(S, 25.4);
    if ((await P(S)).y < 4.99) fail('4-2: strong one not on the plateau');
    await walkTo(C, 17.5, { jump: false });              // down through the hole
    await walkTo(C, 24.3);
    for (let i = 0; i < 3 && Math.abs((await P(C)).y - 6.6) > 0.05; i++) { await walkTo(C, 24.4, { jump: false }); await shortHop(C, 'right', 0.15 + i * 0.05); }
    if (Math.abs((await P(C)).y - 6.6) > 0.05) fail(`4-2: climber not on the head (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 25.6, { jump: false, tol: 0.06 });
    await shortHop(C, 'right', 0.3);
    if ((await P(C)).y < 8.99) fail(`4-2: climber did not reach the key shelf (y ${(await P(C)).y.toFixed(2)})`);
    await walkTo(C, 26.5, { jump: false });
    await answer(C);
    await step(1.6);
    await expect(async () => (await objs()).G.open, '4-2: the key did not open the gate');
    await walkTo(C, 23.8, { jump: false });             // down off the shelf, beside the strong one
    await walkTo(S, 29.2);
    await walkTo(C, 29.8);
    await nextRoom(3);

    // 4-3 Who calls the lift? crate + strong one + climber up the block, then the lift
    await shot('L4-3-start');
    await walkTo(S, 20.45, { jump: false });
    await answer(S);                                     // the wall …
    await walkTo(C, 29.4);                               // … and the climber to the key in the tunnel
    await answer(C);
    await step(0.5);
    await expect(async () => (await objs()).W.open, '4-3: wall not smashed');
    await walkTo(S, 9.39, { jump: false, tol: 0.05 });   // push the crate left against the block
    if (Math.abs((await G('boxes'))[0].x - 8) > 0.15) fail(`4-3: crate not at the block (x ${(await G('boxes'))[0].x.toFixed(2)})`);
    await shortHop(S, 'left', 0.12);
    if (Math.abs((await P(S)).y - 3.96) > 0.02) fail(`4-3: strong one not on the crate (y ${(await P(S)).y.toFixed(2)})`);
    await walkTo(C, 10.2, { jump: false });
    for (let i = 0; i < 3 && Math.abs((await P(C)).y - 5.56) > 0.05; i++) { await walkTo(C, 10.2, { jump: false }); await shortHop(C, 'left', 0.15 + i * 0.05); }
    if (Math.abs((await P(C)).y - 5.56) > 0.05) fail(`4-3: climber not on the head (y ${(await P(C)).y.toFixed(2)})`);
    await shortHop(C, 'left', 0.5);                      // along the block face, over the top
    if ((await P(C)).y < 8.99) fail(`4-3: climber did not get onto the block (y ${(await P(C)).y.toFixed(2)})`);
    await shot('L4-3-block');
    await walkTo(S, 10.5, { jump: false });              // onto the lift
    await walkTo(C, 3.5, { jump: false });
    await answer(C);                                     // the lift goes up
    await step(3);
    if (Math.abs((await P(S)).y - 9) > 0.05) fail(`4-3: the lift did not bring the strong one up (y ${(await P(S)).y.toFixed(2)})`);
    await walkTo(C, 4, { jump: false });
    p = await runJump(C, 'right', 7.2);                  // block → raised lift (one cell)
    if (p.y < 8.99 || cx(p) < 9) fail(`4-3: climber did not reach the raised lift (x ${cx(p).toFixed(2)} y ${p.y.toFixed(2)}; lift top ${(await objs()).Y.top}, strong ${JSON.stringify(await P(S))})`);
    await expect(async () => (await objs()).G.open, '4-3: the key did not open the gate');
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await page.waitForTimeout(2100);
    await step(0.1);
  }

  // ══ Level 5 (hold-and-act, crate on the lift, relay) ════════════════════════════════
  async function level5() {
    const C = 0, S = 1;
    // 5-1 Hold the bridge
    await shot('L5-1-start');
    await walkTo(S, 5.45, { jump: false });             // the wall … and the climber's key
    await answer(S);
    await walkTo(C, 4.5, { jump: false });
    await climb(C, 1, 7);
    await walkTo(C, 2.5, { jump: false });
    await answer(C);
    await expect(async () => (await objs()).W.open, '5-1: wall not smashed');
    await walkTo(S, 10.5, { jump: false });              // onto the plate: the bridge stands
    await step(0.6);
    await expect(async () => (await objs()).b.solid, '5-1: no bridge while the strong one holds the plate');
    await walkTo(C, 21.5, { jump: false });              // across, to the lever
    if (cx(await P(C)) < 21) fail('5-1: climber did not cross the held bridge');
    await answer(C);                                     // the bridge is fixed
    await walkTo(S, 29.2);
    await expect(async () => (await objs()).b.solid, '5-1: the fixed bridge went away when the strong one left the plate');
    if (cx(await P(S)) < 28) fail('5-1: strong one did not cross the fixed bridge');
    await walkTo(C, 29.8);
    await nextRoom(2);

    // 5-2 Crate on the lift
    await shot('L5-2-start');
    await walkTo(S, 4.45, { jump: false });
    await answer(S);
    await step(0.5);
    await walkTo(S, 13.61, { jump: false, tol: 0.05 });  // crate onto the lift, against the upper floor
    if (Math.abs((await G('boxes'))[0].x - 14.04) > 0.15) fail(`5-2: crate not on the lift (x ${(await G('boxes'))[0].x.toFixed(2)})`);
    await walkTo(C, 9.5, { jump: false });
    await climb(C, 1, 7);
    await walkTo(C, 11.3, { jump: false });
    let p = await runJump(C, 'right', 11.5);             // over the shaft
    if (p.y < 6.99 || cx(p) < 15) fail(`5-2: climber did not cross the shaft (x ${cx(p).toFixed(2)} y ${p.y.toFixed(2)})`);
    await walkTo(C, 16.5, { jump: false });
    await answer(C);                                     // the lift goes up with crate and strong one
    await step(2.5);
    if (Math.abs((await P(S)).y - 7) > 0.05 || Math.abs((await G('boxes'))[0].y - 7) > 0.05) fail(`5-2: lift did not bring both up (S ${(await P(S)).y.toFixed(2)}, crate ${(await G('boxes'))[0].y.toFixed(2)})`);
    await shot('L5-2-lift');
    await walkTo(C, 26.5);                               // the climber up the step to the switch
    await answer(C);
    await walkTo(S, 23.6, { jump: false, tol: 0.05 });   // the long push along the upper floor
    if (Math.abs((await G('boxes'))[0].x - 24.04) > 0.15) fail(`5-2: crate not at the step (x ${(await G('boxes'))[0].x.toFixed(2)})`);
    await walkTo(S, 27.4);
    if ((await P(S)).y < 8.99) fail('5-2: strong one not on the step');
    await expect(async () => (await objs()).D.open, '5-2: exit door shut');
    await walkTo(S, 29.2);
    await walkTo(C, 29.8);
    await nextRoom(3);

    // 5-3 Relay
    await shot('L5-3-start');
    await walkTo(S, 21.45, { jump: false });
    await answer(S);                                     // the wall …
    await walkTo(C, 26.5, { jump: false });              // … and the climber up the ladder
    await climb(C, 1, 9);
    await walkTo(C, 15.2, { jump: false });              // to the door (shut)
    await step(0.5);
    await walkTo(S, 2.5);                                // the strong one holds plate A (far left)
    await step(0.6);
    await expect(async () => (await objs()).D.open, '5-3: door not open while the strong one holds plate A');
    await walkTo(C, 10.5, { jump: false });
    if (cx(await P(C)) > 11) fail('5-3: climber did not get through the held door');
    await answer(C);                                     // the lift comes down with the crate
    await step(3);
    if ((await G('boxes'))[0].y > 3.05) fail(`5-3: the crate did not come down (y ${(await G('boxes'))[0].y.toFixed(2)})`);
    await walkTo(S, 15.61, { jump: false, tol: 0.05 });  // crate rightwards onto plate B, against the step
    if (Math.abs((await G('boxes'))[0].x - 16.04) > 0.15) fail(`5-3: crate not on plate B (x ${(await G('boxes'))[0].x.toFixed(2)})`);
    await step(0.6);
    await expect(async () => (await objs()).D.open, '5-3: the crate on plate B did not keep the door open');
    await shot('L5-3-crate');
    await walkTo(S, 6.5, { jump: false });               // onto the lift
    await answer(C);                                     // the climber calls it up again
    await step(3);
    if (Math.abs((await P(S)).y - 9) > 0.05) fail(`5-3: the lift did not bring the strong one up (y ${(await P(S)).y.toFixed(2)})`);
    await walkTo(S, 29.1);
    await walkTo(C, 29.8);
    await page.waitForTimeout(2100);
    await step(0.1);
  }

  if (!L2ONLY) {
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
  // at the same time: the strong one smashes the wall, the climber climbs to the lever
  await walkTo(C, 7.4, { jump: false });             // the climber can't smash it (no card)
  await btn(C, 'action', true); await step(1 / 60); await btn(C, 'action', false);
  if (await G('card', C)) fail('the climber got a question at the cracked wall');
  await walkTo(S, 7.5);
  await answer(S, true, '1-crack');
  await walkTo(C, 6.5);
  await climb(C, 1, 7);
  await step(0.5);
  await expect(async () => (await objs()).G.open && !(await objs()).G.solid, 'cracked wall not smashed');
  await shot('1-smashed');
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
  // the strong one tries the gap: falls, and is back at the room's start a moment later
  await btn(S, 'right', true);
  for (let t = 0; t < 3 && (await P(S)).y > -1; t += 1 / 30) await step();
  await btn(S, 'right', false);
  if ((await P(S)).y > -1) fail('strong one did not fall into the gap');
  await shot('1-fall');
  await step(1.3);
  p = await P(S);
  if (Math.abs(cx(p) - 4.5) > 0.3 || p.y !== 3) fail(`strong one not back at the start after the fall (x ${cx(p).toFixed(2)} y ${p.y.toFixed(2)})`);
  await walkTo(S, 13.5);
  await walkTo(C, 20.5);
  await answer(C);
  await expect(async () => (await objs()).b.solid, 'bridge not built');
  await walkTo(S, 29.2);
  await expect(async () => (await objs()).E.open, 'the exit should be open from the start');
  await walkTo(C, 29.8);
  await walkTo(C, 29.9);
  await nextRoom(2);

  // ── Room 2: boxes ───────────────────────────────────────────────────────────────
  await shot('2-start');
  await walkTo(C, 4.5);
  await climb(C, 1, 7);
  await walkTo(C, 2.5);
  await answer(C, true, '2-key');                  // the key flies to the locked door
  await expect(async () => !(await objs()).L.open, 'locked door opened before the key arrived');
  await step(0.6);
  await shot('2-key-flying');
  await step(1.0);
  await expect(async () => (await objs()).L.open, 'locked door did not open when the key arrived');
  await walkTo(S, 14.62, { jump: false, max: 8 }); // pushes the crate against the step
  let bx = (await G('boxes'))[0];
  if (Math.abs(bx.x - 15) > 0.1) fail(`crate not at the step (x ${bx.x.toFixed(2)})`);
  // the big button: the climber is too light, the strong one presses it (no question)
  await walkTo(C, 17.5);
  await step(1.2);
  if ((await objs()).h.on || !(await G('boxes'))[1].static) fail('the climber pressed the big button');
  await walkTo(C, 19.4, { jump: false });
  await walkTo(S, 17.5);                           // climbs crate + step, jumps onto the button
  if ((await P(S)).y < 4.99) fail('strong one did not get onto the step');
  await pressButton(S, 'h');                       // the cage opens
  await step(1.2);                                 // the crate drops
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
  if (cx(await P(S)) > 27) fail('the portal took the strong one through without pressing use');
  await btn(S, 'action', true); await step(1 / 60); await btn(S, 'action', false); await step(0.1);
  if (cx(await P(S)) < 27) fail('strong one did not go through the portal');
  await walkTo(C, 30.2);
  await btn(C, 'action', true); await step(1 / 60); await btn(C, 'action', false);   // exits never ask
  if (await G('card', C)) fail('the exit asked a question');
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
  // at the same time: the strong one smashes the wall, the climber climbs to the key
  await walkTo(S, 22.5);
  await answer(S);
  await walkTo(C, 22.5);
  await climb(C, 1, 9);
  await walkTo(C, 18.5);
  await answer(C);
  await step(1.6);
  await expect(async () => (await objs()).G.open, 'cracked wall in room 3 not smashed');
  await expect(async () => (await objs()).L.open, 'room 3: locked door did not open with the key');
  await walkTo(C, 22.5, { jump: false });
  await climb(C, -1, 3);
  await walkTo(S, 28.1);
  await walkTo(C, 28.9);
  await walkTo(C, 28.9);
  await page.waitForTimeout(2100);
  await step(0.1);
  await page.waitForFunction(() => window.__duo.state() === 'results', null, { timeout: 8000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${cfg.name}-9-results.png` });
  } // level 1

  if (cfg.level2) {
    for (const L of [2, 3, 4, 5]) {
      if (L < FROM) continue;
      if (L > FROM || FROM === 1) {
        if (await page.isHidden('#next-level-btn')) fail(`no "Next level" button before level ${L}`);
        await page.click('#next-level-btn');
        await page.waitForFunction((n) => window.__duo.state() === 'playing' && window.__duo.game?.level() === n, L, { timeout: 90000 });
        await page.evaluate(() => window.__duo.game.manual(true));
      }
      await (L === 2 ? level2() : L === 3 ? level3() : L === 4 ? level4() : level5());
      await page.waitForFunction(() => window.__duo.state() === 'results', null, { timeout: 8000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${cfg.name}-L${L}-results.png` });
    }
    if (!(await page.isHidden('#next-level-btn'))) fail('"Next level" shown after the last level');
  }
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
