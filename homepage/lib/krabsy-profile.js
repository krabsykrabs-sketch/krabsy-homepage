// "Mein Profil" / "Mi perfil" / "My profile" — the child's own corner
// (/de/profil/, /es/perfil/, /en/my-profile/). Rebuilt 2026-11-27 after the owner's verdict
// on the first version ("a statistics dashboard for adults"): few numbers, mostly pictures,
// nothing empty. The figure builder stays its own page.
//
// What is on the page and where it comes from (all on this device, localStorage):
//   1 me            the live figure of the landing pages (krabsy-landing-figure.js on
//                   krabsy-figure-live.js: picture first, 3D after load + idle, same blocking
//                   rules), the shell count (krabsy-shells.js) and ONE bar to the next
//                   surprise (krabsy-rewards.js, every 150 shells). The two buttons and the
//                   weekly ring are in the page's HTML (krabsy-practice-week.js fills the ring).
//   2 collection    every figure and thing the child owns (krabsy_shells_v1.owned + the free
//                   figures), newest gift first, "Neu" on unseen gifts, "?" tiles for what is
//                   still to come, the counts, and the one next goal (getRewards().goals).
//   3 topics        only practised topics: stars (see topicStars), up to 4 words to practise.
//   4 trophies      Verb-Diplom medals earned (krabsy_verb_diplom) and weeks with 3 practice
//                   sessions (krabsy_practice_v1). No row when there is nothing.
//   class           krabsy_class (krabsy-class.js): the badge next to the title.
// A section = the topics with a URL in this language (topics.json), like the landing pages.
// No emojis: icons come from lib/icons/krabsy-icons.svg (ki-shell, ki-gift, ki-star, ki-class).
import { onShellsChange, getShells } from '/lib/krabsy-shells.js';
import { getRewards, onRewardsChange } from '/lib/krabsy-rewards.js';
import { FREE_CHARS, parseId, itemName, itemImage } from '/lib/krabsy-figure-catalog.js';
import { hasData, readTopicItems } from '/lib/krabsy-stats.js?v=2026-11-25';
import { savedChar, classSession, itemLabel } from '/lib/krabsy-me.js?v=2026-11-27';
import { currentLang, defaultSection, sectionsOfLang, sectionTopics, topicUrl,
  topicLearnLang, uiPage, pickLang } from '/lib/krabsy-lang.js?v=2026-11-27';
import { liveFigureBlocked, hasWebGL, whenIdle } from '/lib/krabsy-figure-live.js?v=2026-11-25';
import { KEY as WEEK_KEY, GOAL as WEEK_GOAL, ringSvg } from '/lib/krabsy-practice-week.js?v=2026-11-27l';

const LANG = currentLang();
const HOME_SECTION = defaultSection(LANG);
const FIGURE = uiPage('figure', LANG);
const CLASS_URL = uiPage('class', LANG);
const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-27b';

