// node tools/render_accessory_thumbs.cjs [--sheet out.png] [--only hat-cap,back-wings]
//
// Renders one small picture per figure accessory (hat, glasses, back item) for the tiles
// of the figure builder page (homepage/lib/krabsy-figure-page.js, tab "Zubehör"):
//   homepage/assets/figures/items/<slot>-<id>.webp   (192 × 192, transparent, 2–6 KB)
//
// The catalogue (HATS, GLASSES, BACKS) and the models come from the served site:
// homepage/lib/krabsy-figure.js and homepage/assets/figures/. Each accessory is put on a
// plain base character with buildFigure(), everything but the accessory is hidden, and the
// picture is cropped to the object. Run it again after adding an accessory to the catalogue.
//
// Needs Playwright + Chromium (WebGL through SwiftShader). Playwright is looked up in
// $PLAYWRIGHT_DIR, then in the usual places; the browser in $CHROME (else Playwright's own).
// --sheet writes a contact sheet of all pictures on the builder's dark tile colour.
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { createRequire } = require('module');

const ROOT = path.join(__dirname, '..', 'homepage');
const OUT = path.join(ROOT, 'assets', 'figures', 'items');
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

function findPlaywright() {
  const dirs = [process.env.PLAYWRIGHT_DIR, path.join(__dirname, '..', 'node_modules'),
    ...(fs.existsSync(path.join(os.homedir(), '.npm', '_npx'))
      ? fs.readdirSync(path.join(os.homedir(), '.npm', '_npx')).map((d) => path.join(os.homedir(), '.npm', '_npx', d, 'node_modules')) : [])];
  for (const d of dirs) {
    if (!d) continue;
    try { return createRequire(path.join(d, 'x.js'))('playwright'); } catch (_) { /* next */ }
  }
  try { return require('playwright'); } catch (_) { /* fall through */ }
  throw new Error('Playwright not found. Set PLAYWRIGHT_DIR to a node_modules folder that has it.');
}
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = path.join(os.homedir(), '.cache', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(base, d, sub);
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.glb': 'model/gltf-binary', '.png': 'image/png',
  '.webp': 'image/webp', '.json': 'application/json', '.css': 'text/css' };
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{ "imports": { "three": "/lib/vendor/three/three.module.min.js", "three/addons/": "/lib/vendor/three/addons/" } }</script>
</head><body style="margin:0;background:#16245a">
<script type="module">
import * as THREE from 'three';
import { HATS, GLASSES, BACKS, buildFigure } from '/lib/krabsy-figure.js';

