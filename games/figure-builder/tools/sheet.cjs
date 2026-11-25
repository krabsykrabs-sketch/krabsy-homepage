// node tools/sheet.cjs <hats|glasses|backs> <people|fantasy|monsters> <out.png> — renders a
// contact sheet: rows = the group's characters, columns = 'own' + every option (needs :8145).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [sheet = 'hats', group = 'people', out = '/tmp/sheet.png'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 2000, height: 4000 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:8145/tools/sheet.html?sheet=${sheet}&group=${group}`);
  await p.waitForFunction(() => window.__done, null, { timeout: 300000 });
  const info = await p.evaluate(() => window.__done);
  await p.locator('canvas').screenshot({ path: out });
  console.log('rows:', info.chars.join(', '));
  console.log('cols:', info.opts.join(', '));
  await b.close();
})();
