// "Meine Figur": step 1, the child picks a character (picture gallery in three groups);
// step 2, customises it: hat, glasses, back item (★ = the character's own) and colours.
// Every change rebuilds the figure. Saved on this device (localStorage).
import * as THREE from 'three';
import { CHARS, GROUPS, HATS, GLASSES, BACKS, SKIN, HAIR, COLORS, DEFAULT, normalize, randomConfig,
  buildFigure, loadClips, charInfo } from './figure.js';

const LANG = (new URLSearchParams(location.search).get('lang') || (() => { try { return localStorage.getItem('krabsy_lang'); } catch (_) { return null; } })() || 'de') === 'es' ? 'es' : 'de';
const T = {
  de: {
    title: 'Meine Figur', loading: 'Figur wird gebaut …', h1: 'Wähle deine Figur', h2: 'Gestalte sie',
    groups: { people: 'Menschen', fantasy: 'Fantasy', monsters: 'Monster & Roboter' },
    hat: 'Kopfbedeckung', glasses: 'Brille', back: 'Rücken', skin: 'Hautfarbe', hair: 'Haarfarbe',
    main: 'Hauptfarbe', legs: 'Hosenfarbe', acc: 'Farbe vom Zubehör',
    own: '★ Original', none: 'nichts', noHat: 'passt hier nicht', orig: 'Original',
    rand: '🎲 Zufall', reset: 'Zurücksetzen', save: 'Speichern', saved: 'Gespeichert ✓ – deine Figur ist auf diesem Gerät.',
    spin: '🔄 Drehen', idle: 'Stehen', walk: 'Laufen', wave: 'Winken', jump: 'Jubeln',
    chars: { Protagonist_A: 'Schülerin', Protagonist_B: 'Schüler', Hiker: 'Wanderer', Witch: 'Hexe', Superhero: 'Superheld',
      MagicalGirl: 'Zaubermädchen', Helper_A: 'Wichtel', Helper_B: 'Elf', Caveman: 'Steinzeitmensch', Farmer_A: 'Bauer',
      Farmer_B: 'Bäuerin', Driver: 'Rennfahrer', Survivalist: 'Abenteurer', Werewolf_Man: 'Werwolf (als Mensch)', Clown: 'Clown',
      ToySoldier: 'Spielzeugsoldat', SpaceRanger: 'Astronaut', Ninja: 'Ninja', Engineer: 'Tüftler', Lorekeeper: 'Gelehrter',
      Knight: 'Ritter', Paladin: 'Paladin', Ranger: 'Waldläufer', Rogue: 'Abenteurerin', Rogue_Hooded: 'Kapuzen-Abenteurerin',
      Barbarian: 'Barbar', Druid: 'Druidin', Cleric: 'Heiler', Vampire: 'Vampir', Tiefling: 'Teufelchen',
      PlantWarrior: 'Pflanzenwesen', AvianSwordsman: 'Vogelwesen', OrcRaider: 'Ork', Werewolf_Wolf: 'Werwolf',
      MonsterCostume: 'Dino-Kostüm', Robot_One: 'Roboter Eins', Robot_Two: 'Roboter Zwei', Skeleton_Minion: 'Skelett',
      Skeleton_Warrior: 'Skelett mit Helm', Skeleton_Rogue: 'Skelett mit Kapuze', Skeleton_Mage: 'Skelett-Zauberer', Necromancer: 'Nekromant' },
    hats: { cap: 'Wandermütze', witch: 'Hexenhut', pointy: 'Wichtelmütze', elf: 'Elfenmütze', bear: 'Bärenfell', helmet: 'Ritterhelm',
      clown: 'Clownshut', straw: 'Strohhut', cowboy: 'Cowboyhut', soldier: 'Soldatenhut', wizard: 'Zauberhut', headband: 'Stirnband', space: 'Raumhelm' },
    glassesN: { square: 'eckig', round: 'rund', reading: 'Lesebrille', sun: 'Sonnenbrille', goggles: 'Schutzbrille' },
    backs: { pack: 'Wanderrucksack', packA: 'Schulrucksack', packB: 'Sportrucksack', satchel: 'Kräutertasche', tools: 'Werkzeugrucksack',
      books: 'Bücherrucksack', warpack: 'Ork-Rucksack', jetpack: 'Jetpack', key: 'Aufziehschlüssel', wings: 'Flügel',
      cape: 'Heldenumhang', capeKnight: 'Ritterumhang', capeRanger: 'Waldläufer-Umhang', capeRogue: 'Abenteuer-Umhang', capePaladin: 'Paladin-Umhang' },
  },
  es: {
    title: 'Mi personaje', loading: 'Creando personaje …', h1: 'Elige tu personaje', h2: 'Personalízalo',
    groups: { people: 'Personas', fantasy: 'Fantasía', monsters: 'Monstruos y robots' },
    hat: 'Gorro', glasses: 'Gafas', back: 'Espalda', skin: 'Piel', hair: 'Pelo', main: 'Color principal',
    legs: 'Pantalón', acc: 'Color de accesorios', own: '★ Original', none: 'nada', noHat: 'aquí no cabe', orig: 'Original',
    rand: '🎲 Al azar', reset: 'Reiniciar', save: 'Guardar', saved: 'Guardado ✓ – tu personaje está en este dispositivo.',
    spin: '🔄 Girar', idle: 'Quieto', walk: 'Caminar', wave: 'Saludar', jump: 'Celebrar',
    chars: { Protagonist_A: 'Estudiante', Protagonist_B: 'Estudiante 2', Hiker: 'Excursionista', Witch: 'Bruja', Superhero: 'Superhéroe',
      MagicalGirl: 'Chica mágica', Helper_A: 'Duende', Helper_B: 'Elfo', Caveman: 'Cavernícola', Farmer_A: 'Granjero',
      Farmer_B: 'Granjera', Driver: 'Piloto', Survivalist: 'Aventurero', Werewolf_Man: 'Hombre lobo (humano)', Clown: 'Payaso',
      ToySoldier: 'Soldadito de juguete', SpaceRanger: 'Astronauta', Ninja: 'Ninja', Engineer: 'Inventor', Lorekeeper: 'Sabio',
      Knight: 'Caballero', Paladin: 'Paladín', Ranger: 'Explorador', Rogue: 'Aventurera', Rogue_Hooded: 'Aventurera con capucha',
      Barbarian: 'Bárbaro', Druid: 'Druida', Cleric: 'Sanador', Vampire: 'Vampiro', Tiefling: 'Diablillo',
      PlantWarrior: 'Ser planta', AvianSwordsman: 'Ser pájaro', OrcRaider: 'Orco', Werewolf_Wolf: 'Hombre lobo',
      MonsterCostume: 'Disfraz de dino', Robot_One: 'Robot uno', Robot_Two: 'Robot dos', Skeleton_Minion: 'Esqueleto',
      Skeleton_Warrior: 'Esqueleto con casco', Skeleton_Rogue: 'Esqueleto con capucha', Skeleton_Mage: 'Esqueleto mago', Necromancer: 'Nigromante' },
    hats: { cap: 'Gorro de excursión', witch: 'Sombrero de bruja', pointy: 'Gorro de duende', elf: 'Gorro de elfo', bear: 'Piel de oso',
      helmet: 'Casco', clown: 'Sombrero de payaso', straw: 'Sombrero de paja', cowboy: 'Sombrero vaquero', soldier: 'Gorro de soldado',
      wizard: 'Sombrero de mago', headband: 'Cinta', space: 'Casco espacial' },
    glassesN: { square: 'cuadradas', round: 'redondas', reading: 'de lectura', sun: 'de sol', goggles: 'protectoras' },
    backs: { pack: 'Mochila de excursión', packA: 'Mochila escolar', packB: 'Mochila deportiva', satchel: 'Bolsa de hierbas',
      tools: 'Mochila de herramientas', books: 'Mochila de libros', warpack: 'Mochila de orco', jetpack: 'Mochila cohete',
      key: 'Llave de cuerda', wings: 'Alas', cape: 'Capa de héroe', capeKnight: 'Capa de caballero', capeRanger: 'Capa de explorador',
      capeRogue: 'Capa de aventura', capePaladin: 'Capa de paladín' },
  },
}[LANG];
document.documentElement.lang = LANG;
document.title = `Krabsy – ${T.title}`;
const $ = (id) => document.getElementById(id);
$('title').textContent = T.title; $('h1').textContent = T.h1; $('h2').textContent = T.h2;

