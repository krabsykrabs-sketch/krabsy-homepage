# Level Editor — Work Log

Senior-tool-dev pass over `editor.html` / `editor.js` / `editor.css`.
User profile: solo level designer building grammar-platformer levels weekly.
Scope: editor only. Game runtime, level loader, JSON format, and existing level files are untouchable.

## Phase 1 — Findings (ranked by value-to-effort)

### 1. No unsaved-work protection
- **Wrong/missing:** Closing or reloading the tab silently discards a dirty level (no `beforeunload` guard). Worse: **Open JSON** loads straight over a dirty level with no confirmation — only **New** asks. There is also no visible "unsaved changes" indicator anywhere.
- **Fix:** `beforeunload` handler when `state.dirty`; the same "Discard unsaved changes?" confirm on Open that New already has; dirty marker in the document title (`● Untitled Level — Krabsy Editor`).
- **Effort:** S **Risk:** none (no data-path changes).

### 2. Duplicate places copies off-grid (bug)
- **Wrong:** `buildPrefabFromSelection` hardcodes `half: {x:0.5, z:0.5}` for the ephemeral duplicate-prefab. Even-footprint assets (2×2, 4×4, 6×6 platforms) normally snap to integer corners; their duplicates snap to integers+0.5 — every copy lands misaligned by half a cell from the layout convention.
- **Fix:** derive the prefab's snap `half` from the anchor component's catalog entry (single selection: that asset's half; multi: keep 0.5 or use the largest even footprint so groups still tile).
- **Effort:** S **Risk:** low; placement-time only, no effect on load/save.

### 3. Attached labels double-move on group translation (bug)
- **Wrong:** When an answer-label with `attachedTo` is selected *together with its host platform*, WASD nudge and the multi-select Position delta both add the delta to the host position **and** to the label's host-relative offset — the label drifts at 2× speed and ends up detached from its bubble position. (`rotateSelectionAroundCentroid` already handles this case correctly; translation paths don't.)
- **Fix:** in `nudgeActiveOrSelection` and the multi `addPositionEditor` path, skip `data.position` mutation for records whose `attachedTo` host is also in the selection (X/Z; Y likewise).
- **Effort:** S **Risk:** low; mirrors existing rotation-path logic.

### 4. No vertical move for selected objects
- **Wrong:** WASD nudges X/Z only. Changing an object's Y means typing in the properties panel. For a 3D platformer editor with a Y-plane workflow this is the most-felt missing affordance.
- **Fix:** PageUp / PageDown (and Shift+W/S as alias) move the selection ±1 in Y, with drop lines, attached labels, and selection boxes refreshed. Toolbar tooltip + help panel updated.
- **Effort:** S **Risk:** low.

### 5. No mouse drag-move of objects
- **Wrong/missing:** Objects cannot be dragged. Repositioning anything = repeated WASD nudges or typing coordinates. This is the single biggest friction point in the place→adjust loop.
- **Fix:** in select mode, left-drag starting **on** a selected object (or on an unselected one — select it first) moves the selection in the XZ plane at the grabbed object's Y, footprint-aware snap from the grabbed object, one `pushUndo` at drag start. Drag starting on empty ground still marquee-selects. Reuses the attached-label-skip from item 3.
- **Effort:** M **Risk:** medium (interacts with click-vs-marquee logic); no format risk. Test with 150 objects for smoothness.

### 6. Overlapping objects: no way to pick the one underneath
- **Wrong:** `pickAtCursor` always returns the nearest hit. Stacked platforms / labels over platforms (the standard answer-gate construct) make lower objects unreachable by click — you must use the marquee or labels. Also `collect()` feeds **invisible** ID-label sprites to the raycaster (when Labels are toggled off), which can steal picks (verify against three r169 behavior before claiming in code).
- **Fix:** Alt+click cycles through the hit stack at the cursor (sorted near→far, repeated Alt+clicks step down); skip non-visible sprites/meshes in `collect()`.
- **Effort:** S/M **Risk:** low.

### 7. Multi-select can't edit color / correctAnswer
- **Wrong/missing:** The grammar-gate workflow is "place 3 platforms, make them red, flip one to correctAnswer, attach labels". Color and Correct Answer are single-select only, so recoloring an answer row is 3× the clicks every gate.
- **Fix:** in the multi-select properties panel, when all selected share a color list, show the color dropdown (applies to all); show a tri-state Correct Answer checkbox when any selected are red platforms.
- **Effort:** S/M **Risk:** low; uses the existing per-record `reloadObjectMesh` path.

