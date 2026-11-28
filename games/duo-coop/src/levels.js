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
//   button { x, y, targets }      big floor button: only the STRONG one's weight presses it
//                                 (no question: owner 2026-11-27); the climber's does nothing
//   door   { x, y, h }            solid until a target of a lever/switch; no question of its own
//   crack  { x, y, h }            cracked rock wall: only the STRONG one smashes it (question);
//                                 gone for good
//   locked { x, y, h }            opens when its key is collected (no question of its own)
//   bridge { x0, x1, y }          solid cells that appear when built
//   key    { x, y, opens }        question → the key flies to the locked door `opens` and opens it
//   portal { x, y, pair, active } active portals teleport whoever walks in; an inactive
//                                 portal with `ask` is switched on by a question
//   cage   { x, y }               a box hangs here until a button releases it
//   plate  { x, y, targets }      HOLD plate: its targets are on only while weight is on it
//                                 (the strong one or a crate; no question)
//                                 a lever targeting a plate fixes it (stays on for good)
//   toggle { x, y, targets }      question → every target door swaps open/shut (each pull asks)
//   door   …, open: true          starts open (for toggles)
//   trap   { x, y, dir, period, delay } arrow trap in the wall cell (x, y) (keep it solid), firing
//                                 bolts in dir (±1) at y + 0.6; a lever targeting it switches it off
//   lift   { x, w, y0, y1, start } a platform (top at y0 = down, y1 = up; start: 'up'), moved by a liftlever;
//                                 keep its shaft empty
//   liftlever { targets }         question → the lift goes to the other end (each pull asks)
//   exit   { x, y }               x = middle of the 2-wide door; always open, no question
//                                 (owner): the room is done when both stand in it
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
  // Both start at once (owner 2026-11-27, "both players solve at the same time"): the strong
  // one smashes the cracked wall while the climber climbs to lever a on the ledge, which
  // opens door A. A gap too wide for the strong one: the climber jumps over and answers at
  // the bridge post.
  room({
    id: 'r1', name: 'room.1', goal: 'goal.1', theme: 0,
    spawn: { climber: [2.5, 3], strong: [4.5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 5, 6, 6);                    // ledge (top at y = 7)
      fill(6, 6, 3, 6, 'H');               // ladder up to it
      fill(8, 8, 6, H - 2);                // wall above the cracked wall
      fill(12, 12, 6, H - 2);              // wall above door A
      fill(15, 18, 0, 2, '.');             // the gap: no bottom (a fall = back to the start)
    },
    objects: [
      { id: 'G', type: 'crack', x: 8, y: 3, h: 3 },
      { id: 'a', type: 'lever', x: 3, y: 7, targets: ['A'] },
      { id: 'A', type: 'door', x: 12, y: 3, h: 3 },
      { id: 'p', type: 'post', x: 20, y: 3, targets: ['b'] },
      { id: 'b', type: 'bridge', x0: 15, x1: 18, y: 2 },
      { id: 'E', type: 'exit', x: 29.5, y: 3 },
    ],
  }),

  // ── Room 2: boxes ────────────────────────────────────────────────────────────────────
  // The key lies on a shelf (ladder: climber). The locked door needs the key. Behind it two
  // steps the strong one can only climb with a box: the crate from the start, then a crate
  // that hangs in a cage until the strong one presses the big button. On top a portal (the
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
      { id: 'k', type: 'key', x: 2, y: 7, opens: 'L' },
      { id: 'L', type: 'locked', x: 12, y: 3, h: 3 },
      { id: 'h', type: 'button', x: 17, y: 5, targets: ['C'] },
      { id: 'C', type: 'cage', x: 20, y: 9 },
      { id: 'O', type: 'portal', x: 24, y: 7, pair: 'o', ask: true },
      { id: 'o', type: 'portal', x: 27.2, y: 7, pair: 'O' },
      { id: 'E', type: 'exit', x: 30, y: 7 },
    ],
  }),

  // ── Room 3: together ─────────────────────────────────────────────────────────────────
  // The switch sits on a ledge too high even for the climber: jump off the strong one's head.
  // Then at the same time: the strong one smashes the cracked wall while the climber climbs
  // to the key at the end of a low tunnel; the key opens the gate before the exit.
  room({
    id: 'r3', name: 'room.3', goal: 'goal.3', theme: 2,
    spawn: { climber: [5, 3], strong: [6.5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 3, 6, 6);                    // high ledge (top at 7): only from the strong one's head
      fill(8, 8, 6, H - 2);                // wall above door D
      fill(17, 21, 8, 8);                  // tunnel floor (top at 9)
      fill(17, 21, 10, 10);                // tunnel roof: the tunnel is 1 high
      fill(22, 22, 3, 8, 'H');             // ladder up to the tunnel
      fill(23, 23, 6, H - 2);              // wall above the cracked wall
      fill(25, 25, 6, H - 2);              // wall above the locked door
    },
    objects: [
      { id: 's', type: 'switch', x: 2, y: 7, targets: ['D'] },
      { id: 'D', type: 'door', x: 8, y: 3, h: 3 },
      { id: 'G', type: 'crack', x: 23, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 18, y: 9, opens: 'L' },
      { id: 'L', type: 'locked', x: 25, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 28.5, y: 3 },
    ],
  }),
];

