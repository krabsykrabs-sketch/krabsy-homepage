// node tools/qa.cjs [outDir] — figure builder checks (needs :8145):
//  - page loads, the figure does not turn by itself, the 🔄 button turns it on and off,
//  - every character in the gallery builds (all three groups),
//  - every hat / glasses / back option builds (on a human and on a skeleton),
//  - hats are switched off for heads they don't fit; skin/hair colours only for humans,
//  - random figures build, normalize() cleans junk, saving and reloading keep the figure.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const out = process.argv[2] || '/tmp/fbqa';
  require('fs').mkdirSync(out, { recursive: true });
  const ok = (c, w) => { console.log(c ? 'ok  ' : 'FAIL', w); if (!c) process.exitCode = 1; };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8145/');
  await p.waitForFunction(() => window.__fb && window.__fb.fig, null, { timeout: 60000 });
  ok(true, 'page loads, default figure built');
  const settle = () => p.waitForFunction(() => window.__fb.fig && JSON.stringify(window.__fb.fig.config) === JSON.stringify(window.__fb.cfg), null, { timeout: 30000 });
  const yaw = () => p.evaluate(() => window.__fb.fig.root.parent.rotation.y);

  // Turning: off by default, the button toggles it.
  const y0 = await yaw(); await p.waitForTimeout(800);
  ok(Math.abs((await yaw()) - y0) < 1e-6, 'figure does not turn by itself');
  await p.click('#spinBtn'); await p.waitForTimeout(800);
  const y1 = await yaw();
  ok(y1 !== y0 && await p.evaluate(() => window.__fb.spinning), '🔄 turns it on');
  await p.click('#spinBtn'); await p.waitForTimeout(300);
  const y2 = await yaw(); await p.waitForTimeout(600);
  ok(Math.abs((await yaw()) - y2) < 1e-6, '🔄 turns it off again');

  // Every character, through the gallery.
  const groups = await p.$$eval('#tabs button', (bs) => bs.length);
  let n = 0;
  for (let g = 0; g < groups; g++) {
    await p.locator('#tabs button').nth(g).click();
    const pics = await p.locator('#gallery .pic').count();
    for (let i = 0; i < pics; i++) {
      await p.locator('#gallery .pic').nth(i).click();
      await settle(); n++;
    }
  }
  ok(errs.length === 0 && n >= 40, `all ${n} characters build from the gallery`);

  // Every accessory option on a human and on a skeleton.
  const keys = await p.evaluate(async () => { const m = await import('./src/figure.js'); return { hat: Object.keys(m.HATS), glasses: Object.keys(m.GLASSES), back: Object.keys(m.BACKS) }; });
  let k = 0;
  for (const char of ['Hiker', 'Skeleton_Minion']) for (const [slot, list] of Object.entries(keys)) for (const v of ['none', ...list]) {
    await p.evaluate(([c, s, v]) => window.__fb.set({ char: c, [s]: v }), [char, slot, v]);
    await settle(); k++;
  }
  ok(errs.length === 0, `${k} accessory combinations build (hats ${keys.hat.length}, glasses ${keys.glasses.length}, back ${keys.back.length})`);

  // Rules per character.
  await p.evaluate(() => window.__fb.set({ char: 'Robot_One', hat: 'witch' })); await settle();
  ok(await p.evaluate(() => window.__fb.cfg.hat === 'own' && document.querySelector('.slot').classList.contains('off')), 'robot: hat row off, no hat');
  ok(await p.evaluate(() => [...document.querySelectorAll('.slot')].filter((s) => !s.classList.contains('hidden')).length === 6), 'robot: no skin / hair colours');
  await p.evaluate(() => window.__fb.set({ char: 'Hiker' })); await settle();
  ok(await p.evaluate(() => window.__fb.info.skin && [...document.querySelectorAll('.slot')].every((s) => !s.classList.contains('hidden'))), 'hiker: skin and hair colours shown');

  for (let i = 0; i < 6; i++) { await p.click('#randBtn'); await settle(); }
  ok(errs.length === 0 && await p.evaluate(() => window.__fb.cfg.char === 'Hiker'), '6 random looks build, character stays');

  const junk = await p.evaluate(async () => (await import('./src/figure.js')).normalize(
    { char: 'Mage', hat: 'sword', glasses: '<b>', back: 'quiver', skin: 99, hair: '3', main: 2.5, extra: 'x' }));
  ok(junk.char === 'Protagonist_A' && junk.hat === 'own' && junk.glasses === 'own' && junk.back === 'own' && junk.skin === -1
    && junk.hair === -1 && junk.main === -1 && !('extra' in junk), 'normalize() drops the Mage, unknown items, bad indices, extra keys');

  await p.evaluate(() => window.__fb.set({ char: 'OrcRaider', hat: 'cowboy', glasses: 'sun', back: 'jetpack', main: 3, acc: 2 }));
  await settle();
  await p.click('#saveBtn');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('krabsy_figure_v2')));
  ok(saved.char === 'OrcRaider' && saved.back === 'jetpack', 'saved on the device');
  await p.reload();
  await p.waitForFunction(() => window.__fb && window.__fb.fig, null, { timeout: 60000 });
  ok(await p.evaluate(() => window.__fb.cfg.char === 'OrcRaider' && window.__fb.cfg.hat === 'cowboy'
    && document.querySelector('#tabs .on').textContent.includes('Monster')), 'reload shows the saved figure (and its group)');
  await p.waitForTimeout(1000);
  await p.screenshot({ path: `${out}/saved.png` });
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 6)) : 'no errors');
  await b.close();
  process.exit(process.exitCode || 0);
})();
