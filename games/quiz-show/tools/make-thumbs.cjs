// node tools/make-thumbs.cjs — renders assets/thumbs/<Avatar>.png (needs the dev server on :8142).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto('http://localhost:8142/tools/thumbs.html');
  await page.waitForFunction(() => window.__thumbs, null, { timeout: 60000 });
  const thumbs = await page.evaluate(() => window.__thumbs);
  for (const [name, url] of Object.entries(thumbs)) {
    const file = path.join(__dirname, '..', 'assets', 'thumbs', `${name}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file, fs.statSync(file).size);
  }
  await browser.close();
})();
