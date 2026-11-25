// "Mein Profil" / "Mi perfil" / "My profile" — the child's overview page
// (/de/profil/, /es/perfil/, /en/my-profile/). Owner decision 2026-11-25: one
// page for everything a child owns on Krabsy; the figure builder stays its own page.
//
// What it shows and where each number comes from (all on this device, localStorage):
//   figure          krabsy_figure_v2 (krabsy-figure.js). Picture first; the live 3D figure
//                   is loaded afterwards, and only when the child has saved a figure.
//   shells          krabsy_shells_v1 (krabsy-shells.js): balance, today, collected in total
//   answers         krabsy_stats_v2 (krabsy-stats.js): overall accuracy and streaks, and per
//                   topic of this section: accuracy, words that are safe, words to practise
//   Verb-Diplom     krabsy_verb_diplom (krabsy-verb-diplom.js): { bronze|silver|gold: result }
//   games           each game's own save, see GAME_SAVES (only what can be read reliably)
//   class           krabsy_class (krabsy-class.js)
// A section = the topics with a URL in this language (topics.json) and the games that
// play them, like the landing pages.
import { getShells, onShellsChange } from '/lib/krabsy-shells.js';
import { hasData, getOverall, readTopicItems } from '/lib/krabsy-stats.js?v=2026-11-22';
import { FIGURE_URL, pageLang, savedChar, portraitUrl, DEFAULT_CHAR, classSession,
  itemLabel, labelLang } from '/lib/krabsy-me.js?v=2026-11-25b';
import { createLiveFigure, liveFigureBlocked, whenIdle } from '/lib/krabsy-figure-live.js?v=2026-11-25';

