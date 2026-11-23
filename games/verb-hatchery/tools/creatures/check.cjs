// node check.cjs   — loads every creature GLB in three.js (the game's vendored 0.169) through viewer.html,
// reports load errors / missing clips / wrong size, and saves screenshots to ../../_shots/creatures-<zone>-<clip>.png.
// Needs the dev server (python3 tools/serve.py; PORT=… for another port).
const { chromium } = require(process.env.PLAYWRIGHT || '/home/janah/dev/Worksheets/app/node_modules/playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const shots = path.resolve(__dirname, '../../_shots'); fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  const base = `http://localhost:${process.env.PORT || 8143}/tools/creatures/viewer.html`;
  const views = process.argv.length > 2 ? process.argv.slice(2).map((v) => v.split(':')) : ['meadow', 'forest', 'beach', 'volcano'].flatMap((z) => [[z, 'idle', ''], [z, 'walk', '0.4']]);
  let n = 0;
  for (const [zone, clip, t] of views) {
    await page.goto(`${base}?zone=${zone}&clip=${clip}${t ? '&t=' + t : ''}`);
    await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const rep = await page.evaluate(() => window.report);
    n += Object.keys(rep.creatures).length; errs.push(...rep.errors);
    await page.screenshot({ path: path.join(shots, `creatures-${zone}-${clip}.png`) });
    console.log(zone, clip, Object.keys(rep.creatures).length, 'loaded');
  }
  console.log(errs.length ? 'PROBLEMS\n' + [...new Set(errs)].join('\n') : `OK: ${n} loads, no errors`);
  await browser.close(); process.exit(errs.length ? 1 : 0);
})();
