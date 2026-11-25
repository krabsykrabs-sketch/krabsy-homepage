// node tools/qa-bonus.cjs [outDir] [query] — headless test of the bonus round "run to the
// answer": teacher picks 3 bonus questions, two children; the normal questions are
// skipped, then child A stands on the right pad and child B on a wrong one. Checks the
// live pad counts, the scoring, the sinking pads and the end. Needs :8142 and :8150.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [out = '/tmp/qb', query = 'lang=de'] = process.argv.slice(2);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errs = [];
  const open = async (path, tag) => {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    page.on('pageerror', (e) => errs.push(`${tag} ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} ${m.text()}`); });
    await page.goto(`http://localhost:8142/${path}`);
    return page;
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, what) => { console.log(cond ? 'ok  ' : 'FAIL', what); if (!cond) process.exitCode = 1; };
  const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); } return false; };
  const PADX = [-6.6, -2.2, 2.2, 6.6], PADZ = 3.5;
  const tp = (page, x, z) => page.evaluate(([x, z]) => { const r = window.__qr; r.ctl.teleport({ x, y: 0.1, z }); }, [x, z]);

  const T = await open(`teacher.html?${query}`, 'T');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  ok(await T.evaluate(() => document.querySelectorAll('.edRow.bonus').length) === 3, 'editor shows 3 bonus questions');
  await T.click('#optBonus .opt:nth-child(3)');                    // 5
  await T.waitForTimeout(200);
  ok(await T.evaluate(() => document.querySelectorAll('.edRow.bonus').length) === 5, 'bonus 5 → 5 rows');
  await T.click('#optBonus .opt:nth-child(2)');                    // back to 3
  await T.click('.edRow.bonus .swap');
  ok(await T.evaluate(() => window.__qt.editor.bonusQuestions.every((q) => !q.followUp)), 'bonus questions are single questions');
  await T.screenshot({ path: `${out}/01-editor-bonus.png` });
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);
  ok(await T.evaluate(() => window.__qt.S.n) === 13, 'room has 10 + 3 questions');

  const A = await open(`index.html?code=${code}&${query}`, 'A');
  await A.fill('#nameIn', 'Ana'); await A.click('#joinBtn');
  await A.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  const B = await open(`index.html?code=${code}&${query}`, 'B');
  await B.fill('#nameIn', 'Ben'); await B.click('#joinBtn');
  await B.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  await wait(1500);

  // Skip the 10 normal questions.
  await T.click('#mainBtn');
  for (let i = 0; i < 10; i++) {
    await T.waitForFunction((q) => window.__qt.S.phase === 'question' && window.__qt.S.qi === q, i, { timeout: 10000 });
    await T.click('#mainBtn');                                      // reveal
    await T.waitForFunction(() => window.__qt.S.phase === 'reveal', null, { timeout: 10000 });
    await T.click('#mainBtn');                                      // next
  }
  await T.waitForFunction(() => window.__qt.S.phase === 'question' && window.__qt.S.bonus, null, { timeout: 10000 });
  await A.waitForFunction(() => window.__qr.S.bonus, null, { timeout: 10000 });
  ok(await A.isVisible('#bonusBar') && !(await A.isVisible('#qcard')), 'child: bonus bar, no answer card');
  ok(await A.evaluate(() => window.__qr.ctl.enabled), 'child can run during the bonus question');
  const correct = await T.evaluate(() => window.__qt.S.q.correct);
  const wrong = (correct + 2) % 4;
  await tp(A, PADX[correct], PADZ); await tp(B, PADX[wrong] + 0.8, PADZ - 0.8);
  const live = await until(() => T.evaluate(([c, w]) => window.__qt.S.pads[c] === 1 && window.__qt.S.pads[w] === 1, [correct, wrong]), 20000);
  ok(live, 'teacher sees live pad counts');
  if (!live) console.log('pads', await T.evaluate(() => JSON.stringify(window.__qt.S.pads)), 'A', await A.evaluate(() => JSON.stringify([window.__qr.room.me.root.position.toArray(), window.__qr.S.phase, window.__qr.S.qi])), 'B', await B.evaluate(() => JSON.stringify([window.__qr.room.me.root.position.toArray(), window.__qr.S.phase, window.__qr.S.qi])), 'want', correct, wrong);
  await wait(1200);
  await A.screenshot({ path: `${out}/02-child-bonus.png` });
  await T.screenshot({ path: `${out}/03-teacher-bonus.png` });

  await T.click('#mainBtn');                                        // reveal
  await A.waitForFunction(() => window.__qr.S.phase === 'reveal', null, { timeout: 10000 });
  await B.waitForFunction(() => window.__qr.S.phase === 'reveal' && window.__qr.S.reveal, null, { timeout: 10000 });
  ok(await A.evaluate(() => window.__qr.S.reveal.you.right && window.__qr.S.reveal.you.pts === 500), 'A on the right pad: right, 500 points');
  ok(await B.evaluate((w) => !window.__qr.S.reveal.you.right && window.__qr.S.reveal.you.opt === w, wrong), 'B on a wrong pad: wrong');
  ok(await until(() => B.evaluate(() => window.__qr.room.me.root.position.y < -0.6), 15000), 'B sinks into the foam pit');
  await wait(400);
  await B.screenshot({ path: `${out}/04-child-pit.png` });
  await T.screenshot({ path: `${out}/05-teacher-pit.png` });
  // B can't walk out of the pit while it's down.
  await B.keyboard.down('d'); await wait(800); await B.keyboard.up('d');
  const bx = await B.evaluate(() => window.__qr.room.me.root.position.x);
  ok(Math.abs(bx - PADX[wrong]) <= 1.5, 'B stays inside the pit');
  const up = await until(() => B.evaluate(() => window.__qr.room.me.root.position.y > -0.05), 20000);
  ok(up, 'the pad brings B back up');
  if (!up) console.log(await B.evaluate(() => JSON.stringify({ me: window.__qr.room.me.root.position.toArray(), pads: window.__qr.room.play.pads.map((p) => [p.y.toFixed(2), p.target, p.sinkT.toFixed(2)]), g: window.__qr.room.play.ground(window.__qr.room.me.root.position.x, window.__qr.room.me.root.position.z, window.__qr.room.me.root.position.y) })));

  // Finish: next bonus questions, nobody moves → no answer; then the end.
  for (let i = 0; i < 2; i++) {
    await T.click('#mainBtn');
    await T.waitForFunction(() => window.__qt.S.phase === 'question', null, { timeout: 10000 });
    await T.click('#mainBtn');
    await T.waitForFunction(() => window.__qt.S.phase === 'reveal', null, { timeout: 10000 });
  }
  await T.click('#mainBtn');
  await T.waitForFunction(() => window.__qt.S.phase === 'end', null, { timeout: 10000 });
  ok(true, 'end reached');
  await wait(1200);
  await T.screenshot({ path: `${out}/06-teacher-end.png` });
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 10)) : 'no errors');
  await browser.close();
})();
