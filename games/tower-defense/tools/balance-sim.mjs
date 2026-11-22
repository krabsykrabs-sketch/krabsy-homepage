// Balance simulation: a bot plays levels at several verb accuracies.
// usage: node tools/balance-sim.mjs [trials] [levels, e.g. 0,1,2] [strategy]
//   strategy "mix"     (default) — a mixed set of towers, built between waves
//   strategy "archers" — only archer towers on the best spots, built whenever there
//                        are coins (also during a wave), like a sharp human player;
//                        the owner beat level 5 this way without answering (2026-11-22)
// Needs tools/dev-server.py running on :8125.
import { createRequire } from 'module';
const require = createRequire(process.env.HOME + '/.npm/_npx/e78b33305587cb7c/node_modules/');
const { chromium } = require('playwright');
const trials = +(process.argv[2] || 3);
const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 500 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
const strategy = process.argv[4] || 'mix';
await p.goto('http://127.0.0.1:8125/?lang=en&unlock=all'); await p.waitForSelector('.level-card', { timeout: 30000 });
await p.evaluate(() => { localStorage.setItem('td3d_tutorial_done', '1'); });
const run = (level, acc) => p.evaluate(([level, acc, strategy]) => {
  const T = __td, st = T.state;
  T.startGame(level);
  const lvl = T.Level.current;
  const roads = [...lvl.cells.values()].filter(c => c.type === 'path' || c.type === 'spawn');
  const center = (c, r) => T.Grid.placementCellToWorld(c, r);
  const spots = [];
  for (let r = 0; r < lvl.rows; r++) for (let c = 0; c < lvl.cols; c++) {
    if (!T.Grid.isAvailable(c, r)) continue;
    const q = center(c, r); let n = 0;
    for (const road of roads) { const w = center(road.c, road.r); if (Math.hypot(w.centerX - q.centerX, w.centerY - q.centerY) <= 3.5) n++; }
    spots.push({ c, r, n });
  }
  spots.sort((a, b) => b.n - a.n);
  const order = strategy === 'archers'
    ? new Array(spots.length).fill('basic')
    : ['basic', 'basic', 'cannon', 'basic', 'catapult', 'freeze', 'cannon', 'basic', 'catapult', 'cannon'];
  const cost = Object.fromEntries(Object.entries(T.CONFIG.TOWERS).map(([k, d]) => [k, d.cost]));
  let bought = 0, upgrades = 0;
  const spend = () => {
    for (;;) {
      if (bought < order.length) {
        const type = order[bought];
        if (st.coins < cost[type]) return;
        const s = spots.find(s => T.Grid.isAvailable(s.c, s.r));
        if (!s || !T.Input._place(type, s.c, s.r)) return;
        bought++;
      } else {
        const ups = st.towers.map(t => ({ t, up: t.nextUpgrade() })).filter(x => x.up && x.up.cost <= st.coins).sort((a, b) => a.up.cost - b.up.cost);
        if (!ups.length) return;
        st.coins -= ups[0].up.cost; ups[0].t.upgrade(); upgrades++;
      }
    }
  };
  let guard = 0, right = 0, asked = 0;
  while (st.phase !== 'VICTORY' && st.phase !== 'GAME_OVER' && guard++ < 400000) {
    if (st.phase === 'BUILD') {
      // Answer every question the forge card offers this wave (right with probability acc).
      T.Forge.update(0, st);
      while (st.forge.stage === 'ask') {
        const q = st.forge.q; const ok = Math.random() < acc; asked++; if (ok) right++;
        T.Forge.answer(st, ok ? q.correctIndex : (q.correctIndex + 1) % q.options.length);
        T.Forge.update(10, st);   // skip the pause / lock
      }
      for (let i = 0; i < 60; i++) T.step(0.05);   // coins fly in
      spend();
      st.selectedTower = null;
      T.Wave.startNext(st);
    } else {
      T.step(0.05);
      if (strategy === 'archers' && guard % 20 === 0) { spend(); st.selectedTower = null; }
    }
  }
  return { level: level + 1, acc, result: st.phase === 'VICTORY' ? 'WIN' : 'lose', wave: st.currentWave, lives: st.lives, stars: st.starsEarned, towers: bought, upgrades, coins: st.coins, right, asked };
}, [level, acc, strategy]);
for (const level of (process.argv[3] || "0,1,2").split(",").map(Number)) {
  for (const acc of [1, 0.7, 0.4, 0]) {
    const rs = []; for (let i = 0; i < trials; i++) rs.push(await run(level, acc));
    console.log(`L${level + 1} ${strategy} acc ${acc}: ` + rs.map(r => `${r.result} w${r.wave} ♥${r.lives} ★${r.stars} t${r.towers}+${r.upgrades}`).join(' | '));
  }
}
console.log(errs.length ? [...new Set(errs)].join('\n') : 'no page errors');
await b.close();
