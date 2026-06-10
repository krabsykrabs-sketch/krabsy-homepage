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

  var SPIELE = {
    de: { label: 'Spiele', href: '/de/spiele/', urlSegment: 'spiele' },
    es: { label: 'Juegos', href: '/es/juegos/', urlSegment: 'juegos' }
  };

  var NAV_LABEL = {
    de: 'Themen und Spiele',
    es: 'Temas y juegos'
  };

  function currentLang() {
    var m = location.pathname.match(/^\/(de|es)\//);
    if (m) return m[1];
    try {
      var ls = localStorage.getItem('krabsy_lang');
      if (ls === 'de' || ls === 'es') return ls;
    } catch (_) {}
    return 'de';
  }

  /* Identify the active "destination" for this URL.
       - returns a topic id (e.g. "irregular_verbs") if the URL is under
         /<lang>/<topic-slug>/...
       - returns "_games" if the URL is under /<lang>/spiele/ or /<lang>/juegos/
       - returns null on the language hub or unrelated pages (legal, 404) */
  function detectActive(topics, lang) {
    var path = location.pathname;
    var rest = path.replace(/^\/(de|es)\/?/, '');
    if (!rest) return null; // lang hub
    var firstSeg = rest.split('/')[0];
    if (firstSeg === SPIELE[lang].urlSegment) return '_games';
    for (var id in topics) {
      if (Object.prototype.hasOwnProperty.call(topics, id) && topics[id][lang] === firstSeg) {
        return id;
      }
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

  function buildNav(topics, lang, activeId) {
    var nav = document.createElement('nav');
    nav.className = 'k-topic-nav';
    nav.setAttribute('aria-label', NAV_LABEL[lang] || NAV_LABEL.de);

    for (var id in topics) {
      if (!Object.prototype.hasOwnProperty.call(topics, id)) continue;
      var t = topics[id];
      var label = (t.short_name && t.short_name[lang])
        || (t.display_name && t.display_name[lang])
        || id;
      var slug = t[lang];
      var href = '/' + lang + '/' + slug + '/';
      var isActive = (id === activeId);
      var isDisabled = (t.status === 'coming_soon');
      nav.appendChild(buildChip(label, href, isActive, isDisabled));
    }

    nav.appendChild(buildSeparator());

    var s = SPIELE[lang] || SPIELE.de;
    nav.appendChild(buildChip(s.label, s.href, activeId === '_games', false));

    return nav;
  }

  function mount(topics) {
    var headers = document.querySelectorAll('header.k-page-header');
    if (!headers.length) return;
    var lang = currentLang();
    var activeId = detectActive(topics, lang);

    headers.forEach(function (header) {
      if (header.querySelector('.k-topic-nav')) return; // idempotent
      var nav = buildNav(topics, lang, activeId);
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
    loadTopics().then(mount).catch(function (err) {
      console.warn('krabsy-topic-nav: render failed', err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