const OUT = 192, BIG = 640, PAD = 0.07;
// The base character every accessory is put on (hats fit it; it is hidden in the picture).
const BASE = 'Hiker';
// View per slot: yaw (0 = from the front, π = from behind) and pitch (looking down), in
// radians. Back items are seen from behind, a little from the side.
const VIEW = { hat: [0.55, 0.3], glasses: [0.3, 0.1], back: [Math.PI - 0.6, 0.22] };
const VIEW_ITEM = {
  'hat-space': [0.55, 0.12], 'hat-helmet': [0.55, 0.15], 'hat-headband': [0.7, 0.2],
  'back-wings': [Math.PI - 0.8, 0.15], 'back-key': [Math.PI - 1.25, 0.35], 'back-jetpack': [Math.PI - 0.75, 0.3],
};
const only = new URLSearchParams(location.search).get('only');
const list = [];
for (const [slot, cat] of [['hat', HATS], ['glasses', GLASSES], ['back', BACKS]]) {
  for (const id of Object.keys(cat)) if (!only || only.split(',').includes(slot + '-' + id)) list.push([slot, id]);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(BIG, BIG); renderer.setClearColor(0x000000, 0);
const out = {};
for (const [slot, id] of list) {
  const fig = await buildFigure({ char: BASE, hat: 'none', glasses: 'none', back: 'none', [slot]: id });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#6a5a8a', 1.9));
  scene.add(fig.root); fig.root.updateMatrixWorld(true);
  // Only the accessory stays visible. Its box: skinned parts are measured with their bones.
  const box = new THREE.Box3();
  fig.root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.userData.figureSlot) { o.visible = false; return; }
    // Glass lenses: a little more solid, so they read on the dark tile.
    if (o.material.transparent || o.material.opacity < 1) { o.material.opacity = Math.max(o.material.opacity, 0.55); }
    if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); }
    else box.expandByObject(o);
  });
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  const [yaw, pitch] = VIEW_ITEM[slot + '-' + id] || VIEW[slot];
  const cam = new THREE.PerspectiveCamera(20, 1, 0.01, 100);
  const dist = r / Math.sin(THREE.MathUtils.degToRad(10)) * 1.15;
  cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * dist, c.y + Math.sin(pitch) * dist, c.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(c);
  // The light comes from over the viewer's left shoulder, whatever the view.
  const sun = new THREE.DirectionalLight('#ffffff', 1.5);
  sun.position.copy(cam.position).add(new THREE.Vector3(-Math.cos(yaw), 1.2, Math.sin(yaw)).multiplyScalar(dist * 0.5));
  sun.target.position.copy(c); scene.add(sun, sun.target);
  renderer.render(scene, cam);

  // Crop to the object (alpha), centre it in a square with a small margin, scale down.
  const big = document.createElement('canvas'); big.width = big.height = BIG;
  const g = big.getContext('2d', { willReadFrequently: true });
  g.drawImage(renderer.domElement, 0, 0);
  const d = g.getImageData(0, 0, BIG, BIG).data;
  let x0 = BIG, y0 = BIG, x1 = -1, y1 = -1;
  for (let y = 0; y < BIG; y++) for (let x = 0; x < BIG; x++) if (d[(y * BIG + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { out[slot + '-' + id] = null; fig.dispose(); continue; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, side = Math.max(w, h) * (1 + 2 * PAD);
  const small = document.createElement('canvas'); small.width = small.height = OUT;
  const s = small.getContext('2d'); s.imageSmoothingQuality = 'high';
  const k = OUT / side;
  s.drawImage(big, x0, y0, w, h, (OUT - w * k) / 2, (OUT - h * k) / 2, w * k, h * k);
  out[slot + '-' + id] = small.toDataURL('image/webp', 0.86);
  fig.dispose();
}
window.__out = out;
</script></body></html>`;

(async () => {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/__thumbs.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    const file = path.join(ROOT, path.normalize(url));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const { chromium } = findPlaywright();
  const browser = await chromium.launch({ executablePath: findChrome(),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('ERR', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
    const only = arg('--only');
    await page.goto(`http://127.0.0.1:${port}/__thumbs.html${only ? `?only=${only}` : ''}`);
    await page.waitForFunction(() => window.__out, null, { timeout: 300000 });
    const out = await page.evaluate(() => window.__out);
    fs.mkdirSync(OUT, { recursive: true });
    let total = 0;
    for (const [name, url] of Object.entries(out)) {
      if (!url) { console.log('EMPTY', name); continue; }
      const buf = Buffer.from(url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, `${name}.webp`), buf); total += buf.length;
      console.log(`${name}.webp`.padEnd(28), `${(buf.length / 1024).toFixed(1)} KB`);
    }
    console.log(`${Object.keys(out).length} pictures, ${(total / 1024).toFixed(0)} KB → ${path.relative(process.cwd(), OUT)}`);
    const sheet = arg('--sheet');
    if (sheet) {
      await page.setViewportSize({ width: 1120, height: 800 });
      await page.setContent(`<body style="margin:0;background:#101a3d;display:flex;flex-wrap:wrap;gap:8px;padding:8px;font:12px sans-serif;color:#fff">${
        Object.entries(out).map(([n, u]) => `<div style="width:130px;text-align:center"><div style="background:#16245a;border-radius:12px;padding:8px"><img src="${u}" width="96" height="96"></div>${n}</div>`).join('')}</body>`);
      await page.screenshot({ path: sheet, fullPage: true });
    }
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
