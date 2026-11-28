// Localisation (EN / DE / ES). Every player-facing string of the shell lives here.
//
// Language:  ?lang=de|es|en  (this visit only)
//         →  krabsy_vp_lang  (the switch on the title screen)
//         →  krabsy_lang     (set by the site's wrapper pages)
//         →  browser language → English.
//
// Values are strings or template functions. Static index.html nodes carry data-i18n="key"
// (text) or data-i18n-aria="key" (aria-label) and are filled by applyStatic().
// Verbs and the `go → ___ → gone` notation are never translated, and no string here uses a
// grammar term (site rule).
const OWN_KEY = 'krabsy_vp_lang';
const SITE_KEY = 'krabsy_lang';

const EN = {
  title: 'Verb Platformer',
  tagline: 'Jump on the right word!',
  loading: 'Loading…',
  play: 'Play',
  playContinue: 'Continue',
  playAgain: 'Play again',
  levelN: (n) => `Level ${n}`,
  levels: 'Levels',
  starsTotal: (n, max) => `${n} / ${max} stars`,
  verbs: 'Verbs',
  verbsLevel: (n) => `Verb difficulty ${n} of 3`,
  noTime: 'not played yet',
  bestTime: 'Best time',
  starsOf: (n) => `${n} of 3 stars`,

  'idea.learn-to-play': 'Learn the moves',
  'idea.easy-walk': 'An easy walk',
  'tip.goal': 'Walk onto the word that fills the gap:',
  'tip.jump': 'A gap! Jump over it.',
  'tip.turn': 'The path turns: just walk around the corner.',
  'tip.step': 'A step: a little jump takes you up.',
  'tip.wrong': 'A wrong word falls, and you try again from here. No problem!',
  'tip.flag': 'Well done! Run to the flag.',
  skipBack: 'Pick a word first!',
  'ctrl.move': 'Walk',
  'ctrl.or': 'or',
  'ctrl.look': 'Look around',
  'ctrl.jump': 'Jump',
  'ctrl.swipe': 'Swipe',
  'ctrl.go': 'Start walking!',
  'idea.first-steps': 'The basics',
  'idea.stepping-stones': 'Little jumps, straight ahead',
  'idea.gentle-turns': 'First turns',
  'idea.up-and-down': 'Steps & a ramp',
  'idea.zigzag': 'Turns',
  'idea.climb': 'Height & ramps',
  'idea.ferries': 'Moving platforms',
  'idea.hammer-works': 'Hammers & conveyor belts',
  'idea.finale': 'Everything + a shortcut',

  helpMove: 'run',
  helpJump: 'jump',
  helpLook: 'look around',
  helpPause: 'pause',
  keySpace: 'Space',
  keyMouse: 'Mouse',
  touchStick: 'Stick',
  touchJump: 'Button',
  touchSwipe: 'Swipe',
  helpGoal: 'Land on the word that fills the gap:',

  jump: 'JUMP',
  pause: 'Pause',
  sound: 'Sound on/off (M)',
  gateOf: (n, total) => `Gate ${n} of ${total}`,
  toFlag: 'To the flag!',
  clickToLook: 'Click the game to look around with the mouse',

  pauseTitle: 'Paused',
  resume: 'Resume',
  restart: 'Restart level',
  toLevels: 'Levels',

  hintTitle: 'How to play',
  hintMove: 'Run',
  hintJump: 'Jump',
  hintGoal: 'Land on the right word',
  hintGoalSub: 'Wrong words fall down!',
  hintGo: 'Let’s go!',

  resTitle: 'Level complete!',
  resTime: 'Time',
  resBest: (time) => `Best: ${time}`,
  resNewBest: 'New best time!',
  resFirstTry: 'Right first time',
  resMissed: 'Practise these verbs',
  resPerfect: 'Every word right first time!',
  resStarRule: 'No wrong word = 3 stars',
  resAllDone: 'You finished every level!',
  retry: 'Retry',
  next: 'Next level',

  rotate: 'Turn your phone sideways',

  figureLink: 'Play with your figure\u00a0→',
  figureMine: 'That’s you!',
  heroPick: 'Choose your hero',
  heroMine: 'Your figure',
  'hero.Ranger': 'Ranger',
  figureUrl: '/en/my-figure/',
};

