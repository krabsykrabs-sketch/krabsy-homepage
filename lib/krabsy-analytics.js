/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — first-party page-load analytics
   Single fetch() POST to /api/track on every page load.

   What it sends (anonymous, per-page-load):
     • path           — window.location.pathname
     • referrer       — document.referrer or null
     • timestamp      — ISO 8601 UTC
     • viewport_width — window.innerWidth at load
     • language       — navigator.language

   What it does NOT send:
     • user IDs (none — anonymous)
     • cookies (none read or set)
     • localStorage values (none read)
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

  function buildPayload() {
    return {
      path: (window.location && window.location.pathname) || '/',
      referrer: (document.referrer && document.referrer.length) ? document.referrer : null,
      timestamp: new Date().toISOString(),
      viewport_width: window.innerWidth || null,
      language: (navigator && navigator.language) || null,
    };
  }

  function fire() {
    if (shouldSkip()) return;

    var payload;
    try { payload = buildPayload(); } catch (_) { return; }

    if (typeof console !== 'undefined' && console.debug) {
      // Visible in DevTools console under the "Verbose" filter level.
      console.debug('[krabsy-analytics]', payload);
    }

    if (!SHOULD_POST && !(typeof window !== 'undefined' && window.KRABSY_ANALYTICS_ENABLED)) {
      return;
    }

    try {
      var body = JSON.stringify(payload);
      // keepalive lets the request survive page navigation; ignored when
      // unsupported (older browsers fall back to standard fetch behavior).
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
        credentials: 'omit',
      }).catch(function () { /* analytics must never throw at the user */ });
    } catch (_) { /* swallow */ }
  }

  // Fire once the document is ready; do not block initial paint.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fire, { once: true });
  } else {
    fire();
  }
})();