// ══ Level 2 (owner 2026-11-27: "create more levels") ════════════════════════════════
// The same pieces, combined: two routes that need each other, a gap with a portal and a
// crate step, a crate that first lifts the strong one (so the climber can jump off the
// head) and then becomes a step.
export const LEVEL2 = [
  // ── 2-1 Upstairs, downstairs ────────────────────────────────────────────────────────
  // Both work at the same time (owner 2026-11-27): the strong one smashes the cracked wall
  // at the start of the corridor while the climber takes the ladder to the upper floor.
  // The switch up there opens the strong one's door further along the corridor, the key
  // flies to the gate before the exit, where both meet.
  room({
    id: 'r4', name: 'room.4', goal: 'goal.4', theme: 2,
    spawn: { climber: [2.5, 3], strong: [4, 3] },
    boxes: [],
    draw(fill) {
      fill(7, 20, 6, 6);                   // upper floor (top 7), the corridor runs below it
      fill(6, 6, 3, 6, 'H');               // ladder up
      fill(26, 26, 6, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'G', type: 'crack', x: 9, y: 3, h: 3 },
      { id: 's', type: 'switch', x: 17, y: 7, targets: ['D'] },
      { id: 'D', type: 'door', x: 15, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 19, y: 7, opens: 'L' },
      { id: 'L', type: 'locked', x: 26, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 3 },
    ],
  }),

  // ── 2-2 Across the gap ──────────────────────────────────────────────────────────────
  // Only the climber can jump the gap; the portal it switches on brings the strong one
  // over. The strong one pushes the crate to the step and presses the big button (door);
  // from the step the climber jumps up to the shelf with the key.
  room({
    id: 'r5', name: 'room.5', goal: 'goal.5', theme: 0,
    spawn: { climber: [3, 3], strong: [4.5, 3] },
    boxes: [[18, 3]],
    draw(fill) {
      fill(10, 12, 0, 2, '.');             // the gap (no bottom)
      fill(21, W - 2, 3, 4);               // step (top 5)
      fill(22, 23, 7, 7);                  // key shelf (top 8), only from the step
      fill(26, 26, 8, H - 2);              // wall above the door
      fill(28, 28, 8, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'o', type: 'portal', x: 6, y: 3, pair: 'O' },
      { id: 'O', type: 'portal', x: 15, y: 3, pair: 'o', ask: true },
      { id: 'h', type: 'button', x: 24, y: 5, targets: ['D'] },
      { id: 'D', type: 'door', x: 26, y: 5, h: 3 },
      { id: 'k', type: 'key', x: 22, y: 8, opens: 'L' },
      { id: 'L', type: 'locked', x: 28, y: 5, h: 3 },
      { id: 'E', type: 'exit', x: 30, y: 5 },
    ],
  }),

  // ── 2-3 Stack it up ─────────────────────────────────────────────────────────────────
  // At the same time: the strong one smashes the cracked wall into the crate hall while the
  // climber climbs to the switch, which opens the door on the platform. The key lies on a
  // shelf too high for anyone alone: the strong one stands on the crate, the climber jumps
  // off the strong one's head. Then the crate becomes the strong one's step to the platform.
  room({
    id: 'r6', name: 'room.6', goal: 'goal.6', theme: 1,
    spawn: { climber: [5.3, 3], strong: [6.3, 3] },
    boxes: [[9, 3]],
    draw(fill) {
      fill(1, 3, 6, 6);                    // ledge with the switch (top 7)
      fill(4, 4, 3, 6, 'H');               // ladder up to it
      fill(7, 7, 6, H - 2);                // wall above the cracked wall
      fill(11, 13, 7, 7);                  // high key shelf (top 8)
      fill(20, W - 2, 3, 4);               // platform (top 5)
      fill(24, 24, 8, H - 2);              // wall above the door
      fill(27, 27, 8, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'G', type: 'crack', x: 7, y: 3, h: 3 },
      { id: 's', type: 'switch', x: 2, y: 7, targets: ['D'] },
      { id: 'k', type: 'key', x: 12, y: 8, opens: 'L' },
      { id: 'D', type: 'door', x: 24, y: 5, h: 3 },
      { id: 'L', type: 'locked', x: 27, y: 5, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 5 },
    ],
  }),
];

