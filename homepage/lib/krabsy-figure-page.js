// "Meine Figur" / "Mi personaje" / "My figure" — the figure builder page
// (/de/meine-figur/, /es/mi-personaje/, /en/my-figure/).
// Step 1: pick a character (picture gallery, three groups). Step 2: customise it: hat,
// glasses, back item (★ = the character's own) and colours. Locked characters and
// accessories show a lock and a price in shells; they can be tried on, and are unlocked
// with shells (krabsy-shells.js) before the figure can be saved. Colours are always free.
// From the prototype games/figure-builder/src/builder.js (2026-11-25).
import * as THREE from 'three';
import { CHARS, GROUPS, HATS, GLASSES, BACKS, SKIN, HAIR, COLORS, DEFAULT, ASSET_BASE, normalize,
  buildFigure, loadClips, charInfo, priceOf, isUnlocked, lockedParts, unlockId,
  readSavedFigure, saveFigure, playerConfig } from './krabsy-figure.js';
import { getShells, unlock, onShellsChange } from './krabsy-shells.js';

const LANG = (location.pathname.match(/^\/(de|es|en)\//) || [])[1] || 'de';
const T = {
  de: {
    loading: 'Figur wird gebaut …', h1: 'Wähle deine Figur', h2: 'Gestalte sie',
    groups: { people: 'Menschen', fantasy: 'Fantasy', monsters: 'Monster & Roboter' },
    hat: 'Kopfbedeckung', glasses: 'Brille', back: 'Rücken', skin: 'Hautfarbe', hair: 'Haarfarbe',
    main: 'Hauptfarbe', legs: 'Hosenfarbe', acc: 'Farbe vom Zubehör',
    own: '★ Original', none: 'nichts', noHat: 'passt hier nicht', orig: 'Original',
    rand: '🎲 Zufall', reset: 'Zurücksetzen', save: 'Speichern',
    saved: 'Gespeichert ✓ Deine Figur ist auf diesem Gerät.', unsaved: 'Noch nicht gespeichert.',
    lockedSave: 'Erst freischalten 🔒, dann speichern.',
    spin: 'Drehen', idle: 'Stehen', walk: 'Laufen', wave: 'Winken', jump: 'Jubeln',
    shells: 'Muscheln', locked: 'gesperrt',
    buyTitle: '{name} freischalten?', buyBody: 'Das kostet 🐚 {price}. Du hast 🐚 {balance}.',
    buyYes: 'Freischalten', buyNo: 'Lieber nicht',
    needTitle: 'Noch nicht genug Muscheln',
    needBody: 'Für „{name}“ brauchst du 🐚 {price}. Dir fehlen noch 🐚 {missing}. Muscheln bekommst du für jede richtige Antwort, in allen Spielen und Übungen.',
    needGo: 'Zu den Spielen', ok: 'OK', unlocked: 'Freigeschaltet: {name} 🎉',
    gamesUrl: '/de/spiele/',
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
    glassesN: { square: 'Eckige Brille', round: 'Runde Brille', reading: 'Lesebrille', sun: 'Sonnenbrille', goggles: 'Schutzbrille' },
    backs: { pack: 'Wanderrucksack', packA: 'Schulrucksack', packB: 'Sportrucksack', satchel: 'Kräutertasche', tools: 'Werkzeugrucksack',
      books: 'Bücherrucksack', warpack: 'Ork-Rucksack', jetpack: 'Jetpack', key: 'Aufziehschlüssel', wings: 'Flügel',
      cape: 'Heldenumhang', capeKnight: 'Ritterumhang', capeRanger: 'Waldläufer-Umhang', capeRogue: 'Abenteuer-Umhang', capePaladin: 'Paladin-Umhang' },
  },
  es: {
    loading: 'Creando personaje …', h1: 'Elige tu personaje', h2: 'Personalízalo',
    groups: { people: 'Personas', fantasy: 'Fantasía', monsters: 'Monstruos y robots' },
    hat: 'Gorro', glasses: 'Gafas', back: 'Espalda', skin: 'Piel', hair: 'Pelo', main: 'Color principal',
    legs: 'Pantalón', acc: 'Color de accesorios', own: '★ Original', none: 'nada', noHat: 'aquí no cabe', orig: 'Original',
    rand: '🎲 Al azar', reset: 'Reiniciar', save: 'Guardar',
    saved: 'Guardado ✓ Tu personaje está en este dispositivo.', unsaved: 'Todavía sin guardar.',
    lockedSave: 'Primero desbloquea 🔒, luego guarda.',
    spin: 'Girar', idle: 'Quieto', walk: 'Caminar', wave: 'Saludar', jump: 'Celebrar',
    shells: 'caracolas', locked: 'bloqueado',
    buyTitle: '¿Desbloquear «{name}»?', buyBody: 'Cuesta 🐚 {price}. Tienes 🐚 {balance}.',
    buyYes: 'Desbloquear', buyNo: 'Mejor no',
    needTitle: 'Todavía te faltan caracolas',
    needBody: 'Para «{name}» necesitas 🐚 {price}. Te faltan 🐚 {missing}. Ganas caracolas con cada respuesta correcta, en todos los juegos y ejercicios.',
    needGo: 'Ir a los juegos', ok: 'OK', unlocked: 'Desbloqueado: {name} 🎉',
    gamesUrl: '/es/juegos/',
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
    glassesN: { square: 'Gafas cuadradas', round: 'Gafas redondas', reading: 'Gafas de lectura', sun: 'Gafas de sol', goggles: 'Gafas protectoras' },
    backs: { pack: 'Mochila de excursión', packA: 'Mochila escolar', packB: 'Mochila deportiva', satchel: 'Bolsa de hierbas',
      tools: 'Mochila de herramientas', books: 'Mochila de libros', warpack: 'Mochila de orco', jetpack: 'Mochila cohete',
      key: 'Llave de cuerda', wings: 'Alas', cape: 'Capa de héroe', capeKnight: 'Capa de caballero', capeRanger: 'Capa de explorador',
      capeRogue: 'Capa de aventura', capePaladin: 'Capa de paladín' },
  },
  en: {
    loading: 'Building your figure …', h1: 'Pick your figure', h2: 'Make it yours',
    groups: { people: 'People', fantasy: 'Fantasy', monsters: 'Monsters & robots' },
    hat: 'Hat', glasses: 'Glasses', back: 'Back', skin: 'Skin', hair: 'Hair', main: 'Main colour',
    legs: 'Trousers', acc: 'Accessory colour', own: '★ Original', none: 'nothing', noHat: "doesn't fit here", orig: 'Original',
    rand: '🎲 Random', reset: 'Reset', save: 'Save',
    saved: 'Saved ✓ Your figure is on this device.', unsaved: 'Not saved yet.',
    lockedSave: 'Unlock 🔒 first, then save.',
    spin: 'Turn', idle: 'Stand', walk: 'Walk', wave: 'Wave', jump: 'Cheer',
    shells: 'shells', locked: 'locked',
    buyTitle: 'Unlock “{name}”?', buyBody: 'It costs 🐚 {price}. You have 🐚 {balance}.',
    buyYes: 'Unlock', buyNo: 'Not now',
    needTitle: 'Not enough shells yet',
    needBody: 'You need 🐚 {price} for “{name}”. You are 🐚 {missing} short. You get shells for every right answer, in all games and exercises.',
    needGo: 'To the games', ok: 'OK', unlocked: 'Unlocked: {name} 🎉',
    gamesUrl: '/en/spanish/games/',
    chars: { Protagonist_A: 'Schoolgirl', Protagonist_B: 'Schoolboy', Hiker: 'Hiker', Witch: 'Witch', Superhero: 'Superhero',
      MagicalGirl: 'Magical girl', Helper_A: 'Gnome', Helper_B: 'Elf', Caveman: 'Caveman', Farmer_A: 'Farmer',
      Farmer_B: 'Rancher', Driver: 'Racing driver', Survivalist: 'Adventurer', Werewolf_Man: 'Werewolf (human)', Clown: 'Clown',
      ToySoldier: 'Toy soldier', SpaceRanger: 'Astronaut', Ninja: 'Ninja', Engineer: 'Inventor', Lorekeeper: 'Scholar',
      Knight: 'Knight', Paladin: 'Paladin', Ranger: 'Ranger', Rogue: 'Explorer', Rogue_Hooded: 'Hooded explorer',
      Barbarian: 'Barbarian', Druid: 'Druid', Cleric: 'Healer', Vampire: 'Vampire', Tiefling: 'Little devil',
      PlantWarrior: 'Plant creature', AvianSwordsman: 'Bird creature', OrcRaider: 'Orc', Werewolf_Wolf: 'Werewolf',
      MonsterCostume: 'Dino costume', Robot_One: 'Robot One', Robot_Two: 'Robot Two', Skeleton_Minion: 'Skeleton',
      Skeleton_Warrior: 'Skeleton with helmet', Skeleton_Rogue: 'Hooded skeleton', Skeleton_Mage: 'Skeleton wizard', Necromancer: 'Necromancer' },
    hats: { cap: 'Hiking cap', witch: 'Witch’s hat', pointy: 'Gnome hat', elf: 'Elf hat', bear: 'Bear fur', helmet: 'Knight’s helmet',
      clown: 'Clown hat', straw: 'Straw hat', cowboy: 'Cowboy hat', soldier: 'Soldier’s hat', wizard: 'Wizard’s hat', headband: 'Headband', space: 'Space helmet' },
    glassesN: { square: 'Square glasses', round: 'Round glasses', reading: 'Reading glasses', sun: 'Sunglasses', goggles: 'Goggles' },
    backs: { pack: 'Hiking backpack', packA: 'School backpack', packB: 'Sports backpack', satchel: 'Herb bag', tools: 'Tool backpack',
      books: 'Book backpack', warpack: 'Orc pack', jetpack: 'Jetpack', key: 'Wind-up key', wings: 'Wings',
      cape: 'Hero’s cape', capeKnight: 'Knight’s cape', capeRanger: 'Ranger’s cape', capeRogue: 'Explorer’s cape', capePaladin: 'Paladin’s cape' },
  },
}[LANG];
const NAMES = { char: T.chars, hat: T.hats, glasses: T.glassesN, back: T.backs };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
$('mfH1').textContent = T.h1; $('mfH2').textContent = T.h2;

// The saved figure; anything in it that is (no longer) unlocked falls back to the free version.
let cfg = normalize(playerConfig() || DEFAULT);
let savedJson = readSavedFigure() ? JSON.stringify(cfg) : null;
let info = null;          // what this character offers (charInfo)
let shells = getShells();
const unlocked = (slot, id) => isUnlocked(slot, id, shells.owned);

// ------------------------------------------------------------------ layout helpers
// The site header is sticky; the stage sticks below it on phones, and on wide screens
// the builder fills the rest of the window.
const app = $('mfApp'), stage = $('mfStage');
function layout() {
  const hdr = document.querySelector('header.k-page-header');
  const h = hdr ? hdr.offsetHeight : 0;
  document.documentElement.style.setProperty('--mf-hdr', `${h}px`);
  const top = app.getBoundingClientRect().top + scrollY;
  document.documentElement.style.setProperty('--mf-app-h', `${Math.max(480, Math.min(820, innerHeight - top - 14))}px`);
}

// ------------------------------------------------------------------ 3D preview
const canvas = $('mfCanvas');
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
  layout();
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.position.z = 6.2 * Math.max(1, 1.08 / camera.aspect);       // narrow stage: step back, keep the ring in view
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
try { new ResizeObserver(resize).observe(stage); new ResizeObserver(layout).observe(document.querySelector('header.k-page-header')); } catch (_) { /* old browser */ }
resize();

// Turning: off by default (owner: the constant turning was annoying); the 🔄 button turns
// it on and off, dragging always works (horizontal drags only, so the page still scrolls).
let drag = null, spinning = false, yaw = 0.4;
canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
canvas.addEventListener('pointermove', (e) => { if (drag != null) { yaw += (e.clientX - drag) * 0.012; drag = e.clientX; } });
const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

// ------------------------------------------------------------------ figure + animation
let fig = null, mixer = null, clips = null, anim = 'idle', building = 0, cheer = 0;
const CLIPS = { idle: 'Idle_A', walk: 'Walking_A', wave: 'Interact', jump: 'Jump_Full_Short' };
async function rebuild() {
  const my = ++building;
  $('mfLoading').textContent = fig ? '' : T.loading;
  const next = await buildFigure(cfg);
  clips ||= await loadClips();
  if (my !== building) { next.dispose(); return; }          // a newer change won
  if (fig) { turn.remove(fig.root); fig.dispose(); }
  fig = next; turn.add(fig.root);
  mixer = new THREE.AnimationMixer(fig.root);
  play(anim);
  $('mfLoading').textContent = '';
}
function play(name) {
  anim = name;
  if (!mixer || !clips) return;
  mixer.stopAllAction();
  mixer.clipAction(clips[CLIPS[name]]).reset().setLoop(THREE.LoopRepeat, Infinity).play();
  document.querySelectorAll('#mfBar button[data-a]').forEach((b) => b.classList.toggle('on', b.dataset.a === name));
}
for (const k of Object.keys(CLIPS)) {
  const b = el('button', '', T[k]); b.type = 'button'; b.dataset.a = k;
  b.addEventListener('click', () => { clearTimeout(cheer); play(k); }); $('mfBar').appendChild(b);
}
const spinBtn = el('button', 'mf-spin'); spinBtn.type = 'button';
spinBtn.innerHTML = `🔄<span> ${T.spin}</span>`; spinBtn.setAttribute('aria-label', T.spin); spinBtn.setAttribute('aria-pressed', 'false');
spinBtn.addEventListener('click', () => {
  spinning = !spinning; spinBtn.classList.toggle('on', spinning); spinBtn.setAttribute('aria-pressed', String(spinning));
});
$('mfBar').append(spinBtn);

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

// ------------------------------------------------------------------ shells + locks
function renderWallet(pop) {
  const w = $('mfWallet');
  $('mfBalance').textContent = String(shells.balance);
  w.setAttribute('aria-label', `${shells.balance} ${T.shells}`);
  if (pop) { w.classList.remove('is-pop'); void w.offsetWidth; w.classList.add('is-pop'); }
}
// The lock pills on the stage: one per locked part of the figure being tried on.
function renderLocks() {
  const box = $('mfLocks'); box.innerHTML = '';
  for (const p of lockedParts(cfg, shells.owned)) {
    const b = el('button', 'mf-lock' + (shells.balance >= p.price ? ' can' : '')); b.type = 'button';
    b.dataset.slot = p.slot;
    b.setAttribute('aria-label', `${NAMES[p.slot][p.id]}: ${T.buyYes}, ${p.price} ${T.shells}`);
    b.append(el('span', 'mf-lock-name', `🔒 ${NAMES[p.slot][p.id]}`), el('span', 'mf-lock-price', `🐚 ${p.price}`));
    b.addEventListener('click', () => askUnlock(p.slot, p.id));
    box.appendChild(b);
  }
}
function dialog(title, body, buttons) {
  return new Promise((resolve) => {
    const dlg = el('dialog', 'mf-dialog');
    const card = el('div', 'mf-dialog-card');
    const actions = el('div', 'mf-dialog-actions');
    buttons.forEach(([label, value, cls]) => {
      const b = el('button', cls || '', label); b.type = 'button';
      b.addEventListener('click', () => dlg.close(value)); actions.appendChild(b);
    });
    card.append(el('h3', '', title), el('p', '', body), actions);
    dlg.appendChild(card); document.body.appendChild(dlg);
    dlg.addEventListener('close', () => { const v = dlg.returnValue; dlg.remove(); resolve(v); });
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else { dlg.remove(); resolve(window.confirm(`${title}\n\n${body}`) ? buttons[0][1] : ''); }   // very old browsers
  });
}
// Tap on a lock: confirm, pay, own it for good.
async function askUnlock(slot, id) {
  shells = getShells();
  if (unlocked(slot, id)) { refreshLocks(); return; }
  const name = NAMES[slot][id], price = priceOf(slot, id);
  if (shells.balance < price) {
    const v = await dialog(T.needTitle, fill(T.needBody, { name, price, missing: price - shells.balance }),
      [[T.needGo, 'go', 'primary'], [T.ok, '', '']]);
    if (v === 'go') location.href = T.gamesUrl;
    return;
  }
  const v = await dialog(fill(T.buyTitle, { name }), fill(T.buyBody, { price, balance: shells.balance }),
    [[T.buyYes, 'yes', 'primary'], [T.buyNo, '', '']]);
  if (v !== 'yes') return;
  const r = unlock(unlockId(slot, id), price);
  shells = getShells();
  if (!r.ok) { refreshLocks(); return; }
  renderWallet(true); refreshLocks();
  status(fill(T.unlocked, { name }), 'ok');
  // A short cheer, then back to what was playing.
  const back = anim === 'jump' ? 'idle' : anim;
  clearTimeout(cheer); play('jump'); cheer = setTimeout(() => play(back), 1900);
}
function refreshLocks() { renderLocks(); renderGallery(); showAll(); }
onShellsChange((s) => {                        // earned in another tab, or spent here
  const grew = s.balance > shells.balance;
  shells = s; renderWallet(grew); refreshLocks();
});

// ------------------------------------------------------------------ step 1: the character
let group = CHARS.find((c) => c.id === cfg.char)?.group || 'people';
function renderTabs() {
  $('mfTabs').innerHTML = '';
  for (const g of GROUPS) {
    const b = el('button', g === group ? 'on' : '', T.groups[g]); b.type = 'button';
    b.setAttribute('aria-pressed', String(g === group));
    b.addEventListener('click', () => { group = g; renderTabs(); renderGallery(); });
    $('mfTabs').appendChild(b);
  }
}
function renderGallery() {
  const box = $('mfGallery'); box.innerHTML = '';
  // Free and unlocked characters first, then the locked ones, cheapest first.
  const rank = (c) => (unlocked('char', c.id) ? 0 : priceOf('char', c.id));
  const list = CHARS.filter((x) => x.group === group).map((c, i) => [c, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]);
  for (const [c] of list) {
    const name = T.chars[c.id], price = priceOf('char', c.id), open = unlocked('char', c.id);
    const b = el('button', 'mf-pic' + (c.id === cfg.char ? ' on' : '') + (open ? '' : ' locked')); b.type = 'button';
    b.title = name; b.dataset.char = c.id;
    b.setAttribute('aria-label', open ? name : `${name}, ${T.locked}, ${price} ${T.shells}`);
    const img = el('img'); img.src = `${ASSET_BASE}portraits/${c.id}.webp`; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.width = 192; img.height = 192;
    b.appendChild(img);
    if (!open) b.append(el('span', 'mf-pic-lock', '🔒'), el('span', 'mf-pic-price', `🐚 ${price}`));
    b.addEventListener('click', () => chooseChar(c.id));
    box.appendChild(b);
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
  const div = el('div', 'mf-slot');
  div.innerHTML = `<h3></h3><div class="mf-cycle"><button type="button" aria-label="‹">‹</button><button type="button" class="mf-cycle-label"></button><button type="button" aria-label="›">›</button></div>`;
  div.querySelector('h3').textContent = label;
  const [prev, mid, next] = div.querySelectorAll('button');
  // Options: ★ the character's own (if it has one), nothing, then the catalogue.
  const options = () => [...(info?.[ownKey] ? ['own', 'none'] : ['own']), ...Object.keys(list)];
  const label_ = (v) => (v === 'own' ? (info?.[ownKey] ? T.own : T.none) : v === 'none' ? T.none : names[v]);
  div.show = () => {
    const off = key === 'hat' && info && !info.hats;
    const lock = !off && !unlocked(key, cfg[key]);
    div.classList.toggle('off', !!off); div.classList.toggle('locked', lock);
    mid.textContent = '';
    mid.append(el('span', '', off ? T.noHat : (lock ? '🔒 ' : '') + label_(cfg[key])));
    if (lock) mid.append(el('span', 'mf-cycle-price', `🐚 ${priceOf(key, cfg[key])}`));
    mid.disabled = !lock;
  };
  const step = (d) => {
    if (div.classList.contains('off')) return;
    const o = options(), i = Math.max(0, o.indexOf(cfg[key]));
    cfg = normalize({ ...cfg, [key]: o[(i + d + o.length) % o.length] });
    changed();
  };
  prev.addEventListener('click', () => step(-1)); next.addEventListener('click', () => step(1));
  mid.addEventListener('click', () => { if (!unlocked(key, cfg[key])) askUnlock(key, cfg[key]); });
  return div;
}
function swatchRow(key, label, palette) {
  const div = el('div', 'mf-slot');
  div.innerHTML = '<h3></h3><div class="mf-swatches"></div>';
  div.querySelector('h3').textContent = label;
  const box = div.querySelector('.mf-swatches');
  const btns = [-1, ...palette.keys()].map((i) => {
    const b = el('button', 'mf-sw' + (i < 0 ? ' orig' : '')); b.type = 'button';
    b.title = i < 0 ? T.orig : `${label} ${i + 1}`; b.setAttribute('aria-label', b.title);
    if (i >= 0) b.style.background = palette[i]; else b.textContent = '★';
    b.addEventListener('click', () => { cfg = normalize({ ...cfg, [key]: i }); changed(); });
    box.appendChild(b); return b;
  });
  div.show = () => btns.forEach((b, j) => { b.classList.toggle('on', j - 1 === cfg[key]); b.setAttribute('aria-pressed', String(j - 1 === cfg[key])); });
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
Object.values(rows).forEach((r) => $('mfSlots').appendChild(r));

function status(text, kind) { const s = $('mfSaved'); s.textContent = text; s.className = 'mf-saved' + (kind ? ` ${kind}` : ''); }
function showAll() {
  Object.values(rows).forEach((r) => r.show());
  rows.skin.classList.toggle('hidden', !info?.skin);       // only for human skin
  rows.hair.classList.toggle('hidden', !info?.hair);
  $('mfCharName').textContent = T.chars[cfg.char];
  const locked = lockedParts(cfg, shells.owned).length > 0;
  $('mfSave').disabled = locked;
  $('mfSave').classList.toggle('dirty', !locked && JSON.stringify(cfg) !== savedJson);
}
async function refreshInfo() { info = await charInfo(cfg.char); showAll(); }

let timer = 0;
function changed() {
  showAll(); renderLocks();
  const locked = lockedParts(cfg, shells.owned).length > 0;
  status(locked ? T.lockedSave : JSON.stringify(cfg) === savedJson ? '' : T.unsaved, locked ? 'warn' : '');
  clearTimeout(timer); timer = setTimeout(() => rebuild().catch(showError), 60);
}
function showError(e) { console.error(e); $('mfLoading').textContent = String(e?.message || e); }

// Random: keeps the chosen character, shuffles its accessories (only unlocked ones) and colours.
function randomOwned(char) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n) => Math.floor(Math.random() * n);
  const some = (slot, list, pOwn) => (Math.random() < pOwn ? 'own' : pick(['none', ...Object.keys(list).filter((k) => unlocked(slot, k))]));
  return normalize({ char, hat: some('hat', HATS, 0.6), glasses: some('glasses', GLASSES, 0.7), back: some('back', BACKS, 0.5),
    skin: rnd(SKIN.length), hair: rnd(HAIR.length), main: rnd(COLORS.length),
    legs: Math.random() < 0.5 ? -1 : rnd(COLORS.length), acc: Math.random() < 0.5 ? -1 : rnd(COLORS.length) });
}
$('mfRand').textContent = T.rand; $('mfReset').textContent = T.reset; $('mfSave').textContent = T.save;
$('mfRand').addEventListener('click', () => { cfg = randomOwned(cfg.char); changed(); });
$('mfReset').addEventListener('click', () => chooseChar(cfg.char));
$('mfSave').addEventListener('click', () => {
  shells = getShells();
  if (lockedParts(cfg, shells.owned).length) { changed(); return; }      // a locked part is never saved
  if (saveFigure(cfg)) { savedJson = JSON.stringify(cfg); showAll(); status(T.saved, 'ok'); }
});

renderWallet(false); renderTabs(); renderGallery(); renderLocks();
refreshInfo().then(rebuild).catch(showError);

// For QA scripts (tools / headless checks).
window.__mf = {
  view(y) { yaw = y; }, get cfg() { return cfg; }, get fig() { return fig; }, get info() { return info; },
  async set(v) { cfg = normalize(v); group = CHARS.find((c) => c.id === cfg.char)?.group || group; renderTabs(); renderGallery(); await refreshInfo(); changed(); },
};