const DE = {
  tagline: 'Spring auf das richtige Wort!',
  loading: 'Lädt …',
  play: 'Spielen',
  playContinue: 'Weiter',
  playAgain: 'Nochmal spielen',
  levels: 'Level',
  starsTotal: (n, max) => `${n} / ${max} Sterne`,
  verbs: 'Verben',
  verbsLevel: (n) => `Schwierigkeit der Verben: ${n} von 3`,
  noTime: 'noch nicht gespielt',
  bestTime: 'Bestzeit',
  starsOf: (n) => `${n} von 3 Sternen`,

  'idea.learn-to-play': 'Die Steuerung lernen',
  'idea.easy-walk': 'Ein leichter Spaziergang',
  'name.learn-to-play': 'So geht’s',
  'name.easy-walk': 'Spaziergang',
  'tip.goal': 'Lauf auf das Wort, das in die Lücke passt:',
  'tip.jump': 'Eine Lücke! Spring hinüber.',
  'tip.turn': 'Der Weg biegt ab: lauf einfach um die Ecke.',
  'tip.step': 'Eine Stufe: ein kleiner Sprung bringt dich hoch.',
  'tip.wrong': 'Ein falsches Wort fällt runter, dann versuchst du es von hier noch einmal. Kein Problem!',
  'tip.flag': 'Super! Lauf zur Flagge.',
  skipBack: 'Erst ein Wort wählen!',
  'ctrl.move': 'Laufen',
  'ctrl.or': 'oder',
  'ctrl.look': 'Umsehen',
  'ctrl.jump': 'Springen',
  'ctrl.swipe': 'Wischen',
  'ctrl.go': 'Lauf los!',
  'idea.first-steps': 'Die Grundlagen',
  'idea.stepping-stones': 'Kleine Sprünge geradeaus',
  'idea.gentle-turns': 'Erste Kurven',
  'idea.up-and-down': 'Stufen & eine Rampe',
  'name.stepping-stones': 'Trittsteine',
  'name.gentle-turns': 'Sanfte Kurven',
  'name.up-and-down': 'Auf und ab',
  'idea.zigzag': 'Kurven',
  'idea.climb': 'Höhe & Rampen',
  'idea.ferries': 'Bewegliche Plattformen',
  'idea.hammer-works': 'Hämmer & Fließbänder',
  'idea.finale': 'Alles zusammen + eine Abkürzung',
  'name.first-steps': 'Erste Schritte',
  'name.zigzag': 'Zickzack',
  'name.climb': 'Der Aufstieg',
  'name.ferries': 'Fähren',
  'name.hammer-works': 'Hammerwerk',
  'name.finale': 'Himmelsfinale',

  helpMove: 'laufen',
  helpJump: 'springen',
  helpLook: 'umsehen',
  helpPause: 'Pause',
  keySpace: 'Leertaste',
  keyMouse: 'Maus',
  touchStick: 'Stick',
  touchJump: 'Knopf',
  touchSwipe: 'Wischen',
  helpGoal: 'Lande auf dem Wort, das in die Lücke passt:',

  jump: 'SPRUNG',
  pause: 'Pause',
  sound: 'Ton an/aus (M)',
  gateOf: (n, total) => `Tor ${n} von ${total}`,
  toFlag: 'Auf zur Flagge!',
  clickToLook: 'Klick ins Spiel, um dich mit der Maus umzusehen',

  pauseTitle: 'Pause',
  resume: 'Weiter',
  restart: 'Level neu starten',
  toLevels: 'Alle Level',

  hintTitle: 'So geht’s',
  hintMove: 'Laufen',
  hintJump: 'Springen',
  hintGoal: 'Lande auf dem richtigen Wort',
  hintGoalSub: 'Falsche Wörter fallen runter!',
  hintGo: 'Los geht’s!',

  resTitle: 'Level geschafft!',
  resTime: 'Zeit',
  resBest: (time) => `Bestzeit: ${time}`,
  resNewBest: 'Neue Bestzeit!',
  resFirstTry: 'Auf Anhieb richtig',
  resMissed: 'Diese Verben noch üben',
  resPerfect: 'Alles auf Anhieb richtig!',
  resStarRule: 'Kein falsches Wort = 3 Sterne',
  resAllDone: 'Du hast alle Level geschafft!',
  retry: 'Nochmal',
  next: 'Nächstes Level',

  rotate: 'Dreh dein Handy quer',

  figureLink: 'Spiel mit deiner Figur\u00a0→',
  figureMine: 'Das bist du!',
  heroPick: 'Wähle deine Spielfigur',
  heroMine: 'Deine Figur',
  'hero.Ranger': 'Waldläufer',
  figureUrl: '/de/meine-figur/',
};

