// Fake data for the tutor v2 prototype. Everything lives in memory; a reload resets it.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const TUTOR = { name: 'Nora', tz: 'America/Montevideo' };
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEK_START = 23;          // Monday 23 Nov 2026
export const TODAY_IDX = 2;            // Wednesday 25 Nov
export const NOW_MIN = 14 * 60 + 35;   // 14:35, the "now" of the prototype
export const dateOf = d => `${WEEK_START + d} Nov`;
export const LEVELS = ['Pre-A1', 'A1', 'A2', 'B1'];

export const TOPICS = {
  animals:   { label: 'Animals',     es: 'Los animales',  level: 'A1', emoji: ['🐄', '🐔', '🐷', '🦆', '🐴', '🐑', '🐶'], tint: 'sage' },
  family:    { label: 'Family',      es: 'La familia',    level: 'A1', emoji: ['👵', '👧', '👶', '👨‍👩‍👧', '👴'], tint: 'coral' },
  feelings:  { label: 'Feelings',    es: '¿Cómo estás?',  level: 'A1', emoji: ['😊', '😴', '😢', '😠', '😮'], tint: 'lav' },
  ser:       { label: 'ser',         es: 'Yo soy Lía.',   level: 'A1', emoji: ['🦜', '🌈', '🎨', '🌍'], tint: 'amber' },
  estar:     { label: 'estar',       es: 'Estoy en casa.', level: 'A1', emoji: ['🐈', '📦', '🧦', '🏠'], tint: 'teal' },
  tener:     { label: 'tener',       es: 'Tengo un perro.', level: 'A1', emoji: ['🎂', '🐶', '👾', '🎒'], tint: 'coral' },
  food:      { label: 'Food',        es: 'La comida',     level: 'A2', emoji: ['🍎', '🧀', '🍞', '🧺', '🍌'], tint: 'amber' },
  ser_estar: { label: 'ser o estar', es: 'Es alto. Está cansado.', level: 'A2', emoji: ['🦎', '☀️', '🕵️', '🌧️'], tint: 'lav' },
};
export const TOPIC_IDS = Object.keys(TOPICS);

export const KINDS = {
  worksheet: { label: 'Worksheet',      plural: 'Worksheets',        icon: '▤' },
  book:      { label: 'Book',           plural: 'Books',             icon: '📖' },
  pictures:  { label: 'Picture set',    plural: 'Picture sets',      icon: '🖼' },
  template:  { label: 'Lesson template', plural: 'Lesson templates', icon: '☰' },
  practice:  { label: 'Practice homework', plural: 'Practice homework', icon: '↻' },
  game:      { label: 'Game',           plural: 'Games',             icon: '▶' },
};

/* ── Vocabulary ─────────────────────────────────────────────────────────── */
const V = (id, art, es, en, pic, set) => ({ id, art, es, full: `${art} ${es}`, en, pic, set });
export const VOCAB = [
  V('vaca', 'la', 'vaca', 'the cow', '🐄', 'animals'), V('caballo', 'el', 'caballo', 'the horse', '🐴', 'animals'),
  V('cerdo', 'el', 'cerdo', 'the pig', '🐷', 'animals'), V('gallina', 'la', 'gallina', 'the hen', '🐔', 'animals'),
  V('pato', 'el', 'pato', 'the duck', '🦆', 'animals'), V('oveja', 'la', 'oveja', 'the sheep', '🐑', 'animals'),
  V('perro', 'el', 'perro', 'the dog', '🐶', 'animals'), V('gato', 'el', 'gato', 'the cat', '🐱', 'animals'),
  V('conejo', 'el', 'conejo', 'the rabbit', '🐰', 'animals'), V('pollito', 'el', 'pollito', 'the chick', '🐥', 'animals'),
  V('cabra', 'la', 'cabra', 'the goat', '🐐', 'animals'), V('raton', 'el', 'ratón', 'the mouse', '🐭', 'animals'),
  V('contento', '', 'contento', 'happy', '😊', 'feelings'), V('triste', '', 'triste', 'sad', '😢', 'feelings'),
  V('cansado', '', 'cansado', 'tired', '😴', 'feelings'), V('enojado', '', 'enojado', 'angry', '😠', 'feelings'),
  V('asustado', '', 'asustado', 'scared', '😨', 'feelings'), V('sorprendido', '', 'sorprendido', 'surprised', '😮', 'feelings'),
  V('enfermo', '', 'enfermo', 'ill', '🤒', 'feelings'), V('tranquilo', '', 'tranquilo', 'calm', '😌', 'feelings'),
  V('nervioso', '', 'nervioso', 'nervous', '😬', 'feelings'), V('aburrido', '', 'aburrido', 'bored', '🥱', 'feelings'),
  V('manzana', 'la', 'manzana', 'the apple', '🍎', 'food'), V('pan', 'el', 'pan', 'the bread', '🍞', 'food'),
  V('queso', 'el', 'queso', 'the cheese', '🧀', 'food'), V('leche', 'la', 'leche', 'the milk', '🥛', 'food'),
  V('huevo', 'el', 'huevo', 'the egg', '🥚', 'food'), V('banana', 'la', 'banana', 'the banana', '🍌', 'food'),
  V('agua', 'el', 'agua', 'the water', '💧', 'food'), V('torta', 'la', 'torta', 'the cake', '🍰', 'food'),
  V('naranja', 'la', 'naranja', 'the orange', '🍊', 'food'), V('tomate', 'el', 'tomate', 'the tomato', '🍅', 'food'),
].map(v => ({ ...v, full: v.art ? `${v.art} ${v.es}` : v.es }));
export const word = id => VOCAB.find(v => v.id === id);
export const SETS = {
  animals:  { label: 'Animals',  es: 'Los animales', tint: 'sage' },
  feelings: { label: 'Feelings', es: '¿Cómo estás?', tint: 'lav' },
  food:     { label: 'Food',     es: 'La comida',    tint: 'amber' },
};

