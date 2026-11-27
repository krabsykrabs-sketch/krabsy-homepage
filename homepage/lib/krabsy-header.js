/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — site header: main menu, shells, teacher link, language switch
   (owner decision 2026-11-27: "We can't put all the topics in there. Rather
   things like play, practice, etc.")

   One source for the top bar of every site page (header.k-page-header):

     [kr🦀bsy]  Spielen  Üben  Themen  Profil        🐚 240  Für Lehrkräfte  DE|ES

   - The four main items are the same in every section; their URLs come from
     data/sections.json (games, practice, topics) and the interface language
     (ui.profile), via lib/krabsy-lang.js. Labels live here (LABELS).
   - The current item gets aria-current="page" (topic pages and drills count
     as "Themen", the figure page as "Profil").
   - Phones (< 700 px): the same <nav> is shown as a tab bar fixed at the
     bottom (CSS in krabsy-ui.css, "Site header"); the top keeps the logo, the
     shells and the language switch. body.k-has-tabbar adds the bottom padding.
     The bar hides itself while a drill runs (body.k-is-playing, krabsy-nav.js),
     during the "Jetzt üben" questions (.kp-quit is on screen) and while a text
     field has focus (the on-screen keyboard would lift it over the input).
   - Game pages (/de/spiele/<id>/ …) don't load this: they keep their compact
     game header (krabsy-nav.js initGamePage) and the game fills the screen.
   - Learning-language pill (owner 2026-11-27: "a chance to see which language
     we are currently learning and the possibility to switch"): right after
     the logo, "[flag] Ich lerne / Englisch ▾". It opens a small menu built
     from data/sections.json: the subjects this interface language has
     (current one ✓) plus the subjects only other interface languages have,
     with a note ("Menüs auf Englisch"). Separate from DE|ES on purpose: the
     pill picks WHAT you learn (another section: other topics and games),
     DE|ES picks the MENU language of the same page. Phones: flag only.
   - The shell counter is krabsy-shells.js (mounted before .hd-right); the
     language buttons are wired by krabsy-lang-switch.js.

   Pages load it as   <script type="module" src="/lib/krabsy-header.js?v=…"></script>
   (krabsy-topic-nav.js is a shim that imports this, for stale cached HTML).
   Idempotent: a page may ship the markup already (the landing pages do);
   then only the current item is marked.
   ────────────────────────────────────────────────────────────────────────── */

import { currentLang, currentSection, sectionTopics, topicUrl, uiPage, setLang, SECTIONS, SUBJECTS, FALLBACK_UI } from './krabsy-lang.js?v=2026-11-27';
import { mountShellCounter } from '/lib/krabsy-shells.js';

const LABELS = {
  de: { play: 'Spielen', practise: 'Üben', topics: 'Themen', profile: 'Profil',
        teach: 'Für Lehrkräfte', teachShort: 'Lehrkräfte', nav: 'Hauptmenü', lang: 'Sprache wählen' },
  es: { play: 'Jugar', practise: 'Practicar', topics: 'Temas', profile: 'Perfil',
        teach: 'Docentes', teachShort: 'Docentes', nav: 'Menú principal', lang: 'Elegir idioma' },
  en: { play: 'Play', practise: 'Practice', topics: 'Topics', profile: 'Profile',
        teach: 'For teachers', teachShort: 'Teachers', nav: 'Main menu', lang: 'Choose language' },
};
const LANG_NAME = { de: 'Deutsch', es: 'Español', en: 'English' };

/* Learning-language pill and menu. Language names fall back to
   Intl.DisplayNames, so a new subject or interface language needs no code
   here (only a flag, else a neutral badge with the language code). */
const LEARN = {
  de: { cap: 'Ich lerne', head: 'Ich lerne …', change: 'Lernsprache wechseln', current: 'gerade ausgewählt',
        note: (ui) => `Menüs auf ${ui}`, uiGroup: 'Menüsprache' },
  es: { cap: 'Aprendo', head: 'Estoy aprendiendo …', change: 'cambiar el idioma que aprendo', current: 'seleccionado',
        note: (ui) => `Menús en ${ui}`, uiGroup: 'Idioma del menú' },
  en: { cap: "I'm learning", head: "I'm learning …", change: 'change the language you learn', current: 'selected',
        note: (ui, native) => `For ${ui} speakers (${native})`, uiGroup: 'Menu language' },
};
const LANG_IN = {   // LANG_IN[ui][lang] = name of `lang`, written in `ui`
  de: { en: 'Englisch', es: 'Spanisch', de: 'Deutsch' },
  es: { en: 'Inglés', es: 'Español', de: 'Alemán' },
  en: { en: 'English', es: 'Spanish', de: 'German' },
};
/* Menu-language button titles, each in its own language. */
const UI_TITLE = { de: 'Menüs auf Deutsch', es: 'Menús en español', en: 'Menus in English' };

function langName(lang, ui) {
  const known = LANG_IN[ui] && LANG_IN[ui][lang];
  if (known) return known;
  try {
    const n = new Intl.DisplayNames([ui], { type: 'language' }).of(lang);
    if (n && n !== lang) return n.charAt(0).toUpperCase() + n.slice(1);
  } catch (_) { /* old browser */ }
  return lang.toUpperCase();
}
/* Name inside a sentence ("Menús en inglés"): Spanish keeps language names lowercase. */
const inSentence = (name, ui) => (ui === 'es' ? name.toLowerCase() : name);

/* Flags as inline SVG (emoji flags don't render on Windows). 3:2 box; the UK
   flag (2:1) is cropped at the sides. */
let flagSeq = 0;
const FLAGS = {
  en: () => {
    const id = `kfl${++flagSeq}`;
    return `<svg class="k-flag" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
      + `<clipPath id="${id}"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>`
      + '<rect width="60" height="30" fill="#012169"/>'
      + '<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>'
      + `<path d="M0,0L60,30M60,0L0,30" clip-path="url(#${id})" stroke="#c8102e" stroke-width="4"/>`
      + '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>'
      + '<path d="M30,0v30M0,15h60" stroke="#c8102e" stroke-width="6"/></svg>';
  },
  es: () => '<svg class="k-flag" viewBox="0 0 3 2" aria-hidden="true" focusable="false">'
    + '<rect width="3" height="2" fill="#c60b1e"/><rect y="0.5" width="3" height="1" fill="#ffc400"/></svg>',
  de: () => '<svg class="k-flag" viewBox="0 0 5 3" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
    + '<rect width="5" height="1" fill="#000"/><rect y="1" width="5" height="1" fill="#dd0000"/><rect y="2" width="5" height="1" fill="#ffce00"/></svg>',
  fr: () => '<svg class="k-flag" viewBox="0 0 3 2" aria-hidden="true" focusable="false">'
    + '<rect width="1" height="2" fill="#002654"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce1126"/></svg>',
};
const flagSvg = (lang) => (FLAGS[lang] ? FLAGS[lang]()
  : `<span class="k-flag k-flag-code" aria-hidden="true">${String(lang).toUpperCase()}</span>`);
const CHEVRON = '<svg class="k-learn-chev" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg class="k-learn-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SECTION_KEY = 'krabsy_section';

/* Fallback for a cached krabsy-registry.js from before sections had `topics`. */
const TOPICS_PAGE = { de: '/de/themen/', es: '/es/temas/', 'en/spanish': '/en/spanish/topics/' };

/* Icons (lib/icons/krabsy-icons.svg style: 24 px grid, ink outline, palette
   fills). Inline so the bar needs no extra request. */
const SVG = (body) => `<svg class="k-mn-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICONS = {
  play: SVG('<path fill="#2ee6c0" d="M7.5 7h9a4.5 4.5 0 0 1 4.4 3.6l1 5a2.8 2.8 0 0 1-4.8 2.4L15 16H9l-2.1 2a2.8 2.8 0 0 1-4.8-2.4l1-5A4.5 4.5 0 0 1 7.5 7z"/><path d="M7.5 10.5v3M6 12h3"/><circle fill="#2c2a3a" stroke="none" cx="15.5" cy="11" r="1.1"/><circle fill="#2c2a3a" stroke="none" cx="17.6" cy="13.2" r="1.1"/>'),
  practise: SVG('<path fill="#ffcf5e" d="M4 20l1-4.6L15.4 5a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L8.6 19 4 20z"/><path fill="#ff8585" d="M15.4 5a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3l-1.4 1.4-3.6-3.6z"/><path d="M5 15.4l3.6 3.6"/>'),
  topics: SVG('<rect fill="#2ee6c0" x="3.5" y="3.5" width="7" height="7" rx="2"/><rect fill="#ffcf5e" x="13.5" y="3.5" width="7" height="7" rx="2"/><rect fill="#ffcf5e" x="3.5" y="13.5" width="7" height="7" rx="2"/><rect fill="#2ee6c0" x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
  profile: SVG('<circle fill="#ffcf5e" cx="12" cy="8.2" r="4"/><path fill="#ff8585" d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/>'),
};
const TEACH_ICON = '<svg class="k-hd-teach-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="#2c2a3a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11.5V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5"/><path fill="#2ee6c0" d="M12 4.5 2.5 9.2 12 14l9.5-4.8z"/><path d="M21.5 9.2v5"/></svg>';

function under(path, url) { return !!url && path.indexOf(url) === 0; }

/** Which main item is this page? 'play' | 'practice' | 'topics' | 'profile' | null. */
export function activeItem(section, lang, path = location.pathname) {
  if (under(path, section.games)) return 'play';
  if (under(path, section.practice)) return 'practise';
  if (under(path, section.topics || TOPICS_PAGE[section.id])) return 'topics';
  for (const id of sectionTopics(section)) if (under(path, topicUrl(id, section.ui))) return 'topics';
  for (const k of ['profile', 'figure']) if (under(path, uiPage(k, lang))) return 'profile';
  if (/^\/(de\/mein-krabsy|es\/mi-krabsy|en\/my-krabsy)\//.test(path)) return 'profile';
  return null;
}

/** The four items of a section: [{ key, label, href }]. */
export function mainItems(section, lang) {
  const t = LABELS[lang] || LABELS.en;
  return [
    { key: 'play', label: t.play, href: section.games },
    { key: 'practise', label: t.practise, href: section.practice },
    { key: 'topics', label: t.topics, href: section.topics || TOPICS_PAGE[section.id] },
    { key: 'profile', label: t.profile, href: uiPage('profile', lang) || uiPage('profile', 'en') },
  ].filter((i) => i.href);
}

function buildNav(section, lang) {
  const t = LABELS[lang] || LABELS.en;
  const nav = document.createElement('nav');
  nav.className = 'k-mainnav';
  nav.setAttribute('aria-label', t.nav);
  nav.innerHTML = '<ul class="k-mainnav-list">' + mainItems(section, lang).map((i) =>
    `<li><a class="k-mainnav-item" data-item="${i.key}" href="${i.href}">${ICONS[i.key] || ''}<span class="k-mainnav-label">${i.label}</span></a></li>`
  ).join('') + '</ul>';
  return nav;
}

/** Language buttons for the sections with the same subject in other interface
    languages (de ↔ es today; /en/spanish/ has no counterpart, so none). */
function buildLangToggle(section, lang) {
  const peers = SECTIONS.filter((s) => s.subject === section.subject);
  if (peers.length < 2) return null;
  const g = document.createElement('div');
  g.className = 'k-lang-toggle';
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', (LABELS[lang] || LABELS.en).lang);
  for (const s of peers) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'k-lang-btn' + (s.ui === lang ? ' is-active' : '');
    b.dataset.lang = s.ui;
    b.lang = s.ui;
    b.setAttribute('aria-label', LANG_NAME[s.ui] || s.ui);
    if (s.ui === lang) b.setAttribute('aria-current', 'true');
    b.textContent = s.ui.toUpperCase();
    g.appendChild(b);
  }
  return g;
}

const subjectLang = (s) => (SUBJECTS[s.subject] && SUBJECTS[s.subject].lang) || s.subject;

/** Menu entries for the learning-language menu, from data/sections.json:
    every subject this interface language has (its own section), then the
    subjects only other interface languages have (one entry per section,
    with a "menus in …" note). A subject in the reader's own interface
    language is left out (a Spanish speaker on /es/ doesn't need "Español,
    menús en inglés"), except on the fallback interface (English): German
    or Spanish kids land there too (English laptop), so it lists everything. */
export function learnEntries(section, lang) {
  const t = LEARN[lang] || LEARN.en;
  const seen = new Set();
  const own = [];
  const other = [];
  for (const s of SECTIONS) {
    if (s.ui !== lang || seen.has(s.subject)) continue;
    seen.add(s.subject);
    own.push({ section: s, lang: subjectLang(s), name: langName(subjectLang(s), lang), note: '', current: s.id === section.id });
  }
  for (const s of SECTIONS) {
    if (seen.has(s.subject) || (subjectLang(s) === lang && lang !== FALLBACK_UI)) continue;
    other.push({ section: s, lang: subjectLang(s), name: langName(subjectLang(s), lang),
      note: t.note(inSentence(langName(s.ui, lang), lang), langName(s.ui, s.ui)), current: false });
  }
  return own.concat(other);
}

function buildLearn(section, lang) {
  const t = LEARN[lang] || LEARN.en;
  const entries = learnEntries(section, lang);
  const mine = subjectLang(section);
  const name = langName(mine, lang);
  const wrap = document.createElement('div');
  wrap.className = 'k-learn';
  const menuId = 'k-learn-menu';
  wrap.innerHTML =
    `<button type="button" class="k-learn-btn" aria-expanded="false" aria-controls="${menuId}" aria-label="${t.cap} ${name} – ${t.change}">`
    + `${flagSvg(mine)}<span class="k-learn-txt" aria-hidden="true"><span class="k-learn-cap">${t.cap}</span><span class="k-learn-name">${name}</span></span>${CHEVRON}</button>`
    + `<div class="k-learn-menu" id="${menuId}" hidden><p class="k-learn-head" id="${menuId}-h">${t.head}</p>`
    + `<ul class="k-learn-list" aria-labelledby="${menuId}-h">` + entries.map((e) =>
      `<li><a class="k-learn-item${e.current ? ' is-current' : ''}" href="${e.section.home}" data-section="${e.section.id}" data-ui="${e.section.ui}"`
      + `${e.section.ui !== lang ? ` hreflang="${e.section.ui}"` : ''}${e.current ? ' aria-current="true"' : ''}>`
      + `${flagSvg(e.lang)}<span class="k-learn-item-txt"><span class="k-learn-item-name">${e.name}</span>`
      + `${e.note ? `<span class="k-learn-item-note">${e.note}</span>` : ''}</span>`
      + `${e.current ? `${CHECK}<span class="k-sr-only">${t.current}</span>` : ''}</a></li>`).join('')
    + '</ul></div>';

  const btn = wrap.querySelector('.k-learn-btn');
  const menu = wrap.querySelector('.k-learn-menu');
  const items = () => Array.from(menu.querySelectorAll('.k-learn-item'));
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';
  const open = (focusFirst) => {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    if (focusFirst) (items().find((a) => a.classList.contains('is-current')) || items()[0] || btn).focus();
  };
  const close = (refocus) => {
    if (!isOpen()) return;
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    wrap.classList.remove('is-open');
    if (refocus) btn.focus();
  };
  btn.addEventListener('click', () => (isOpen() ? close(false) : open(btn.matches(':focus-visible'))));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); open(true); }
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); e.stopPropagation(); close(true); return; }
    if (!isOpen() || !menu.contains(document.activeElement)) return;
    const list = items();
    const i = list.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = list[(i + 1) % list.length];
    else if (e.key === 'ArrowUp') next = list[(i - 1 + list.length) % list.length];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    if (next) { e.preventDefault(); next.focus(); }
  });
  wrap.addEventListener('focusout', (e) => { if (isOpen() && !wrap.contains(e.relatedTarget)) close(false); });
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !wrap.contains(e.target)) close(false); });
  // Remember the pick like the interface language (no automatic redirects anywhere).
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('.k-learn-item');
    if (!a) return;
    try { localStorage.setItem(SECTION_KEY, a.dataset.section); } catch (_) { /* private mode */ }
    setLang(a.dataset.ui);
  });
  return wrap;
}

