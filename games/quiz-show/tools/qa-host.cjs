// node tools/qa-host.cjs [outDir] — the teacher's figure: the teacher types a name, opens
// the room and walks the wizard with the keyboard; a child sees it (name with crown,
// 1.4× size), sees it move and wave, sees a rename, and sees it vanish while the teacher's
// page is gone. Needs :8142 and :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const out = process.argv[2] || '/tmp/qh';
  require('fs').mkdirSync(out, { recursive: true });
  const ok = (c, w) => { console.log(c ? 'ok  ' : 'FAIL', w); if (!c) process.exitCode = 1; };
  const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(200); } return false; };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const tctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const T = await tctx.newPage(); T.on('pageerror', (e) => errs.push('T ' + e.message));
  await T.goto('http://localhost:8142/teacher.html?lang=de');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  await T.fill('#hostIn', 'Frau Ahrens');
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);
  await T.waitForFunction(() => window.__qt.room.host && window.__qt.room.host.model, null, { timeout: 20000 });
  ok(await T.evaluate(() => window.__qt.room.me === window.__qt.room.host), 'teacher page: the wizard is the teacher\'s own figure');
  ok(await T.isVisible('#hostHint'), 'hint how to walk is shown');

  const K = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
  K.on('pageerror', (e) => errs.push('K ' + e.message));
  await K.goto(`http://localhost:8142/index.html?code=${code}&lang=de`);
  await K.fill('#nameIn', 'Mia'); await K.click('#joinBtn');
  await K.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  await K.waitForFunction(() => window.__qr.room.host && window.__qr.room.host.model, null, { timeout: 20000 });
  const h = await K.evaluate(() => { const a = window.__qr.room.host; return { name: a.info.name, vis: a.root.visible, sc: a.model.scale.x, host: a.host }; });
  ok(h.name === 'Frau Ahrens' && h.vis && h.sc === 1.4 && h.host, `child sees the wizard "${h.name}" at ${h.sc}×`);
  ok(await K.evaluate(() => !window.__qr.S.players.some((p) => p.pid === 0)), 'the wizard is not in the player list');
  // Teacher walks right with the keyboard.
  const x0 = await K.evaluate(() => window.__qr.room.host.root.position.x);
  await T.click('#c', { position: { x: 640, y: 300 } }).catch(() => {});
  await T.keyboard.down('d'); await wait(5000); await T.keyboard.up('d');
  console.log('  teacher x', await T.evaluate(() => window.__qt.room.host.root.position.x.toFixed(2)), 'child x', await K.evaluate(() => window.__qr.room.host.root.position.x.toFixed(2)));
  ok(await until(async () => (await K.evaluate(() => window.__qr.room.host.root.position.x)) > x0 + 1), `child sees the wizard walk (from x ${x0.toFixed(1)})`);
  // Emote 3 (cheer) by key.
  await T.keyboard.press('3');
  ok(await until(() => K.evaluate(() => window.__qr.room.host.emoteT > 0), 5000), 'child sees the wizard\'s emote');
  await wait(1500);
  await K.screenshot({ path: `${out}/1-child.png` });
  await T.screenshot({ path: `${out}/2-teacher.png` });
  // Rename (from the page's socket) and leaving.
  await T.evaluate(() => window.__qt.net.send({ t: 'host', name: 'Mr K' }));
  ok(await until(() => K.evaluate(() => window.__qr.room.host.info.name === 'Mr K')), 'rename reaches the child');
  await T.close();
  ok(await until(() => K.evaluate(() => window.__qr.room.host.root.visible === false)), 'wizard vanishes while the teacher page is gone');
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 6)) : 'no errors');
  await b.close(); process.exit(process.exitCode || 0);
})();
