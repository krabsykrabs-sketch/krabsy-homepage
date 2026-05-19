/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — language toggle navigator
   With URLs as the authoritative source of language (/de/… vs /es/…),
   the toggle no longer just flips localStorage and reloads. It navigates
   to the same page in the parallel language tree.

   Loaded as a plain <script> on every chrome page. Two responsibilities:

   1. Synchronise localStorage.krabsy_lang with the URL — pages from the
      /de/ tree force "de", pages from /es/ force "es". This is the same
      job done by the tiny inline script at the top of each <head>, but
      kept here too as belt-and-braces for any page that didn't get the
      inline injection.

   2. Wire every .k-lang-btn so clicking the other language navigates to
      the equivalent URL with the prefix swapped (e.g. /de/drills/sprint/
      → /es/drills/sprint/). The /index.html redirect is the entry point
      for visitors without a language prefix.

   Edge cases:
   - On the German Impressum / Spanish Aviso Legal pages, the parallel
     page has a different slug. The path swap (/de/X → /es/X) would lead
     to a 404. Override map at the bottom catches those four URLs.
   - Modifier-key clicks (Cmd/Ctrl/middle button) bypass the handler so
     "open in new tab" still works.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function currentLangFromPath() {
    const m = window.location.pathname.match(/^\/(de|es)(\/|$)/);
    return m ? m[1] : null;
  }

  // Sync localStorage with URL.
  const urlLang = currentLangFromPath();
  if (urlLang) {
    try { localStorage.setItem('krabsy_lang', urlLang); } catch (_) {}
  }

  // Slug overrides for pages whose path differs by language (legal docs).
  const PARALLEL = {
    '/de/impressum/':           '/es/aviso-legal/',
    '/de/datenschutz/':         '/es/politica-privacidad/',
    '/es/aviso-legal/':         '/de/impressum/',
    '/es/politica-privacidad/': '/de/datenschutz/',
  };

  function parallelUrl(targetLang) {
    const path = window.location.pathname;
    if (PARALLEL[path]) {
      // If the override targets the requested language tree, use it.
      const override = PARALLEL[path];
      if (override.startsWith('/' + targetLang + '/')) return override;
    }
    if (/^\/(de|es)(\/|$)/.test(path)) {
      return path.replace(/^\/(de|es)(\/|$)/, '/' + targetLang + '$2');
    }
    return '/' + targetLang + '/';
  }

  function wire() {
    const current = urlLang || 'de';
    // Replace each button with a clone — this drops any listeners the
    // page itself attached (the old localStorage+reload handler) so we
    // can install our own navigate-to-parallel handler without conflict.
    document.querySelectorAll('.k-lang-btn').forEach(function (btn) {
      const fresh = btn.cloneNode(true);
      btn.parentNode.replaceChild(fresh, btn);
      fresh.classList.toggle('is-active', fresh.dataset.lang === current);
      fresh.addEventListener('click', function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button !== 0) return;
        const target = fresh.dataset.lang;
        if (!target || target === current) {
          ev.preventDefault();
          return;
        }
        ev.preventDefault();
        window.location.href = parallelUrl(target);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
