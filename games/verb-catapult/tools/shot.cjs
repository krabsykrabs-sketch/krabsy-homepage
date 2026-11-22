// node tools/shot.cjs "<query>" out.png [w h] [js steps…] — headless screenshot (QA).
// Each extra argument is JS run in the page, then a 1.2 s wait (a number = wait that many ms).
// Needs the dev server on :8141 (python3 tools/serve.py).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [query, out, w = 1366, h = 768, ...steps] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: query.includes('touch') })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(`http://localhost:8141/${query}`);
  await page.waitForFunction(() => window.__VC && window.__VC.G.mode !== 'loading', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  for (const js of steps) {
    if (/^\d+$/.test(js)) { await page.waitForTimeout(+js); continue; }
    const r = await page.evaluate(js); if (r !== undefined) console.log('js:', JSON.stringify(r));
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: out });
  console.log(JSON.stringify(await page.evaluate(() => window.__VC && window.__VC.info())));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
