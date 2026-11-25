// node tools/sheet.cjs <heads|hats|outfits> <out.png> — renders a contact sheet (needs :8145).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [sheet = 'heads', out = '/tmp/sheet.png'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 2000, height: 2000 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:8145/tools/sheet.html?sheet=${sheet}`);
  await p.waitForFunction(() => window.__done, null, { timeout: 120000 });
  await p.locator('canvas').screenshot({ path: out });
  await b.close();
})();