/* ── Demo activities (the one playable worksheet) ───────────────────────── */
export const GAP_POOL = [
  { s: 'La vaca ___ grande.', a: 'es', hint: 'The cow is big.', teach: 'es: what something is like.' },
  { s: 'El cerdo ___ en el barro.', a: 'está', hint: 'The pig is in the mud.', teach: 'está: where something is right now.' },
  { s: 'La gallina ___ tres pollitos.', a: 'tiene', hint: 'The hen has three chicks.', teach: 'tiene: she has.' },
  { s: 'Yo ___ un perro.', a: 'tengo', hint: 'I have a dog.', teach: 'tengo: I have.' },
  { s: 'Los patos ___ en el agua.', a: 'están', hint: 'The ducks are in the water.', teach: 'están: where they are right now.' },
  { s: 'El caballo ___ rápido.', a: 'es', hint: 'The horse is fast.', teach: 'es: what something is like.' },
  { s: 'Hoy la oveja ___ cansada.', a: 'está', hint: 'Today the sheep is tired.', teach: 'está: how someone feels today.' },
  { s: 'Los pollitos ___ pequeños.', a: 'son', hint: 'The chicks are small.', teach: 'son: what they are like.' },
  { s: 'El gato ___ en la casa.', a: 'está', hint: 'The cat is in the house.', teach: 'está: where something is right now.' },
  { s: 'Mi abuela ___ dos caballos.', a: 'tiene', hint: 'My grandmother has two horses.', teach: 'tiene: she has.' },
];
export function farmSteps() {
  return [
    { type: 'text', title: 'Lucas visits the farm', body: 'Lucas is at his grandmother’s farm today. Come along and meet the animals!', pic: '🚜' },
    { type: 'cards', title: 'Meet the animals', words: ['vaca', 'caballo', 'cerdo', 'gallina', 'pato', 'oveja'] },
    { type: 'tap', title: 'Tap the picture', words: ['vaca', 'gallina', 'cerdo', 'pato', 'caballo'] },
    { type: 'match', title: 'Match the pairs', words: ['oveja', 'pato', 'caballo', 'cerdo', 'gallina'] },
    { type: 'sort', title: 'Sort into baskets',
      baskets: [{ id: 'two', label: 'Tiene 2 patas', sub: 'two legs', pic: '🧺' }, { id: 'four', label: 'Tiene 4 patas', sub: 'four legs', pic: '🧺' }],
      cards: [{ w: 'gallina', b: 'two' }, { w: 'vaca', b: 'four' }, { w: 'pato', b: 'two' }, { w: 'caballo', b: 'four' }, { w: 'pollito', b: 'two' }, { w: 'oveja', b: 'four' }],
      hint: 'Count the legs.' },
    { type: 'gap', title: 'Drag the word into the gap', items: GAP_POOL.slice(0, 5).map(x => ({ ...x })), extra: ['son'] },
  ];
}
export const cardsOnly = () => [{ type: 'cards', title: 'Meet the animals', words: ['vaca', 'caballo', 'cerdo', 'gallina', 'pato', 'oveja', 'perro', 'gato'] }];

