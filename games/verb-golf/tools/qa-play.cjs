// node tools/qa-play.cjs [port] — plays every level with ?qa=play (and &wrongall=1) and prints the result.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const { LEVELS_N = '2' } = process.env;
(async () => {
  const [port = 8140, extra = ''] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (let lvl = 1; lvl <= +LEVELS_N; lvl++) for (const wa of ['', '&wrongall=1']) {
    const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) errs.push(m.text()); });
    await page.goto(`http://localhost:${port}/?qa=play&level=${lvl}${wa}${extra}`);
    const ok = await page.waitForFunction(() => document.getElementById('qa').textContent, null, { timeout: 240000 }).then(() => true, () => false);
    const r = await page.evaluate(() => {
      const i = window.__VG.info();
      const log = window.__VG.G.askLog.map((s) => s.split(':'));
      const bad = []; // a 3rd-form question must follow the same verb's 2nd form (any gate/card in between is listed)
      log.forEach((e, k) => { if (e[2] === 'pp' && !(k > 0 && log[k - 1][2] === 'past' && log[k - 1][1] === e[1])) bad.push(log.slice(Math.max(0, k - 1), k + 1).map((x) => x.join(':')).join(' > ')); });
      return { end: i.mode, scores: i.scores.map((s) => `${s.strokes}/${s.par}${s.gaveUp ? '!' : ''}(p${s.penalties})`).join(' '), answers: i.answers, firstTry: i.firstTry,
        missed: i.missed.join(','), asks: window.__VG.G.askLog.join(' '), chainBad: bad, events: i.track.filter((e) => e[0] !== 'answer').map((e) => e[0]).join(','), calls: i.calls };
    });
    console.log(JSON.stringify({ lvl, wrongall: !!wa, finished: ok, ...r, errs }));
    await page.close();
  }
  await browser.close();
})();
