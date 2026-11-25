// Krabsy figures: the catalogue (ids, groups, the free set, rarity, names). Pure data, no
// three.js, so the rewards (krabsy-rewards.js), the gift popup and games can use it without
// loading the 3D code. krabsy-figure.js re-exports everything here; edit the lists HERE.
// Concept: docs/figures-shells-world.md ("Rewards instead of a shop").

export const ASSET_BASE = '/assets/figures/';

// ------------------------------------------------------------------ catalogue
// The characters, in three groups. The Mage is the Quiz-Raum teacher's and not offered.
export const GROUPS = ['people', 'fantasy', 'monsters'];
export const CHARS = [
  ['Protagonist_A', 'people'], ['Protagonist_B', 'people'], ['Hiker', 'people'], ['Witch', 'people'],
  ['Superhero', 'people'], ['MagicalGirl', 'people'], ['Helper_A', 'people'], ['Helper_B', 'people'],
  ['Caveman', 'people'], ['Farmer_A', 'people'], ['Farmer_B', 'people'], ['Driver', 'people'],
  ['Survivalist', 'people'], ['Werewolf_Man', 'people'], ['Clown', 'people'], ['ToySoldier', 'people'],
  ['SpaceRanger', 'people'], ['Ninja', 'people'], ['Engineer', 'people'], ['Lorekeeper', 'people'],
  ['Knight', 'fantasy'], ['Paladin', 'fantasy'], ['Ranger', 'fantasy'], ['Rogue', 'fantasy'],
  ['Rogue_Hooded', 'fantasy'], ['Barbarian', 'fantasy'], ['Druid', 'fantasy'], ['Cleric', 'fantasy'],
  ['Vampire', 'fantasy'], ['Tiefling', 'fantasy'], ['PlantWarrior', 'fantasy'], ['AvianSwordsman', 'fantasy'],
  ['OrcRaider', 'monsters'], ['Werewolf_Wolf', 'monsters'], ['MonsterCostume', 'monsters'], ['Robot_One', 'monsters'],
  ['Robot_Two', 'monsters'], ['Skeleton_Minion', 'monsters'], ['Skeleton_Warrior', 'monsters'],
  ['Skeleton_Rogue', 'monsters'], ['Skeleton_Mage', 'monsters'], ['Necromancer', 'monsters'],
].map(([id, group]) => ({ id, group }));
export const CHAR_IDS = CHARS.map((c) => c.id);

// Characters whose head can't take another hat (cap or helmet built into the head, or a
// head shape hats don't fit). Checked with the contact sheet (tools/sheet.cjs hats).
export const NO_HAT = ['Protagonist_A', 'Protagonist_B', 'Robot_One', 'Robot_Two', 'MonsterCostume',
  'Werewolf_Wolf', 'SpaceRanger'];

// Accessories: [source character, part roles].
export const HATS = {
  cap: ['Hiker', ['hat']], witch: ['Witch', ['hat']], pointy: ['Helper_A', ['hat']], elf: ['Helper_B', ['hat']],
  bear: ['Barbarian', ['bearhat']], helmet: ['Knight', ['helmet']], clown: ['Clown', ['hat']],
  straw: ['Farmer_A', ['hat']], cowboy: ['Farmer_B', ['hat']], soldier: ['ToySoldier', ['hat']],
  wizard: ['Skeleton_Mage', ['hat']], headband: ['Ninja', ['headband']],
  space: ['SpaceRanger_FlightMode', ['helmet', 'helmet_visor']],
};
export const GLASSES = {
  square: ['Protagonist_A', ['glasses']], round: ['Witch', ['glasses']], reading: ['Lorekeeper', ['glasses']],
  sun: ['Driver', ['sunglasses']], goggles: ['Engineer', ['goggles']],
};
export const BACKS = {
  pack: ['Hiker', ['backpack']], packA: ['Protagonist_A', ['backpack']], packB: ['Protagonist_B', ['backpack']],
  satchel: ['Druid', ['backpack']], tools: ['Engineer', ['backpack']], books: ['Lorekeeper', ['backpack']],
  warpack: ['OrcRaider', ['warpack']], jetpack: ['SpaceRanger_FlightMode', ['jetpack', 'jetpack_wingleft', 'jetpack_wingright']],
  key: ['ToySoldier', ['windupkey']], wings: ['Vampire', ['wingleft', 'wingright']],
  cape: ['Superhero', ['cape']], capeKnight: ['Knight', ['cape']], capeRanger: ['Ranger', ['cape']],
  capeRogue: ['Rogue', ['cape']], capePaladin: ['Paladin', ['cape']],
};

