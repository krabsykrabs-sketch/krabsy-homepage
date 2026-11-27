/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — i18n for HTML attributes (aria-label, placeholder, title, …)
   Per-page applyI18n functions only handle text content via data-i18n.
   This shared helper extends that to attribute values via data-i18n-attr:

     <div aria-label="Sprache" data-i18n-attr="aria-label:common.aria_lang_toggle">

   Multiple attributes per element: separate with ";"
     data-i18n-attr="aria-label:foo; title:bar"

   Loaded as a plain <script>, fetches ui_<lang>.json once on its own for
   currentLang() (lib/krabsy-lang.js). Falls back to ui_en.json on 404.
   Page-local i18n keeps working unchanged.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function lookup(strings, path) {
    if (!strings) return null;
    return path.split('.').reduce((o, k) => (o == null ? null : o[k]), strings);
  }

  function apply(strings) {
    document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const spec = el.getAttribute('data-i18n-attr') || '';
      spec.split(';').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx < 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;
        const v = lookup(strings, key);
        if (typeof v === 'string') el.setAttribute(attr, v);
      });
    });
  }

  function load() {
    import('/lib/krabsy-lang.js?v=2026-11-27')
      .then((L) => {
        const lang = L.currentLang();
        return fetch('/data/ui_' + lang + '.json', { cache: 'no-cache' }).then((r) => {
          if (r.ok) return r.json();
          return fetch('/data/ui_' + L.FALLBACK_UI + '.json', { cache: 'no-cache' }).then((r2) => r2.json());
        });
      })
      .then(apply)
      .catch(() => { /* analytics-style: never throw at the user */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();