const T = {
  de: {
    shells: 'Muscheln', oneShell: 'Muschel',
    toNext: 'Noch {n} Muscheln bis zur nächsten Überraschung', toNextOne: 'Noch 1 Muschel bis zur nächsten Überraschung',
    allDone: 'Du hast alles gesammelt!',
    change: 'Figur ändern', build: 'Bau deine Figur',
    collection: 'Meine Sammlung', count: '{a} von {b} Figuren · {c} von {d} Sachen', isNew: 'Neu',
    secret: 'Noch geheim: das gibt es als Geschenk',
    goalLead: 'Nächstes Geschenk:',
    goal: {
      right: 'noch {n} richtige Antworten', right1: 'noch 1 richtige Antwort',
      safe: 'wenn noch {n} Wörter sitzen', safe1: 'wenn noch 1 Wort sitzt',
      days: 'noch an {n} Tagen üben', days1: 'noch an 1 Tag üben',
      diplom: 'fürs Verb-Diplom in {level}', topics: 'wenn du ein zweites Thema ausprobierst',
      shells: 'noch {n} Muscheln', shells1: 'noch 1 Muschel',
    },
    topics: 'Meine Themen', stars: '{n} von 5 Sternen', practise: 'Noch üben:', go: 'Üben', allGood: 'Sitzt gerade alles!',
    newTopic: 'Neues Thema ausprobieren',
    emptyTitle: 'Hier wachsen bald deine Sterne',
    emptyText: 'Üb 5 Minuten oder spiel ein Spiel. Für jedes Thema, das du übst, sammelst du hier Sterne.',
    play: 'Spiel ein Spiel', seeTopics: 'Themen ansehen',
    trophies: 'Meine Pokale', diplom: 'Verb-Diplom {level}', levels: { bronze: 'Bronze', silver: 'Silber', gold: 'Gold' },
    weeks: '{n} Wochen geschafft', week1: '1 Woche geschafft',
    classLabel: 'Deine Klasse',
  },
  es: {
    shells: 'caracolas', oneShell: 'caracola',
    toNext: 'Te faltan {n} caracolas para la próxima sorpresa', toNextOne: 'Te falta 1 caracola para la próxima sorpresa',
    allDone: '¡Ya lo tienes todo!',
    change: 'Cambiar personaje', build: 'Crea tu personaje',
    collection: 'Mi colección', count: '{a} de {b} personajes · {c} de {d} cosas', isNew: 'Nuevo',
    secret: 'Todavía es secreto: llega como regalo',
    goalLead: 'Próximo regalo:',
    goal: {
      right: 'te faltan {n} respuestas correctas', right1: 'te falta 1 respuesta correcta',
      safe: 'cuando te salgan {n} palabras más', safe1: 'cuando te salga 1 palabra más',
      days: 'practica {n} días más', days1: 'practica 1 día más',
      diplom: 'con el diploma de verbos de {level}', topics: 'cuando pruebes un segundo tema',
      shells: 'te faltan {n} caracolas', shells1: 'te falta 1 caracola',
    },
    topics: 'Mis temas', stars: '{n} de 5 estrellas', practise: 'Para practicar:', go: 'Practicar', allGood: '¡Ahora mismo te sale todo!',
    newTopic: 'Probar un tema nuevo',
    emptyTitle: 'Aquí pronto aparecen tus estrellas',
    emptyText: 'Practica 5 minutos o juega a un juego. Por cada tema que practiques, aquí vas juntando estrellas.',
    play: 'Jugar a un juego', seeTopics: 'Ver los temas',
    trophies: 'Mis trofeos', diplom: 'Diploma de verbos: {level}', levels: { bronze: 'bronce', silver: 'plata', gold: 'oro' },
    weeks: '{n} semanas logradas', week1: '1 semana lograda',
    classLabel: 'Tu clase',
  },
  en: {
    shells: 'shells', oneShell: 'shell',
    toNext: '{n} more shells to the next surprise', toNextOne: '1 more shell to the next surprise',
    allDone: 'You have collected everything!',
    change: 'Change figure', build: 'Build your figure',
    collection: 'My collection', count: '{a} of {b} figures · {c} of {d} things', isNew: 'New',
    secret: 'Still a secret: it comes as a gift',
    goalLead: 'Next gift:',
    goal: {
      right: '{n} more right answers', right1: '1 more right answer',
      safe: 'when you know {n} more words well', safe1: 'when you know 1 more word well',
      days: 'practise on {n} more days', days1: 'practise on 1 more day',
      diplom: 'for the verb diploma in {level}', topics: 'when you try a second topic',
      shells: '{n} more shells', shells1: '1 more shell',
    },
    topics: 'My topics', stars: '{n} of 5 stars', practise: 'Still to practise:', go: 'Practise', allGood: 'Right now you know them all!',
    newTopic: 'Try a new topic',
    emptyTitle: 'Your stars will grow here',
    emptyText: 'Practise for 5 minutes or play a game. You collect stars here for every topic you practise.',
    play: 'Play a game', seeTopics: 'See the topics',
    trophies: 'My trophies', diplom: 'Verb diploma: {level}', levels: { bronze: 'bronze', silver: 'silver', gold: 'gold' },
    weeks: '{n} weeks done', week1: '1 week done',
    classLabel: 'Your class',
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
/** "Üben →": the arrow is decoration, not read out. */
function arrowLink(cls, text, href) {
  const a = link(cls, text + ' ', href);
  const arrow = el('span', '', '→'); arrow.setAttribute('aria-hidden', 'true');
  a.append(arrow);
  return a;
}
function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
}
const fetchJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const SVG_NS = 'http://www.w3.org/2000/svg';
/** An icon of the Krabsy set (lib/icons/krabsy-icons.svg), decorative. */
function icon(name, cls) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'ki' + (cls ? ' ' + cls : ''));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${ICONS}#ki-${name}`);
  svg.append(use);
  return svg;
}
function picture(src) {
  const img = el('img');
  img.alt = ''; img.width = 192; img.height = 192; img.loading = 'lazy'; img.decoding = 'async';
  img.onerror = () => { img.remove(); };
  img.src = src;
  return img;
}

