// "Meine Figur" / "Mi personaje" / "My figure" — the figure builder page
// (/de/meine-figur/, /es/mi-personaje/, /en/my-figure/).
// The live 3D figure on one side, four tabs on the other (owner request 2026-11-25):
//   1 the character (all of them, in three sections), 2 accessories (hat, glasses, back
//   item: a grid of pictures per slot, a star = the character's own), 3 skin + hair colours,
//   4 clothing colours.
// Rewards instead of a shop (owner decision 2026-11-25): the page shows only what the
// child OWNS: the 12 free figures, each figure's own accessories, all colours, and every
// figure and accessory it was given (krabsy-rewards.js). Of the rest it shows a count
// ("12 von 42 Figuren gesammelt") and one "?" tile per grid that explains how to get more.
// No prices, no locks, no buying. New gifts carry a "Neu" badge until their tab was opened.
// Accessory pictures: tools/render_accessory_thumbs.cjs.
// From the prototype games/figure-builder/src/builder.js (2026-11-25).
import * as THREE from 'three';
import { CHARS, HATS, GLASSES, BACKS, SKIN, HAIR, COLORS, DEFAULT, ASSET_BASE, normalize,
  buildFigure, loadClips, charInfo, isUnlocked, lockedParts, unlockId,
  readSavedFigure, saveFigure, playerConfig } from './krabsy-figure.js?v=2026-11-25d';
import { NAMES as ALL_NAMES, PRICES, parseId } from './krabsy-figure-catalog.js';
import { getShells } from './krabsy-shells.js';
import { currentLang } from './krabsy-lang.js?v=2026-11-27';
import { getRewards, syncRewards, markSeen, unseenGifts, onRewardsChange, SHELLS_PER_GIFT } from './krabsy-rewards.js';