const LANG = pageLang();
const T = {
  de: {
    shells: 'Muscheln', today: 'Heute', total: 'Insgesamt gesammelt', unlocked: 'Freigeschaltet',
    change: 'Figur ändern', build: 'Bau deine Figur', play: 'Spiel ein Spiel',
    newTitle: 'Bau dir deine eigene Figur',
    newText: 'Such dir eine Figur aus und gib ihr Hut, Brille und deine Farben. Für jede richtige Antwort bekommst du Muscheln 🐚 und schaltest damit mehr frei.',
    yourFigure: 'Deine Figur', turn: 'Zieh, um deine Figur zu drehen',
    emptyTitle: 'Hier sammelt sich, was du schaffst',
    emptyText: 'Spiel ein Spiel oder mach eine kurze Übung. Danach siehst du hier, was du schon kannst und was du noch üben kannst.',
    overall: 'So läuft es', answers: 'Antworten', right: 'Richtig', streak: 'Serie', bestStreak: 'Beste Serie',
    topics: 'Das übst du', notYet: 'Noch nicht geübt.', start: 'Jetzt üben →',
    rightPct: '{n} % richtig', nAnswers: '{n} Antworten', oneAnswer: '1 Antwort',
    safe: '{a} von {b} sitzen schon', safeNoTotal: '{a} sitzen schon', practised: '{n} geübt',
    practise: 'Das kannst du noch üben:', practiseAll: 'Diese üben →', allGood: 'Im Moment sitzt alles. Stark! 💪',
    diplom: 'Verb-Diplom', diplomSub: 'Drei Prüfungen, drei Urkunden.', diplomGo: 'Zum Verb-Diplom →',
    levels: { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' },
    passed: 'Geschafft am {date}', open: 'Noch offen', mistakes: '{n} Fehler', oneMistake: '1 Fehler',
    games: 'Deine Spiele', notPlayed: 'Noch nicht gespielt', level: 'Level {n}', record: 'Rekord {n}',
    stars: '{n} Sterne', oneStar: '1 Stern', levelsDone: '{n} Level geschafft', oneLevelDone: '1 Level geschafft',
    playGame: 'Spielen →', allGames: 'Alle Spiele →',
    more: 'Mehr Zahlen zu den Verben →', classLabel: 'Deine Klasse',
    gamesUrl: '/de/spiele/', gameFolder: 'spiele', classUrl: '/de/klasse/',
  },
  es: {
    shells: 'caracolas', today: 'Hoy', total: 'Reunidas en total', unlocked: 'Desbloqueado',
    change: 'Cambiar personaje', build: 'Crea tu personaje', play: 'Juega a un juego',
    newTitle: 'Crea tu propio personaje',
    newText: 'Elige un personaje y ponle gorro, gafas y tus colores. Por cada respuesta correcta ganas caracolas 🐚 y con ellas desbloqueas más.',
    yourFigure: 'Tu personaje', turn: 'Arrastra para girar tu personaje',
    emptyTitle: 'Aquí se junta todo lo que consigues',
    emptyText: 'Juega a un juego o haz un ejercicio corto. Después verás aquí lo que ya sabes y lo que puedes practicar.',
    overall: 'Así vas', answers: 'Respuestas', right: 'Aciertos', streak: 'Racha', bestStreak: 'Mejor racha',
    topics: 'Lo que practicas', notYet: 'Todavía sin practicar.', start: 'Practicar ahora →',
    rightPct: '{n} % de aciertos', nAnswers: '{n} respuestas', oneAnswer: '1 respuesta',
    safe: 'Ya te salen {a} de {b}', safeNoTotal: 'Ya te salen {a}', practised: '{n} practicadas',
    practise: 'Esto lo puedes practicar:', practiseAll: 'Practicar estas →', allGood: 'Ahora mismo te sale todo. ¡Genial! 💪',
    diplom: 'Diploma de verbos', diplomSub: 'Tres pruebas, tres diplomas.', diplomGo: 'Ir al diploma →',
    levels: { bronze: 'Bronce', silver: 'Plata', gold: 'Oro' },
    passed: 'Conseguido el {date}', open: 'Pendiente', mistakes: '{n} fallos', oneMistake: '1 fallo',
    games: 'Tus juegos', notPlayed: 'Todavía sin jugar', level: 'Nivel {n}', record: 'Récord {n}',
    stars: '{n} estrellas', oneStar: '1 estrella', levelsDone: '{n} niveles superados', oneLevelDone: '1 nivel superado',
    playGame: 'Jugar →', allGames: 'Todos los juegos →',
    more: 'Más números de los verbos →', classLabel: 'Tu clase',
    gamesUrl: '/es/juegos/', gameFolder: 'juegos', classUrl: '/es/clase/',
  },
  en: {
    shells: 'shells', today: 'Today', total: 'Collected in total', unlocked: 'Unlocked',
    change: 'Change figure', build: 'Build your figure', play: 'Play a game',
    newTitle: 'Build your own figure',
    newText: 'Pick a figure and give it a hat, glasses and your colours. Every right answer earns you shells 🐚, and shells unlock more.',
    yourFigure: 'Your figure', turn: 'Drag to turn your figure',
    emptyTitle: 'Everything you achieve shows up here',
    emptyText: 'Play a game or do a quick exercise. After that you can see here what you already know and what you can still practise.',
    overall: 'How it is going', answers: 'Answers', right: 'Right', streak: 'Streak', bestStreak: 'Best streak',
    topics: 'What you practise', notYet: 'Not practised yet.', start: 'Practise now →',
    rightPct: '{n} % right', nAnswers: '{n} answers', oneAnswer: '1 answer',
    safe: 'You know {a} of {b}', safeNoTotal: 'You know {a}', practised: '{n} practised',
    practise: 'You can still practise:', practiseAll: 'Practise these →', allGood: 'Right now you know them all. Great! 💪',
    diplom: 'Verb diploma', diplomSub: 'Three tests, three certificates.', diplomGo: 'To the verb diploma →',
    levels: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' },
    passed: 'Passed on {date}', open: 'Not yet', mistakes: '{n} mistakes', oneMistake: '1 mistake',
    games: 'Your games', notPlayed: 'Not played yet', level: 'Level {n}', record: 'Best {n}',
    stars: '{n} stars', oneStar: '1 star', levelsDone: '{n} levels done', oneLevelDone: '1 level done',
    playGame: 'Play →', allGames: 'All games →',
    more: 'More numbers →', classLabel: 'Your class',
    gamesUrl: '/en/spanish/games/', gameFolder: 'spanish/games', classUrl: null,
  },
}[LANG];

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
const num = (n) => { try { return n.toLocaleString(LANG); } catch (_) { return String(n); } };
const plural = (n, one, many) => (n === 1 ? one : fmt(many, { n: num(n) }));
function link(cls, text, href) { const a = el('a', cls, text); a.href = href; return a; }
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
}
function readInt(key) {
  try { const n = parseInt(localStorage.getItem(key) || '', 10); return Number.isFinite(n) && n > 0 ? n : 0; } catch (_) { return 0; }
}
const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ------------------------------------------------------------------ figure + shells (the top card)
const char = savedChar();

