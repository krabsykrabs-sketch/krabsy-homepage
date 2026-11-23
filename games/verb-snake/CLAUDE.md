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
- 2026-11-23 — **Overhaul built, ready for review** (game session).
  Owner picked: **sunny garden** board, **cute toy snake**, **goal rounds +
  stars**.
  - Build = `index.html` + `assets/` (foods.webp 4×4 sprite sheet,
    keyart.webp, backdrop.webp). First load ≈ 260 KB + fonts. It is now
    several files, so **release to `homepage/games/verb-snake/`** (copy
    `index.html` + `assets/`) and change both wrappers' iframe `src` from
    `/krabsy-verb-snake.html` to `/games/verb-snake/`. Asset paths are
    relative; `/lib/...` imports are absolute as before.
  - Art: Gemini `gemini-3-pro-image` with the Kitchen hero as style ref
    (`tools/gen_art.py`), keyed/sized by `tools/build_assets.py`.
    Originals are in `_incoming/verb-snake-art/` (gitignored, in the
    worktree the session ran in). Snake + board are drawn in canvas (the
    board is pre-rendered once per resize).
  - Rounds: eat **5 verbs** = round won. Stars: 0 mistakes ★★★, ≤ 2 ★★,
    else ★. Mistakes = wrong order, abandoned chain, crash. Crash or a wrong
    eat with head only = round lost (retry same round). Next round: −8 ms
    per tick (curve still 250→140 by round score, floor 120); warm-up with
    one fruit only in round 1; score carries over with "Next round".
    Highest round reached is saved (`krabsy_vsnake_level`) → "Round N ▶"
    on the start screen.
  - Juice: springy fruit pop-in, open mouth when food is ahead, blink,
    tongue, squash on eat, a gulp bulge running down the body, sparkles +
    ring, the whole chain flashes big after each verb (`go → went → gone`,
    form colours), combo pop, confetti, shake + ouch face on mistakes,
    dizzy eyes on crash. HUD: round, 5 verb dots, score.
  - Kept: all mechanics, `smartQueue`, `recordForm`/`recordAttempt`, input
    queue, tap-to-turn, positional notation (`go → ___`, no grammar
    terms), form colours. D-pad gets its own strip (below the board in
    portrait, right of it in landscape) so it never covers fruit.
  - New: EN UI (`?lang=en`), Enter/Space presses the main button.
  - Events: `level_start {level}`, `level_end {level, result: won|lost,
    reason: crash|short (lost only), stars, score, length, sets, seconds,
    answers, correct, mistakes}`.
  - Tested headless (Playwright) at 390×844 touch, 1024×768 touch,
    1366×768: start/board/win/lose screens, full scripted round, events,
    61 fps, no console errors. **Not yet played by hand on a real phone.**
- 2026-11-23 — Master session merged b7a0b9e (the worktree was removed) and removed the HUD "Krabsy" text logo and the start card's "Krabsy" line (one brand look: the wrapper header already shows kr🦀bsy). Release prepared, waiting for the owner's OK.
- 2026-11-23 — **Readability pass after owner feedback** ("UI barely
  noticeable when focusing on the snake; hard to track which verbs you just
  collected; not clear you must collect them in order"). Only `index.html`
  changed, no new assets.
  - **Chain bubble on the head** (`drawHeadBubble`, `bubbleTarget`): cream
    speech bubble, `go → ___ → ___`; the open blank is a pulsing pill in the
    colour of the next form with its number badge (before a chain: amber
    blank + 1). It picks a side that is inside the fence, not ahead of the
    snake and not on a fruit, keeps that side while it stays valid, and
    eases to it. Top tracker kept and made bigger (54 px high, 21 px words).
  - **Chain beads**: the 1–3 segments right behind the head (newest next to
    the head) take the form colours and carry the word on a tag (always a
    tag: words don't fit a bead at phone size; neighbours in one row ride
    high/low so tags don't collide). A finished verb flashes 0.75 s
    (`state.chainFlash`), then the beads are teal again.
  - **Order cue**: 1/2/3 badge on every word pill; in the warm-up (round 1,
    first two verbs, `inWarmup()`) a bouncing arrow over the fruit that is
    next. The grey coach line under the tracker is only drawn when there is
    room (not at 1366×768).
  - **Wrong-order card** (`makeTeach`, 1.3 s, replaces the bubble, red
    border, −10 on its corner instead of the floating pop; shake kept).
    Three cases: skipped a form of the same verb → `go → [went] → gone̶`,
    "Erst ‚went‘, dann ‚gone‘!"; a form of another verb → eaten word crossed
    out + `go → [___] → ___`, "Erst ‚go‘ fertig machen!" (the open answer
    stays hidden); no chain yet → `[eat] → ___ → eaten̶`, "Fang mit ‚eat‘
    an!". DE/ES/EN.
  - **Start screen**: the static chips are now a canvas demo (`drawDemo`):
    numbered pills go/went/gone, a small snake gulps them 1 → 2 → 3, beads
    take the colours, then ✓; loops every 5 s; static with
    prefers-reduced-motion.
  - Kept: mechanics, chain order, `smartQueue`, `recordForm`, events, no
    grammar terms, no Krabsy text logo.
  - Checked headless at 390×844 touch, 1024×768 touch, 1366×768 (DE/ES/EN):
    start demo, bubble near all four walls + corners, beads/tags/flash, badges
    + arrow, all three card cases incl. head-only loss, 60 fps with real
    ticking, no console errors. **Not checked:** a real phone / real
    Chromebook, a full hand-played round, and that game events still reach
    the API (code untouched; the test server has no API).