const LANG = currentLang({ supported: Object.keys(ALL_NAMES) });
const T = {
  de: {
    loading: 'Figur wird gebaut …', tabsLabel: 'Figur gestalten',
    tabs: { char: 'Figur wählen', items: 'Zubehör', skin: 'Haut & Haare', clothes: 'Kleidung' },
    noSkin: 'Bei dieser Figur gibt es keine Haut- und Haarfarbe zum Ändern. Schau bei „Kleidung“ vorbei!',
    groups: { people: 'Menschen', fantasy: 'Fantasy', monsters: 'Monster & Roboter' },
    hat: 'Kopfbedeckung', glasses: 'Brille', back: 'Rücken', skin: 'Hautfarbe', hair: 'Haarfarbe',
    main: 'Hauptfarbe', legs: 'Zweite Farbe', acc: 'Farbe vom Zubehör',
    own: 'Original', none: 'nichts', noHat: 'Eine andere Kopfbedeckung passt bei dieser Figur nicht.', orig: 'Original',
    rand: 'Zufall', reset: 'Zurücksetzen', save: 'Speichern',
    saved: 'Gespeichert! Deine Figur ist auf diesem Gerät.', unsaved: 'Noch nicht gespeichert.',
    spin: 'Drehen', idle: 'Stehen', walk: 'Laufen', wave: 'Winken', jump: 'Jubeln',
    shells: 'Muscheln', isNew: 'Neu', yourChars: 'Deine Figuren', yourItems: 'Dein Zubehör',
    countChars: '{a} von {b} Figuren gesammelt', countItems: '{a} von {b} Zubehör gesammelt',
    nextGift: 'Nächste Überraschung', toNext: 'noch {n} Muscheln', toNext1: 'noch 1 Muschel', allDone: 'Du hast alles gesammelt!',
    mystery: 'Mehr?', mysteryLabel: 'Wie bekomme ich mehr?',
    moreChars: 'Es gibt noch {n} Figuren. Du bekommst sie als Geschenk: alle 150 Muscheln eins, dazu fürs Üben an vielen Tagen.',
    moreItems: 'Es gibt noch {n} Sachen zum Anziehen. Du bekommst sie als Geschenk: alle 150 Muscheln eins, dazu fürs Üben an vielen Tagen.',
    gotIt: 'Neu für dich: {name}!',
    hatsElsewhere: 'Deine Hüte und Mützen passen zu deinen anderen Figuren.',
    hatNoFit: 'Neu für dich: {name}! Zu dieser Figur passt das nicht. Probier es mit einer anderen Figur!',
  },
  es: {
    loading: 'Creando personaje …', tabsLabel: 'Crear personaje',
    tabs: { char: 'Elige personaje', items: 'Accesorios', skin: 'Piel y pelo', clothes: 'Ropa' },
    noSkin: 'Este personaje no tiene color de piel ni de pelo para cambiar. ¡Mira en «Ropa»!',
    groups: { people: 'Personas', fantasy: 'Fantasía', monsters: 'Monstruos y robots' },
    hat: 'Gorro', glasses: 'Lentes', back: 'Espalda', skin: 'Piel', hair: 'Pelo', main: 'Color principal',
    legs: 'Segundo color', acc: 'Color de accesorios', own: 'Original', none: 'nada', noHat: 'A este personaje no le queda otro gorro.', orig: 'Original',
    rand: 'Al azar', reset: 'Reiniciar', save: 'Guardar',
    saved: '¡Guardado! Tu personaje está en este dispositivo.', unsaved: 'Todavía sin guardar.',
    spin: 'Girar', idle: 'Quieto', walk: 'Caminar', wave: 'Saludar', jump: 'Celebrar',
    shells: 'caracolas', isNew: 'Nuevo', yourChars: 'Tus personajes', yourItems: 'Tus accesorios',
    countChars: 'Tienes {a} de {b} personajes', countItems: 'Tienes {a} de {b} accesorios',
    nextGift: 'Próxima sorpresa', toNext: 'faltan {n} caracolas', toNext1: 'falta 1 caracola', allDone: '¡Ya lo tienes todo!',
    mystery: '¿Más?', mysteryLabel: '¿Cómo consigo más?',
    moreChars: 'Hay {n} personajes más. Te llegan como regalo: uno cada 150 caracolas, y también por practicar muchos días.',
    moreItems: 'Hay {n} accesorios más. Te llegan como regalo: uno cada 150 caracolas, y también por practicar muchos días.',
    gotIt: 'Nuevo para ti: {name}.',
    hatsElsewhere: 'Tus gorros les quedan a tus otros personajes.',
    hatNoFit: 'Nuevo para ti: {name}. A este personaje no le queda. ¡Prueba con otro personaje!',
  },
  en: {
    loading: 'Building your figure …', tabsLabel: 'Build your figure',
    tabs: { char: 'Choose figure', items: 'Accessories', skin: 'Skin & hair', clothes: 'Clothes' },
    noSkin: 'This figure has no skin or hair colour to change. Have a look at “Clothes”!',
    groups: { people: 'People', fantasy: 'Fantasy', monsters: 'Monsters & robots' },
    hat: 'Hat', glasses: 'Glasses', back: 'Back', skin: 'Skin', hair: 'Hair', main: 'Main colour',
    legs: 'Second colour', acc: 'Accessory colour', own: 'Original', none: 'nothing', noHat: 'Another hat doesn’t fit this figure.', orig: 'Original',
    rand: 'Random', reset: 'Reset', save: 'Save',
    saved: 'Saved! Your figure is on this device.', unsaved: 'Not saved yet.',
    spin: 'Turn', idle: 'Stand', walk: 'Walk', wave: 'Wave', jump: 'Cheer',
    shells: 'shells', isNew: 'New', yourChars: 'Your figures', yourItems: 'Your accessories',
    countChars: '{a} of {b} figures collected', countItems: '{a} of {b} accessories collected',
    nextGift: 'Next surprise', toNext: '{n} shells to go', toNext1: '1 shell to go', allDone: 'You have collected everything!',
    mystery: 'More?', mysteryLabel: 'How do I get more?',
    moreChars: 'There are {n} more figures. You get them as gifts: one for every 150 shells, and for practicing on many days.',
    moreItems: 'There are {n} more things to wear. You get them as gifts: one for every 150 shells, and for practicing on many days.',
    gotIt: 'New for you: {name}!',
    hatsElsewhere: 'Your hats fit your other figures.',
    hatNoFit: 'New for you: {name}! It doesn’t fit this figure. Try another figure!',
  },
}[LANG];
const N = ALL_NAMES[LANG];
T.chars = N.chars;
const NAMES = { char: N.chars, hat: N.hats, glasses: N.glassesN, back: N.backs };
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]);
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// No emojis (owner rule): icons of the Krabsy set (lib/icons/krabsy-icons.svg), decorative.
const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-27c';
const SVG_NS = 'http://www.w3.org/2000/svg';
function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ki' + (cls ? ' ' + cls : ''));
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use'); use.setAttribute('href', `${ICONS}#ki-${name}`);
  svg.append(use);
  return svg;
}
// "nothing": a circle with a line through it (drawn here: it takes the text colour).
function noneSign() {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="M6.4 17.6 17.6 6.4"/></svg>';
  return t.content.firstChild;
}

