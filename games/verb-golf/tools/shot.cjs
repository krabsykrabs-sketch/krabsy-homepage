// node tools/shot.cjs "<query>" out.png [w h] [js to run before the shot] — headless screenshot (QA)
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [query, out, w = 1366, h = 768, js = ''] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(`http://localhost:8140/${query}`);
  await page.waitForFunction(() => window.__VG && window.__VG.G.mode !== 'loading', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (js) { const r = await page.evaluate(js); if (r !== undefined) console.log('js:', JSON.stringify(r)); await page.waitForTimeout(1200); }
  await page.screenshot({ path: out });
  console.log(JSON.stringify(await page.evaluate(() => window.__VG && window.__VG.info && window.__VG.info())));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
