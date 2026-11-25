/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — "me" helpers shared by the landing pages' profile card
   (krabsy-landing.js) and the profile page "Mein Profil" (krabsy-profile.js).

   Small on purpose: no three.js, no stats module. Everything is read from
   localStorage on this device; nothing here may throw.

     PROFILE_URL / FIGURE_URL   the profile page and the figure builder per language
     pageLang()                 'de' | 'es' | 'en' from the URL
     savedChar()                the character id of the saved figure, or null
     portraitUrl(char)          its picture (192 × 192 webp, 3–4 KB)
     classSession()             { name, nickname } when the child joined a class
     itemLabel(topic, id)       what a child reads for a stored item id
   ────────────────────────────────────────────────────────────────────────── */

export const PROFILE_URL = { de: '/de/profil/', es: '/es/perfil/', en: '/en/my-profile/' };
export const FIGURE_URL = { de: '/de/meine-figur/', es: '/es/mi-personaje/', en: '/en/my-figure/' };

export function pageLang() {
  try {
    const m = location.pathname.match(/^\/(de|es|en)(\/|$)/);
    if (m) return m[1];
  } catch (_) { /* no location */ }
  return 'de';
}

/** Character id of the figure saved on this device (krabsy-figure.js, krabsy_figure_v2), or null.
    Only the shape is checked here; the picture falls back when the id is unknown. */
export function savedChar() {
  try {
    const f = JSON.parse(localStorage.getItem('krabsy_figure_v2') || 'null');
    if (f && typeof f.char === 'string' && /^[A-Za-z_]{1,40}$/.test(f.char)) return f.char;
  } catch (_) { /* private mode / broken JSON */ }
  return null;
}

export const DEFAULT_CHAR = 'Protagonist_A';
export const portraitUrl = (char) => `/assets/figures/portraits/${char || DEFAULT_CHAR}.webp`;

/** { name, nickname } of the class this child joined (krabsy-class.js), or null. */
export function classSession() {
  try {
    const s = JSON.parse(localStorage.getItem('krabsy_class') || 'null');
    if (s && typeof s.name === 'string' && s.name) {
      return { name: s.name, nickname: typeof s.nickname === 'string' ? s.nickname : '' };
    }
  } catch (_) { /* ignore */ }
  return null;
}

/* What a child reads for a stored item. Item ids are words only for the verbs.
     irregular_verbs  the base word                              "bring"
     prepositions     the answer in its first example sentence    "at the bus stop"
                      ("I'll meet you ___ the bus stop.")
     es_* (gap files) the item's short pattern                    "estoy en + place"
                      (else its first example, filled in: "Yo soy Lucas")
   Unknown topic or id → null (the caller shows nothing). */
const _files = new Map();
function loadItems(file) {
  if (!_files.has(file)) {
    _files.set(file, fetch('/data/' + file)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const items = Array.isArray(d) ? d : ((d && d.items) || []);
        return new Map(items.map((it) => [it.id, it]));
      })
      .catch(() => new Map()));
  }
  return _files.get(file);
}
const trimEnd = (s) => s.replace(/[.?!,;:…]+$/, '').trim();

export async function itemLabel(topic, id) {
  try {
    if (topic === 'irregular_verbs') return id;
    if (topic === 'prepositions') {
      const it = (await loadItems('prepositions.json')).get(id);
      if (!it) return null;
      const ex = (it.examples || [])[0];
      const after = ex && ex.sentence.includes('___')
        ? trimEnd(ex.sentence.split('___')[1]).split(/\s+/).slice(0, 3).join(' ')
        : '';
      return (it.correct + ' ' + after).trim();
    }
    if (/^es_[a-z_]{1,30}$/.test(topic)) {                // gap topics: /data/es-ser.json …
      const it = (await loadItems(topic.replace(/_/g, '-') + '.json')).get(id);
      if (!it) return null;
      if (typeof it.label === 'string' && it.label) return it.label;       // "estoy en + place"
      const ex = (it.examples || [])[0];
      const answer = ex && (ex.answers || [])[0];
      if (!answer || !ex.sentence.includes('___')) return null;
      const s = trimEnd(ex.sentence.replace('___', answer)).replace(/^[¡¿]+/, '');
      return s.split(/\s+/).length <= 6 ? s : null;
    }
  } catch (_) { /* fall through */ }
  return null;
}

/** 'en' for the English topics, 'es' for the Spanish ones (lang attribute of a label). */
export const labelLang = (topic) => (/^es_/.test(topic) ? 'es' : 'en');
