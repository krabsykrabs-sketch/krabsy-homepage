// Interface texts (verbs and creature names always stay English).
// Language: ?lang=de|es|en, else the browser language, else English.
const T = {
  en: {
    title: 'Verb Hatchery',
    tagline: 'Grab eggs from the belt with the right verb form. Hatch creatures, earn coins, grow your hatchery!',
    play: 'Play', loading: 'Loading …', newGame: 'Start over',
    confirmReset: 'Really start over? All creatures and coins are lost.',
    welcomeBack: 'Welcome back!',
    awayEarned: (c, time) => `While you were away (${time}), your creatures earned <b>${c}</b> coins.`,
    eggsReady: (n) => n === 1 ? '1 egg is ready to hatch.' : `${n} eggs are ready to hatch.`,
    perSec: '/s', coins: 'coins', stars: 'Stars',
    r_common: 'Common', r_uncommon: 'Uncommon', r_rare: 'Rare', r_epic: 'Epic', r_legendary: 'Legendary',
    egg: (r) => `${r} egg`,
    cardOne: 'Answer and the egg is yours!',
    cardTwo: 'Two answers for this egg!',
    step: (a, b) => `${a} / ${b}`,
    right: 'Right!', wrong: 'Oops!', eggRolled: 'The egg rolled away. This verb comes back soon.',
    goOn: 'Go on', bonus: (n) => `+${n}`,
    incFull: 'Incubators full! Hatch an egg first.',
    incFullWaiting: 'Incubators full! Buy a pen for the waiting creature.',
    tapToHatch: 'Tap!', waitingPen: 'Needs a pen',
    hatched: 'It hatched!', isNew: 'NEW!', earns: (n) => `earns ${n} coins/s`,
    toPen: 'Into the pen!', waitsForPen: 'All pens are full. It waits in the incubator until you buy a pen.',
    upgrades: 'Upgrades', book: 'Creature Book', goals: 'Goals', close: 'Close',
    up_pen: 'Extra pen', up_pen_d: 'Room for one more creature',
    up_incubator: 'Extra incubator', up_incubator_d: 'Hold one more egg',
    up_hatchSpeed: 'Warm lamps', up_hatchSpeed_d: 'Eggs hatch 15 % faster',
    up_beltLuck: 'Lucky belt', up_beltLuck_d: 'Rarer eggs come more often',
    level: (n) => `Level ${n}`, max: 'MAX', buy: 'Buy',
    bookFound: (a, b) => `${a} of ${b} found`,
    bookChance: (n) => `each: 1 in ${n}`,
    bookHow: 'Rarer eggs ask harder verbs. Which creature hatches from an egg is random.',
    release: (n) => `Let go (+${n})`, releaseAsk: 'This creature goes back to the wild and you get coins.',
    penEmpty: 'Empty pen',
    g_grab: (n) => `Grab ${n} eggs`, g_grabR: (n, r) => n === 1 ? `Grab a ${r} egg` : `Grab ${n} ${r} eggs`,
    g_hatch: (n) => n === 1 ? 'Hatch your first creature' : `Hatch ${n} creatures`,
    g_hatchR: (n, r) => `Hatch a ${r} creature`,
    g_upgrades: (n) => n === 1 ? 'Buy an upgrade' : `Buy ${n} upgrades`,
    g_streak: (n) => `Answer ${n} in a row`,
    g_cps: (n) => `Earn ${n} coins per second`,
    g_book: (n) => `Find ${n} different creatures`,
    g_pens: (n) => `Have ${n} pens`,
    star: 'Goal done! +1 star', sound: 'Sound',
    rotate: 'Verb Hatchery needs a wider screen. Turn your device sideways.',
    time_m: (n) => `${n} min`, time_h: (n) => `${n} h`,
  },
  de: {
    title: 'Verb Hatchery',
    tagline: 'Schnapp dir Eier vom Band mit der richtigen Verbform. Brüte Wesen aus, verdiene Münzen und lass deine Brüterei wachsen!',
    play: 'Spielen', loading: 'Lädt …', newGame: 'Neu anfangen',
    confirmReset: 'Wirklich neu anfangen? Alle Wesen und Münzen sind dann weg.',
    welcomeBack: 'Willkommen zurück!',
    awayEarned: (c, time) => `Während du weg warst (${time}), haben deine Wesen <b>${c}</b> Münzen verdient.`,
    eggsReady: (n) => n === 1 ? '1 Ei ist bereit zum Schlüpfen.' : `${n} Eier sind bereit zum Schlüpfen.`,
    perSec: '/s', coins: 'Münzen', stars: 'Sterne',
    r_common: 'Normal', r_uncommon: 'Selten', r_rare: 'Rar', r_epic: 'Episch', r_legendary: 'Legendär',
    egg: (r) => `Ei: ${r}`,
    cardOne: 'Antworte und das Ei gehört dir!',
    cardTwo: 'Zwei Antworten für dieses Ei!',
    step: (a, b) => `${a} / ${b}`,
    right: 'Richtig!', wrong: 'Hoppla!', eggRolled: 'Das Ei ist weggerollt. Dieses Verb kommt bald wieder.',
    goOn: 'Weiter', bonus: (n) => `+${n}`,
    incFull: 'Brutkästen voll! Lass erst ein Ei schlüpfen.',
    incFullWaiting: 'Brutkästen voll! Kauf ein Gehege für das wartende Wesen.',
    tapToHatch: 'Tippen!', waitingPen: 'Braucht Gehege',
    hatched: 'Geschlüpft!', isNew: 'NEU!', earns: (n) => `verdient ${n} Münzen/s`,
    toPen: 'Ab ins Gehege!', waitsForPen: 'Alle Gehege sind voll. Es wartet im Brutkasten, bis du ein Gehege kaufst.',
    upgrades: 'Verbessern', book: 'Wesen-Buch', goals: 'Ziele', close: 'Schließen',
    up_pen: 'Neues Gehege', up_pen_d: 'Platz für ein Wesen mehr',
    up_incubator: 'Neuer Brutkasten', up_incubator_d: 'Ein Ei mehr gleichzeitig',
    up_hatchSpeed: 'Wärmelampen', up_hatchSpeed_d: 'Eier schlüpfen 15 % schneller',
    up_beltLuck: 'Glücksband', up_beltLuck_d: 'Seltenere Eier kommen öfter',
    level: (n) => `Stufe ${n}`, max: 'MAX', buy: 'Kaufen',
    bookFound: (a, b) => `${a} von ${b} gefunden`,
    bookChance: (n) => `je 1 zu ${n}`,
    bookHow: 'Seltenere Eier fragen schwierigere Verben. Welches Wesen aus einem Ei schlüpft, ist Zufall.',
    release: (n) => `Freilassen (+${n})`, releaseAsk: 'Das Wesen geht zurück in die Wildnis und du bekommst Münzen.',
    penEmpty: 'Leeres Gehege',
    g_grab: (n) => `Schnapp dir ${n} Eier`, g_grabR: (n, r) => `Schnapp dir ein Ei: ${r}`,
    g_hatch: (n) => n === 1 ? 'Lass dein erstes Wesen schlüpfen' : `Lass ${n} Wesen schlüpfen`,
    g_hatchR: (n, r) => `Lass ein Wesen schlüpfen: ${r}`,
    g_upgrades: (n) => n === 1 ? 'Kauf eine Verbesserung' : `Kauf ${n} Verbesserungen`,
    g_streak: (n) => `${n} richtig hintereinander`,
    g_cps: (n) => `Verdiene ${n} Münzen pro Sekunde`,
    g_book: (n) => `Finde ${n} verschiedene Wesen`,
    g_pens: (n) => `Hab ${n} Gehege`,
    star: 'Ziel geschafft! +1 Stern', sound: 'Ton',
    rotate: 'Verb Hatchery braucht einen breiteren Bildschirm. Dreh dein Gerät quer.',
    time_m: (n) => `${n} Min.`, time_h: (n) => `${n} Std.`,
  },
  es: {
    title: 'Verb Hatchery',
    tagline: 'Atrapa huevos de la cinta con la forma verbal correcta. ¡Haz nacer criaturas, gana monedas y haz crecer tu criadero!',
    play: 'Jugar', loading: 'Cargando …', newGame: 'Empezar de nuevo',
    confirmReset: '¿Seguro que quieres empezar de nuevo? Perderás todas las criaturas y monedas.',
    welcomeBack: '¡Bienvenido de nuevo!',
    awayEarned: (c, time) => `Mientras no estabas (${time}), tus criaturas ganaron <b>${c}</b> monedas.`,
    eggsReady: (n) => n === 1 ? '1 huevo está listo para abrirse.' : `${n} huevos están listos para abrirse.`,
    perSec: '/s', coins: 'monedas', stars: 'Estrellas',
    r_common: 'Común', r_uncommon: 'Poco común', r_rare: 'Raro', r_epic: 'Épico', r_legendary: 'Legendario',
    egg: (r) => `Huevo: ${r}`,
    cardOne: '¡Responde y el huevo es tuyo!',
    cardTwo: '¡Dos respuestas para este huevo!',
    step: (a, b) => `${a} / ${b}`,
    right: '¡Correcto!', wrong: '¡Uy!', eggRolled: 'El huevo se fue rodando. Este verbo volverá pronto.',
    goOn: 'Seguir', bonus: (n) => `+${n}`,
    incFull: '¡Incubadoras llenas! Abre primero un huevo.',
    incFullWaiting: '¡Incubadoras llenas! Compra un corral para la criatura que espera.',
    tapToHatch: '¡Toca!', waitingPen: 'Necesita corral',
    hatched: '¡Ha nacido!', isNew: '¡NUEVO!', earns: (n) => `gana ${n} monedas/s`,
    toPen: '¡Al corral!', waitsForPen: 'Todos los corrales están llenos. Espera en la incubadora hasta que compres un corral.',
    upgrades: 'Mejoras', book: 'Libro de criaturas', goals: 'Metas', close: 'Cerrar',
    up_pen: 'Corral extra', up_pen_d: 'Sitio para una criatura más',
    up_incubator: 'Incubadora extra', up_incubator_d: 'Un huevo más a la vez',
    up_hatchSpeed: 'Lámparas de calor', up_hatchSpeed_d: 'Los huevos se abren un 15 % más rápido',
    up_beltLuck: 'Cinta de la suerte', up_beltLuck_d: 'Huevos más raros con más frecuencia',
    level: (n) => `Nivel ${n}`, max: 'MÁX', buy: 'Comprar',
    bookFound: (a, b) => `${a} de ${b} encontradas`,
    bookChance: (n) => `cada una: 1 de ${n}`,
    bookHow: 'Los huevos más raros preguntan verbos más difíciles. Qué criatura nace de un huevo es al azar.',
    release: (n) => `Liberar (+${n})`, releaseAsk: 'La criatura vuelve a la naturaleza y recibes monedas.',
    penEmpty: 'Corral vacío',
    g_grab: (n) => `Atrapa ${n} huevos`, g_grabR: (n, r) => `Atrapa un huevo: ${r}`,
    g_hatch: (n) => n === 1 ? 'Haz nacer tu primera criatura' : `Haz nacer ${n} criaturas`,
    g_hatchR: (n, r) => `Haz nacer una criatura: ${r}`,
    g_upgrades: (n) => n === 1 ? 'Compra una mejora' : `Compra ${n} mejoras`,
    g_streak: (n) => `${n} correctas seguidas`,
    g_cps: (n) => `Gana ${n} monedas por segundo`,
    g_book: (n) => `Encuentra ${n} criaturas distintas`,
    g_pens: (n) => `Ten ${n} corrales`,
    star: '¡Meta cumplida! +1 estrella', sound: 'Sonido',
    rotate: 'Verb Hatchery necesita una pantalla más ancha. Gira tu dispositivo.',
    time_m: (n) => `${n} min`, time_h: (n) => `${n} h`,
  },
};

function pickLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && T[q]) return q;
  } catch (_) { /* ignore */ }
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return T[nav] ? nav : 'en';
}
export const lang = pickLang();
export function t(key, ...args) {
  const v = (T[lang] && T[lang][key]) ?? T.en[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}
document.documentElement.lang = lang;

// 1.2K, 45K, 3.1M … (the big numbers are part of the fun)
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  let u = 0, x = n;
  while (x >= 1000 && u < UNITS.length - 1) { x /= 1000; u++; }
  const s = x < 10 ? x.toFixed(1) : x < 100 ? x.toFixed(1) : x.toFixed(0);
  return s.replace(/\.0$/, '') + UNITS[u];
}
export function fmtRate(n) { return n < 10 && n % 1 ? n.toFixed(1) : fmt(n); }
export function fmtTime(sec) {
  if (sec < 3600) return t('time_m', Math.max(1, Math.round(sec / 60)));
  return t('time_h', Math.round(sec / 360) / 10);
}