// Give what is due before the page is drawn (a child who comes here first gets its gifts now).
syncRewards();
// The saved figure; anything in it the child doesn't own falls back to the figure's own.
let cfg = normalize(playerConfig() || DEFAULT);
let savedJson = readSavedFigure() ? JSON.stringify(cfg) : null;
let info = null;          // what this character offers (charInfo)
let shells = getShells();
let rewards = getRewards();
// "Neu" badges: what was new when the page opened (or arrived since) keeps its badge for
// this visit; a tab that was opened marks its entries as seen for the next visit.
const fresh = new Set(rewards.unseen);
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });   // the stage's light card shows through
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
// Light as on the landing and profile pages (krabsy-landing-figure.js), so the figure has
// the same colours everywhere.
scene.add(new THREE.HemisphereLight('#ffffff', '#c9b8a0', 1.9));
const sun = new THREE.DirectionalLight('#ffffff', 1.5); sun.position.set(3, 6, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; scene.add(sun);
// The platform: a flat sand island (the profile page's colours, unlit so they stay exact)
// and an invisible disc on top that only takes the figure's shadow.
const PLATFORM_R = 1.45;
const island = new THREE.Mesh(new THREE.CylinderGeometry(PLATFORM_R, PLATFORM_R, 0.16, 64),
  [new THREE.MeshBasicMaterial({ color: '#f6cf7c' }), new THREE.MeshBasicMaterial({ color: '#ffe2a0' }), new THREE.MeshBasicMaterial({ color: '#f6cf7c' })]);
island.position.y = -0.08; scene.add(island);
const floor = new THREE.Mesh(new THREE.CircleGeometry(PLATFORM_R, 64), new THREE.ShadowMaterial({ color: '#26243c', opacity: 0.24 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 1.5, 6.2); camera.lookAt(0, 1.05, 0);
const turn = new THREE.Group(); scene.add(turn);

function resize() {
  layout();
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.position.z = 6.2 * Math.max(1, 1.08 / camera.aspect);       // narrow stage: step back, keep the platform in view
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
try { new ResizeObserver(resize).observe(stage); new ResizeObserver(layout).observe(document.querySelector('header.k-page-header')); } catch (_) { /* old browser */ }
resize();

// Turning: off by default (owner: the constant turning was annoying); the turn button turns
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
spinBtn.append(icon('turn'), el('span', '', T.spin)); spinBtn.setAttribute('aria-label', T.spin); spinBtn.setAttribute('aria-pressed', 'false');
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

// ------------------------------------------------------------------ shells: the way to the next surprise
function renderWallet(pop) {
  const w = $('mfWallet');
  w.textContent = '';
  w.className = 'mf-next';
  const top = el('div', 'mf-next-top');
  const count = el('span', 'mf-next-shells'); count.append(icon('shell'), el('b', '', String(rewards.earned)));
  count.setAttribute('role', 'img'); count.setAttribute('aria-label', `${rewards.earned} ${T.shells}`);
  top.append(count);
  if (rewards.complete) { top.append(el('span', 'mf-next-label', T.allDone)); w.append(top); return; }
  top.append(el('span', 'mf-next-label', T.nextGift),
    el('span', 'mf-next-left', rewards.toNext === 1 ? T.toNext1 : fill(T.toNext, { n: rewards.toNext })));
  const bar = el('div', 'mf-next-bar'); bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${T.nextGift}: ${rewards.into} / ${SHELLS_PER_GIFT} ${T.shells}`);
  const track = el('span', 'mf-next-track');
  const fillEl = el('span'); fillEl.style.width = `${rewards.into > 0 ? Math.max(6, (rewards.into / SHELLS_PER_GIFT) * 100) : 0}%`;
  track.append(fillEl);
  const gift = el('span', 'mf-next-gift'); gift.append(icon('gift'));
  bar.append(track, gift);
  w.append(top, bar);
  if (pop) { w.classList.remove('is-pop'); void w.offsetWidth; w.classList.add('is-pop'); }
}
// Shells earned or a gift arrived (in another tab, or just now): show it.
onRewardsChange(() => {
  const before = shells.owned.length, was = rewards.earned;
  shells = getShells(); rewards = getRewards();
  for (const id of rewards.unseen) fresh.add(id);
  renderWallet(rewards.earned > was);
  if (shells.owned.length !== before) { invalidate('char', 'items'); showAll(); }
  tabDots();
});

// ------------------------------------------------------------------ the four tabs
// Each tab's content is built the first time the tab is opened (so the portraits and the
// accessory pictures load only when they are looked at) and again when what it shows has
// changed (another character, something unlocked). sync() only moves the selection marks.
const TABS = ['char', 'items', 'skin', 'clothes'];
const TAB_ICON = { char: 'profile', items: 'hat', skin: 'palette', clothes: 'shirt' };
const tablist = $('mfTabs'), panesBox = $('mfPanes');
tablist.setAttribute('aria-label', T.tabsLabel);
let tab = 'char';
const panes = {};
for (const name of TABS) {
  const b = el('button', 'mf-tab'); b.type = 'button'; b.id = `mfTab-${name}`; b.dataset.tab = name;
  b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', `mfPane-${name}`);
  b.append(icon(TAB_ICON[name], 'mf-tab-ic'), el('span', 'mf-tab-label', T.tabs[name]));
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
  seenTab(name);
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
// A tab with something new gets a dot; opening it marks its gifts as seen (the badges
// stay for this visit).
const tabOf = (id) => (id.startsWith('char:') ? 'char' : 'items');
function tabDots() {
  const left = unseenGifts();
  for (const n of ['char', 'items']) panes[n].btn.classList.toggle('has-new', n !== tab && left.some((id) => tabOf(id) === n));
}
// (A new hat is not shown while the figure is one no hat fits; the note there says that
// the child's hats fit its other figures.)
function seenTab(name) {
  if (name !== 'char' && name !== 'items') return;
  const ids = unseenGifts().filter((id) => tabOf(id) === name);
  if (ids.length) markSeen(ids);
  tabDots();
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
// One tile: a picture (or a sign), maybe a name, and "Neu" on a gift not yet looked at.
function tile({ slot, id, name, img, sign, caption, star }) {
  const isNew = fresh.has(unlockId(slot, id));
  const b = el('button', 'mf-tile' + (isNew ? ' is-new' : '')); b.type = 'button';
  b.dataset.slot = slot; b.dataset.id = id; b.title = name;
  b.setAttribute('aria-label', isNew ? `${name}, ${T.isNew}` : name);
  const pic = el('span', 'mf-tile-pic');
  if (img) {
    const i = el('img'); i.src = img; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; i.width = 192; i.height = 192;
    pic.appendChild(i);
  } else { const sg = el('span', 'mf-tile-sign'); sg.append(sign); pic.appendChild(sg); }
  if (star) pic.appendChild(icon('star', 'mf-tile-star'));
  if (isNew) pic.appendChild(el('span', 'mf-tile-new', T.isNew));
  b.appendChild(pic);
  if (caption) b.appendChild(el('span', 'mf-tile-name', caption));
  return b;
}
// The "?" tile at the end of a grid: there is more, and a tap says how to get it. The
// explanation opens under the grid (and closes again).
function mysteryTile(grid, text) {
  const b = el('button', 'mf-tile mf-mystery'); b.type = 'button'; b.title = T.mysteryLabel;
  b.setAttribute('aria-label', T.mysteryLabel); b.setAttribute('aria-expanded', 'false');
  const pic = el('span', 'mf-tile-pic'); pic.appendChild(el('span', 'mf-tile-sign', '?'));
  b.append(pic, el('span', 'mf-tile-name', T.mystery));
  const note = el('p', 'mf-note mf-more', text); note.hidden = true;
  b.addEventListener('click', () => {
    note.hidden = !note.hidden; b.setAttribute('aria-expanded', String(!note.hidden)); b.classList.toggle('open', !note.hidden);
    if (!note.hidden) note.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  grid.appendChild(b);
  return note;
}
const countLine = (text) => el('p', 'mf-count', text);
const markTiles = (root, isOn) => root.querySelectorAll('.mf-tile:not(.mf-mystery)').forEach((b) => {
  const on = isOn(b.dataset.slot, b.dataset.id);
  b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
});
// What the child owns of a list: its gifts first (newest first), then the free ones in catalogue order.
const mine = (slot, ids) => {
  const got = ids.filter((id) => unlocked(slot, id));
  const order = (id) => { const i = shells.owned.indexOf(unlockId(slot, id)); return i < 0 ? -1 : shells.owned.length - i; };
  return got.map((id, i) => [id, i, order(id)]).sort((a, b) => (a[2] < 0) - (b[2] < 0) || (a[2] < 0 ? a[1] - b[1] : a[2] - b[2])).map((x) => x[0]);
};

// ---- tab 1: the child's figures (the free ones and the ones it was given)
panes.char.render = () => {
  const box = panes.char.el; box.textContent = '';
  const all = CHARS.map((c) => c.id), got = mine('char', all);
  const sec = section(T.yourChars), grid = el('div', 'mf-grid chars');
  sec.appendChild(countLine(fill(T.countChars, { a: got.length, b: all.length })));
  for (const id of got) {
    const b = tile({ slot: 'char', id, name: T.chars[id], img: `${ASSET_BASE}portraits/${id}.webp`, caption: T.chars[id] });
    b.addEventListener('click', () => chooseChar(id));
    grid.appendChild(b);
  }
  sec.appendChild(grid);
  if (got.length < all.length) sec.appendChild(mysteryTile(grid, fill(T.moreChars, { n: all.length - got.length })));
  box.appendChild(sec);
};
panes.char.sync = () => markTiles(panes.char.el, (_, id) => id === cfg.char);
// A new character starts plain: its own accessories, its own colours.
async function chooseChar(id, again) {
  if (id === cfg.char && !again) return;
  cfg = normalize({ ...DEFAULT, char: id });
  invalidate('items');
  panes.char.sync();
  await refreshInfo();
  changed();
}

// ---- tab 2: accessories (hat, glasses, back), a grid of pictures per slot
const ITEM_SLOTS = [['hat', HATS, 'ownHat'], ['glasses', GLASSES, 'ownGlasses'], ['back', BACKS, 'ownBack']];
// The catalogue entry that is this character's own accessory (the Hiker's cap), if any:
// it gives "Original" (with a star) its picture, and is not offered a second time with a price.
const ownKey = (list, char) => Object.keys(list).find((k) => list[k][0] === char) || null;
panes.items.render = () => {
  const box = panes.items.el; box.textContent = '';
  if (!info) { panes.items.dirty = true; return; }
  const total = ITEM_SLOTS.reduce((n, [slot]) => n + Object.keys(PRICES[slot]).length, 0);
  const have = shells.owned.filter((id) => { const it = parseId(id); return it && it.slot !== 'char'; }).length;
  box.appendChild(countLine(fill(T.countItems, { a: have, b: total })));
  for (const [slot, list, ownFlag] of ITEM_SLOTS) {
    const sec = section(T[slot]);
    if (slot === 'hat' && !info.hats) {                       // head shape no other hat fits
      const n = mine('hat', Object.keys(list)).length;
      sec.appendChild(el('p', 'mf-note', n ? `${T.noHat} ${T.hatsElsewhere}` : T.noHat)); box.appendChild(sec); continue;
    }
    const grid = el('div', 'mf-grid items');
    const twin = info[ownFlag] ? ownKey(list, cfg.char) : null;
    const add = (o) => {
      const b = tile({ slot, ...o });
      b.addEventListener('click', () => chooseItem(slot, o.id));
      grid.appendChild(b);
    };
    // "Original" (with a star) only when the character brings something; "nichts" is then 'none',
    // otherwise 'own' (which is nothing).
    if (info[ownFlag]) add({ id: 'own', name: T.own, caption: T.own, star: !!twin, img: twin && `${ASSET_BASE}items/${slot}-${twin}.webp`, sign: icon('star') });
    add({ id: info[ownFlag] ? 'none' : 'own', name: T.none, caption: T.none, sign: noneSign() });
    const all = Object.keys(list).filter((k) => k !== twin), got = mine(slot, all);
    for (const id of got) {
      add({ id, name: NAMES[slot][id], caption: NAMES[slot][id], img: `${ASSET_BASE}items/${slot}-${id}.webp` });
    }
    sec.appendChild(grid);
    if (got.length < all.length) sec.appendChild(mysteryTile(grid, fill(T.moreItems, { n: total - have })));
    box.appendChild(sec);
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
  if (cfg[slot] === id) return;
  cfg = normalize({ ...cfg, [slot]: id });
  changed();
}

// ---- tabs 3 and 4: colours (always free)
function swatches(key, label, palette) {
  const sec = section(label), box = el('div', 'mf-swatches');
  for (const i of [-1, ...palette.keys()]) {
    const b = el('button', 'mf-sw' + (i < 0 ? ' orig' : '')); b.type = 'button'; b.dataset.key = key; b.dataset.i = String(i);
    b.title = i < 0 ? T.orig : `${label} ${i + 1}`; b.setAttribute('aria-label', b.title);
    if (i >= 0) b.style.background = palette[i]; else b.append(icon('star'));
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
  $('mfSave').classList.toggle('dirty', JSON.stringify(cfg) !== savedJson);
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
  showAll();
  status(JSON.stringify(cfg) === savedJson ? '' : T.unsaved, '');
  clearTimeout(timer); timer = setTimeout(() => rebuild().catch(showError), 60);
}
function showError(e) { console.error(e); $('mfLoading').textContent = String(e?.message || e); }

// Random: keeps the chosen character, shuffles its accessories (only the child's own) and colours.
function randomOwned(char) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (n) => Math.floor(Math.random() * n);
  const some = (slot, list, pOwn) => (Math.random() < pOwn ? 'own' : pick(['none', ...Object.keys(list).filter((k) => unlocked(slot, k))]));
  return normalize({ char, hat: some('hat', HATS, 0.6), glasses: some('glasses', GLASSES, 0.7), back: some('back', BACKS, 0.5),
    skin: rnd(SKIN.length), hair: rnd(HAIR.length), main: rnd(COLORS.length),
    legs: Math.random() < 0.5 ? -1 : rnd(COLORS.length), acc: Math.random() < 0.5 ? -1 : rnd(COLORS.length) });
}
$('mfRand').append(icon('dice'), el('span', '', T.rand)); $('mfReset').textContent = T.reset; $('mfSave').textContent = T.save;
$('mfRand').addEventListener('click', () => { cfg = randomOwned(cfg.char); changed(); });
$('mfReset').addEventListener('click', () => chooseChar(cfg.char, true));
$('mfSave').addEventListener('click', () => {
  shells = getShells();
  // Only what the child owns is saved (nothing else can be chosen here; a part that is
  // not owned, e.g. from an edited save, goes back to the figure's own).
  const foreign = lockedParts(cfg, shells.owned);
  if (foreign.some((p) => p.slot === 'char')) { chooseChar(DEFAULT.char, true); return; }
  if (foreign.length) { for (const p of foreign) cfg[p.slot] = 'own'; changed(); }
  if (saveFigure(cfg)) { savedJson = JSON.stringify(cfg); showAll(); status(T.saved, 'ok'); }
});

// A gift from the popup ("Anziehen" / "Ansehen", link …#neu=hat:wizard) or the newest new
// one: open its tab and try it on. A figure is picked; an accessory is put on when it fits
// the current figure. Nothing is saved until the child taps Save.
async function showGift(id) {
  const it = parseId(id);
  if (!it || !unlocked(it.slot, it.key)) return;
  if (it.slot === 'char') { openTab('char'); await chooseChar(it.key); }
  else {
    openTab('items');
    if (!info) await refreshInfo();
    if (it.slot === 'hat' && info && !info.hats) { status(fill(T.hatNoFit, { name: NAMES.hat[it.key] }), 'warn'); return; }
    chooseItem(it.slot, it.key);
  }
  status(fill(T.gotIt, { name: NAMES[it.slot][it.key] }), 'ok');
  const back = anim === 'jump' ? 'idle' : anim;
  clearTimeout(cheer); play('jump'); cheer = setTimeout(() => play(back), 1900);
  panes[tab].el.querySelector(`.mf-tile[data-slot="${it.slot}"][data-id="${it.key}"]`)?.scrollIntoView({ block: 'nearest' });
}
addEventListener('krabsy:show-gift', (e) => { showGift(e.detail && e.detail.id); });

renderWallet(false);
const wanted = decodeURIComponent((location.hash.match(/^#neu=([^&]+)/) || [])[1] || '');
const startGift = parseId(wanted) ? wanted : null;
openTab(startGift ? tabOf(startGift) : 'char');
refreshInfo().then(rebuild).then(() => { if (startGift) return showGift(startGift); }).catch(showError);
if (startGift) { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* keep the hash */ } }

// For QA scripts (tools / headless checks).
window.__mf = {
  view(y) { yaw = y; }, get cfg() { return cfg; }, get fig() { return fig; }, get info() { return info; },
  async set(v) { cfg = normalize(v); await refreshInfo(); changed(); },
  tab: openTab, get tabName() { return tab; },
};
