// Interface texts (EN / DE / ES). The interface language is not the learning language:
// the questions come in whatever topic ?topic= asks for.
//
// Language: ?lang=de|es|en (this visit) → krabsy_duo_lang (switch on the title screen)
//        → krabsy_lang (set by the site) → browser language → English.
// No string here uses a grammar term (site rule), none says "verbs" (topic-neutral).
const OWN_KEY = 'krabsy_duo_lang';
const SITE_KEY = 'krabsy_lang';
const LANGS = ['de', 'es', 'en'];

const EN = {
  title: 'Krabsy Duo',
  workTitle: 'working title',
  tagline: 'Two players, one way out. Every lever asks a question.',
  play: 'Play together',
  playAgain: 'Play again',
  menu: 'Menu',
  resume: 'Resume',
  restartRoom: 'Restart room',
  paused: 'Paused',
  loading: 'Loading…',
  player: (n) => `Player ${n}`,
  you: 'you',
  yourFigure: 'Your figure',
  thisIsYou: 'This is you!',
  figureLink: 'Play with your figure →',
  figureUrl: '/en/my-figure/',
  pickFigure: 'Pick a figure',
  swapRoles: 'Swap roles',
  'role.climber': 'Climber',
  'role.strong': 'Strong one',
  'roleDo.climber': 'jumps high, climbs ladders, squeezes through gaps',
  'roleDo.strong': 'pushes and carries boxes, lifts heavy gates',
  keysP1: 'A D move · W jump / climb · S down · E use',
  keysP2: '← → move · ↑ jump / climb · ↓ down · Enter use',
  keysTouch: 'Each player has their own buttons at the bottom.',
  chooseKeys: (k) => `choose ${k}`,
  recordedNote: 'Player 1’s answers count for this device’s profile.',
  room: (n, of) => `Room ${n} / ${of}`,
  'room.1': 'Levers & doors',
  'room.2': 'Boxes',
  'room.3': 'Together',
  'goal.1': 'Climber: reach the levers. Strong one: lift the heavy gate.',
  'goal.2': 'Find the key. Strong one: push boxes to make steps.',
  'goal.3': 'Climber: jump off the strong one’s head to reach the switch.',
  needStrong: 'Too heavy! The strong one can do this.',
  needKey: 'Locked. Bring the key.',
  needLever: 'This opens with a lever.',
  notActive: 'Not active yet.',
  holding: 'Holding the gate… move to let go',
  right: 'Right!',
  wrong: 'Not quite.',
  tryAgain: 'Try again: press it once more.',
  roomDone: 'Room done!',
  bothExit: 'Both of you into the exit!',
  done: 'You made it!',
  summary: (n, m, p) => `${n} answers in ${m} min · ${p} % right`,
  perPlayer: (name, n, p) => `${name}: ${n} answers, ${p} % right`,
  practise: 'To practise',
  nothingMissed: 'No mistakes. Wow!',
  time: 'Time',
  sound: 'Sound',
  pause: 'Pause',
  rotate: 'Please turn your device sideways.',
  topicLine: {
    irregular_verbs: 'Fill in the missing word: go → ___ → gone',
    prepositions: 'Fill the gap: My birthday is ___ July.',
    es: 'Fill the gap: Yo ___ Lucas.',
    other: 'Fill the gap in the sentence.',
  },
};

const DE = {
  title: 'Krabsy Duo',
  workTitle: 'Arbeitstitel',
  tagline: 'Zwei Spieler, ein Ausgang. Jeder Hebel stellt eine Frage.',
  play: 'Zusammen spielen',
  playAgain: 'Nochmal spielen',
  menu: 'Menü',
  resume: 'Weiter',
  restartRoom: 'Raum neu starten',
  paused: 'Pause',
  loading: 'Lädt…',
  player: (n) => `Spieler ${n}`,
  you: 'du',
  yourFigure: 'Deine Figur',
  thisIsYou: 'Das bist du!',
  figureLink: 'Spiel mit deiner Figur →',
  figureUrl: '/de/meine-figur/',
  pickFigure: 'Figur wählen',
  swapRoles: 'Rollen tauschen',
  'role.climber': 'Kletterass',
  'role.strong': 'Kraftpaket',
  'roleDo.climber': 'springt hoch, klettert Leitern, passt durch enge Gänge',
  'roleDo.strong': 'schiebt und trägt Kisten, hebt schwere Gitter',
  keysP1: 'A D laufen · W springen / klettern · S runter · E benutzen',
  keysP2: '← → laufen · ↑ springen / klettern · ↓ runter · Enter benutzen',
  keysTouch: 'Jeder Spieler hat unten eigene Knöpfe.',
  chooseKeys: (k) => `wählen ${k}`,
  recordedNote: 'Die Antworten von Spieler 1 zählen für das Profil auf diesem Gerät.',
  room: (n, of) => `Raum ${n} / ${of}`,
  'room.1': 'Hebel & Türen',
  'room.2': 'Kisten',
  'room.3': 'Zusammen',
  'goal.1': 'Kletterass: erreiche die Hebel. Kraftpaket: heb das schwere Gitter.',
  'goal.2': 'Findet den Schlüssel. Kraftpaket: schieb Kisten als Stufen.',
  'goal.3': 'Kletterass: spring vom Kopf des Kraftpakets zum Schalter.',
  needStrong: 'Zu schwer! Das kann das Kraftpaket.',
  needKey: 'Abgeschlossen. Bringt den Schlüssel.',
  needLever: 'Die geht mit einem Hebel auf.',
  notActive: 'Noch nicht aktiv.',
  holding: 'Hält das Gitter… lauf los zum Loslassen',
  right: 'Richtig!',
  wrong: 'Nicht ganz.',
  tryAgain: 'Nochmal: einfach wieder drücken.',
  roomDone: 'Raum geschafft!',
  bothExit: 'Beide in den Ausgang!',
  done: 'Geschafft!',
  summary: (n, m, p) => `${n} Antworten in ${m} Min. · ${p} % richtig`,
  perPlayer: (name, n, p) => `${name}: ${n} Antworten, ${p} % richtig`,
  practise: 'Zum Üben',
  nothingMissed: 'Kein einziger Fehler!',
  time: 'Zeit',
  sound: 'Ton',
  pause: 'Pause',
  rotate: 'Bitte dreh dein Gerät quer.',
  topicLine: {
    irregular_verbs: 'Setz das fehlende Wort ein: go → ___ → gone',
    prepositions: 'Füll die Lücke: My birthday is ___ July.',
    es: 'Füll die Lücke: Yo ___ Lucas.',
    other: 'Füll die Lücke im Satz.',
  },
};

