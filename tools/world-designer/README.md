# Krabsy World Designer

A browser-based 3D **world / level / room designer**, shared across Krabsy's
3D games (Verb Kitchen today; the SimTower-style diorama and others next). You
pick objects from an asset catalog and place them on a square floor grid;
objects stack vertically. It builds scenes — there is **no play mode**. Plain
static files (Three.js, ES modules), no build step.

Lives at `tools/world-designer/` (was the kitchen's level editor; promoted to a
general tool). **It spans the repo** — it copies packs from `/assets/`, its
Library reads/writes room files in `games/*/levels/`, and it deploys from the
repo root — so work on it from a **repo-root session**, not a folder-scoped one.
Each game ships its own loader that *interprets*
the exported `krabsy-level` JSON (the kitchen infers stations from model names;
a furniture diorama would infer rooms/walkways) — the designer stays
game-agnostic: it only places models and exports transforms.

## Run it

**With the room Library (recommended)** — `serve.py` serves the editor **and** a
small API so you can open / edit / save rooms straight to the repo's level files,
no download/upload:

```bash
python3 serve.py 8044      # from this folder
# open http://localhost:8044/
```

Or the Claude Code preview: `.claude/launch.json` **in this folder** has a
`world-designer` config on port 8044.

**Plain static (no Library)** — any static server works but you only get
Export / Import:

```bash
python3 -m http.server 8011
```

The hosted copy at **`dev.brocco.run/level-editor/`** is static (Export/Import
only). Deploy to it with `bash tools/deploy-editor-to-dev.sh` from the repo root.

`?demo=1` builds a small sample scene on load (self-test / showcase).

### Verifying changes (headless)

The interactive Claude preview's screenshot can hang on this 3D app (suspended
renderer), so drive it with **headless Edge + CDP** instead. The editor exposes
**`window.__LE = { editor, ui }`** for programmatic checks. Typical flow: serve
with `serve.py`, launch
`msedge --headless=new --remote-debugging-port=<p> http://localhost:8044/`,
connect over CDP, wait for `window.__LE`, then call e.g.
`ui._loadCatalog(id)`, `editor.selectModel(name)` + set `editor._hoverPoint` +
`editor._place()`, or `editor.loadState(json)` / `editor.getState()`, and read
back scene/state (measure bounding boxes via `THREE.Box3`). Assert geometry,
then `Page.captureScreenshot`. (This is how the wall/door/floor + Library fixes
were verified — see the git history for example harnesses.)

## Concepts

- **Floor = X–Z plane** (the square grid). **Y is up** — the vertical axis.
- **Grid:** resizable (default 12×12), each cell is `TILE = 2` world units
  (KayKit counters are 2×2). The grid is centred on the origin.