function buildTeach(section, lang) {
  const t = LABELS[lang] || LABELS.en;
  const a = document.createElement('a');
  a.className = 'k-hd-teach';
  a.href = section.teachers;
  a.setAttribute('aria-label', t.teach);   // the short/long spans swap by width
  a.innerHTML = `${TEACH_ICON}<span class="k-hd-teach-long">${t.teach}</span><span class="k-hd-teach-short" aria-hidden="true">${t.teachShort}</span>`;
  return a;
}

function markCurrent(header, section, lang) {
  const key = activeItem(section, lang);
  header.querySelectorAll('.k-mainnav-item').forEach((a) => {
    if (a.dataset.item === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const teach = header.querySelector('.k-hd-teach');
  if (teach && under(location.pathname, section.teachers)) teach.setAttribute('aria-current', 'page');
}

/* Hide the bottom bar while a text field has focus (phones: the on-screen
   keyboard would push the fixed bar up over the input). */
function watchTyping() {
  const isField = (el) => el && (el.tagName === 'TEXTAREA' || el.isContentEditable
    || (el.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|range|color|file|image|hidden)$/i.test(el.type)));
  document.addEventListener('focusin', (e) => { if (isField(e.target)) document.body.classList.add('k-typing'); });
  document.addEventListener('focusout', () => { document.body.classList.remove('k-typing'); });
}



/* Returning visitors who type krabsy.com (owner 2026-11-27): the server picks a
   section from the browser language (it can't see storage, and we use no cookies).
   If this section home was reached through that redirect and the child used
   another section last time, go there. A page opened directly or by a link is
   never redirected. */
(function returnToLastSection() {
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || !(nav.redirectCount > 0)) return;           // only after the krabsy.com/ redirect
    const here = SECTIONS.find((s) => location.pathname === s.home);
    if (!here) return;
    const last = localStorage.getItem(SECTION_KEY);
    const to = SECTIONS.find((s) => s.id === last);
    if (to && to.id !== here.id) location.replace(to.home + location.search + location.hash);
  } catch (_) { /* never break the page */ }
})();

