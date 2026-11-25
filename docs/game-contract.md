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

## Status (2026-11-25)

| Game | Any topic | Notes |
|---|---|---|
| Verb Towers | ✅ | the reference implementation (`TOPIC_TEXT`) |
| Quiz Room | ✅ | teacher tool; topics listed in its own `src/questions.js` TOPICS |
| Verb Kitchen | ✅ | sentence pairs on plates, "Sentence Cookbook" |
| Verb Platformer | ✅ | one sentence per gate; level tiers cap difficulty |
| Verb Golf, Catapult, Hatchery | planned | their CLAUDE.md files carry this checklist |
| Verb Dungeon, Snake, Air Control, Flow | verbs only | Snake / Air Control are candidates; Air Control + Flow have no English menus |
