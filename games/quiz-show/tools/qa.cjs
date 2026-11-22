// node tools/qa.cjs [query] [outDir] [w h] [teams 2-4] [timer on|off] — headless play-through of a whole show (QA).
// Needs the dev server on :8142. Plays round 1 by keys, round 2 by buzzers, the final
// with bets, takes a screenshot at each stage and prints errors + the analytics log.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [query = '', out = '/tmp/qs', w = 1280, h = 720, teams = '3', timer = 'on'] = process.argv.slice(2);
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', (r) => errs.push('failed ' + r.url() + ' ' + (r.failure() || {}).errorText));
  const shot = async (n) => page.screenshot({ path: `${out}/${n}.png` });
  const phase = () => page.evaluate(() => window.__qs?.show.state.phase);
  const kind = () => page.evaluate(() => window.__qs?.show.round?.kind);
  const key = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(120); };

  await page.goto(`http://localhost:8142/${query}`);
  await page.waitForTimeout(1200);
  await shot('01-setup');
  await page.click(`#optTeams button:nth-child(${+teams - 1})`);
  if (timer === 'off') await page.click('#optTimer button:nth-child(2)');
  await page.waitForTimeout(200);
  await shot('01-setup');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__qs, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log('source:', await page.evaluate(() => window.__qs.source));
  await shot('02-round1-title');
  const PICK = [['1', '2', '3', '4'], ['q', 'w', 'e', 'r'], ['a', 's', 'd', 'f'], ['z', 'x', 'c', 'v']];
  const BUZZ = ['a', 'l', 'v', 'p'];
  let n = 0, shots = new Set();
  for (let guard = 0; guard < 400; guard++) {
    const ph = await phase(), kd = await kind();
    if (ph === 'end') break;
    if (ph === 'ask' && kd !== 'buzz') {
      const info = await page.evaluate(() => { const s = window.__qs.show; return { teams: s.state.teams.length, right: s.q.options.indexOf(s.q.answer) }; });
      if (!shots.has('ask' + kd)) { await shot(`03-ask-${kd}`); }
      for (let t = 0; t < info.teams; t++) {
        // team 0 always right, others random
        const o = t === 0 ? info.right : Math.floor(Math.random() * 4);
        await key(PICK[t][o]);
        if (t === 0 && !shots.has('ask' + kd)) { shots.add('ask' + kd); await shot(`04-locked-${kd}`); }
      }
      await page.waitForTimeout(1500);
      if (!shots.has('rev' + kd)) { shots.add('rev' + kd); await shot(`05-reveal-${kd}`); }
      await key('Enter'); continue;
    }
    if (ph === 'ask' && kd === 'buzz') {
      const info = await page.evaluate(() => { const s = window.__qs.show; return { right: s.q.options.indexOf(s.q.answer), out: s.state.out, teams: s.state.teams.length }; });
      let team = (n++) % info.teams;
      while (info.out.includes(team)) team = (team + 1) % info.teams;
      await key(BUZZ[team]);
      if (!shots.has('buzz')) { shots.add('buzz'); await shot('06-buzzed'); }
      // first try wrong once, to see the strike, then right
      const wrongFirst = !shots.has('strike');
      await key(String(1 + (wrongFirst ? (info.right + 1) % 4 : info.right)));
      if (wrongFirst) { shots.add('strike'); await page.waitForTimeout(300); await shot('07-wrong-buzz'); }
      await page.waitForTimeout(300);
      continue;
    }
    if (ph === 'answering') {
      const r = await page.evaluate(() => { const s = window.__qs.show; return s.q.options.indexOf(s.q.answer); });
      await key(String(1 + r)); await page.waitForTimeout(300); continue;
    }
    if (ph === 'reveal') {
      await page.waitForTimeout(1300);
      if (kd === 'buzz' && !shots.has('revbuzz')) { shots.add('revbuzz'); await shot('08-reveal-buzz'); }
      await key('Enter'); continue;
    }
    if (ph === 'bet') {
      if (!shots.has('bet')) { shots.add('bet'); await shot('09-bet'); }
      await key('Enter'); continue;
    }
    if (ph === 'standings') {
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => window.__qs.show.state.round);
      if (!shots.has('st' + r)) { shots.add('st' + r); await shot(`10-standings-${r}`); }
      await key('Enter'); continue;
    }
    if (ph === 'title') {
      const r = await page.evaluate(() => window.__qs.show.state.round);
      if (!shots.has('ti' + r)) { shots.add('ti' + r); await shot(`02-title-${r}`); }
      await key('Enter'); continue;
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2500);
  await shot('11-end');
  const res = await page.evaluate(() => { const s = window.__qs.show; return {
    phase: s.state.phase, scores: s.state.teams.map((t) => t.score), answered: s.state.answered, right: s.state.right,
    total: s.total, review: s.review().map((e) => `${e.q.item}:${e.n}`) }; });
  console.log(JSON.stringify(res));
  const log = await page.evaluate(() => (window.__qsLog || []));
  if (errs.length) console.log('ERRORS', [...new Set(errs)].slice(0, 10)); else console.log('no errors');
  await browser.close();
})();