function renderHero() {
  const body = $('pfHeroBody');
  const s = getShells();
  const stage = $('pfStage');
  body.textContent = '';

  const wallet = el('div', 'pf-wallet');
  wallet.setAttribute('aria-label', `${s.balance} ${T.shells}`);
  wallet.append(el('span', 'pf-wallet-icon', '🐚'), el('b', '', num(s.balance)), el('span', 'pf-wallet-word', T.shells));
  wallet.firstChild.setAttribute('aria-hidden', 'true');

  if (!char) {
    // No figure yet: the invitation. Shells are shown once there are any.
    stage.classList.add('is-new');
    body.append(el('h2', 'pf-hero-title', T.newTitle), el('p', 'pf-hero-text', T.newText));
    if (s.earned > 0) body.append(wallet);
    const actions = el('div', 'pf-actions');
    actions.append(link('pf-btn pf-btn-main', T.build + ' →', FIGURE_URL[LANG]), link('pf-btn', T.play + ' →', T.gamesUrl));
    body.append(actions);
    return;
  }
  stage.classList.remove('is-new');
  body.append(wallet);
  const facts = el('dl', 'pf-facts');
  const fact = (label, value) => { const d = el('div'); d.append(el('dt', '', label), el('dd', '', value)); facts.append(d); };
  fact(T.today, '+' + num(s.today));
  fact(T.total, num(s.earned));
  if (s.owned.length) fact(T.unlocked, num(s.owned.length));
  body.append(facts);
  const actions = el('div', 'pf-actions');
  actions.append(link('pf-btn pf-btn-main', T.change, FIGURE_URL[LANG]), link('pf-btn', T.play + ' →', T.gamesUrl));
  body.append(actions);
}

function renderPortraits() {
  const box = $('pfPortraits');
  box.textContent = '';
  // With a figure: its picture. Without: three of the free ones, as a teaser.
  const ids = char ? [char] : ['Hiker', DEFAULT_CHAR, 'Robot_One'];
  for (const id of ids) {
    const img = el('img');
    img.alt = ''; img.width = 192; img.height = 192; img.decoding = 'async';
    img.onerror = () => { if (!img.dataset.fb) { img.dataset.fb = '1'; img.src = portraitUrl(DEFAULT_CHAR); } };
    img.src = portraitUrl(id);
    box.append(img);
  }
  box.classList.toggle('is-one', ids.length === 1);
}

// The live figure: three.js (0.7 MB) + one character + the small animation file. Loaded only
// for a child who saved a figure (then it is in the browser cache from the builder), after
// the page is up, and never with "save data" on. The picture stays if anything fails.
// The 3D part is shared with the landing pages (krabsy-figure-live.js).
async function start3D() {
  const stage = $('pfStage'), canvas = $('pfCanvas');
  try {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const live = await createLiveFigure({
      canvas, box: stage, still, fps: 60, maxSize: 1000, yaw: 0.35,
      configFrom: (F) => F.playerConfig() || F.normalize({ char: F.FREE_CHARS.includes(char) ? char : F.DEFAULT.char }),
      place(camera, aspect) {
        camera.position.set(0, 1.5, 5.7 * Math.max(1, 1.08 / aspect));   // narrow stage: step back
        camera.lookAt(0, 1.05, 0);
      },
    });
    const { THREE, scene } = live;
    // the builder's floor and ring, so the figure stands on the same spot as there
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshLambertMaterial({ color: '#2b3b74' }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.72, 48), new THREE.MeshBasicMaterial({ color: '#2ee6c0' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005; scene.add(ring);

    // drag to turn, tap to wave
    let drag = null, moved = 0;
    canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; moved = 0; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} live.hold(true); });
    canvas.addEventListener('pointermove', (e) => {
      if (drag == null) return;
      live.yaw += (e.clientX - drag) * 0.012; moved += Math.abs(e.clientX - drag); drag = e.clientX;
    });
    const end = () => {
      if (drag != null && moved < 6) live.wave();
      drag = null; live.hold(false);
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { drag = null; live.hold(false); });
    canvas.hidden = false;
    live.resize();
    canvas.title = T.turn;
    stage.classList.add('is-live');
  } catch (err) {
    console.warn('profile: live figure skipped', err);
    canvas.hidden = true;
  }
}

