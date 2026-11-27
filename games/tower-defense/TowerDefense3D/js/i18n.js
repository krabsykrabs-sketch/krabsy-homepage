// Localisation. Interface DE/ES/EN; the questions stay in the language being learned.
// Language: ?lang=de|es|en, else the site's saved choice (localStorage 'krabsy_lang',
// shared with the wrapper pages), else the browser language, else German.
//
// Values are strings or template functions. Static index.html nodes carry
// data-i18n="key" and are filled once at boot by applyStatic().

const DE = {
  oreLeft: 'Fragen übrig',
  streak: (n) => `${n} in Folge`,
  forgeEmptyBuild: 'Leer! Starte die nächste Welle.',
  locked: (n) => `Schaffe zuerst Level ${n}`,
  lockedTraining: 'Mach zuerst das Training',
  trainingName: 'Training',
  trainingTag: 'So geht das Spiel – in 2 Minuten.',
  nextLevel: 'Nächstes Level',
  speed: 'Tempo ändern',
  fitView: 'Ganze Karte zeigen',
  tutStart: 'Dein Turm schießt von selbst auf alles im Kreis. Starte die erste Welle!',
  tutWatch: 'Schau zu: Dein Turm hält die Skelette auf.',
  archerFirst: 'Bau zuerst einen Bogenturm.',
  tutAnswer: (n) => `Beantworte Fragen: Jede richtige Antwort bringt Münzen. Sammle ${n}!`,
  tutLastWave: 'Dein Turm ist jetzt stärker. Starte die letzte Welle!',
  tutWatchStrong: 'Schau zu: Dein stärkerer Turm trifft jetzt zwei Skelette auf einmal.',
  tutPickArcher: 'Skelette laufen diesen Weg zu deiner Burg. Wähle unten den Bogenturm!',
  tutPlace: 'Tippe jetzt auf das leuchtende Feld neben dem Weg.',
  tutUpgradeTap: 'Tippe auf deinen Turm mit dem ⬆: So wird er stärker.',
  tutUpgradeBtn: 'Jetzt „Ausbauen“ drücken!',
  rotate: 'Dreh dein Handy quer, dann siehst du mehr.',
  title: 'Verb Towers',
  subtitle: 'Baue Türme. Schmiede Münzen mit englischen Verben.',
  loading: 'Lädt …',
  loadError: 'Das Spiel konnte nicht geladen werden. Bitte lade die Seite neu.',
  menuHint: 'Leertaste: Welle starten · 1–4: Turm wählen · Q W E: Antwort · Esc: abbrechen · Mausrad: zoomen',
  levelBest: (n) => `Rekord: Welle ${n}`,
  notPlayed: 'Noch nicht gespielt',
  levels: [
    { name: 'Wiese', tag: 'Ein ruhiger Weg zum Start.' },
    { name: 'Kreuzung', tag: 'Ein Weg hinein, zwei Burgen.' },
    { name: 'Der lange Marsch', tag: 'Drei Runden Ärger.' },
    { name: 'Seeufer', tag: 'Herbst am See.' },
    { name: 'Zwei Tore', tag: 'Feinde von zwei Seiten.' },
    { name: 'Winterpass', tag: 'Der längste Weg, im Schnee.' },
  ],

  phaseBuild: '🔨 Bauzeit',
  phaseBattle: '⚔️ Kampf!',
  phaseWaveDone: '🎉 Geschafft!',
  wave: 'Welle',
  waveBanner: (n) => `Welle ${n}`,
  bossBanner: (n) => `Welle ${n} – BOSS!`,
  startWave: 'Welle starten',
  hotkeySpace: 'Leertaste',

  forgeTitle: 'Schmiede',
  forgeSub: (n) => `Richtig = ${n} Münzen`,
  forgeEmpty: 'Leer! Nach der Welle gibt es Nachschub.',
  forgeRight: (n) => `Richtig! +${n}`,
  forgeWrong: 'So ist es richtig:',
  forgeCaption: ['Grundform', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Bogenturm', desc: 'Schießt schnell auf einen Gegner.', ups: ['Pfeil springt weiter (2 Gegner)', 'Pfeil springt weiter (3 Gegner)'] },
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
  flagChain1: 'Springt zu 2 Gegnern',
  flagChain2: 'Springt zu 3 Gegnern',
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
  oreLeft: 'Preguntas restantes',
  streak: (n) => `${n} seguidas`,
  forgeEmptyBuild: '¡Vacía! Empieza la siguiente oleada.',
  locked: (n) => `Supera primero el nivel ${n}`,
  lockedTraining: 'Haz primero el entrenamiento',
  trainingName: 'Entrenamiento',
  trainingTag: 'Así se juega, en 2 minutos.',
  nextLevel: 'Siguiente nivel',
  speed: 'Cambiar velocidad',
  fitView: 'Ver todo el mapa',
  tutStart: 'Tu torre dispara sola a todo lo que entra en el círculo. ¡Empieza la primera oleada!',
  tutWatch: 'Mira: tu torre detiene a los esqueletos.',
  archerFirst: 'Primero construye una torre de arqueros.',
  tutAnswer: (n) => `Responde preguntas: cada respuesta correcta da monedas. ¡Junta ${n}!`,
  tutLastWave: 'Tu torre ahora es más fuerte. ¡Empieza la última oleada!',
  tutWatchStrong: 'Mira: tu torre mejorada ahora alcanza a dos esqueletos a la vez.',
  tutPickArcher: 'Los esqueletos siguen este camino hasta tu castillo. ¡Elige abajo la torre de arqueros!',
  tutPlace: 'Ahora toca la casilla brillante junto al camino.',
  tutUpgradeTap: 'Toca tu torre con la ⬆: así se hace más fuerte.',
  tutUpgradeBtn: '¡Ahora pulsa «Mejorar»!',
  rotate: 'Gira el móvil en horizontal para ver más.',
  title: 'Verb Towers',
  subtitle: 'Construye torres. Forja monedas con verbos en inglés.',
  loading: 'Cargando…',
  loadError: 'No se pudo cargar el juego. Vuelve a cargar la página.',
  menuHint: 'Espacio: empezar oleada · 1–4: elegir torre · Q W E: respuesta · Esc: cancelar · rueda: zoom',
  levelBest: (n) => `Récord: oleada ${n}`,
  notPlayed: 'Aún sin jugar',
  levels: [
    { name: 'Pradera', tag: 'Un camino tranquilo para empezar.' },
    { name: 'Cruce', tag: 'Un camino de entrada, dos castillos.' },
    { name: 'La larga marcha', tag: 'Tres vueltas de problemas.' },
    { name: 'Orilla del lago', tag: 'Otoño junto al lago.' },
    { name: 'Dos puertas', tag: 'Enemigos por dos lados.' },
    { name: 'Paso de invierno', tag: 'El camino más largo, en la nieve.' },
  ],

  phaseBuild: '🔨 A construir',
  phaseBattle: '⚔️ ¡Batalla!',
  phaseWaveDone: '🎉 ¡Hecho!',
  wave: 'Oleada',
  waveBanner: (n) => `Oleada ${n}`,
  bossBanner: (n) => `Oleada ${n}: ¡JEFE!`,
  startWave: 'Empezar oleada',
  hotkeySpace: 'Espacio',

  forgeTitle: 'Forja',
  forgeSub: (n) => `Correcto = ${n} monedas`,
  forgeEmpty: '¡Vacía! Después de la oleada llega más.',
  forgeRight: (n) => `¡Correcto! +${n}`,
  forgeWrong: 'Así es correcto:',
  forgeCaption: ['forma base', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Torre de arqueros', desc: 'Dispara rápido a un enemigo.', ups: ['La flecha salta (2 enemigos)', 'La flecha salta (3 enemigos)'] },
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
  flagChain1: 'Salta a 2 enemigos',
  flagChain2: 'Salta a 3 enemigos',
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
  oreLeft: 'Questions left',
  streak: (n) => `${n} in a row`,
  forgeEmptyBuild: 'Empty! Start the next wave.',
  locked: (n) => `Beat level ${n} first`,
  lockedTraining: 'Do the training first',
  trainingName: 'Training',
  trainingTag: 'How to play, in 2 minutes.',
  nextLevel: 'Next level',
  speed: 'Change speed',
  fitView: 'Show the whole map',
  tutStart: 'Your tower shoots by itself at anything in its circle. Start the first wave!',
  tutWatch: 'Watch: your tower stops the skeletons.',
  archerFirst: 'Build an archer tower first.',
  tutAnswer: (n) => `Answer questions: every right answer gives coins. Collect ${n}!`,
  tutLastWave: 'Your tower is stronger now. Start the last wave!',
  tutWatchStrong: 'Watch: your stronger tower now hits two skeletons at once.',
  tutPickArcher: 'Skeletons walk this road to your castle. Pick the archer tower below!',
  tutPlace: 'Now tap the glowing hex next to the road.',
  tutUpgradeTap: 'Tap your tower with the ⬆ to make it stronger.',
  tutUpgradeBtn: 'Now press "Upgrade"!',
  rotate: 'Turn your phone sideways to see more.',
  title: 'Verb Towers',
  subtitle: 'Build towers. Forge coins with English verbs.',
  loading: 'Loading…',
  loadError: 'Could not load the game. Please reload the page.',
  menuHint: 'Space: start wave · 1–4: pick tower · Q W E: answer · Esc: cancel · wheel: zoom',
  levelBest: (n) => `Best: wave ${n}`,
  notPlayed: 'Not played yet',
  levels: [
    { name: 'Meadow', tag: 'A gentle stroll to start.' },
    { name: 'Crossroads', tag: 'One road in, two castles.' },
    { name: 'The Long March', tag: 'Three laps of trouble.' },
    { name: 'Lakeside', tag: 'Autumn by the lake.' },
    { name: 'Two Gates', tag: 'Enemies from two sides.' },
    { name: 'Winter Pass', tag: 'The longest road, in the snow.' },
  ],

  phaseBuild: '🔨 Build time',
  phaseBattle: '⚔️ Battle!',
  phaseWaveDone: '🎉 Done!',
  wave: 'Wave',
  waveBanner: (n) => `Wave ${n}`,
  bossBanner: (n) => `Wave ${n} – BOSS!`,
  startWave: 'Start wave',
  hotkeySpace: 'Space',

  forgeTitle: 'Forge',
  forgeSub: (n) => `Right = ${n} coins`,
  forgeEmpty: 'Empty! More arrives after the wave.',
  forgeRight: (n) => `Correct! +${n}`,
  forgeWrong: 'This is right:',
  forgeCaption: ['base form', 'simple past', 'past participle'],

  towers: {
    basic: { name: 'Archer Tower', desc: 'Shoots fast at one enemy.', ups: ['Arrow jumps on (2 enemies)', 'Arrow jumps on (3 enemies)'] },
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
  flagChain1: 'Jumps to 2 enemies',
  flagChain2: 'Jumps to 3 enemies',
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

// Topic texts (?topic=, 2026-11-24): the tables above are written for verbs. Other
// topics (prepositions, Spanish es_ser, …) override the few texts that name verbs;
// menuExample = [before, highlighted word, after] replaces the go → went → gone line.
const TOPIC = (() => {
  try { return new URLSearchParams(window.location.search).get('topic') || 'irregular_verbs'; }
  catch (_) { return 'irregular_verbs'; }
})();
const TOPIC_TEXT = {
  prepositions: {
    de: { subtitle: 'Baue Türme. Schmiede Münzen mit englischen Präpositionen.',
      recapTitle: 'Diese Sätze üben:', menuExample: ['My birthday is ', 'in', ' July.'] },
    es: { subtitle: 'Construye torres. Forja monedas con preposiciones en inglés.',
      recapTitle: 'Frases para practicar:', menuExample: ['My birthday is ', 'in', ' July.'] },
    en: { subtitle: 'Build towers. Forge coins with English prepositions.',
      recapTitle: 'Sentences to practise:', menuExample: ['My birthday is ', 'in', ' July.'] },
  },
  es_ser: {
    de: { subtitle: 'Baue Türme. Schmiede Münzen mit spanischen Sätzen.',
      recapTitle: 'Diese Sätze üben:', menuExample: ['Yo ', 'soy', ' Lucas.'] },
    es: { subtitle: 'Construye torres. Forja monedas con frases en español.',
      recapTitle: 'Frases para practicar:', menuExample: ['Yo ', 'soy', ' Lucas.'] },
    en: { subtitle: 'Build towers. Forge coins with Spanish sentences.',
      recapTitle: 'Sentences to practise:', menuExample: ['Yo ', 'soy', ' Lucas.'] },
  },
};
// Any Spanish topic (es_…) uses the Spanish texts: the example only shows how the forge works.
const TOPIC_KEY = TOPIC_TEXT[TOPIC] ? TOPIC : (/^es_/.test(TOPIC) ? 'es_ser' : TOPIC);
const TT = (TOPIC_TEXT[TOPIC_KEY] && (TOPIC_TEXT[TOPIC_KEY][lang] || TOPIC_TEXT[TOPIC_KEY].en)) || {};

// t('key') → string; t('key', a, b) calls template functions.
export function t(key, ...args) {
  const v = TT[key] !== undefined ? TT[key] : S[key] !== undefined ? S[key] : EN[key];
  if (typeof v === 'function') return v(...args);
  return v !== undefined ? v : key;
}

export const towerText = (type) => S.towers[type] || EN.towers[type];
export const levelText = (index) => S.levels[index] || EN.levels[index] || { name: `Level ${index + 1}`, tag: '' };

// Fill static nodes: data-i18n → text, data-i18n-title → title + aria-label.
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const ex = TT.menuExample;
  const chainEl = root.querySelector('.menu-chain');
  if (ex && chainEl) {
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    chainEl.innerHTML = `${esc(ex[0])}<span class="form-past">${esc(ex[1])}</span>${esc(ex[2])}`;
  }
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const text = t(el.dataset.i18nTitle);
    el.title = text;
    el.setAttribute('aria-label', text);
  });
}
