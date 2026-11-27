// Checks every road in the level files: no gaps, no cell twice, and no turn sharper
// than 60° (one hex side) — enemies must never turn 90° or more (owner rule).
// Also: no road in the bottom-left corner the question card covers (cornerFree,
// default 5 columns × 3 rows; see js/level.js).
// usage: node tools/check-turns.mjs        (exit code 1 if any problem is found)
import fs from 'fs';
import path from 'path';
const dir = new URL('../TowerDefense3D/levels/', import.meta.url).pathname;
const nb = (c, r, k) => { const o = r & 1; return [[c + 1, r], [c + o, r - 1], [c + o - 1, r - 1], [c - 1, r], [c + o - 1, r + 1], [c + o, r + 1]][k]; };
const dirOf = (a, b) => { for (let k = 0; k < 6; k++) { const n = nb(a[0], a[1], k); if (n[0] === b[0] && n[1] === b[1]) return k; } return -1; };
let bad = 0;
for (const f of fs.readdirSync(dir).filter(f => /^(level\d+|training)\.js$/.test(f)).sort()) {
  const window = {}; new Function('window', fs.readFileSync(path.join(dir, f), 'utf8'))(window);
  const L = Object.values(window)[0];
  L.paths.forEach((p, pi) => {
    const seen = new Set();
    p.cells.forEach((cell, i) => {
      const key = String(cell);
      if (seen.has(key)) { bad++; console.log(`${f} path ${pi + 1}: cell [${cell}] appears twice`); }
      seen.add(key);
      if (i > 0 && dirOf(p.cells[i - 1], cell) < 0) { bad++; console.log(`${f} path ${pi + 1}: [${p.cells[i - 1]}] → [${cell}] are not neighbours`); }
    });
    const cf = L.cornerFree || { cols: 5, rows: 3 };
    for (const [c, r] of p.cells) if (c < cf.cols && r >= L.rows - cf.rows) { bad++; console.log(`${f} path ${pi + 1}: road [${c},${r}] in the corner kept free for the question card`); }
    for (let i = 1; i + 1 < p.cells.length; i++) {
      const d1 = dirOf(p.cells[i - 1], p.cells[i]), d2 = dirOf(p.cells[i], p.cells[i + 1]);
      const turn = Math.min((d2 - d1 + 6) % 6, (d1 - d2 + 6) % 6) * 60;
      if (turn > 60) { bad++; console.log(`${f} path ${pi + 1}: ${turn}° turn at [${p.cells[i]}] (from [${p.cells[i - 1]}] to [${p.cells[i + 1]}])`); }
    }
  });
}
console.log(bad ? `${bad} problem(s)` : 'all turns ≤ 60°, card corner free');
process.exit(bad ? 1 : 0);
