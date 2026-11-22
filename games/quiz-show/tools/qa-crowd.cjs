// node tools/qa-crowd.cjs [outDir] — bonus round in a crowd: 16 simulated children stand
// on the answer pads; a real child must still see the four answers (signs above the
// pads, chips in its bonus bar) and its bar marks the pad it stands on. Needs :8142, :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const WS = 'ws://127.0.0.1:8150/api/quiz/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function client() {
  const ws = new WebSocket(WS); const c = { ws, send: (m) => ws.send(JSON.stringify(m)), waits: [] };
  ws.onmessage = (e) => { const m = JSON.parse(e.data); c.waits = c.waits.filter(([t, r]) => (t === m.t ? (r(m), false) : true)); };
  c.next = (t) => new Promise((r) => c.waits.push([t, r])); c.open = new Promise((r) => { ws.onopen = r; }); return c;
}
const Q = (base, opts) => ({ kind: 'trio', base, slots: [null, null], askIndex: 0, options: opts, correct: 0, teach: '', item: base, topic: 'irregular_verbs', form: 'past' });
(async () => {
  const out = process.argv[2] || '/tmp/qc';
  require('fs').mkdirSync(out, { recursive: true });
  const ok = (c, w) => { console.log(c ? 'ok  ' : 'FAIL', w); if (!c) process.exitCode = 1; };
  const T = client(); await T.open;
  T.send({ t: 'create', questions: [Q('go', ['went', 'goed', 'gone', 'wented'])], bonus: [Q('bring', ['brought', 'brang', 'bringed', 'brung'])], time: 60 });
  const { code } = await T.next('created');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const K = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  K.on('pageerror', (e) => errs.push(e.message));
  await K.goto(`http://localhost:8142/index.html?code=${code}&lang=de`);
  await K.fill('#nameIn', 'Lena'); await K.click('#joinBtn');
  await K.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  const kids = [];
  for (let i = 0; i < 16; i++) { const k = client(); await k.open; k.send({ t: 'join', code, name: `Kid${i}`, avatar: i % 8, color: i % 8 }); await k.next('joined'); kids.push(k); }
  T.send({ t: 'start' }); await T.next('question'); T.send({ t: 'next' }); await T.next('reveal'); T.send({ t: 'next' });
  await K.waitForFunction(() => window.__qr.S.bonus && window.__qr.S.phase === 'question', null, { timeout: 15000 });
  // Everyone crowds the pads (4 per pad), standing still.
  const P = await K.evaluate(async () => (await import('./src/play.js')).PADS);
  const stand = setInterval(() => kids.forEach((k, i) => k.send({ t: 'move', p: [P.x[i % 4] + ((i >> 2) - 1.5) * 0.7, 0.06, P.z + ((i >> 2) % 2 - 0.5) * 0.8], r: 0, a: 0 })), 100);
  await K.evaluate(([x, z]) => window.__qr.ctl.teleport({ x, y: 0.1, z: z + 3 }), [P.x[1], P.z]);
  await wait(4000);
  const signs = await K.evaluate(() => window.__qr.room.play.pads.map((p) => p.sign.visible));
  ok(signs.every(Boolean), 'signs above all four pads');
  const chips = await K.$$eval('#bonusOpts .bopt span', (els) => els.map((e) => e.textContent));
  ok(JSON.stringify(chips) === JSON.stringify(['brought', 'brang', 'bringed', 'brung']) && await K.isVisible('#bonusOpts'), `answers in the bonus bar: ${chips.join(' / ')}`);
  ok(await K.$$eval('#bonusOpts .here', (e) => e.length) === 0, 'no pad marked while off the pads');
  await K.screenshot({ path: `${out}/1-crowd.png` });
  await K.evaluate(([x, z]) => window.__qr.ctl.teleport({ x, y: 0.1, z }), [P.x[1], P.z]);
  await wait(1500);
  ok(await K.$$eval('#bonusOpts .bopt', (els) => els.map((e) => e.classList.contains('here')).join()) === 'false,true,false,false', 'chip B marked while standing on pad B');
  await K.screenshot({ path: `${out}/2-on-B.png` });
  T.send({ t: 'next' });
  await K.waitForFunction(() => window.__qr.S.phase === 'reveal', null, { timeout: 10000 });
  await wait(800);
  const op = await K.evaluate(() => window.__qr.room.play.pads.map((p) => p.sign.material.opacity));
  ok(op[0] === 1 && op.slice(1).every((o) => o < 0.5), `reveal: right sign bright, wrong ones faded (${op.join(', ')})`);
  await K.screenshot({ path: `${out}/3-reveal.png` });
  clearInterval(stand);
  console.log(errs.length ? 'ERRORS ' + JSON.stringify(errs.slice(0, 5)) : 'no errors');
  kids.forEach((k) => k.ws.close()); T.ws.close();
  await b.close(); process.exit(process.exitCode || 0);
})();
