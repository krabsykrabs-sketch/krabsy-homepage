// Balance values, entity data, catalogues. Systems not yet built (waves, quiz, audio)
// intentionally omitted — each step layers in what it needs.

const CONFIG = {
  placementCellSize: 2,

  // Visual tuning. One tile = 1 world unit; pixel size is derived per-frame from viewport.
  // Path is 2 tiles wide, so enemies scale to roughly fill it (Grunt ~40%, Titan ~85%).
  enemyRadiusPerScale: 0.22, // world-unit radius = tier.scale * this
  projectileHitRadius: 0.3,  // spec baseline — enemy.radius is added on top per hit check

  colors: {
    ground:        '#4a7c2e',
    path:          '#c4a35a',
    water:         '#3a8fd4',
    obstacle:      '#2d5a1e',
    spawn:         '#c4a35a',
    goal:          '#c4a35a',
    spawnMarker:   '#ffe66d',
    goalMarker:    '#e63946',
    obstacleDot:   '#2d5a1e',
    gridLine:      'rgba(0,0,0,0.10)',

    // Placement overlay (spec: Placement Grid > Placement Overlay).
    overlayAvailable:   'rgba(40,40,40,0.28)',
    overlayUnavailable: 'rgba(220,50,50,0.30)',
    overlayCellLine:    'rgba(255,255,255,0.22)',
    ghostValid:         'rgba(120,220,120,0.55)',
    ghostInvalid:       'rgba(220,80,80,0.55)',

    towerSelectedRing: 'rgba(255,255,255,0.85)',
    rangeRing:         'rgba(255,255,255,0.12)',
    rangeRingBorder:   'rgba(255,255,255,0.45)',

    projectileBasic:         '#ffffff',
    projectileCircleShooter: '#ff6eb4',
    projectileCannon:        '#a06a30',
  },

  // ENEMY_TIERS — see spec "Enemy System". Thresholds are walked high→low; first match wins.
  enemyTiers: [
    { name: 'Grunt',   healthThreshold: 0,   scale: 1.8, speedMultiplier: 1.2, coinReward: 1, color: '#5bc14a' },
    { name: 'Soldier', healthThreshold: 50,  scale: 2.3, speedMultiplier: 1.0, coinReward: 1, color: '#3d7dd8' },
    { name: 'Warrior', healthThreshold: 100, scale: 2.8, speedMultiplier: 0.9, coinReward: 2, color: '#f2c94c' },
    { name: 'Brute',   healthThreshold: 200, scale: 3.3, speedMultiplier: 0.8, coinReward: 3, color: '#e25c4d' },
    { name: 'Titan',   healthThreshold: 400, scale: 3.8, speedMultiplier: 0.7, coinReward: 4, color: '#9b59d0' },
  ],

  // 3D version: bosses are big and unmistakable (boss waves contain only bosses).
  bossType: { name: 'Boss', scale: 3.2, speedMultiplier: 0.6, coinReward: 5, color: '#2a2333' },

  // TOWERS — full catalogue per spec "Tower System". Only `basic` fires in step 4;
  // the rest are placeable statues until step 5 wires up their firing logic.
  TOWERS: {
    basic: {
      name: 'Tower',
      cost: 20,
      range: 3.5,
      fireRate: 1.5,
      damage: 25,
      projectileSpeed: 10,
      type: 'basic',
      pierceMode: 'none',
      projectileRangeMultiplier: 1,
      color: '#3a6fd8',
      description: 'Reliable single-target shooter.',
      upgrades: [
        { tier: 1, cost: 30, description: 'Can hit two enemies',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'hitTwo', projectileRangeMultiplier: 1.5,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: false },
        { tier: 2, cost: 30, description: 'Can hit many enemies',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'infinite', projectileRangeMultiplier: 10,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: false },
      ],
    },

    circleShooter: {
      name: 'Circle Shooter',
      cost: 35,
      range: 5,
      fireRate: 0.5,
      damage: 15,
      projectileSpeed: 8,
      type: 'circleShooter',
      projectilesPerBurst: 12,
      pierceMode: 'none',
      projectileRangeMultiplier: 1,
      color: '#8e4fd8',
      description: 'Sprays shots in every direction.',
      upgrades: [
        { tier: 1, cost: 40, description: 'Shoots 50% faster',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1.5,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: false },
        { tier: 2, cost: 50, description: '50% more damage',
          damageMultiplier: 1.5, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: false },
      ],
    },

    cannon: {
      name: 'Cannon',
      cost: 50,
      range: 3.5,
      fireRate: 0.3,
      damage: 60,
      projectileSpeed: 10,
      type: 'cannon',
      aoeRadius: 1.5,
      pierceMode: 'none',
      projectileRangeMultiplier: 1,
      color: '#8a5a2b',
      description: 'Slow but mighty splash damage.',
      upgrades: [
        { tier: 1, cost: 45, description: 'Bigger boom',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1.5, freezeDurationMultiplier: 1, permanentSlow: false },
        { tier: 2, cost: 55, description: 'Faster shooting',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1.5,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: false },
      ],
    },

    freeze: {
      name: 'Freeze Tower',
      cost: 40,
      range: 4,
      fireRate: 0,
      damage: 0,
      type: 'freeze',
      freezeDuration: 2,
      freezeCooldown: 4,
      freezeRange: 4,
      color: '#6cc3d8',
      description: 'Chills every enemy in range.',
      upgrades: [
        { tier: 1, cost: 35, description: 'Deep freeze',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1.3, permanentSlow: false },
        { tier: 2, cost: 55, description: 'Slows permanently.',
          damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
          pierceUpgrade: 'none', projectileRangeMultiplier: 1,
          aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1, permanentSlow: true },
      ],
    },
  },
};

