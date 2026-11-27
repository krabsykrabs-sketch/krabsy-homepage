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
   - The shell counter is krabsy-shells.js (mounted before .hd-right); the
     language buttons are wired by krabsy-lang-switch.js.

   Pages load it as   <script type="module" src="/lib/krabsy-header.js?v=…"></script>
   (krabsy-topic-nav.js is a shim that imports this, for stale cached HTML).
   Idempotent: a page may ship the markup already (the landing pages do);
   then only the current item is marked.
   ────────────────────────────────────────────────────────────────────────── */

import { currentLang, currentSection, sectionTopics, topicUrl, uiPage, SECTIONS } from './krabsy-lang.js?v=2026-11-27';
import { mountShellCounter } from '/lib/krabsy-shells.js';

const LABELS = {
  de: { play: 'Spielen', practise: 'Üben', topics: 'Themen', profile: 'Profil',
        teach: 'Für Lehrkräfte', teachShort: 'Lehrkräfte', nav: 'Hauptmenü', lang: 'Sprache wählen' },
  es: { play: 'Jugar', practise: 'Practicar', topics: 'Temas', profile: 'Perfil',
        teach: 'Docentes', teachShort: 'Docentes', nav: 'Menú principal', lang: 'Elegir idioma' },
  en: { play: 'Play', practise: 'Practise', topics: 'Topics', profile: 'Profile',
        teach: 'For teachers', teachShort: 'Teachers', nav: 'Main menu', lang: 'Choose language' },
};
const LANG_NAME = { de: 'Deutsch', es: 'Español', en: 'English' };

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

/** Which main item is this page? 'play' | 'practise' | 'topics' | 'profile' | null. */
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

  const logo = header.querySelector(':scope > a.logo, :scope > a.k-logo');
  let nav = header.querySelector(':scope > .k-mainnav');
  if (!nav) {
    nav = buildNav(section, lang);
    if (logo) logo.insertAdjacentElement('afterend', nav);
    else header.insertBefore(nav, header.firstChild);
  }

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
  if (toggle && !toggle.getAttribute('aria-label')) toggle.setAttribute('aria-label', (LABELS[lang] || LABELS.en).lang);

  markCurrent(header, section, lang);
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