### 8. Playtest opens a new tab every click
- **Wrong:** `window.open('./index.html?level=editor', '_blank')` — N playtests = N zombie tabs; round-trip friction.
- **Fix:** use a named window target (`window.open(url, 'krabsy-playtest')`) — the same tab is reused and re-navigated (which re-reads the localStorage draft).
- **Effort:** S **Risk:** none.

### 9. Save always downloads a new file copy
- **Wrong:** Ctrl+S triggers a browser download → `untitled-level (7).json` litter; the designer must manually overwrite the real file each save.
- **Fix:** use the File System Access API when available (`showSaveFilePicker`, remember the handle, Ctrl+S silently overwrites; also capture the handle from Open via `showOpenFilePicker`). Graceful fallback to the current download on unsupported browsers. JSON bytes unchanged.
- **Effort:** M **Risk:** low (pure I/O wrapper; format identical).

### 10. New/Open re-renders every library thumbnail
- **Wrong:** `newLevel()` and `loadFromData()` call `buildLibrary()`, which re-runs `makeThumbnail` for ~150 assets (clone + offscreen render each) — slow Open, wasted GPU work.
- **Fix:** cache thumbnail data-URLs in a `Map` keyed by asset type; `buildLibrary` reuses them. (Better: only rebuild the user-prefabs section.)
- **Effort:** S **Risk:** none.

### 11. Unknown object types are silently dropped on load → data loss on save
- **Wrong:** `spawnRec` warns and returns null for any `type` not in the catalog; the object is gone from the next save. A level touched by a newer/older editor build loses content silently.
- **Fix:** keep unknown-type records in state with a placeholder box mesh (clearly marked), exclude them from placement tools but include them in `exportData`.
- **Effort:** M **Risk:** low-medium (touches spawn/restore paths; needs careful undo testing).

### 12. Undo/redo rebuilds the whole scene
- **Wrong:** every undo snapshot restore disposes and re-spawns every object (async GLTF clones, new canvas textures for each ID label). With 100+ objects each Ctrl+Z is a visible hitch, and old textures/geometries are never `dispose()`d (GPU memory creep in long sessions).
- **Fix:** diff-based restore (reuse meshes whose data is unchanged) + proper disposal of removed meshes.
- **Effort:** L **Risk:** medium-high (undo correctness is sacred). Deferred — log only.

### Noted, out of scope / needs approval
- **Auto-reload playtest tab on Save/Playtest** (storage event listener) — needs a change in `main.js` (game side). Needs approval.
- **Playtest "start near camera"** — would need a game-side spawn-override param. Needs approval.
- **Spawn default Y** (`exportData` fallback `[0,2,0]`) — runtime contract, untouched.
- Explicitly-unwanted features (prefab systems beyond existing, terrain, collab, mobile, cloud) — not considered.

### Trivia folded into related commits (not separate items)
- Status bar hardcodes `grid: 2.0`; actual `GRID_SIZE` is 1.0 → correct alongside item 4's help/status edits.
- Help panel: Esc doesn't close it; missing entries for middle-drag pan and new shortcuts → folded into items 4/5.
- Missing Ctrl+D (duplicate), Ctrl+A (select all), F (frame selection) → folded into item 4's shortcut pass.

## Phase 2 — Implementation plan
Order: 1, 2, 3, 4, 5, 6, 7, 8 — stop at 8 completed or when remaining items are M/L with unclear value. Item 9/10 are stretch replacements if any of 5–7 prove riskier than estimated. Repo: project had no git repo; initialized one with a code-only baseline (large binary asset packs ignored, except `assets/levels/*.json` which are the level files this work must not break).

## Phase 3 — Report

8 improvements completed, one commit each, on top of baseline `c8b20be`. Only `editor.js` and `editor.html` changed (verified via `git diff --stat c8b20be HEAD`). No game runtime, loader, format, or level files touched.

