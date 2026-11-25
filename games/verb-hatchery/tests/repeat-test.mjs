// Repeat test for the egg questions (owner report 2026-11-25: "in the Forest I got
// the same question 3 times in a row", topic es_tener). Plays many eggs against the
// real es_tener sentences and fails if a question comes back too soon.
//   node tests/repeat-test.mjs                 (this folder's src/questions.js)
//   node tests/repeat-test.mjs path/to/old.js  (e.g. the version before the fix)
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';

const TOPIC = process.env.TOPIC || 'es_tener';   // TOPIC=es_ser node tests/repeat-test.mjs
globalThis.location = { search: `?topic=${TOPIC}&lang=en` };
globalThis.document = { documentElement: {}, title: '' };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
try { globalThis.navigator = { language: 'en' }; } catch (_) { /* Node 21+ has its own navigator */ }

const here = path.dirname(new URL(import.meta.url).pathname);
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, '../src/questions.js');
const Q = await import(pathToFileURL(target).href);
const data = JSON.parse(readFileSync(path.join(here, `../../../homepage/data/${TOPIC.replace(/_/g, '-')}.json`), 'utf8'));
const gaps = [];
for (const u of data.items || data.use_cases) u.examples.forEach((ex, i) => gaps.push({
  kind: 'gap', key: `${u.id}_ex${i}`, base: u.id, item: u.id, form: 'default', topic: TOPIC,
  sentence: ex.sentence, plain: ex.sentence, hint: '', answer: ex.answers[0], accepts: ex.answers,
  options: [ex.answers[0], ...(ex.distractors || ex.wrong || []).slice(0, 2)], teach: '', difficulty: ex.difficulty || 1 }));

if (!Q._test) { console.log('no _test hook in', target, '(old version): simulating with its own pools is not possible'); process.exit(2); }
Q._test.load(gaps);
const sizes = [1, 2, 3].map((k) => Q._test.pools[k].length);
let seq = [], fails = [], rng = 1;
const rand = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let egg = 0; egg < 400; egg++) {
  const tier = egg % 5 === 4 ? 3 : 1 + Math.floor(rand() * 2);   // every 5th egg is the Forest's epic event
  const isPair = tier >= 2;
  const pair = Q.nextPair(tier);
  const steps = Q.stepsFor(pair, isPair);
  if (steps.length === 2 && steps[0].key === steps[1].key) fails.push(`egg ${egg}: same sentence twice in one egg (${steps[0].key})`);
  for (const s of steps) seq.push(s.key);
  if (rand() < 0.35) Q.missed(pair);                          // a wrong answer: comes back soon
}
const total = new Set(gaps.map((g) => g.key)).size;
const window = Math.min(3, total - 1);   // a missed question may come back after 3 others (on purpose)
for (let i = 1; i < seq.length; i++) {
  const back = seq.slice(Math.max(0, i - window), i);
  if (back.includes(seq[i])) fails.push(`question ${i}: "${seq[i]}" again after ${window - back.lastIndexOf(seq[i]) + (back.length < window ? 0 : 0)} or fewer questions`);
}
const triple = seq.some((k, i) => i >= 2 && seq[i - 1] === k && seq[i - 2] === k);
console.log(`${TOPIC}: ${total} sentences, tier pools ${sizes.join('/')}, ${seq.length} questions asked`);
if (triple) fails.unshift('the same question 3 times in a row (the owner\'s case)');
if (fails.length) { console.log(`FAIL (${fails.length}):\n  ` + fails.slice(0, 8).join('\n  ')); process.exit(1); }
console.log(`OK: no sentence repeats within ${window} questions, none twice in one egg`);
