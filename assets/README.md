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
| `KayKit/` | KayKit raw master packs (Adventurers, Character Animations, Platformer, + more as bought) | verb-dungeon, verb-valley, tower-defense (future), restaurant (future) |
| `kenney-starter-kit/` | Kenney "Starter Kit 3D Platformer" | (original platformer base, superseded) |
| `_pack-zips/` | Original downloaded `.zip` archives | masters / re-extract |

### Recommended KayKit packs per planned game (buy the **Extra** tier, not Source)

- **Farming/foresting (verb-valley):** Forest Nature, Resource Bits,
  Furniture Bits, Adventurers, Character Animations (free)
  · plus free **Quaternius LowPoly Farm Buildings** for crops/barns.
- **Restaurant (future folder):** Restaurant Bits, Furniture Bits,
  Adventurers, Character Animations.
- **RPG adventure (verb-dungeon):** Dungeon Remastered, Adventurers,
  Skeletons, Fantasy Weapons Bits, RPG Tools Bits, Forest Nature.

Use the **GLTF/GLB** files (Three.js loads them natively); ignore the
FBX/OBJ duplicates. All KayKit/Quaternius packs are CC0.

## How game sessions access this library

A per-game Claude Code session is started **inside its own folder**
(`games/<name>/`) so it stays write-scoped to that game. To let it also
**read** this shared library (which lives outside its folder), each 3D
game folder grants read access in its machine-local settings:

```jsonc
// games/<name>/.claude/settings.local.json   (gitignored, machine-local)
{
  "permissions": {
    "additionalDirectories": ["/home/jan/krabsy-homepage/assets"]
  }
}
```

This takes effect automatically when a session starts in that folder — no
CLI flag. It grants **file access only** (not config/skills loading), which
is exactly what we want. Already set for: `verb-dungeon`, `verb-valley`,
`tower-defense`, `verb-platformer`. **When you create a new 3D game folder
(e.g. the restaurant game), copy that snippet in** (merge with any existing
`allow` rules) so its session can read the packs.

Notes:
- The path is **absolute and machine-specific** (this WSL box, user `jan`).
  It lives in the gitignored `settings.local.json` precisely because it
  doesn't travel to other machines; on a new machine, recreate it.
- Keep the path **space-free** (a known Claude Code bug truncates
  `additionalDirectories` entries at the first space) — the library path
  is fine; just don't point it at a folder with spaces.

## How games consume these (read-only → copy → deploy)

1. **Read** from `/assets/` during development (never modify the masters).
2. **Copy** the specific models a game uses into that game's own folder
   (`games/<name>/assets/…`, gitignored working copy).
3. **Release:** the master session promotes the *used subset* into
   `homepage/games/<name>/assets/` — that copy **is** tracked and is what
   Coolify deploys.

The live 3D platformer (`games/verb-platformer/`) already has its **wired**
packs inside its own folder for historical reasons; consolidating those
into this shared library is an optional per-game cleanup, done in that
game's own session, then its deployed copy is rebuilt.
