/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — language-aware legal-link footer
   Reads localStorage.krabsy_lang and populates any <span class="k-footer-
   legal-mount"></span> with the right pair of links (Impressum + Datenschutz
   in DE, Aviso Legal + Política de Privacidad in ES).

   Loaded as a plain <script>, not a module, so arcade games or any other
   non-ESM page can use it too.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var LINKS = {
    de: [
      ['Impressum',    '/de/impressum/'],
      ['Datenschutz',  '/de/datenschutz/']
    ],
    es: [
      ['Aviso Legal',           '/es/aviso-legal/'],
      ['Política de Privacidad', '/es/politica-privacidad/']
    ]
  };

  function currentLang() {
    try { return localStorage.getItem('krabsy_lang') || 'de'; }
    catch (_) { return 'de'; }
  }

  function render() {
    var mounts = document.querySelectorAll('.k-footer-legal-mount');
    if (!mounts.length) return;
    var pairs = LINKS[currentLang()] || LINKS.de;
    var html = pairs.map(function (p, i) {
      var sep = i === 0
        ? ''
        : '<span class="k-footer-legal-sep" aria-hidden="true">·</span> ';
      var label = p[0]
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return sep + '<a class="k-footer-legal-link" href="' + p[1] + '">' + label + '</a>';
    }).join(' ');
    mounts.forEach(function (m) { m.innerHTML = html; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
