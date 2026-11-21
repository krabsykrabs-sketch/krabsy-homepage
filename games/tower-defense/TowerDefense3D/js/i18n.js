// Localisation. The site serves German and Spanish kids; English verbs stay English.
// Language: ?lang=de|es|en, else the site's saved choice (localStorage 'krabsy_lang',
// shared with the wrapper pages), else the browser language, else German.
//
// Values are strings or template functions. Static index.html nodes carry
// data-i18n="key" and are filled once at boot by applyStatic().

const DE = {
  locked: (n) => `Schaffe zuerst Level ${n}`,
  nextLevel: 'Nächstes Level',
  speed: 'Tempo ändern',
  tutTapCell: 'Tippe auf ein leuchtendes Feld neben dem Weg.',
  tutPickTower: 'Gut! Wähle jetzt unten einen Turm.',
  tutStart: 'Dein Turm steht. Starte die erste Welle!',
  tutWatch: 'Deine Türme schießen von allein.',
  tutForge: 'Mehr Münzen? Öffne die Schmiede!',
  tutAnswer: 'Welche Form fehlt? Tippe die richtige Antwort.',
  rotate: 'Dreh dein Handy quer, dann siehst du mehr.',
  title: 'Verb Towers',
  subtitle: 'Baue Türme. Schmiede Münzen mit englischen Verben.',
  loading: 'Lädt …',
  loadError: 'Das Spiel konnte nicht geladen werden. Bitte lade die Seite neu.',
  menuHint: 'Leertaste: Welle starten · 1–4: Turm wählen · F: Schmiede · Esc: abbrechen',
  levelBest: (n) => `Rekord: Welle ${n}`,
  notPlayed: 'Noch nicht gespielt',
  levels: [
    { name: 'Wiese', tag: 'Ein ruhiger Weg zum Start.' },
    { name: 'Kreuzung', tag: 'Ein Weg hinein, zwei Burgen.' },
    { name: 'Der lange Marsch', tag: 'Drei Runden Ärger.' },
  ],

  phaseBuild: '🔨 Bauzeit',
  phaseBattle: '⚔️ Kampf!',
  phaseWaveDone: '🎉 Geschafft!',
  wave: 'Welle',
  waveBanner: (n) => `Welle ${n}`,
  bossBanner: (n) => `Welle ${n} – BOSS!`,
  startWave: 'Welle starten',
  hotkeySpace: 'Leertaste',
  slowMotion: 'Zeitlupe',

  forge: 'Schmiede',
  forgeTitle: 'Schmiede',
  forgeSub: (n) => `Richtige Antwort = ${n} Münzen`,
  forgeEmpty: 'Die Schmiede ist leer. Nach der nächsten Welle gibt es neue Hämmer.',
  forgeClose: 'Fertig',
  forgeNext: 'Weiter',
  forgeRight: (n) => `Richtig! +${n}`,
  forgeWrong: 'Nicht ganz. So ist es richtig:',
  forgeCaption: ['Grundform', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Bogenturm', desc: 'Schießt schnell auf einen Gegner.', ups: ['Trifft zwei Gegner', 'Trifft viele Gegner'] },
    catapult: { name: 'Katapult', desc: 'Große Reichweite, schwere Steine.', ups: ['50 % mehr Schaden', 'Noch mehr Reichweite'] },
    cannon: { name: 'Kanone', desc: 'Langsam, aber trifft alle in der Nähe.', ups: ['Größere Explosion', 'Schießt schneller'] },
    freeze: { name: 'Frostturm', desc: 'Friert alle Gegner in der Nähe ein.', ups: ['Längerer Frost', 'Macht dauerhaft langsam'] },
  },
  level: 'Stufe',
  upgrade: 'Ausbauen',
  sell: 'Verkaufen',
  maxLevel: 'Voll ausgebaut',
  statDamage: 'Schaden',
  statRange: 'Reichweite',
  statRate: 'Tempo',
  statArea: 'Radius',
  statFreeze: 'Frost',
  statPause: 'Pause',
  flagPierce2: 'Trifft 2',
  flagPierceAll: 'Trifft alle',
  flagSlow: 'Dauerhaft langsam',

  waveDone: (n) => `Welle ${n} geschafft!`,
  tapToContinue: 'Tippen zum Weiterspielen',
  gameOver: 'Die Burg ist gefallen',
  reached: (n, total) => `Du hast Welle ${n} von ${total} erreicht.`,
  victory: 'Sieg!',
  victorySub: (total) => `Alle ${total} Wellen geschafft.`,
  best: (n) => `Rekord: Welle ${n}`,
  playAgain: 'Nochmal',
  menu: 'Menü',
  score: (right, asked) => `${right} von ${asked} Antworten richtig`,
  recapTitle: 'Diese Verben noch üben:',
  recapPerfect: 'Alle Antworten richtig! ⭐',
  quitTitle: 'Spiel beenden?',
  quitYes: 'Ja, zum Menü',
  quitNo: 'Weiterspielen',
  sound: 'Ton an/aus',
  quit: 'Spiel beenden',
};

