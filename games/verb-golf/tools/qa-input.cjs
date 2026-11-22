// node tools/qa-input.cjs — real input: click → card, digit key answers, mouse drag shoots;
// keyboard aim + Space charge; touch tap + touch drag (CDP). Prints what happened.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const info = (p) => p.evaluate(() => window.__VG.info());
const ballScreen = (p) => p.evaluate(() => window.__VG.ballScreen());
const rightIdx = (p) => p.evaluate(() => window.__VG.G.cardQ.options.indexOf(window.__VG.G.cardQ.answer));
const waitStop = (p) => p.waitForFunction(() => ['idle', 'aim', 'between', 'end'].includes(window.__VG.G.mode), null, { timeout: 60000 });
(async () => {
  const browser = await chromium.launch({ args: ARGS });
  // mouse + keyboard
  let page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8140/');
  await page.waitForFunction(() => window.__VG.G.mode === 'menu');
  await page.click('.lvl');                                   // level 1 by click
  await page.waitForFunction(() => window.__VG.G.mode === 'idle');
  await page.mouse.click(683, 500);                            // anywhere → card
  console.log('after click:', (await info(page)).mode);
  const i = await rightIdx(page);
  await page.keyboard.press(String(((i + 1) % 3) + 1));         // a wrong digit
  await page.keyboard.press(String(i + 1));                     // the right digit
  await page.waitForFunction(() => window.__VG.G.mode === 'aim');
  let b = await ballScreen(page);
  const before = (await info(page)).ball;
  await page.mouse.move(b.x, b.y); await page.mouse.down();
  await page.mouse.move(b.x - 60, b.y, { steps: 5 }); await page.mouse.move(b.x - 120, b.y + 4, { steps: 5 });
  await page.mouse.up();
  console.log('after drag:', (await info(page)).mode);
  await waitStop(page);
  let r = await info(page);
  console.log('mouse:', JSON.stringify({ before, after: r.ball, strokes: r.strokes, shots: r.shots, pen: r.penalties, mode: r.mode, scores: r.scores }));
  // keyboard: Space opens the card, digit, ← aims, hold Space and let go
  if (r.mode === 'idle') {
    await page.keyboard.press('Space');
    await page.keyboard.press(String((await rightIdx(page)) + 1));
    await page.waitForFunction(() => window.__VG.G.mode === 'aim');
    const a0 = await page.evaluate(() => window.__VG.G.aim.angle);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(900); await page.keyboard.up('ArrowLeft');
    const a1 = await page.evaluate(() => window.__VG.G.aim.angle);
    await page.keyboard.down('Space'); await page.waitForTimeout(250); await page.keyboard.up('Space');
    await waitStop(page);
    r = await info(page);
    console.log('keys:', JSON.stringify({ turned: +(a1 - a0).toFixed(2), shots: r.shots, strokes: r.strokes, mode: r.mode, ball: r.ball }));
  }
  console.log('errors:', errs);
  // touch
  page = await (await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true })).newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8140/?play=1&level=2');
  await page.waitForFunction(() => window.__VG.G.mode === 'aim');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  b = await ballScreen(page);
  await touch('touchStart', b.x, b.y);
  for (let k = 1; k <= 8; k++) { await touch('touchMove', b.x, b.y + k * 14); await page.waitForTimeout(16); } // pull down = shoot up the screen
  await touch('touchEnd');
  await waitStop(page);
  r = await info(page);
  console.log('touch gate stroke:', JSON.stringify({ yaw: r.yaw, shot: await page.evaluate(() => window.__VG.G.lastShot), shots: r.shots, strokes: r.strokes, pen: r.penalties, ball: r.ball, mode: r.mode, touchClass: await page.evaluate(() => document.documentElement.className) }));
  console.log('errors:', errs);
  await browser.close();
})();
