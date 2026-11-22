// node tools/qa-editor.cjs [outDir] [query] — headless test of the teacher's question list:
// swap, remove, add, count change, topic change, open the room, edit again in the lobby,
// and check the children get the edited list. Needs :8142 (game) and :8150 (API).
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
(async () => {
  const [out = '/tmp/qe', query = 'lang=de'] = process.argv.slice(2);
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
  const ok = (cond, what) => { console.log(cond ? 'ok  ' : 'FAIL', what); if (!cond) process.exitCode = 1; };
  const T = await open(`teacher.html?${query}`, 'T');
  await T.waitForSelector('.edRow', { timeout: 30000 });
  const items = () => T.evaluate(() => [...document.querySelectorAll('.edRow')].map((r) => r.querySelector('.lines').textContent.trim()));
  const count = () => T.evaluate(() => +document.querySelector('.edHead b').textContent.match(/\d+/)[0]);
  await T.screenshot({ path: `${out}/01-setup-list.png` });
  ok(await count() === 10, 'starts with 10 questions');

  const before = await items();
  await T.click('.edRow:nth-child(1) .swap');
  const afterSwap = await items();
  ok(afterSwap[0] !== before[0] && afterSwap.slice(1).join() === before.slice(1).join(), 'swap changes only row 1');
  ok(await count() === 10, 'swap keeps the count');

  await T.click('.edRow:nth-child(2) .rm');
  ok((await items()).length === before.length - 1, 'remove drops one row');
  const c1 = await count();
  await T.click('.edHead .add');
  ok(await count() > c1, 'add adds questions');

  await T.click('#optCount .opt:nth-child(2)');   // 15
  await T.waitForTimeout(200);
  ok(await count() === 15, 'count 15 fills up to 15');
  // Pairs never split: every 3rd-form question directly follows its 2nd form.
  const pairsOk = await T.evaluate(() => {
    const qs = window.__qt.editor.questions;
    return qs.every((q, i) => !q.followUp || (i > 0 && qs[i - 1].item === q.item && qs[i - 1].askIndex === 0));
  });
  ok(pairsOk, 'chain order kept');

  await T.click('#optTopic .opt:nth-child(2)');   // prepositions
  await T.waitForFunction(() => window.__qt.editor.questions[0]?.kind === 'gap', null, { timeout: 15000 });
  ok(await count() === 15, 'topic change: 15 preposition questions');
  await T.click('.showA');
  await T.screenshot({ path: `${out}/02-preps-hidden.png` });
  ok(await T.evaluate(() => !document.querySelector('.edLine .opts .ok')), 'answers can be hidden');
  await T.click('.showA');

  await T.click('#optTopic .opt:nth-child(1)');   // back to verbs, open the room
  await T.waitForFunction(() => window.__qt.editor.questions[0]?.kind === 'trio', null, { timeout: 15000 });
  const sent = await T.evaluate(() => window.__qt.editor.questions.length + window.__qt.editor.bonusQuestions.length);
  await T.click('#openBtn');
  await T.waitForFunction(() => window.__qt.S.code, null, { timeout: 20000 });
  const code = await T.evaluate(() => window.__qt.S.code);
  ok(await T.evaluate(() => window.__qt.S.n) === sent, `room has the edited list (${sent})`);

  const K = await open(`index.html?code=${code}&${query}`, 'K');
  await K.fill('#nameIn', 'Ida'); await K.click('#joinBtn');
  await K.waitForFunction(() => window.__qr.S.pid != null, null, { timeout: 20000 });

  // Edit again in the lobby: answers hidden by default, remove two rows, save.
  await T.click('#editBtn');
  await T.waitForSelector('#setup:not(.hidden) .edRow');
  ok(await T.evaluate(() => !document.querySelector('.edLine .opts .ok')), 'lobby edit hides answers');
  await T.screenshot({ path: `${out}/03-lobby-edit.png` });
  await T.click('.edRow:nth-child(1) .rm');
  await T.click('.edRow:nth-child(1) .rm');
  const n2 = await T.evaluate(() => window.__qt.editor.questions.length + window.__qt.editor.bonusQuestions.length);
  await T.click('#openBtn');
  await T.waitForFunction((n) => window.__qt.S.n === n, n2, { timeout: 10000 });
  ok(await T.evaluate(() => document.getElementById('setup').classList.contains('hidden')), 'saved and closed');
  await T.click('#mainBtn');
  await K.waitForFunction(() => window.__qr.S.phase === 'question', null, { timeout: 10000 });
  ok(await K.evaluate(() => window.__qr.S.n) === n2, `child gets the saved list (${n2})`);
  await T.waitForFunction(() => window.__qt.S.phase === 'question', null, { timeout: 10000 });
  ok(!(await T.isVisible('#editBtn')), 'edit button gone after start');
  console.log(errs.length ? 'ERRORS ' + JSON.stringify([...new Set(errs)].slice(0, 10)) : 'no errors');
  await browser.close();
})();