/* ── The book: La granja ────────────────────────────────────────────────── */
// Text markup: {shown|card word|meaning|picture|vocab id (optional)}
export const BOOK = {
  id: 'm_book_granja', title: 'La granja', author: 'A Krabsy storybook', level: 'A1',
  pages: [
    { scene: 'farm', cast: [['🏡', 62, 30, 5.2], ['👧', 26, 62, 4], ['👵', 44, 60, 4], ['🌻', 80, 70, 2.4], ['🌻', 88, 74, 2]],
      es: 'Hola, soy Lía. Hoy estoy en la {granja|la granja|the farm|🏡} de mi {abuela|la abuela|the grandmother|👵}.',
      en: 'Hello, I am Lía. Today I am at my grandmother’s farm.' },
    { scene: 'field', cast: [['🐄', 58, 54, 6.5], ['👧', 22, 64, 3.6], ['🌼', 80, 80, 1.8], ['🌼', 40, 84, 1.6]],
      es: 'En la granja hay una {vaca|la vaca|the cow|🐄|vaca}. La vaca es {grande|grande|big|🐘}.',
      en: 'On the farm there is a cow. The cow is big.' },
    { scene: 'field', cast: [['🐴', 60, 52, 6], ['👧', 24, 66, 3.6], ['💨', 82, 50, 2.4]],
      es: 'Aquí está el {caballo|el caballo|the horse|🐴|caballo}. El caballo es {rápido|rápido|fast|💨}.',
      en: 'Here is the horse. The horse is fast.' },
    { scene: 'mud', cast: [['🐷', 54, 62, 5.6], ['💦', 72, 48, 2], ['👧', 20, 60, 3.6]],
      es: 'El {cerdo|el cerdo|the pig|🐷|cerdo} está en el {barro|el barro|the mud|🟤}. ¡Está muy {contento|contento|happy|😊|contento}!',
      en: 'The pig is in the mud. He is very happy!' },
    { check: true },
    { scene: 'barn', cast: [['🐔', 40, 58, 5], ['🐥', 62, 72, 2.4], ['🐥', 72, 68, 2.2], ['🐥', 82, 74, 2.4]],
      es: 'La {gallina|la gallina|the hen|🐔|gallina} tiene tres {pollitos|el pollito|the chick|🐥|pollito}. Los pollitos son {pequeños|pequeño|small|🤏}.',
      en: 'The hen has three chicks. The chicks are small.' },
    { scene: 'pond', cast: [['🦆', 40, 62, 4.4], ['🦆', 66, 70, 3.4], ['🌿', 14, 74, 2.6], ['🌿', 90, 60, 2.4]],
      es: 'Los {patos|el pato|the duck|🦆|pato} están en el {agua|el agua|the water|💧|agua}. El pato dice: ¡cuac!',
      en: 'The ducks are in the water. The duck says: quack!' },
    { scene: 'field', cast: [['🐑', 56, 56, 6], ['☁️', 30, 20, 3], ['👧', 22, 66, 3.6]],
      es: 'La {oveja|la oveja|the sheep|🐑|oveja} tiene mucha {lana|la lana|the wool|🧶}. La lana es blanca.',
      en: 'The sheep has a lot of wool. The wool is white.' },
    { scene: 'evening', cast: [['🐶', 52, 64, 5], ['👧', 28, 62, 4], ['🏡', 78, 34, 4], ['⭐', 18, 16, 1.6], ['⭐', 46, 10, 1.3]],
      es: 'Yo tengo un {amigo|el amigo|the friend|🤝} nuevo: el {perro|el perro|the dog|🐶|perro} Tito. ¡Adiós, granja!',
      en: 'I have a new friend: Tito the dog. Goodbye, farm!' },
    { end: true },
  ],
  check: { q: '¿Quién es grande?', en: 'Who is big?', options: ['vaca', 'pollito', 'gato'], answer: 'vaca', teach: 'La vaca es grande.' },
  endChecks: [
    { q: '¿Quién está en el barro?', options: ['pato', 'cerdo', 'oveja'], answer: 'cerdo', teach: 'El cerdo está en el barro.' },
    { q: '¿Quién tiene tres pollitos?', options: ['gallina', 'caballo', 'perro'], answer: 'gallina', teach: 'La gallina tiene tres pollitos.' },
    { q: '¿Quién dice «cuac»?', options: ['vaca', 'oveja', 'pato'], answer: 'pato', teach: 'El pato dice: ¡cuac!' },
  ],
  words: ['vaca', 'caballo', 'cerdo', 'gallina', 'pollito', 'pato', 'oveja', 'perro'],
};

/* ── Students ───────────────────────────────────────────────────────────── */
const AV = ['#f2937e', '#babfd8', '#cdd9b4', '#f4c95d', '#8fd3c4', '#e7a8c9', '#a9c7ee'];
const GOALS = ['Talk to grandma in Spanish', 'Trip to Uruguay in March', 'School Spanish, year 5', 'Speak with cousins in Madrid',
  'Just for fun', 'DELE A2 exam in May', 'Family moves to Montevideo', 'Read a first book alone'];
