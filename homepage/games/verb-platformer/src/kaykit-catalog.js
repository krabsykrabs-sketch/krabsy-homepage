// Single source of truth for the KayKit Platformer Pack assets exposed in the editor
// and consumed by the runtime. Both editor.js and level-loader.js import this.
//
// Naming convention: asset `type` strings match the KayKit filename base (e.g. "platform_4x4x1",
// "flag_C"). Colored files live at  ./assets/kaykit-platformer/<color>/<type>_<color>.gltf .
// Neutral-only files live at        ./assets/kaykit-platformer/neutral/<type>.gltf .
//
// Per-entry fields:
//   type           — string id, must equal the KayKit basename
//   category       — grouping section in the editor library
//                      'platforms' | 'slopes' | 'goal' | 'collectibles' | 'signage'
//                    | 'decor' | 'barriers' | 'pipes' | 'interactables'
//   kind           — runtime behavior class:
//                      'platform' (walkable, may fall if color=red), 'flag' (level goal),
//                      'collectible' (spin + pickup on touch), 'decor' (visual only, no
//                      collider), 'decor-solid' (visual + static collider)
//   half           — collider half-extents in world units (platforms + decor-solid only)
//   height         — model anchor offset from the WALKABLE TOP surface in world units. The
//                    runtime renders the mesh at (y - height) so the user places the platform
//                    by its top. KayKit anchors at the bottom of each mesh, so height == size Y.
//   colors         — supported color variants for this asset
//   defaultColor   — chosen automatically when the user places this asset
//   singleton      — only one allowed per level (spawn, flag — but actually no flag here yet)
//
// For platform-type assets, the half-extents are derived from the X×Z×Y bounding box reported
// by the GLTF accessors. KayKit's naming is `width × depth × height` (XxZxY in coords).

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function platform(type, x, z, y, opts = {}) {
  return {
    type,
    category: opts.category || 'platforms',
    kind: 'platform',
    half: { x: x / 2, y: y / 2, z: z / 2 },
    height: y,
    colors: ['red', 'blue', 'green', 'yellow'],
    defaultColor: 'blue',
    // 'box' uses an AABB-sized cuboid collider (fast; correct for ordinary platforms).
    // 'trimesh' walks the GLTF triangles into a static trimesh collider — slower per-vertex
    // but the only way to get matching colliders for slopes (the player can climb the
    // diagonal) and the hole platform (the player can fall through the hole).
    colliderKind: 'box',
    ...opts,
  };
}

function colored(type, kind, opts = {}) {
  return {
    type,
    kind,
    colors: ['red', 'blue', 'green', 'yellow'],
    defaultColor: 'blue',
    ...opts,
  };
}

function fiveColor(type, kind, opts = {}) {
  // Assets with both a neutral form AND the four colored variants. Default to neutral so the
  // user gets the most "honest" KayKit look unless they intentionally tint it.
  return {
    type,
    kind,
    colors: ['neutral', 'red', 'blue', 'green', 'yellow'],
    defaultColor: 'neutral',
    ...opts,
  };
}

function neutralOnly(type, kind, opts = {}) {
  return {
    type,
    kind,
    colors: ['neutral'],
    defaultColor: 'neutral',
    ...opts,
  };
}

// Hazard entry. Touching one triggers respawn at runtime. The `behavior` field tells the
// runtime which animation/motion to apply: 'static' (no motion), 'pendulum' (swings about a
// top pivot), 'rotator' (spins around its local Y axis), 'trap' (cycles up/down on a timer),
// 'cannon' (fires bullets on a timer). `defaults` provides the per-instance starting values
// for behavior parameters; the editor exposes them as editable fields and they're persisted
// in level JSON alongside position/rotation.
function hazard(type, behavior, opts = {}) {
  const defaults = { ...defaultsFor(behavior), ...(opts.defaults || {}) };
  return {
    type,
    kind: 'hazard',
    category: opts.category || 'hazards',
    behavior,
    defaults,
    colors: opts.colors || ['red', 'blue', 'green', 'yellow'],
    defaultColor: opts.defaultColor || 'red',
    ...opts,
  };
}

