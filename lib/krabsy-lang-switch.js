/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — language toggle navigator
   With URLs as the authoritative source of language (/de/… vs /es/…),
   the toggle navigates to the same page in the parallel language tree.

   Loaded as a plain <script> on every chrome page. Two responsibilities:

   1. Synchronise localStorage.krabsy_lang with the URL — pages from the
      /de/ tree force "de", pages from /es/ force "es". This is the same
      job done by the tiny inline script at the top of each <head>, but
      kept here too as belt-and-braces for any page that didn't get the
      inline injection.

   2. Wire every .k-lang-btn so clicking the other language navigates to
      the equivalent URL with the prefix swapped and topic/page slugs
      translated (e.g. /de/unregelmaessige-verben/karteikarten/ →
      /es/verbos-irregulares/tarjetas/).

   Resolution order for the parallel URL:
     a. PARALLEL hardcoded overrides (legal pages whose slugs are unique)
     b. /data/topics.json (loaded once via dynamic import of krabsy-data.js)
     c. Naive prefix swap as a last-resort fallback

   Edge cases:
   - On the German Impressum / Spanish Aviso Legal pages, the parallel
     page has a different slug. The path swap (/de/X → /es/X) would lead
     to a 404. Override map below catches those four URLs.
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

  /* Cache topics.json so each click doesn't re-fetch. Resolved to a
     simplified lookup table: { '<lang>/<topicSlug>': { id, pages: { <pageSlug>: pageId } } } */
  let _topicsLookup = null;
  function loadTopicsLookup() {
    if (_topicsLookup) return _topicsLookup;
    _topicsLookup = import('/lib/krabsy-data.js')
      .then(function (mod) { return mod.loadTopics(); })
      .then(function (topics) {
        const byPath = {};
        Object.keys(topics).forEach(function (topicId) {
          const t = topics[topicId];
          ['de', 'es'].forEach(function (lang) {
            const topicSlug = t[lang];
            if (!topicSlug) return;
            const pages = {};
            const pagesById = t.pages || {};
            Object.keys(pagesById).forEach(function (pageId) {
              const pageSlug = pagesById[pageId][lang];
              if (pageSlug) pages[pageSlug] = pageId;
            });
            byPath[lang + '/' + topicSlug] = { id: topicId, pages: pages, topic: t };
          });
        });
        return byPath;
      })
      .catch(function () { return null; });
    return _topicsLookup;
  }

  /* Folder slugs that exist outside the topic tree but still differ by lang. */
  const FOLDER_PARALLEL = {
    de: { spiele: 'spiele', juegos: 'spiele' },
    es: { spiele: 'juegos', juegos: 'juegos' },
  };

  function naiveSwap(targetLang) {
    const path = window.location.pathname;
    if (!/^\/(de|es)(\/|$)/.test(path)) return '/' + targetLang + '/';
    // First swap the lang prefix, then translate any folder slug that
    // has a language-specific spelling (currently just spiele/juegos).
    const swapped = path.replace(/^\/(de|es)(\/|$)/, '/' + targetLang + '$2');
    return swapped.replace(/^\/(de|es)\/([^\/]+)(\/|$)/, function (_, lang, folder, rest) {
      const map = FOLDER_PARALLEL[lang];
      const t = (map && map[folder]) || folder;
      return '/' + lang + '/' + t + rest;
    });
  }

  /* Topic-aware parallel URL. Returns a Promise. */
  function parallelUrl(targetLang) {
    const path = window.location.pathname;

    // Hardcoded overrides for pages whose slug differs by language outside the topic tree.
    if (PARALLEL[path] && PARALLEL[path].indexOf('/' + targetLang + '/') === 0) {
      return Promise.resolve(PARALLEL[path]);
    }

    // Try the topic-aware translation for /<lang>/<topicSlug>/<pageSlug?>/
    const m = path.match(/^\/(de|es)\/([^\/]+)(?:\/([^\/]+))?\/?$/);
    if (!m) {
      return Promise.resolve(naiveSwap(targetLang));
    }
    const srcLang = m[1];
    const srcTopicSlug = m[2];
    const srcPageSlug = m[3] || null;

    return loadTopicsLookup().then(function (lookup) {
      if (!lookup) return naiveSwap(targetLang);
      const entry = lookup[srcLang + '/' + srcTopicSlug];
      if (!entry) return naiveSwap(targetLang); // not a topic-tree URL (e.g. /de/spiele/…, /de/impressum/)
      const topicSlugInTarget = entry.topic[targetLang];
      if (!topicSlugInTarget) return naiveSwap(targetLang);
      if (!srcPageSlug) return '/' + targetLang + '/' + topicSlugInTarget + '/';
      const pageId = entry.pages[srcPageSlug];
      if (!pageId) {
        // Page slug not registered in topics.json — fall back to keeping the slug as-is.
        // Better to land on a 404 than silently navigate to the topic hub.
        return '/' + targetLang + '/' + topicSlugInTarget + '/' + srcPageSlug + '/';
      }
      const pagesById = entry.topic.pages || {};
      const pageSlugInTarget = pagesById[pageId] && pagesById[pageId][targetLang];
      if (!pageSlugInTarget) return '/' + targetLang + '/' + topicSlugInTarget + '/';
      return '/' + targetLang + '/' + topicSlugInTarget + '/' + pageSlugInTarget + '/';
    }).catch(function () { return naiveSwap(targetLang); });
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
        parallelUrl(target).then(function (url) {
          window.location.href = url;
        });
      });
    });
  }

  // Kick off the topics-load eagerly so the first click feels instant.
  loadTopicsLookup();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
