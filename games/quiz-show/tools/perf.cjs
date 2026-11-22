// node tools/perf.cjs [extra=29] — rendering cost of a full room: one real child page
// (headless Chromium) plus `extra` simulated children (plain WebSockets) who walk around
// with all 8 avatars. Prints frames per second and frame time with 1 and with 1+extra
// avatars. Headless uses a software GPU, so absolute numbers are far below a real
// Chromebook; compare the two lines. Needs :8142 and :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const WS = 'ws://127.0.0.1:8150/api/quiz/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(WS);
  const c = { ws, send: (m) => ws.send(JSON.stringify(m)), waits: [] };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.waits = c.waits.filter(([t, r]) => (t === m.t ? (r(m), false) : true)); };
  c.next = (t) => new Promise((r) => c.waits.push([t, r]));
  c.open = new Promise((r) => { ws.onopen = r; });
  return c;
}

(async () => {
  const extra = +(process.argv[2] || 29);
  const q = { kind: 'trio', base: 'go', slots: [null, null], askIndex: 0, options: ['went', 'goed', 'gone', 'wented'], correct: 0, teach: '', item: 'go', topic: 'irregular_verbs', form: 'past' };
  const T = client(); await T.open;
  T.send({ t: 'create', questions: [q], time: 30 });
  const { code } = await T.next('created');

  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await page.goto(`http://localhost:8142/index.html?code=${code}`);
  await page.fill('#nameIn', 'Me'); await page.click('#joinBtn');
  await page.waitForFunction(() => window.__qr.S.pid != null);
  await wait(3000);
  const measure = () => page.evaluate(() => new Promise((r) => {
    const times = []; let last = performance.now();
    const f = (t) => { times.push(t - last); last = t; if (times.length < 90) requestAnimationFrame(f); else {
      times.sort((a, b) => a - b);
      r({ fps: +(1000 / (times.reduce((a, b) => a + b) / times.length)).toFixed(1), p50: +times[45].toFixed(1), p90: +times[81].toFixed(1),
        calls: window.__qr.room.renderer.info.render.calls, tris: window.__qr.room.renderer.info.render.triangles });
    } };
    requestAnimationFrame(f);
  }));
  console.log('1 avatar ', JSON.stringify(await measure()));

  const kids = [];
  for (let i = 0; i < extra; i++) {
    const k = client(); await k.open;
    k.send({ t: 'join', code, name: `Kid${i}`, avatar: i % 8, color: i % 8 });
    await k.next('joined'); kids.push(k);
  }
  let t = 0;
  const walk = setInterval(() => { t += 0.1; kids.forEach((k, i) => k.send({ t: 'move', p: [Math.sin(t * 0.7 + i) * 10, 0, Math.cos(t * 0.5 + i * 1.7) * 7], r: t + i, a: 1 })); }, 100);
  await wait(6000);                                   // models load, everyone walks
  console.log(`${extra + 1} avatars`, JSON.stringify(await measure()));
  await page.screenshot({ path: process.argv[3] || '/tmp/perf.png' });
  clearInterval(walk);
  kids.forEach((k) => k.ws.close()); T.ws.close();
  await browser.close();
})();