// ══ Level 3 (owner 2026-11-27): the lift, and both players busy at the same time ════
export const LEVEL3 = [
  // ── 3-1 Going up ───────────────────────────────────────────────────────────────────
  // At the same time: the strong one smashes the cracked wall to the lift while the climber
  // climbs to the ledge and takes the key. Then the climber pulls the lift lever up top and
  // the lift brings the strong one up, who presses the big button for the door.
  room({
    id: 'r7', name: 'room.7', goal: 'goal.7', theme: 0,
    spawn: { climber: [2, 3], strong: [3.5, 3] },
    boxes: [],
    draw(fill) {
      fill(5, 5, 3, 8, 'H');               // ladder up to the ledge
      fill(6, 9, 8, 8);                    // ledge (top 9) with the key
      fill(10, 11, 2, 2, '.');             // pocket for the lift (its top is flush with the floor)
      fill(12, W - 2, 3, 8);               // the upper floor (top 9)
    },
    objects: [
      { id: 'G', type: 'crack', x: 8, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 7, y: 9, opens: 'L' },
      { id: 'Y', type: 'lift', x: 10, w: 2, y0: 3, y1: 9 },
      { id: 'l', type: 'liftlever', x: 13, y: 9, targets: ['Y'] },
      { id: 'h', type: 'button', x: 18, y: 9, targets: ['D'] },
      { id: 'D', type: 'door', x: 24, y: 9, h: 3 },
      { id: 'L', type: 'locked', x: 27, y: 9, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 9 },
    ],
  }),

  // ── 3-2 Bridge and portal ──────────────────────────────────────────────────────────────
  // At the same time: the strong one smashes the cracked wall while the climber climbs to
  // the portal on the ledge and switches it on. Across the gap (too wide for anyone) the
  // climber builds the bridge; the strong one comes over and presses the big button.
  room({
    id: 'r8', name: 'room.8', goal: 'goal.8', theme: 1,
    spawn: { climber: [5.3, 3], strong: [6.6, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 3, 6, 6);                    // ledge with the portal (top 7)
      fill(4, 4, 3, 6, 'H');               // ladder up to it
      fill(8, 8, 6, H - 2);                // wall above the cracked wall
      fill(11, 16, 0, 2, '.');             // the gap: 6 wide, no bottom
      fill(26, 26, 6, H - 2);              // wall above the door
    },
    objects: [
      { id: 'o', type: 'portal', x: 2, y: 7, pair: 'O', ask: true },
      { id: 'G', type: 'crack', x: 8, y: 3, h: 3 },
      { id: 'b', type: 'bridge', x0: 11, x1: 16, y: 2 },
      { id: 'p', type: 'post', x: 18, y: 3, targets: ['b'] },
      { id: 'O', type: 'portal', x: 21, y: 3, pair: 'o' },
      { id: 'h', type: 'button', x: 23, y: 3, targets: ['D'] },
      { id: 'D', type: 'door', x: 26, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 3 },
    ],
  }),

  // ── 3-3 All together ───────────────────────────────────────────────────────────────────
  // The lift lever stands beside the lift: the climber can pull it riding along. Up top at
  // the same time: the strong one smashes the cracked wall while the climber takes the
  // ladder to the switch (it opens the door). The key lies in a slot too high to jump to:
  // the climber jumps off the strong one's head.
  room({
    id: 'r9', name: 'room.9', goal: 'goal.9', theme: 2,
    spawn: { climber: [2.5, 3], strong: [4, 3] },
    boxes: [],
    draw(fill) {
      fill(8, 9, 2, 2, '.');               // pocket for the lift
      fill(10, W - 2, 3, 5);               // upper floor (top 6)
      fill(13, 13, 6, 9, 'H');             // ladder to the switch ledge
      fill(11, 12, 9, 9);                  // switch ledge (top 10)
      fill(16, 16, 9, H - 2);              // wall above the cracked wall
      fill(19, 21, 9, 9);                  // key shelf (top 10): from the strong one's head
      fill(24, 24, 9, H - 2);              // wall above the door
      fill(27, 27, 9, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'l', type: 'liftlever', x: 7, y: 3, targets: ['Y'] },
      { id: 'Y', type: 'lift', x: 8, w: 2, y0: 3, y1: 6 },
      { id: 's', type: 'switch', x: 11, y: 10, targets: ['D'] },
      { id: 'G', type: 'crack', x: 16, y: 6, h: 3 },
      { id: 'k', type: 'key', x: 20, y: 10, opens: 'L' },
      { id: 'D', type: 'door', x: 24, y: 6, h: 3 },
      { id: 'L', type: 'locked', x: 27, y: 6, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 6 },
    ],
  }),
];