const ES = {
  tagline: '¡Salta sobre la palabra correcta!',
  loading: 'Cargando…',
  play: 'Jugar',
  playContinue: 'Continuar',
  playAgain: 'Jugar otra vez',
  levelN: (n) => `Nivel ${n}`,
  levels: 'Niveles',
  starsTotal: (n, max) => `${n} / ${max} estrellas`,
  verbs: 'Verbos',
  verbsLevel: (n) => `Dificultad de los verbos: ${n} de 3`,
  noTime: 'aún sin jugar',
  bestTime: 'Mejor tiempo',
  starsOf: (n) => `${n} de 3 estrellas`,

  'idea.learn-to-play': 'Aprende los controles',
  'idea.easy-walk': 'Un paseo fácil',
  'name.learn-to-play': 'Cómo se juega',
  'name.easy-walk': 'Paseo por el cielo',
  'tip.goal': 'Camina sobre la palabra que falta:',
  'tip.jump': '¡Un hueco! Salta por encima.',
  'tip.turn': 'El camino gira: camina por la esquina.',
  'tip.step': 'Un escalón: un saltito te sube.',
  'tip.wrong': 'Una palabra incorrecta se cae y lo intentas otra vez desde aquí. ¡No pasa nada!',
  'tip.flag': '¡Muy bien! Corre a la bandera.',
  skipBack: '¡Primero elige una palabra!',
  'ctrl.move': 'Caminar',
  'ctrl.or': 'o',
  'ctrl.look': 'Mirar',
  'ctrl.jump': 'Saltar',
  'ctrl.swipe': 'Desliza',
  'ctrl.go': '¡A caminar!',
  'idea.first-steps': 'Lo básico',
  'idea.stepping-stones': 'Saltitos hacia delante',
  'idea.gentle-turns': 'Primeras curvas',
  'idea.up-and-down': 'Escalones y una rampa',
  'name.stepping-stones': 'Piedras saltarinas',
  'name.gentle-turns': 'Curvas suaves',
  'name.up-and-down': 'Arriba y abajo',
  'idea.zigzag': 'Curvas',
  'idea.climb': 'Altura y rampas',
  'idea.ferries': 'Plataformas móviles',
  'idea.hammer-works': 'Martillos y cintas',
  'idea.finale': 'Todo junto + un atajo',
  'name.first-steps': 'Primeros pasos',
  'name.zigzag': 'Zigzag',
  'name.climb': 'La subida',
  'name.ferries': 'Transbordadores',
  'name.hammer-works': 'Fábrica de martillos',
  'name.finale': 'Final en el cielo',

  helpMove: 'correr',
  helpJump: 'saltar',
  helpLook: 'mirar',
  helpPause: 'pausa',
  keySpace: 'Espacio',
  keyMouse: 'Ratón',
  touchStick: 'Palanca',
  touchJump: 'Botón',
  touchSwipe: 'Deslizar',
  helpGoal: 'Cae sobre la palabra que falta:',

  jump: 'SALTO',
  pause: 'Pausa',
  sound: 'Sonido sí/no (M)',
  gateOf: (n, total) => `Puerta ${n} de ${total}`,
  toFlag: '¡A la bandera!',
  clickToLook: 'Haz clic en el juego para mirar con el ratón',

  pauseTitle: 'Pausa',
  resume: 'Seguir',
  restart: 'Reiniciar nivel',
  toLevels: 'Niveles',

  hintTitle: 'Cómo se juega',
  hintMove: 'Correr',
  hintJump: 'Saltar',
  hintGoal: 'Cae sobre la palabra correcta',
  hintGoalSub: '¡Las palabras incorrectas se caen!',
  hintGo: '¡Vamos!',

  resTitle: '¡Nivel superado!',
  resTime: 'Tiempo',
  resBest: (time) => `Mejor: ${time}`,
  resNewBest: '¡Nuevo récord!',
  resFirstTry: 'A la primera',
  resMissed: 'Practica estos verbos',
  resPerfect: '¡Todo bien a la primera!',
  resStarRule: 'Ninguna palabra incorrecta = 3 estrellas',
  resAllDone: '¡Has superado todos los niveles!',
  retry: 'Reintentar',
  next: 'Siguiente nivel',

  rotate: 'Gira el teléfono',

  figureLink: 'Juega con tu personaje\u00a0→',
  figureMine: '¡Este eres tú!',
  heroPick: 'Elige tu héroe',
  heroMine: 'Tu personaje',
  'hero.Ranger': 'Guardabosques',
  figureUrl: '/es/mi-personaje/',
};

