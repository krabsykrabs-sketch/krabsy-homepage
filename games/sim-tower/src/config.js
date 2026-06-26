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
  ROOM_GAP_X: 1.0,          // horizontal gap between rooms sharing a floor (world units).

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
    FRONT_PROTRUDE: 0.45,   // how far slabs/roof stick toward the camera past the room front.
    BACK_OFFSET: 0.25,      // how far the back wall plane sits behind the rooms.
    CONCRETE_BACK: '#2a3342', // dark back wall — recedes (shadowbox depth).
    SLAB: '#626b7a',        // floor slabs / structure (warm concrete).
    GROUND: '#3a4350',      // sidewalk.
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

  // ── Scene tint ────────────────────────────────────────────────────────
  BG_TOP: '#243042',        // backdrop gradient (top) — cool navy.
  BG_BOTTOM: '#0e141d',     // backdrop gradient (bottom) — darker.

  // ── Game (Krabsy Tower: build-and-grow tycoon) ────────────────────────
  GAME: {
    START_COINS: 48,
    COST: { simroom1: 12, SimOffice: 16, _default: 14 },   // coins to build a room
    FLOOR_COST: 18,                                         // coins to add a floor
    EARN: { simroom1: 2, SimOffice: 3, _default: 2 },       // coins per income tick, per tenant
    EARN_INTERVAL: 4.5,                                     // seconds between a room's income ticks
    MAX_OCC: { simroom1: 2, SimOffice: 2, _default: 2 },    // tenants a room holds
    MOVE_IN_INTERVAL: 3.0,                                  // avg seconds between tenant move-ins
    GOALS: [3, 6, 10, 15, 22, 30, 42, 56],                 // population milestones → level up
    GOAL_BONUS: 12,                                         // coins awarded on level up
    SEED_OCCUPIED: 1,                                       // tenants pre-placed in the starter room
  },
};
