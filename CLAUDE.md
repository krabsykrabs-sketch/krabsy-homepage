# Krabsy — project guide for Claude Code

Krabsy is a browser-based English-grammar learning site (German + Spanish
UI) with a growing catalogue of arcade games. This file is read by every
session; keep it accurate.

**Direction (2026-11-24): `docs/vision.md`.** Curated grammar content
in any learning language (Spanish pilot next), games that play any
topic (new games must take the `quiz` shape, rules in
`docs/game-contract.md`), teacher tools around them.
**Tutors (2026-11-25): `docs/tutor-platform.md`** — tutors are the first
paying audience (Pro tools); kids and teachers stay free.
**Students (2026-11-27): `docs/student-path.md`** — games are the USP; a practice
session (weekly goal), vocabulary and a gradually switching interface language are built around
them to feed the tutor's skill map.

## Repository layout

```
krabsy-homepage/                 ← repo root (master session works here)
├── CLAUDE.md                    ← this file
├── STATUS.md                    ← living dashboard of every game's state
├── WORK_LOG.md                  ← session journal
├── homepage/                    ← THE DEPLOYED SITE (Coolify web root)
│   ├── de/  es/                 ← per-language pages (spiele/juegos, topics)
│   ├── en/                      ← English interface: /en/spanish/ (Spanish for
│   │                              English speakers, pilot) + /en/privacy/
│   ├── lib/                     ← shared site JS/CSS (krabsy-*.js)
│   ├── data/                    ← SERVED data: games.json, topics.json,
│   │                              ui_de/ui_es.json, irregular-verbs.json,
│   │                              prepositions.json
│   ├── games/                   ← SERVED game builds (what the site loads)
│   │   ├── *.html               ← speed drills (type-race, fill-the-gap …)
│   │   └── verb-platformer/     ← built 3D platformer (iframed)
│   ├── krabsy-air-control.html  ← served single-file game (iframed)
│   ├── sitemap.xml, robots.txt, favicons, og-image.png …
├── games/                       ← GAME SOURCE projects (NOT served)
│   ├── verb-kitchen/            ← 3D Three.js game (released; source ahead of build)
│   ├── tower-defense/           ← 3D tower-defense dev project (next 3D game)
│   ├── sim-tower/               ← "Krabsy Block" city-block sim (potential game;
│   │                              archive-tower-version/ = the retired tower)
│   ├── verb-platformer/         ← 3D platformer (offline, bug list in CLAUDE.md)
│   ├── verb-dungeon/ verb-valley/ verb-climb/ verb-runway/ ← PoCs
│   ├── verb-flow/               ← single-file game source
│   ├── crab-slash/  verb-slash/ ← standalone sources (inlined into wrappers)
├── tools/                       ← site generators (sitemap, verb pages, game
│                                  grids) + world-designer/ (3D level editor)
├── docs/                        ← outreach list, SEO notes, play-test reports
├── assets/                      ← SHARED asset library (gitignored binaries)
├── content/                     ← CANONICAL question catalogue (master copy)
│   ├── irregular-verbs.json     (172 verbs)
│   └── prepositions.json        (99 items)
├── api/                         ← FastAPI analytics backend (SEPARATE Coolify app)
└── _incoming/                   ← local staging (gitignored)
```

## Source vs. deployed (the core rule)

- **`homepage/` is the only thing the website serves.** Coolify builds the
  static site from this repo; the static app's **Base directory is
  `/homepage`**. (The `api/` backend is a *second* Coolify app, base
  directory `/api`.)
- **`games/` holds source dev projects** for complex games. Their built
  output is copied into `homepage/games/<name>/` to release. Single-file
  canvas games are their own build — they live directly under `homepage/`
  at the path their wrapper iframes.