const STRINGS = { en: EN, de: DE, es: ES };
export const LANGS = ['de', 'es', 'en'];

function detect() {
  try {
    const p = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
    if (STRINGS[p]) return p;
    for (const key of [OWN_KEY, SITE_KEY]) {
      const s = (localStorage.getItem(key) || '').toLowerCase();
      if (STRINGS[s]) return s;
    }
  } catch (_) { /* storage blocked */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return STRINGS[nav] ? nav : 'en';
}

let lang = detect();

export function getLang() { return lang; }

// The switch on the title screen: remembered for this game only.
export function setLang(l) {
  if (!STRINGS[l]) return;
  lang = l;
  try { localStorage.setItem(OWN_KEY, l); } catch (_) { /* ignore */ }
  applyStatic();
}

// Topic (?topic=, 2026-11-24): the strings above are written for irregular verbs. Sentence
// topics (Spanish es_ser, prepositions, …; data/questions.js) override the few that say "verbs".
export const TOPIC = (() => {
  try {
    const q = new URLSearchParams(location.search).get('topic');
    if (q && /^[a-z0-9_]{1,40}$/.test(q)) return q;
  } catch (_) { /* no URL */ }
  return 'irregular_verbs';
})();
const SENTENCE_TEXT = {
  en: { verbs: 'Difficulty', verbsLevel: (n) => `Difficulty ${n} of 3`, resMissed: 'Practise these sentences' },
  de: { verbs: 'Schwierigkeit', verbsLevel: (n) => `Schwierigkeit ${n} von 3`, resMissed: 'Diese Sätze noch üben' },
  es: { verbs: 'Dificultad', verbsLevel: (n) => `Dificultad ${n} de 3`, resMissed: 'Practica estas frases' },
};

/* Help-card example per topic, else per taught language (the topic's subject in
   data/topics.json, read through /lib/krabsy-lang.js; no /lib/ when served alone). */
const EXAMPLES = {
  irregular_verbs: { html: 'go → <b>___</b> → gone', blocks: ['goed', 'went', 'wented'] },
  prepositions: { html: 'My birthday is <b>___</b> July.', blocks: ['on', 'in', 'at'] },
  es: { html: 'Yo <b>___</b> Lucas.', blocks: ['es', 'soy', 'estoy'] },
};
const LEARN = await import('/lib/krabsy-lang.js')
  .then((L) => L.topicLearnLang(TOPIC)).catch(() => null);
const EXAMPLE = EXAMPLES[TOPIC] || EXAMPLES[LEARN] || EXAMPLES.irregular_verbs;

/** The small example on the help card and the first-run hint ('<b>' marks the gap). */
export function exampleHtml() { return EXAMPLE.html; }
/** Three example answer blocks for the first-run hint: [wrong, right, wrong]. */
export function exampleBlocks() { return EXAMPLE.blocks.slice(); }

/** Translate a key; template keys take args. Falls back to English, then to `undefined`. */
export function t(key, ...args) {
  const tt = TOPIC !== 'irregular_verbs' ? (SENTENCE_TEXT[lang] || SENTENCE_TEXT.en) : null;
  const v = (tt && tt[key]) ?? STRINGS[lang][key] ?? EN[key];
  return typeof v === 'function' ? v(...args) : v;
}

/** Fill every static data-i18n / data-i18n-aria node. Safe to call again after setLang(). */
export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const v = t(el.dataset.i18nAria);
    if (v != null) el.setAttribute('aria-label', v);
  });
  document.documentElement.lang = lang;
  document.title = t('title');
}
