# Krabsy — status dashboard

Living overview of every game and the project. Master session updates this
at the end of each session. (Last update: 2026-06-10.)

## Games

| Game | Type | Source | Served at | Status |
|------|------|--------|-----------|--------|
| Verb Slash | single-file canvas | `games/verb-slash/` (+ inlined wrapper) | `/de/spiele/verb-slash/` | **live** |
| Crab Slash | single-file canvas | `games/crab-slash/` (+ inlined wrapper) | `/de/spiele/crab-slash/` | **live** (beta) |
| Verb Snake | single-file canvas | `homepage/krabsy-verb-snake.html` (iframed) | `/de/spiele/verb-snake/` | rebuilt 2026-06-10, committed NOT pushed — **user dislikes it, redo planned** |
| Air Control | single-file canvas | `homepage/krabsy-air-control.html` | `/de/spiele/air-control/` | **live** (beta) |
| Verb Platformer | 3D (Three.js) | `games/verb-platformer/` | `/games/verb-platformer/` | **live** (beta) |
| Verb Flow | single-file canvas | `games/verb-flow/` | — | **built, not released** |
| Tower Defense | 3D (Three.js) | `games/tower-defense/` | — | **in development** |
| Verb Dungeon | 3D roguelite (no assets yet) | `games/verb-dungeon/` | — | **PoC brief written** (`games/verb-dungeon/CLAUDE.md`) — open a session in that folder to build |

## Speed drills (irregular-verbs / prepositions topic tools)

`type-race`, `fill-the-gap`, `drag-match`, `falling-forms-chain` — live,
served from `homepage/games/*.html`. (`falling-forms-tower.html` present
but not referenced — verify before removing.)

## Content catalogue

- `content/irregular-verbs.json` — 155 verbs (canonical)
- `content/prepositions.json` — 99 items (canonical)
- Served copies live in `homepage/data/`; sync on edit.

## Next steps / open items

- **Verb Flow**: design polish pass requested, then release (wire into
  `data/games.json` + wrappers + sitemap). Game is verified working.
- **Folder restructure**: done, merged to `main`, pushed, and **deployed
  live** (Coolify static Base directory = `/homepage`). Verified serving:
  games.json, hub, verb-platformer, air-control, type-race.
- **Shared assets**: `/assets/` established with raw masters (KayKit,
  Kenney, zips). The 3D platformer's *wired* `kaykit-platformer` still
  lives in its source folder — consolidating it into `/assets/` (+ repoint
  + WebGL test) is a verb-platformer-session task.
- **Verb Dungeon**: PoC brief ready in `games/verb-dungeon/CLAUDE.md` —
  one asset-free showcase level (Three.js primitives only), goofy
  skeletons, grammar-as-keys. If the PoC convinces, buy the KayKit
  Dungeon pack and build the full roguelite (hand-authored rooms +
  procedural assembly).
- **Verb Snake redo**: the 2026-06-10 rebuild is committed locally but
  NOT pushed (user dislikes it; wants it redone). The old version is
  still what's live. Don't push `main` without deciding what to do with
  commit 5632243 (revert it or redo the game first).