function hazardNeutral(type, behavior, opts = {}) {
  return hazard(type, behavior, { ...opts, colors: ['neutral'], defaultColor: 'neutral' });
}

function defaultsFor(behavior) {
  switch (behavior) {
    case 'conveyor': return { speed: 3.0 };                            // m/s along local +Z
    case 'pendulum': return { period: 2.0, amplitude: 45, phase: 0 };  // sec, deg, deg
    case 'rotator':  return { rpm: 60 };                               // signed; negative reverses
    case 'trap':     return { period: 2.0, onFraction: 0.4, phase: 0 };// sec, 0..1, deg
    case 'cannon':   return { interval: 2.0, bulletSpeed: 6 };          // sec, m/s
    default:         return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog

export const CATALOG = [
  // ── Platforms (the core building blocks) ───────────────────────────────────
  platform('platform_1x1x1', 1, 1, 1),
  platform('platform_2x2x1', 2, 2, 1),
  platform('platform_2x2x2', 2, 2, 2),
  platform('platform_2x2x4', 2, 2, 4),
  platform('platform_4x2x1', 4, 2, 1),
  platform('platform_4x2x2', 4, 2, 2),
  platform('platform_4x2x4', 4, 2, 4),
  platform('platform_4x4x1', 4, 4, 1),
  platform('platform_4x4x2', 4, 4, 2),
  platform('platform_4x4x4', 4, 4, 4),
  platform('platform_6x2x1', 6, 2, 1),
  platform('platform_6x2x2', 6, 2, 2),
  platform('platform_6x2x4', 6, 2, 4),
  platform('platform_6x6x1', 6, 6, 1),
  platform('platform_6x6x2', 6, 6, 2),
  platform('platform_6x6x4', 6, 6, 4),
  platform('platform_arrow_2x2x1',      2, 2, 1, { label: 'arrow 2×2×1' }),
  platform('platform_arrow_4x4x1',      4, 4, 1, { label: 'arrow 4×4×1' }),
  platform('platform_decorative_1x1x1', 1, 1, 1, { label: 'decorative 1×1×1' }),
  platform('platform_decorative_2x2x2', 2, 2, 2, { label: 'decorative 2×2×2' }),
  platform('platform_hole_6x6x1',       6, 6, 1, { label: 'hole 6×6×1', colliderKind: 'trimesh' }),

  // Wooden floor / pallet tiles. KayKit ships these only in the neutral folder (no colored
  // variants), so they have `colors: ['neutral']` and the runtime resolves URLs straight from
  // ./assets/kaykit-platformer/neutral/. All four are 0.5 high — thinner than the standard
  // 1-tall platform — so the player ends up just a half-block above the placement Y plane.
  platform('floor_wood_1x1',     1, 1, 0.5, { label: 'wood floor 1×1',    colors: ['neutral'], defaultColor: 'neutral' }),
  platform('floor_wood_2x2',     2, 2, 0.5, { label: 'wood floor 2×2',    colors: ['neutral'], defaultColor: 'neutral' }),
  platform('floor_wood_2x6',     6, 2, 0.5, { label: 'wood floor 6×2',    colors: ['neutral'], defaultColor: 'neutral' }),
  platform('floor_wood_4x4',     4, 4, 0.5, { label: 'wood floor 4×4',    colors: ['neutral'], defaultColor: 'neutral' }),
  platform('platform_wood_1x1x1',1, 1, 1,   { label: 'wood platform 1×1', colors: ['neutral'], defaultColor: 'neutral' }),

  // ── Slopes (treated as static decor for now per the spec: no slope physics) ─
  // Bounding box matches NxMxK; we still give them a collider sized to the bbox so the
  // player can stand on top of the prism's tallest edge. Lateral motion will slide off the
  // tilted top because we don't model the diagonal.
  platform('platform_slope_2x2x2', 2, 2, 2, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_2x4x4', 2, 4, 4, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_2x6x4', 2, 6, 4, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_4x2x2', 4, 2, 2, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_4x4x4', 4, 4, 4, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_4x6x4', 4, 6, 4, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_6x2x2', 6, 2, 2, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_6x4x4', 6, 4, 4, { category: 'slopes', colliderKind: 'trimesh' }),
  platform('platform_slope_6x6x4', 6, 6, 4, { category: 'slopes', colliderKind: 'trimesh' }),

  // ── Goal flags ─────────────────────────────────────────────────────────────
  colored('flag_C', 'flag', { category: 'goal', singleton: true, label: 'flag (tall)' }),
  colored('flag_B', 'flag', { category: 'goal', label: 'flag (medium)' }),
  colored('flag_A', 'flag', { category: 'goal', label: 'flag (short)' }),

  // ── Collectibles (placeable; spin + disappear on touch, no scoring yet) ────
  colored('star',    'collectible', { category: 'collectibles' }),
  colored('diamond', 'collectible', { category: 'collectibles' }),
  colored('heart',   'collectible', { category: 'collectibles' }),
  colored('power',   'collectible', { category: 'collectibles' }),
  fiveColor('ball',  'collectible', { category: 'collectibles' }),

  // ── Signage (mostly arrows + finish-line) ──────────────────────────────────
  neutralOnly('sign',                  'decor',       { category: 'signage' }),
  colored('signage_arrow_stand',       'decor',       { category: 'signage' }),
  colored('signage_arrow_wall',        'decor',       { category: 'signage' }),
  fiveColor('signage_arrows_left',     'decor',       { category: 'signage' }),
  fiveColor('signage_arrows_right',    'decor',       { category: 'signage' }),
  neutralOnly('signage_finish',        'decor',       { category: 'signage' }),
  neutralOnly('signage_finish_wide',   'decor',       { category: 'signage' }),

  // ── Decor (arches, pillars, bracing, railings, struts, structures, cone) ───
  colored('arch',                'decor', { category: 'decor' }),
  colored('arch_tall',           'decor', { category: 'decor' }),
  colored('arch_wide',           'decor', { category: 'decor' }),
  // Pillar half-extents widened to whole-cell footprints (0.5 for 1×1, 1.0 for 2×2) so the
  // editor's `int + half` snap lands 1×1 pillars on cell centers (.5) and 2×2 pillars on cell
  // corners (integers) — matching the rest of the platform catalog. The collider ends up
  // marginally larger than the visible pillar mesh, but it's a tiny margin and buys consistent
  // grid placement.
  neutralOnly('pillar_1x1x1',    'decor-solid', { category: 'decor', half: { x: 0.5, y: 0.5, z: 0.5 }, height: 0 }),
  neutralOnly('pillar_1x1x2',    'decor-solid', { category: 'decor', half: { x: 0.5, y: 1.0, z: 0.5 }, height: 0 }),
  neutralOnly('pillar_1x1x4',    'decor-solid', { category: 'decor', half: { x: 0.5, y: 2.0, z: 0.5 }, height: 0 }),
  neutralOnly('pillar_1x1x8',    'decor-solid', { category: 'decor', half: { x: 0.5, y: 4.0, z: 0.5 }, height: 0 }),
  neutralOnly('pillar_2x2x2',    'decor-solid', { category: 'decor', half: { x: 1.0, y: 1.0, z: 1.0 }, height: 0 }),
  neutralOnly('pillar_2x2x4',    'decor-solid', { category: 'decor', half: { x: 1.0, y: 2.0, z: 1.0 }, height: 0 }),
  neutralOnly('pillar_2x2x8',    'decor-solid', { category: 'decor', half: { x: 1.0, y: 4.0, z: 1.0 }, height: 0 }),
  colored('bracing_small',       'decor', { category: 'decor' }),
  colored('bracing_medium',      'decor', { category: 'decor' }),
  colored('bracing_large',       'decor', { category: 'decor' }),
  colored('railing_straight_single', 'decor', { category: 'decor' }),
  colored('railing_straight_double', 'decor', { category: 'decor' }),
  colored('railing_straight_padded', 'decor', { category: 'decor' }),
  colored('railing_corner_single',   'decor', { category: 'decor' }),
  colored('railing_corner_double',   'decor', { category: 'decor' }),
  colored('railing_corner_padded',   'decor', { category: 'decor' }),
  fiveColor('cone',              'decor', { category: 'decor' }),
  neutralOnly('strut_horizontal','decor', { category: 'decor' }),
  neutralOnly('strut_vertical',  'decor', { category: 'decor' }),
  neutralOnly('structure_A',     'decor', { category: 'decor' }),
  neutralOnly('structure_B',     'decor', { category: 'decor' }),
  neutralOnly('structure_C',     'decor', { category: 'decor' }),

  // ── Barriers (decor only, available in all 5 colors) ───────────────────────
  fiveColor('barrier_1x1x1', 'decor', { category: 'barriers' }),
  fiveColor('barrier_1x1x2', 'decor', { category: 'barriers' }),
  fiveColor('barrier_1x1x4', 'decor', { category: 'barriers' }),
  fiveColor('barrier_2x1x1', 'decor', { category: 'barriers' }),
  fiveColor('barrier_2x1x2', 'decor', { category: 'barriers' }),
  fiveColor('barrier_2x1x4', 'decor', { category: 'barriers' }),
  fiveColor('barrier_3x1x1', 'decor', { category: 'barriers' }),
  fiveColor('barrier_3x1x2', 'decor', { category: 'barriers' }),
  fiveColor('barrier_3x1x4', 'decor', { category: 'barriers' }),
  fiveColor('barrier_4x1x1', 'decor', { category: 'barriers' }),
  fiveColor('barrier_4x1x2', 'decor', { category: 'barriers' }),
  fiveColor('barrier_4x1x4', 'decor', { category: 'barriers' }),

  // ── Pipes (decor only — no warp behaviour) ─────────────────────────────────
  colored('pipe_straight_A', 'decor', { category: 'pipes' }),
  colored('pipe_straight_B', 'decor', { category: 'pipes' }),
  colored('pipe_90_A',       'decor', { category: 'pipes' }),
  colored('pipe_90_B',       'decor', { category: 'pipes' }),
  colored('pipe_180_A',      'decor', { category: 'pipes' }),
  colored('pipe_180_B',      'decor', { category: 'pipes' }),
  colored('pipe_end',        'decor', { category: 'pipes' }),

  // ── Interactables (decor only — placement available, no behavior wired) ────
  colored('bomb_A',           'decor', { category: 'interactables' }),
  colored('bomb_B',           'decor', { category: 'interactables' }),
  colored('spring_pad',       'decor', { category: 'interactables' }),
  colored('lever_floor_base', 'decor', { category: 'interactables' }),
  colored('lever_wall_base_A','decor', { category: 'interactables' }),
  colored('lever_wall_base_B','decor', { category: 'interactables' }),
  colored('button_base',      'decor', { category: 'interactables' }),
  colored('hoop',             'decor', { category: 'interactables' }),
  colored('hoop_angled',      'decor', { category: 'interactables' }),

  // ── EXTRA pack: conveyors (walkable platforms that carry the rider along local +Z) ─
  // half-Z is the full belt length / 2; the belt direction is +Z in the model's local frame,
  // so rotating the conveyor in the editor rotates the belt direction along with it.
  platform('conveyor_2x4x1', 2, 4, 1, { category: 'conveyors', label: 'conveyor 2×4', behavior: 'conveyor', defaults: { speed: 3.0 } }),
  platform('conveyor_2x8x1', 2, 8, 1, { category: 'conveyors', label: 'conveyor 2×8', behavior: 'conveyor', defaults: { speed: 3.0 } }),
  platform('conveyor_4x4x1', 4, 4, 1, { category: 'conveyors', label: 'conveyor 4×4', behavior: 'conveyor', defaults: { speed: 3.0 } }),
  platform('conveyor_4x8x1', 4, 8, 1, { category: 'conveyors', label: 'conveyor 4×8', behavior: 'conveyor', defaults: { speed: 3.0 } }),

  // ── EXTRA pack: walkable floor nets. The mesh sits offset above the data Y (anchor at the
  // top edge of the mesh), so we give it height=1 — the player walks across the rope grid as
  // if it were a 1-tall platform.
  platform('floor_net_2x2x1', 2, 2, 1, { label: 'floor net 2×2' }),
  platform('floor_net_4x4x1', 4, 4, 1, { label: 'floor net 4×4' }),

  // ── EXTRA pack: HAZARDS ────────────────────────────────────────────────────
  // Pendulum hazards (hammers, hanging spikeballs). The model anchors at the TOP — the pivot
  // sits at data Y, the head/blade hangs below into negative local Y. The runtime swings the
  // whole mesh around the pivot.
  // Hammers are PUSHY pendulums — touching them shoves the player away, doesn't kill outright.
  // The runtime adds a kinematic collider on the head that the Rapier character controller
  // resolves against, so the player can be knocked off ledges (which then naturally triggers
  // a fall-respawn). `pushy: true` opts into this collider; without it the pendulum is a
  // ghost AABB-kill hazard.
  hazard('hammer',                'pendulum', { defaults: { period: 2.0, amplitude: 45, phase: 0 }, pushy: true }),
  hazard('hammer_large',          'pendulum', { defaults: { period: 2.5, amplitude: 45, phase: 0 }, pushy: true }),
  hazard('hammer_spikes',         'pendulum', { defaults: { period: 2.0, amplitude: 45, phase: 0 }, pushy: true }),
  hazard('hammer_large_spikes',   'pendulum', { defaults: { period: 2.5, amplitude: 45, phase: 0 }, pushy: true }),
  hazardNeutral('hammerblock',         'static'),    // the head, used as a static decor block
  hazardNeutral('hammerblock_spikes',  'static'),
  hazardNeutral('spikeball',           'static'),
  hazardNeutral('spikeball_hanger',    'pendulum', { defaults: { period: 2.5, amplitude: 50, phase: 0 } }),

  // Rotating hazards (saws, rollers, swipers). The runtime spins the whole mesh around its
  // local Y axis at `rpm` revolutions per minute (signed — negative reverses).
  hazard('saw_trap',              'rotator', { defaults: { rpm: 90  } }),
  hazard('saw_trap_double',       'rotator', { defaults: { rpm: 90  } }),
  hazard('saw_trap_long',         'rotator', { defaults: { rpm: 90  } }),
  hazardNeutral('sawblade',            'rotator', { defaults: { rpm: 90  } }),
  hazardNeutral('spikeroller_horizontal','rotator', { defaults: { rpm: 30 } }),
  hazardNeutral('spikeroller_vertical',  'rotator', { defaults: { rpm: 60 } }),
  hazard('swiper',                'rotator', { defaults: { rpm: 24  } }),
  hazard('swiper_double',         'rotator', { defaults: { rpm: 24  } }),
  hazard('swiper_long',           'rotator', { defaults: { rpm: 18  } }),
  hazard('swiper_double_long',    'rotator', { defaults: { rpm: 18  } }),
  hazard('swiper_quad',           'rotator', { defaults: { rpm: 24  } }),
  hazard('swiper_quad_long',      'rotator', { defaults: { rpm: 18  } }),

  // Static ground-level hazards (always on).
  hazardNeutral('floor_spikes_2x2x1',        'static'),
  hazardNeutral('floor_spikes_4x4x1',        'static'),
  hazardNeutral('floor_spikes_curved_4x2x2', 'static'),

  // Spike blocks — directional surfaces that kill on contact. Static, with the spikes facing
  // up/down/left/right or all around. The runtime treats them as static hazards (no animation).
  hazard('spikeblock_down',              'static'),
  hazard('spikeblock_up',                'static'),
  hazard('spikeblock_left',              'static'),
  hazard('spikeblock_right',             'static'),
  hazard('spikeblock_double_horizontal', 'static'),
  hazard('spikeblock_double_vertical',   'static'),
  hazard('spikeblock_omni',              'static'),
  hazard('spikeblock_quad',              'static'),

  // Floor spike traps — cycle up (hazardous) and down (safe) on a timer.
  hazard('floor_spikes_trap_2x2x1', 'trap', { defaults: { period: 2.0, onFraction: 0.4, phase: 0 } }),
  hazard('floor_spikes_trap_4x4x1', 'trap', { defaults: { period: 2.0, onFraction: 0.4, phase: 0 } }),

  // Cannons — spawn bullet projectiles every `interval` seconds, fired along local +Z at
  // `bulletSpeed` m/s. Bullets are visible but don't kill on contact in v1 (see scope notes).
  hazard('cannon_base',           'cannon', { defaults: { interval: 2.0, bulletSpeed: 6 } }),
  hazardNeutral('cannon_bullet',       'static'),   // not user-placeable in practice, kept for completeness

  // ── EXTRA pack: chests (collectibles) ──────────────────────────────────────
  colored('chest',       'collectible', { category: 'collectibles', label: 'chest' }),
  colored('chest_large', 'collectible', { category: 'collectibles', label: 'chest (large)' }),

  // ── EXTRA pack: safety nets (decor with solid collider for v1; bounce mechanic TBD) ─
  colored('safetynet_2x2x1', 'decor', { category: 'safety', label: 'safety net 2×2' }),
  colored('safetynet_4x2x1', 'decor', { category: 'safety', label: 'safety net 4×2' }),
  colored('safetynet_6x2x1', 'decor', { category: 'safety', label: 'safety net 6×2' }),

  // ── EXTRA pack: chains (decor — used to mount hammers and spikeballs visually) ─
  neutralOnly('chain_full',            'decor', { category: 'decor' }),
  neutralOnly('chain_link',            'decor', { category: 'decor' }),
  neutralOnly('chain_link_end_top',    'decor', { category: 'decor' }),
  neutralOnly('chain_link_end_bottom', 'decor', { category: 'decor' }),
];

export const CATALOG_BY_TYPE = Object.fromEntries(CATALOG.map(e => [e.type, e]));

// Category order + display labels for the editor library.
export const CATEGORY_ORDER = [
  ['platforms',     'Platforms'],
  ['conveyors',     'Conveyors'],
  ['slopes',        'Slopes'],
  ['hazards',       'Hazards'],
  ['safety',        'Safety nets'],
  ['goal',          'Goal'],
  ['collectibles',  'Collectibles'],
  ['signage',       'Signage'],
  ['decor',         'Decor'],
  ['barriers',      'Barriers'],
  ['pipes',         'Pipes'],
  ['interactables', 'Interactables'],
];

// Resolve the GLTF URL for a given asset + color.
// `color === 'neutral'`  →  ./assets/kaykit-platformer/neutral/<type>.gltf
// otherwise              →  ./assets/kaykit-platformer/<color>/<type>_<color>.gltf
export function urlFor(type, color) {
  if (color === 'neutral') return `./assets/kaykit-platformer/neutral/${type}.gltf`;
  return `./assets/kaykit-platformer/${color}/${type}_${color}.gltf`;
}

// Pick the right starting color for a given catalog entry.
export function defaultColorFor(type) {
  const e = CATALOG_BY_TYPE[type];
  return e ? e.defaultColor : 'neutral';
}