- **3D games with `src/` modules (Verb Dungeon, Verb Kitchen) carry versioned
  module URLs** (import map + `main.js?v=`). After changing a game's `src/`, run
  `python3 tools/stamp_game_modules.py games/<name> homepage/games/<name>`;
  otherwise returning players run cached old modules (`.js` is cached 1 h) with
  the new `index.html` (happened 2026-11-25 on the owner's phone).
- **`content/` is the canonical question catalogue.** The served copies in
  `homepage/data/` are synced from here at release; games inline their own
  copy. Edit `content/`, then propagate.

## Sections (interface language × learning language, 2026-11-24)

`/de/` and `/es/` = English for German / Spanish speakers. `/en/spanish/` =
Spanish for English speakers (noindex pilot). **A topic belongs to a section
if it has a URL in that language** in `data/topics.json` (`es_ser` has only
`"en": "spanish/ser"`), and a section shows only the games whose `topics`
include one of its topics (`games.json`: name/tagline `en`, optional
`featured_langs`). The shared scripts (`krabsy-nav`, `-topic-nav`, `-footer`,
`-landing`) and the renderers (`render_static_games.py`,
`render_game_info.py` with `game_info_content.py` `EN_SPANISH`) apply that
rule; DE/ES output is unchanged by Spanish topics (checked byte-for-byte and
live-vs-local). The Spanish pages are generated by
`tools/build_en_spanish.py` from the German skeletons, then run
`render_static_games.py` and `render_game_info.py`; only the landing
`/en/spanish/index.html` is hand-written (on the `/de/` landing skeleton).

## Teacher practice links (2026-11-25)

Teacher pages (`/de/lehrkraefte/#uebungslink`, `/es/docentes/#enlace-de-practica`,
`/en/spanish/teachers/`) carry a link builder (`lib/krabsy-link-builder.js`):
topic → game or drill → difficulty → game language. The result is a permanent
link to the normal page, nothing stored: `…/verb-kitchen/?topic=…&difficulty=1&lang=en&from=teacher`.
- **Game pages** pass `lang`/`topic`/`difficulty` to the game frame (script right
  after the iframe, from `render_game_info.py`; Fill the Gap pages have the same).
- **`?difficulty=N`** is applied by the question engine itself (`krabsy-data.js`
  `linkLevel`): sentence topics by question difficulty ≤ N, irregular verbs by tier
  ≤ N, ignored if fewer than 6 questions remain. Games need no code for it
  (exceptions: Kitchen picks verbs from the engine set, the Platformer skips its
  level cap, Fill the Gap filters its own data).
- `from=teacher` shows "Practice from your teacher: <topic> · <level>" in the bar
  under the game (`krabsy-game-info.js`; bump `ASSET_VER` in `render_game_info.py`
  when that file changes).
- The builder offers the games of the topic (`games.json` `topics`) with their
  `ui_langs`, plus the drills Sprint and Fill the Gap where the topic has them.

## How a game reaches the player

Each game has per-language wrapper pages at `homepage/de/spiele/<id>/` and
`homepage/es/juegos/<id>/`. A wrapper either **inlines** the game
(verb-snake, crab-slash, verb-slash) or **iframes** a served file
(air-control → `/krabsy-air-control.html`, verb-platformer →
`/games/verb-platformer/`). The catalogue `homepage/data/games.json`
drives the games-hub grid, the chip-bar, and the games strip. Releasing a
game = add its `games.json` entry + JSON-LD in the hub pages + sitemap
URLs + the wrapper pages (this is what "re-enable Air Control" did).

## Session model (multi-day, sessions close in between)

- **Master session** starts at the repo root, owns the homepage,
  integration/release, `data/games.json`, sitemap, SEO, i18n, the
  `content/` catalogue, and review of each game before release.
- **One session per game** starts in `games/<name>/` (or the relevant
  homepage game folder) and owns only that game. It gets its brief from
  that folder's `CLAUDE.md`/spec and reports back by updating it.
- **One checkout, one branch (owner decision 2026-11-21).** Everything
  happens in `/home/janah/dev/krabsy-homepage` on `main`. **No extra git
  worktrees or long-lived branches.** A June branch (`sim-tower`) once
  collected five months of unreleased work that way. Game sessions open in
  `krabsy-homepage/games/<name>/`, stage only their own folder
  (`git add games/<name>`, never `git add -A`), commit, and don't push.
  The master session pushes and releases. A subagent that needs isolation
  may use a temporary worktree, but it must be merged and removed the same
  day.
- **All durable state lives in files, never in chat.** End every session
  by updating `STATUS.md` (master) or the game's `CLAUDE.md` (game
  session), then commit. Start every session by reading them.

## Deploy / git

- One monorepo, remote `origin` (GitHub) → Coolify serves `main`.
  **Deploys are MANUAL**: pushing does NOT auto-deploy — the user must
  click Deploy in the Coolify dashboard. After any push that touches
  `homepage/`, ask the user to deploy, then verify the live site.