// name, age, level, groups, slot [day, time], homework [done, total, dueOffset] | 'done' | null, lastActive days (null = never), stars, extra
const ROWS = [
  ['Lucas', 8, 'A1', ['Siblings Carter'], [2, '15:00'], 'done', 1, 3.1, { goal: 'Talk to grandma in Spanish' }],
  ['Emma', 10, 'A2', ['Siblings Carter'], [2, '16:00'], [12, 40, -3], 3, 2.4, {}],
  ['Mateo', 7, 'A1', ['Tuesday'], [1, '16:00'], [0, 20, 2], 12, 1.8, {}],
  ['Ana', 12, 'A2', ['Exam'], [3, '17:00'], [30, 40, 1], 0, 3.0, { drop: ['ser_estar', 3, 2] }],
  ['Finn', 9, 'A1', ['Siblings Novak'], [2, '17:30'], [18, 20, 0], 1, 2.9, {}],
  ['Ruby', 6, 'Pre-A1', ['Siblings Novak'], [2, '17:30'], [8, 10, 0], 1, 1.6, {}],
  ['Tom', 41, 'A2', [], [2, '19:00'], [22, 40, 2], 2, 2.7, { goal: 'Trip to Uruguay in March' }],
  ['Olivia', 11, 'A2', [], [0, '15:00'], 'done', 2, 3.4, {}],
  ['Noah', 8, 'A1', [], [0, '16:00'], [5, 20, 3], 2, 2.2, { noNote: true }],
  ['Mia', 7, 'Pre-A1', [], [0, '17:00'], null, 4, 1.4, {}],
  ['Leo', 13, 'B1', ['Exam'], [1, '15:00'], 'done', 0, 3.8, {}],
  ['Zoe', 9, 'A1', ['Tuesday'], [1, '17:00'], [14, 20, 1], 1, 2.6, {}],
  ['Ethan', 10, 'A1', [], [3, '15:00'], [9, 30, 1], 5, 2.1, {}],
  ['Ava', 8, 'A1', [], [3, '16:00'], 'done', 1, 3.2, {}],
  ['Isla', 6, 'Pre-A1', [], [4, '15:00'], null, null, 0, { linkIssued: '21 Nov' }],
  ['Oscar', 12, 'A2', [], [4, '16:00'], [36, 40, 2], 0, 3.3, {}],
  ['Lily', 9, 'A1', [], [4, '17:00'], [10, 20, 2], 3, 2.5, {}],
  ['Theo', 14, 'B1', ['Exam'], [5, '10:00'], [20, 40, 3], 2, 3.6, {}],
  ['Sophie', 10, 'A2', [], [5, '11:00'], 'done', 1, 3.1, {}],
  ['Ben', 7, 'A1', ['Summer camp'], [0, '18:00'], [4, 10, 4], 6, 1.9, {}],
  ['Chloe', 11, 'A2', ['Summer camp'], [1, '18:00'], [16, 30, -1], 4, 2.8, {}],
  ['Sam', 9, 'A1', [], [3, '18:00'], [14, 20, 1], 0, 2.0, { low: [6, 14] }],
  ['Hannah', 15, 'B1', ['Exam'], [4, '18:00'], [28, 40, 2], 1, 3.9, {}],
  ['Eli', 8, 'A1', [], [5, '12:00'], null, 2, 2.3, {}],
  ['Maya', 10, 'A2', [], null, [0, 30, 5], 15, 2.6, {}],
  ['Sarah', 34, 'A1', [], [1, '19:30'], [12, 20, 2], 1, 2.2, { goal: 'Family moves to Montevideo' }],
  ['David', 52, 'B1', [], [3, '19:30'], 'done', 3, 3.7, { goal: 'Speak with cousins in Madrid' }],
  ['Priya', 29, 'A2', [], [0, '19:30'], [25, 40, 1], 0, 3.0, { goal: 'DELE A2 exam in May' }],
  ['Jack', 11, 'A1', [], null, null, 48, 2.4, { archived: true, archivedNote: 'Paused since October' }],
  ['Greta', 9, 'A1', [], null, null, 30, 2.0, { archived: true, archivedNote: 'Back in January' }],
];
const HW_TITLES = ['estar · 40 questions', 'Lucas visits the farm', 'ser o estar · 40 questions', 'Animals · word practice', 'The picnic basket', 'tener · 30 questions', 'How is Lía today?'];