// ------------------------------------------------------------------ 1 me: figure, shells, buttons
const char = savedChar();

function renderMe() {
  const s = getShells();
  const r = getRewards();
  const box = $('pfShells');
  if (box) {
    const count = el('p', 'pf-count');
    count.append(icon('shell', 'pf-count-ico'), el('b', '', num(s.earned)), el('span', '', s.earned === 1 ? T.oneShell : T.shells));
    const next = el('div', 'pf-next');
    if (r.complete) next.append(el('p', 'pf-next-text', T.allDone));
    else {
      const text = plural(r.toNext, T.toNextOne, T.toNext);
      const bar = el('div', 'pf-next-bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', text);
      const track = el('span', 'pf-next-track');
      const fill = el('span', 'pf-next-fill'); fill.style.width = (r.into > 0 ? Math.max(6, (r.into / r.perGift) * 100) : 0) + '%';
      track.append(fill);
      const gift = el('span', 'pf-next-gift'); gift.append(icon('gift'));
      bar.append(track, gift);
      next.append(bar, el('p', 'pf-next-text', text));
    }
    box.replaceChildren(count, next);
  }
  const btn = $('pfFigureBtn');
  if (btn) { btn.textContent = char ? T.change : T.build; if (FIGURE) btn.href = FIGURE; }
}

// The live figure, exactly as on the landing pages: drag to spin, tap to jump, a wave now
// and then. The picture is in the HTML; three.js, one character and the small animation
// file are loaded after `load` + idle, and not at all with "save data", reduced motion, a
// 2g connection, a very small device or without a graphics chip. If anything fails or the
// device can't keep up, the picture stays. For testing: ?fig=3d allows software drawing,
// ?fig=off keeps the picture.
function startFigure() {
  const root = $('pfFig'), stage = $('pfStage'), canvas = $('pfCanvas'), img = $('pfImg');
  if (!root || !stage || !canvas) return;
  if (char && img) {
    img.onerror = () => { img.onerror = null; img.src = itemImage('char', FREE_CHARS[0]); };
    img.src = itemImage('char', char);
  }
  let force = null;
  try { force = new URLSearchParams(location.search).get('fig'); } catch (_) { /* no URL API */ }
  if (force === 'off') return;
  whenIdle(async () => {
    try {
      if (liveFigureBlocked() || !hasWebGL(force !== '3d')) return;
      const { startLandingFigure } = await import('/lib/krabsy-landing-figure.js?v=2026-11-25e');
      await startLandingFigure({ root, link: $('pfFigureBtn') || stage, stage, canvas, char });
    } catch (err) {
      console.warn('profile: live figure skipped', err);
    }
  });
}

function renderClass() {
  const s = classSession();
  const box = $('pfClass');
  if (!s || !box) return;
  const text = s.name + (s.nickname ? ' · ' + s.nickname : '');
  const badge = CLASS_URL ? link('pf-class', '', CLASS_URL) : el('span', 'pf-class');
  badge.append(icon('class'), el('span', '', text));
  badge.setAttribute('aria-label', `${T.classLabel}: ${s.name}${s.nickname ? ', ' + s.nickname : ''}`);
  box.replaceChildren(badge);
  box.hidden = false;
}

// ------------------------------------------------------------------ 2 collection
/** What the child owns, newest first: gifts in the order they came (newest on top), then the
    figure the child plays, then the free figures and the starter things. */