const ES = {
  locked: (n) => `Supera primero el nivel ${n}`,
  nextLevel: 'Siguiente nivel',
  speed: 'Cambiar velocidad',
  tutTapCell: 'Toca una casilla brillante junto al camino.',
  tutPickTower: '¡Bien! Ahora elige una torre abajo.',
  tutStart: 'Tu torre está lista. ¡Empieza la primera oleada!',
  tutWatch: 'Tus torres disparan solas.',
  tutForge: '¿Más monedas? ¡Abre la forja!',
  tutAnswer: '¿Qué forma falta? Toca la respuesta correcta.',
  rotate: 'Gira el móvil en horizontal para ver más.',
  title: 'Verb Towers',
  subtitle: 'Construye torres. Forja monedas con verbos en inglés.',
  loading: 'Cargando…',
  loadError: 'No se pudo cargar el juego. Vuelve a cargar la página.',
  menuHint: 'Espacio: empezar oleada · 1–4: elegir torre · F: forja · Esc: cancelar',
  levelBest: (n) => `Récord: oleada ${n}`,
  notPlayed: 'Aún sin jugar',
  levels: [
    { name: 'Pradera', tag: 'Un camino tranquilo para empezar.' },
    { name: 'Cruce', tag: 'Un camino de entrada, dos castillos.' },
    { name: 'La larga marcha', tag: 'Tres vueltas de problemas.' },
  ],

  phaseBuild: '🔨 A construir',
  phaseBattle: '⚔️ ¡Batalla!',
  phaseWaveDone: '🎉 ¡Hecho!',
  wave: 'Oleada',
  waveBanner: (n) => `Oleada ${n}`,
  bossBanner: (n) => `Oleada ${n}: ¡JEFE!`,
  startWave: 'Empezar oleada',
  hotkeySpace: 'Espacio',
  slowMotion: 'Cámara lenta',

  forge: 'Forja',
  forgeTitle: 'Forja',
  forgeSub: (n) => `Respuesta correcta = ${n} monedas`,
  forgeEmpty: 'La forja está vacía. Después de la próxima oleada hay martillos nuevos.',
  forgeClose: 'Listo',
  forgeNext: 'Seguir',
  forgeRight: (n) => `¡Correcto! +${n}`,
  forgeWrong: 'Casi. Así es correcto:',
  forgeCaption: ['forma base', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Torre de arqueros', desc: 'Dispara rápido a un enemigo.', ups: ['Alcanza a dos enemigos', 'Alcanza a muchos enemigos'] },
    catapult: { name: 'Catapulta', desc: 'Gran alcance, piedras pesadas.', ups: ['50 % más de daño', 'Aún más alcance'] },
    cannon: { name: 'Cañón', desc: 'Lento, pero golpea a todos los que están cerca.', ups: ['Explosión más grande', 'Dispara más rápido'] },
    freeze: { name: 'Torre de hielo', desc: 'Congela a todos los enemigos cercanos.', ups: ['Hielo más largo', 'Los vuelve lentos para siempre'] },
  },
  level: 'Nivel',
  upgrade: 'Mejorar',
  sell: 'Vender',
  maxLevel: 'Nivel máximo',
  statDamage: 'Daño',
  statRange: 'Alcance',
  statRate: 'Ritmo',
  statArea: 'Radio',
  statFreeze: 'Hielo',
  statPause: 'Pausa',
  flagPierce2: 'Alcanza 2',
  flagPierceAll: 'Alcanza a todos',
  flagSlow: 'Lentos para siempre',

  waveDone: (n) => `¡Oleada ${n} superada!`,
  tapToContinue: 'Toca para seguir',
  gameOver: 'El castillo ha caído',
  reached: (n, total) => `Llegaste a la oleada ${n} de ${total}.`,
  victory: '¡Victoria!',
  victorySub: (total) => `Superaste las ${total} oleadas.`,
  best: (n) => `Récord: oleada ${n}`,
  playAgain: 'Otra vez',
  menu: 'Menú',
  score: (right, asked) => `${right} de ${asked} respuestas correctas`,
  recapTitle: 'Practica estos verbos:',
  recapPerfect: '¡Todas las respuestas correctas! ⭐',
  quitTitle: '¿Terminar la partida?',
  quitYes: 'Sí, al menú',
  quitNo: 'Seguir jugando',
  sound: 'Sonido sí/no',
  quit: 'Terminar la partida',
};