// ------------------------------------------------------------------ learning: overall + topics
function topicNumbers(topicId) {
  // Per item: practised = any answer; safe = every form at mastery ≥ 4 (verbs: both forms
  // answered); to practise = a form at mastery ≤ 2 (weakest first, then most recent).
  const items = readTopicItems(topicId);
  let attempts = 0, correct = 0, practised = 0, safe = 0;
  const weak = [];
  for (const id of Object.keys(items)) {
    const forms = Object.values(items[id] || {}).filter((f) => f && f.attempts > 0);
    if (!forms.length) continue;
    practised++;
    let min = 5, seen = '';
    for (const f of forms) {
      attempts += f.attempts || 0; correct += f.correct || 0;
      min = Math.min(min, f.mastery || 0);
      if (String(f.last_seen || '') > seen) seen = String(f.last_seen || '');
    }
    const complete = topicId !== 'irregular_verbs' || forms.length >= 2;
    if (min >= 4 && complete) safe++;
    else if (min <= 2) weak.push({ id, min, seen });
  }
  weak.sort((a, b) => a.min - b.min || (a.seen < b.seen ? 1 : a.seen > b.seen ? -1 : 0));
  return { attempts, correct, practised, safe, weak };
}

function tile(label, value) {
  const d = el('div', 'pf-tile');
  d.append(el('span', 'pf-tile-label', label), el('strong', 'pf-tile-value', value));
  return d;
}
function section(title, cls) {
  const s = el('section', 'pf-section' + (cls ? ' ' + cls : ''));
  s.append(el('h2', 'pf-h2', title));
  return s;
}

async function topicCard(id, t) {
  const hub = `/${LANG}/${t[LANG]}/`;
  const page = (p) => (t.pages && t.pages[p] && t.pages[p][LANG] ? `${hub}${t.pages[p][LANG]}/` : null);
  const card = el('article', 'pf-card pf-topic');
  const head = el('div', 'pf-topic-head');
  const name = (t.short_name && t.short_name[LANG]) || (t.display_name && t.display_name[LANG]) || id;
  const h = el('h3', 'pf-h3'); h.append(link('', name, hub)); head.append(h);
  card.append(head);

  const n = topicNumbers(id);
  if (!n.attempts) {
    const p = el('p', 'pf-muted', T.notYet + ' ');
    p.append(link('pf-link', T.start, hub));
    card.append(p);
    card.classList.add('is-new');
    return card;
  }
  head.append(el('span', 'pf-pct', fmt(T.rightPct, { n: Math.round((n.correct / n.attempts) * 100) })));

  // "34 von 172 sitzen schon": the first number of the topic's card_stats is its item count.
  const total = parseInt(((t.card_stats && t.card_stats[LANG]) || '').replace(/[.,\s]/g, '') || '', 10) || 0;
  const all = Math.max(total, n.practised);
  const bar = el('div', 'pf-bar');
  bar.setAttribute('role', 'img');
  const safeText = total ? fmt(T.safe, { a: num(n.safe), b: num(all) }) : fmt(T.safeNoTotal, { a: num(n.safe) });
  bar.setAttribute('aria-label', safeText);
  const b1 = el('span', 'pf-bar-practised'); b1.style.width = Math.min(100, (n.practised / all) * 100) + '%';
  const b2 = el('span', 'pf-bar-safe'); b2.style.width = Math.min(100, (n.safe / all) * 100) + '%';
  bar.append(b1, b2);
  const legend = el('p', 'pf-bar-legend');
  legend.append(el('strong', '', safeText), el('span', '', ' · ' + fmt(T.practised, { n: num(n.practised) }) + ' · ' + plural(n.attempts, T.oneAnswer, T.nAnswers)));
  card.append(bar, legend);

  // Words to practise: readable labels, linked into practice where a page takes one item.
  const free = page('free-practice');
  const chips = el('div', 'pf-chips');
  const ids = [];
  for (const w of n.weak) {
    if (ids.length >= 6) break;
    const label = await itemLabel(id, w.id);
    if (!label) continue;
    const c = free ? link('pf-chip', label, `${free}?verbs=${encodeURIComponent(w.id)}`) : el('span', 'pf-chip', label);
    c.lang = labelLang(id);
    chips.append(c);
    ids.push(w.id);
  }
  if (ids.length) {
    card.append(el('p', 'pf-practise-label', T.practise), chips);
    const go = free ? `${free}?verbs=${ids.map(encodeURIComponent).join(',')}` : (page('sprint') || hub);
    card.append(link('pf-link', T.practiseAll, go));
  } else {
    card.append(el('p', 'pf-muted', T.allGood));
    card.append(link('pf-link', T.start, page('sprint') || hub));
  }
  return card;
}