/* ── Wrong language? (owner 2026-11-27: "we will lose any child that lands on the
   wrong language page"). The start page sends English-only browsers to the English
   interface (Spanish course); a German or Spanish child on an English laptop then
   lands in the wrong place. Guess the reader's language from the browser's
   language list, else from the time zone (never leaves the browser), and offer
   the English course in that language. Shown until closed or a language is chosen. */
const HINT_KEY = 'krabsy_langhint';
const HINT = {
  de: { text: 'Sprichst du Deutsch? Hier lernst du Englisch – mit deutschen Menüs.', go: 'Zu Krabsy auf Deutsch', close: 'Schließen' },
  es: { text: '¿Hablas español? Aquí aprendes inglés, con menús en español.', go: 'Ir a Krabsy en español', close: 'Cerrar' },
};
const TZ_DE = /^Europe\/(Berlin|Vienna|Zurich|Busingen|Vaduz|Luxembourg)$/;
const TZ_ES = /^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta|Pacific\/Galapagos|America\/(Mexico_City|Cancun|Merida|Monterrey|Matamoros|Chihuahua|Ciudad_Juarez|Ojinaga|Tijuana|Hermosillo|Mazatlan|Bahia_Banderas|Bogota|Lima|Santiago|Punta_Arenas|Buenos_Aires|Argentina\/.+|Montevideo|Caracas|Guayaquil|La_Paz|Asuncion|Guatemala|El_Salvador|Tegucigalpa|Managua|Costa_Rica|Panama|Havana|Santo_Domingo|Puerto_Rico|Sao_Paulo|Bahia|Fortaleza|Recife|Belem|Manaus))$/;
export function guessReaderLang(langs = navigator.languages || [navigator.language || ''], tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })()) {
  for (const l of langs) {
    const c = String(l || '').slice(0, 2).toLowerCase();
    if (c === 'de') return 'de';
    if (c === 'es' || c === 'pt') return 'es';
  }
  if (TZ_DE.test(tz)) return 'de';
  if (TZ_ES.test(tz)) return 'es';
  return null;
}
function mountLangHint(header, section) {
  try {
    if (localStorage.getItem(HINT_KEY)) return;
    // Only where the server guessed: after the krabsy.com/ redirect. Links from search
    // engines and teachers carry the right language (owner 2026-11-27).
    const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || !(nav.redirectCount > 0)) return;
    const guess = guessReaderLang();
    if (!guess || guess === section.ui || !HINT[guess]) return;
    const target = SECTIONS.find((s) => s.ui === guess && s.subject === 'english');
    if (!target) return;
    const done = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {} };
    // choosing a language yourself also ends it
    header.addEventListener('click', (e) => { if (e.target.closest('.k-lang-btn, .k-learn a')) done(); });
    const t = HINT[guess];
    const bar = document.createElement('div');
    bar.className = 'k-langhint';
    bar.lang = guess;
    bar.setAttribute('role', 'note');
    bar.innerHTML = `<span class="k-langhint-text"></span><a class="k-langhint-go"></a><button type="button" class="k-langhint-x">×</button>`;
    bar.querySelector('.k-langhint-text').textContent = t.text;
    const go = bar.querySelector('.k-langhint-go');
    go.textContent = t.go + ' →'; go.href = target.home;
    go.addEventListener('click', done);
    const x = bar.querySelector('.k-langhint-x');
    x.setAttribute('aria-label', t.close);
    x.addEventListener('click', () => { done(); bar.remove(); });
    if (!document.getElementById('k-langhint-css')) {
      const st = document.createElement('style');
      st.id = 'k-langhint-css';
      st.textContent = `.k-langhint{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;margin:0;padding:10px 48px 10px 16px;position:relative;
        background:#fff4d6;border-bottom:2px solid #ffcf5e;color:#2c2a3a;font:600 0.98rem/1.35 'Nunito',system-ui,sans-serif;justify-content:center;text-align:center}
        .k-langhint-go{font-weight:800;color:#fff;background:#c0503a;padding:6px 14px;border-radius:999px;text-decoration:none;white-space:nowrap}
        .k-langhint-go:hover{background:#a8432f;color:#fff}
        .k-langhint-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:34px;height:34px;border:0;border-radius:50%;
        background:transparent;font-size:1.4rem;line-height:1;cursor:pointer;color:#2c2a3a}
        .k-langhint-x:hover{background:rgba(0,0,0,.06)}
        .k-langhint a:focus-visible,.k-langhint-x:focus-visible{outline:3px solid #2c2a3a;outline-offset:2px}`;
      document.head.appendChild(st);
    }
    header.insertAdjacentElement('afterend', bar);
  } catch (_) { /* never break the page */ }
}

