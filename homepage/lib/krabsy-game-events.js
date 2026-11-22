/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — game events for the analytics dashboard (2026-11-22)

   Games report what happens in a level so difficulty can be tuned:
   level started / won / lost, towers built, waves, coins, answers …

     import { gameEvent } from '/lib/krabsy-game-events.js';
     gameEvent('verb-towers', 'level_start', { level: 3 });
     gameEvent('verb-towers', 'tower_built', { level: 3, wave: 2, tower: 'cannon', cost: 50, coins_left: 12 });
     gameEvent('verb-towers', 'level_end', { level: 3, result: 'lost', wave: 7, lives: 0, answers: 31, correct: 24, seconds: 412 });

   Rules (the server enforces them and drops anything else):
   • game and name: lowercase slugs (a-z, 0-9, - _), max 32 chars.
   • data: a FLAT object, at most 24 keys, values = numbers, booleans or
     short slug strings ('cannon', 'lost'). No free text, no words the
     player typed, nothing about the player.
   • `level` inside data is lifted to its own field (dashboard groups by it).

   Standard names the dashboard understands for every game:
     level_start  { level }
     level_end    { level, result: 'won' | 'lost', seconds, answers, correct, … }
     A level_start without a level_end in the same page visit counts as
     "left during the level" (quit / closed the tab) — no event needed.
   Any other name is counted per level and shown with its data
   (e.g. tower_built, wave_end, tower_upgraded, tower_sold).

   Transport: the game runs in an iframe of its wrapper page, which loads
   /lib/krabsy-analytics.js. This posts the event to the parent (same
   origin); on a page without an iframe it dispatches a DOM event. The
   tracker attaches the page visit id and sends it. Nothing is stored in
   the browser. Max 300 events per page visit.
   ────────────────────────────────────────────────────────────────────────── */

export function gameEvent(game, name, data = {}) {
  const msg = { type: 'krabsy:game', game, name, data: data || {} };
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, window.location.origin);
    } else {
      window.dispatchEvent(new CustomEvent('krabsy:game', { detail: msg }));
    }
  } catch (_) { /* analytics must never break a game */ }
}
