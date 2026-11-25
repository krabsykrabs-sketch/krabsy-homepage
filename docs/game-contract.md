# Game contract: how a Krabsy game plays any topic

Decided 2026-11-24/25 (owner + master session; background in `docs/vision.md`).
**Every new game follows this, and old games follow it when they are converted.**
The engine is described in CLAUDE.md ("Question engine"), and the topic file
format in `content/FORMAT.md`.

## The rule

A game is a mechanic, not a topic. It asks whatever topic it is given, in
whatever learning language, through the `quiz` shape of
`homepage/lib/krabsy-questions.js`. A game owns no question data apart from a
small inline fallback for `file://` and dev servers. New topics then reach
every game without any game code changing.

The `chain` shape (`go → went → gone`) stays for a few English-verb specials
(Verb Flow, Verb Snake, Air Control). Verb Kitchen, Verb Platformer and Verb
Towers started as verb games and now play sentence topics too.

## What the game must do

1. **Topic from the URL:** `KQ.topicFromUrl()` reads `?topic=`, with
   `irregular_verbs` as the default. Wrapper pages may also remember a topic
   (the Spanish pages use localStorage `krabsy_es_topic`) and pass it on.
2. **Interface language from the URL:** `?lang=de|es|en` for this visit, then
   the game's own stored choice, then `krabsy_lang` (set by the site), then
   the browser language. The interface language is not the learning language.
   A Spanish topic in an English game is normal.
3. **Pass the interface language to the engine:**
   `getQuizSet({ topic, count, withOptions, lang })`. Without `lang`, hints
   and teach lines come in the site's stored language (Verb Towers showed
   German teach lines in English until 2026-11-24).
4. **Two displays:**
   - `display.kind === 'trio'` (verbs, `go → ___ → ___`, asked blank
     highlighted);
   - `display.kind === 'gap'` (one sentence with one `___`).
     `display.sentence` already contains the hint in brackets.
     `display.plain` and `display.hint` are the separate parts, for games
     that lay them out on their own.

   **Never a grammar term as the question** (presentation mandate).
5. **Room for sentences:** about 45 characters on signs, plates and cards,
   so shrink long text rather than cut it. Fonts need á é í ó ú ñ ü ¿ ¡.
   Spanish answers may be multi-word.
6. **After a wrong answer:** verbs show the full chain. Gap questions show
   the filled sentence plus `teach.line` (in the interface language). Keep
   the chain-order rules (CLAUDE.md "Chain order").
7. **Topic-neutral texts:** menus and HUDs must not say "verbs" for other
   topics. Keep a small per-topic table:
   - pattern: `TOPIC_TEXT` in `games/tower-defense/TowerDefense3D/js/i18n.js`
     (subtitle, example line, "words to practise" heading);
   - lookup: `TOPIC_KEY = TOPIC_TEXT[TOPIC] ? TOPIC : (/^es_/.test(TOPIC) ? 'es_ser' : TOPIC)`.

   One text set covers every Spanish topic, so a new `es_*` topic needs no
   game change.
8. **Mechanics tied to verb forms need a topic-neutral rule.** Example: in
   Verb Golf a second gate row asks another sentence instead of the 3rd form.
   The verb version stays as it is.
9. **Record answers:** `recordAttempt(q.item, q.form, correct, '<game-id>', q.topic)`
   (`krabsy-stats.js`). Analytics events carry the topic.
10. **Difficulty and teacher links need no game code.**
    - `?difficulty=N` is applied inside the engine (`krabsy-data.js` `linkLevel`).
    - `?from=teacher` is only the banner on the wrapper page.
    - Exception: a game that caps difficulty itself (level tiers, its own
      verb picker) must let `difficultyFromUrl()` override that cap. The
      Platformer and Kitchen do this.
11. **Fallback:** catch the engine's throw (an unsupported topic or shape, or
    no `/lib` on a dev server) and play the small inline set.

## Test URLs (every game, before release)

- `?topic=es_ser&lang=en`: Spanish sentences, English interface (38 q)
- `?topic=es_ser_estar&lang=en&difficulty=1`: the difficulty filter
- `?topic=prepositions&lang=de`: English sentences, German interface
- no parameters: the default verbs, unchanged

Look for: no German or verb wording in other topics, long sentences fit,
teach line after a miss, 0 console errors.

## Registering a game for topics (master session)

- `homepage/data/games.json`:
  - `topics`: every topic id it plays. This decides which sections and topic
    pages show it, and what the teacher link builder offers.
  - `ui_langs`: the interface languages it has. The link builder's "language
    in the game" option comes from this.
  - `name.en` / `tagline.en`: needed for the English section.
  - optional `featured_langs`.
- **Spanish section:** add the game to `GAMES` / `GAME_TITLES` in
  `tools/build_en_spanish.py`, then run that script,
  `render_static_games.py` and `render_game_info.py`.
- The wrapper pages forward `topic`, `difficulty` and `lang` to the game frame
  (script from `render_game_info.py`). Single-file inlined games must read
  `location.search` themselves.
- 3D games with `src/` modules: run `tools/stamp_game_modules.py` after
  copying.