### Completed (commit refs)
1. `532e155` — **Unsaved-changes guards.** `beforeunload` warning when dirty, discard-confirm on Open JSON, ● dirty marker in the tab title (dirty flag became an accessor so every existing write site updates the title).
2. `4947806` — **Duplicate snap parity fix.** Duplicates / saved prefabs carry a `snapHalf` (centroid's fractional grid parity) so copies land on the same sub-grid as the originals; `half` is now the true bounding footprint so the placement shadow matches the group. Verified in-browser: a 2×2 copy lands on integers, where it previously landed at +0.5.
3. `56d00f7` — **Attached-label 2× translation fix.** WASD nudge and the multi-select Position delta now skip labels whose host platform is in the same selection (the host carries them), matching the rotation path.
4. `fe89e6f` — **Keyboard vertical move.** PgUp/PgDn (and Shift+W/S) move the selection ±1 in Y; with a placement tool in hand they step the Y plane.
5. `3ce7d76` — **Shortcut gaps.** Ctrl+D duplicate, Ctrl+A select-all, F frame-selection (both views), Esc closes the help overlay before clearing tool/selection. Help panel updated; status bar grid readout now derives from `GRID_SIZE` (was hardcoded, and wrong: "2.0").
6. `2c7091b` — **Mouse drag-move.** Left-drag from an object moves it / the whole selection in the XZ plane at the grabbed object's height, snapped to the grabbed object's footprint parity; one undo entry per gesture. Drag from empty ground still marquee-selects; Ctrl/Shift presses stay pure selection ops.
7. `52dc96f` — **Playtest tab reuse.** Named window target, so repeated playtests re-navigate one tab instead of stacking new ones.
8. `6179a3b` — **Multi-select color + Correct Answer.** Color dropdown (variants common to the selection) and tri-state Correct Answer checkbox for the red platforms — the per-gate answer-row workflow in one edit.

### Verification done
- **Backward compat:** `assets/levels/level1.json` (the only existing editor-format level) loaded through the real file-input path on final HEAD; the editor's export is deep-equal on `objects`, `spawn`, `flag`, `id`, `name`, `topic`. (`prefabs: []` in export is pre-existing behavior, unchanged.)
- **Interaction tests** (scripted browser events on a served instance): click-select, marquee, PgUp/PgDn, drag-move with snap, group drag preserving relative offsets and Y, duplicate parity, multi-color → correctAnswer flow, and undo restoring exact file state after each.
- **Performance:** synthetic 150-object level — single-object drag costs 0.38 ms per mousemove; worst case (all 151 objects selected and dragged at once) ~10 ms/event, still ≈60 fps since browsers coalesce mousemove per frame. No regression to placement/render paths.
- `node --check` on every commit.

### Skipped / not done, and why
- **Alt+click overlap pick-cycling** (findings #6) — lost the value-per-risk comparison against items 7/8 for the last slots: marquee + clickable ID labels already mitigate it, and it touches the click/drag state machine that item 6 just extended. Good next candidate.
- **Hidden ID-label sprites steal picks** — confirmed real (three r169 raycasts invisible objects; checked the source). Only bites when Labels are toggled off. One-line fix when picked up: in `pickAtCursor`'s `collect()`, skip nodes with `visible === false` (and labels when `!state.labelsVisible`).
- **File System Access API save** (#9), **thumbnail cache** (#10), **unknown-type preservation** (#11) — M-effort, ran out of the 8-item budget; all still worth doing (see "next" below).
- **Undo/redo full-scene rebuild** (#12) — measured at ~2 s for a 151-object undo. Real but L-effort and undo correctness is high-risk; deferred deliberately.

### Needs your approval (game-side)
- **Auto-reload the playtest tab** when a new draft is saved (storage event listener in `main.js`) — would make the round-trip near-instant; pairs with the tab-reuse change.
- **Playtest from a chosen position** (spawn-override URL param read by `main.js`).

### Top 3 next, with more scope
1. **Save-in-place via the File System Access API** (#9) — kills the `level (7).json` download litter; biggest remaining save-loop friction.
2. **Diff-based undo + mesh disposal** (#12) — 151-object undo measured at ~2 s and textures are never disposed; the fix also makes long sessions leaner.
3. **Unknown-type pass-through on load** (#11) — prevents silent data loss when the catalog and a level file drift apart.

### How to verify (≈10 min)
Serve the project root (any static server; `.claude/launch.json` has one) and open `editor.html`.
1. Place a platform → tab title gains `●`; press Ctrl+S → marker clears. Edit again, try closing the tab → browser warns. Click **Open JSON** while dirty → confirm dialog appears.
2. **Open JSON** → `assets/levels/level1.json` → level appears, 19 objects; **Save JSON** and diff the download against the original — `objects`/`spawn`/`flag` identical.
3. Click a 2×2 platform, **Ctrl+D**, place the copy next to the original — edges line up exactly (no half-cell offset).
4. Drag a platform with the mouse — it follows snapped to the grid; marquee three platforms and drag one of them — the group moves rigidly; Ctrl+Z restores in one step.
5. With three platforms marquee-selected: set **Color (3)** to red, tick **Correct Answer — 3 red platforms**, then select one alone and confirm its checkbox is on.
6. Select a platform, tap **PgUp/PgDn** — it moves vertically, blue drop-line follows. Press **F** — view centers on it. **Ctrl+A** — everything selected.
7. Click **Playtest** twice — the second click reuses the same tab.
8. Press **?** then **Esc** — help closes (selection survives); status bar reads `grid: 1.0`.
