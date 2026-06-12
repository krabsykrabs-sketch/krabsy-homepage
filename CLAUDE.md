# Krabsy — project guide for Claude Code

Krabsy is a browser-based English-grammar learning site (German + Spanish
UI) with a growing catalogue of arcade games. This file is read by every
session; keep it accurate.

## Repository layout

```
krabsy-homepage/                 ← repo root (master session works here)
├── CLAUDE.md                    ← this file
├── STATUS.md                    ← living dashboard of every game's state
├── WORK_LOG.md                  ← session journal
├── homepage/                    ← THE DEPLOYED SITE (Coolify web root)
│   ├── de/  es/                 ← per-language pages (spiele/juegos, topics)
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
│   ├── verb-platformer/         ← full 3D dev project (editor, src, builds)
│   ├── tower-defense/           ← 3D tower-defense dev project
│   ├── verb-flow/               ← single-file game source (built, unreleased)
│   ├── crab-slash/  verb-slash/ ← standalone sources (inlined into wrappers)
├── assets/                      ← SHARED asset library (gitignored binaries)
├── content/                     ← CANONICAL question catalogue (master copy)
│   ├── irregular-verbs.json     (155 verbs)
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
- **`content/` is the canonical question catalogue.** The served copies in
  `homepage/data/` are synced from here at release; games inline their own
  copy. Edit `content/`, then propagate.

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
- **All durable state lives in files, never in chat.** End every session
  by updating `STATUS.md` (master) or the game's `CLAUDE.md` (game
  session), then commit. Start every session by reading them.

## Deploy / git

- One monorepo, remote `origin` (GitHub) → Coolify serves `main`.
  **Deploys are MANUAL**: pushing does NOT auto-deploy — the user must
  click Deploy in the Coolify dashboard. After any push that touches
  `homepage/`, ask the user to deploy, then verify the live site.
- Large binary asset packs are **gitignored** (see `.gitignore`): the
  shared `/assets/` library and the 3D source's `assets/`+`_builds/`. The
  **deployed** `homepage/games/verb-platformer/assets/` IS tracked.
- Don't run two sessions against the repo at the same instant.

## Local preview

`.claude/launch.json` serves `homepage/` on :8000 (via the preview tool).
The site is plain static files — `python3 -m http.server` from `homepage/`
is equivalent.

## Conventions

- Single-file games: `krabsy-<name>.html`, everything drawn in canvas/CSS,
  zero external assets, WebAudio synth for sound. Palette teal `#2ee6c0` /
  coral `#ff8585` / amber `#ffcf5e`, fonts Fredoka One + Nunito.
- Commit messages end with the Co-Authored-By trailer.