const KEY = 'krabsy_figure_v2';
let cfg = normalize((() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } })() || DEFAULT);
let info = null;          // what this character offers (charInfo)

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

// Turning: off by default (owner: the constant turning was annoying); the 🔄 button turns
// it on and off, dragging always works.
let drag = null, spinning = false, yaw = 0.4;
canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (drag != null) { yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
canvas.addEventListener('pointerup', () => { drag = null; });

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
  mixer.clipAction(clips[CLIPS[name]]).reset().setLoop(THREE.LoopRepeat, Infinity).play();
  document.querySelectorAll('#bar button[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === name));
}
for (const k of Object.keys(CLIPS)) {
  const b = document.createElement('button'); b.dataset.a = k; b.textContent = T[k];
  b.addEventListener('click', () => play(k)); $('bar').appendChild(b);
}
const spinBtn = document.createElement('button');
spinBtn.id = 'spinBtn'; spinBtn.textContent = T.spin; spinBtn.setAttribute('aria-pressed', 'false');
spinBtn.addEventListener('click', () => {
  spinning = !spinning; spinBtn.classList.toggle('on', spinning); spinBtn.setAttribute('aria-pressed', String(spinning));
});
const sep = document.createElement('span'); sep.className = 'sep';
$('bar').append(sep, spinBtn);

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  if (spinning && drag == null) yaw += 0.5 * dt;
  turn.rotation.y = yaw;
  mixer?.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ step 1: the character
let group = CHARS.find((c) => c.id === cfg.char)?.group || 'people';
function renderTabs() {
  $('tabs').innerHTML = '';
  for (const g of GROUPS) {
    const b = document.createElement('button'); b.textContent = T.groups[g]; b.classList.toggle('on', g === group);
    b.addEventListener('click', () => { group = g; renderTabs(); renderGallery(); });
    $('tabs').appendChild(b);
  }
}
function renderGallery() {
  $('gallery').innerHTML = '';
  for (const c of CHARS.filter((x) => x.group === group)) {
    const b = document.createElement('button'); b.className = 'pic' + (c.id === cfg.char ? ' on' : '');
    b.title = T.chars[c.id]; b.dataset.char = c.id;
    b.innerHTML = `<img src="assets/portraits/${c.id}.png" alt="${T.chars[c.id]}" loading="lazy">`;
    b.addEventListener('click', () => chooseChar(c.id));
    $('gallery').appendChild(b);
  }
}
// A new character starts plain: its own accessories, its own colours.
async function chooseChar(id) {
  cfg = normalize({ ...DEFAULT, char: id });
  renderGallery();
  await refreshInfo();
  changed();
}

// ------------------------------------------------------------------ step 2: customise
function cycleRow(key, label, list, names, ownKey) {
  const div = document.createElement('div'); div.className = 'slot';
  div.innerHTML = `<h3>${label}</h3><div class="cycle"><button aria-label="‹">‹</button><span></span><button aria-label="›">›</button></div>`;
  const [prev, next] = div.querySelectorAll('button'), span = div.querySelector('span');
  // Options: ★ the character's own (if it has one), nothing, then the catalogue.
  const options = () => [...(info?.[ownKey] ? ['own', 'none'] : ['own']), ...Object.keys(list)];
  const label_ = (v) => (v === 'own' ? (info?.[ownKey] ? T.own : T.none) : v === 'none' ? T.none : names[v]);
  div.show = () => {
    const off = key === 'hat' && info && !info.hats;
    div.classList.toggle('off', !!off);
    span.textContent = off ? T.noHat : label_(cfg[key]);
  };
  const step = (d) => {
    if (div.classList.contains('off')) return;
    const o = options(), i = Math.max(0, o.indexOf(cfg[key]));
    cfg = normalize({ ...cfg, [key]: o[(i + d + o.length) % o.length] });
    div.show(); changed();
  };
  prev.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
  return div;
}
function swatchRow(key, label, palette) {
  const div = document.createElement('div'); div.className = 'slot';
  div.innerHTML = `<h3>${label}</h3><div class="swatches"></div>`;
  const box = div.querySelector('.swatches');
  const btns = [-1, ...palette.keys()].map((i) => {
    const b = document.createElement('button'); b.className = 'sw' + (i < 0 ? ' orig' : ''); b.title = i < 0 ? T.orig : palette[i];
    if (i >= 0) b.style.background = palette[i]; else b.textContent = '★';
    b.addEventListener('click', () => { cfg = normalize({ ...cfg, [key]: i }); div.show(); changed(); });
    box.appendChild(b); return b;
  });
  div.show = () => btns.forEach((b, j) => b.classList.toggle('on', j - 1 === cfg[key]));
  return div;
}
const rows = {
  hat: cycleRow('hat', T.hat, HATS, T.hats, 'ownHat'),
  glasses: cycleRow('glasses', T.glasses, GLASSES, T.glassesN, 'ownGlasses'),
  back: cycleRow('back', T.back, BACKS, T.backs, 'ownBack'),
  skin: swatchRow('skin', T.skin, SKIN),
  hair: swatchRow('hair', T.hair, HAIR),
  main: swatchRow('main', T.main, COLORS),
  legs: swatchRow('legs', T.legs, COLORS),
  acc: swatchRow('acc', T.acc, COLORS),
};
Object.values(rows).forEach((r) => $('slots').appendChild(r));
function showAll() {
  Object.values(rows).forEach((r) => r.show());
  rows.skin.classList.toggle('hidden', !info?.skin);       // only for human skin
  rows.hair.classList.toggle('hidden', !info?.hair);
  $('charName').textContent = T.chars[cfg.char];
}
async function refreshInfo() { info = await charInfo(cfg.char); showAll(); }

let timer = 0;
function changed() { $('saved').textContent = ''; showAll(); clearTimeout(timer); timer = setTimeout(rebuild, 60); }

$('randBtn').textContent = T.rand; $('resetBtn').textContent = T.reset; $('saveBtn').textContent = T.save;
// Random: keeps the chosen character, shuffles its accessories and colours.
$('randBtn').addEventListener('click', async () => { cfg = randomConfig(cfg.char); await refreshInfo(); changed(); });
$('resetBtn').addEventListener('click', () => chooseChar(cfg.char));
$('saveBtn').addEventListener('click', () => {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); $('saved').textContent = T.saved; } catch (_) { /* private mode */ }
});

renderTabs(); renderGallery();
refreshInfo().then(rebuild).catch((e) => { console.error(e); $('loading').textContent = String(e.message || e); });
window.__fb = {
  view(y) { yaw = y; }, get spinning() { return spinning; }, get cfg() { return cfg; },
  async set(v) { cfg = normalize(v); group = CHARS.find((c) => c.id === cfg.char)?.group || group; renderTabs(); renderGallery(); await refreshInfo(); changed(); },
  get fig() { return fig; }, get info() { return info; },
};