// ══ Level 4 "Think first" (owner 2026-11-28: real puzzles; idea and rough layout by a
// Fable design agent, built and tuned to our jump heights here). Two small rule variants:
// the hold plate (works only while weight is on it: the strong one or a crate) and the
// toggle lever (swaps two doors, every pull asks).
export const LEVEL4 = [
  // ── 4-1 The stand-in ─────────────────────────────────────────────────────────────────
  // The bridge is there only while the plate is held down. The strong one can hold it, but
  // then never crosses, and the climber needs the strong one's head on the far side. Aha:
  // something else has to stand there: the crate behind the cracked wall. (The crate sits
  // to the right of the wall, so it is pushed towards the plate, never into a corner:
  // crates can't be pulled; pushed against the step it stops on the plate.)
  room({
    id: 'r10', name: 'room.10', goal: 'goal.10', theme: 0,
    spawn: { climber: [2, 3], strong: [3.5, 3] },
    boxes: [[7, 3]],                       // behind the cracked wall, on the way to the plate
    draw(fill) {
      fill(12, W - 2, 3, 3);               // a 1-high step right after the plate: the crate stops ON the plate
      fill(13, 15, 0, 3, '.');             // the gap (no bottom), 3 wide: too far for the strong one
      fill(16, 17, 7, 7);                  // key ledge (top 8) …
      fill(18, 18, 4, 7, 'H');             // … and its ladder
      fill(25, 26, 7, 7);                  // lever shelf (top 8): 6 cells from the ladder, only from the head
      fill(27, 27, 7, H - 2);              // wall above the locked gate
      fill(28, 28, 7, H - 2);              // wall above the door
    },
    objects: [
      { id: 'W', type: 'crack', x: 5, y: 3, h: 2 },
      { id: 'P', type: 'plate', x: 11, y: 3, targets: ['b'] },
      { id: 'b', type: 'bridge', x0: 13, x1: 15, y: 3 },
      { id: 'k', type: 'key', x: 16, y: 8, opens: 'G' },
      { id: 'l', type: 'lever', x: 25, y: 8, targets: ['D'] },
      { id: 'G', type: 'locked', x: 27, y: 4, h: 3 },
      { id: 'D', type: 'door', x: 28, y: 4, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 4 },
    ],
  }),

  // ── 4-2 Either / or ──────────────────────────────────────────────────────────────────
  // One lever, two doors: door a (corridor below) is shut, door b (gallery above) is open;
  // every pull swaps them. Aha: "Don't pull yet, I have to get through first!" Up in the
  // gallery the climber drops the caged crate through the hole; it becomes the strong
  // one's step onto the plateau, where the key waits on a shelf only the head reaches.
  room({
    id: 'r11', name: 'room.11', goal: 'goal.11', theme: 1,
    spawn: { climber: [2, 3], strong: [3.5, 3] },
    boxes: [],
    draw(fill) {
      fill(6, 6, 3, 7, 'H');               // ladder up to the gallery
      fill(7, 16, 7, 7);                   // gallery floor (top 8) …
      fill(18, 19, 7, 7);                  // … with a hole at x 17 (the cage plugs it)
      fill(23, W - 2, 3, 4);               // plateau (top 5)
      fill(26, 27, 8, 8);                  // key shelf (top 9): 6 cells from the gallery end
      fill(28, 28, 8, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'T', type: 'toggle', x: 9, y: 3, targets: ['a', 'b'] },
      { id: 'a', type: 'door', x: 12, y: 3, h: 4 },
      { id: 'b', type: 'door', x: 12, y: 8, h: 4, open: true },
      { id: 'R', type: 'lever', x: 15, y: 8, targets: ['C'] },
      { id: 'C', type: 'cage', x: 17, y: 7 },
      { id: 'k', type: 'key', x: 26, y: 9, opens: 'G' },
      { id: 'G', type: 'locked', x: 28, y: 5, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 5 },
    ],
  }),

  // ── 4-3 Who calls the lift? ────────────────────────────────────────────────────────────
  // The only lift lever stands on top of a high block on the left; there is none below.
  // Too high even from the strong one's head: crate, strong one, climber. And the raised
  // lift is also the climber's stepping stone from the block to the plateau. Plan ahead:
  // the key (it opens the gate up top) lies in a low tunnel down below.
  room({
    id: 'r12', name: 'room.12', goal: 'goal.12', theme: 2,
    spawn: { climber: [21.5, 3], strong: [22.6, 3] },  // right of the wall: the crate goes left
    boxes: [[17, 3]],
    draw(fill) {
      fill(1, 7, 3, 8);                    // the high block (top 9): the lift lever stands on it
      fill(9, 11, 2, 2, '.');              // pocket for the lift (1 cell from the block: an easy hop up
                                           // there under the low ceiling; 4 cells to the plateau without it)
      fill(12, W - 2, 8, 8);               // plateau up top (top 9), a hall below it
      fill(24, W - 2, 4, 4);               // low roof: a 1-high tunnel to the key
    },
    objects: [
      { id: 'T', type: 'liftlever', x: 3, y: 9, targets: ['Y'] },
      { id: 'Y', type: 'lift', x: 9, w: 3, y0: 3, y1: 9 },
      { id: 'W', type: 'crack', x: 19, y: 3, h: 2 },
      { id: 'k', type: 'key', x: 29, y: 3, opens: 'G' },
      { id: 'G', type: 'locked', x: 27, y: 9, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 9 },
    ],
  }),
];

