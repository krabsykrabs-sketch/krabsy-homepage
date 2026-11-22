// Level and hole data. A hole is a grid of 2×2 tiles, one character per tile:
//   .  nothing (sky)            #  green, flat
//   T  tee (flat green)          H  cup + flag (flat green)
//   ^ > v <  slope, rising towards north / east / south / west (north = up the screen)
//   X  block (a raised tile the ball bounces off)
//   t  tree, r  rock, g  plain grass: decoration tiles outside the course (fenced off)
// `h` (optional) gives each tile's level as a digit (0 = default). One level is 0.5 units
// high; a slope's digit is its LOW end, it rises one level across the tile. Tiles that
// meet at different heights without a slope get a railing on both sides.
// Railings are placed automatically on every course edge that leads nowhere.
//
// gates (from level 2): a row of word gates across the fairway on a tile edge.
//   { row: n, cols: [a, b, c], dir: 'N' }  the edge between row n−1 and row n; one gate per tile
//   { col: n, rows: [a, b, c], dir: 'E' }  the edge between col n−1 and col n
//   dir = the way the ball goes through. The first row asks the 2nd form, a second row on
//   the same hole the 3rd form of the same verb.

export const LEVELS = [
  {
    id: 1, colour: 'green', tiers: [1],
    holes: [
      { // tutorial: one question, one straight putt
        par: 2,
        grid: [
          '.t###.',
          '..#H#.',
          '..###r',
          '..###.',
          '.g###.',
          '..#T#.',
          '..###.',
        ],
      },
      { // around the corner
        par: 3,
        grid: [
          '######.',
          '#####Ht',
          '##g....',
          '##.....',
          '##..r..',
          'T#.....',
          '##.....',
        ],
      },
      { // up the hill, round the block
        par: 3,
        grid: [
          '.#####r',
          '.##H##.',
          't#####.',
          '.##X##.',
          '.^^^^^.',
          '.#####t',
          '.##T##.',
          '.#####.',
        ],
        h: [
          '.11111.',
          '.11111.',
          '.11111.',
          '.11111.',
          '.00000.',
          '.00000.',
          '.00000.',
          '.00000.',
        ],
      },
    ],
  },
  {
    id: 2, colour: 'green', tiers: [1, 2],
    holes: [
      { // one gate row
        par: 3,
        grid: [
          't###.',
          '.#H#.',
          '.###r',
          '.###.',
          '.###.',
          'g###.',
          '.#T#.',
          '.###.',
        ],
        gates: [{ row: 4, cols: [1, 2, 3], dir: 'N' }],
      },
      { // two rows: 2nd form, then 3rd form; a slope between
        par: 4,
        grid: [
          '.###.',
          '.#H#t',
          '.###.',
          '.###.',
          '.^^^.',
          'r###.',
          '.###.',
          '.###g',
          '.#T#.',
        ],
        h: [
          '.111.',
          '.111.',
          '.111.',
          '.111.',
          '.000.',
          '.000.',
          '.000.',
          '.000.',
          '.000.',
        ],
        gates: [{ row: 6, cols: [1, 2, 3], dir: 'N' }, { row: 3, cols: [1, 2, 3], dir: 'N' }],
      },
      { // round the corner through both rows
        par: 4,
        grid: [
          '.......t',
          '########',
          '#######H',
          '########',
          '###..r..',
          '###.....',
          '###g....',
          '#T#.....',
          '###.....',
        ],
        gates: [{ row: 5, cols: [0, 1, 2], dir: 'N' }, { col: 5, rows: [1, 2, 3], dir: 'E' }],
      },
    ],
  },
];
