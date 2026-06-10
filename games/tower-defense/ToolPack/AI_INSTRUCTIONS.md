# Test 128 — AI Game Package

> Exported from Krabsy Toolkit on 2026-05-09T07:25:02.552Z.
> Format: `krabsy-ai-export-v1`

This ZIP contains everything needed to build a playable 2D game:

- One **ortho** map, 1472×1288 px
- **0** placed objects using **0** unique sprites
- **5** characters with animation slots
- **1** character carry per-frame **animation overlays** (tools, weapons, fishing rod, …) — see the Animation overlays section.
- **21** curated game objects (sprite library: trees, crops, props, …) under `gameObjects/`

## Quick start

1. Serve the unzipped directory over HTTP (any static server).
2. Read `project.json` — it points at every other file.
3. Draw `map/background.png` at world position (`worldX`, `worldY`) from `map/map.json`.
4. Load placements from `assets/placements.json`; each sprite PNG lives in `assets/`.
5. Load your character from `characters/<Name>/character.json`; each animation slot has its own PNG in the same folder.
6. Use the code snippets below for coordinate math, collision, depth-sort, and animation selection.

## File layout

```
AI_INSTRUCTIONS.md
project.json
map/
  map.json
  background.png
  collision.json
assets/
  placements.json
  <sprite>.png ...
characters/
  <Name>/
    character.json
    <anim>.png ...
    overlays.json
    overlays/<sheet>.png ...
gameObjects/
  gameObjects.json
  <object>/
    <state>.png ...
```

## Map