function ownedEntries(r) {
  const owned = new Set([...FREE_CHARS.map((c) => `char:${c}`), ...getShells().owned]);
  const out = [], seen = new Set();
  const add = (id) => {
    if (seen.has(id) || !owned.has(id)) return;
    const it = parseId(id);
    if (!it) return;
    seen.add(id); out.push({ id, ...it });
  };
  for (const g of r.recent) add(g.id);
  if (char) add(`char:${char}`);
  for (const id of owned) add(id);
  return out;
}

/** The one next goal: the milestone the child is closest to, else the shell surprise. */
function nextGoal(r, withDiplom) {
  if (r.complete) return null;
  let best = null;
  for (const g of r.goals) {
    if (g.type === 'diplom' && !withDiplom) continue;
    const share = g.n > 0 ? g.have / g.n : 0;
    if (!best || share > best.share) best = { ...g, share };
  }
  // A milestone that has not even started says little: then the shells are the nearer goal.
  if (!best || (best.share <= 0 && r.into > 0)) return plural(r.toNext, T.goal.shells1, T.goal.shells);
  const left = Math.max(1, best.n - best.have);
  if (best.type === 'diplom') return fmt(T.goal.diplom, { level: T.levels[best.level] || '' });
  if (best.type === 'topics') return T.goal.topics;
  return plural(left, T.goal[best.type + '1'], T.goal[best.type]);
}

function collectionSection(withDiplom) {
  const r = getRewards();
  const sec = el('section', 'pf-section pf-coll');
  sec.id = 'pfColl'; sec.dataset.diplom = withDiplom ? '1' : '0';
  const head = el('div', 'pf-sec-head');
  head.append(el('h2', 'pf-h2', T.collection),
    el('p', 'pf-coll-count', fmt(T.count, { a: r.chars.have, b: r.chars.total, c: r.items.have, d: r.items.total })));
  sec.append(head);

  const grid = el('ul', 'pf-grid');
  const fresh = new Set(r.unseen);
  for (const e of ownedEntries(r)) {
    const li = el('li', 'pf-thing' + (e.slot === 'char' ? ' is-char' : ' is-item') + (e.slot === 'char' && e.key === char ? ' is-mine' : ''));
    const name = itemName(e.slot, e.key, LANG);
    const a = FIGURE ? link('pf-thing-a', '', `${FIGURE}#neu=${encodeURIComponent(e.id)}`) : el('span', 'pf-thing-a');
    a.title = name;
    a.setAttribute('aria-label', fresh.has(e.id) ? `${name} (${T.isNew})` : name);
    a.append(picture(itemImage(e.slot, e.key)));
    if (fresh.has(e.id)) a.append(el('span', 'pf-new', T.isNew));
    li.append(a); grid.append(li);
  }
  // "?" tiles for what is still to come: they fill the last row (see fitMystery).
  const missing = (r.chars.total - r.chars.have) + (r.items.total - r.items.have);
  grid.dataset.owned = String(grid.children.length);
  grid.dataset.missing = String(Math.max(0, missing));
  sec.append(grid);

  const goal = nextGoal(r, withDiplom);
  if (goal) {
    const p = el('p', 'pf-goal');
    p.append(icon('gift'), el('span', '', `${T.goalLead} `), el('b', '', goal));
    sec.append(p);
  }
  return sec;
}

/** As many "?" tiles as it takes to finish the last row (never more than is missing). */
function fitMystery() {
  const grid = document.querySelector('.pf-grid');
  if (!grid) return;
  const owned = Number(grid.dataset.owned) || 0, missing = Number(grid.dataset.missing) || 0;
  let cols = 6;
  try { cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 6; } catch (_) { /* keep 6 */ }
  let want = (cols - (owned % cols)) % cols;
  if (want === 0) want = Math.min(3, cols);        // a full last row: three on a new one
  want = Math.min(want, missing);
  const have = grid.querySelectorAll('.pf-mystery');
  if (have.length === want) return;
  have.forEach((n) => n.remove());
  for (let i = 0; i < want; i++) {
    const li = el('li', 'pf-thing pf-mystery');
    const q = el('span', 'pf-thing-a', '?');
    if (i === 0) { q.setAttribute('role', 'img'); q.setAttribute('aria-label', T.secret); } else q.setAttribute('aria-hidden', 'true');
    q.title = T.secret;
    li.append(q); grid.append(li);
  }
}