- **A new topic** needs no game change: content file + `TOPIC_REGISTRY` +
  `topics.json` + `api/classes.py` `TOPICS` (checklist in `content/FORMAT.md`),
  and its id goes into each game's `topics` in `games.json`.

## The player's figure (3D games, added 2026-11-25)

Every child builds one figure on the site ("Meine Figur" / "Mi personaje" /
"My figure": `/de/meine-figur/`, `/es/mi-personaje/`, `/en/my-figure/`) and
plays it in every 3D game. Background: `docs/figures-shells-world.md`. All
KayKit characters share one skeleton (Rig_Medium), so the figure drops into
any game that uses a KayKit hero.

```js
import { loadPlayerFigure } from '/lib/krabsy-figure.js';

const fig = await loadPlayerFigure({ fallback: 'Ranger', lambert: true });
scene.add(fig.root);     // THREE.Group, feet at y = 0, same skeleton as before
fig.clips                 // { Idle_A, Walking_A, Running_A, Jump_Full_Short, Interact, … }
fig.own                   // true = the child's saved figure, false = the fallback
fig.dispose()             // when the game throws the figure away
```

1. **`fallback` = the game's current hero.** A catalogue id (`CHARS` in
   `homepage/lib/krabsy-figure.js`, e.g. `'Ranger'`, `'Knight'`,
   `'Protagonist_A'`) or a full figure config. A child without a saved figure
   plays the fallback, so nothing changes for them. The fallback needs no
   unlocking. A saved figure with a locked character also gives the fallback;
   a locked accessory is replaced by the character's own.
2. **three.js comes from the game.** `krabsy-figure.js` imports `three`,
   `three/addons/loaders/GLTFLoader.js` and
   `three/addons/utils/SkeletonUtils.js` by name, so the game's import map
   must provide `three` and `three/addons/` (r169, as in all current games).
   The figure is then built with the game's own three.js copy.
3. **Load:** one character file (0.2–0.6 MB, one more for each accessory
   taken from another character) plus the two shared animation files
   (1.5 MB, the same URL for every game, so cached). Everything is under
   `/assets/figures/`. Don't copy these files into the game.
4. **Extra animation packs are fine.** The game's own clips (Kitchen, Tools,
   combat …) are on the same skeleton and play on every figure:
   `new THREE.AnimationMixer(fig.root)`. Pass `clips: false` if the game
   needs none of the shared clips.
5. **Options:** `lambert: true` (cheaper material), `hide: ['back']` (also
   `'hat'`, `'glasses'`) for accessories that don't fit the game, e.g. long
   capes in a tight dungeon.
6. **Game items are the game's, not the figure's.** A game may attach its
   own item to a bone of `fig.root` (a ladle in the kitchen, a hammer in Verb
   Towers, the sword in Verb Dungeon). The figure catalogue itself stays
   weapon-free.
7. **Hats don't count for collisions.** Keep the game's existing hit and jump
   boxes; figures differ in height (a toy soldier's hat is tall).
8. **Optional link on the start screen:** "Spiel mit deiner Figur →" /
   "Juega con tu personaje →" / "Play with your figure →" to the figure page
   (open it in the top window: the game runs in an iframe).
9. **Never throw into the game:** wrap the call, and on an error load the
   old hero the old way. On `file://` and dev servers without `/lib` and
   `/assets/figures/` the import fails, like the question engine (rule 11).
10. **Shells need no game code.** `recordAttempt()` counts them
    (`homepage/lib/krabsy-shells.js`): +1 per right answer, +1 extra for a
    new or weak item, never taken away, after 200 a day 1 per 3 right
    answers. In-level currencies (coins, stars) stay the game's own; don't
    call them shells / Muscheln / caracolas (never "conchas").

Test: no saved figure (fallback), a saved free figure, a saved figure with
a tall hat and a back item, and
`localStorage.krabsy_figure_v2 = '{"v":2,"char":"Vampire"}'` without owning
it (must show the fallback).

## Status (2026-11-25)

| Game | Any topic | Notes |
|---|---|---|
| Verb Towers | ✅ | the reference implementation (`TOPIC_TEXT`) |
| Quiz Room | ✅ | teacher tool; topics listed in its own `src/questions.js` TOPICS |
| Verb Kitchen | ✅ | sentence pairs on plates, "Sentence Cookbook" |
| Verb Platformer | ✅ | one sentence per gate; level tiers cap difficulty |
| Verb Hatchery | ✅ | 2026-11-25 (cc61034): gap cards, rare eggs ask two sentences, `TOPIC_TEXT`; tester release only |
| Verb Golf, Catapult | planned | their CLAUDE.md files carry this checklist |
| Verb Dungeon, Snake, Air Control, Flow | verbs only | Snake / Air Control are candidates; Air Control + Flow have no English menus |
| **Player's figure** (`loadPlayerFigure`, section above) | none yet | order: Verb Hatchery → Verb Platformer → Quiz Room (after the performance check) → Verb Kitchen → Verb Dungeon → Verb Valley → Verb Towers (the builder) |