- **Type**: `tiles` (tiles pre-baked into one PNG)
- **Grid style**: `ortho`
- **Size**: 1472×1288 px
- **Tile size**: 64×64 px
- **Grid origin** (world-coord offset of the grid's (0,0) cell): `(320, 384)`
- **World origin** of the background PNG: `(0, -200)`

### Coordinate math

```javascript
// World (wx, wy) → orthogonal cell (col, row)
function worldToCell(wx, wy) {
  const origin = { x: 320, y: 384 };
  const cellW = 16;
  const cellH = 16;
  return {
    col: Math.floor((wx - origin.x) / cellW),
    row: Math.floor((wy - origin.y) / cellH)
  };
}

// Ortho cell (col, row) → top-left world position
function cellToWorld(col, row) {
  const origin = { x: 320, y: 384 };
  const cellW = 16;
  const cellH = 16;
  return {
    x: col * cellW + origin.x,
    y: row * cellH + origin.y
  };
}
```

## Collision

`map/collision.json` defines walkability:

- `gridW` × `gridH` — 92×68 cells
- `cellW` × `cellH` — 16×16 world px per cell
- `granularity` — 4 (cells per tile axis)
- `originX`, `originY` — (320, 384) world px offset
- `data` — row-major 2D array, `data[row][col]` where `1` = walkable, `0` = blocked

### Point-in-walkable test

```javascript
function isWalkable(wx, wy, collision) {
  const { col, row } = worldToCell(wx, wy);  // uses the formula above
  if (row < 0 || row >= collision.gridH) return false;
  if (col < 0 || col >= collision.gridW) return false;
  return collision.data[row][col] === 1;
}
```



## Placed objects

Each entry in `assets/placements.json`:

```typescript
interface Placement {
  sprite: string;           // filename, also in assets/
  x: number;                // world X of the sprite TOP-LEFT
  y: number;                // world Y of the sprite TOP-LEFT
  scale: number;            // 1 = native size
  anchor: { x: number, y: number } | null;  // sprite-local "feet" point (pre-scale)
  sortOffset: number;       // added to depth sort value
  visible: boolean;
  collision: {
    enabled: boolean;
    shape: "circle" | "rectangle" | "ellipse" | "polygon";
    // circle: { radius }
    // rectangle: { width, height }
    // ellipse: { radiusX, radiusY }
    // polygon: { vertices: Array<{x, y}> }
    colliderOffset: { x: number, y: number };  // sprite-local, scales with sprite
  } | null;
  coordsVersion: 2;         // current coord schema
  missing?: true;           // sprite PNG not present in assets/
}
```

### Depth sort rule

Use the anchor point (usually feet) as the sort Y. Draw objects back-to-front:

```javascript
// sortY = (top-left Y) + (anchor.y * scale)  +  sortOffset
function sortY(o) {
  const a = o.anchor || { x: 0, y: 0 };
  return o.y + (a.y * (o.scale || 1)) + (o.sortOffset || 0);
}
// The player's sortY is the player's world Y (which already represents its anchor/feet).
// Sort objects ascending by sortY.
```

### Collision against placed objects

Each object's collider is in *sprite-local* pixels. The collider centre in world space:

```javascript
function colliderCenter(o) {
  const off = (o.collision && o.collision.colliderOffset) || { x: 0, y: 0 };
  const s = o.scale || 1;
  return { x: o.x + off.x * s, y: o.y + off.y * s };
}
```

Hit-tests:

- `rectangle`: AABB around center with `width × height` (not scaled — already world px).
- `ellipse`: `(dx/rx)² + (dy/ry)² < 1`.
- `circle`: `dx² + dy² < radius²`.
- `polygon`: ray-cast against `vertices` with each v scaled by `scale` and translated to the center.

## Game objects

`gameObjects/gameObjects.json` describes pre-authored game objects bundled with the export.
Each object has a footprint, anchor, collision data, and one or more visual states (rasterised PNGs).
Treat them as a sprite library you spawn on the map at runtime — fruits, fence posts, signs, mushrooms,
trees, multi-stage crops, etc. Their colliders feed your physics, and multi-state objects (e.g. crops)
advance through states for animations like growth.

**21 objects** across 1 category:

- **Fruit Icons**: 21

<details><summary>Inventory preview</summary>

- `Apple Red` — 1×1, 1 state (`Fruit Icons`)
- `Apple Yellow` — 1×1, 1 state (`Fruit Icons`)
- `Orange` — 1×1, 1 state (`Fruit Icons`)
- `Pear` — 1×1, 1 state (`Fruit Icons`)
- `Plum` — 1×1, 1 state (`Fruit Icons`)
- `aubergine` — 1×1, 1 state (`Fruit Icons`)
- `beetroot` — 1×1, 1 state (`Fruit Icons`)
- `bellpepper orange` — 1×1, 1 state (`Fruit Icons`)
- _…and 13 more in `gameObjects.json`._

</details>

### File layout

Each object has its own subdirectory under `gameObjects/`. State PNGs are named after the state's `id`.

```
gameObjects/
  gameObjects.json
  tomato_crop/
    planted.png
    stage_1.png
    ...
    mature.png
  oak_tree/
    default.png
```

Names and state IDs in the bundle JSON are the originals; PNG paths are filesystem-safe
(non-`[a-zA-Z0-9_-]` characters become `_`). Look up the file via the `image` field on each
state — never guess from the GO name.

### Schema

```typescript
interface GameObjectsBundle {
  count: number;
  categories: string[];   // unique categories present, sorted
  items: GameObjectExport[];
}

interface GameObjectExport {
  name: string;
  category: string;
  description?: string;
  footprint: { cols: number; rows: number };
  anchor: { x: number; y: number };           // footprint-local cell coords (may be fractional)
  cellCollision: Array<{ x: number; y: number }>;  // footprint-local cells that block
  subCellCollision?: Record<string, [boolean, boolean, boolean, boolean]>;
                                              // optional 2×2 sub-cell precision per cell:
                                              // "x,y" → [topLeft, topRight, bottomLeft, bottomRight]
  interactions: string[];                     // "chop" | "mine" | "harvest" | "water" | …
  lifecycle: {
    advanceOn:    "manual" | "sleep_when_watered" | "always_on_sleep" | "never";
    onHarvest:    "remove" | "reset_to_stage_4";
    multiHarvest: boolean;
  };
  states: GameObjectStateExport[];
}

interface GameObjectStateExport {
  id: string;            // "planted", "mature", "default", …
  label: string;         // human-readable label
  harvestable: boolean;
  image: string | null;  // ZIP-relative path, e.g. "gameObjects/tomato_crop/planted.png".
                         // null when the state had no composition; treat as invisible.
  width:  number;        // rasterised PNG dimensions in pixels (0 when image is null)
  height: number;
}
```

The composition data itself is not exported — the rasterised PNG **is** the delivery format.

### Coordinate conventions

- `footprint.cols × footprint.rows` — how many grid cells the object occupies.
- `anchor.{x, y}` — footprint-local cell coordinates of the object's "feet" point. Used for
  placement and depth-sort. Top-down convention: `y = 0` is the top of the footprint, `y = rows - 1`
  is the bottom. Anchor may be fractional.
- `cellCollision[]` — footprint-local cells that block movement.
- `subCellCollision` — optional 2×2 sub-cell precision per cell. Each value is
  `[topLeft, topRight, bottomLeft, bottomRight]` booleans. A cell with a sub-cell entry overrides the
  implicit "all four sub-cells solid" of `cellCollision`.

A placement is canonically pinned by its **bottom-left** cell. The footprint extends UP and RIGHT
from there — matching the editor and the existing placement records on the map.

### Placing a game object on the map

```javascript
// place(go, state, col, row) — (col, row) is the canonical bottom-left cell.
// state._image is a pre-loaded HTMLImageElement (or PIXI.Texture) for state.image.
function placeGameObject(ctx, go, state, col, row, tileW, tileH) {
  const originCol = col;
  const originRow = row - (go.footprint.rows - 1);
  const x = originCol * tileW;
  const y = originRow * tileH;
  // The PNG dimensions match the footprint at gridUnit (16 px) scale.
  // Scale to your map's tile size with drawImage's dest dims.
  ctx.drawImage(
    state._image,
    0, 0, state.width, state.height,
    x, y, go.footprint.cols * tileW, go.footprint.rows * tileH
  );
}
```

For depth-sort, use the world-cell anchor: `sortY = (originRow + go.anchor.y) * tileH`. Sort against
the player and other entities by ascending `sortY` so things draw back-to-front.

### Collision against game objects

```javascript
// True when world cell (col, row) is blocked by this placement.
function isCellBlockedByGO(col, row, placement, go) {
  const originCol = placement.col;
  const originRow = placement.row - (go.footprint.rows - 1);
  const localCol  = col - originCol;
  const localRow  = row - originRow;
  if (localCol < 0 || localCol >= go.footprint.cols) return false;
  if (localRow < 0 || localRow >= go.footprint.rows) return false;
  return go.cellCollision.some(c => c.x === localCol && c.y === localRow);
}
```

Sub-cell collision uses the same logic at 2× resolution: each cell splits into a 2×2 grid keyed
`[tl, tr, bl, br]`. A cell present in `subCellCollision` overrides the `cellCollision` "all-true"
default for that cell.

### Multi-state objects

Crops and other objects with multiple states (`states.length > 1`) typically advance through states
based on game logic — for crops, watered + sleep cycles drive the transition. Pick which state to
render based on your runtime state:

```javascript
// runtime placement = { goName, col, row, currentStateId }
const go    = bundle.items.find(g => g.name === placement.goName);
const state = go.states.find(s => s.id === placement.currentStateId) || go.states[0];
placeGameObject(ctx, go, state, placement.col, placement.row, tileW, tileH);
```

See each item's `lifecycle.advanceOn` for a hint at the intended trigger:

- `manual` — advance only on explicit interaction.
- `sleep_when_watered` — advance one stage per sleep, gated on a "watered" flag (crops).
- `always_on_sleep` — advance every sleep tick.
- `never` — single-state object; ignore.

Pre-load every state's `image` PNG into an `HTMLImageElement` (or PIXI texture) at boot — the
render loop above assumes `state._image` is already populated.

## Characters

- **FPlayer_1** (default: `idle`) — slots: `idle`, `walk`
- **TestMihcaChar** (default: `idle`) — slots: `idle`, `walk`
- **Slippery Slime Green** (default: `walk`) — slots: `walk`, `attack`, `die`, `jump`, `spit`
- **Mana Base** (default: `idle`) — slots: `walk`, `jump`, `idle`
  - Layered (composite renderer required). Equipment slots:
    - **Body** [base] → `default` (default)
    - **Shirt** → `Shirt1` (default), `ShirtBoobs`
    - **Pants** → `Longpants` (default)
    - **Shoes** → `Shoes` (default)
    - **Hair** → `Bob` (default), `Dapper`
    - **Hats** → `Cowboy` (default)
- **Mana Seed Farmer** (default: `idle`) — slots: `idle`, `walk`, `push`, `walk while carrying`, `run`, `jump`, `attack`, `pull`, `walk_carry`, `run_carry`, `jump_carry`, `pickup_carry`, `throw_carried`, `work_at_desk`, `wave`, `hugs`, `sing`, `flute_ocarina`, `lute_guitar`, `drums`, `hurt_down_right_left`, `hurt_up`, `death_bounce_down_right_left`, `death_bounce_up`, `evade`, `sit_on_ledge`, `sit_chair`, `meditate`, `sleep`, `sleep_sit`, `thumbs_up`, `mad_stomp`, `shocked`, `laugh`, `sit_on_floor`, `impatient`, `climb`, `top_of_climb`, `sad`, `mount_up`, `ride_mount`, `sooth_mount`, `pet_dog_cat`, `milk_cow`, `pet_horse`, `overhand_strike`, `forehand_strike`, `scythe_swing`, `bugnet_swing`, `bow_shot`, `plant_seeds`, `water`, `smith`, `drink_standing`, `drink_at_bar`, `cast_fishing_line`, `got_a_bite`, `got_it`
  - Layered (composite renderer required). Equipment slots:
    - **Body** [base] → `human_00` (default), `humannolegs_00`
    - **00undr** → `cloakplain_00d` (default), `cloakwithmantleplain_00b`
    - **02sock** → `sockshigh_00a` (default), `sockslow_00a`, `stockings_00a`
    - **03fot1** → `boots_00a` (default), `sandals_00a`, `shoes_00a`
    - **04lwr1** → `longpants_00a` (default), `onepiece_00a`, `onepieceboobs_00a`, `shorts_00a`, `undies_00a`
    - **05shrt** → `bra_00a` (default), `longshirt_00a`, `longshirtboobs_00a`, `shortshirt_00a`, `shortshirtboobs_00a`, `tanktop_00a`, `tanktopboobs_00a`
    - **06lwr2** → `overalls_00a` (default), `overallsboobs_00a`, `shortalls_00a`, `shortallsboobs_00a`
    - **07fot2** → `cuffedboots_00a` (default), `curlytoeshoes_00a`
    - **08lwr3** → `frillydress_00a` (default), `frillydressboobs_00a`, `frillyskirt_00a`, `longdress_00a`, `longdressboobs_00a`, `longskirt_00a`
    - **09hand** → `gloves_00a` (default)
    - **10outr** → `suspenders_00a` (default), `vest_00a`
    - **11neck** → `cloakplain_00d` (default), `cloakwithmantleplain_00b`, `mantleplain_00b`, `scarf_00b`
    - **12face** → `glasses_00a` (default), `shades_00a`
    - **13hair** → `afro_00` (default), `afropuffs_00`, `bob1_00`, `bob2_00`, `bushy_00`, `dapper_00`, `flattop_00`, `longbound_00`, `longboundclasped_00f`, `longwavy_00`, `mohawk_00`, `ponytail1_00`, `spiky1_00`, `spiky2_00`, `topknot_00f`, `twintail_00`, `twists_00`
    - **14head** → `bandana_00b` (default), `boaterhat_00d`, `boaterhat_01`, `cowboyhat_00d`, `cowboyhat_01`, `floppyhat_00d`, `floppyhat_01`, `headscarf_00b`, `mushroom1_00d`, `mushroom1_01`, `mushroom1_02`, `mushroom1_03`, `mushroom1_04`, `mushroom1_05`, `strawhat_00d`, `strawhat_01`

Each `characters/<Name>/character.json` looks like:

```typescript
interface Character {
  name: string;
  defaultAnimation: string;
  animations: {
    [slot: string]: {               // slot name (idle, walk, run, …)
      spriteSheet: string;           // PNG filename in the same folder
      frameWidth: number;
      frameHeight: number;
      columns: number;               // sheet cols
      rows: number;                  // sheet rows
      anchor: { x: number, y: number };  // sheet-local anchor (feet)
      fps: number;
      loop: boolean;
      directions: {
        // Each entry plays a sequence (object form) or mirrors another direction.
        // Frame entries are either { index: N, ms?: number | "hold" } or
        // { mirrorOf: K, ms?: number | "hold" } — see "Play-loop per frame" below.
        [dir: string]: { frames: FrameEntry[] } | { mirror: string };
      };
    };
  };
}
type FrameEntry =
  | number                                            // legacy: bare sheet index
  | { index: number; ms?: number | "hold" }           // plain frame at sheet cell
  | { mirrorOf: number; ms?: number | "hold" };       // mirror earlier timeline entry
```

### Animation selection

From input state, pick the slot to play. Missing slots fall through.

```javascript
function pickAnim(player, character) {
  const has = (n) => !!character.animations[n];
  if (player.jumping) {
    if (has('jump')) return 'jump';
    player.jumping = false;
  }
  if (player.moving) {
    if (player.running && has('run')) return 'run';
    if (has('walk')) return 'walk';
  }
  if (has('idle')) return 'idle';
  return character.defaultAnimation;
}
```

### Direction mapping (8-way)

```javascript
function computeDir(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy) * 2) return dx < 0 ? 'left' : 'right';
  if (Math.abs(dy) > Math.abs(dx) * 2) return dy < 0 ? 'up'   : 'down';
  if (dx < 0 && dy < 0) return 'up-left';
  if (dx > 0 && dy < 0) return 'up-right';
  if (dx < 0 && dy > 0) return 'down-left';
  return 'down-right';
}
```

Look up `animation.directions[computeDir(dx, dy)]`. If a direction isn't present, fall back to `'down'` or the first key.

### Frame indexing

Frame indices are **left-to-right, top-to-bottom** through the sheet. For index `i`:

```javascript
const col = i % slot.columns;
const row = Math.floor(i / slot.columns);
const sx = col * slot.frameWidth;
const sy = row * slot.frameHeight;
// drawImage(sheet, sx, sy, frameWidth, frameHeight, destX - anchor.x, destY - anchor.y, frameWidth, frameHeight)
```

### Play-loop per frame

Each frame in `slot.directions[dir].frames` carries an optional `ms` duration that overrides `slot.fps`. The literal `"hold"` freezes the animation on that frame indefinitely — typically used as the last frame of a non-looping animation that should pause on its final pose.

```javascript
function resolveFrame(entry, all) {
  if (typeof entry === 'number') return { frame: entry, flip: false, ms: undefined };
  if (!entry || typeof entry !== 'object') return null;
  const ms = (typeof entry.ms === 'number' && entry.ms > 0)
    ? entry.ms : (entry.ms === 'hold' ? 'hold' : undefined);
  if (Number.isFinite(entry.index)) return { frame: entry.index, flip: false, ms };
  if (Number.isFinite(entry.mirrorOf)) {
    let cur = entry, flip = false, depth = 0;
    while (cur && typeof cur === 'object' && Number.isFinite(cur.mirrorOf)) {
      if (depth >= 4) return null;
      flip = !flip;
      cur = all[cur.mirrorOf];
      depth++;
    }
    if (typeof cur === 'number') return { frame: cur, flip, ms };
    if (cur && Number.isFinite(cur.index)) return { frame: cur.index, flip, ms };
  }
  return null;
}
function frameDurationMs(resolved, fps) {
  if (resolved.ms === 'hold') return 'hold';
  if (typeof resolved.ms === 'number' && resolved.ms > 0) return resolved.ms;
  return 1000 / Math.max(1, fps || 8);
}

// Per-character animation state: { frameIdx, msIn }. On every
// tick advance msIn by dt; when it >= the current frame's ms,
// move to the next entry. Loop back when looping; pin to last
// when not. Sentinel 'hold' freezes — never advance past it.
function stepAnim(state, frames, slot, dtMs, oneShot) {
  const looping = oneShot ? false : (slot.loop !== false);
  let remaining = dtMs;
  let safety = frames.length * 4 + 16;
  while (remaining > 0 && safety-- > 0) {
    if (state.frameIdx >= frames.length) { state.frameIdx = frames.length - 1; return; }
    const r = resolveFrame(frames[state.frameIdx], frames);
    const dur = frameDurationMs(r, slot.fps);
    if (dur === 'hold') return;
    const left = dur - state.msIn;
    if (remaining < left) { state.msIn += remaining; return; }
    remaining -= left;
    state.msIn = 0;
    state.frameIdx++;
    if (state.frameIdx >= frames.length) {
      if (looping) state.frameIdx = 0;
      else { state.frameIdx = frames.length - 1; return; }
    }
  }
}

// On draw, resolve the current entry and render at (sx, sy):
const r = resolveFrame(frames[state.frameIdx], frames);
const sx = (r.frame % slot.columns) * slot.frameWidth;
const sy = Math.floor(r.frame / slot.columns) * slot.frameHeight;
// Direction-level flip (e.g. "left" mirrored from "right") and r.flip
// (per-frame mirror-ref flip) combine via XOR.
```

### Mirrored directions

A direction can be marked `{ mirror: "<sourceDirection>" }` instead of carrying its own `frames` array. Render the source direction's frames flipped horizontally — the anchor stays the feet so the contact point doesn't drift. Mirror chains are guarded against cycles in the source toolkit (depth cap 4).

## Animation overlays (MSR-style rendering)

Some characters carry **per-frame overlays** — extra sprites attached to the body during specific
animations: a watering can during `water`, a bow during `bow_shot`, a fishing rod during
`cast_fishing_line`. When a character's `project.json` entry has an `overlays` field,
`characters/<Name>/overlays.json` describes those overlays and `characters/<Name>/overlays/` holds
the sheet PNGs.

Overlays are **direction-scoped**: each animation has its own tracks per direction (`down`, `up`,
`side`/`right`, …). The same conceptual track (e.g. `weapon_or_tool`) lives independently in each
direction with its own offsets, sheet, and per-frame data.

### File layout

```
characters/<Name>/
  character.json
  overlays.json                          // {animationName: {tracksByDirection: {down:[…], up:[…], …}}}
  overlays/
    farmer_animations_32x32_v00.png      // sanitised filenames; references in overlays.json
    farmer_tool_001_v00.png              // already point at the safe name
    fishing_effects__up__down__64x96_v00.png
    …
```

### Schema

```typescript
interface OverlaysFile {
  // Keys starting with "_" are metadata (format/version/notes); skip them.
  [animationName: string]: AnimationOverlays;
}

interface AnimationOverlays {
  tracksByDirection: {
    [direction: string]: OverlayTrack[];   // "down" | "up" | "side" | "right" | "left" | …
  };
}

interface OverlayTrack {
  name: string;             // identifier — stable across directions for the same conceptual overlay
  sheet: string;            // PNG filename inside overlays/
  cellW: number;            // source cell width  (px)
  cellH: number;            // source cell height (px)
  gridCols: number;         // columns on the sheet — `cell` index unwraps to (cell % gridCols, cell / gridCols)
  behind: boolean;          // default z-order — render this track BEHIND the body when true
  variants: OverlayVariant[];   // first entry is the runtime default
  frames: (OverlayFrame | null)[];  // one entry per body-animation frame; null = no overlay this frame
}

interface OverlayVariant {
  name: string;
  sheet?: string;           // override sheet for this variant
  cellOverride?: number;    // when set, every frame uses this cell
}

interface OverlayFrame {
  cell: number;             // sheet cell index (col + row*gridCols)
  ox: number;               // pixel offset X relative to the body cell's top-left
  oy: number;               // pixel offset Y relative to the body cell's top-left
  mirror?: boolean;         // horizontal flip of this overlay (in addition to body-level mirror)
  rotation?: number;        // degrees, CW (0 / 90 / 180 / 270 supported)
  behind?: boolean;         // per-frame z-order override of track.behind
}
```

### Rendering algorithm

Per body-animation frame:

1. Resolve the active direction (`resolveDirection(animation, inputDir)` — your character lib already does this).
2. Look up `overlays[animation].tracksByDirection[direction]`. If absent, render the body alone.
3. For each track, take `track.frames[frameIdx]`. If `null`/missing, skip this track for this frame.
4. Determine the active variant (default = `track.variants[0]`; runtime tool-swap = pick another).
5. Determine the source cell:
   - if `variant.cellOverride` is set → use that.
   - else → use `frame.cell` (the per-frame override; this is the typical path).
6. Determine z-order: `frame.behind` (if defined) else `track.behind`.
7. Render in three passes per body frame:
   - tracks with effective `behind = true` → body cell → tracks with effective `behind = false`.

### Composite mirror

A direction can flip the entire composite (e.g. cardinal-3 `left` mirrors `side`). When a
composite-level mirror is in effect, flip the WHOLE draw block once around the character's feet x-line
(`translate(2*x, 0); scale(-1, 1)`). Per-overlay `frame.mirror` operates **inside** that flipped frame —
a frame-mirrored overlay on a left-facing character flips twice (visible once, in the original
orientation). This matches the source toolkit's renderer.

### Code snippet (Canvas 2D)

```javascript
// All overlay sheet PNGs are pre-loaded into Image objects keyed
// by their sanitised filename:
//   sheetImages.get("farmer_tool_001_v00.png") → HTMLImageElement

function drawCharacterWithOverlays(ctx, character, overlays, anim, dir, frameIdx, x, y, scale) {
  const sc = scale || 1;
  const bodyTopLeft = { x: x - character.anchor.x * sc, y: y - character.anchor.y * sc };

  const animOv = overlays && overlays[anim];
  const tracks = (animOv && animOv.tracksByDirection && animOv.tracksByDirection[dir]) || [];

  const behind = [], front = [];
  for (const t of tracks) {
    const frame = (t.frames || [])[frameIdx];
    if (!frame) continue;
    const isBehind = (typeof frame.behind === 'boolean') ? frame.behind : !!t.behind;
    (isBehind ? behind : front).push({ track: t, frame });
  }

  drawOverlays(ctx, bodyTopLeft, sc, behind);
  drawCharacterBody(ctx, character, anim, dir, frameIdx, x, y, sc);  // your existing body renderer
  drawOverlays(ctx, bodyTopLeft, sc, front);
}

function drawOverlays(ctx, bodyTL, sc, items) {
  for (const { track, frame } of items) {
    const variant = (track.variants && track.variants[0]) || null;
    const sheetName = (variant && variant.sheet) || track.sheet;
    const img = sheetImages.get(sheetName);
    if (!img || !img.complete) continue;
    const cell = (variant && Number.isFinite(variant.cellOverride)) ? variant.cellOverride : frame.cell;
    const sx = (cell % track.gridCols) * track.cellW;
    const sy = Math.floor(cell / track.gridCols) * track.cellH;
    const dx = bodyTL.x + frame.ox * sc;
    const dy = bodyTL.y + frame.oy * sc;
    const dW = track.cellW * sc, dH = track.cellH * sc;
    const rot = (frame.rotation | 0) % 360;
    const flip = !!frame.mirror;
    if (rot === 0 && !flip) {
      ctx.drawImage(img, sx, sy, track.cellW, track.cellH, dx, dy, dW, dH);
    } else {
      ctx.save();
      ctx.translate(dx + dW / 2, dy + dH / 2);
      if (rot)  ctx.rotate(rot * Math.PI / 180);
      if (flip) ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, track.cellW, track.cellH, -dW / 2, -dH / 2, dW, dH);
      ctx.restore();
    }
  }
}
```

### Variants (runtime tool/skin swap)

A track's `variants[]` lists alternative visuals — wooden vs. metal watering can, copper vs. iron sword.
The first entry is the default. Switch at runtime by selecting a different variant for that track:
if `variant.sheet` is set, draw from the alternate sheet; if `variant.cellOverride` is set, every frame
of the animation uses that cell instead of the per-frame `frame.cell`. Either or both can be set.

### Permissive rendering

If `overlays.json` references a track sheet that wasn't bundled (or fails to load), skip just that
frame's overlay and continue rendering the body. Don't crash the animation — body-only is graceful
degradation. Sheets are explicitly small enough to pre-load all of them at boot.

## Layered characters (equipment / outfit system)

A character whose `character.json` carries `equipmentSlots` is **layered**: the visible sprite is composited from multiple sheets at render time. There is no single "spriteSheet" on its animations — every animation references frames on a shared grid, and every layer's sheet uses the same grid.

### File layout

```
characters/<Name>/
  character.json
  equipment/
    Body/
      default.png         (base body — always rendered)
    Shirt/
      blue.png
      armor.png
    Hair/
      red.png
      blonde.png
    Hat/
      wizard.png
```

### `character.json` shape

```typescript
interface LayeredCharacter {
  name: string;
  defaultAnimation: string;
  // Grid info hoisted to the character — every layer's sheet uses these dims.
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  anchor: { x: number, y: number };
  // Animations carry frames + directions only. No spriteSheet field.
  animations: { [slot: string]: { fps, loop, directions, anchor, frameWidth, ... } };
  // Slots in render order (Body first → topmost last). The Body slot has
  // `isBase: true` and is always rendered. Non-base slots can be hidden.
  equipmentSlots: Array<{
    name: string;          // "Body", "Shirt", "Pants", "Hair", "Hat", ...
    isBase: boolean;       // true only on the Body slot at index 0
    order: number;         // matches array index — lowest renders first
    defaultOption: string | null;  // option name to render by default
    options: Array<{ name: string; spriteSheet: string }>;  // path relative to character folder
  }>;
}
```

### Render snippet

```javascript
// `outfit` is your runtime mapping from slot name to option name,
// e.g. { Body: "default", Shirt: "blue", Hair: "red", Hat: null }.
// A `null` value (or missing key) hides that layer.
function drawCharacter(ctx, character, outfit, anim, dir, t, x, y) {
  const slot   = character.animations[anim];
  const dEntry = slot.directions[dir] || slot.directions.down;
  const frames = dEntry.frames;
  // Mirror chain (see "Mirrored directions" above).
  const flip   = !!dEntry.mirror;
  const real   = flip ? slot.directions[dEntry.mirror].frames : frames;
  const idx    = Math.floor(t * (slot.fps || 8)) % real.length;
  const frame  = real[idx];
  const fw = slot.frameWidth, fh = slot.frameHeight;
  const sx = (frame % slot.columns) * fw;
  const sy = Math.floor(frame / slot.columns) * fh;
  const a  = slot.anchor || { x: fw / 2, y: fh };
  for (const eq of character.equipmentSlots) {
    const optName = (eq.name in outfit) ? outfit[eq.name] : eq.defaultOption;
    if (!optName) continue;          // explicit null → hide this layer
    const opt = eq.options.find(o => o.name === optName);
    if (!opt || !opt._image) continue;  // _image: pre-loaded HTMLImageElement
    if (flip) {
      ctx.save();
      ctx.translate(x, 0); ctx.scale(-1, 1);
      ctx.drawImage(opt._image, sx, sy, fw, fh, -(fw - a.x), y - a.y, fw, fh);
      ctx.restore();
    } else {
      ctx.drawImage(opt._image, sx, sy, fw, fh, x - a.x, y - a.y, fw, fh);
    }
  }
}
```

Pre-load every `equipmentSlots[*].options[*].spriteSheet` as an `HTMLImageElement` (or PIXI texture) before the first frame and cache it on the option object — the loop above assumes that's already done.

### Outfit switching at runtime

Maintain `outfit` as plain state. Changing `outfit.Shirt = "armor"` (or `outfit.Hat = null`) shows the new combination on the very next render — no re-slicing, no reload. Every layer shares the animation timeline, so a frame-perfect `walk` animation looks identical whether the character has a hat or not.

The toolkit's own standalone HTML export exposes a runtime API on `window` for the same purpose:

```javascript
// Inside the exported game (or any script that loads it):
setOutfit('Hat', null);          // hide the hat
setOutfit('Shirt', 'armor');     // swap shirt → "armor" option
const outfit = getOutfit();      // snapshot current selection
const opts   = listOutfitOptions('Shirt');  // ["blue", "armor", ...]
```


## Recommended tech

- **Canvas 2D** — simplest; perfect for pixel art; no dependencies. Use `ctx.imageSmoothingEnabled = false` for crisp pixels.
- **PIXI.js (v8+)** — for many objects or effects. The toolkit's own standalone export uses PIXI.
- Keep **player.y = world feet position** so the depth sort is trivially `sort by y`.
- Use **arrow-keys + WASD** for movement, **Shift** for run, **Space** for jump. (Matches the slot fallbacks.)

## Notes

- All image assets are real PNG files, not base64. Paths in JSON are relative within the ZIP.
- JSON is pretty-printed (2-space indent).
- `project.json.format === "krabsy-ai-export-v1"` — version bump if this format changes.