// ------------------------------------------------------------------ 3 topics
/* Stars per topic, 0–5. The same ladder as the tutor's skill map (docs/tutor-platform.md,
   `measure_stars` on the server), made from what this device knows (answers and mastery
   0–5 per item, no answer history):
     1  answered at all
     2  at least 5 answers, half of them right
     3  at least 10 answers, 80 % right, 4 items that sit (every answered form at mastery ≥ 4)
     4  level 3 and 40 % of the whole topic sits
     5  level 3 and 80 % of the whole topic sits   (the tutor gives the 5th star by hand)
   weak = items with a form at mastery ≤ 2, weakest first, then the most recent. */
function topicNumbers(topicId, total) {
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
  const all = Math.max(total || 0, practised, 1);
  let stars = 0;
  if (attempts > 0) stars = 1;
  if (attempts >= 5 && correct * 2 >= attempts) stars = 2;
  if (attempts >= 10 && correct >= attempts * 0.8 && safe >= Math.min(4, all)) {
    stars = 3;
    if (safe >= all * 0.4) stars = 4;
    if (safe >= all * 0.8) stars = 5;
  }
  return { attempts, stars, weak };
}

function starRow(n) {
  const row = el('span', 'pf-stars');
  row.setAttribute('role', 'img'); row.setAttribute('aria-label', fmt(T.stars, { n }));
  for (let i = 0; i < 5; i++) row.append(icon(i < n ? 'star' : 'star-off'));
  return row;
}

async function topicCard(id, t, n) {
  const hub = topicUrl(id, LANG);
  const page = (p) => (t.pages && t.pages[p] && t.pages[p][LANG] ? `${hub}${t.pages[p][LANG]}/` : null);
  const card = el('article', 'pf-topic');
  const name = pickLang(t.short_name, LANG) || pickLang(t.display_name, LANG) || id;
  const h = el('h3', 'pf-h3'); h.append(link('', name, hub));
  const head = el('div', 'pf-topic-head'); head.append(h, starRow(n.stars));
  card.append(head);

  // Up to 4 words to practise: readable labels, linked into practice where a page takes items.
  const free = page('free-practice');
  const fallback = page('sprint') || hub;
  const chips = el('div', 'pf-chips');
  const ids = [];
  for (const w of n.weak) {
    if (ids.length >= 4) break;
    const label = await itemLabel(id, w.id);
    if (!label) continue;
    const c = link('pf-chip', label, free ? `${free}?verbs=${encodeURIComponent(w.id)}` : fallback);
    c.lang = topicLearnLang(id) || 'en';
    chips.append(c);
    ids.push(w.id);
  }
  if (ids.length) {
    const box = el('div', 'pf-practise');
    box.append(el('span', 'pf-practise-label', T.practise), chips);
    card.append(box);
  } else if (n.stars >= 3) {
    card.append(el('p', 'pf-topic-good', T.allGood));
  }
  card.append(arrowLink('pf-topic-go', T.go, ids.length && free ? `${free}?verbs=${ids.map(encodeURIComponent).join(',')}` : fallback));
  return card;
}

// ------------------------------------------------------------------ 4 trophies
const MEDAL = { bronze: ['#d99a62', '#a3662f'], silver: ['#cfd5de', '#8a94a4'], gold: ['#ffcf5e', '#c98f12'] };
function medalSvg(level) {
  const [fill, rim] = MEDAL[level];
  const t = document.createElement('template');
  t.innerHTML = `<svg class="pf-medal" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path fill="#ff8585" d="M6 2.5h4.2l2.3 6.2H8.3z"/><path fill="#ff8585" d="M18 2.5h-4.2l-2.3 6.2h4.2z"/>
    <circle fill="${fill}" cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="3.1" stroke="${rim}" stroke-width="1.6"/></svg>`;
  return t.content.firstElementChild;
}
function trophySection(withDiplom) {
  const list = [];
  if (withDiplom) {
    const store = readJson('krabsy_verb_diplom') || {};
    for (const level of ['bronze', 'silver', 'gold']) {
      if (store[level] && store[level].passed) list.push([medalSvg(level), fmt(T.diplom, { level: T.levels[level] })]);
    }
  }
  const weeks = (readJson(WEEK_KEY) || {}).weeks;
  const done = weeks && typeof weeks === 'object' ? Object.values(weeks).filter((n) => Number(n) >= WEEK_GOAL).length : 0;
  if (done > 0) {
    const ring = el('span', 'pf-trophy-ring is-week-done');
    ring.innerHTML = ringSvg(WEEK_GOAL, 30);
    list.push([ring, plural(done, T.week1, T.weeks)]);
  }
  if (!list.length) return null;
  const sec = el('section', 'pf-section pf-trophies');
  const row = el('ul', 'pf-trophy-row');
  for (const [pic, text] of list) {
    const li = el('li', 'pf-trophy');
    li.append(pic, el('span', '', text));
    row.append(li);
  }
  sec.append(el('h2', 'pf-h2', T.trophies), row);
  return sec;
}

