// node tools/qa-room.cjs [outDir] [children=3] [query]  — headless test of a whole quiz:
// one teacher page and N child pages (separate browser contexts). Needs the game dev
// server on :8142 and the API (uvicorn main:app --port 8150) on :8150. Children walk around, answer
// (child 0 always right, child 1 always wrong, the last one skips every 3rd question),
// screenshots at each stage, prints errors and the end results.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [out = '/tmp/qr', nKids = '3', query = 'lang=de'] = process.argv.slice(2);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (path, w = 1280, h = 720, tag = '') => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(`${tag} ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} ${m.text()}`); });
    await page.goto(`http://localhost:8142/${path}`);
    return page;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const teacher = await open(`teacher.html?${query}`, 1280, 720, 'T');
  await wait(1500);
  await teacher.screenshot({ path: `${out}/01-teacher-setup.png` });
  await teacher.click('#openBtn');
  await teacher.waitForFunction(() => window.__qt.S.code, null, { timeout: 30000 });
  const code = await teacher.evaluate(() => window.__qt.S.code);
  console.log('room', code);

  const kids = [];
  const names = ['Mia', 'Leo', 'Ana', 'Tom', 'Zoe', 'Max'];
  for (let i = 0; i < +nKids; i++) {
    const k = await open(`index.html?code=${code}&${query}`, i === 0 ? 1280 : 1024, i === 0 ? 720 : 640, `K${i}`);
    await k.fill('#nameIn', names[i]);
    if (i === 0) { await wait(800); await k.screenshot({ path: `${out}/02-child-join.png` }); }
    await k.click('#joinBtn');
    await k.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 30000 });
    kids.push(k);
  }
  // Walk around a little.
  for (const [i, k] of kids.entries()) {
    await k.keyboard.down(['ArrowLeft', 'ArrowRight', 'ArrowUp'][i % 3]);
    await wait(500);
    await k.keyboard.up(['ArrowLeft', 'ArrowRight', 'ArrowUp'][i % 3]);
  }
  await wait(800);
  await kids[0].screenshot({ path: `${out}/03-child-lobby.png` });
  await teacher.screenshot({ path: `${out}/04-teacher-lobby.png` });

  await teacher.click('#mainBtn');
  let qn = 0; const shots = new Set();
  for (let guard = 0; guard < 80; guard++) {
    await wait(400);
    const ph = await teacher.evaluate(() => window.__qt.S.phase);
    if (ph === 'end') break;
    if (ph === 'question') {
      const { correct, qi, bonus } = await teacher.evaluate(() => ({ correct: window.__qt.S.q.correct, qi: window.__qt.S.qi, bonus: !!window.__qt.S.bonus }));
      if (bonus) {
        // Bonus round: stand on a pad instead of clicking (child 0 on the right one).
        const PADX = [-6.6, -2.2, 2.2, 6.6];
        for (const [i, k] of kids.entries()) {
          const opt = i === 0 ? correct : (correct + 1 + i) % 4;
          await k.waitForFunction((q) => window.__qr.S.qi === q, qi, { timeout: 10000 });
          await k.evaluate(([x]) => window.__qr.ctl.teleport({ x, y: 0.1, z: 3.5 }), [PADX[opt]]);
        }
        await wait(1500);
        if (!shots.has('bonus')) { shots.add('bonus'); await kids[0].screenshot({ path: `${out}/10b-child-bonus.png` }); }
        await teacher.click('#mainBtn');
        await teacher.waitForFunction(() => window.__qt.S.phase === 'reveal', null, { timeout: 10000 });
        await wait(700);
        qn++;
        await teacher.click('#mainBtn');
        continue;
      }
      if (qi === 0) { await wait(300); await kids[0].screenshot({ path: `${out}/05-child-card.png` }); }
      for (const [i, k] of kids.entries()) {
        const last = i === kids.length - 1 && kids.length > 2;
        if (last && qi % 3 === 2) continue;                      // skips some
        const opt = i === 0 ? correct : i === 1 ? (correct + 1) % 4 : Math.floor(Math.random() * 4);
        try { await k.waitForFunction((q) => window.__qr.S.qi === q, qi, { timeout: 10000 }); }
        catch (e) { console.log('wait failed kid', i, 'qi', qi, await k.evaluate(() => JSON.stringify({ qi: window.__qr.S.qi, ph: window.__qr.S.phase, net: window.__qr.net.status, pid: window.__qr.S.pid }))); throw e; }
        try { await k.click(`#qboxes .box:nth-child(${opt + 1})`, { timeout: 8000 }); }
        catch (e) { await k.screenshot({ path: `${out}/FAIL-${i}-${qi}.png` }); console.log('click failed', i, qi, await k.evaluate(() => JSON.stringify([...document.querySelectorAll('#qboxes .box')].map((b) => b.getBoundingClientRect().height))), JSON.stringify(await k.evaluate(() => { const S = window.__qr.S; return { phase: S.phase, qi: S.qi, mine: S.mine, pid: S.pid, hidden: document.getElementById('qcard').className, msg: document.getElementById('msg').className, join: document.getElementById('join').className }; }))); throw e; }
        if (i === 0 && qi === 0) {
          await k.keyboard.down('ArrowRight'); await wait(400); await k.keyboard.up('ArrowRight');
          await wait(200);
          await k.screenshot({ path: `${out}/06-child-answered.png` });
          await teacher.screenshot({ path: `${out}/07-teacher-question.png` });
        }
      }
      if (await teacher.evaluate(() => window.__qt.S.phase) === 'question') await teacher.click('#mainBtn');
      await teacher.waitForFunction(() => window.__qt.S.phase === 'reveal', null, { timeout: 10000 });
      await wait(700);
      if (qn === 0) {
        await teacher.screenshot({ path: `${out}/08-teacher-reveal.png` });
        await kids[0].screenshot({ path: `${out}/09-child-reveal.png` });
        await kids[1].screenshot({ path: `${out}/10-child-reveal-wrong.png` });
      }
      qn++;
      await teacher.click('#mainBtn');
    }
  }
  await teacher.waitForFunction(() => window.__qt.S.phase === 'end', null, { timeout: 10000 }).catch(() => {});
  await wait(1500);
  await teacher.screenshot({ path: `${out}/11-teacher-end.png` });
  await kids[0].screenshot({ path: `${out}/12-child-end.png` });
  const res = await teacher.evaluate(() => ({ q: window.__qt.S.n, ranking: window.__qt.S.end?.ranking,
    review: window.__qt.S.end?.review.map((r) => `${r.q.item}:${r.n}`), log: window.__qt.analytics.log }));
  console.log(JSON.stringify(res));
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 12)) : 'no errors');
  await browser.close();
})();