// ------------------------------------------------------------------ free set + rarity
// 12 characters are free from the start, and so are all colours, each character's own
// accessories ('own') and 'none'. Everything else is a GIFT (owner decision 2026-11-25:
// rewards instead of a shop, krabsy-rewards.js). PRICES are the old shop prices; they are
// now only the RARITY of an entry (a higher number comes later and less often).
// Whatever is free stays free: never move an id from FREE_CHARS into PRICES.
export const FREE_CHARS = ['Protagonist_A', 'Protagonist_B', 'Hiker', 'Witch', 'Helper_A', 'Helper_B',
  'Knight', 'Rogue', 'Druid', 'OrcRaider', 'Skeleton_Minion', 'Robot_One'];
export const PRICES = {
  char: {
    Farmer_A: 150, Farmer_B: 150,
    Superhero: 200, Caveman: 200, Driver: 200, Survivalist: 200, Clown: 200, Engineer: 200, Lorekeeper: 200,
    Ranger: 200, Rogue_Hooded: 200, Cleric: 200,
    MagicalGirl: 250, Werewolf_Man: 250, ToySoldier: 250, Paladin: 250, Barbarian: 250,
    Skeleton_Warrior: 250, Skeleton_Rogue: 250,
    Ninja: 300, Vampire: 300, Tiefling: 300, Robot_Two: 300, Skeleton_Mage: 300,
    SpaceRanger: 350, PlantWarrior: 350, AvianSwordsman: 350, Werewolf_Wolf: 350,
    MonsterCostume: 400, Necromancer: 400,
  },
  hat: { cap: 40, straw: 40, pointy: 50, elf: 50, witch: 60, clown: 60, headband: 60, cowboy: 80,
    wizard: 90, bear: 100, helmet: 100, soldier: 100, space: 150 },
  glasses: { square: 40, round: 40, reading: 50, goggles: 70, sun: 80 },
  back: { pack: 40, packA: 40, packB: 40, satchel: 50, books: 60, tools: 70, key: 80, capeRanger: 80,
    capeRogue: 80, warpack: 90, capeKnight: 90, capePaladin: 90, cape: 120, jetpack: 150, wings: 150 },
};
export const SLOTS = ['char', 'hat', 'glasses', 'back'];
/** Price in shells of one catalogue entry (0 = free). slot: 'char' | 'hat' | 'glasses' | 'back'. */
export function priceOf(slot, id) {
  if (id === 'own' || id === 'none') return 0;
  if (slot === 'char' && FREE_CHARS.includes(id)) return 0;
  return (PRICES[slot] && Object.hasOwn(PRICES[slot], id)) ? PRICES[slot][id] : 0;
}
/** The id under which an owned entry is stored (krabsy_shells_v1.owned): "char:Ninja". */
export const unlockId = (slot, id) => `${slot}:${id}`;
export const ITEM_LISTS = { hat: HATS, glasses: GLASSES, back: BACKS };
/** Every entry a child can be given: ["char:Ninja", "hat:witch", …] (free characters are not in it). */
export const GIFT_IDS = SLOTS.flatMap((slot) => Object.keys(PRICES[slot]).map((id) => unlockId(slot, id)));
/** "hat:witch" → { slot: 'hat', key: 'witch' }, or null when it is not in the catalogue. */
export function parseId(id) {
  const m = typeof id === 'string' ? /^([a-z]+):([A-Za-z0-9_]{1,40})$/.exec(id) : null;
  if (!m || !SLOTS.includes(m[1])) return null;
  const known = m[1] === 'char' ? CHAR_IDS.includes(m[2]) : Object.hasOwn(ITEM_LISTS[m[1]], m[2]);
  return known ? { slot: m[1], key: m[2] } : null;
}
/** The character an accessory comes from (the Hiker's cap → 'Hiker'). */
export const sourceChar = (slot, key) => (ITEM_LISTS[slot] && ITEM_LISTS[slot][key] ? ITEM_LISTS[slot][key][0].replace(/_FlightMode$/, '') : null);
/** Picture of an entry: a character's portrait or the accessory's own picture (192 px WebP). */
export function itemImage(slot, key) {
  return slot === 'char' ? `${ASSET_BASE}portraits/${key}.webp` : `${ASSET_BASE}items/${slot}-${key}.webp`;
}

