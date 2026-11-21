# Play-test: Verb Kitchen, unreleased source vs. live build (2026-11-21)

Tested: `games/verb-kitchen/` (source, merged into `main` today) against
`homepage/games/verb-kitchen/` (live build, source state of about June 16).
Both served locally; krabsy.com was not loaded.

## Verdict

**Release after small fixes.** The new version is in good shape. All seven
levels were played with real touch input on a 1024×768 tablet profile, in
German and Spanish, and each one cooked and served dishes with zero console
errors, zero 404s and no mis-registered taps. The helper bot in levels 4 and 5
delivers on time, Soup and Sundae work end to end, the German/Spanish
translation is complete, and spaced repetition plus the Cookbook persist
across reloads. Nothing in the game logic is broken. What stops a release
today is the packaging around it: the wrapper does not pass the language, the
source `index.html` lacks two fixes that exist only in the live build, 35
models are missing from the build's assets (without them **no** level starts,
not even level 1), and a straight overwrite of `src/` risks mixed old/new
modules for returning players. Each is a small, well-defined job.

## How this was tested (and what was not)

- Playwright Chromium (headless, software GL), three profiles: 1366×768
  mouse/keyboard, 1024×768 touch, 390×844 touch (plus 844×390 landscape).
- Tablet: a script drove the game with genuine touch events (tap = walk and
  act, hold = chop) aimed at the on-screen position of each station. Levels
  1–7 were each played until 1–4 dishes were served, including washing.
- Laptop: menu by mouse, movement with real WASD/arrow keys, the sink quiz
  with 1/2/3, Enter, Space and Escape. Cooking on the laptop was not replayed
  by keyboard; the game logic is the same code path as touch.
- Phone: menu, level grid, recipe card, first tutorial steps and a sink
  question in portrait and landscape. No full level.
- **Not tested:** real devices, real GPUs, audio, Safari/iPadOS, a real child.
- **Frame rate could not be measured.** The machine was heavily loaded and
  rendering was software-only; the same level measured 5–11 fps on both builds
  from run to run. The comparable numbers are in the table below (draw calls,
  triangles, game-logic cost).

Screenshots and test scripts are in
`/tmp/claude-1000/-home-janah-dev-krabsy-homepage/4525768f-4aac-49bb-aef9-e248afa09407/scratchpad/`
(`shots/`, `t*.js`, `bot.js`). That folder is temporary.

## Blockers (fix before release)

### B1. The wrapper does not pass the language; the game follows the browser language (all devices)

- The wrapper sets `localStorage.krabsy_lang` (`homepage/de/spiele/verb-kitchen/index.html:5`,
  same line in the ES page) and iframes `/games/verb-kitchen/` with no query
  (`:175`).
- The game reads only `?lang=`, then its own key `krabsy_vkitchen_lang`, then
  `navigator.language` (`games/verb-kitchen/src/i18n.js:341-350`). It never
  reads `krabsy_lang`.
- Measured through the real wrapper pages with the new build behind them:

  | Page | Browser language | Game UI |
  |---|---|---|
  | `/de/spiele/verb-kitchen/` | en-US | English |
  | `/es/juegos/verb-kitchen/` | en-US | English |
  | `/de/spiele/verb-kitchen/` | es-UY | Spanish |
  | `/es/juegos/verb-kitchen/` | de-DE | German |
  | `/es/juegos/verb-kitchen/` | es-UY | Spanish |

- A school Chromebook set to English gets English menus on the German page.
  `?lang=es` itself works and persists.
- Fix (both, a few lines): iframe `src="/games/verb-kitchen/?lang=de"` and
  `?lang=es` in the two wrappers, and in `i18n.js` fall back to `krabsy_lang`
  before `navigator.language`.

### B2. Source `index.html` lacks two fixes that exist only in the live build (all devices)

Compared with `homepage/games/verb-kitchen/index.html`, `games/verb-kitchen/index.html` is missing:

- `<meta name="robots" content="noindex, indexifembedded">` (live lines 5–6,
  commit `55fb984`). Without it Google indexes the raw build again.
- The self-hosted fonts link `<link href="/lib/fonts/krabsy-fonts.css" rel="stylesheet">`
  (live line 9, commit `cc14f27`). The source still loads
  `fonts.googleapis.com` / `fonts.gstatic.com` (source lines 7–9); the test
  run confirmed three requests to Google. That undoes the 2026-11-12
  "no requests to Google" change and fails on networks that block the CDN.

Fix: put both into the source `index.html` so later builds keep them.
These are the only two build-only edits; every file in the live `src/` is
byte-identical to an older source commit, so no code fix lives only in the
build.

### B3. 35 models are missing from the build's `assets/`; without them no level starts (all devices)

