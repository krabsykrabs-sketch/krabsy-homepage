// "Meine Figur" / "Mi personaje" / "My figure" — the figure builder page
// (/de/meine-figur/, /es/mi-personaje/, /en/my-figure/).
// The live 3D figure on one side, four tabs on the other (owner request 2026-11-25):
//   1 the character (all of them, in three sections), 2 accessories (hat, glasses, back
//   item: a grid of pictures per slot, ★ = the character's own), 3 skin + hair colours,
//   4 clothing colours.
// Locked characters and accessories show a lock and a price in shells; they can be tried
// on, and are unlocked with shells (krabsy-shells.js) before the figure can be saved.
// Colours are always free. Accessory pictures: tools/render_accessory_thumbs.cjs.
// From the prototype games/figure-builder/src/builder.js (2026-11-25).
import * as THREE from 'three';
import { CHARS, GROUPS, HATS, GLASSES, BACKS, SKIN, HAIR, COLORS, DEFAULT, ASSET_BASE, normalize,
  buildFigure, loadClips, charInfo, priceOf, isUnlocked, lockedParts, unlockId,
  readSavedFigure, saveFigure, playerConfig } from './krabsy-figure.js?v=2026-11-25c';
import { getShells, unlock, onShellsChange } from './krabsy-shells.js';

