// Level 1: three rooms, side view. Cells are 1 × 1, x to the right, y UP (y = 0 is the
// bottom row). Each room is built from a few drawing steps instead of hand-typed ASCII,
// so a room stays easy to change. `ascii(room)` prints it for checking.
//
// Cell kinds in `grid`: '#' solid, 'H' ladder, '.' empty. A column left empty down to
// y = 0 is a bottomless gap: whoever falls in starts again at the room's spawn (game.js).
// Objects (all with an id):
//   lever  { targets }            any player, question → its targets turn on (one way)
//   switch { targets }            the same, a button on a wall
//   post   { targets }            the same, a bridge post (builds a bridge)
//   heavylever { targets }        STRONG only, question
//   door   { x, y, h }            solid until a target of a lever/switch; no question of its own
//   crack  { x, y, h }            cracked rock wall: only the STRONG one smashes it (question);
//                                 gone for good
//   locked { x, y, h }            needs the key: the carrier answers a question
//   bridge { x0, x1, y }          solid cells that appear when built
//   key    { x, y }               question → the player carries it
//   portal { x, y, pair, active } active portals teleport whoever walks in; an inactive
//                                 portal with `ask` is switched on by a question
//   cage   { x, y }               a box hangs here until a heavy lever releases it
//   exit   { x, y }               x = middle of the 2-wide door; question → open; the room
//                                 is done when both stand in it
// Spawns: spawn.climber / spawn.strong (cell x, feet y). Boxes: boxes [[x, y]].
//
// Role physics (src/physics.js): the climber jumps 3.5 cells high and ~5 far, climbs
// ladders, is 0.9 tall (fits 1-high tunnels); the strong one jumps 1.4 high, ~2.4 far,
// is 1.6 tall, pushes and carries boxes. Standing on the strong one's head is allowed.

export const W = 32;
export const H = 13;

function blank() {
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
  return g;
}

function room(def) {
  const g = blank();
  const fill = (x0, x1, y0, y1, ch = '#') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && x >= 0 && x < W) g[y][x] = ch;
  };
  // shell: floor 3 thick, ceiling, side walls
  fill(0, W - 1, 0, 2); fill(0, W - 1, H - 1, H - 1); fill(0, 0, 0, H - 1); fill(W - 1, W - 1, 0, H - 1);
  def.draw(fill);
  return { ...def, grid: g };
}

export const ROOMS = [
  // ── Room 1: levers and doors ─────────────────────────────────────────────────────────
  // Door A is opened by lever a on a ledge only the climber reaches (ladder). A pit too wide
  // for the strong one: the climber jumps over and answers at the bridge post. The cracked
  // wall only the strong one can smash.
  room({
    id: 'r1', name: 'room.1', goal: 'goal.1', theme: 0,
    spawn: { climber: [2.5, 3], strong: [4.5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 5, 6, 6);                    // ledge (top at y = 7)
      fill(6, 6, 3, 6, 'H');               // ladder up to it
      fill(8, 8, 6, H - 2);                // wall above door A
      fill(15, 18, 0, 2, '.');             // the gap: no bottom (a fall = back to the start)
      fill(25, 25, 6, H - 2);              // wall above the cracked wall
    },
    objects: [
      { id: 'a', type: 'lever', x: 3, y: 7, targets: ['A'] },
      { id: 'A', type: 'door', x: 8, y: 3, h: 3 },
      { id: 'p', type: 'post', x: 20, y: 3, targets: ['b'] },
      { id: 'b', type: 'bridge', x0: 15, x1: 18, y: 2 },
      { id: 'G', type: 'crack', x: 25, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 3 },
    ],
  }),

  // ── Room 2: boxes ────────────────────────────────────────────────────────────────────
  // The key lies on a shelf (ladder: climber). The locked door needs the key. Behind it two
  // steps the strong one can only climb with a box: the crate from the start, then a crate
  // that hangs in a cage until the strong one pulls the heavy lever. On top a portal (the
  // climber switches it on) leads into the closed exit chamber.
  room({
    id: 'r2', name: 'room.2', goal: 'goal.2', theme: 1,
    spawn: { climber: [5.5, 3], strong: [7, 3] },
    boxes: [[9, 3]],
    draw(fill) {
      fill(1, 3, 6, 6);                    // key shelf (top at 7)
      fill(4, 4, 3, 6, 'H');               // ladder
      fill(12, 12, 6, H - 2);              // wall above the locked door
      fill(16, 22, 3, 4);                  // first step (top at 5): 2 high
      fill(23, W - 2, 3, 6);               // upper floor (top at 7): 2 higher
      fill(26, 26, 7, H - 2);              // exit chamber wall
    },
    objects: [
      { id: 'k', type: 'key', x: 2, y: 7 },
      { id: 'L', type: 'locked', x: 12, y: 3, h: 3 },
      { id: 'h', type: 'heavylever', x: 17, y: 5, targets: ['C'] },
      { id: 'C', type: 'cage', x: 20, y: 9 },
      { id: 'O', type: 'portal', x: 24, y: 7, pair: 'o', ask: true },
      { id: 'o', type: 'portal', x: 27.2, y: 7, pair: 'O' },
      { id: 'E', type: 'exit', x: 30, y: 7 },
    ],
  }),

  // ── Room 3: together ─────────────────────────────────────────────────────────────────
  // The switch sits on a ledge too high even for the climber: jump off the strong one's head.
  // The cracked wall only the strong one can smash.
  // The key waits at the end of a low tunnel (climber), the locked door guards the exit.
  room({
    id: 'r3', name: 'room.3', goal: 'goal.3', theme: 2,
    spawn: { climber: [5, 3], strong: [6.5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 3, 6, 6);                    // high ledge (top at 7): only from the strong one's head
      fill(8, 8, 6, H - 2);                // wall above door D
      fill(16, 16, 6, H - 2);              // wall above the cracked wall
      fill(17, 21, 8, 8);                  // tunnel floor (top at 9)
      fill(17, 21, 10, 10);                // tunnel roof: the tunnel is 1 high
      fill(22, 22, 3, 8, 'H');             // ladder up to the tunnel
      fill(24, 24, 6, H - 2);              // wall above the locked door
    },
    objects: [
      { id: 's', type: 'switch', x: 2, y: 7, targets: ['D'] },
      { id: 'D', type: 'door', x: 8, y: 3, h: 3 },
      { id: 'G', type: 'crack', x: 16, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 18, y: 9 },
      { id: 'L', type: 'locked', x: 24, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 28.5, y: 3 },
    ],
  }),
];

/** Debug: the room as text, top row first. */
export function ascii(r) {
  return r.grid.slice().reverse().map((row) => row.join('')).join('\n');
}
