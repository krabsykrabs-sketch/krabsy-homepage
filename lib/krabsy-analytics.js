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

   Server side (/api/track) is not yet deployed on Coolify. Until it is,
   each payload is console.debug'd so we can verify the client is wiring
   correctly. Once the backend lands, set window.KRABSY_ANALYTICS_ENDPOINT
   or change SHOULD_POST below to true and the same client will start
   sending real requests.

   Loaded as a plain <script>, not a module, so it works in arcade game
   pages that don't use ES modules.
   ────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // Flip to true (or set window.KRABSY_ANALYTICS_ENDPOINT) once /api/track
  // is reachable. Until then we log the payload so it's visible in devtools.
  var SHOULD_POST = false;
  var ENDPOINT = (typeof window !== 'undefined' && window.KRABSY_ANALYTICS_ENDPOINT)
    || '/api/track';

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