const ES = {
  title: 'Krabsy Duo',
  workTitle: 'título provisional',
  tagline: 'Dos jugadores, una salida. Cada palanca hace una pregunta.',
  play: 'Jugar juntos',
  playAgain: 'Jugar otra vez',
  menu: 'Menú',
  resume: 'Seguir',
  restartRoom: 'Reiniciar sala',
  paused: 'Pausa',
  loading: 'Cargando…',
  player: (n) => `Jugador ${n}`,
  you: 'tú',
  yourFigure: 'Tu personaje',
  thisIsYou: '¡Eres tú!',
  figureLink: 'Juega con tu personaje →',
  figureUrl: '/es/mi-personaje/',
  pickFigure: 'Elige un personaje',
  swapRoles: 'Cambiar papeles',
  'role.climber': 'Ágil',
  'role.strong': 'Fuerte',
  'roleDo.climber': 'salta alto, sube escaleras, pasa por huecos estrechos',
  'roleDo.strong': 'empuja y lleva cajas, levanta rejas pesadas',
  keysP1: 'A D andar · W saltar / subir · S bajar · E usar',
  keysP2: '← → andar · ↑ saltar / subir · ↓ bajar · Enter usar',
  keysTouch: 'Cada jugador tiene sus botones abajo.',
  chooseKeys: (k) => `elegir ${k}`,
  recordedNote: 'Las respuestas del jugador 1 cuentan para el perfil de este dispositivo.',
  room: (n, of) => `Sala ${n} / ${of}`,
  'room.1': 'Palancas y puertas',
  'room.2': 'Cajas',
  'room.3': 'Juntos',
  'goal.1': 'Ágil: llega a las palancas. Fuerte: levanta la reja pesada.',
  'goal.2': 'Buscad la llave. Fuerte: empuja cajas para hacer escalones.',
  'goal.3': 'Ágil: salta desde la cabeza de Fuerte hasta el interruptor.',
  needStrong: '¡Pesa demasiado! Esto lo hace Fuerte.',
  needKey: 'Cerrado. Traed la llave.',
  needLever: 'Se abre con una palanca.',
  notActive: 'Todavía no funciona.',
  holding: 'Sujeta la reja… muévete para soltarla',
  right: '¡Bien!',
  wrong: 'Casi.',
  tryAgain: 'Otra vez: vuelve a pulsar.',
  roomDone: '¡Sala superada!',
  bothExit: '¡Los dos a la salida!',
  done: '¡Lo habéis logrado!',
  summary: (n, m, p) => `${n} respuestas en ${m} min · ${p} % bien`,
  perPlayer: (name, n, p) => `${name}: ${n} respuestas, ${p} % bien`,
  practise: 'Para practicar',
  nothingMissed: '¡Ni un solo error!',
  time: 'Tiempo',
  sound: 'Sonido',
  pause: 'Pausa',
  rotate: 'Gira el dispositivo, por favor.',
  topicLine: {
    irregular_verbs: 'Completa la palabra que falta: go → ___ → gone',
    prepositions: 'Completa: My birthday is ___ July.',
    es: 'Completa: Yo ___ Lucas.',
    other: 'Completa la frase.',
  },
};

const TABLE = { en: EN, de: DE, es: ES };

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(q)) return q;
  try {
    const own = localStorage.getItem(OWN_KEY);
    if (LANGS.includes(own)) return own;
    const site = localStorage.getItem(SITE_KEY);
    if (LANGS.includes(site)) return site;
  } catch (_) { /* private mode */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : 'en';
}

export let lang = pickLang();

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem(OWN_KEY, l); } catch (_) { /* ignore */ }
  applyStatic();
}

export function t(key, ...args) {
  const S = TABLE[lang] || EN;
  const v = S[key] !== undefined ? S[key] : EN[key];
  if (typeof v === 'function') return v(...args);
  return v !== undefined ? v : key;
}

/** The one-line example on the title screen for the topic being played. */
export function topicLine(topic) {
  const tl = t('topicLine');
  if (tl[topic]) return tl[topic];
  if (/^es_/.test(topic)) return tl.es;
  return tl.other;
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const s = t(el.dataset.i18nAria);
    el.setAttribute('aria-label', s);
    el.title = s;
  });
}
