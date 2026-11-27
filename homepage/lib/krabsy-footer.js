/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — site-wide footer enhancements

   Two independent responsibilities:

   1. Legal-mount: populate any <span class="k-footer-legal-mount"></span>
      with the language-appropriate pair (Impressum + Datenschutz in DE,
      Aviso Legal + Política de Privacidad in ES). This has been here
      from day one and other pages assume it works.

   2. Footer grid: render a 3-column links block (Themen / Spiele / Über)
      at the top of every <footer class="k-footer"> or <footer class="footer">.
      Driven by /data/topics.json + /games.json so new topics/games appear
      everywhere automatically.

   3. Shell counter: mounts the "🐚 240" header counter (krabsy-shells.js).

   Loaded as a plain <script>, not a module, so any page (incl. arcade
   games / non-ESM contexts) can use it.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── shared helpers ─────────────────────────────────────────────────── */

  /* Language and section come from lib/krabsy-lang.js (sections.json),
     loaded in init(). */
  var L = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ── (1) Legal-mount (legacy behavior — unchanged) ──────────────────── */

  var LEGAL_LINKS = {
    de: [
      ['Impressum',    '/de/impressum/'],
      ['Datenschutz',  '/de/datenschutz/']
    ],
    es: [
      ['Aviso Legal',            '/es/aviso-legal/'],
      ['Política de Privacidad', '/es/politica-privacidad/']
    ],
    // English interface (/en/, Spanish pilot 2026-11-24): the legal notice
    // exists in German only.
    en: [
      ['Legal notice (German)', '/de/impressum/'],
      ['Privacy',               '/en/privacy/']
    ]
  };

  function renderLegalMount() {
    var mounts = document.querySelectorAll('.k-footer-legal-mount');
    if (!mounts.length) return;
    var pairs = LEGAL_LINKS[L.currentLang()] || LEGAL_LINKS[L.DEFAULT_UI];
    var html = pairs.map(function (p, i) {
      var sep = i === 0
        ? ''
        : '<span class="k-footer-legal-sep" aria-hidden="true">·</span> ';
      return sep + '<a class="k-footer-legal-link" href="' + p[1] + '">'
        + escapeHtml(p[0]) + '</a>';
    }).join(' ');
    mounts.forEach(function (m) { m.innerHTML = html; });
  }

  /* ── (2) Footer grid ────────────────────────────────────────────────── */

  var GRID_STRINGS = {
    de: {
      themen: 'Themen',
      spiele: 'Spiele',
      ueber: 'Über',
      alle_spiele: 'Alle Spiele',
      bald: 'bald',
      kontakt: null  /* no Kontakt page yet; omit from grid */
    },
    es: {
      themen: 'Temas',
      spiele: 'Juegos',
      ueber: 'Sobre Krabsy',
      alle_spiele: 'Todos los juegos',
      bald: 'pronto',
      kontakt: null
    },
    en: {
      themen: 'Topics',
      spiele: 'Games',
      ueber: 'About',
      alle_spiele: 'All games',
      bald: 'soon',
      kontakt: null
    }
  };

  /* Teacher-page label per interface language; the link is the section's
     teachers page (sections.json). */
  var TEACHER_LABEL = { de: 'Für Lehrkräfte', es: 'Para docentes', en: 'For teachers' };

  function fetchJSON(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function buildColumn(headingText, links) {
    var col = document.createElement('div');
    col.className = 'k-footer-col';

    var h = document.createElement('div');
    h.className = 'k-footer-col-heading';
    h.textContent = headingText;
    col.appendChild(h);

    var ul = document.createElement('ul');
    links.forEach(function (link) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.textContent = link.label;
      if (link.disabled) {
        a.className = 'is-disabled';
        a.setAttribute('aria-disabled', 'true');
        a.href = '#';
        a.addEventListener('click', function (e) { e.preventDefault(); });
      } else {
        a.href = link.href;
      }
      li.appendChild(a);
      ul.appendChild(li);
    });
    col.appendChild(ul);
    return col;
  }

  function topicLinksFor(topics, lang, s, section) {
    var out = [];
    L.sectionTopics(section).forEach(function (id) {
      var t = topics[id];
      if (!t) return;
      var label = (t.short_name && t.short_name[lang])
        || (t.display_name && t.display_name[lang])
        || id;
      var disabled = (t.status === 'coming_soon');
      if (disabled) label = label + ' (' + s.bald + ')';
      out.push({
        label: label,
        href: '/' + lang + '/' + t[lang] + '/',
        disabled: disabled
      });
    });
    return out;
  }

  function gameLinksFor(gamesArr, lang, s, section) {
    var base = section.games;
    var out = [];
    L.sectionGames(gamesArr, section).forEach(function (g) {
      if (g.status === 'coming_soon') return;
      if (g.audience === 'teacher') return;   // teacher-led (Quiz-Raum): on the teacher pages
      out.push({ label: L.pickLang(g.name, lang) || g.id, href: L.gameUrl(section, g.id) });
    });
    if (out.length > 5) out = out.slice(0, 5);
    out.push({ label: s.alle_spiele + ' →', href: base });
    return out;
  }

  function aboutLinksFor(lang, section) {
    var teacher = { label: TEACHER_LABEL[lang] || TEACHER_LABEL.en, href: section.teachers };
    return [teacher].concat((LEGAL_LINKS[lang] || LEGAL_LINKS[L.DEFAULT_UI]).map(function (p) {
      return { label: p[0], href: p[1] };
    }));
  }

  function buildGrid(topics, games, lang) {
    var s = GRID_STRINGS[lang] || GRID_STRINGS.en;
    var section = L.currentSection();
    var grid = document.createElement('div');
    grid.className = 'k-footer-grid';
    grid.appendChild(buildColumn(s.themen, topicLinksFor(topics, lang, s, section)));
    grid.appendChild(buildColumn(s.spiele, gameLinksFor(games, lang, s, section)));
    grid.appendChild(buildColumn(s.ueber, aboutLinksFor(lang, section)));
    return grid;
  }

  function renderGrid(topics, games) {
    var lang = L.currentLang();
    // Match both class names because the topic hubs still use class="footer"
    // (a normalization sweep will unify these to k-footer separately).
    var footers = document.querySelectorAll('footer.k-footer, footer.footer');
    if (!footers.length) return;
    footers.forEach(function (footer) {
      if (footer.querySelector('.k-footer-grid')) return; // idempotent
      var grid = buildGrid(topics, games, lang);
      footer.insertBefore(grid, footer.firstChild);
    });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */

  /* Shell counter "🐚 240" in the site header (krabsy-shells.js, 2026-11-25).
     Game pages get theirs from krabsy-nav.js. */
  function mountShells() {
    try {
      if (!document.querySelector('header.k-page-header')) return;
      import('/lib/krabsy-shells.js').then(function (m) { m.mountShellCounter(); }).catch(function () {});
    } catch (_) { /* no dynamic import: no counter */ }
  }

  function init() {
    mountShells();
    import('/lib/krabsy-lang.js?v=2026-11-27').then(function (mod) {
      L = mod;
      renderLegalMount();
      return Promise.all([
        fetchJSON('/data/topics.json'),
        fetchJSON('/data/games.json')
      ]);
    }).then(function (results) {
      renderGrid(results[0], results[1]);
    }).catch(function (err) {
      // Grid is enhancement-only; legal-mount has already run.
      console.warn('krabsy-footer: grid render skipped:', err && err.message ? err.message : err);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
