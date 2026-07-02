// ─────────────────────────────────────────────────────────────────────────
// Tower diorama — ALL tunables in one place (Jan tunes these).
// Distances are world units. The authored rooms use grid.tile = 2 u/cell
// (KayKit pieces are 2×2), read per-level — never hardcode the tile here.
// ─────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  // ── Camera (cutaway shadowbox: fixed, near straight-on) ───────────────
  USE_PERSPECTIVE: false,   // false = orthographic (default). true = very-long-lens perspective.
  CAMERA_TILT_DEG: 5,       // downward pitch in degrees. ~5° sells a little floor without occluding tall stacks.
  CAMERA_YAW_DEG: 0,        // sideways angle in degrees. 0 = dead-on front.
  PERSPECTIVE_FOV: 11,      // only used when USE_PERSPECTIVE — keep tiny for an ortho-like long lens.
  CAMERA_DISTANCE: 60,      // how far back the camera sits (mostly matters for perspective + shadow framing).
  ZOOM_MARGIN: 1.06,        // >1 leaves padding around the building when auto-framing.
  BUILD_PAN_FRAC: 0.2,      // build mode: reserve this fraction of screen width on the left for the panel (building fits in the rest).

  // ── Building stack ────────────────────────────────────────────────────
  STORY_PITCH: 5.0,         // vertical units between floors (≈1.8u character + furniture + headroom).
  FLOOR_SLAB_GAP: 0.0,      // extra gap added on top of STORY_PITCH between stories.
  FLOOR_SURFACE_Y: 0.5,     // walking-surface height of a floor tile (Floor/hallway are 0.5 thick) — characters stand here, not at the slot base.
  ROOM_GAP_X: 0.0,          // units now sit edge-to-edge (front hallways tile into one continuous corridor).

  // ── Room placement orientation ────────────────────────────────────────
  // The authored rooms are 3 cells wide × 6 cells deep → ~6u wide × ~12u deep:
  // narrow + deep, the opposite of what a shallow shadowbox wants. ROOM_YAW_DEG
  // rotates each room about +Y when placed so its long (depth) axis can run
  // left-right instead of into the screen. 0 = exactly as authored (rows→depth).
  // 90 = lay the room on its side (rows→width): wide + shallow shadowbox.
  // 270 is the winner for the authored 3×6 rooms: depth→width, with the authored
  // wall landing at the BACK and furniture facing the camera (90 puts the wall in
  // front and hides everything). See the status log / proportions note.
  ROOM_YAW_DEG: 270,
  DEPTH_SQUASH: 1.0,        // scale the room's depth axis (Z) only. <1 compresses a too-deep room toward the camera.

  // ── Building shell (so it reads as a building, not floating rooms) ─────
  SHELL: {
    enabled: true,
    SIDE_MARGIN: 0.7,       // how far the structure extends past the rooms left/right.
    SLAB_THICK: 0.55,       // structural floor-slab thickness (fills the inter-story gap).
    GROUND_THICK: 1.6,      // sidewalk slab thickness below floor 0.
    ROOF_THICK: 0.7,
    PARAPET: 0.5,           // little lip around the roof edge.
    FRONT_PROTRUDE: -2.6,   // negative = pull slabs/roof BACK from the room front so they stop short of the hallway (no overhang occluding the interior).
    BACK_OFFSET: 0.25,      // how far the back wall plane sits behind the rooms.
    CONCRETE_BACK: '#2a3342', // dark back wall — recedes (shadowbox depth).
    SLAB: '#626b7a',        // floor slabs / structure (warm concrete).
    GROUND: '#3a4350',      // base ground under the whole block.
    PAVEMENT: '#8a93a3',    // sidewalk ring (light concrete).
    GRASS: '#4d8f56',       // courtyard lawn.
    ROOF: '#434c5a',
  },

  // ── Lighting (soft shadowbox: bright front, dark back) ────────────────
  AMBIENT_INTENSITY: 0.6,
  KEY_INTENSITY: 1.22,      // main directional "sun", from front-above.
  FILL_INTENSITY: 0.32,
  BACK_LIGHT_INTENSITY: 0.3, // cool rim from behind-above to separate tenants from the back wall.
  SHADOWS: true,

  // ── Characters ────────────────────────────────────────────────────────
  CHARS_PER_ROOM: 2,        // tenants per room (staggered + desynced so they don't lockstep).
  CHAR_SCALE: 1.15,         // KayKit chibi scale (matches verb-kitchen).
  CHAR_SPEED: 2.4,          // base walk speed, world units/s (tile = 2).
  SPEED_JITTER: 0.35,       // ± fraction of CHAR_SPEED, per character, so paces differ.
  CHAR_TURN_LERP: 12,       // heading slerp rate.
  PERFORM_MIN: 2.5,         // min seconds spent "performing" at a waypoint (sit/idle).
  PERFORM_MAX: 5.0,         // max seconds.
  ARRIVE_EPS: 0.18,         // distance at which a character is "arrived" at a waypoint.
  LOUNGE_SIT_LIFT: 0.12,    // small y-lift so couch/armchair sitters don't sink into the cushion.
  // gesture beats while standing idle (Interact / PickUp / Use_Item one-shots)
  GESTURE_ENABLED: true,
  GESTURE_FIRST_MIN: 0.7,
  GESTURE_GAP_MIN: 1.4,     // seconds between gesture beats while idle.
  GESTURE_GAP_MAX: 3.0,

  // ── 3D dollhouse camera (default for the game; ?flat=1 → old ortho cutaway) ──
  CAMERA3D: {
    FOV: 30,
    AZ0_DEG: 22, AZ_MAX_DEG: 100000,    // azimuth: start angle + orbit range (the block spins all the way round)
    POL0_DEG: 22, POL_MIN_DEG: 6, POL_MAX_DEG: 62,   // elevation above horizontal (high enough to see the courtyard)
    ROT_SPEED: 0.30,                    // degrees azimuth per pixel dragged
    PAN_SPEED: 0.028,                   // world units (target.y) per pixel dragged (pan floors)
    ZOOM_STEP: 0.0016,                  // radius change per wheel delta
    RAD_MIN: 9, RAD_MAX: 190,
    FIT_MARGIN: 1.16,                   // padding when auto-fitting the tower
    DAMP: 10,                           // higher = snappier
    DOCK_GUTTER: 0.17,                  // shift the tower right so the left dock doesn't cover it
    CULL_FADE: 0.1,                     // faded opacity for occluders between camera and rooms
    CULL_LERP: 8,                       // opacity fade rate
  },

  // ── The block ring (Krabsy Block) ─────────────────────────────────────
  BLOCK: {
    SIDE_PLOTS: 3,        // building plots per side (4 sides; corners stay open)
    PLOT_W: 12,           // plot width along the street (= a 6-row room at tile 2)
    CORNER_GAP: 12.5,     // open corner width — MUST be ≥ building depth (12) or the
                          // end buildings of adjacent sides overlap in the corner
    SIDEWALK_W: 3,        // sidewalk ring depth between building fronts and the road
  },

  // ── Commute pacing (residents strolling the ring) ─────────────────────
  CIRCULATION: {
    COMMUTE_MIN: 10,             // seconds at home before heading out
    COMMUTE_MAX: 22,
    VISIT_MIN: 7,                // seconds spent at the destination before heading home
    VISIT_MAX: 14,
  },

  // ── Streets + outdoor props (road ring, cars, streetlights, park) ─────
  STREET: {
    enabled: true,
    ROAD_SCALE: 3,        // road tile size multiplier (2u tile → 6u)
    ROAD_TOP: 0.16,       // road surface height (a kerb-step below the 0.5 sidewalk)
    CAR_TARGET_W: 2.85,   // car width in world units
    MAX_CARS: 6,          // cap on cars lapping the block
    CAR_SPACING: 5,       // one car per ~this many road tiles
    CAR_SPEED_MIN: 6.0,   // each lane picks ONE speed in this range (no same-lane collisions)
    CAR_SPEED_MAX: 10.0,
    LIGHT_H: 4.4,         // streetlight height (scaled to this)
  },

  // ── Scene tint ────────────────────────────────────────────────────────
  BG_TOP: '#243042',        // backdrop gradient (top) — cool navy.
  BG_BOTTOM: '#0e141d',     // backdrop gradient (bottom) — darker.

  // ── Game (Krabsy Tower: build-and-grow tycoon) ────────────────────────
  GAME: {
    START_COINS: 48,
    COST: { simroom1: 12, SimOffice: 16, cafe: 20, pizzeria: 22, icecream: 18, _default: 14 },  // coins to build a room (into a bought lot)
    LOT_COST: 6,                                            // coins to buy a floor-space lot (then build on it)
    FLOOR_COST: 18,                                         // (legacy) coins to add a floor
    EARN: { simroom1: 2, SimOffice: 3, cafe: 0, pizzeria: 2, icecream: 0, _default: 2 },  // coins/income tick per tenant (café + parlor are pure amenities; pizzeria earns a little)
    EARN_INTERVAL: 4.5,                                     // seconds between a room's income ticks
    MAX_OCC: { simroom1: 2, SimOffice: 2, cafe: 1, pizzeria: 1, icecream: 1, _default: 2 },   // amenities hold 1 (the person who runs it)
    MOVE_IN_INTERVAL: 3.0,                                  // avg seconds between tenant move-ins
    GOALS: [3, 6, 10, 15, 22, 30, 42, 56],                 // population milestones → level up
    GOAL_BONUS: 12,                                         // coins awarded on level up
    SEED_OCCUPIED: 1,                                       // tenants pre-placed in the starter room
    // ── wants + happiness (Option 2) ──
    LEAVE_TIME: 24,                                         // seconds a want stays unmet before "leaving" (grumbling, low rent)
    MOVEOUT_TIME: 46,                                       // seconds unmet before they actually move out
    MOOD_MULT: { happy: 1.6, meh: 0.8, leaving: 0.4 },     // rent multiplier by mood (happy pays more)
    GRUMBLE_INTERVAL: 4.0,                                  // seconds between grumble 💢 floats from unhappy residents
    // ── resident 💬 quiz (the learning hook) ──
    QUESTION: {
      FIRST_DELAY: 10,       // seconds into a session before the first bubble
      INTERVAL_MIN: 16,      // seconds between bubbles (a random resident gets one)
      INTERVAL_MAX: 28,
      REWARD: 5,             // coins for a correct answer (a "tip"), + instant happy
      BUBBLE_EVERY: 1.7,     // seconds between 💬 floats while a question is pending
    },
  },
};
