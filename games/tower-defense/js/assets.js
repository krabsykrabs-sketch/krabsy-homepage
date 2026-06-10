// Asset preloader. Loads the ToolPack images we need (map background, slime sprites,
// farmer body + clothing layers) before the game starts. Each tower picks a random
// outfit at construction; we preload a small curated subset of the farmer's available
// equipment so the layered renderer can composite them on the fly.

const FARMER_LAYER_DIRS = {
  body:  'Body',     // base
  pants: '04lwr1',   // longpants / shorts
  shirt: '05shrt',   // longshirt / shortshirt / tanktop
  hair:  '13hair',
  hat:   '14head',
};

// Curated palette — kid-friendly variants.
const FARMER_OPTIONS = {
  body:  ['human_00'],
  pants: ['longpants_00a', 'shorts_00a'],
  shirt: ['longshirt_00a', 'shortshirt_00a', 'tanktop_00a'],
  hair:  ['bob1_00', 'dapper_00', 'mohawk_00', 'ponytail1_00', 'spiky1_00', 'twintail_00',
          'afro_00', 'flattop_00', 'longwavy_00', 'twists_00'],
  hat:   ['cowboyhat_00d', 'strawhat_00d', 'floppyhat_00d', 'bandana_00b',
          'boaterhat_00d', 'headscarf_00b', null], // null → no hat
};

// Layer render order (back-to-front). Body first, hat last.
const FARMER_LAYER_ORDER = ['body', 'pants', 'shirt', 'hair', 'hat'];

const Assets = {
  images: Object.create(null),
  loaded: false,
  _promise: null,

  load() {
    if (this._promise) return this._promise;
    const tasks = [];

    tasks.push(this._loadInto('mapBg', 'ToolPack/map/background.png'));
    tasks.push(this._loadInto('slimeWalk', 'ToolPack/characters/Slippery_Slime_Green/walk.png'));
    tasks.push(this._loadInto('slimeDie',  'ToolPack/characters/Slippery_Slime_Green/die.png'));

    for (const slot of FARMER_LAYER_ORDER) {
      const dir = FARMER_LAYER_DIRS[slot];
      for (const option of FARMER_OPTIONS[slot]) {
        if (option === null) continue;
        const key = `farmer_${slot}_${option}`;
        const path = `ToolPack/characters/Mana_Seed_Farmer/equipment/${dir}/${option}.png`;
        tasks.push(this._loadInto(key, path));
      }
    }

    this._promise = Promise.all(tasks).then(() => { this.loaded = true; });
    return this._promise;
  },

  _loadInto(key, path) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => { this.images[key] = img; resolve(img); };
      img.onerror = () => {
        console.warn('[assets] failed to load', path);
        resolve(null);
      };
      img.src = path;
    });
  },

  // Pick a random outfit. Each entry is the option name (or null for "hat: none").
  randomOutfit() {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    return {
      body:  pick(FARMER_OPTIONS.body),
      pants: pick(FARMER_OPTIONS.pants),
      shirt: pick(FARMER_OPTIONS.shirt),
      hair:  pick(FARMER_OPTIONS.hair),
      hat:   pick(FARMER_OPTIONS.hat),
    };
  },

  farmerLayer(slot, option) {
    if (option === null) return null;
    return this.images[`farmer_${slot}_${option}`] || null;
  },
};
