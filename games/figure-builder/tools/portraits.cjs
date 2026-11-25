// node tools/portraits.cjs [sheet.png] — renders assets/portraits/<name>.png for every
// character in assets/chars (needs :8145) and, optionally, one contact sheet of all.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const dir = path.join(__dirname, '..', 'assets');
  const names = fs.readdirSync(path.join(dir, 'chars')).filter((f) => f.endsWith('.glb')).map((f) => f.slice(0, -4));
  fs.mkdirSync(path.join(dir, 'portraits'), { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`http://127.0.0.1:8145/tools/portraits.html?names=${names.join(',')}`);
  await p.waitForFunction(() => window.__out, null, { timeout: 300000 });
  const out = await p.evaluate(() => window.__out);
  for (const [n, url] of Object.entries(out)) fs.writeFileSync(path.join(dir, 'portraits', `${n}.png`), Buffer.from(url.split(',')[1], 'base64'));
  if (process.argv[2]) {
    const html = `<body style="margin:0;background:#13204a;display:flex;flex-wrap:wrap;width:1600px;font:12px sans-serif;color:#fff">${
      Object.entries(out).map(([n, u]) => `<div style="width:160px;text-align:center"><img src="${u}" width="160"><div>${n}</div></div>`).join('')}</body>`;
    await p.setContent(html); await p.setViewportSize({ width: 1600, height: 1200 });
    await p.screenshot({ path: process.argv[2], fullPage: true });
  }
  console.log(Object.keys(out).length, 'portraits');
  await b.close();
})();