function diplomCard(t) {
  const url = `/${LANG}/${t[LANG]}/${t.pages['verb-diplom'][LANG]}/`;
  const store = readJson('krabsy_verb_diplom') || {};
  const card = el('article', 'pf-card pf-diplom');
  const head = el('div', 'pf-topic-head');
  head.append(el('h3', 'pf-h3', T.diplom), el('span', 'pf-muted', T.diplomSub));
  const row = el('div', 'pf-medals');
  for (const key of ['bronze', 'silver', 'gold']) {
    const r = store && store[key];
    const ok = !!(r && r.passed);
    const m = el('div', `pf-medal is-${key}` + (ok ? ' is-won' : ''));
    const disc = el('span', 'pf-medal-disc', ok ? '★' : ''); disc.setAttribute('aria-hidden', 'true');
    const txt = el('div', 'pf-medal-txt');
    txt.append(el('strong', '', T.levels[key]));
    if (ok) {
      let date = '';
      try { date = new Date(r.date).toLocaleDateString(LANG === 'en' ? 'en-GB' : LANG, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (_) { /* no date */ }
      const bits = [];
      if (date && date !== 'Invalid Date') bits.push(fmt(T.passed, { date }));
      if (Number.isFinite(r.mistakes)) bits.push(plural(r.mistakes, T.oneMistake, T.mistakes));
      txt.append(el('span', '', bits.join(' · ')));
    } else {
      txt.append(el('span', '', T.open));
    }
    m.append(disc, txt);
    row.append(m);
  }
  card.append(head, row, link('pf-link', T.diplomGo, url));
  return card;
}

// ------------------------------------------------------------------ games
// What each game saves itself (read-only here; a game that changes its save simply shows
// "not played yet"). stars → { stars, levels }, score games → { level, best }.
const sumStars = (obj, pick = (v) => v) => {
  let stars = 0, levels = 0;
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const n = Math.floor(Number(pick(v)));
      if (Number.isFinite(n) && n > 0) { stars += Math.min(n, 5); levels++; }
    }
  }
  return { stars, levels };
};
const GAME_SAVES = {
  'verb-towers': () => {                      // td3d_stars_level_<index> = 1–3
    const o = {};
    for (let i = 0; i < 30; i++) o[i] = readInt(`td3d_stars_level_${i}`);
    return sumStars(o);
  },
  'verb-kitchen': () => sumStars((readJson('krabsy_vkitchen_save') || {}).stars),          // { stars: { <level>: n } }
  'verb-platformer': () => sumStars((readJson('krabsy_vp_progress') || {}).levels, (v) => v && v.stars),
  'verb-dungeon': () => sumStars(readJson('krabsy_vdungeon_stars')),                       // { <room>: n }
  'verb-hatchery': () => {                    // { goals: { stars } }
    const g = (readJson('krabsy_hatchery_save') || {}).goals;
    const n = g ? Math.floor(Number(g.stars)) : 0;
    return { stars: Number.isFinite(n) && n > 0 ? n : 0, levels: 0 };
  },
  'verb-snake': () => ({ level: readInt('krabsy_vsnake_level'), best: readInt('krabsy_vsnake_best') }),
  'verb-flow': () => ({ level: readInt('krabsy_vflow_level'), best: readInt('krabsy_vflow_best') }),
  'air-control': () => ({ level: readInt('krabsy_ac_unlocked'), best: readInt('krabsy_ac_best') }),
};
function gameLine(id) {
  let s = null;
  try { s = GAME_SAVES[id] ? GAME_SAVES[id]() : null; } catch (_) { s = null; }
  if (!s) return null;
  const bits = [];
  if (s.stars) bits.push('⭐ ' + plural(s.stars, T.oneStar, T.stars));
  if (s.levels) bits.push(plural(s.levels, T.oneLevelDone, T.levelsDone));
  if (s.level > 1) bits.push(fmt(T.level, { n: num(s.level) }));
  if (s.best) bits.push(fmt(T.record, { n: num(s.best) }));
  return bits.length ? bits.join(' · ') : null;
}
function gameCard(g) {
  const a = link('pf-game', '', `/${LANG}/${T.gameFolder}/${g.id}/`);
  const img = el('img'); img.src = g.thumb_small || g.thumbnail || ''; img.alt = ''; img.width = 640; img.height = 360;
  img.loading = 'lazy'; img.decoding = 'async';
  const txt = el('div', 'pf-game-txt');
  const line = gameLine(g.id);
  txt.append(el('strong', '', (g.name && g.name[LANG]) || g.id), el('span', line ? 'pf-game-stat' : 'pf-game-none', line || T.notPlayed));
  a.append(img, txt);
  if (line) a.classList.add('is-played');
  return a;
}

