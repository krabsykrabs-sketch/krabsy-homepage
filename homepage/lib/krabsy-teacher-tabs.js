/* Teacher pages (/de/lehrkraefte/, /es/docentes/, /en/spanish/teachers/):
   the sections are grouped into tabs (2026-11-27).

   Progressive enhancement: the HTML has every panel visible one after the
   other, and the tab bar is a plain jump menu of #links. This script turns it
   into accessible tabs (role=tablist/tab/tabpanel, arrow keys, Home/End):

   - every panel has its own hash (#loslegen, #uebungslink …); clicking a tab
     sets the hash with pushState, so the page does not jump and back/forward
     switch tabs;
   - a hash that points INTO a panel (old anchors like #quiz-raum, #faq,
     #teilen) opens that panel and scrolls to the element;
   - in-page #links (cards, "Mehr dazu") go through the same path.

   Markup: <div class="tc-tabs" data-tc-tabs> <a href="#id" data-tab="id">…</a> …
           panels: <div class="tc-panel" id="id"> … </div>                   */
(function () {
  var bar = document.querySelector('[data-tc-tabs]');
  if (!bar) return;
  var tabs = [].slice.call(bar.querySelectorAll('a[data-tab]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('data-tab')); });
  if (!tabs.length || panels.some(function (p) { return !p; })) return;

  document.documentElement.classList.add('tc-tabs-on');
  bar.setAttribute('role', 'tablist');
  tabs.forEach(function (t, i) {
    var p = panels[i];
    t.setAttribute('role', 'tab');
    t.id = 'tab-' + p.id;
    t.setAttribute('aria-controls', p.id);
    p.setAttribute('role', 'tabpanel');
    p.setAttribute('aria-labelledby', t.id);
  });

  var current = -1;

  function panelIndexFor(id) {
    if (!id) return -1;
    var el = document.getElementById(id);
    if (!el) return -1;
    for (var i = 0; i < panels.length; i++) {
      if (panels[i] === el || panels[i].contains(el)) return i;
    }
    return -1;
  }

  function keepChipVisible(t) {
    var left = t.offsetLeft, right = left + t.offsetWidth;
    if (left < bar.scrollLeft) bar.scrollLeft = Math.max(0, left - 16);
    else if (right > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = right - bar.clientWidth + 16;
  }

  function select(i, focus) {
    tabs.forEach(function (t, k) {
      var on = k === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle('is-active', on);
      panels[k].hidden = !on;
    });
    current = i;
    keepChipVisible(tabs[i]);
    if (focus) tabs[i].focus();
  }

  function headerHeight() {
    var h = document.querySelector('.k-page-header');
    return h ? h.getBoundingClientRect().height : 0;
  }

  /* Scroll so `el` sits just below the sticky header. Content above it can
     still grow afterwards (web fonts, lazy images, the link builder renders
     late), so for a few seconds the target stays pinned while the page
     resizes, until the visitor scrolls or clicks. */
  var pinned = null, pinUntil = 0;
  function place(el) {
    var y = el.getBoundingClientRect().top + window.pageYOffset - headerHeight() - 12;
    window.scrollTo({ top: Math.max(0, y), left: 0, behavior: 'instant' });  // not smooth: re-pinning must not chase an animation
  }
  function scrollToEl(el) {
    place(el);
    pinned = el;
    pinUntil = Date.now() + 3000;
  }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (e) {
    window.addEventListener(e, function () { pinned = null; }, { passive: true, capture: true });
  });
  if (window.ResizeObserver) {
    new ResizeObserver(function () {
      if (!pinned) return;
      if (Date.now() > pinUntil || pinned.closest('[hidden]')) { pinned = null; return; }
      place(pinned);
    }).observe(document.body);
  }

  /* Open the tab for the current hash; scroll to the panel (= the tab bar) or
     to the element inside it. No hash, or one we don't know: first tab. */
  function fromHash(scroll) {
    var id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
    var i = panelIndexFor(id);
    if (i < 0) {
      if (!id || current < 0) select(0);
      return;
    }
    select(i);
    if (scroll) {
      var el = document.getElementById(id);
      scrollToEl(el === panels[i] ? bar : el);
    }
  }

  function go(id, scroll) {
    if ('#' + id !== location.hash) history.pushState(null, '', '#' + id);
    fromHash(scroll);
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
      ev.preventDefault();
      go(panels[i].id, false);
      if (bar.getBoundingClientRect().top < headerHeight()) scrollToEl(bar);
    });
    t.addEventListener('keydown', function (ev) {
      var n = tabs.length, j = -1;
      if (ev.key === 'ArrowRight') j = (i + 1) % n;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = n - 1;
      if (j < 0) return;
      ev.preventDefault();
      history.replaceState(null, '', '#' + panels[j].id);
      select(j, true);
    });
  });

  /* In-page links (#quiz-raum, #uebungslink …) that point into a panel. */
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute('data-tab')) return;
    var id = a.getAttribute('href').slice(1);
    if (panelIndexFor(id) < 0) return;
    ev.preventDefault();
    go(id, true);
  });

  window.addEventListener('popstate', function () { fromHash(true); });
  window.addEventListener('hashchange', function () { fromHash(true); });

  /* First load: open the tab of the hash and scroll there once layout is ready. */
  var hadHash = panelIndexFor(location.hash.slice(1)) >= 0;
  fromHash(false);
  if (hadHash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    requestAnimationFrame(function () { fromHash(true); });
  }
})();