function buildStudents() {
  return ROWS.map((r, i) => {
    const [name, age, level, groups, slot, hw, lastActive, stars, x] = r;
    const R = rng(100 + i * 7);
    const lvIdx = LEVELS.indexOf(level);
    const topicStars = {};
    TOPIC_IDS.forEach(t => {
      const hard = LEVELS.indexOf(TOPICS[t].level) > lvIdx ? 1.6 : 0;
      topicStars[t] = lastActive === null ? 0 : Math.max(0, Math.min(5, Math.round(stars + (R() * 2.2 - 1.1) - hard)));
    });
    if (x.drop) topicStars[x.drop[0]] = x.drop[2];
    if (name === 'Lucas') Object.assign(topicStars, { animals: 4, ser: 3, estar: 2, tener: 3, family: 4, feelings: 2, food: 1, ser_estar: 0 });
    const hwObj = hw === 'done' ? { title: HW_TITLES[i % HW_TITLES.length], done: 40, total: 40, due: -1, status: 'done', score: 70 + Math.round(R() * 25) }
      : hw ? { title: HW_TITLES[i % HW_TITLES.length], done: hw[0], total: hw[1], due: hw[2], status: hw[2] < 0 ? 'late' : 'open', score: x.low ? Math.round(x.low[0] / x.low[1] * 100) : 60 + Math.round(R() * 35) }
      : null;
    return {
      id: i + 1, name, age, adult: age >= 18, level, groups: groups.slice(), slot,
      goal: x.goal || GOALS[Math.floor(R() * GOALS.length)], color: AV[i % AV.length],
      hw: hwObj, lastActive, stars, trend: [stars - 0.5 + R() * 0.4, stars - 0.3 + R() * 0.4, stars].map(v => Math.max(0.3, v)),
      topicStars, drop: x.drop || null, noNote: !!x.noNote, low: x.low || null, linkIssued: x.linkIssued || null,
      archived: !!x.archived, archivedNote: x.archivedNote || '', consent: age < 18 ? i % 5 !== 2 : true,
      notes: name === 'Lucas' ? [
        { date: '18 Nov', text: 'Loves animals, switch to farm words when he gets tired. Mixes up es / está when talking about feelings.' },
        { date: '11 Nov', text: 'Grandma (Montevideo) calls on Sundays. He wants to tell her about his dog.' },
      ] : [{ date: '16 Nov', text: 'Good energy. Keep lessons playful, short explanations.' }],
      trips: name === 'Lucas' ? [['está', 'es', 7], ['tiene', 'tengo', 5], ['la oveja', 'la vaca', 4], ['cansado', 'contento', 3], ['están', 'son', 3]]
        : [['está', 'es', 2 + Math.floor(R() * 5)], ['soy', 'estoy', 1 + Math.floor(R() * 4)], ['tengo', 'tiene', 1 + Math.floor(R() * 3)]],
      activity: Array.from({ length: 28 }, (_, d) => (lastActive === null || 27 - d < lastActive) ? 0 : (R() < 0.45 ? 0 : Math.ceil(R() * 30))),
      dismissed: false,
    };
  });
}

