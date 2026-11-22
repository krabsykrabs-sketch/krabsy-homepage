// Release build: copy the game into homepage/games/verb-platformer/ with only the files the game
// really loads. The source folder keeps every KayKit piece for the editor (≈22 MB); the served
// copy gets just the pieces the menu levels use.
//
//   PLAYWRIGHT=<path to playwright module> node tools/build-release.cjs <base-url> [--dry]
//   e.g. node tools/build-release.cjs http://localhost:8902/games/verb-platformer/
//
// <base-url> must serve THIS folder with the site's /lib and /data next to it (see CLAUDE.md,
// "local server"). How it works: every level in assets/levels/index.json is opened in a headless
// browser and every request under the game folder is recorded; those files plus the code
// (index.html, main.js, styles.css, src/, vendor/, fonts/) and all sounds are copied.
// Not copied: editor, tools, test pieces (assets/levels/_*.json), docs.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const SRC = path.resolve(__dirname, '..');
const OUT = path.resolve(SRC, '../../homepage/games/verb-platformer');
const base = process.argv[2];
const dry = process.argv.includes('--dry');
if (!base) { console.error('usage: node tools/build-release.cjs <base-url> [--dry]'); process.exit(2); }

const ALWAYS = ['index.html', 'main.js', 'styles.css', 'src', 'vendor', 'fonts', 'assets/sounds'];

function walk(rel, out) {
  const abs = path.join(SRC, rel);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isDirectory()) for (const f of fs.readdirSync(abs)) walk(path.join(rel, f), out);
  else out.add(rel.split(path.sep).join('/'));
}

(async () => {
  const levels = JSON.parse(fs.readFileSync(path.join(SRC, 'assets/levels/index.json'), 'utf8'));
  const files = new Set();
  for (const p of ALWAYS) walk(p, files);
  files.add('assets/levels/index.json');
  for (const f of levels) files.add(`assets/levels/${f}`);

  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const prefix = new URL(base).pathname;
  const failed = [];
  for (let n = 0; n <= levels.length; n++) {
    // n = 0: the menu only; n >= 1: play level n (full scenery so nothing is skipped)
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 700 } })).newPage();
    page.on('requestfinished', r => {
      const u = new URL(r.url());
      if (u.pathname.startsWith(prefix)) files.add(decodeURIComponent(u.pathname.slice(prefix.length)) || 'index.html');
    });
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) failed.push(`${r.status()} ${r.url()}`); });
    await page.goto(base + 'index.html' + (n ? `?level=${n}&scenery=full` : ''));
    if (n) await page.waitForFunction(() => window.__krabsyDebug?.level() && window.__krabsyDebug.alive(), null, { timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.close();
  }
  await browser.close();
  if (failed.length) { console.error('requests failed:\n  ' + failed.join('\n  ')); process.exit(1); }

  const list = [...files].filter(f => f && !f.endsWith('/') && fs.existsSync(path.join(SRC, f)) && fs.statSync(path.join(SRC, f)).isFile()).sort();
  const bytes = list.reduce((a, f) => a + fs.statSync(path.join(SRC, f)).size, 0);
  console.log(`${list.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
  if (dry) { console.log(list.join('\n')); return; }

  // The served index.html keeps its SEO meta (noindex, indexifembedded) — the source has it too.
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const f of list) {
    const to = path.join(OUT, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(SRC, f), to);
  }
  console.log(`copied to ${path.relative(process.cwd(), OUT)}`);
})();