const LANG = (location.pathname.match(/^\/(de|es|en)\//) || [])[1] || 'de';
const T = {
  de: {
    loading: 'Figur wird gebaut …', tabsLabel: 'Figur gestalten',
    tabs: { char: 'Figur wählen', items: 'Zubehör', skin: 'Haut & Haare', clothes: 'Kleidung' },
    noSkin: 'Bei dieser Figur gibt es keine Haut- und Haarfarbe zum Ändern. Schau bei „Kleidung“ vorbei!',
    groups: { people: 'Menschen', fantasy: 'Fantasy', monsters: 'Monster & Roboter' },
    hat: 'Kopfbedeckung', glasses: 'Brille', back: 'Rücken', skin: 'Hautfarbe', hair: 'Haarfarbe',
    main: 'Hauptfarbe', legs: 'Zweite Farbe', acc: 'Farbe vom Zubehör',
    own: '★ Original', none: 'nichts', noHat: 'Eine andere Kopfbedeckung passt bei dieser Figur nicht.', orig: 'Original',
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
    loading: 'Creando personaje …', tabsLabel: 'Crear personaje',
    tabs: { char: 'Elige personaje', items: 'Accesorios', skin: 'Piel y pelo', clothes: 'Ropa' },
    noSkin: 'Este personaje no tiene color de piel ni de pelo para cambiar. ¡Mira en «Ropa»!',
    groups: { people: 'Personas', fantasy: 'Fantasía', monsters: 'Monstruos y robots' },
    hat: 'Gorro', glasses: 'Gafas', back: 'Espalda', skin: 'Piel', hair: 'Pelo', main: 'Color principal',
    legs: 'Segundo color', acc: 'Color de accesorios', own: '★ Original', none: 'nada', noHat: 'A este personaje no le queda otro gorro.', orig: 'Original',
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
    loading: 'Building your figure …', tabsLabel: 'Build your figure',
    tabs: { char: 'Choose figure', items: 'Accessories', skin: 'Skin & hair', clothes: 'Clothes' },
    noSkin: 'This figure has no skin or hair colour to change. Have a look at “Clothes”!',
    groups: { people: 'People', fantasy: 'Fantasy', monsters: 'Monsters & robots' },
    hat: 'Hat', glasses: 'Glasses', back: 'Back', skin: 'Skin', hair: 'Hair', main: 'Main colour',
    legs: 'Second colour', acc: 'Accessory colour', own: '★ Original', none: 'nothing', noHat: 'Another hat doesn’t fit this figure.', orig: 'Original',
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
function refreshLocks() { renderLocks(); invalidate('char', 'items'); showAll(); }
onShellsChange((s) => {                        // earned in another tab, or spent here
  const grew = s.balance > shells.balance;
  shells = s; renderWallet(grew); refreshLocks();
});

// ------------------------------------------------------------------ the four tabs
// Each tab's content is built the first time the tab is opened (so the portraits and the
// accessory pictures load only when they are looked at) and again when what it shows has
// changed (another character, something unlocked). sync() only moves the selection marks.
const TABS = ['char', 'items', 'skin', 'clothes'];
const TAB_ICON = { char: '🧑', items: '🎩', skin: '🎨', clothes: '👕' };
const tablist = $('mfTabs'), panesBox = $('mfPanes');
tablist.setAttribute('aria-label', T.tabsLabel);
let tab = 'char';
const panes = {};
for (const name of TABS) {
  const b = el('button', 'mf-tab'); b.type = 'button'; b.id = `mfTab-${name}`; b.dataset.tab = name;
  b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', `mfPane-${name}`);
  const ic = el('span', 'mf-tab-ic', TAB_ICON[name]); ic.setAttribute('aria-hidden', 'true');
  b.append(ic, el('span', 'mf-tab-label', T.tabs[name]));
  b.addEventListener('click', () => openTab(name));
  tablist.appendChild(b);
  const p = el('div', 'mf-pane'); p.id = `mfPane-${name}`; p.setAttribute('role', 'tabpanel');
  p.setAttribute('aria-labelledby', b.id); p.tabIndex = 0; p.hidden = true;
  panesBox.appendChild(p);
  panes[name] = { btn: b, el: p, dirty: true, render() {}, sync() {} };
}
// Arrow keys move between the tabs (and open them), Home / End jump to the first / last.
tablist.addEventListener('keydown', (e) => {
  const i = TABS.indexOf(e.target?.dataset?.tab);
  if (i < 0) return;
  const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
  if (to == null) return;
  e.preventDefault();
  const name = TABS[(to + TABS.length) % TABS.length];
  openTab(name); panes[name].btn.focus();
});
function openTab(name) {
  const moved = name !== tab;
  tab = name;
  for (const n of TABS) {
    const on = n === tab;
    panes[n].btn.classList.toggle('on', on);
    panes[n].btn.setAttribute('aria-selected', String(on));
    panes[n].btn.tabIndex = on ? 0 : -1;
    panes[n].el.hidden = !on;
  }
  refresh();
  if (!moved) return;
  // Start the new tab at its top: the panel's own scroller on wide screens, the page on
  // phones (only when the old tab was scrolled past the sticky tab bar).
  panesBox.scrollTop = 0;
  if (getComputedStyle(panesBox).overflowY !== 'visible') return;
  const hdr = document.querySelector('header.k-page-header')?.offsetHeight || 0;
  const stuck = getComputedStyle(stage).position === 'sticky';
  const top = stuck
    ? panesBox.getBoundingClientRect().top + scrollY - (hdr + stage.offsetHeight + tablist.offsetHeight)
    : tablist.getBoundingClientRect().top + scrollY - hdr;
  if (scrollY > top + 1) scrollTo({ top, behavior: 'instant' });
}
const invalidate = (...names) => names.forEach((n) => { panes[n].dirty = true; });
function refresh() {
  const p = panes[tab];
  if (p.dirty) { p.dirty = false; p.render(); }
  p.sync();
}
const section = (title) => {
  const s = el('section', 'mf-sec'); s.appendChild(el('h3', '', title)); return s;
};
// One tile: a picture (or a sign), a lock with the price when it is locked, maybe a name.
function tile({ slot, id, name, img, sign, caption, star }) {
  const price = priceOf(slot, id), open = unlocked(slot, id);
  const b = el('button', 'mf-tile' + (open ? '' : ' locked')); b.type = 'button';
  b.dataset.slot = slot; b.dataset.id = id; b.title = name;
  b.setAttribute('aria-label', open ? name : `${name}, ${T.locked}, ${price} ${T.shells}`);
  const pic = el('span', 'mf-tile-pic');
  if (img) {
    const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.width = 192; i.height = 192;
    pic.appendChild(i);
  } else pic.appendChild(el('span', 'mf-tile-sign', sign));
  if (star) pic.appendChild(el('span', 'mf-tile-star', '★'));
  if (!open) pic.append(el('span', 'mf-tile-lock', '🔒'), el('span', 'mf-tile-price', `🐚 ${price}`));
  b.appendChild(pic);
  if (caption) b.appendChild(el('span', 'mf-tile-name', caption));
  return b;
}
const markTiles = (root, isOn) => root.querySelectorAll('.mf-tile').forEach((b) => {
  const on = isOn(b.dataset.slot, b.dataset.id);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
});
// Free and unlocked entries first, then the locked ones, cheapest first.
const byPrice = (slot, ids) => ids.map((id, i) => [id, i, unlocked(slot, id) ? 0 : priceOf(slot, id)])
  .sort((a, b) => a[2] - b[2] || a[1] - b[1]).map((x) => x[0]);

// ---- tab 1: the character (all of them, in three sections)
panes.char.render = () => {
  const box = panes.char.el; box.textContent = '';
  for (const g of GROUPS) {
    const sec = section(T.groups[g]), grid = el('div', 'mf-grid chars');
    for (const id of byPrice('char', CHARS.filter((c) => c.group === g).map((c) => c.id))) {
      const b = tile({ slot: 'char', id, name: T.chars[id], img: `${ASSET_BASE}portraits/${id}.webp` });
      b.addEventListener('click', () => chooseChar(id));
      grid.appendChild(b);
    }
    sec.appendChild(grid); box.appendChild(sec);
  }
};
panes.char.sync = () => markTiles(panes.char.el, (_, id) => id === cfg.char);
// A new character starts plain: its own accessories, its own colours. A second tap on a
// locked character asks to unlock it.
async function chooseChar(id, again) {
  if (id === cfg.char && !again) { if (!unlocked('char', id)) askUnlock('char', id); return; }
  cfg = normalize({ ...DEFAULT, char: id });
  invalidate('items');
  panes.char.sync();
  await refreshInfo();
  changed();
}

// ---- tab 2: accessories (hat, glasses, back), a grid of pictures per slot
const ITEM_SLOTS = [['hat', HATS, 'ownHat'], ['glasses', GLASSES, 'ownGlasses'], ['back', BACKS, 'ownBack']];
// The catalogue entry that is this character's own accessory (the Hiker's cap), if any:
// it gives "★ Original" its picture, and is not offered a second time with a price.
const ownKey = (list, char) => Object.keys(list).find((k) => list[k][0] === char) || null;
panes.items.render = () => {
  const box = panes.items.el; box.textContent = '';
  if (!info) { panes.items.dirty = true; return; }
  for (const [slot, list, ownFlag] of ITEM_SLOTS) {
    const sec = section(T[slot]);
    if (slot === 'hat' && !info.hats) {                       // head shape no other hat fits
      sec.appendChild(el('p', 'mf-note', T.noHat)); box.appendChild(sec); continue;
    }
    const grid = el('div', 'mf-grid items');
    const twin = info[ownFlag] ? ownKey(list, cfg.char) : null;
    const add = (o) => {
      const b = tile({ slot, ...o });
      b.addEventListener('click', () => chooseItem(slot, o.id));
      grid.appendChild(b);
    };
    // "★ Original" only when the character brings something; "nichts" is then 'none',
    // otherwise 'own' (which is nothing).
    if (info[ownFlag]) add({ id: 'own', name: T.own, caption: T.own, star: !!twin, img: twin && `${ASSET_BASE}items/${slot}-${twin}.webp`, sign: '★' });
    add({ id: info[ownFlag] ? 'none' : 'own', name: T.none, caption: T.none, sign: '∅' });
    for (const id of byPrice(slot, Object.keys(list).filter((k) => k !== twin))) {
      add({ id, name: NAMES[slot][id], caption: NAMES[slot][id], img: `${ASSET_BASE}items/${slot}-${id}.webp` });
    }
    sec.appendChild(grid); box.appendChild(sec);
  }
};
panes.items.sync = () => {
  if (!info) return;
  markTiles(panes.items.el, (slot, id) => {
    const [, list, ownFlag] = ITEM_SLOTS.find((s) => s[0] === slot);
    const v = cfg[slot];
    if (v === id) return true;
    if (id === 'own') return (!info[ownFlag] && v === 'none') || (info[ownFlag] && v === ownKey(list, cfg.char));
    return false;
  });
};
function chooseItem(slot, id) {
  if (cfg[slot] === id) { if (!unlocked(slot, id)) askUnlock(slot, id); return; }
  cfg = normalize({ ...cfg, [slot]: id });
  changed();
}

// ---- tabs 3 and 4: colours (always free)
function swatches(key, label, palette) {
  const sec = section(label), box = el('div', 'mf-swatches');
  for (const i of [-1, ...palette.keys()]) {
    const b = el('button', 'mf-sw' + (i < 0 ? ' orig' : '')); b.type = 'button'; b.dataset.key = key; b.dataset.i = String(i);
    b.title = i < 0 ? T.orig : `${label} ${i + 1}`; b.setAttribute('aria-label', b.title);
    if (i >= 0) b.style.background = palette[i]; else b.textContent = '★';
    b.addEventListener('click', () => { cfg = normalize({ ...cfg, [key]: i }); changed(); });
    box.appendChild(b);
  }
  sec.appendChild(box); return sec;
}
const markSwatches = (root) => root.querySelectorAll('.mf-sw').forEach((b) => {
  const on = Number(b.dataset.i) === cfg[b.dataset.key];
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
});
panes.skin.render = () => {
  const box = panes.skin.el; box.textContent = '';
  if (!info) { panes.skin.dirty = true; return; }
  if (!info.skin) { box.appendChild(el('p', 'mf-note', T.noSkin)); return; }      // robots, skeletons …
  box.append(swatches('skin', T.skin, SKIN), swatches('hair', T.hair, HAIR));
};
panes.skin.sync = () => markSwatches(panes.skin.el);
panes.clothes.render = () => {
  const box = panes.clothes.el; box.textContent = '';
  box.append(swatches('main', T.main, COLORS), swatches('legs', T.legs, COLORS), swatches('acc', T.acc, COLORS));
};
panes.clothes.sync = () => markSwatches(panes.clothes.el);

function status(text, kind) { const s = $('mfSaved'); s.textContent = text; s.className = 'mf-saved' + (kind ? ` ${kind}` : ''); }
function showAll() {
  refresh();
  $('mfCharName').textContent = T.chars[cfg.char];
  const locked = lockedParts(cfg, shells.owned).length > 0;
  $('mfSave').disabled = locked;
  $('mfSave').classList.toggle('dirty', !locked && JSON.stringify(cfg) !== savedJson);
}
let infoFor = null;
async function refreshInfo() {
  const char = cfg.char, next = await charInfo(char);
  if (char !== cfg.char) return;                              // a newer choice won
  if (infoFor !== char) invalidate('items', 'skin');
  info = next; infoFor = char; showAll();
}

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
$('mfReset').addEventListener('click', () => chooseChar(cfg.char, true));
$('mfSave').addEventListener('click', () => {
  shells = getShells();
  if (lockedParts(cfg, shells.owned).length) { changed(); return; }      // a locked part is never saved
  if (saveFigure(cfg)) { savedJson = JSON.stringify(cfg); showAll(); status(T.saved, 'ok'); }
});

renderWallet(false); openTab('char'); renderLocks();
refreshInfo().then(rebuild).catch(showError);

// For QA scripts (tools / headless checks).
window.__mf = {
  view(y) { yaw = y; }, get cfg() { return cfg; }, get fig() { return fig; }, get info() { return info; },
  async set(v) { cfg = normalize(v); await refreshInfo(); changed(); },
  tab: openTab, get tabName() { return tab; },
};
