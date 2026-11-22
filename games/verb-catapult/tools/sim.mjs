// Headless castle check (no browser): node tools/sim.mjs [level] [stone]
// 1) stability: each castle stands 6 s untouched with no damage
// 2) shot sweep: which single shots (angle x power) knock skeletons over,
//    and a greedy run: best shot each turn until stones run out.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const planck = require('../vendor/planck.min.js');
const { Sim, MAX_SPEED } = await import('../src/physics.js');
const lvl = JSON.parse(fs.readFileSync(new URL(`../levels/level${process.argv[2] || 1}.json`, import.meta.url)));
const stone = process.argv[3] || 'normal';

function run(castle, shots) {
  const sim = new Sim(planck); sim.build(castle);
  for (let i = 0; i < 90; i++) sim.step();
  let broken = 0;
  for (const [ang, pow] of shots) {
    const v = MAX_SPEED * pow;
    sim.fire(stone, v * Math.cos(ang), v * Math.sin(ang));
    let t = 0;
    do { sim.step(); t += 1 / 60; for (const e of sim.events) if (e.type === 'break') broken++; sim.events = []; }
    while (t < 9 && !(t > 1 && sim.settled()));
  }
  return { standing: sim.standing(), broken, sim };
}

lvl.castles.forEach((c, ci) => {
  const sim = new Sim(planck); sim.build(c);
  let moved = 0, ev = 0;
  for (let i = 0; i < 360; i++) { sim.step(); ev += sim.events.filter((e) => e.type !== 'crack').length; sim.events = []; }
  for (const b of sim.blocks) { const s = b.getUserData().src, p = b.getPosition(); moved = Math.max(moved, Math.hypot(p.x - s.x, p.y - s.y)); }
  console.log(`castle ${ci + 1}: bodies ${sim.bodyCount()}, stable drift ${moved.toFixed(3)} m, events ${ev}, standing ${sim.standing()}/${c.skels.length}`);
  // sweep single shots
  const grid = [];
  for (let a = 10; a <= 70; a += 4) for (let p = 0.5; p <= 1.0001; p += 0.05) grid.push([a * Math.PI / 180, p]);
  let plan = [];
  for (let k = 0; k < c.stones; k++) {
    let best = null;
    for (const g of grid) {
      const r = run(c, [...plan, g]);
      const score = (c.skels.length - r.standing) * 10 + r.broken;
      if (!best || score > best.score) best = { g, score, standing: r.standing };
    }
    plan.push(best.g);
    console.log(`  shot ${k + 1}: ${(best.g[0] * 180 / Math.PI).toFixed(0)}° ${(best.g[1] * 100).toFixed(0)}% → standing ${best.standing}`);
    if (best.standing === 0) break;
  }
});
