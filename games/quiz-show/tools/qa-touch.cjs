// node tools/qa-touch.cjs [outDir] — touch controls and reconnecting, headless:
// a child on a touch tablet walks with the stick and jumps with the button; then its
// connection drops and it comes back as the same child with its points. Also checks
// the class link: after a reveal the answer lands in the child's own learning stats.
// Needs :8142 and :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [out = '/tmp/qt'] = process.argv.slice(2);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, what) => { console.log(cond ? 'ok  ' : 'FAIL', what); if (!cond) process.exitCode = 1; };
  const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); } return false; };

  const T = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  T.on('pageerror', (e) => errs.push(`T ${e.message}`));
  await T.goto('http://localhost:8142/teacher.html?lang=de');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);

  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false });
  const K = await ctx.newPage();
  K.on('pageerror', (e) => errs.push(`K ${e.message}`));
  K.on('console', (m) => { if (m.type() === 'error') errs.push(`K ${m.text()}`); });
  await K.goto(`http://localhost:8142/index.html?code=${code}&lang=de`);
  await K.fill('#nameIn', 'Tara');
  await K.tap('#joinBtn');
  await K.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  await wait(1500);
  ok(await K.evaluate(() => document.documentElement.classList.contains('touch')), 'touch mode on');
  ok(await K.isVisible('#tJump'), 'jump button shown');

  // Drag the stick to the right (synthetic touch events on the canvas).
  const p0 = await K.evaluate(() => window.__qr.room.me.root.position.toArray());
  await K.evaluate(() => {
    const c = document.getElementById('c');
    const mk = (x, y) => new Touch({ identifier: 7, target: c, clientX: x, clientY: y });
    c.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mk(200, 600)], changedTouches: [mk(200, 600)] }));
    c.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [mk(270, 600)], changedTouches: [mk(270, 600)] }));
  });
  await until(async () => (await K.evaluate(() => window.__qr.room.me.root.position.x)) > p0[0] + 1.5, 8000);
  await K.screenshot({ path: `${out}/01-touch-stick.png` });
  await K.evaluate(() => {
    const c = document.getElementById('c');
    const t = new Touch({ identifier: 7, target: c, clientX: 270, clientY: 600 });
    c.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [t] }));
  });
  const p1 = await K.evaluate(() => window.__qr.room.me.root.position.toArray());
  ok(p1[0] > p0[0] + 1.5, `stick moves the avatar right (${(p1[0] - p0[0]).toFixed(1)} m)`);

  // Jump button.
  await K.evaluate(() => { const b = document.getElementById('tJump'); b.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })); });
  const jumped = await until(async () => (await K.evaluate(() => window.__qr.room.me.root.position.y)) > 0.4, 5000);
  await K.evaluate(() => { const b = document.getElementById('tJump'); b.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })); });
  ok(jumped, 'jump button jumps');

  // A question answered by tapping; the answer goes into this device's learning stats.
  await T.click('#mainBtn');
  await K.waitForFunction(() => window.__qr.S.phase === 'question', null, { timeout: 10000 });
  await T.waitForFunction(() => window.__qt.S.phase === 'question' && window.__qt.S.q, null, { timeout: 10000 });
  const correct = await T.evaluate(() => window.__qt.S.q.correct);
  await K.tap(`#qboxes .box:nth-child(${correct + 1})`);
  await K.waitForFunction(() => window.__qr.S.phase === 'reveal', null, { timeout: 10000 });
  await wait(800);
  const stats = await K.evaluate(() => { try { return JSON.parse(localStorage.getItem('krabsy_stats_v2') || 'null'); } catch (_) { return null; } });
  const item = await T.evaluate(() => window.__qt.S.q.item);
  ok(!!(stats && stats.items && stats.items.irregular_verbs && stats.items.irregular_verbs[item]), `answer recorded in the child's stats (${item})`);
  const score = await K.evaluate(() => window.__qr.S.score);

  // Connection drops → reconnects as the same child, with its points.
  const pid = await K.evaluate(() => window.__qr.S.pid);
  await K.evaluate(() => window.__qr.net.ws.close());
  const lostShown = await until(() => K.isVisible('#status'), 3000);
  const back = await until(() => K.evaluate(() => window.__qr.net.status === 'open'), 15000);
  await wait(1500);
  ok(back, 'reconnected');
  ok(await K.evaluate((p) => window.__qr.S.pid === p, pid), 'same child after reconnect');
  ok(await K.evaluate((s) => window.__qr.S.score === s, score), `points kept (${score})`);
  ok(!(await K.isVisible('#status')), `"connection lost" note gone again (was shown: ${lostShown})`);
  ok(await T.evaluate(() => window.__qt.S.players.length === 1), 'still one player in the room');
  await K.screenshot({ path: `${out}/02-after-reconnect.png` });
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 10)) : 'no errors');
  await browser.close();
})();
