/* krabsy-game-info.js — loaded by the IFRAME game wrappers
   (/<lang>/<spiele|juegos>/<id>/) now that those pages scroll to reveal the
   info text below the game.

   Problem: some games inside the same-origin iframe don't preventDefault()
   on Space / arrow keys. When the iframe document itself can't scroll, the
   browser chains that keyboard scroll to THIS page, so jumping (Space) or
   steering (arrows) would scroll the game half out of view.

   Fix: while focus is inside the game iframe, swallow the default action of
   scroll keys — unless the player is typing in a field or pressing a
   focused button/link (Space activates those). Game handlers still receive
   every key event; only the browser's scrolling is prevented. */
(function () {
  'use strict';
  var SCROLL_KEYS = { ' ': 1, Spacebar: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, PageUp: 1, PageDown: 1 };

  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
           tag === 'BUTTON' || tag === 'A' || el.isContentEditable === true;
  }

  function guard(frame) {
    var win;
    try { win = frame.contentWindow; if (!win || !win.document) return; } catch (_) { return; } // cross-origin: nothing to do
    if (win.__krabsyScrollGuard) return;
    win.__krabsyScrollGuard = true;
    win.addEventListener('keydown', function (ev) {
      if (!SCROLL_KEYS[ev.key] || ev.defaultPrevented) return;
      if (isEditable(ev.target)) return;
      ev.preventDefault();
    });
  }

  function init() {
    var frame = document.getElementById('game-frame');
    if (!frame) return;
    frame.addEventListener('load', function () { guard(frame); });
    try {
      var d = frame.contentDocument;
      if (d && d.readyState !== 'uninitialized' && d.URL !== 'about:blank') guard(frame);
    } catch (_) { /* ignore */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
