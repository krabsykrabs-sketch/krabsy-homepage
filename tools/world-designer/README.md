# Krabsy World Designer

A browser-based 3D **world / level / room designer**, shared across Krabsy's
3D games (Verb Kitchen today; the SimTower-style diorama and others next). You
pick objects from an asset catalog and place them on a square floor grid;
objects stack vertically. It builds scenes — there is **no play mode**. Plain
static files (Three.js, ES modules), no build step.

Lives on `main` at `tools/world-designer/` (was the kitchen's level editor;
promoted to a general tool). Each game ships its own loader that *interprets*
the exported `krabsy-level` JSON (the kitchen infers stations from model names;
a furniture diorama would infer rooms/walkways) — the designer stays
game-agnostic: it only places models and exports transforms.

## Run it

```bash
# from this folder
python3 -m http.server 8011
# open http://localhost:8011/
```

Or use the Claude Code preview: `.claude/launch.json` (repo root) has a
`level-editor` configuration on port 8011.

`?demo=1` builds a small sample scene on load (self-test / showcase).

## Concepts

- **Floor = X–Z plane** (the square grid). **Y is up** — the vertical axis.
- **Grid:** resizable (default 12×12), each cell is `TILE = 2` world units
  (KayKit counters are 2×2). The grid is centred on the origin.
- **Stacking:** each cell is its own stack. Placing an object drops it on top
  of whatever already occupies that cell — its base rests on the running
  stack height (from each model's measured bounding-box height). To change a
  base, erase the stack above it.
- **Built-in wall alignment:** the wall/door/window kit (`wall`, `wall_doorway`,
  `wall_half`, `wall_decorated`/`_styleB`, the `wall_window_*` and
  `wall_orderwindow*` pieces, and `door_A`/`door_B`) shares one off-grid origin,
  so each carries an intrinsic placement offset (`WALL_PLACE`, −1 X / −0.5 Z in
  the piece's local frame, so it rotates with the piece). Pillars and wall tiles
  are deliberately excluded. This is separate from your manual per-object Offset,
  which still starts at 0,0,0 — edit `MODEL_META` in `editor.js` to tune it.
- **Catalogs:** an asset pack the editor can load, pluggable via a dropdown.
  Registered today: **Restaurant Bits 1.0 EXTRA** (229 models incl. generated
  floor tiles) and **Furniture Bits 1.0** (74 interior models — seating, beds,
  tables/desks, storage, lighting, electronics, decor). Each pack has its own
  category taxonomy (see *Add a catalog*).

## Controls

| Camera | |
|---|---|
| Right-drag | orbit (tilt / turn) |
| Middle-drag, or Shift+Right-drag | pan |
| Wheel | zoom |

| Editing | |
|---|---|
| Click a palette tile | enter **place mode** for that model (click again to exit) |
| Left-click a cell | place the model on top of that cell's stack |
| `R` | rotate (90° steps) — the next placement, or the selected object |
| Left-click an object (Select tool) | select it |
| **Right-click** | detach: deselect / cancel place mode → back to Select tool (right-*drag* still orbits) |
| Selected → **Offset X/Y/Z** | nudge off the grid/stack spot in world units (−/+ = 0.1, or type a value) — for fine alignment. |
| Selected → **Rotation X/Y/Z** | Y = the R-key turn (90° steps); **X/Z tilt in degrees** (−/+ = 90°, or type any angle) — e.g. lay a knife/spoon flat. Reset clears offset + rotation. |
| `Del` / `Backspace` | delete the selected object |
| Erase tool | left-click removes the top object of a cell (or the clicked object) |
| `V` / `X` | Select / Erase tool · `Esc` cancel |

## Save / load

- **Autosave** to `localStorage` (`krabsy_leveleditor_autosave`); on next
  visit it offers to restore.
- **Export JSON** / **Import…** for files you can commit to the repo.

### Level file format (`format: "krabsy-level"`, v1)

```json
{
  "format": "krabsy-level",
  "version": 1,
  "catalog": "restaurant-bits",
  "grid": { "cols": 12, "rows": 12, "tile": 2 },
  "objects": [
    { "model": "kitchencounter_straight_A", "col": 0, "row": 0, "rot": 0 },
    { "model": "wall_orderwindow", "col": 2, "row": 0, "rot": 0, "off": { "x": 0, "y": 0.2, "z": -0.15 } }
  ]
}
```

`rot` is in quarter-turns (0–3 = 0/90/180/270°). `off` is an optional manual
world-unit nudge (X/Y/Z) applied on top of the grid/stack position — omitted
when zero. The vertical position is
**not** stored — it is recomputed by re-stacking each cell's objects in array
order on load, so the file stays minimal. The format deliberately leaves room
to add gameplay roles (sink / crate / spawn / hatch / walkable …) per object
later, when Verb Kitchen adopts this as its level format.

## Layout

```
index.html            chrome + styling
src/
  main.js             bootstrap
  editor.js           3D scene, grid, placement + stacking, selection, IO
  controls.js         orbit / pan / zoom camera
  models.js           AssetPack: GLTF loading, shared atlas, measure, ghost
  catalog.js          catalog registry (the dropdown) + manifest loader
  thumbs.js           lazy palette thumbnails (offscreen renderer)
  ui.js               palette, toolbar, save/load glue
  storage.js          localStorage + file export/import
  demo.js             ?demo=1 sample scene
catalogs/<id>.json    generated catalog manifests (committed)
assets/<id>/          copied asset packs (GITIGNORED — re-derive, see below)
build/
  copy-pack.sh        copy a pack from the shared /assets library
  build-tiles.py      generate single-colour 1×1 floor tiles from the floors
  build-catalog.py    scan a pack → category manifest
vendor/three/         Three.js (committed)
```

## Setup after a fresh checkout

The asset binaries are gitignored. Re-create them from the shared library:

```bash
cd build
./copy-pack.sh            # copies every pack (restaurant-bits, furniture-bits) from ~/krabsy-homepage/assets
python3 build-tiles.py    # generates the single-colour 1×1 floor tiles (restaurant-bits)
python3 build-catalog.py  # regenerates every catalogs/<id>.json
```

The **Floor Tiles** category (`tile_white`, `tile_black`, `tile_brown_light`,
`tile_brown_dark`) is generated by `build-tiles.py` — 1×1 slabs that reuse the
shared atlas with their UVs collapsed onto each floor's colour swatch, so they
match `floor_kitchen` / `floor_kitchen_styleB` and let you hand-lay custom
floor patterns. They are flush ground pieces like the other floors.

## Add a catalog (another asset pack)

1. `build/copy-pack.sh` — add the pack to its `PACKS` map and run it (copies
   into `assets/<id>/`).
2. `build/build-catalog.py` — add a `PACKS` entry (id, name, atlas, **`rules`**,
   **`meta`**) and run it (writes `catalogs/<id>.json`). Each pack defines its
   OWN category rules + labels (a `*_rules()` fn + `*_META` list), so a new
   pack's taxonomy never disturbs another's — see the `furniture_rules` /
   `FURNITURE_META` example.
3. `src/catalog.js` — add the pack to `CATALOGS` so it appears in the dropdown.

That's the whole "infrastructure for several catalogs" — no editor code change.