// ------------------------------------------------------------------ the page
async function renderBody() {
  const body = $('pfBody');
  const topics = await fetchJson('/data/topics.json');
  // The profile is per interface language: the topics of all its sections.
  const own = sectionsOfLang(LANG).flatMap((sec) => sectionTopics(sec));
  const mine = own.map((id) => [id, (topics || {})[id]]).filter(([, t]) => t && t.status !== 'coming_soon');
  const verbs = mine.find(([id, t]) => id === 'irregular_verbs' && t.pages && t.pages['verb-diplom'] && t.pages['verb-diplom'][LANG]);
  const frag = document.createDocumentFragment();

  frag.append(collectionSection(!!verbs));

  let any = false;
  try { any = hasData(); } catch (_) { any = false; }
  const practised = [];
  if (any) {
    for (const [id, t] of mine) {
      // "172 Verben · …": the first number of the topic's card_stats is its item count.
      const total = parseInt(((t.card_stats && t.card_stats[LANG]) || '').replace(/[.,\s]/g, '') || '', 10) || 0;
      const n = topicNumbers(id, total);
      if (n.attempts > 0) practised.push([id, t, n]);
    }
  }
  const sec = el('section', 'pf-section pf-topics-sec');
  sec.append(el('h2', 'pf-h2', T.topics));
  if (practised.length) {
    const grid = el('div', 'pf-topics');
    for (const [id, t, n] of practised) grid.append(await topicCard(id, t, n));
    sec.append(grid);
    if (practised.length < mine.length && HOME_SECTION.topics) sec.append(arrowLink('pf-link pf-more', T.newTopic, HOME_SECTION.topics));
  } else {
    // A brand-new child: an invitation, not an empty list.
    const empty = el('div', 'pf-empty');
    const crab = el('img', 'pf-empty-crab');
    crab.src = '/thumbnails/sm/crab-240.webp'; crab.alt = ''; crab.width = 240; crab.height = 240; crab.decoding = 'async';
    const txt = el('div', 'pf-empty-txt');
    const stars = el('span', 'pf-stars pf-empty-stars'); stars.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i++) stars.append(icon(i < 1 ? 'star' : 'star-off'));
    const acts = el('div', 'pf-empty-acts');
    acts.append(arrowLink('pf-btn pf-btn-coral', T.play, HOME_SECTION.games));
    if (HOME_SECTION.topics) acts.append(arrowLink('pf-btn', T.seeTopics, HOME_SECTION.topics));
    txt.append(stars, el('h3', 'pf-h3', T.emptyTitle), el('p', '', T.emptyText), acts);
    empty.append(crab, txt);
    sec.append(empty);
  }
  frag.append(sec);

  const trophies = trophySection(!!verbs);
  if (trophies) frag.append(trophies);

  body.replaceChildren(frag);
  fitMystery();
  document.documentElement.classList.add('pf-ready');
}

renderMe();
renderClass();
startFigure();
onShellsChange(renderMe);
// A gift arrived (in another tab or a game): the bar and the collection follow.
onRewardsChange(() => {
  renderMe();
  const old = $('pfColl');
  if (old) { try { old.replaceWith(collectionSection(old.dataset.diplom === '1')); fitMystery(); } catch (_) { /* keep the old one */ } }
});
let fitTimer = 0;
addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitMystery, 120); });
renderBody().catch((err) => { console.warn('profile: sections skipped', err); });
