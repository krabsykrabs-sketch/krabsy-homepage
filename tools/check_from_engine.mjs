// Headless check of homepage/lib/activities/from-engine.js on the local site.
//
//   python3 tools/dev_api_server.py 8123 &         (or: cd homepage && python3 -m http.server 8123)
//   PLAYWRIGHT=/path/to/playwright-core/index.mjs node tools/check_from_engine.mjs 8123
//
// Builds quick-practice materials (every Spanish topic × drag/typed/choice, focus,
// irregular verbs, prepositions) and v1 worksheets (typed/choice/mixed) in a real
// page, then validates all of them with tools/check_materials.py. Exit 1 on failure.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = process.argv[2] || '8123';
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright-core');
const here = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push(String(e)));
await page.goto(`http://localhost:${port}/en/spanish/`, { waitUntil: 'load' });

const out = await page.evaluate(async () => {
  const FE = await import('/lib/activities/from-engine.js');
  const KQ = await import('/lib/krabsy-questions.js');
  const mats = [];
  const facts = [];
  for (const topic of ['es_ser', 'es_estar', 'es_ser_estar', 'es_tener']) {
    for (const mode of ['drag', 'typed', 'choice']) {
      mats.push(await FE.quickPractice({ topic, count: 6, mode, lang: 'en' }));
    }
  }
  // 10 typed questions from es_ser_estar (acceptance test 3)
  const ten = await FE.quickPractice({ topic: 'es_ser_estar', count: 10, mode: 'typed' });
  mats.push(ten);
  facts.push(['es_ser_estar typed count', ten.steps[0].sentences.length]);
  // focus: the first sentences are of the focus items
  const foc = await FE.quickPractice({ topic: 'es_ser_estar', count: 6, mode: 'choice', focus: ['se_es_esta'] });
  mats.push(foc);
  facts.push(['focus first item', foc.steps[0].sentences[0].item]);
  mats.push(await FE.quickPractice({ topic: 'irregular_verbs', count: 8, mode: 'typed' }));
  mats.push(await FE.quickPractice({ topic: 'prepositions', count: 6, mode: 'drag' }));
  // v1 worksheets, built the way krabsy-tutor-lesson.js makeQuestions saves them
  const qs = (await KQ.getQuizSet({ topic: 'es_tener', count: 8, withOptions: 3, lang: 'en' })).map((q) => ({
    item: q.item, form: q.form || 'default',
    sentence: q.display.plain || q.display.sentence, hint: q.display.hint || '',
    answer: q.answer, accepts: q.accepts.slice(0, 8), options: q.options.slice(0, 6), teach: (q.teach && q.teach.line) || '',
  }));
  for (const mode of ['typed', 'choice', 'mixed']) {
    const m = FE.fromV1Worksheet({ id: 7, topic: 'es_tener', title: 'Tener · ' + mode, mode, questions: qs });
    mats.push(m);
    facts.push([`v1 ${mode} steps`, m.steps.map((s) => `${s.mode}:${s.sentences.length}`).join(' ')]);
  }
  // a v1 question saved without choices, in a choice worksheet → goes to a typed step
  const noOpt = FE.fromV1Worksheet({ id: 8, topic: 'es_tener', mode: 'choice', questions: [{ ...qs[0], options: [] }, qs[1]] });
  mats.push(noOpt);
  facts.push(['v1 choice w/o options', noOpt.steps.map((s) => `${s.mode}:${s.sentences.length}`).join(' ')]);
  let threw = false;
  try { await FE.quickPractice({ topic: 'no_such_topic' }); } catch (_) { threw = true; }
  facts.push(['unknown topic throws', threw]);
  return { mats, facts, sample: mats[0].steps[0] };
});
await browser.close();

const dir = mkdtempSync(join(tmpdir(), 'krabsy-from-engine-'));
const file = join(dir, 'materials.json');
writeFileSync(file, JSON.stringify(out.mats, null, 2));
for (const [k, v] of out.facts) console.log(`${k}: ${v}`);
console.log('sample step:', JSON.stringify(out.sample).slice(0, 400), '…');
let ok = true;
try {
  console.log(execFileSync('python3', [join(here, 'check_materials.py'), file], { encoding: 'utf8' }).split('\n').filter((l) => !l.startsWith('info')).join('\n'));
} catch (e) {
  ok = false;
  console.log(e.stdout);
}
const facts = Object.fromEntries(out.facts);
if (facts['es_ser_estar typed count'] !== 10) { ok = false; console.log('FAIL: expected 10 typed questions'); }
if (facts['focus first item'] !== 'se_es_esta') { ok = false; console.log('FAIL: focus item not first'); }
if (facts['unknown topic throws'] !== true) { ok = false; console.log('FAIL: unknown topic did not throw'); }
if (consoleErrors.length) { ok = false; console.log('console errors:', consoleErrors); }
console.log(ok ? `OK: ${out.mats.length} runtime materials valid, 0 console errors (${file})` : 'FAILED');
process.exit(ok ? 0 : 1);