- **Stacking:** each cell is its own stack. Placing an object drops it on top
  of whatever already occupies that cell — its base rests on the running
  stack height (from each model's measured bounding-box height). To change a
  base, erase the stack above it.
- **Built-in wall/door alignment:** the wall/door kit (restaurant `wall`,
  `wall_doorway`, `wall_half`, `wall_decorated`/`_styleB`, `wall_window_*`,
  `wall_orderwindow*`, `door_A/B`, **and** the prototype `Wall*` / `Door_*` —
  geometrically identical, so same treatment) shares one off-grid origin, so each
  carries an intrinsic offset (`WALL_PLACE`, −1 X / −0.5 Z, rotates with the
  piece) **and is forced to a 1×1 footprint** (the 4-unit-wide mesh seats on one
  cell's edge). Pillars/wall-tiles excluded. Separate from your manual per-object
  Offset (starts 0,0,0). Tune in `MODEL_META` in `editor.js`.
- **Door → doorway snap:** while placing a door (`door_A/B`, `Door_A/B`,
  `Door_A_Decorated`) near an already-placed doorway (`wall_doorway` /
  `Wall_Doorway`), it snaps to that cell and matches its rotation, so the leaf
  seats into the opening. Editor-only (it just stores the final col/row/rot).
- **Footprint per pack:** `restaurant-bits` uses a hand-authored `MODEL_META`
  table (only the big floors are 2×2; it must match the frozen kitchen loader).
  **Other packs derive the footprint from the measured model size** — `w =
  round(sizeX/2)`, `d = round(sizeZ/2)` — so e.g. a 4×4-unit prototype `Floor`
  becomes 2×2 instead of overhanging one tile.
- **Ground pieces (floors) are harmonised:** any "ground" floor (restaurant
  floors/tiles **and** the prototype `Floor`/`Floor_Dirt`/`Floor_Prototype`/
  `Primitive_Floor`) is laid with its **top at the surface** (slab recessed
  below, `y = surface − maxY`), so floors snap flush to the zero-plane regardless
  of where the model's origin sits, and furniture rests on the floor surface.
- The authoritative reconstruction contract (footprint, ground, wall offset,
  multi-pack `pack` resolution, the stacking algorithm + a drop-in loader) is
  **`LEVEL-FORMAT.md`** — a game's runtime loader must follow it to render a
  level exactly as the editor shows it.
- **Catalogs:** an asset pack the editor can load, pluggable via a dropdown.
  Registered today: **Restaurant Bits 1.0 EXTRA** (229 models incl. generated
  floor tiles), **Furniture Bits 1.0** (74 interior models) and **Prototype Bits
  1.1 EXTRA** (85 greybox/blockout models). Each pack has its own category
  taxonomy (see *Add a catalog*).
- **Combining packs:** the catalog dropdown switches the **active** pack (what
  new placements use); switching does **not** clear the level, so one scene can
  mix objects from several packs. Each object remembers its pack and exports a
  `pack` field when it differs from the level's default `catalog` (see
  `LEVEL-FORMAT.md`). Single-pack levels carry no `pack` fields — back-compatible.

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

- **Library (only when served by `serve.py`)** — a `📂 Library` popover lists
  every room in a chosen levels folder (`games/<game>/levels`, auto-discovered)
  with object counts. Click one to **open** it into the editor; **💾 Save** writes
  back to that same file; **Save As…** creates a new one (and the folder if
  needed). Rooms stay as git-tracked JSON the game runtimes read directly — no
  download/upload. The Library is **API-gated**: on a plain static host (incl.
  `dev.brocco.run`) it stays hidden and Export/Import remain, so the same build
  works everywhere. The API lives in `serve.py`:
  `GET /api/dirs` → `[{dir,count}]`; `GET /api/levels?dir=` → `{files:[{name,objects}]}`;
  `GET /api/level?dir=&name=` → the JSON; `POST /api/level?dir=&name=` → writes it.
  Writes are restricted to `.json` files inside the repo.
- **Autosave** to `localStorage` (`krabsy_leveleditor_autosave`); offers to
  restore your in-progress level on next visit.
- **Export JSON / Import…** — file download/upload, for the static host or
  one-off transfers.

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
when zero. An optional per-object **`pack`** field appears when an object comes
from a different pack than the level's default `catalog` (multi-pack levels).
The vertical position is **not** stored — it is recomputed by re-stacking each
cell's objects in array order on load, so the file stays minimal.

**`LEVEL-FORMAT.md` is the full, authoritative contract** (every field, the
per-model footprint/ground/wall rules, multi-pack resolution, the exact
reconstruction algorithm, and a drop-in Three.js loader). Each game already has
its own loader against it — Verb Kitchen's `world.buildFromJSON` (it infers
stations from model names), and the sim-tower runtime (multi-pack).

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
  ui.js               palette, toolbar, save/load + Library glue
  storage.js          localStorage + file export/import + the levels-API client
  demo.js             ?demo=1 sample scene
serve.py              local server: editor (no-cache) + the levels API (Library)
.claude/launch.json   world-designer run config (serve.py on 8044)
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
./copy-pack.sh            # copies every pack (restaurant-bits, furniture-bits, prototype-bits) from ~/krabsy-homepage/assets
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
