// node tools/qa-play.cjs [outDir] — headless test of the play area with a teacher and two
// children: avatar choice, emotes, trampoline, slide, ball pit, ball kick (seen by the
// other child), the big red button (confetti for everyone), "everyone to the middle".
// Needs :8142 (game) and :8150 (API).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [out = '/tmp/qp'] = process.argv.slice(2);
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
  const tp = (page, x, y, z) => page.evaluate(([x, y, z]) => { const r = window.__qr; r.ctl.teleport({ x, y, z }); r.room.me.root.position.set(x, y, z); }, [x, y, z]);
  // The game slows down when headless frames are slow (dt is capped), so wait for
  // conditions instead of fixed times.
  const until = async (fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(150); } return false; };
  const fps = async (page) => page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  const pos = (page) => page.evaluate(() => { const p = window.__qr.room.me.root.position; return [p.x, p.y, p.z]; });

  const T = await open('teacher.html?lang=de', 'T');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);

  const A = await open(`index.html?code=${code}&lang=de`, 'A');
  await A.fill('#nameIn', 'Ana');
  await A.click('#avatars button:nth-child(4)');                  // the witch
  await wait(300);
  await A.screenshot({ path: `${out}/01-join-avatars.png` });
  await A.click('#joinBtn');
  await A.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  const B = await open(`index.html?code=${code}&lang=de`, 'B');
  await B.fill('#nameIn', 'Ben'); await B.click('#joinBtn');
  await B.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });
  const aPid = await A.evaluate(() => window.__qr.S.pid);
  await wait(1000);
  ok(await B.evaluate((pid) => window.__qr.S.players.find((p) => p.pid === pid)?.avatar, aPid) === 3, 'B sees A\'s chosen avatar');

  // Emote: A presses 2 (dance) → B sees it on A's avatar.
  await tp(A, 1.5, 0, 6.5); await tp(B, 3, 0, 8);
  await wait(500);
  await A.keyboard.press('2');
  await wait(400);
  ok(await B.evaluate((pid) => window.__qr.room.avatars.get(pid)?.emoteT > 0, aPid), 'B sees A\'s emote');
  await B.screenshot({ path: `${out}/02-emote.png` });

  // Trampoline: drop A from above → bounces up again.
  await tp(A, -12, 3, -1.5);
  let maxY = 0;
  await wait(500);
  for (let i = 0; i < 12; i++) { maxY = Math.max(maxY, (await pos(A))[1]); await wait(100); }
  ok(maxY > 2.0, `trampoline bounce (max height ${maxY.toFixed(2)})`);
  await A.screenshot({ path: `${out}/03-trampoline.png` });

  // Slide: start at the top → ends near the bottom.
  console.log('fps A', await fps(A));
  await tp(A, 12.3, 2.5, -0.2);
  await until(async () => (await pos(A))[2] > 4.5);
  const ps = await pos(A);
  ok(ps[2] > 4 && ps[1] < 0.6, `slide carries you down (z ${ps[2].toFixed(1)}, y ${ps[1].toFixed(2)})`);

  // Tower: climbing by jumping onto the steps.
  await tp(A, 8.5, 0, -1.9);
  await A.keyboard.down('d');
  for (let i = 0; i < 14 && (await pos(A))[1] < 2.3; i++) { await A.keyboard.down(' '); await wait(250); await A.keyboard.up(' '); await wait(600); }
  await A.keyboard.up('d');
  await wait(300);
  const pt = await pos(A);
  ok(pt[1] > 1.5, `climbed the steps (y ${pt[1].toFixed(2)})`);
  await A.screenshot({ path: `${out}/04-tower.png` });

  // Ball pit: you sink in.
  await tp(A, -12.5, 0, 6.5);
  await wait(600);
  ok((await pos(A))[1] < -0.2, 'ball pit: sunk in');
  await A.screenshot({ path: `${out}/05-pit.png` });

  // Ball: walk A into ball 0 → B sees the ball move.
  await A.evaluate(() => window.__qr.room.play.reset()); await B.evaluate(() => window.__qr.room.play.reset());
  await tp(A, -6, 0, 0);
  const b0 = await B.evaluate(() => window.__qr.room.play.balls[0].p.toArray());
  await tp(A, b0[0] - 1.6, 0, b0[2]);
  await A.keyboard.down('d');
  await until(async () => { const b = await B.evaluate(() => window.__qr.room.play.balls[0].p.toArray()); return Math.hypot(b[0] - b0[0], b[2] - b0[2]) > 1; });
  await A.keyboard.up('d');
  const b1 = await B.evaluate(() => window.__qr.room.play.balls[0].p.toArray());
  ok(Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) > 1, `B sees the kicked ball (moved ${Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(1)})`);

  // Big red button → confetti for B and the teacher.
  await tp(A, 6.5, 0, 7.2);
  await wait(700);
  ok(await B.evaluate(() => window.__qr.room.play.confetti.visible), 'button: confetti on B');
  ok(await T.evaluate(() => window.__qt.room.play.confetti.visible), 'button: confetti on the teacher screen');
  await B.screenshot({ path: `${out}/06-confetti.png` });
  await T.screenshot({ path: `${out}/07-teacher-play.png` });

  // Everyone to the middle.
  await tp(A, -13, 0, -8);
  await T.click('#midBtn');
  await wait(600);
  const pm = await pos(A);
  ok(Math.hypot(pm[0], pm[2] - 3) < 4.5, 'middle: A teleported to the middle');
  ok(await A.evaluate(() => !window.__qr.ctl.enabled), 'middle: A frozen');
  ok(await B.isVisible('#midMsg'), 'middle: message shown');
  await B.screenshot({ path: `${out}/08-middle.png` });
  await T.click('#mainBtn');                                       // start → middle ends
  await A.waitForFunction(() => window.__qr.S.phase === 'question', null, { timeout: 10000 });
  ok(!(await B.isVisible('#midMsg')), 'middle ends with the question');
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 10)) : 'no errors');
  await browser.close();
})();
