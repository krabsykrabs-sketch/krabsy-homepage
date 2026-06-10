# Krabsy — status dashboard

Living overview of every game and the project. Master session updates this
at the end of each session. (Last update: 2026-06-10.)

## Games

| Game | Type | Source | Served at | Status |
|------|------|--------|-----------|--------|
| Verb Slash | single-file canvas | `games/verb-slash/` (+ inlined wrapper) | `/de/spiele/verb-slash/` | **live** |
| Crab Slash | single-file canvas | `games/crab-slash/` (+ inlined wrapper) | `/de/spiele/crab-slash/` | **live** (beta) |
| Verb Snake | single-file canvas | inlined in wrapper | `/de/spiele/verb-snake/` | **live** |
| Air Control | single-file canvas | `homepage/krabsy-air-control.html` | `/de/spiele/air-control/` | **live** (beta) |
| Verb Platformer | 3D (Three.js) | `games/verb-platformer/` | `/games/verb-platformer/` | **live** (beta) |
| Verb Flow | single-file canvas | `games/verb-flow/` | — | **built, not released** |
| Tower Defense | 3D (Three.js) | `games/tower-defense/` | — | **in development** |
| Verb Dungeon | 3D roguelite (KayKit) | — | — | **concept agreed**, not started |

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
- **Folder restructure** (this session): done on branch `restructure`.
  Pending: ① you set the static site's Coolify **Base directory to
  `/homepage`**, ② merge branch, ③ then push.
- **Shared assets**: `/assets/` established with raw masters (KayKit,
  Kenney, zips). The 3D platformer's *wired* `kaykit-platformer` still
  lives in its source folder — consolidating it into `/assets/` (+ repoint
  + WebGL test) is a verb-platformer-session task.
- **Verb Dungeon**: agreed as goofy-skeleton roguelite (hand-authored
  rooms, procedural assembly, verb-gated doors). Build a vertical slice
  first.
