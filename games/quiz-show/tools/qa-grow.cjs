// node tools/qa-grow.cjs [outDir] — the room grows with the group: a real teacher page and
// a real child page, then 30 simulated children join (plain WebSockets). The room must
// step up from 1.0 to 1.25 (16+ players) to 1.5 (29+), on both pages, without errors;
// the child can still walk, and the answer pads sit where the server judges them.
// Needs :8142 and :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const WS = 'ws://127.0.0.1:8150/api/quiz/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(WS); const c = { ws, send: (m) => ws.send(JSON.stringify(m)), waits: [] };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.waits = c.waits.filter(([t, r]) => (t === m.t ? (r(m), false) : true)); };
  c.next = (t) => new Promise((r) => c.waits.push([t, r])); c.open = new Promise((r) => { ws.onopen = r; }); return c;
}
(async () => {
  const out = process.argv[2] || '/tmp/qg';
  require('fs').mkdirSync(out, { recursive: true });
  const ok = (c, w) => { console.log(c ? 'ok  ' : 'FAIL', w); if (!c) process.exitCode = 1; };
  const until = async (fn, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(200); } return false; };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const T = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  T.on('pageerror', (e) => errs.push('T ' + e.message));
  await T.goto('http://localhost:8142/teacher.html?lang=de');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);
  const K = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
  K.on('pageerror', (e) => errs.push('K ' + e.message)); K.on('framenavigated', (f) => { if (f === K.mainFrame()) console.log('nav', f.url()); }); K.on('console', (m) => { if (/error|warn/.test(m.type())) console.log('KC', m.type(), m.text().slice(0, 200)); });
  await K.goto(`http://localhost:8142/index.html?code=${code}&lang=de`);
  await K.fill('#nameIn', 'Lena'); await K.click('#joinBtn');
  await K.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  ok(await K.evaluate(() => window.__qr.room.size === 1) && await T.evaluate(() => window.__qt.room.size === 1), 'starts at size 1.0');
  await T.screenshot({ path: `${out}/1-teacher-small.png` });

  const kids = [];
  const join = async (n) => { for (let i = 0; i < n; i++) { const k = client(); await k.open; k.send({ t: 'join', code, name: `Kid${kids.length}`, avatar: kids.length % 8, color: kids.length % 8 }); await k.next('joined'); kids.push(k); } };
  let t = 0;
  const walk = setInterval(() => { t += 0.1; const W = 15 * Math.max(1, ...[1]); kids.forEach((k, i) => k.send({ t: 'move', p: [Math.sin(t * 0.5 + i) * 12, 0, Math.cos(t * 0.4 + i * 1.7) * 8], r: t + i, a: 1 })); }, 100);
  await join(15);                                    // 16 players
  ok(await until(() => K.evaluate(() => window.__qr.room.size === 1.25)), 'child: grows to 1.25 at 16 players');
  ok(await until(() => T.evaluate(() => window.__qt.room.size === 1.25)), 'teacher: grows to 1.25');
  await join(13);                                    // 29 players
  ok(await until(() => K.evaluate(() => window.__qr.room.size === 1.5)), 'child: grows to 1.5 at 29 players');
  ok(await until(() => T.evaluate(() => window.__qt.room.size === 1.5)), 'teacher: grows to 1.5');
  await join(1);
  const lay = await K.evaluate(async () => { const L = await import('./src/play.js'); return { W: L.W, D: L.D, pads: L.PADS, balls: window.__qr.room.play.balls.length }; });
  ok(lay.W === 22.5 && lay.D === 15 && lay.balls === 7, `layout at 1.5: floor ${lay.W * 2}×${lay.D * 2} m, ${lay.balls} balls`);
  ok(Math.abs(lay.pads.x[0] + 9.9) < 1e-6 && Math.abs(lay.pads.z - 5.25) < 1e-6 && lay.pads.half === 2.25, `pads match the server (x ${lay.pads.x[0]}, z ${lay.pads.z}, half ${lay.pads.half})`);
  console.log('state', JSON.stringify(await K.evaluate(() => ({ pid: window.__qr.S.pid, me: !!window.__qr.room.me, net: window.__qr.net.status, url: location.href, n: window.__qr.room.avatars.size }))));
  // The child can still walk (and reaches further than the old wall at x = 14.4).
  await K.evaluate(() => window.__qr.ctl.teleport({ x: 12, y: 0, z: 9 }));
  await K.keyboard.down('d'); await wait(2500); await K.keyboard.up('d');
  const x = await K.evaluate(() => window.__qr.room.me.root.position.x);
  ok(x > 14.6, `child walks past the old wall (x ${x.toFixed(1)})`);
  await wait(1500);
  await T.screenshot({ path: `${out}/2-teacher-big.png` });
  await K.screenshot({ path: `${out}/3-child-big.png` });
  clearInterval(walk);
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 8)) : 'no errors');
  kids.forEach((k) => k.ws.close());
  await b.close(); process.exit(process.exitCode || 0);
})();
