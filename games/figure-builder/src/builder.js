// "Meine Figur": the child puts together their own figure. Preview turns by itself and by
// dragging; every change rebuilds the figure. Saved on this device (localStorage).
import * as THREE from 'three';
import { OUTFITS, HEADS, HEAD_NO_HAT, HATS, GLASSES, BACKS, SKIN, HAIR, COLORS, DEFAULT, normalize, randomConfig, buildFigure, loadClips } from './figure.js';

const LANG = (new URLSearchParams(location.search).get('lang') || (() => { try { return localStorage.getItem('krabsy_lang'); } catch (_) { return null; } })() || 'de') === 'es' ? 'es' : 'de';
const T = {
  de: { title: 'Meine Figur', loading: 'Figur wird gebaut …', outfit: 'Kleidung', head: 'Kopf & Haare', hat: 'Kopfbedeckung',
    glasses: 'Brille', back: 'Rücken', skin: 'Hautfarbe', hair: 'Haarfarbe', main: 'Hauptfarbe', legs: 'Hosenfarbe',
    orig: 'Original', rand: '🎲 Zufall', reset: 'Zurücksetzen', save: 'Speichern', saved: 'Gespeichert ✓ – deine Figur ist auf diesem Gerät.',
    idle: 'Stehen', walk: 'Laufen', wave: 'Winken', jump: 'Jubeln',
    fig: { Protagonist_A: 'Schülerin', Protagonist_B: 'Schüler', Hiker: 'Wanderer', Witch: 'Hexe', Superhero: 'Superheld',
      Helper_A: 'Wichtel', Helper_B: 'Elf', Caveman: 'Steinzeit', Knight: 'Ritter', Ranger: 'Waldläufer', Rogue: 'Abenteurerin',
      Rogue_Hooded: 'Kapuze', Barbarian: 'Barbar' },
    hatBuiltIn: 'hat schon eine Kappe',
    hats: { none: 'keine', cap: 'Mütze', witch: 'Hexenhut', pointy: 'Zipfelmütze', elf: 'Elfenmütze', bear: 'Bärenfell', helmet: 'Helm' },
    glassesN: { none: 'keine', square: 'eckig', round: 'rund' },
    backs: { none: 'nichts', pack: 'Rucksack', packA: 'Schulrucksack', packB: 'Sportrucksack', cape: 'Umhang', capeRed: 'roter Umhang', capeBlue: 'blauer Umhang', capeGreen: 'grüner Umhang' } },
  es: { title: 'Mi personaje', loading: 'Creando personaje …', outfit: 'Ropa', head: 'Cabeza y pelo', hat: 'Gorro',
    glasses: 'Gafas', back: 'Espalda', skin: 'Piel', hair: 'Pelo', main: 'Color principal', legs: 'Pantalón',
    orig: 'Original', rand: '🎲 Al azar', reset: 'Reiniciar', save: 'Guardar', saved: 'Guardado ✓ – tu personaje está en este dispositivo.',
    idle: 'Quieto', walk: 'Caminar', wave: 'Saludar', jump: 'Celebrar',
    fig: { Protagonist_A: 'Estudiante', Protagonist_B: 'Estudiante 2', Hiker: 'Excursionista', Witch: 'Bruja', Superhero: 'Superhéroe',
      Helper_A: 'Duende', Helper_B: 'Elfo', Caveman: 'Prehistoria', Knight: 'Caballero', Ranger: 'Explorador', Rogue: 'Aventurera',
      Rogue_Hooded: 'Capucha', Barbarian: 'Bárbaro' },
    hatBuiltIn: 'ya lleva gorra',
    hats: { none: 'nada', cap: 'Gorro', witch: 'Sombrero de bruja', pointy: 'Gorro de duende', elf: 'Gorro de elfo', bear: 'Piel de oso', helmet: 'Casco' },
    glassesN: { none: 'nada', square: 'cuadradas', round: 'redondas' },
    backs: { none: 'nada', pack: 'Mochila', packA: 'Mochila escolar', packB: 'Mochila deportiva', cape: 'Capa', capeRed: 'Capa roja', capeBlue: 'Capa azul', capeGreen: 'Capa verde' } },
}[LANG];
document.documentElement.lang = LANG;
document.title = `Krabsy – ${T.title}`;
const $ = (id) => document.getElementById(id);
$('title').textContent = T.title;

const KEY = 'krabsy_figure_v1';
let cfg = normalize((() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } })() || DEFAULT);