const EN = {
  locked: (n) => `Beat level ${n} first`,
  nextLevel: 'Next level',
  speed: 'Change speed',
  tutTapCell: 'Tap a glowing hex next to the road.',
  tutPickTower: 'Good! Now pick a tower below.',
  tutStart: 'Your tower is ready. Start the first wave!',
  tutWatch: 'Your towers shoot by themselves.',
  tutForge: 'Need more coins? Open the forge!',
  tutAnswer: 'Which form is missing? Tap the right answer.',
  rotate: 'Turn your phone sideways to see more.',
  title: 'Verb Towers',
  subtitle: 'Build towers. Forge coins with English verbs.',
  loading: 'Loading…',
  loadError: 'Could not load the game. Please reload the page.',
  menuHint: 'Space: start wave · 1–4: pick tower · F: forge · Esc: cancel',
  levelBest: (n) => `Best: wave ${n}`,
  notPlayed: 'Not played yet',
  levels: [
    { name: 'Meadow', tag: 'A gentle stroll to start.' },
    { name: 'Crossroads', tag: 'One road in, two castles.' },
    { name: 'The Long March', tag: 'Three laps of trouble.' },
  ],

  phaseBuild: '🔨 Build time',
  phaseBattle: '⚔️ Battle!',
  phaseWaveDone: '🎉 Done!',
  wave: 'Wave',
  waveBanner: (n) => `Wave ${n}`,
  bossBanner: (n) => `Wave ${n} – BOSS!`,
  startWave: 'Start wave',
  hotkeySpace: 'Space',
  slowMotion: 'Slow motion',

  forge: 'Forge',
  forgeTitle: 'Forge',
  forgeSub: (n) => `Right answer = ${n} coins`,
  forgeEmpty: 'The forge is empty. New hammers arrive after the next wave.',
  forgeClose: 'Done',
  forgeNext: 'Next',
  forgeRight: (n) => `Correct! +${n}`,
  forgeWrong: 'Not quite. This is right:',
  forgeCaption: ['base form', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Archer Tower', desc: 'Shoots fast at one enemy.', ups: ['Hits two enemies', 'Hits many enemies'] },
    catapult: { name: 'Catapult', desc: 'Long range, heavy boulders.', ups: ['50% more damage', 'Even longer range'] },
    cannon: { name: 'Cannon', desc: 'Slow, but hits everyone nearby.', ups: ['Bigger explosion', 'Shoots faster'] },
    freeze: { name: 'Frost Tower', desc: 'Freezes every enemy nearby.', ups: ['Longer freeze', 'Slows them for good'] },
  },
  level: 'Level',
  upgrade: 'Upgrade',
  sell: 'Sell',
  maxLevel: 'Max level',
  statDamage: 'Damage',
  statRange: 'Range',
  statRate: 'Rate',
  statArea: 'Radius',
  statFreeze: 'Freeze',
  statPause: 'Pause',
  flagPierce2: 'Hits 2',
  flagPierceAll: 'Hits all',
  flagSlow: 'Slows for good',

  waveDone: (n) => `Wave ${n} complete!`,
  tapToContinue: 'Tap to continue',
  gameOver: 'The castle has fallen',
  reached: (n, total) => `You reached wave ${n} of ${total}.`,
  victory: 'Victory!',
  victorySub: (total) => `All ${total} waves cleared.`,
  best: (n) => `Best: wave ${n}`,
  playAgain: 'Play again',
  menu: 'Menu',
  score: (right, asked) => `${right} of ${asked} answers correct`,
  recapTitle: 'Verbs to practise:',
  recapPerfect: 'Every answer correct! ⭐',
  quitTitle: 'End this game?',
  quitYes: 'Yes, to the menu',
  quitNo: 'Keep playing',
  sound: 'Sound on/off',
  quit: 'End game',
};

const TABLES = { de: DE, es: ES, en: EN };

function detectLang() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q && TABLES[q]) return q;
  } catch (_) { /* no URL access */ }
  try {
    const saved = localStorage.getItem('krabsy_lang');
    if (saved && TABLES[saved]) return saved;
  } catch (_) { /* storage blocked */ }
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  return TABLES[nav] ? nav : 'de';
}

export const lang = detectLang();
const S = TABLES[lang];

// t('key') → string; t('key', a, b) calls template functions.
export function t(key, ...args) {
  const v = S[key] !== undefined ? S[key] : EN[key];
  if (typeof v === 'function') return v(...args);
  return v !== undefined ? v : key;
}

export const towerText = (type) => S.towers[type] || EN.towers[type];
export const levelText = (index) => S.levels[index] || EN.levels[index] || { name: `Level ${index + 1}`, tag: '' };

// Fill static nodes: data-i18n → text, data-i18n-title → title + aria-label.
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const text = t(el.dataset.i18nTitle);
    el.title = text;
    el.setAttribute('aria-label', text);
  });
}
