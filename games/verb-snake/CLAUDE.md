# Verb Snake — visual overhaul brief

You are the **game session** for Verb Snake on **Krabsy** (krabsy.com): a
free browser site where German- and Spanish-speaking kids (about 10–14)
practise English irregular verbs. Read the repo-root `CLAUDE.md` once for
the site rules, then work only in this folder. The master session releases
(copies your build to the site, deploys). You don't touch `homepage/` or
other games, and you don't push.

## Why (owner decision 2026-11-23)

The 2D games look weak next to the new 3D games (Verb Towers, Verb Kitchen,
Verb Dungeon, Verb Platformer). The owner wanted to take some offline. The
data says Verb Snake is worth saving: **median time on the page 2:09, the
longest of all games** (Verb Kitchen 1:39; Verb Slash 0:39 went offline,
Verb Flow 0:22 and Air Control 0:39 are being measured until about
2026-12-07). It is also one of the few games that works on a phone.

So: **keep the game, give it a full visual overhaul**, so it looks like it
belongs next to the 3D games. Not a 3D rebuild.

## What exists

- The game is one file, `homepage/krabsy-verb-snake.html` (~52 KB, canvas,
  emoji fruits, WebAudio), iframed by `/de/spiele/verb-snake/` and
  `/es/juegos/verb-snake/`. **Copy it here as your starting point**
  (`games/verb-snake/index.html` or split into files); the master copies
  your result back to `homepage/krabsy-verb-snake.html` (or to
  `homepage/games/verb-snake/` if it becomes several files — then the
  wrappers' iframe `src` changes; tell the master).
- Mechanics (keep them, they work): snake starts as head only, eats the
  three forms of a verb in order (`go → went → gone`), rolling form queue,
  warm-up with one fruit, speed curve 250→140 ms, input queue, D-pad on
  touch, DE/ES UI (`?lang=`).
- Already wired to the shared engine (master, 2026-11-22): a **smart verb
  queue** per game (`getChainSet({ smart: true })`) and **`recordAttempt`**
  for the 2nd/3rd form (`recordForm`). Keep both. Search for `smartQueue`
  and `recordForm`.

## The overhaul

Goal: the same game, but it looks and feels like a Krabsy game of 2026.

- **Art direction:** the warm, toy-like Krabsy style of the 3D games' key
  art (`homepage/thumbnails/hero/verb-kitchen.jpg`, `verb-towers.jpg`),
  translated to clean 2D: an illustrated board (garden / beach / sea
  floor — your proposal), a characterful snake (or a crab-themed twist —
  ask the owner), real fruit/food sprites instead of emoji, juicy feedback
  (eat squash, sparkles, combo pop, screen shake on mistakes), a start
  screen and an end screen with stars like the 3D games.
- **Images:** you may generate art with Gemini (`gemini-3-pro-image`; the
  API key is in the repo-root `.env`, never print it; billing is on). The
  master's script pattern: send the Kitchen hero image as style reference
  plus a prompt, ask for no text in the image. Keep generated originals in
  `_incoming/verb-snake-art/` (gitignored) and only the sized results in
  this folder. Sprite sheets as WebP/PNG.
- **Size:** first load ≤ 1.5 MB (it must stay a fast phone game). No CDNs,
  no third-party requests; fonts Fredoka One + Nunito self-hosted.
- **Devices:** 390×844 phone (portrait must work — this is the phone game),
  1024×768 touch tablet, 1366×768 laptop. 60 fps on a school Chromebook.
- **Rules that stay:** no grammar terms as the question (positional
  notation), chain order, form colours (base amber, 2nd teal, 3rd coral),
  DE/ES/EN UI, tone friendly.
- **Game events** for the dashboard (`docs/game-analytics.md`): add
  `level_start` / `level_end` (+ `score`, `length`, `sets`, `seconds`,
  `answers`, `correct`, `result`) via `/lib/krabsy-game-events.js`
  (dynamic import, no-op if missing).
- Optional, ask first: levels/stages with a goal (e.g. "eat 5 verbs") and
  stars, so a round has an end like the 3D games.

## Working agreement

Same as every game session: work in `games/verb-snake/` on `main`, stage
only this folder, commit with the Co-Authored-By trailer, don't push. End
each session with a Status log entry below. When it is ready for review,
say so here and message the master session.

## Status log

- 2026-11-23 — Brief written by the master session (owner: "take weak games
  offline"; data showed Snake is the most-played game, so it gets an
  overhaul instead). Nothing built yet.