// Order for keyboard 1-4 and button display.
const TOWER_ORDER = ['basic', 'circleShooter', 'cannon', 'freeze'];

// Pierce ordering for the upgrade system — spec: "Pierce only upgrades, never downgrades."
const PIERCE_ORDER = { none: 0, hitTwo: 1, infinite: 2 };

function getTierForHealth(hp) {
  const tiers = CONFIG.enemyTiers;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (tiers[i].healthThreshold <= hp) return tiers[i];
  }
  return tiers[0];
}

// Irregular-verb catalogue for the quiz (step 10). Each entry has the base verb,
// simple past (`past`), past participle (`pp`), and three plausible wrongs for each
// form (`pw` for simple-past distractors, `ppw` for past-participle distractors).
const VERBS = [
  { verb: "go",     past: "went",    pp: "gone",      pw: ["goed","wented","goeded"],        ppw: ["goned","wented","goden"] },
  { verb: "run",    past: "ran",     pp: "run",       pw: ["runned","ranned","runed"],       ppw: ["runned","ranned","runed"] },
  { verb: "eat",    past: "ate",     pp: "eaten",     pw: ["eated","ated","eatted"],         ppw: ["eated","aten","ated"] },
  { verb: "swim",   past: "swam",    pp: "swum",      pw: ["swimmed","swimd","swammed"],     ppw: ["swimmed","swammed","swimd"] },
  { verb: "fly",    past: "flew",    pp: "flown",     pw: ["flied","flyed","flewed"],        ppw: ["flied","flyed","flewed"] },
  { verb: "see",    past: "saw",     pp: "seen",      pw: ["seed","sawed","seeed"],          ppw: ["seed","sawed","seened"] },
  { verb: "write",  past: "wrote",   pp: "written",   pw: ["writed","wroted","writeed"],     ppw: ["writed","wroten","writeed"] },
  { verb: "sing",   past: "sang",    pp: "sung",      pw: ["singed","sanged","singged"],     ppw: ["singed","sanged","singged"] },
  { verb: "drive",  past: "drove",   pp: "driven",    pw: ["drived","droved","driveed"],     ppw: ["drived","droved","driveen"] },
  { verb: "break",  past: "broke",   pp: "broken",    pw: ["breaked","broked","breakd"],     ppw: ["breaked","broked","breakd"] },
  { verb: "take",   past: "took",    pp: "taken",     pw: ["taked","tooked","takeed"],       ppw: ["taked","tooked","takeed"] },
  { verb: "give",   past: "gave",    pp: "given",     pw: ["gived","giveed","gaved"],        ppw: ["gived","giveed","gaved"] },
  { verb: "know",   past: "knew",    pp: "known",     pw: ["knowed","knewed","knowd"],       ppw: ["knowed","knewed","knowd"] },
  { verb: "come",   past: "came",    pp: "come",      pw: ["comed","camed","comeed"],        ppw: ["comed","camed","comen"] },
  { verb: "think",  past: "thought", pp: "thought",   pw: ["thinked","thinkd","thinkted"],   ppw: ["thinked","thinkd","thinkted"] },
  { verb: "buy",    past: "bought",  pp: "bought",    pw: ["buyed","buyd","buyted"],         ppw: ["buyed","buyd","buyted"] },
  { verb: "make",   past: "made",    pp: "made",      pw: ["maked","maded","makeed"],        ppw: ["maked","maded","makeed"] },
  { verb: "find",   past: "found",   pp: "found",     pw: ["finded","findeed","findd"],      ppw: ["finded","findeed","findd"] },
  { verb: "tell",   past: "told",    pp: "told",      pw: ["telled","telld","telleed"],      ppw: ["telled","telld","telleed"] },
  { verb: "drink",  past: "drank",   pp: "drunk",     pw: ["drinked","drinkd","dranked"],    ppw: ["drinked","dranked","drunkd"] },
  { verb: "begin",  past: "began",   pp: "begun",     pw: ["beginned","begined","beganned"], ppw: ["beginned","begined","begonned"] },
  { verb: "speak",  past: "spoke",   pp: "spoken",    pw: ["speaked","spoked","speakd"],     ppw: ["speaked","spoked","speakened"] },
  { verb: "fall",   past: "fell",    pp: "fallen",    pw: ["falled","felled","falld"],       ppw: ["falled","felled","falld"] },
  { verb: "grow",   past: "grew",    pp: "grown",     pw: ["growed","grewed","growd"],       ppw: ["growed","grewed","growd"] },
  { verb: "throw",  past: "threw",   pp: "thrown",    pw: ["throwed","threwed","throwd"],    ppw: ["throwed","threwed","throwd"] },
  { verb: "wear",   past: "wore",    pp: "worn",      pw: ["weared","wored","weard"],        ppw: ["weared","wored","weard"] },
  { verb: "ride",   past: "rode",    pp: "ridden",    pw: ["rided","roded","rideed"],        ppw: ["rided","roded","rideed"] },
  { verb: "choose", past: "chose",   pp: "chosen",    pw: ["choosed","chosed","chooseed"],   ppw: ["choosed","chosed","chooseed"] },
  { verb: "forget", past: "forgot",  pp: "forgotten", pw: ["forgetted","forgoted","forgetd"], ppw: ["forgetted","forgoted","forgetd"] },
  { verb: "draw",   past: "drew",    pp: "drawn",     pw: ["drawed","drewed","drawd"],       ppw: ["drawed","drewed","drawd"] },
];