/* ── Materials ──────────────────────────────────────────────────────────── */
// kind, topic, level, title, minutes, size label, extra
const MAT = [
  ['worksheet', 'animals', 'A1', 'Lucas visits the farm', 10, '5 activities', { id: 'm_ws_farm', fav: true, blurb: 'Meet six farm animals, then tap, match, sort and fill the gaps.' }],
  ['worksheet', 'animals', 'A1', 'Who lives in the pond?', 8, '4 activities'], ['worksheet', 'animals', 'A1', 'Big animals, small animals', 9, '4 activities'],
  ['worksheet', 'animals', 'Pre-A1', 'Pets at home', 8, '3 activities'],
  ['worksheet', 'feelings', 'A1', 'How is Lía today?', 9, '4 activities', { fav: true }], ['worksheet', 'feelings', 'A1', 'Happy, tired, hungry', 8, '4 activities'],
  ['worksheet', 'feelings', 'A2', 'The grumpy Monday', 11, '5 activities'],
  ['worksheet', 'food', 'A1', 'The picnic basket', 10, '5 activities'], ['worksheet', 'food', 'A2', 'What is in the fridge?', 9, '4 activities'],
  ['worksheet', 'food', 'A2', 'At the market', 12, '5 activities'],
  ['worksheet', 'family', 'A1', 'This is my family', 9, '4 activities'], ['worksheet', 'family', 'A1', 'Grandma’s photo album', 10, '5 activities'],
  ['worksheet', 'family', 'A2', 'Who is who?', 11, '4 activities'],
  ['worksheet', 'ser', 'A1', 'I am Lucas, you are …', 8, '4 activities'], ['worksheet', 'ser', 'A1', 'The colourful parrot', 9, '4 activities'],
  ['worksheet', 'ser', 'A2', 'Where are you from?', 10, '5 activities'],
  ['worksheet', 'estar', 'A1', 'Where is the cat?', 8, '4 activities', { fav: true }], ['worksheet', 'estar', 'A1', 'Hoy estoy …', 9, '4 activities'],
  ['worksheet', 'estar', 'A2', 'The lost sock', 10, '5 activities'],
  ['worksheet', 'ser_estar', 'A2', 'The moody chameleon', 12, '5 activities'], ['worksheet', 'ser_estar', 'A2', 'Lía is tall, Lía is tired', 10, '4 activities'],
  ['worksheet', 'ser_estar', 'A2', 'Detective: ¿es o está?', 11, '5 activities'], ['worksheet', 'ser_estar', 'B1', 'Sunny day, rainy day', 12, '5 activities'],
  ['worksheet', 'tener', 'A1', 'I have a dog', 8, '4 activities'], ['worksheet', 'tener', 'A1', 'How old are you?', 8, '3 activities'],
  ['worksheet', 'tener', 'A1', 'The monster has three eyes', 10, '5 activities'], ['worksheet', 'tener', 'A2', 'Tengo hambre', 9, '4 activities'],
  ['book', 'animals', 'A1', 'La granja', 6, '8 pages', { id: 'm_book_granja', fav: true, blurb: 'Lía visits her grandmother’s farm and meets eight animals.' }],
  ['book', 'feelings', 'A1', '¿Cómo estás?', 6, '8 pages'], ['book', 'food', 'A1', 'El picnic', 7, '10 pages'],
  ['book', 'family', 'A1', 'Mi familia', 7, '10 pages'], ['book', 'tener', 'A1', 'El monstruo tiene tres ojos', 6, '8 pages'],
  ['book', 'estar', 'A1', '¿Dónde está Tito?', 6, '8 pages'], ['book', 'ser_estar', 'A2', 'Un día con Lía', 9, '12 pages'],
  ['pictures', 'animals', 'A1', 'Animals', 0, '32 words', { id: 'm_pic_animals' }], ['pictures', 'animals', 'Pre-A1', 'Farm animals', 0, '12 words'],
  ['pictures', 'animals', 'Pre-A1', 'Pets', 0, '10 words'], ['pictures', 'feelings', 'A1', 'Feelings', 0, '16 words'],
  ['pictures', 'food', 'A1', 'Food', 0, '24 words'], ['pictures', 'family', 'A1', 'Family', 0, '14 words'],
  ['template', 'animals', 'Pre-A1', 'First lesson: hello and animals', 30, '5 steps'], ['template', 'animals', 'A1', 'Farm day', 50, '7 steps', { id: 'm_tpl_farm' }],
  ['template', 'feelings', 'A1', 'Feelings check-in', 50, '6 steps'], ['template', 'ser_estar', 'A2', 'Ser o estar: first contact', 50, '7 steps'],
  ['template', 'tener', 'A1', 'Tener: age and pets', 50, '6 steps'], ['template', 'food', 'A1', 'Picnic lesson', 50, '7 steps'],
  ['template', 'family', 'A1', 'Family tree lesson', 50, '6 steps'], ['template', 'ser', 'A1', 'Review and play', 30, '4 steps'],
  ['practice', 'ser', 'A1', 'ser · 40 questions', 10, '40 questions'], ['practice', 'estar', 'A1', 'estar · 40 questions', 10, '40 questions'],
  ['practice', 'ser_estar', 'A2', 'ser o estar · 40 questions', 12, '40 questions'], ['practice', 'tener', 'A1', 'tener · 30 questions', 8, '30 questions'],
  ['practice', 'animals', 'A1', 'Animals · word practice', 6, '20 words'], ['practice', 'feelings', 'A1', 'Feelings · word practice', 6, '20 words'],
  ['practice', 'food', 'A1', 'Food · word practice', 6, '20 words'], ['practice', 'family', 'A1', 'Family · word practice', 6, '20 words'],
  ['game', 'estar', 'A1', 'Egg Island · estar', 12, 'Game'], ['game', 'ser', 'A1', 'Sprint · ser', 5, 'Drill'],
  ['game', 'tener', 'A1', 'Verb Kitchen · tener', 12, 'Game'], ['game', 'ser_estar', 'A2', 'Fill the Gap · ser o estar', 6, 'Drill'],
  // Mine
  ['worksheet', 'estar', 'A1', 'Lucas: está or es (tricky words)', 7, '3 activities', { mine: true, from: 'weak words' }],
  ['worksheet', 'animals', 'A1', 'Emma’s farm quiz', 8, '4 activities', { mine: true, from: 'Lucas visits the farm' }],
  ['worksheet', 'animals', 'Pre-A1', 'Carter siblings: pets together', 8, '3 activities', { mine: true }],
  ['worksheet', 'feelings', 'A1', 'Feelings with faces (my version)', 9, '4 activities', { mine: true, from: 'How is Lía today?' }],
  ['worksheet', 'family', 'A1', 'My family in Montevideo', 9, '4 activities', { mine: true }],
  ['worksheet', 'tener', 'A1', 'Birthday party: ¿cuántos años tienes?', 8, '4 activities', { mine: true }],
  ['worksheet', 'food', 'A1', 'Summer camp: snack time', 7, '3 activities', { mine: true }],
  ['worksheet', 'ser_estar', 'A2', 'Exam group: es / está mixed', 12, '5 activities', { mine: true }],
  ['worksheet', 'ser', 'A1', 'Colours of my room', 8, '3 activities', { mine: true, draft: true }],
  ['worksheet', 'estar', 'A2', 'Where is everybody? (holiday)', 9, '4 activities', { mine: true, draft: true }],
  ['worksheet', 'tener', 'A2', 'Tom: travel phrases with tener', 10, '4 activities', { mine: true }],
  ['worksheet', 'food', 'A2', 'Adults: ordering at a café', 10, '4 activities', { mine: true }],
  ['book', 'animals', 'Pre-A1', 'La granja (short, 5 pages)', 4, '5 pages', { mine: true, from: 'La granja' }],
  ['book', 'feelings', 'A1', '¿Cómo estás? (without the last pages)', 5, '6 pages', { mine: true, from: '¿Cómo estás?' }],
  ['template', 'animals', 'A1', 'My first lesson with a new child', 30, '5 steps', { mine: true }],
  ['template', 'ser_estar', 'A2', 'Tuesday group plan', 50, '6 steps', { mine: true }],
  ['template', 'feelings', 'A1', 'Sibling lesson (two levels)', 50, '7 steps', { mine: true }],
  ['template', 'tener', 'A1', 'Exam warm-up week', 50, '5 steps', { mine: true, draft: true }],
  ['practice', 'estar', 'A1', 'estar · only feelings · 20', 6, '20 questions', { mine: true }],
  ['practice', 'ser_estar', 'A2', 'Ana: ser o estar repair', 8, '24 questions', { mine: true, from: 'weak words' }],
];
function buildMaterials() {
  const R = rng(77);
  return MAT.map((m, i) => {
    const [kind, topic, level, title, mins, size, x = {}] = m;
    return { id: x.id || `m_${i}`, kind, topic, level, title, mins, size, owner: x.mine ? 'mine' : 'krabsy', draft: !!x.draft, from: x.from || '',
      fav: !!x.fav, used: x.draft ? 0 : Math.floor(R() * (x.mine ? 6 : 12)), blurb: x.blurb || '',
      updated: `${3 + Math.floor(R() * 20)} Nov` };
  });
}

