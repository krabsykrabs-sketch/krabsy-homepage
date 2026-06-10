// Tidal Run: rhythmically varied straight-line level introducing moving platforms. Distances
// between gates are intentionally uneven, and three sections use moving platforms:
//
//   • after gate 1: a Y-axis "bobber" pair half a period out of phase
//   • before gate 3: a Z-axis sliding ferry across a 20 m void; the player times both jumps
//     (~6 m double-jumps each way) and rides the ferry while it carries them across
//   • before gate 5: a single Y-axis bobber for visual interest before the final stretch
//
// Gate-to-gate distances (m): 10 (spawn→g1), 30 (g1→g2), 40 (g2→g3), 15 (g3→g4), 35 (g4→g5).

export default {
  id: 2,
  name: 'Level 2',
  topic: 'irregular_verbs',
  difficulty: 2,
  verbs: ['see', 'sing', 'drive', 'break', 'know'],
  repeatsAllowed: 1,
  layout: [
    { type: 'spawn',    position: [0, 2,    0] },
    { type: 'platform', position: [0, 0,    0],  size: 'large'  },   // starter
    { type: 'platform', position: [0, 0,   -5],  size: 'medium' },   // approach 1
    { type: 'gate',     position: [0, 0,  -10] },                    // gate 1 — short opener

    { type: 'platform', position: [0, 0,  -15],  size: 'medium' },   // checkpoint 1

    // Bobber pair — half-period out of phase, so when one's up the other's down.
    { type: 'moving',   position: [0, 0,  -20],  size: 'medium', axis: 'y', amplitude: 0.55, period: 2.0, phase: 0   },
    { type: 'moving',   position: [0, 0,  -25],  size: 'medium', axis: 'y', amplitude: 0.55, period: 2.0, phase: 1.0 },
    { type: 'platform', position: [0, 0,  -30],  size: 'medium' },
    { type: 'platform', position: [0, 0,  -35],  size: 'medium' },   // approach 2
    { type: 'gate',     position: [0, 0,  -40] },                    // gate 2 — 30 m

    { type: 'platform', position: [0, 0,  -45],  size: 'medium' },   // checkpoint 2
    { type: 'platform', position: [0, 0,  -50],  size: 'medium' },   // source for ferry

    // Sliding ferry: 20 m void with one platform sliding Z between -64 and -56 (mean -60, ampl 4).
    // Source-to-nearest = 6 m, farthest-to-dest = 6 m. Now that the platform is a fixed collider
    // (steering works on it) it can move at a fun pace again — period 8 s → peak ~3.1 m/s.
    { type: 'moving',   position: [0, 0,  -60],  size: 'medium', axis: 'z', amplitude: 4, period: 8.0, phase: 0 },
    { type: 'platform', position: [0, 0,  -70],  size: 'medium' },   // landing
    { type: 'platform', position: [0, 0,  -75],  size: 'medium' },   // approach 3
    { type: 'gate',     position: [0, 0,  -80] },                    // gate 3 — 40 m

    { type: 'platform', position: [0, 0,  -85],  size: 'medium' },   // checkpoint 3
    { type: 'platform', position: [0, 0,  -90],  size: 'medium' },   // approach 4
    { type: 'gate',     position: [0, 0,  -95] },                    // gate 4 — 15 m (short)

    { type: 'platform', position: [0, 0, -100],  size: 'medium' },   // checkpoint 4
    { type: 'platform', position: [0, 0, -106],  size: 'medium' },
    { type: 'moving',   position: [0, 0, -112],  size: 'medium', axis: 'y', amplitude: 0.75, period: 2.4, phase: 0 },
    { type: 'platform', position: [0, 0, -118],  size: 'medium' },
    { type: 'platform', position: [0, 0, -124],  size: 'medium' },   // approach 5
    { type: 'gate',     position: [0, 0, -130] },                    // gate 5 — 35 m

    { type: 'platform', position: [0, 0, -136],  size: 'large'  },
    { type: 'flag',     position: [0, 0, -136] },
  ],
};