// ------------------------------------------------------------------ names (DE / ES / EN)
export const NAMES = {
  de: {
    chars: { Protagonist_A: 'Schülerin', Protagonist_B: 'Schüler', Hiker: 'Wanderer', Witch: 'Hexe', Superhero: 'Superheld',
      MagicalGirl: 'Zaubermädchen', Helper_A: 'Wichtel', Helper_B: 'Elf', Caveman: 'Steinzeitmensch', Farmer_A: 'Bauer',
      Farmer_B: 'Bäuerin', Driver: 'Rennfahrer', Survivalist: 'Abenteurer', Werewolf_Man: 'Werwolf (als Mensch)', Clown: 'Clown',
      ToySoldier: 'Spielzeugsoldat', SpaceRanger: 'Astronaut', Ninja: 'Ninja', Engineer: 'Tüftler', Lorekeeper: 'Gelehrter',
      Knight: 'Ritter', Paladin: 'Paladin', Ranger: 'Waldläufer', Rogue: 'Abenteurerin', Rogue_Hooded: 'Kapuzen-Abenteurerin',
      Barbarian: 'Barbar', Druid: 'Druidin', Cleric: 'Heiler', Vampire: 'Vampir', Tiefling: 'Teufelchen',
      PlantWarrior: 'Pflanzenwesen', AvianSwordsman: 'Vogelwesen', OrcRaider: 'Ork', Werewolf_Wolf: 'Werwolf',
      MonsterCostume: 'Dino-Kostüm', Robot_One: 'Roboter Eins', Robot_Two: 'Roboter Zwei', Skeleton_Minion: 'Skelett',
      Skeleton_Warrior: 'Skelett mit Helm', Skeleton_Rogue: 'Skelett mit Kapuze', Skeleton_Mage: 'Skelett-Zauberer', Necromancer: 'Nekromant' },
    hats: { cap: 'Wandermütze', witch: 'Hexenhut', pointy: 'Wichtelmütze', elf: 'Elfenmütze', bear: 'Bärenfell', helmet: 'Ritterhelm',
      clown: 'Clownshut', straw: 'Strohhut', cowboy: 'Cowboyhut', soldier: 'Soldatenhut', wizard: 'Zauberhut', headband: 'Stirnband', space: 'Raumhelm' },
    glassesN: { square: 'Eckige Brille', round: 'Runde Brille', reading: 'Lesebrille', sun: 'Sonnenbrille', goggles: 'Schutzbrille' },
    backs: { pack: 'Wanderrucksack', packA: 'Schulrucksack', packB: 'Sportrucksack', satchel: 'Kräutertasche', tools: 'Werkzeugrucksack',
      books: 'Bücherrucksack', warpack: 'Ork-Rucksack', jetpack: 'Jetpack', key: 'Aufziehschlüssel', wings: 'Flügel',
      cape: 'Heldenumhang', capeKnight: 'Ritterumhang', capeRanger: 'Waldläufer-Umhang', capeRogue: 'Abenteuer-Umhang', capePaladin: 'Paladin-Umhang' }
  },
  es: {
    chars: { Protagonist_A: 'Estudiante', Protagonist_B: 'Estudiante 2', Hiker: 'Excursionista', Witch: 'Bruja', Superhero: 'Superhéroe',
      MagicalGirl: 'Chica mágica', Helper_A: 'Duende', Helper_B: 'Elfo', Caveman: 'Cavernícola', Farmer_A: 'Granjero',
      Farmer_B: 'Granjera', Driver: 'Piloto', Survivalist: 'Aventurero', Werewolf_Man: 'Hombre lobo (humano)', Clown: 'Payaso',
      ToySoldier: 'Soldadito de juguete', SpaceRanger: 'Astronauta', Ninja: 'Ninja', Engineer: 'Inventor', Lorekeeper: 'Sabio',
      Knight: 'Caballero', Paladin: 'Paladín', Ranger: 'Explorador', Rogue: 'Aventurera', Rogue_Hooded: 'Aventurera con capucha',
      Barbarian: 'Bárbaro', Druid: 'Druida', Cleric: 'Sanador', Vampire: 'Vampiro', Tiefling: 'Diablillo',
      PlantWarrior: 'Ser planta', AvianSwordsman: 'Ser pájaro', OrcRaider: 'Orco', Werewolf_Wolf: 'Hombre lobo',
      MonsterCostume: 'Disfraz de dino', Robot_One: 'Robot uno', Robot_Two: 'Robot dos', Skeleton_Minion: 'Esqueleto',
      Skeleton_Warrior: 'Esqueleto con casco', Skeleton_Rogue: 'Esqueleto con capucha', Skeleton_Mage: 'Esqueleto mago', Necromancer: 'Nigromante' },
    hats: { cap: 'Gorro de excursión', witch: 'Sombrero de bruja', pointy: 'Gorro de duende', elf: 'Gorro de elfo', bear: 'Piel de oso',
      helmet: 'Casco', clown: 'Sombrero de payaso', straw: 'Sombrero de paja', cowboy: 'Sombrero vaquero', soldier: 'Gorro de soldado',
      wizard: 'Sombrero de mago', headband: 'Cinta', space: 'Casco espacial' },
    glassesN: { square: 'Gafas cuadradas', round: 'Gafas redondas', reading: 'Gafas de lectura', sun: 'Gafas de sol', goggles: 'Gafas protectoras' },
    backs: { pack: 'Mochila de excursión', packA: 'Mochila escolar', packB: 'Mochila deportiva', satchel: 'Bolsa de hierbas',
      tools: 'Mochila de herramientas', books: 'Mochila de libros', warpack: 'Mochila de orco', jetpack: 'Mochila cohete',
      key: 'Llave de cuerda', wings: 'Alas', cape: 'Capa de héroe', capeKnight: 'Capa de caballero', capeRanger: 'Capa de explorador',
      capeRogue: 'Capa de aventura', capePaladin: 'Capa de paladín' }
  },
  en: {
    chars: { Protagonist_A: 'Schoolgirl', Protagonist_B: 'Schoolboy', Hiker: 'Hiker', Witch: 'Witch', Superhero: 'Superhero',
      MagicalGirl: 'Magical girl', Helper_A: 'Gnome', Helper_B: 'Elf', Caveman: 'Caveman', Farmer_A: 'Farmer',
      Farmer_B: 'Rancher', Driver: 'Racing driver', Survivalist: 'Adventurer', Werewolf_Man: 'Werewolf (human)', Clown: 'Clown',
      ToySoldier: 'Toy soldier', SpaceRanger: 'Astronaut', Ninja: 'Ninja', Engineer: 'Inventor', Lorekeeper: 'Scholar',
      Knight: 'Knight', Paladin: 'Paladin', Ranger: 'Ranger', Rogue: 'Explorer', Rogue_Hooded: 'Hooded explorer',
      Barbarian: 'Barbarian', Druid: 'Druid', Cleric: 'Healer', Vampire: 'Vampire', Tiefling: 'Little devil',
      PlantWarrior: 'Plant creature', AvianSwordsman: 'Bird creature', OrcRaider: 'Orc', Werewolf_Wolf: 'Werewolf',
      MonsterCostume: 'Dino costume', Robot_One: 'Robot One', Robot_Two: 'Robot Two', Skeleton_Minion: 'Skeleton',
      Skeleton_Warrior: 'Skeleton with helmet', Skeleton_Rogue: 'Hooded skeleton', Skeleton_Mage: 'Skeleton wizard', Necromancer: 'Necromancer' },
    hats: { cap: 'Hiking cap', witch: 'Witch’s hat', pointy: 'Gnome hat', elf: 'Elf hat', bear: 'Bear fur', helmet: 'Knight’s helmet',
      clown: 'Clown hat', straw: 'Straw hat', cowboy: 'Cowboy hat', soldier: 'Soldier’s hat', wizard: 'Wizard’s hat', headband: 'Headband', space: 'Space helmet' },
    glassesN: { square: 'Square glasses', round: 'Round glasses', reading: 'Reading glasses', sun: 'Sunglasses', goggles: 'Goggles' },
    backs: { pack: 'Hiking backpack', packA: 'School backpack', packB: 'Sports backpack', satchel: 'Herb bag', tools: 'Tool backpack',
      books: 'Book backpack', warpack: 'Orc pack', jetpack: 'Jetpack', key: 'Wind-up key', wings: 'Wings',
      cape: 'Hero’s cape', capeKnight: 'Knight’s cape', capeRanger: 'Ranger’s cape', capeRogue: 'Explorer’s cape', capePaladin: 'Paladin’s cape' }
  },
};
const NAME_KEY = { char: 'chars', hat: 'hats', glasses: 'glassesN', back: 'backs' };
/** What a child reads for an entry: itemName('hat', 'witch', 'de') → "Hexenhut". */
export function itemName(slot, key, lang = 'de') {
  const t = NAMES[lang] || NAMES.de;
  return (t[NAME_KEY[slot]] && t[NAME_KEY[slot]][key]) || key;
}