- **IndexNow after deploys:** key `eae8988c209c98a109229e9b03a9c0c4`
  (served at `/<key>.txt`). After a deploy that changes pages, POST the
  changed URLs to `https://api.indexnow.org/indexnow` as JSON
  `{host:"krabsy.com", key, keyLocation, urlList}` — instant
  Bing/Ecosia/DuckDuckGo indexing. HTTP 202 = accepted.
- Large binary asset packs are **gitignored** (see `.gitignore`): the
  shared `/assets/` library and the 3D source's `assets/`+`_builds/`. The
  **deployed** `homepage/games/verb-platformer/assets/` IS tracked.
- Two sessions may work in parallel in different folders. If a commit
  fails with `index.lock`, wait a second and retry. Never run
  `git add -A`, `git stash` or `git checkout -- .` in a shared checkout.
- **The git index is shared too.** Anything left staged (`git add`,
  `git mv`, `git rm`) goes into the next commit of whichever session
  commits first (happened 2026-11-21: a Verb Dungeon `git mv` landed in a
  Tower Defense commit). Move files with plain `mv`, and stage only in the
  same command that commits: `git add games/<name> && git commit …`.

## Local preview

`.claude/launch.json` serves `homepage/` on :8000 (via the preview tool).
The site is plain static files — `python3 -m http.server` from `homepage/`
is equivalent.

## Question engine (topic-agnostic games)

`homepage/lib/krabsy-questions.js` is the game-facing question source
(thin adapter over `krabsy-data.js`, which the drills already share).
Games import it and declare a SHAPE instead of inlining data:

- **`chain`** — per-verb records with all forms + distractors (Verb
  Flow, Verb Snake consume this; irregular_verbs only).
- **`quiz`** — presentation-ready single questions for choice chips or
  typed input; works for every topic (verbs, prepositions, future).

Key API: `topicFromUrl()` (reads `?topic=`), `getChainSet({topic,
maxLen, tiers, count})`, `getQuizSet({topic, count, withOptions, lang})`,
`checkTyped(q, input)`. Unsupported topic/shape combos throw — games
catch and keep their small inline fallback (also covers file:// dev).

**Topics in any learning language (format v2, 2026-11-24).** All topics
are listed in `TOPIC_REGISTRY` in `krabsy-data.js` (`learn` = language
being learned). New topics are "gap topic" files, spec in
`content/FORMAT.md`: sentence with one gap, answers, wrong choices, hint
and teach note per interface language. Quiz records carry `learnLang`
and, on gap questions, `display.plain` + `display.hint` (`display.sentence`
already includes the hint in brackets). Games with their own `?lang=`
pass `lang` to `getQuizSet`. New topic ids also go into `TOPICS` in
`api/classes.py`.

**Presentation mandate (user decision, 2026-06-12): questions must never
require grammar terminology.** Use the Sprint drill's positional
notation — `go → ___ → ___` with the asked blank highlighted — or a
sentence gap (`My birthday is ___ July.`). Words like "Simple Past /
Past Participle" may appear only as small captions or in the
after-answer teach beat, never as the question itself. Typed input
("typewriter", validated via `checkTyped`, accepts alternates like
burnt/burned) is a welcome answer mode alongside choice chips.

**Chain order (owner decision, 2026-11-21):** a verb's 3rd form is asked
only directly after its 2nd form, and then with the 2nd form filled in
(`go → went → ___`). After the 2nd-form answer, don't reveal the 3rd form
(the next question asks it). `getQuizSet` does this by default for verbs
(`chainOrder`, pairs kept together, `teach.hideParticiple` on the first
of a pair, `followUp` on the second); games that order questions
themselves pass `chainOrder: false`. The drills load through
`krabsy-data.js` `getQuestions`, which has the same opt-in option
(`chainOrder: true`; adds `chain_past` / `chain_next` to the items).
Sprint (DE + ES) uses it; free practice asks both forms together in
order, flashcards and Air Control ask no single form.

## Conventions

- Single-file games: `krabsy-<name>.html`, everything drawn in canvas/CSS,
  zero external assets, WebAudio synth for sound. Palette teal `#2ee6c0` /
  coral `#ff8585` / amber `#ffcf5e`, fonts Fredoka One + Nunito.
- Commit messages end with the Co-Authored-By trailer.
