// Game clips: short silent gameplay loops for the hover preview on game cards.
//
//   node tools/game-clips/record.cjs <game> [--section de|es|en/spanish] [--seed N] [--probe] [--keep]
//
// --probe runs the scene without capturing (fast): prints the scene log, e.g. to
// find a seed whose question is a well-known verb.
//
// Frame-exact capture, independent of how fast this machine renders: the page
// runs on Playwright's fake clock and CSS animations are paused and stepped by
// hand, so every captured frame is exactly 1/FPS of game time apart. Each game
// has a scene file next to this one (tools/game-clips/<game>.cjs) that sets the
// kitchen up and scripts the moves frame by frame (see verb-kitchen.cjs).
//
// Output: homepage/clips/<game>-<section-slug>.mp4 (H.264, 640x360, no audio)
// (the card's own picture stays underneath until the clip plays). Needs the site served on :8000
// (python3 -m http.server 8000 from homepage/) and ffmpeg on PATH.
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');

const ROOT = path.resolve(__dirname, '../..');
const FPS = 30;
const OUT_W = 640, OUT_H = 360;

const args = process.argv.slice(2);
const game = args[0];
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i < 0 ? dflt : args[i + 1]; };
const flag = (name) => args.includes('--' + name);
if (!game) { console.error('usage: record.cjs <game> [--section de]'); process.exit(2); }
const section = opt('section', 'de');
const slug = section.replace(/\//g, '-');
const scene = require(`./${game}.cjs`);
const base = opt('base', 'http://localhost:8000');
const seed = opt('seed', scene.seed);
const probe = flag('probe');

(async () => {
  const work = path.join(require('os').tmpdir(), `krabsy-clip-${game}-${slug}`);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });

  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: scene.viewport, deviceScaleFactor: scene.scale || 2,
    locale: scene.locale ? scene.locale(section) : undefined,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await page.clock.install();
  const url = scene.url(section) + (seed ? `&seed=${seed}` : '');
  await page.goto(base + url);
  await scene.setup(page, section);

  // From here on time only moves when we say so.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
  await page.evaluate(() => {
    // CSS animations / transitions: pause each one and drive its currentTime
    const seen = new Map();
    window.__clipStepCSS = (ms) => {
      for (const a of document.getAnimations()) {
        if (!seen.has(a)) seen.set(a, a.currentTime || 0);   // running ones keep their place
        const t = seen.get(a) + ms;
        seen.set(a, t);
        a.pause();
        a.currentTime = t;
      }
    };
  });

  const cdp = await ctx.newCDPSession(page);
  const dtMs = 1000 / FPS;
  const maxFrames = Math.round(scene.maxSeconds * FPS);
  await page.evaluate((s) => window.__clip.start(s), section);
  let f = 0;
  // the scene script decides the length: it ends when its last step is done
  for (; f < maxFrames; f++) {
    // the scene advances its game by one frame and says how fast time runs
    // (1 = normal, <1 = slow motion, 0 = finished); timers and CSS follow suit
    const speed = await page.evaluate((dt) => window.__clip.step(dt), 1 / FPS);
    if (!speed) break;
    await page.clock.runFor(dtMs * speed);
    await page.evaluate((ms) => { window.__clipStepCSS(ms); }, dtMs * speed);
    if (probe) continue;
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(work, `f${String(f).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));
    if (f % 30 === 0) process.stdout.write(`  ${(f / FPS).toFixed(0)}s `);
  }
  process.stdout.write(`\n${(f / FPS).toFixed(1)} s, ${f} frames${f >= maxFrames ? ' (hit maxSeconds!)' : ''}\n`);
  const log = await page.evaluate(() => window.__clip.log || []);
  if (log.length) console.log('scene log:', log.join(' | '));
  if (errs.length) console.log('page errors:', errs);
  await browser.close();

  if (probe) return;

  const outDir = path.join(ROOT, 'homepage/clips');
  fs.mkdirSync(outDir, { recursive: true });
  const mp4 = path.join(outDir, `${game}-${slug}.mp4`);
  // lanczos downscale from the 2x capture keeps text and edges crisp at 640x360
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(work, 'f%04d.png'),
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', String(scene.crf || 24), '-tune', 'animation',
    '-movflags', '+faststart', '-an', mp4]);
  console.log(`${path.relative(ROOT, mp4)}  ${(fs.statSync(mp4).size / 1024).toFixed(0)} KB`);
  if (!flag('keep')) fs.rmSync(work, { recursive: true, force: true });
  else console.log('frames kept in', work);
})().catch((e) => { console.error(e); process.exit(1); });
