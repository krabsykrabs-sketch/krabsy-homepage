// Shell test: walks the game shell (title → level 1 → first-run hint → a wrong answer → pause →
// resume → flag → results → next level → title) on desktop, tablet and phone, takes a
// screenshot of every screen and reports console errors, failed requests and broken steps.
//
//   PLAYWRIGHT=<path to playwright module> node tools/shell-test.cjs <base-url> <out-dir> [de es en]
//   VP=desktop,tablet,phone limits the screen sizes.
// The player is moved with the krabsy-teleport event, so this tests the shell, not the level
// (tools/bot-test.cjs plays the levels).
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.argv[2];
const OUT = (process.argv[3] || '.').replace(/\/?$/, '/');
if (!BASE) { console.error('usage: node tools/shell-test.cjs <base-url> <out-dir> [langs…]'); process.exit(2); }
const VPS = {
  desktop: { viewport: { width: 1366, height: 768 } },
  tablet: { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true },
  phone: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
};
const langs = process.argv.slice(4).length ? process.argv.slice(4) : ['de', 'es'];
const only = process.env.VP ? process.env.VP.split(',') : Object.keys(VPS);
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let problems = 0;
  for (const lang of langs) for (const vp of only) {
    const ctx = await browser.newContext(VPS[vp]);
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('requestfailed', r => errs.push('failed: ' + r.url()));
    page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });
    const shot = n => page.screenshot({ path: `${OUT}${lang}-${vp}-${n}.png` });
    const st = () => page.evaluate(() => window.__krabsyShell.state());
    await page.goto(`${BASE}?lang=${lang}&scenery=full`);
    await page.waitForFunction(() => window.__krabsyShell?.state() === 'menu', null, { timeout: 60000 });
    await page.waitForTimeout(800);
    await shot('1-menu');
    // overflow check on the menu
    const over = await page.evaluate(() => { const m = document.getElementById('menu'); return [m.scrollHeight, m.clientHeight, document.documentElement.scrollWidth, innerWidth]; });
    if (over[0] > over[1] + 1 || over[2] > over[3]) { console.log(`  ${lang}/${vp} menu overflows`, over); }
    // start level 1 → first-run hint
    await page.click('.level-card[data-level="first-steps"]');
    await page.waitForFunction(() => window.__krabsyShell.state() === 'hint', null, { timeout: 60000 });
    await page.waitForTimeout(700);
    await shot('2-hint');
    const t0 = await page.evaluate(() => window.__krabsyDebug.player.getPosition());
    await page.waitForTimeout(500);
    await page.click('#hint-go');
    await page.waitForTimeout(1500);
    if (await st() !== 'playing') { console.log('  not playing after hint:', await st()); problems++; }
    await shot('3-hud');
    // a wrong answer: stand on a wrong block of gate 1
    await page.evaluate(() => {
      const g = window.__krabsyDebug.level().gates[0].gate;
      const o = g.options.find(o => !o.correct);
      window.dispatchEvent(new CustomEvent('krabsy-teleport', { detail: { x: o.pos.x, y: o.top + 1.2, z: o.pos.z } }));
    });
    await page.waitForTimeout(900);
    await shot('4-wrong');
    await page.waitForTimeout(2500);
    // pause
    if (vp === 'desktop') await page.keyboard.press('Escape'); else await page.tap('#pause-btn');
    await page.waitForTimeout(400);
    if (await st() !== 'paused') { console.log('  not paused:', await st()); problems++; }
    const p1 = await page.evaluate(() => [window.__krabsyDebug.player.getPosition(), document.getElementById('hud-time').textContent]);
    await page.waitForTimeout(1200);
    const p2 = await page.evaluate(() => [window.__krabsyDebug.player.getPosition(), document.getElementById('hud-time').textContent]);
    if (JSON.stringify(p1) !== JSON.stringify(p2)) { console.log('  moved while paused', p1, p2); problems++; }
    await shot('5-pause');
    if (vp === 'desktop') await page.keyboard.press('Enter'); else await page.tap('#pause-resume');
    await page.waitForTimeout(300);
    if (await st() !== 'playing') { console.log('  not resumed:', await st()); problems++; }
    // to the flag
    await page.evaluate(() => {
      const f = window.__krabsyShell.level().flag.position;
      window.dispatchEvent(new CustomEvent('krabsy-teleport', { detail: { x: f[0], y: f[1] + 1.5, z: f[2] + 1 } }));
    });
    await page.waitForFunction(() => window.__krabsyShell.state() === 'results', null, { timeout: 20000 });
    await page.waitForTimeout(1900);
    await shot('6-results');
    const vis = await page.evaluate(() => !document.getElementById('level-complete').hidden);
    if (!vis) { console.log('  #level-complete hidden'); problems++; }
    const cardFits = await page.evaluate(() => { const c = document.querySelector('.results-card'); return [c.scrollHeight, c.clientHeight]; });
    if (cardFits[0] > cardFits[1] + 1) console.log(`  ${lang}/${vp} results card scrolls`, cardFits);
    // next level, then back to the menu
    if (vp === 'desktop') await page.click('#res-next'); else await page.tap('#res-next');
    await page.waitForFunction(() => window.__krabsyShell.state() === 'playing', null, { timeout: 60000 });
    const lv = await page.evaluate(() => window.__krabsyShell.level().id);
    if (lv !== 'zigzag') { console.log('  next level is', lv); problems++; }
    await page.waitForTimeout(800);
    if (vp === 'desktop') await page.keyboard.press('KeyP'); else await page.tap('#pause-btn');
    await page.waitForTimeout(300);
    if (vp === 'desktop') await page.click('#pause-levels'); else await page.tap('#pause-levels');
    await page.waitForTimeout(700);
    await shot('7-menu-after');
    const store = await page.evaluate(() => localStorage.getItem('krabsy_vp_progress'));
    console.log(`${lang}/${vp}: state ${await st()}, saved ${store}, problems so far ${problems}, errors ${errs.length}`);
    for (const e of errs) console.log('   ' + e);
    problems += errs.length;
    await ctx.close();
  }
  await browser.close();
  console.log(problems ? `PROBLEMS: ${problems}` : 'ALL OK');
  process.exit(problems ? 1 : 0);
})();