/* ── Lessons ────────────────────────────────────────────────────────────── */
export const STEP_KINDS = {
  warmup: ['Warm-up', '☀️'], homework: ['Homework check', '📋'], explain: ['Explain', '💬'], material: ['Worksheet', '▤'], book: ['Book', '📖'],
  game: ['Game', '▶'], talk: ['Talk', '🗣'], review: ['Review', '↻'], sethw: ['Set homework', '🏠'], break: ['Break', '☕'],
};
export const lucasPlan = () => [
  { kind: 'warmup', mins: 5, title: 'Picture cards: animals', detail: 'Say each animal together', ref: 'm_pic_animals' },
  { kind: 'homework', mins: 5, title: 'estar · 40 questions', detail: 'Done · 31 of 40 right at first try' },
  { kind: 'explain', mins: 8, title: 'es or está?', detail: 'My note: “La vaca es grande. La vaca está en el campo.” Use the farm pictures.' },
  { kind: 'material', mins: 10, title: 'Lucas visits the farm', detail: 'Worksheet · 5 activities', ref: 'm_ws_farm' },
  { kind: 'book', mins: 8, title: 'La granja', detail: 'Book · 8 pages · he turns the pages', ref: 'm_book_granja' },
  { kind: 'game', mins: 10, title: 'Egg Island · estar', detail: 'Game · level 1' },
  { kind: 'sethw', mins: 2, title: 'Animals · word practice', detail: 'Due Friday' },
];
function buildLessons(students) {
  const out = []; const seen = new Set(); let id = 1; const R = rng(5);
  students.forEach(s => {
    if (!s.slot || s.archived) return;
    const key = s.slot.join('@') + (s.groups.find(g => g.startsWith('Siblings')) || s.id);
    if (seen.has(key)) { out.find(l => l.key === key).studentIds.push(s.id); return; }
    seen.add(key);
    const [day, time] = s.slot; const past = day < TODAY_IDX;
    let status = past ? 'done' : ['ready', 'draft', 'none'][Math.floor(R() * 3)];
    let plan = status === 'ready' ? lucasPlan().slice(0, 5) : status === 'draft' ? lucasPlan().slice(0, 3) : [];
    if (past) plan = lucasPlan().slice(0, 6);
    let note = past ? 'Good lesson. Remembered most animal words; está still needs a reminder. Next: feelings with estar.' : '';
    if (s.noNote) note = '';
    if (s.name === 'Lucas') { status = 'ready'; plan = lucasPlan(); }
    if (s.name === 'Emma') { status = 'none'; plan = []; }
    if (s.name === 'Finn') { status = 'draft'; plan = lucasPlan().slice(0, 3); }
    if (s.name === 'Tom') { status = 'ready'; plan = lucasPlan().slice(1, 5); }
    out.push({ id: id++, key, studentIds: [s.id], day, time, mins: s.adult ? 60 : (s.level === 'Pre-A1' ? 30 : 50), status, plan, note,
      goal: s.name === 'Lucas' ? 'es or está with farm animals' : status === 'none' ? '' : 'Review and one new thing', weekly: true });
  });
  return out.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

/* ── State ──────────────────────────────────────────────────────────────── */
const students = buildStudents();
const materials = buildMaterials();
const lessons = buildLessons(students);
const sid = n => students.find(s => s.name === n).id;
const assignments = [];
const assign = (mid, names, due, status = 'open', score = null) => names.forEach(n => assignments.push({ materialId: mid, studentId: sid(n), due, status, score }));
assign('m_ws_farm', ['Lucas', 'Emma', 'Finn', 'Zoe', 'Noah'], 'Fri 27 Nov');
assign('m_book_granja', ['Lucas', 'Ruby', 'Mia', 'Ava'], 'Mon 30 Nov');
assign('m_book_granja', ['Olivia'], 'Fri 20 Nov', 'done', 90);
assign('m_pic_animals', ['Lucas', 'Ruby', 'Isla', 'Mia', 'Ben'], '');
assign('m_4', ['Emma', 'Ana', 'Sam'], 'Thu 26 Nov');
assign('m_16', ['Lucas', 'Ethan'], 'Sun 22 Nov', 'done', 82);
assign('m_49', ['Lucas'], 'Tue 24 Nov', 'done', 78);
assign('m_49', ['Emma'], 'Sun 22 Nov', 'late', null);
assign('m_19', ['Ana', 'Oscar', 'Chloe'], 'Sat 28 Nov');
assign('m_50', ['Ana', 'Theo', 'Hannah', 'Leo'], 'Fri 27 Nov');
assign('m_7', ['Tom', 'Priya'], 'Mon 30 Nov');
assign('m_23', ['Sarah', 'Lily', 'Eli'], 'Sat 28 Nov');

export const state = {
  students, materials, lessons, assignments,
  groups: ['Siblings Carter', 'Siblings Novak', 'Tuesday', 'Exam', 'Summer camp'],
  // word album of the demo student (Lucas): none | seen | sticker | gold
  album: { vaca: 'gold', caballo: 'sticker', cerdo: 'sticker', gallina: 'seen', pato: 'sticker', oveja: 'seen', perro: 'gold', gato: 'sticker', conejo: 'sticker',
    contento: 'sticker', triste: 'sticker', cansado: 'seen', enojado: 'seen' },
  bookDone: false, wsDone: false, stars: 14,
  live: null,           // { lessonId, startedAt, step, stars, gifts }
  recent: [
    { who: 'Lucas', text: 'finished the book “La granja”', score: '3 of 3 checks', when: 'yesterday 18:10' },
    { who: 'Ana', text: 'reached ★★★★ in ser', score: '', when: 'yesterday 17:42' },
    { who: 'Oscar', text: 'did 36 of 40 in “ser o estar”', score: '86 % right', when: 'today 08:15' },
    { who: 'Sam', text: 'worked on “Animals · word practice”', score: '6 of 14 right', when: 'today 07:50' },
    { who: 'Priya', text: 'finished “The picnic basket”', score: '9 of 10 right', when: 'Mon 21:30' },
  ],
};
export const student = id => state.students.find(s => s.id === +id);
export const material = id => state.materials.find(m => m.id === id);
export const lesson = id => state.lessons.find(l => l.id === +id);
export const lessonStudents = l => l.studentIds.map(student);
export const lessonNames = l => lessonStudents(l).map(s => s.name).join(' & ');
export const nextLesson = s => state.lessons.filter(l => l.studentIds.includes(s.id) && (l.day > TODAY_IDX || (l.day === TODAY_IDX && l.status !== 'done')))[0] || null;
export const lessonWhen = l => !l ? '—' : l.day === TODAY_IDX ? `Today ${l.time}` : l.day === TODAY_IDX + 1 ? `Tomorrow ${l.time}` : `${DAYS[l.day]} ${l.time}`;
export const activeLabel = d => d === null ? 'never' : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
export const dueLabel = d => d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : d > 1 ? `due in ${d} days` : d === -1 ? '1 day late' : `${-d} days late`;

// One reason and one action per student (plan §3.2).
export function attention(s) {
  if (s.archived || s.dismissed) return null;
  if (s.hw && s.hw.status === 'late') return { icon: '!', tone: 'bad', reason: `homework ${-s.hw.due} day${s.hw.due < -1 ? 's' : ''} late`, action: 'Send a reminder', tab: 'materials' };
  if (s.lastActive === null) return { icon: '🔗', tone: 'warn', reason: `link never opened (issued ${s.linkIssued})`, action: 'Open link card', tab: 'family' };
  if (s.lastActive >= 10) return { icon: '!', tone: 'bad', reason: `no practice for ${s.lastActive} days`, action: 'Give easy homework', tab: 'materials' };
  if (s.drop) return { icon: '↓', tone: 'warn', reason: `${TOPICS[s.drop[0]].label} dropped ★${s.drop[1]} → ★${s.drop[2]}`, action: 'See progress', tab: 'progress' };
  if (s.low) return { icon: '½', tone: 'warn', reason: `${s.low[0]} of ${s.low[1]} right on current homework`, action: 'See what went wrong', tab: 'materials' };
  if (s.noNote) return { icon: '✎', tone: 'info', reason: 'Monday’s lesson has no note', action: 'Write note', tab: 'lessons' };
  return null;
}
