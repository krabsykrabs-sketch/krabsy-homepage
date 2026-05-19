/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — first-party page analytics

   Two event types, both anonymous and per-page-visit:

   page_view (DOMContentLoaded)
     • path, referrer, timestamp, viewport_width, language
     • session_page_id — random UUID, scoped to this single page load only.
                         NOT a user ID; it's how heartbeats get grouped with
                         their parent page view.

   page_heartbeat (every 15s while the tab is in the foreground, plus a
   final beacon on pagehide)
     • path, session_page_id, elapsed_seconds (active foreground time)

   Visibility-aware: when the tab is hidden, the heartbeat pauses and the
   elapsed counter freezes — so elapsed_seconds reflects active foreground
   time, not wall-clock time.

   What it does NOT send:
     • user IDs, cookies, localStorage, scroll/mouse/click events
     • cross-page sessions — every page load gets a fresh session_page_id
     • full IP — the server derives country from IP then discards the IP

   Backend lives at https://api.krabsy.com (separate Coolify app). Override
   window.KRABSY_ANALYTICS_ENDPOINT or set window.KRABSY_ANALYTICS_DISABLED
   to true to opt out per page.

   Loaded as a plain <script>, not a module, so it works in arcade game
   pages that don't use ES modules.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var SHOULD_POST = true;
  var ENDPOINT = (typeof window !== 'undefined' && window.KRABSY_ANALYTICS_ENDPOINT)
    || 'https://api.krabsy.com/api/track';
  var HEARTBEAT_INTERVAL_MS = 15000;

  function shouldSkip() {
    try {
      if (window.KRABSY_ANALYTICS_DISABLED) return true;
      var host = (window.location && window.location.hostname) || '';
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
      if (host.indexOf('192.168.') === 0 || host.indexOf('10.') === 0) return true;
      var path = (window.location && window.location.pathname) || '';
      if (path.indexOf('/dashboard') === 0) return true;
    } catch (_) { /* fall through */ }
    return false;
  }

  function genId() {
    try {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) { /* fall through */ }
    // Per-page-visit fallback — does not need to be cryptographically strong.
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  // Active-foreground time bookkeeping. The page may start hidden (background
  // tab from cmd-click), so we initialise based on document.hidden.
  var sessionPageId = null;
  var pageStartMs = 0;
  var hiddenMsAccum = 0;
  var hiddenSinceMs = 0; // 0 = currently visible; else timestamp hidden began
  var fired = false;
  var heartbeatTimer = null;

  function nowMs() { return Date.now(); }

  function activeSeconds() {
    var elapsed = nowMs() - pageStartMs;
    var hidden = hiddenMsAccum + (hiddenSinceMs > 0 ? (nowMs() - hiddenSinceMs) : 0);
    var active = elapsed - hidden;
    if (active < 0) active = 0;
    return Math.floor(active / 1000);
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      if (hiddenSinceMs === 0) hiddenSinceMs = nowMs();
    } else {
      if (hiddenSinceMs > 0) {
        hiddenMsAccum += (nowMs() - hiddenSinceMs);
        hiddenSinceMs = 0;
      }
    }
  }

  function basePayload() {
    return {
      path: (window.location && window.location.pathname) || '/',
      referrer: (document.referrer && document.referrer.length) ? document.referrer : null,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth || null,
      language: (navigator && navigator.language) || null,
      session_page_id: sessionPageId,
    };
  }

  function send(payload, useBeacon) {
    if (!SHOULD_POST && !(typeof window !== 'undefined' && window.KRABSY_ANALYTICS_ENABLED)) {
      return;
    }
    var body;
    try { body = JSON.stringify(payload); } catch (_) { return; }
    try {
      if (useBeacon && navigator && navigator.sendBeacon) {
        // text/plain blob = "simple" cross-origin POST, no CORS preflight —
        // critical on pagehide when there is no time for a preflight round
        // trip. The backend parses the raw body and ignores Content-Type.
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        try { navigator.sendBeacon(ENDPOINT, blob); return; } catch (_) { /* fall through to fetch */ }
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'omit',
      }).catch(function () { /* analytics must never throw at the user */ });
    } catch (_) { /* swallow */ }
  }

  function sendPageView() {
    var p = basePayload();
    p.event_type = 'page_view';
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[krabsy-analytics] page_view', p);
    }
    send(p, false);
  }

  function sendHeartbeat(useBeacon) {
    var elapsed = activeSeconds();
    if (elapsed <= 0) return;
    var p = basePayload();
    p.event_type = 'page_heartbeat';
    p.elapsed_seconds = elapsed;
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[krabsy-analytics] heartbeat', elapsed + 's', useBeacon ? '(beacon)' : '');
    }
    send(p, !!useBeacon);
  }

  function handlePageHide() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    // If the page is being hidden right now, freeze the counter first.
    if (document.hidden && hiddenSinceMs === 0) hiddenSinceMs = nowMs();
    sendHeartbeat(true);
  }

  function fire() {
    if (fired) return;
    if (shouldSkip()) return;
    fired = true;

    sessionPageId = genId();
    pageStartMs = nowMs();
    hiddenMsAccum = 0;
    hiddenSinceMs = document.hidden ? pageStartMs : 0;

    sendPageView();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    heartbeatTimer = setInterval(function () {
      // Skip while hidden — saves bandwidth and avoids unhelpful no-op posts.
      // Background timers are throttled anyway; this is belt-and-suspenders.
      if (document.hidden) return;
      sendHeartbeat(false);
    }, HEARTBEAT_INTERVAL_MS);

    // pagehide is more reliable than beforeunload on mobile Safari. Both
    // fire on tab close / navigation; we listen to pagehide only.
    window.addEventListener('pagehide', handlePageHide);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fire, { once: true });
  } else {
    fire();
  }
})();
