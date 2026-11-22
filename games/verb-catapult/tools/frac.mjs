// node tools/frac.mjs [level] [stone]: share of single shots (angle × power grid) that down 0/1/2/all skeletons
import { createRequire } from 'module'; import fs from 'fs';
const require = createRequire(import.meta.url);
const planck = require('../vendor/planck.min.js');
const { Sim, MAX_SPEED } = await import('../src/physics.js');
const lvl = JSON.parse(fs.readFileSync(new URL(`../levels/level${process.argv[2] || 1}.json`, import.meta.url)));
const stone = process.argv[3] || 'normal';
lvl.castles.forEach((c, ci) => {
  const hist = new Array(c.skels.length + 1).fill(0); let n = 0, brk = 0;
  for (let a = 6; a <= 70; a += 4) for (let p = 0.5; p <= 1.0001; p += 0.05) {
    const sim = new Sim(planck); sim.build(c); for (let i = 0; i < 90; i++) sim.step();
    const v = MAX_SPEED * p, r = a * Math.PI / 180; sim.fire(stone, v * Math.cos(r), v * Math.sin(r));
    let t = 0; do { sim.step(); t += 1 / 60; brk += sim.events.filter((e) => e.type === 'break').length; sim.events = []; } while (t < 9 && !(t > 1 && sim.settled()));
    hist[c.skels.length - sim.standing()]++; n++;
  }
  console.log(`castle ${ci + 1} (${stone}): downed 0..all = ${hist.map((h) => (100 * h / n).toFixed(0) + '%').join(' / ')}, blocks broken per shot ${(brk / n).toFixed(2)}`);
});