// ══ Level 5 (owner 2026-11-28): hold-and-act and a crate carried a long way ══════════
export const LEVEL5 = [
  // ── 5-1 Hold the bridge ──────────────────────────────────────────────────────────────
  // At the same time: the strong one smashes the wall to the plate, the climber climbs to
  // the key. Then: the bridge stands only while the strong one stands on the plate, and
  // the gap is too wide for anyone. In that time the climber crosses and pulls the lever
  // that fixes the bridge; now the strong one can follow.
  room({
    id: 'r13', name: 'room.13', goal: 'goal.13', theme: 1,
    spawn: { climber: [2, 3], strong: [3.5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 3, 6, 6);                    // key ledge (top 7) …
      fill(4, 4, 3, 6, 'H');               // … and its ladder (left of the wall)
      fill(13, 18, 0, 2, '.');             // the gap: 6 wide, nobody jumps it
      fill(26, 26, 6, H - 2);              // wall above the locked gate
    },
    objects: [
      { id: 'W', type: 'crack', x: 6, y: 3, h: 2 },
      { id: 'k', type: 'key', x: 2, y: 7, opens: 'G' },
      { id: 'P', type: 'plate', x: 10, y: 3, targets: ['b'] },
      { id: 'b', type: 'bridge', x0: 13, x1: 18, y: 2 },
      { id: 'l', type: 'lever', x: 21, y: 3, targets: ['P'] },
      { id: 'G', type: 'locked', x: 26, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 3 },
    ],
  }),

  // ── 5-2 Crate on the lift ─────────────────────────────────────────────────────────────
  // At the same time: the strong one smashes the wall and pushes the crate onto the lift,
  // the climber climbs and crosses the shaft to the lift lever. The lift brings the strong
  // one and the crate up; the crate goes a long way along the upper floor to the step
  // before the exit. The climber jumps up the step and opens the exit door.
  room({
    id: 'r14', name: 'room.14', goal: 'goal.14', theme: 0,
    spawn: { climber: [2, 3], strong: [3.5, 3] },
    boxes: [[7, 3]],
    draw(fill) {
      fill(9, 9, 3, 6, 'H');               // ladder to a small landing …
      fill(10, 11, 6, 6);                  // … (top 7) beside the lift shaft
      fill(12, 14, 2, 2, '.');             // pocket for the lift
      fill(15, W - 2, 3, 6);               // the upper floor (top 7); its face stops the crate on the lift
      fill(25, W - 2, 7, 8);               // step before the exit (top 9): 2 high, needs the crate
    },
    objects: [
      { id: 'W', type: 'crack', x: 5, y: 3, h: 2 },
      { id: 'Y', type: 'lift', x: 12, w: 3, y0: 3, y1: 7 },
      { id: 'T', type: 'liftlever', x: 16, y: 7, targets: ['Y'] },
      { id: 's', type: 'switch', x: 26, y: 9, targets: ['D'] },
      { id: 'D', type: 'door', x: 28, y: 9, h: 3 },
      { id: 'E', type: 'exit', x: 29.5, y: 9 },
    ],
  }),

  // ── 5-3 Relay ─────────────────────────────────────────────────────────────────────────
  // Taking turns. The strong one holds plate A (far left), which keeps the door on the
  // upper floor open; the climber goes through and sends the lift down, with a crate on it.
  // The crate lands right of the strong one, who pushes it onto plate B (it stops against
  // the step): now plate B keeps the door open. The strong one rides the lift, and the
  // climber calls it up again. (The crate always moves right, never into a corner.)
  room({
    id: 'r15', name: 'room.15', goal: 'goal.15', theme: 2,
    spawn: { climber: [28.3, 3], strong: [29.5, 3] },
    boxes: [[6, 9]],                       // on the lift, which starts up
    draw(fill) {
      fill(5, 7, 2, 2, '.');               // pocket for the lift
      fill(8, 25, 8, 8);                   // upper floor (top 9) over the hall …
      fill(27, W - 2, 8, 8);               // … with a hole for the ladder
      fill(26, 26, 3, 8, 'H');             // ladder up
      fill(17, 17, 3, 3);                  // a 1-high step right after plate B
    },
    objects: [
      { id: 'W', type: 'crack', x: 20, y: 3, h: 2 },
      { id: 'A', type: 'plate', x: 2, y: 3, targets: ['D'] },
      { id: 'B', type: 'plate', x: 16, y: 3, targets: ['D'] },
      { id: 'D', type: 'door', x: 14, y: 9, h: 3 },
      { id: 'T', type: 'liftlever', x: 10, y: 9, targets: ['Y'] },
      { id: 'Y', type: 'lift', x: 5, w: 3, y0: 3, y1: 9, start: 'up' },
      { id: 'E', type: 'exit', x: 29.5, y: 9 },
    ],
  }),
];

