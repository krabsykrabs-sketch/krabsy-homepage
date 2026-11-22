// node tools/shot.cjs "<query>" out.png [w h] [steps…] — headless screenshot (QA).
// Steps: JS run in the page (then a 1 s wait), a number = wait ms, '@file.png' = screenshot now,
// '!click x y' = a real mouse click. Needs the dev server on :8143 (python3 tools/serve.py), or PORT=… for another one.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [query, out, w = 1366, h = 768, ...steps] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); else if (m.text().startsWith('[event]')) console.log(m.text()); });
  await page.goto(`http://localhost:${process.env.PORT || 8143}/${query}`);
  await page.waitForFunction(() => !document.getElementById('playBtn').disabled, null, { timeout: 60000 }).catch(() => errs.push('play button never enabled'));
  await page.waitForTimeout(600);
  for (const js of steps) {
    if (/^\d+$/.test(js)) { await page.waitForTimeout(+js); continue; }
    if (js.startsWith('@')) { await page.screenshot({ path: js.slice(1) }); continue; }
    if (js.startsWith('!drag')) { // '!drag x0 y0 x1 y1' = a real mouse drag
      const [x0, y0, x1, y1] = js.split(' ').slice(1).map(Number);
      await page.mouse.move(x0, y0); await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10);
      await page.mouse.up(); await page.waitForTimeout(500); continue;
    }
    if (js.startsWith('!clickjs ')) { const p = await page.evaluate(js.slice(9)); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500); continue; }
    if (js.startsWith('!key')) { await page.keyboard.press(js.split(' ')[1]); await page.waitForTimeout(500); continue; }
    if (js.startsWith('!click')) { const [x, y] = js.split(' ').slice(1); await page.mouse.click(+x, +y); await page.waitForTimeout(500); continue; }
    const r = await page.evaluate(js);
    if (r !== undefined) console.log('js:', JSON.stringify(r));
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: out });
  if (errs.length) console.log('ERRORS', errs);
  await browser.close();
})();
