# Verb Hatchery — world review and proposal (2026-11-23)

Nothing in this file is built yet (except the Beach, see the Log in `CLAUDE.md`).
The owner picks; then a session builds the picked items.

Pictures are in `_shots/` (not in git): `review-*.png` = the world today,
`beach-before-*.png` / `beach-after-*.png` = the Beach rebuild.

Effort: **S** = up to 1 hour, **M** = half a day, **L** = a day or more.

## What is wrong today (short)

1. **The ground is one flat green.** No grass, no texture, no colour change
   between zones (`review-meadow-empty.png`, `review-island-top.png`).
2. **Zones are round stamps.** The Forest is a disc of trees, the Volcano a
   smooth cone on a lawn (`review-forest.png`, `review-volcano.png`).
3. **Home is a box with a roof** on a brown rectangle (`review-home.png`).
4. **Sky and light are flat**: one sky colour, hard dark shadows.
5. **White egg beams dominate every view** (`review-island-top.png`).
6. **Too many draw calls.** Measured headless today: 200–250 in a Beach
   view, about 450 looking at Home; the scene has 885 separate meshes. (The
   log says "~50"; that number does not match what I measure.) This is the
   real risk for Chromebooks, and it limits everything we add.

## Proposal, in the order I would build it

### Step 1 — quick wins, no new assets

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 1 | **Merge the static props** | `decor.js` `put()` adds every model as its own mesh. Merge all props that never move into one mesh per material (like the new pier and parasols). Same for pens and incubators. | M | **Saves** roughly 100–300 draw calls (estimate) |
| 2 | **Sky, light, colour** | Gradient sky dome (light at the horizon, deeper blue above), a visible sun, softer shadows, tone mapping, slightly warm light. | S | none |
| 3 | **Egg beams** | Thinner, in the egg's colour, fading out with height; only the event egg keeps a big beam. | S | none |
| 4 | **Pond like the sea** | Use the new shore shader (light shallows, foam line) on the pond, give it an irregular shape, fix the teal reeds. | S | none |

### Step 2 — the ground (biggest visual gain)

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 5 | **Ground colour per zone** | Darker, mossy floor in the Forest; grey ash ring around the Volcano; dry yellow patches and flower-coloured patches in the Meadow. Vertex colours only. | S | none |
| 6 | **Grass and small plants** | Many small tufts, clover, ferns and pebbles as instanced meshes, drawn only near the player. Models: Quaternius *Stylized Nature MegaKit* (already in `/home/janah/dev/_assets/quaternius/`, CC0, not used yet). | M | +4–6 draw calls, +20–30k triangles near the player |
| 7 | **Paths you can read** | Stepping stones (`RockPath_*` from the same kit), a few fence posts and lanterns, a gate where a path enters a zone. | S–M | +3 draw calls |

### Step 3 — give each zone a face

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 8 | **Home: a real hatchery** | Replace the box house with a building from KayKit *Medieval Hexagon* (owned) plus a windmill or tower as a landmark seen from far; fence around the yard; bigger sign. | M | about the same |
| 9 | **Volcano** | Rough rocky cone (ridges in the height function), glowing lava streams running down (colours + glow, no new models), embers, no lawn on the slope. | M | +2 draw calls |
| 10 | **Forest** | Trees thin out at the edge instead of ending in a circle; undergrowth (ferns, bushes); a clearing with the camp as a place to reach; greenish haze inside. | M | +2–4 draw calls |
| 11 | **Meadow landmarks** | 3–4 things to navigate by: a hill with one huge tree, a small stone bridge over a stream from the pond to the sea, a scarecrow field, a ruin. Kenney *Nature Kit* / KayKit (owned). | M | +5–8 draw calls (fine after #1) |
| 12 | **Coast all round** | Alternate small coves, sand strips and rocky bits; move the lighthouse from the far west (hardly ever seen) to the Beach's north headland; 2–3 tiny islands on the horizon. | S–M | none |

### Step 4 — life

| # | What | How | Effort | Cost |
|---|---|---|---|---|
| 13 | **Wind** | Palms, trees and grass sway (a few lines in the vertex shader). | S | none |
| 14 | **Water life** | Splash rings when wading, fish jumping in the bay, a sailing boat crossing the horizon. | S–M | +2 draw calls |
| 15 | **Beach extras** | Beach hut or lookout tower, shells and starfish, buoys. | S | +2 draw calls |

## Asset packs

**Already in our library, not used in this game yet (free, CC0, nothing to download):**

- Quaternius *Stylized Nature MegaKit* (Standard): grass, clover, ferns, pebbles, stone paths, trees. For #6, #7, #10.
- KayKit *Medieval Hexagon Pack*: buildings, fences. For #8, #11. (I have not opened the pack to confirm it has a windmill.)
- Kenney *Nature Kit*: more rocks and plants; cliffs and bridges if it has them (not checked). For #11, #12.

**New packs (not downloaded; owner decides):**

| Pack | Author | Licence | Price | URL | What for |
|---|---|---|---|---|---|
| Watercraft Kit (45 files) | Kenney | CC0 | free | https://kenney.nl/assets/watercraft-kit | Sailing boats and buoys for #14, #15. Nice to have, not needed. |

I do **not** recommend buying anything. The paid tiers of the Quaternius kit
(more variants, engine files) would add nothing we need.

## My pick

Build **1 + 2 + 3** first (one session: the game gets faster and looks
cleaner), then **5 + 6** (the ground), then **8** (Home) and **9** (Volcano).
