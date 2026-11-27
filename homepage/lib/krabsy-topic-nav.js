/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — persistent topic + games chip-bar in the page header

   Renders a small chip-bar inside every <header class="k-page-header">
   between the logo and the language toggle:

     [krabsy]  Verben | Präpositionen | …  ·  Spiele     DE | ES

   - One chip per topic in /data/topics.json (in source order)
   - A thin "·" separator
   - A "Spiele" / "Juegos" chip linking to the cross-topic games hub
   - The chip matching the current URL gets aria-current="page" (coral fill,
     non-navigable)
   - Topics with status="coming_soon" render as inert grey chips
   - Loaded as a plain <script>, not a module, so any page (incl. iframes /
     non-ESM contexts) can use it
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var TOPICS_URL = '/data/topics.json';

  /* "Games" chip label per interface language; the link is the section's
     games page (sections.json via lib/krabsy-lang.js). */
  var GAMES_LABEL = { de: 'Spiele', es: 'Juegos', en: 'Games' };

  var NAV_LABEL = {
    de: 'Themen und Spiele',
    es: 'Temas y juegos',
    en: 'Topics and games'
  };

  var L = null;   // lib/krabsy-lang.js, loaded in render()

  /* Identify the active "destination" for this URL.
       - returns a topic id (e.g. "irregular_verbs") if the URL is under
         one of the section's topic URLs
       - returns "_games" if the URL is under the section's games page
       - returns null on the section home or unrelated pages (legal, 404) */
  function detectActive(section) {
    var path = location.pathname;
    var under = function (url) { return !!url && path.indexOf(url) === 0; };
    if (under(section.games)) return '_games';
    var ids = L.sectionTopics(section);
    for (var i = 0; i < ids.length; i++) {
      if (under(L.topicUrl(ids[i], section.ui))) return ids[i];
    }
    return null;
  }

  function buildChip(label, href, isActive, isDisabled) {
    var a = document.createElement('a');
    a.className = 'k-nav-chip';
    a.textContent = label;
    if (isActive) {
      a.setAttribute('aria-current', 'page');
      a.href = '#';
      a.addEventListener('click', function (e) { e.preventDefault(); });
    } else if (isDisabled) {
      a.classList.add('is-disabled');
      a.setAttribute('aria-disabled', 'true');
      a.href = '#';
      a.addEventListener('click', function (e) { e.preventDefault(); });
    } else {
      a.href = href;
    }
    return a;
  }

  function buildSeparator() {
    var s = document.createElement('span');
    s.className = 'k-topic-nav-sep';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '·';
    return s;
  }

  function buildNav(topics, lang, section, activeId) {
    var nav = document.createElement('nav');
    nav.className = 'k-topic-nav';
    nav.setAttribute('aria-label', NAV_LABEL[lang] || NAV_LABEL.en);

    L.sectionTopics(section).forEach(function (id) {
      var t = topics[id];
      if (!t) return;
      var label = L.pickLang(t.short_name, lang) || L.pickLang(t.display_name, lang) || id;
      var isDisabled = (t.status === 'coming_soon');
      nav.appendChild(buildChip(label, L.topicUrl(id, section.ui), id === activeId, isDisabled));
    });

    nav.appendChild(buildSeparator());
    nav.appendChild(buildChip(GAMES_LABEL[lang] || GAMES_LABEL.en, section.games, activeId === '_games', false));

    return nav;
  }

  function mount(topics) {
    var headers = document.querySelectorAll('header.k-page-header');
    if (!headers.length) return;
    var lang = L.currentLang();
    var section = L.currentSection();
    var activeId = detectActive(section);

    headers.forEach(function (header) {
      if (header.querySelector('.k-topic-nav')) return; // idempotent
      var nav = buildNav(topics, lang, section, activeId);
      var langToggle = header.querySelector('.k-lang-toggle');
      if (langToggle) {
        header.insertBefore(nav, langToggle);
      } else {
        header.appendChild(nav);
      }
    });
  }

  var _topicsPromise = null;
  function loadTopics() {
    if (!_topicsPromise) {
      _topicsPromise = fetch(TOPICS_URL, { cache: 'force-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .catch(function (err) {
          _topicsPromise = null;
          throw err;
        });
    }
    return _topicsPromise;
  }

  function render() {
    import('/lib/krabsy-lang.js?v=2026-11-27').then(function (mod) {
      L = mod;
      return loadTopics();
    }).then(mount).catch(function (err) {
      console.warn('krabsy-topic-nav: render failed', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