export function mountHeader() {
  const header = document.querySelector('header.k-page-header');
  if (!header || header.classList.contains('k-hd')) return header;
  // Adult tutor pages keep their own header (they don't load this file anyway).
  if (document.querySelector('[data-tutor-page]:not([data-tutor-page="student"])')) return header;
  const lang = currentLang();
  const section = currentSection();
  header.classList.add('k-hd');

  // Old topic chips (static on the landing pages until 2026-11-27, or from a cached
  // krabsy-topic-nav.js) and the old landing teacher pill give way to the new menu.
  header.querySelectorAll(':scope > .k-topic-nav').forEach((n) => n.remove());
  header.querySelectorAll('.hd-teach').forEach((n) => n.remove());

  // The logo always comes first. An old skeleton that wraps it in a div (the
  // flashcard pages until 2026-11-27) would otherwise get the nav before it.
  let logo = header.querySelector(':scope > a.logo, :scope > a.k-logo');
  if (!logo) {
    logo = header.querySelector('a.logo, a.k-logo');
    if (logo) {
      const wrap = logo.parentElement;
      header.insertBefore(logo, header.firstChild);
      if (wrap && wrap !== header && !wrap.children.length && !wrap.textContent.trim()) wrap.remove();
    }
  }
  let nav = header.querySelector(':scope > .k-mainnav');
  if (!nav) {
    nav = buildNav(section, lang);
    if (logo) logo.insertAdjacentElement('afterend', nav);
    else header.insertBefore(nav, header.firstChild);
  }

  if (!header.querySelector('.k-learn')) {
    const learn = buildLearn(section, lang);
    if (logo) logo.insertAdjacentElement('afterend', learn);
    else header.insertBefore(learn, header.firstChild);
  }
  // Remember the section the reader is in, like krabsy_lang (nothing
  // redirects on it; pages outside the section trees may read it later).
  try { if (location.pathname.indexOf(section.home) === 0) localStorage.setItem(SECTION_KEY, section.id); } catch (_) {}

  let right = header.querySelector(':scope > .hd-right');
  if (!right) {
    right = document.createElement('div');
    right.className = 'hd-right';
    header.appendChild(right);
  }
  right.classList.add('k-hd-right');
  if (!right.querySelector('.k-hd-teach') && section.teachers) right.insertBefore(buildTeach(section, lang), right.firstChild);
  let toggle = header.querySelector('.k-lang-toggle');
  if (!toggle) toggle = buildLangToggle(section, lang);
  if (toggle && toggle.parentNode !== right) right.appendChild(toggle);
  if (toggle) {
    // "Menüsprache", not "Sprache": next to the learning-language pill the
    // two must not read as the same thing.
    toggle.setAttribute('aria-label', (LEARN[lang] || LEARN.en).uiGroup);
    toggle.querySelectorAll('.k-lang-btn').forEach((b) => {
      const l = b.dataset.lang;
      if (UI_TITLE[l]) b.title = UI_TITLE[l];
    });
  }

  markCurrent(header, section, lang);
  mountLangHint(header, section);
  document.body.classList.add('k-has-tabbar');
  watchTyping();
  try { mountShellCounter(header); } catch (_) { /* counter is optional */ }
  // Buttons built here: let the language switch wire them (it may have run first).
  try { if (window.krabsyLangSwitch) window.krabsyLangSwitch.wire(); } catch (_) {}
  // Pages that size a game frame to the viewport re-measure (bottom bar on phones).
  try { window.dispatchEvent(new Event('krabsy:header')); } catch (_) {}
  return header;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountHeader, { once: true });
else mountHeader();