// ══ Level 6 (owner 2026-11-28): the shield bearer and arrow traps ═══════════════════
// Roles: climber + shield bearer (holds ▼ to raise the shield; bolts from the front bounce
// off; the partner walks in its cover). A hit only knocks you back.
export const LEVEL6 = [
  // ── 6-1 Behind the shield ─────────────────────────────────────────────────────────────
  // At the same time: the shield bearer pulls the switch (door), the climber climbs to the
  // key (gate). Then the trap at the end fires down the corridor: the shield goes first,
  // the climber walks behind it and switches the trap off from there.
  room({
    id: 'r16', name: 'room.16', goal: 'goal.16', theme: 0,
    spawn: { climber: [2, 3], shield: [5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 3, 6, 6);                    // key ledge (top 7) …
      fill(4, 4, 3, 6, 'H');               // … and its ladder
      fill(9, 9, 6, H - 2);                // wall above the door
      fill(13, 13, 6, H - 2);              // wall above the gate
      fill(30, 30, 3, 3);                  // the trap block
    },
    objects: [
      { id: 's', type: 'switch', x: 7, y: 3, targets: ['D'] },
      { id: 'D', type: 'door', x: 9, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 2, y: 7, opens: 'G' },
      { id: 'G', type: 'locked', x: 13, y: 3, h: 3 },
      { id: 'l', type: 'lever', x: 24, y: 3, targets: ['X'] },
      { id: 'X', type: 'trap', x: 30, y: 3, dir: -1, period: 1.1 },
      { id: 'E', type: 'exit', x: 28, y: 3 },
    ],
  }),

  // ── 6-2 On my head ────────────────────────────────────────────────────────────────────
  // The trap fires from behind (left), from the start. The shield faces back while both
  // move on; the climber stays in front. The key lies on a ledge only reachable from the
  // shield bearer's head (and the head is above the bolts).
  room({
    id: 'r17', name: 'room.17', goal: 'goal.17', theme: 1,
    spawn: { climber: [7, 3], shield: [5, 3] },
    boxes: [],
    draw(fill) {
      fill(1, 1, 3, 3);                    // the trap block
      fill(11, 11, 6, H - 2);              // wall above the door
      fill(15, 16, 6, 6);                  // key ledge (top 7): only from the shield bearer's head
      fill(24, 24, 6, H - 2);              // wall above the gate
    },
    objects: [
      { id: 'X', type: 'trap', x: 1, y: 3, dir: 1, period: 1.2, delay: 3 },
      { id: 's', type: 'switch', x: 9, y: 3, targets: ['D'] },
      { id: 'D', type: 'door', x: 11, y: 3, h: 3 },
      { id: 'k', type: 'key', x: 15, y: 7, opens: 'G' },
      { id: 'l', type: 'lever', x: 21, y: 3, targets: ['X'] },
      { id: 'G', type: 'locked', x: 24, y: 3, h: 3 },
      { id: 'E', type: 'exit', x: 28.5, y: 3 },
    ],
  }),

  // ── 6-3 Bridge under fire ─────────────────────────────────────────────────────────────
  // The shield bearer opens the door; now bolts fly. Shield up at the gap: the climber,
  // behind it, builds the bridge; both cross in cover; the climber switches the trap off.
  room({
    id: 'r18', name: 'room.18', goal: 'goal.18', theme: 2,
    spawn: { climber: [2, 3], shield: [3.5, 3] },
    boxes: [],
    draw(fill) {
      fill(9, 9, 6, H - 2);                // wall above the door
      fill(14, 17, 0, 2, '.');             // the gap (no bottom), 4 wide: too far for the shield bearer
      fill(30, 30, 3, 3);                  // the trap block
    },
    objects: [
      { id: 's', type: 'switch', x: 6, y: 3, targets: ['D'] },
      { id: 'D', type: 'door', x: 9, y: 3, h: 3 },
      { id: 'p', type: 'post', x: 12, y: 3, targets: ['b'] },
      { id: 'b', type: 'bridge', x0: 14, x1: 17, y: 2 },
      { id: 'l', type: 'lever', x: 24, y: 3, targets: ['X'] },
      { id: 'X', type: 'trap', x: 30, y: 3, dir: -1, period: 1.1 },
      { id: 'E', type: 'exit', x: 28, y: 3 },
    ],
  }),
];

/** Levels: each a list of rooms, played in order. */
export const LEVELS = [
  { id: 'l1', rooms: ROOMS },
  { id: 'l2', rooms: LEVEL2 },
  { id: 'l3', rooms: LEVEL3 },
  { id: 'l4', rooms: LEVEL4 },
  { id: 'l5', rooms: LEVEL5 },
  { id: 'l6', rooms: LEVEL6, roles: ['climber', 'shield'] },
];

/** Debug: the room as text, top row first. */
export function ascii(r) {
  return r.grid.slice().reverse().map((row) => row.join('')).join('\n');
}
