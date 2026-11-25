// node tools/qa-engine.cjs port "[extra query]" — levels 1-3 (+ wrongall): source, tiers, end mode, chain-order check. See CLAUDE.md. BASE=/games/verb-dungeon/ = the game's path on the server.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [port, extra = ''] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const lvl of [1, 2, 3]) for (const wa of ['', '&wrongall=1']) {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`http://localhost:${port}${process.env.BASE || '/'}?qa=play&level=${lvl}${wa}${extra}`);
    await page.waitForFunction(() => document.getElementById('qa') && document.getElementById('qa').textContent, null, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const out = JSON.parse(document.getElementById('qa').textContent);
      const log = window.__VD.askLog.map((s) => s.split(':'));
      const seq = log.filter((e, i) => i === 0 || e[1] + e[2] !== log[i - 1][1] + log[i - 1][2]);
      const bad = [];
      seq.forEach((e, i) => { if (e[2] === 'pp' && !(i > 0 && seq[i - 1][2] === 'past' && seq[i - 1][1] === e[1])) bad.push(seq.slice(Math.max(0, i - 1), i + 1).map((x) => x.join(':')).join(' > ')); });
      const info = window.__VD.info();
      const pool = window.__VD.G.pool.map((p) => p.base);
      return { rooms: out.map((o) => o.after && `${o.after.type}:${o.after.source}`).join(' '), end: info.mode, hearts: info.hearts, source: info.source, tiers: info.tiers,
        asked: info.asked, firstTry: info.firstTry, missed: info.missed.join(','), chainBad: bad, nAsks: seq.length, pool: pool.join(','), seq: seq.map((x) => x.slice(1).join(':')).join(' '), errors: out.filter((o) => typeof o === 'string') };
    });
    console.log(JSON.stringify({ lvl, wa: !!wa, ...r, pageErrors: errs }));
    await page.close();
  }
  await browser.close();
})();
