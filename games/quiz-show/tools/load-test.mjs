// node tools/load-test.mjs [children=30] [questions=6] [ws url] — protocol load test of the
// room server without any 3D: one teacher, N children who walk (10 moves/s each) and
// answer. Measures how long each question takes to reach every child, and checks that
// nobody misses a question or a reveal. Needs the API (uvicorn) on :8150.
const N = +(process.argv[2] || 30), QN = +(process.argv[3] || 6);
const URL = process.argv[4] || 'ws://127.0.0.1:8150/api/quiz/ws';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket(URL);
  const handlers = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); (handlers[m.t] || []).forEach((f) => f(m)); };
  const c = {
    ws, on: (t, f) => { (handlers[t] ||= []).push(f); },
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t) => new Promise((r) => { const f = (m) => { handlers[t] = handlers[t].filter((x) => x !== f); r(m); }; c.on(t, f); }),
    open: new Promise((r) => { ws.onopen = r; }),
  };
  return c;
}

const questions = Array.from({ length: QN }, (_, i) => ({ kind: 'trio', base: `go${i}`, slots: [null, null], askIndex: 0,
  options: ['went', 'goed', 'gone', 'wented'], correct: 0, teach: '', item: `go${i}`, topic: 'irregular_verbs', form: 'past' }));

const T = client(); await T.open;
T.send({ t: 'create', questions, time: 30, lang: 'de' });
const { code } = await T.next('created');
console.log('room', code, 'children', N);

const kids = [];
for (let i = 0; i < N; i++) {
  const k = client(); await k.open;
  k.got = {}; k.revealed = {};
  k.on('question', (m) => { k.got[m.qi] = performance.now(); });
  k.on('reveal', (m) => { k.revealed[m.qi] = true; });
  k.send({ t: 'join', code, name: `Kid${i}`, avatar: i % 8, color: i % 8 });
  await k.next('joined');
  kids.push(k);
}
// Everyone walks around: 10 position updates per second each.
let t = 0;
const walker = setInterval(() => {
  t += 0.1;
  kids.forEach((k, i) => k.send({ t: 'move', p: [Math.sin(t + i) * 8, 0, Math.cos(t + i) * 6], r: t, a: 1 }));
}, 100);
await wait(1500);

const lat = [];
let missing = 0;
T.send({ t: 'start' });
for (let q = 0; q < QN; q++) {
  const sent = performance.now();
  await T.next('question');
  await wait(1200);
  for (const k of kids) {
    if (k.got[q] == null) missing++;
    else lat.push(k.got[q] - sent);
  }
  kids.forEach((k, i) => k.send({ t: 'answer', qi: q, opt: i % 4 }));   // all answer → reveal
  await T.next('reveal');
  await wait(500);
  const noReveal = kids.filter((k) => !k.revealed[q]).length;
  if (noReveal) { console.log(`question ${q}: ${noReveal} children got no reveal`); missing += noReveal; }
  T.send({ t: 'next' });
}
await T.next('end');
clearInterval(walker);
lat.sort((a, b) => a - b);
const pct = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))].toFixed(0);
console.log(`question delivery: median ${pct(0.5)} ms, 95% ${pct(0.95)} ms, max ${lat[lat.length - 1].toFixed(0)} ms`);
console.log(missing ? `FAIL ${missing} missed messages` : 'ok   nobody missed a question or reveal');
[T, ...kids].forEach((c) => c.ws.close());
process.exit(missing ? 1 : 0);
