// First Steps: 3 gates on a straight, level path with the easiest irregular verbs. Used as a
// tutorial — the player learns the answer-bubble mechanic without any moving platforms or turns.
export default {
  id: 1,
  name: 'Level 1',
  topic: 'irregular_verbs',
  difficulty: 1,
  verbs: ['go', 'run', 'eat'],
  repeatsAllowed: 1,
  layout: [
    { type: 'spawn',    position: [0, 2,   0] },
    { type: 'platform', position: [0, 0,   0],  size: 'large'  },   // starter
    { type: 'platform', position: [0, 0,  -5],  size: 'medium' },   // approach 1
    { type: 'gate',     position: [0, 0, -10] },

    { type: 'platform', position: [0, 0, -15],  size: 'medium' },   // checkpoint 1
    { type: 'platform', position: [0, 0, -20],  size: 'medium' },   // approach 2
    { type: 'gate',     position: [0, 0, -25] },

    { type: 'platform', position: [0, 0, -30],  size: 'medium' },   // checkpoint 2
    { type: 'platform', position: [0, 0, -35],  size: 'medium' },   // approach 3
    { type: 'gate',     position: [0, 0, -40] },

    { type: 'platform', position: [0, 0, -45],  size: 'large'  },
    { type: 'flag',     position: [0, 0, -45] },
  ],
};
