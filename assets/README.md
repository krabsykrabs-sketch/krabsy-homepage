# Shared asset library

Reusable, bought/downloaded asset packs that 3D games draw from. Several
games can share one pack here instead of each carrying its own copy.

**Not tracked in git.** These are large binary masters that can be
re-downloaded or re-bought. Only this README is committed (see the root
`.gitignore`). Back the packs up externally; if we want them version-
controlled later, switch this folder to Git LFS.

## Contents

| Folder | Pack | Used by |
|--------|------|---------|
| `KayKit/` | KayKit raw master pack (unwired master) | (future 3D games) |
| `kenney-starter-kit/` | Kenney "Starter Kit 3D Platformer" | (original platformer base, superseded) |
| `_pack-zips/` | Original downloaded `.zip` archives | masters / re-extract |

## How games consume these

Today the live 3D platformer (`games/verb-platformer/`) still has its
**wired** packs (`assets/kaykit-platformer/`, `character/`, …) inside its
own folder, because moving them requires repointing asset paths and a
WebGL smoke-test. Consolidating those into this shared library is a
per-game task to be done in that game's own session, then the deployed
copy under `homepage/games/verb-platformer/` is rebuilt.

When a new 3D game needs a pack already here, reference it from `/assets/`
rather than copying it into the game.