// ------------------------------------------------------------------ the page
function renderClass() {
  const s = classSession();
  const box = $('pfClass');
  if (!s || !box) return;
  const text = '👥 ' + s.name + (s.nickname ? ' · ' + s.nickname : '');
  const badge = T.classUrl ? link('pf-class', text, T.classUrl) : el('span', 'pf-class', text);
  badge.setAttribute('aria-label', `${T.classLabel}: ${s.name}${s.nickname ? ', ' + s.nickname : ''}`);
  box.replaceChildren(badge);
  box.hidden = false;
}

async function renderBody() {
  const body = $('pfBody');
  const [topics, games] = await Promise.all([fetchJson('/data/topics.json'), fetchJson('/data/games.json')]);
  const mine = Object.entries(topics || {}).filter(([, t]) => t && t[LANG] && t.status !== 'coming_soon');
  const frag = document.createDocumentFragment();
  let any = false;
  try { any = hasData(); } catch (_) { any = false; }

  if (!any) {
    const empty = el('section', 'pf-card pf-empty');
    empty.append(el('h2', 'pf-h2', T.emptyTitle), el('p', '', T.emptyText), link('pf-btn pf-btn-coral', T.play + ' →', T.gamesUrl));
    frag.append(empty);
  } else {
    const o = getOverall();
    const sec = section(T.overall);
    const tiles = el('div', 'pf-tiles');
    tiles.append(tile(T.right, Math.round((o.accuracy || 0) * 100) + ' %'), tile(T.streak, '🔥 ' + num(o.current_streak || 0)),
      tile(T.bestStreak, num(o.best_streak || 0)), tile(T.answers, num(o.total_attempts || 0)));
    sec.append(tiles);
    frag.append(sec);
  }

  const verbs = mine.find(([id, t]) => id === 'irregular_verbs' && t.pages && t.pages['verb-diplom'] && t.pages['verb-diplom'][LANG]);
  if (any && mine.length) {
    const sec = section(T.topics);
    const grid = el('div', 'pf-topics');
    for (const [id, t] of mine) grid.append(await topicCard(id, t));
    sec.append(grid);
    const stats = verbs && verbs[1].pages.stats && verbs[1].pages.stats[LANG];
    if (stats) sec.append(link('pf-link pf-more', T.more, `/${LANG}/${verbs[1][LANG]}/${stats}/`));
    frag.append(sec);
  }
  if (verbs) {
    const sec = el('section', 'pf-section');
    sec.append(diplomCard(verbs[1]));
    frag.append(sec);
  }

  const ids = new Set(mine.map(([id]) => id));
  const list = (games || []).filter((g) => g && g.status !== 'coming_soon' && g.audience !== 'teacher'
    && (g.topics || []).some((x) => ids.has(x)));
  if (list.length) {
    const sec = section(T.games);
    const grid = el('div', 'pf-games');
    const cards = list.map(gameCard);
    cards.sort((a, b) => b.classList.contains('is-played') - a.classList.contains('is-played'));   // played first
    grid.append(...cards);
    sec.append(grid, link('pf-link pf-more', T.allGames, T.gamesUrl));
    frag.append(sec);
  }
  body.replaceChildren(frag);
  document.documentElement.classList.add('pf-ready');
}

renderPortraits();
renderHero();
renderClass();
onShellsChange(renderHero);
renderBody().catch((err) => { console.warn('profile: sections skipped', err); });

if (char && !liveFigureBlocked({ motion: false })) whenIdle(start3D);