With the source plus the live build's `assets/` unchanged, starting **level 1**
already failed: `fetch for ".../assets/models/restaurant/food_ingredient_carrot.gltf" responded with 404`.
The game preloads every item model of every level before any level
(`src/game.js:58`, `src/recipes.js:361`), so the Soup and Sundae models are
needed even for the salad level. The list is in the release procedure below.
After copying them, all seven levels loaded with 0 errors and 0 404s.

### B4. Level 7: the recipe card tells the player to do something the game rejects (all devices)

- Card text: "Grab a bowl, scoop ice cream from the flavour tubs" (DE/ES
  equally: "Coge un bol, saca bolas de las tarrinas").
- Tested: with a bowl in hand, tapping a tub does nothing: reject sound, empty
  hint bar. The crate branch only accepts empty hands
  (`src/game.js:244-254`). The working routes are: park the bowl on a counter
  and bring scoops to it, or take the scoop first and tap the rack.
- Fix, either one: let a clean plate/bowl in hand take a plateable item
  straight from a crate (a few lines in that `case 'crate'`), or reword the
  three `lvTut.sundae` texts in `src/i18n.js` and `src/levels.js:269`.
- If neither is done, release without level 7 (remove `open: true` at
  `src/levels.js:253`; it then stays locked until level 6 has a star).

### B5. Overwriting `src/` in place can give returning players a mix of old and new modules

Not observed, a risk from the setup: the game is 22 separate ES modules
loaded by relative path with no version in the URL, and
`docs/nginx-krabsy.conf` sets no `Cache-Control`. Browsers then cache each
module heuristically for some hours. A pupil who played recently can get the
new `index.html` and `main.js` with an old cached `ui.js` or `game.js`; the
new modules import names the old ones do not export, and the game stays on a
dead menu. I could not check the live response headers (krabsy.com was off
limits), so treat this as likely, not confirmed. The same history is in the
game's `CLAUDE.md` (June 13–14: one school proxy cached files across deploys,
and the permanent cure, a `Cache-Control` header on the origin, was never
added). The release procedure below avoids it by shipping the new code under a
new folder name.

## Should fix

