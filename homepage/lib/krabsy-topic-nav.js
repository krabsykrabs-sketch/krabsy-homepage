/* Krabsy — the old header chip bar (topics + games) was replaced on 2026-11-27
   by the main menu in lib/krabsy-header.js (Spielen · Üben · Themen · Profil).
   This shim stays for HTML that still loads krabsy-topic-nav.js (cached pages,
   an old generator run): it loads the new header instead. */
(function () {
  'use strict';
  try { import('/lib/krabsy-header.js?v=2026-11-27-rv').catch(function () {}); } catch (_) { /* old browser */ }
})();