// ------------------------------------------------------------------ 3D preview
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#13204a');
scene.add(new THREE.HemisphereLight('#dfe9ff', '#3a2d58', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(3, 6, 5); sun.castShadow = true; scene.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshLambertMaterial({ color: '#2b3b74' }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.72, 48), new THREE.MeshBasicMaterial({ color: '#2ee6c0' }));
ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 1.5, 6.2); camera.lookAt(0, 1.05, 0);
const turn = new THREE.Group(); scene.add(turn);

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let drag = null, spin = 0.35, yaw = 0.4;
canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; spin = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (drag != null) { yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
canvas.addEventListener('pointerup', () => { drag = null; setTimeout(() => { if (drag == null) spin = 0.35; }, 2500); });

// ------------------------------------------------------------------ figure + animation
let fig = null, mixer = null, clips = null, anim = 'idle', building = 0;
const CLIPS = { idle: 'Idle_A', walk: 'Walking_A', wave: 'Interact', jump: 'Jump_Full_Short' };
async function rebuild() {
  const my = ++building;
  $('loading').textContent = fig ? '' : T.loading;
  const next = await buildFigure(cfg);
  clips ||= await loadClips();
  if (my !== building) { next.dispose(); return; }          // a newer change won
  if (fig) { turn.remove(fig.root); fig.dispose(); }
  fig = next; turn.add(fig.root);
  mixer = new THREE.AnimationMixer(fig.root);
  play(anim);
  $('loading').textContent = '';
}
function play(name) {
  anim = name;
  if (!mixer || !clips) return;
  mixer.stopAllAction();
  const a = mixer.clipAction(clips[CLIPS[name]]);
  a.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  document.querySelectorAll('#anims button').forEach((b) => b.classList.toggle('on', b.dataset.a === name));
}
for (const k of Object.keys(CLIPS)) {
  const b = document.createElement('button'); b.dataset.a = k; b.textContent = T[k];
  b.addEventListener('click', () => play(k)); $('anims').appendChild(b);
}

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  yaw += spin * dt; turn.rotation.y = yaw;
  mixer?.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ panel
function cycleRow(key, label, options, names) {
  const div = document.createElement('div'); div.className = 'slot';
  div.innerHTML = `<h3>${label}</h3><div class="cycle"><button aria-label="‹">‹</button><span></span><button aria-label="›">›</button></div>`;
  const [prev, next] = div.querySelectorAll('button'), span = div.querySelector('span');
  const show = () => { span.textContent = names[cfg[key]] || cfg[key]; };
  const step = (d) => {
    if (div.classList.contains('off')) return;
    const i = options.indexOf(cfg[key]);
    cfg = normalize({ ...cfg, [key]: options[(i + d + options.length) % options.length] });
    showAll(); changed();
  };
  prev.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
  div.show = show; show();
  return div;
}
function swatchRow(key, label, palette) {
  const div = document.createElement('div'); div.className = 'slot';
  div.innerHTML = `<h3>${label}</h3><div class="swatches"></div>`;
  const box = div.querySelector('.swatches');
  const make = (i) => {
    const b = document.createElement('button'); b.className = 'sw' + (i < 0 ? ' orig' : ''); b.title = i < 0 ? T.orig : palette[i];
    if (i >= 0) b.style.background = palette[i]; else b.textContent = '★';
    b.addEventListener('click', () => { cfg = normalize({ ...cfg, [key]: i }); div.show(); changed(); });
    box.appendChild(b); return b;
  };
  const btns = [-1, ...palette.keys()].map(make);
  div.show = () => btns.forEach((b, j) => b.classList.toggle('on', j - 1 === cfg[key]));
  div.show();
  return div;
}
const rows = [
  cycleRow('outfit', T.outfit, OUTFITS, T.fig),
  cycleRow('head', T.head, HEADS, T.fig),
  cycleRow('hat', T.hat, Object.keys(HATS), T.hats),
  cycleRow('glasses', T.glasses, Object.keys(GLASSES), T.glassesN),
  cycleRow('back', T.back, Object.keys(BACKS), T.backs),
  swatchRow('skin', T.skin, SKIN),
  swatchRow('hair', T.hair, HAIR),
  swatchRow('main', T.main, COLORS),
  swatchRow('legs', T.legs, COLORS),
];
rows.forEach((r) => $('slots').appendChild(r));
// A head with a built-in cap takes no extra hat: the hat row is switched off.
const hatRow = rows[2];
function showAll() {
  rows.forEach((r) => r.show());
  const off = HEAD_NO_HAT.includes(cfg.head);
  hatRow.classList.toggle('off', off);
  hatRow.querySelector('span').textContent = off ? T.hatBuiltIn : (T.hats[cfg.hat] || cfg.hat);
}
showAll();

let timer = 0;
function changed() { $('saved').textContent = ''; clearTimeout(timer); timer = setTimeout(rebuild, 60); }

$('randBtn').textContent = T.rand; $('resetBtn').textContent = T.reset; $('saveBtn').textContent = T.save;
$('randBtn').addEventListener('click', () => { cfg = randomConfig(); showAll(); changed(); });
$('resetBtn').addEventListener('click', () => { cfg = { ...DEFAULT }; showAll(); changed(); });
$('saveBtn').addEventListener('click', () => {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); $('saved').textContent = T.saved; } catch (_) { /* private mode */ }
});

rebuild().catch((e) => { console.error(e); $('loading').textContent = String(e.message || e); });
window.__fb = { view(y) { spin = 0; yaw = y; }, get cfg() { return cfg; }, set cfg(v) { cfg = normalize(v); showAll(); changed(); }, get fig() { return fig; }, rebuild };
