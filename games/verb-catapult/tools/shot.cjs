// node tools/shot.cjs "<query>" out.png [w h] [js steps…] — headless screenshot (QA).
// Each extra argument is JS run in the page, then a 1.2 s wait (a number = wait that many ms;
// '@file.png' = take a screenshot right now).
// Needs the dev server on :8141 (python3 tools/serve.py).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [query, out, w = 1366, h = 768, ...steps] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: query.includes('touch') })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(query.startsWith("tools/") ? `http://localhost:8141/${query}` : `http://localhost:8141/${query}`);
  await page.waitForFunction(() => window.__VC && window.__VC.G.mode !== 'loading', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  for (const js of steps) {
    if (/^\d+$/.test(js)) { await page.waitForTimeout(+js); continue; }
    if (js.startsWith('!drag')) { // '!drag x0 y0 x1 y1 [up]': a real mouse drag
      const [x0, y0, x1, y1, up] = js.split(' ').slice(1);
      await page.mouse.move(+x0, +y0); await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(+x0 + (x1 - x0) * i / 12, +y0 + (y1 - y0) * i / 12);
      if (up === 'up') await page.mouse.up();
      await page.waitForTimeout(400); continue;
    }
    if (js.startsWith('@')) { await page.screenshot({ path: js.slice(1) }); continue; } // '@file.png' = a shot mid-sequence
    const r = await page.evaluate(js); if (r !== undefined) console.log('js:', JSON.stringify(r));
    await page.waitForTimeout(js.includes("NOWAIT") ? 0 : 1200);
  }
  await page.screenshot({ path: out });
  console.log(JSON.stringify(await page.evaluate(() => window.__VC && window.__VC.info())));
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
