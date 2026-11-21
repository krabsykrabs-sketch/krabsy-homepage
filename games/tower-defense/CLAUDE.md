# Tower Defense — game brief

You are the **game session** for the 3D tower-defense game on **Krabsy**
(krabsy.com): a free browser site where German- and Spanish-speaking kids
(about 10–14) practise English irregular verbs. Read the repo-root
`CLAUDE.md` once for the site rules, then work only in this folder. The
master session releases games (wrapper pages, `games.json`, sitemap,
deploy). You don't touch `homepage/` or other games, and you don't push
to `main` or deploy.

## Goal (owner decision 2026-11-21)

Bring this game to **Verb Kitchen quality** so it can be released. Verb
Kitchen (`games/verb-kitchen/`, live at `/de/spiele/verb-kitchen/`) is the
reference. It is a 3D Three.js game with KayKit assets, and real data shows
it works:
- A Uruguayan class played it for up to 28 minutes and came back the next day.
- Median visit 1:39.
- The low-effort 2D games lose people in 18–40 seconds.

The owner's conclusion: more polished 3D games, built with the shared CC0
asset library. Study Verb Kitchen's code and its `CLAUDE.md` before
designing anything. Especially study how its question moment is
**self-paced** (the sink), so that thinking and action never collide.

## Current state (as found 2026-11-21, untouched since July 2026)

- `td-html5-spec.md` (976 lines): the original full spec, with systems,
  balance values, formulas, UI and quiz. It describes a **2D canvas** game
  and also mentions einmaleins.de. Reuse its balance and systems where
  useful. It is not binding.
- Root `index.html`, `js/`, `css/`, `levels/`: the **2D canvas**
  implementation of that spec, about 3,700 lines.
- `TowerDefense3D/`: a **3D port** with 3 levels. It uses
  `lib/three.min.js` (Three.js **r147**, global script, not ES modules) and
  `lib/GLTFLoader.js`. All visuals are **procedural placeholder meshes**
  (`js/renderer.js`); `js/assets.js` is a stub waiting for GLB models.
  Between waves the quiz asks 2 questions about one verb (`js/quiz.js`).
- `ToolPack/`: a 2D sprite export (map, characters, props). It is probably
  irrelevant for the 3D game.
- `.claude/launch.json` points at an old path (`/home/jan/TowerDefenseHTML`).
  It is stale, so fix it or serve with
  `python3 -m http.server <port>` from the game folder.

**First task:** play both versions, read the code, then propose to the
owner a short plan: base (recommended: `TowerDefense3D/`), game design
changes, asset choice, and milestones. Get an OK before big rewrites.

## Assets: shared CC0 library

`/home/janah/dev/_assets/` (about 3.4 GB, all CC0; see its `README.md`).
Good fits for a tower defense:
- `kaykit/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA`: hex tiles, castles,
  towers, paths. This is the obvious base look.
- `kaykit/KayKit_Skeletons_1.1_EXTRA`, `KayKit_Adventurers_2.0_*`,
  `KayKit_Character_Animations_1.1`: animated enemies and characters.
- `kaykit/KayKit_FantasyWeaponsBits_1.0_FREE`, `KayKit_ResourceBits`,
  `KayKit_Forest_Nature_Pack`, `kenney/castle-kit`, `kenney/nature-kit`.
- Krabsy mascot (optional): the crab character from the owner's video
  project, `/home/janah/dev/BlobVideos/renderers/assets/crab.glb`. It is
  built from rigid named parts (eyes, lids, brows, claws, legs), and its
  rig contract is in `/home/janah/dev/BlobVideos/docs/asset_spec.md`. Ask
  the owner before using it.

Rules:
- Use **GLB/glTF only**.
- Copy only the files you actually use into this folder (e.g.
  `TowerDefense3D/assets/`).
- Keep the whole game download small; Verb Kitchen's build is about 17 MB.
  Aim for **≤ 15 MB**, and a first playable screen within a few seconds on
  a school Chromebook. Compress textures and share materials.
- Note each pack used in a credits list (CC0 needs no credit, but keep
  track).

## Engine and stack

- **Three.js, not Godot.** Godot web exports download an extra ~8–10 MB
  engine and run worse on school Chromebooks and tablets. Godot is the
  owner's tool for *videos* (e.g. a trailer of this game later), not for
  the web game.
- Upgrade to Three.js **0.169 as ES modules, vendored locally** like Verb
  Kitchen (`games/verb-kitchen/vendor/`, import map). **No CDN and no
  third-party requests at runtime.** School networks block CDNs, and the
  privacy policy promises no third parties.
- No build step required (plain static files), like Verb Kitchen.

## Hard rules for content and UX

- **Questions must never require grammar terminology** (owner mandate).
  No "Simple Past" or "Past Participle" as the question. Use positional
  notation (`go → ___ → gone` with the asked blank highlighted) or a
  sentence gap. Terms may appear only as small captions or in the
  after-answer feedback. The current 3D quiz is built around "simple past
  / past participle", so check and rework its UI.
- After a wrong answer, show the full chain (`go → went → gone`), like
  Verb Kitchen and the drills do.
- Question data: use `homepage/lib/krabsy-questions.js` (`getChainSet` /
  `getQuizSet`, topic from `?topic=`), with a small inline fallback for
  offline/file:// dev. The canonical list is `content/irregular-verbs.json`.
- **UI in German and Spanish** (verbs stay English). Pick the language via
  `?lang=de|es` or the wrapper. Verb Kitchen's English-only menus are a
  known weakness; don't repeat it.
- **First 30 seconds:** clear goal, playable within about 10 s, Level 1
  teaches by doing (no wall of text), nothing that punishes a beginner
  early.
- **Devices** (test all three):
  - 1366×768 laptop with mouse and keyboard
  - 1024×768 touch tablet/Chromebook (must be fully playable)
  - 390×844 phone (playable, or an explicit friendly message)
- Site style: palette teal `#2ee6c0`, coral `#ff8585`, amber `#ffcf5e` on
  deep navy; fonts Fredoka One and Nunito, self-hosted (copy from
  `homepage/lib/fonts/`, no Google Fonts link). Sound via WebAudio synth or
  small CC0 files.
- The built game's `index.html` must contain
  `<meta name="robots" content="noindex, indexifembedded">`. The wrapper
  page is what Google should index.

## Working agreement

- Work in the worktree `/home/janah/dev/krabsy-td` (branch
  `tower-defense`), not in the main checkout. The master session uses
  `main`.
- Commit on your branch with the Co-Authored-By trailer. Don't push to
  `main`.
- End every session by updating the **Status log** below: what changed,
  what's next, and open questions for the owner.
- The owner prefers short, step-by-step explanations in chat. Ask before
  big design decisions.
- When it's ready for review, say so in the Status log. The master
  session then play-tests and releases it to `homepage/games/tower-defense/`
  with wrappers `/de/spiele/tower-defense/` and `/es/juegos/tower-defense/`.
  The final name is open, e.g. "Verb Towers".

## Status log

- 2026-11-21 — Brief written by the master session. Nothing changed in
  the game yet.
