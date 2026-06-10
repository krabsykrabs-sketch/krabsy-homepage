// Tricky Path: 5 gates with the trickiest irregular verbs, a winding non-linear path with
// three 90° turns, and both kinds of moving platform.
//
// All gates are approached from the +Z side (so the 3 answer lanes spread along X as usual).
// Between gates the path doglegs east, then back west, then east again — the player turns the
// camera at each junction.
//
// Sections:
//   1. straight south to gate 1 (`write`)
//   2. turn east → south, over a Y-bobber → gate 2 (`take`)
//   3. turn west → south to gate 3 (`give`)
//   4. straight south with a Z-axis ferry → gate 4 (`come`)
//   5. turn east → gate 5 (`think`)

export default {
  id: 3,
  name: 'Level 3',
  topic: 'irregular_verbs',
  difficulty: 3,
  verbs: ['write', 'take', 'give', 'come', 'think'],
  repeatsAllowed: 1,
  layout: [
    { type: 'spawn',    position: [0, 2,    0] },
    { type: 'platform', position: [0, 0,    0],  size: 'large'  },
    { type: 'platform', position: [0, 0,   -5],  size: 'medium' },
    { type: 'gate',     position: [0, 0,  -10] },                    // gate 1 — `write`

    // --- Turn east, then south, with a Y-bobber on the way ---
    { type: 'platform', position: [0,  0, -15],  size: 'medium' },   // checkpoint 1
    { type: 'platform', position: [0,  0, -20],  size: 'medium' },   // junction (turn east)
    { type: 'platform', position: [5,  0, -20],  size: 'medium' },
    { type: 'platform', position: [10, 0, -20],  size: 'medium' },   // east end (turn south)
    { type: 'platform', position: [10, 0, -25],  size: 'medium' },
    { type: 'moving',   position: [10, 0, -30],  size: 'medium', axis: 'y', amplitude: 0.5, period: 2.5, phase: 0 },
    { type: 'platform', position: [10, 0, -35],  size: 'medium' },   // approach 2
    { type: 'gate',     position: [10, 0, -40] },                    // gate 2 — `take`

    // --- Turn west, then south ---
    { type: 'platform', position: [10, 0, -45],  size: 'medium' },   // checkpoint 2
    { type: 'platform', position: [10, 0, -50],  size: 'medium' },   // junction (turn west)
    { type: 'platform', position: [ 5, 0, -50],  size: 'medium' },
    { type: 'platform', position: [ 0, 0, -50],  size: 'medium' },   // west end (turn south)
    { type: 'platform', position: [ 0, 0, -55],  size: 'medium' },
    { type: 'platform', position: [ 0, 0, -60],  size: 'medium' },   // approach 3
    { type: 'gate',     position: [ 0, 0, -65] },                    // gate 3 — `give`

    // --- Straight south through a Z-axis ferry ---
    { type: 'platform', position: [0, 0,  -70],  size: 'medium' },   // checkpoint 3
    { type: 'platform', position: [0, 0,  -75],  size: 'medium' },   // ferry source
    // Fixed-collider ferry (steering works on it), so back to a fun pace — period 9 s → peak ~3.5 m/s.
    { type: 'moving',   position: [0, 0,  -84],  size: 'medium', axis: 'z', amplitude: 5, period: 9.0, phase: 0 },
    { type: 'platform', position: [0, 0,  -94],  size: 'medium' },   // ferry landing
    { type: 'platform', position: [0, 0,  -99],  size: 'medium' },   // approach 4
    { type: 'gate',     position: [0, 0, -104] },                    // gate 4 — `come`

    // --- Turn east again to the final gate ---
    { type: 'platform', position: [ 0, 0, -109],  size: 'medium' },  // checkpoint 4
    { type: 'platform', position: [ 0, 0, -114],  size: 'medium' },  // junction (turn east)
    { type: 'platform', position: [ 5, 0, -114],  size: 'medium' },
    { type: 'platform', position: [10, 0, -114],  size: 'medium' },  // approach 5
    { type: 'gate',     position: [10, 0, -119] },                   // gate 5 — `think`

    { type: 'platform', position: [10, 0, -124], size: 'large'  },
    { type: 'flag',     position: [10, 0, -124] },
  ],
};