- **Keyboard instructions on touch devices.** Tablet and phone show "WASD /
  E / Leertaste" on the menu, "E — leg es ab", "Leertaste — Teller spülen" in
  the hint bar, "Drop it on a cutting board and hold Space to chop" in
  tutorial step 2, and "drück 1 2 3" under the quiz. All strings are in
  `src/i18n.js` (`menuHint`, `tut2`, `hint*`, `quizKeys`). The live build has
  the same problem in English. Needs touch variants ("tippen", "gedrückt
  halten").
- **A slow tap on a cutting board does nothing.** A touch longer than 200 ms
  on a board the chef already stands at counts as a chop-hold
  (`src/touch.js:24`, `:103`). If the item is already chopped, nothing
  happens and the item is not picked up. My test taps of 230 ms failed this
  way three times in a row. Children tap slowly. Same code in the live build.
  Suggested: on release, if nothing was chopped, run the pick-up.
- **Recipe card picture is the salad for Soup and Sundae**
  (`src/levels.js:234`, `:267` use `Salad.png`). A salad picture above
  ice-cream instructions is confusing. Levels 4 and 5 reuse the burger
  picture, which fits.
- **Level 7 layout.** Decorative ice-cream bowls sit on the four front work
  counters and look like ingredients; a parked bowl overlaps them. No walls,
  and a strip of dead floor beyond the counters (also in level 6).
- **All seven levels are open from the start.** Levels 4–7 carry
  `open: true` with the comments "co-op test level" and "selectable for
  playtest" (`src/levels.js:106, 156, 215, 253`; gate in `src/ui.js:88`).
  Decide whether that is intended. The live build opens 3.
- **Star times are placeholders on all levels.** The test bot got the hidden
  fourth "author" star on level 1 at 0:48 (author time 1:02).
- **Level 1 now downloads the models of all levels.** First level: 186
  requests and 6.6 MB, against 126 requests and 5.6 MB in the live build.
  More requests means more exposure on poor school networks. Load item models
  per level.
- **Phone, landscape (844×390):** the menu hint pill covers the Cookbook
  button (`index.html:77`, `.menuHint`). Hide it on short screens.
- **Phone, portrait (390×844):** quiz chips wrap to two rows and the blank
  drops below `take → took →`. Readable and usable, not pretty.
- **"Co-op" in the names of levels 4 and 5** ("Split Kitchen (co-op)",
  "Cocina dividida (co-op)") suggests a second player. It is a helper bot.

## Nice to have

- A missed verb comes back as the very next question when nothing else is
  queued (`src/sink.js:101`), right after the full chain was shown. That is
  copying, not recall. The cross-round practice works properly.
- In the wrong-answer state the card still says "press 1 2 3", while Enter or
  Space continues.
- Post-level screen: the teal "author star" line is hard to read on the beige
  menu picture.
- A pot holding one wrong vegetable cannot be emptied; the player must finish
  that soup and bin it.
- "Dúo de bayas / Berry Duo" is strawberry plus chocolate.
- Images: four PNGs of 1.3–1.5 MB each, plus an unused duplicate
  `Main Menu.png` (1.5 MB). The menu costs 3.3 MB before anything is playable.
  WebP would cut that to a fraction. Same in the live build.
- 17 models in the live `assets/` are used by neither build (pepperoni, steak
  crate, corner counters and others) and `assets/JSON Levels/Pizza4.json` is
  unused.
- HUD mute and home buttons are 34×34 px on the phone.
- Time to the first verb question. The test bot, playing level 1 without
  hesitation, opened its first sink question 46–65 s after tapping Play. A
  child will need clearly longer, and the median visit is 1:39, so many
  visitors may leave before any verb appears. Unchanged from the live build,
  and an estimate, not a measurement.

## What works well

- All seven levels: layout, stations, first order and full cook-serve-wash
  loop are sane. Dishes served by touch: L1 3/3 (round finished, post screen,
  save written), L2 2, L3 1, L4 4, L5 3, L6 2, L7 3.
- Helper bot: in level 5 cheese, lettuce and tomato were on the pass counter
  when needed (3 dishes in 47 s game time); in level 4 it stocked both boards
  and parked out of the way.
- Soup: pot hints use pictures ("noch 🥔 rein"), a wrong mix is refused, soup
  does not burn.
- Sink question: always positional (`take → ___`, `take → took → ___`), never
  a grammar term as the question. "simple past" / "past participle" appear
  only as the small caption. A wrong answer shows the full chain
  (`break → broke → broken`) and a "keep washing" button.
- Spaced repetition: a miss is saved immediately; after a reload the Cookbook
  lists it under "Zum Üben"; the next round asks it first with "📖 aus deinem
  Kochbuch!"; answered right, it leaves the list, and that survives another
  reload.
- Translation: DE and ES each define all 93 EN keys plus dish names and recipe
  cards. Menus, level grid, shop, cookbook, recipe cards, tutorial banner,
  hint bar, tickets, quiz frame and post screen were seen translated. Verbs,
  the two grammar captions, the title and the character names stay English.
- Touch: no tap landed on the wrong tile in any run. Menu taps did not
  ghost-click through to a level card on either build in emulation; the new
  build also carries the shared ghost-click guard from June 16 that the live
  build lacks.

## Release procedure

The source needs no build step and no bundling: it ran unchanged from static
files once the assets were in place. `vendor/` (three 0.169 and addons, loaded
through the import map) is identical in source and build.

What I had to do to make the source run, in full:

1. Copy `index.html`, `src/`, `levels/`, `vendor/` from `games/verb-kitchen/`.
2. Copy `assets/` from `homepage/games/verb-kitchen/`.
3. Copy 35 models (70 files, 0.74 MB) from
   `/home/janah/dev/_assets/kaykit/KayKit_Restaurant_Bits_1.0_EXTRA/Assets/gltf/`
   into `assets/models/restaurant/`. Nothing else was changed.

Steps for the real release:

1. **Fix in the source first** (game session, `games/verb-kitchen/`): B1
   (`krabsy_lang` fallback in `src/i18n.js`), B2 (robots meta and
   `/lib/fonts/krabsy-fonts.css` in `index.html`), B4, and the decision on
   `open: true`.
2. **Assets.** Keep everything in `homepage/games/verb-kitchen/assets/` and
   add, each as `.gltf` plus `.bin`, from the pack folder above:
   `bowl`, `bowl_dirty`, `crate_carrots`, `crate_onions`,
   `food_icecream_cone_chocolate`, `food_ingredient_carrot`,
   `food_ingredient_carrot_chopped`, `food_ingredient_carrot_pieces`,
   `food_ingredient_onion`, `food_ingredient_onion_chopped`,
   `food_ingredient_onion_rings`, `food_ingredient_potato`,
   `food_ingredient_potato_chopped`, `food_ingredient_potato_mashed`,
   `food_stew`, `icecream_bowl_cherries`, `icecream_bowl_cookiesticks`,
   `icecream_bowl_decorated_A`, `icecream_bowl_icecream_vanilla`,
   `icecream_bowl_waffles`, `icecream_cherry`, `icecream_cone_stacked`,
   `icecream_container`, `icecream_container_icecream_chocolate`,
   `icecream_container_icecream_strawberry`,
   `icecream_container_icecream_vanilla`, `icecream_scoop`,
   `kitchencounter_innercorner_backsplash_styleB`,
   `kitchencounter_sink_backsplash_styleB`,
   `kitchencounter_straight_A_backsplash_styleB`,
   `kitchencounter_straight_B_backsplash_styleB`, `pot_A`, `pot_B`,
   `pot_B_stew`, `stove_single`.
   They all reference the atlas `restaurantbits_extra.png`, which is already
   in the build (same file as in the pack).
3. **Code, without mixing versions (B5).** Copy the new `src/` to
   `homepage/games/verb-kitchen/src-2/` and point the new `index.html` at
   `src-2/main.js`. Leave the old `src/` in place for a week or two, so a
   cached old `index.html` still finds a complete old game. Copy `levels/`
   (two new files; `salad1.json` and `pizza3.json` are unchanged) and the new
   `index.html`. `vendor/` needs no change.
4. **Wrappers** (`homepage/de/spiele/verb-kitchen/index.html`,
   `homepage/es/juegos/verb-kitchen/index.html`): iframe `src` gets `?lang=de`
   / `?lang=es`.
5. **Texts that become wrong.** Edit `tools/game_info_content.py` (block
   `"verb-kitchen"`, from line 340) and re-run `tools/render_game_info.py`:
   - DE: "die Texte im Spiel sind auf Englisch" (line 345) — menus are now
     German.
   - ES: "los textos del juego están en inglés" (line 369).
   - DE: "Es gibt drei Restaurants: Garden Bistro mit Tutorial, Burger Bar und
     Pizza Palace" (line 355) and the ES counterpart — now seven levels,
     including helper, soup and ice cream.
   - "46 Verben / 46 verbos" stays correct. The FAQ answers (orders do not
     expire, stars unlock characters) stay correct; the new patience bar is
     cosmetic.
   - JSON-LD for the game says `"inLanguage": "en"`
     (`tools/render_game_info.py:197`); consider the page language.
   - `homepage/data/games.json` and `ui_de/ui_es.json` taglines mention
     neither level count nor language. No change needed.
6. **Check locally before pushing:** serve `homepage/`, open both wrapper
   pages, start every level once, confirm 0 console errors and 0 404s, and
   confirm the German page is German with an English browser.
7. **Deploy** outside school hours in Germany and Uruguay (Coolify briefly
   404s files while swapping, which is what poisoned the school proxy in
   June). Afterwards check that `/games/verb-kitchen/src-2/main.js` and a few
   of the new models answer 200, then IndexNow for the two wrapper URLs.
8. Separately worth doing: a `Cache-Control` header for
   `/games/verb-kitchen/` in the Coolify nginx config. It is the cure named in
   the June notes and still missing from `docs/nginx-krabsy.conf`.

## Comparison: live vs. new

| | Live build | New source |
|---|---|---|
| Levels | 3 (salad, burger, pizza) | 7 (plus burger with helper, split kitchen with helper, soup, sundae); 8–10 shown as "coming soon" |
| Levels open at start | 3 | 7 |
| Game language | English only | EN / DE / ES, complete |
| Language choice | none | `?lang=`, else own saved key, else browser language; wrapper language is ignored (B1) |
| Missed verbs | re-asked within the round, listed after the level | also saved, asked first next round, removed when recalled |
| Cookbook screen | no | yes, 46 chains, practice list on top |
| Order tickets | static | patience bar and mood face (cosmetic, nothing expires), small tip for fast serves |
| Sink question format | positional, chain after a miss | same |
| Console errors / 404s | 0 / 0 | 0 / 0 with the 35 models added; level 1 fails without them |
| Requests to Google Fonts | none | 3 (B2) |
| `noindex, indexifembedded` | yes | missing (B2) |
| Menu download | 28 requests, 3.25 MB | 30 requests, 3.33 MB |
| First level (L1) download | +126 requests, +5.6 MB | +186 requests, +6.6 MB |
| All levels visited | 242 requests, 10.8 MB (3 levels) | 368 requests, 13.3 MB (7 levels) |
| Build folder on disk | 16 MB, 224 files | 17 MB, 298 files |
| Draw calls / triangles, L1–L3 | 12–14 / 16–22k | identical |
| Draw calls / triangles, L4–L7 | — | L4 23 / 28k, L5 22–25 / 32k, L6 15–19 / 20k, L7 11–14 / 18k |
| Game-logic cost per frame | under 0.1 ms | under 0.1 ms on all 7 levels |
| Touch input code (`touch.js`) | tap/hold fix present | identical file |
| Menu ghost-click guard | per element | shared guard (June 16 fix) |
| Three.js / import map / `vendor/` | vendored 0.169 | identical |
| Bundling | none | none needed |
