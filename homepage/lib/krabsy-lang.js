/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — interface language and sections (docs/i18n-scaling.md N1, N2)

   The one place that answers "which interface language is this?" and
   "which section (interface language × subject) am I in?". The data comes
   from data/sections.json + data/topics.json via the generated
   lib/krabsy-registry.js (tools/krabsy_registry.py), so a new language or
   section is data, not code.

     import { currentLang, currentSection, sectionTopics, gameUrl } from '/lib/krabsy-lang.js';

   Classic (non-module) scripts load it with
     import('/lib/krabsy-lang.js?v=…').then((L) => …)

   currentLang() order: the first path segment (/de/, /es/, /en/ …) →
   ?lang= → localStorage.krabsy_lang → <html lang> → the site default.
   The path wins so a game page /de/spiele/x/?lang=en keeps a German
   interface (?lang= there is the game's language). Only known interface
   languages count; `supported` narrows the result for a feature that
   exists in fewer languages (fallback: en → site default → first one).
   ────────────────────────────────────────────────────────────────────────── */

import { DEFAULT_UI, FALLBACK_UI, UI, SUBJECTS, SECTIONS, TOPICS } from './krabsy-registry.js?v=605068ffe4';

export { DEFAULT_UI, FALLBACK_UI, UI, SUBJECTS, SECTIONS, TOPICS };

/** All interface languages, in registry order. */
export const UI_LANGS = Object.keys(UI);

const LANG_KEY = 'krabsy_lang';
const isUi = (l) => typeof l === 'string' && Object.prototype.hasOwnProperty.call(UI, l);

/** Interface language from a path ("/es/juegos/" → "es"), or null. */
export function langFromPath(path) {
  const m = /^\/([a-z]{2,3})(?:\/|$)/.exec(path || '');
  return m && isUi(m[1]) ? m[1] : null;
}

function signals() {
  const out = [];
  try { out.push(langFromPath(location.pathname)); } catch (_) { /* no location */ }
  try { out.push(new URLSearchParams(location.search).get('lang')); } catch (_) { /* no location */ }
  try { out.push(localStorage.getItem(LANG_KEY)); } catch (_) { /* private mode */ }
  try { out.push((document.documentElement.lang || '').slice(0, 2).toLowerCase()); } catch (_) { /* no DOM */ }
  return out;
}

/** The interface language of this page (see the header for the order). */
export function currentLang({ supported } = {}) {
  const lang = signals().find(isUi) || DEFAULT_UI;
  if (!supported || supported.includes(lang)) return lang;
  for (const l of [FALLBACK_UI, DEFAULT_UI]) if (supported.includes(l)) return l;
  return supported[0] || lang;
}

/** Remember the interface language (language switch). */
export function setLang(lang) {
  if (!isUi(lang)) return;
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) { /* private mode */ }
}

/** Text for a language from a map ({ de, es, en, … }) or a plain string.
    Fallback (contract rule 5): lang → en → site default → any non-empty. */
export function pickLang(map, lang) {
  if (map == null) return '';
  if (typeof map === 'string') return map;
  for (const l of [lang, FALLBACK_UI, DEFAULT_UI]) if (l && typeof map[l] === 'string' && map[l]) return map[l];
  return Object.values(map).find((v) => typeof v === 'string' && v) || '';
}

/* ── sections ──────────────────────────────────────────────────────────── */

export function sectionById(id) {
  return SECTIONS.find((s) => s.id === id) || null;
}

/** First section of an interface language (de → "de", en → "en/spanish"). */
export function defaultSection(lang = currentLang()) {
  return SECTIONS.find((s) => s.ui === lang) || SECTIONS.find((s) => s.ui === DEFAULT_UI) || SECTIONS[0];
}

/** Section of a URL path: the longest section home that prefixes it, else
    the default section of the path's (or current) interface language. */
export function sectionOfPath(path) {
  let best = null;
  for (const s of SECTIONS) {
    if (path.startsWith(s.home) && (!best || s.home.length > best.home.length)) best = s;
  }
  return best || defaultSection(langFromPath(path) || currentLang());
}

/** Section of this page. A page outside the section trees (/en/privacy/,
    a game frame) gets the default section of its interface language. */
export function currentSection() {
  let path = '/';
  try { path = location.pathname; } catch (_) { /* no location */ }
  return sectionOfPath(path);
}

/** Language the topic teaches (its subject's language), e.g. 'es' for es_ser. */
export function topicLearnLang(topicId) {
  const t = TOPICS[topicId];
  return (t && t.learn) || null;
}

export function topicInSection(topicId, section) {
  const t = TOPICS[topicId];
  return !!t && !!section && t.subject === section.subject && !!t.slug[section.ui];
}

/** Topic ids of a section (registry order). */
export function sectionTopics(section = currentSection()) {
  return Object.keys(TOPICS).filter((id) => topicInSection(id, section));
}

/** Sections of an interface language (/en/ has en/spanish, later en/…). */
export function sectionsOfLang(lang = currentLang()) {
  return SECTIONS.filter((s) => s.ui === lang);
}

/** Section of an interface language that teaches this topic, or null. */
export function sectionOfTopic(topicId, lang = currentLang()) {
  return sectionsOfLang(lang).find((s) => topicInSection(topicId, s)) || null;
}

/** Games (games.json records) that play one of the section's topics. */
export function sectionGames(games, section = currentSection()) {
  const own = new Set(sectionTopics(section));
  return (games || []).filter((g) => (g.topics || []).some((t) => own.has(t)));
}

/** Section of an interface language whose games include this game (for links
    from per-language pages like the profile); default section if none. */
export function sectionOfGame(game, lang = currentLang()) {
  return sectionsOfLang(lang).find((s) => sectionGames([game], s).length) || defaultSection(lang);
}

export function gameUrl(section, gameId) {
  return `${section.games}${gameId}/`;
}

/** /de/unregelmaessige-verben/ (+ page slug) for a topic in an interface
    language; slugs in topics.json are relative to /<ui>/. */
export function topicUrl(topicId, lang, pageSlug) {
  const t = TOPICS[topicId];
  if (!t || !t.slug[lang]) return null;
  return `/${lang}/${t.slug[lang]}/${pageSlug ? pageSlug + '/' : ''}`;
}

/** Per-interface page (profile, figure, class) or null if that language has none. */
export function uiPage(key, lang = currentLang()) {
  return (UI[lang] && UI[lang][key]) || null;
}

/** On-screen accent keys for typing answers in a topic's subject. */
export function subjectKeys(topicId) {
  const t = TOPICS[topicId];
  return (t && SUBJECTS[t.subject] && SUBJECTS[t.subject].keys) || [];
}
