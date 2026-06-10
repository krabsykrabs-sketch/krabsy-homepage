# Tower Defense HTML5 — Technical Brief for Claude Code

## Purpose

Build an HTML5 tower defense game from scratch. This is a complete specification — implement exactly what is described here. The game will be deployed on einmaleins.de and krabsy.com as a static site (HTML/CSS/JS, no framework, no build step). The game targets children aged 10-14 learning English irregular verbs.

This document contains everything: architecture, all game systems, all balance values, all formulas, UI layout, quiz mechanics, and asset pipeline. Read the entire document before writing any code.

---

## Architecture

### Tech Stack
- Plain HTML5 Canvas for game rendering (enemies, towers, projectiles, effects, tiles)
- HTML/CSS overlay for UI (HUD, tower panel, quiz panel, menus)
- Vanilla JavaScript, no framework
- No build step — runs directly in browser
- Single `index.html` entry point that loads modular JS files

### Project Structure
```
/td-game/
  index.html              — entry point, loads everything
  css/
    game.css              — all UI styling
  js/
    main.js               — initialization, game loop, state management
    config.js             — all balance values, tower data, enemy data, verb catalogue
    renderer.js           — canvas rendering, camera, tile drawing
    input.js              — mouse + touch input handling
    grid.js               — tilemap, placement grid, pathfinding data
    enemy.js              — enemy spawning, movement, tiers, status effects, death
    tower.js              — tower placement, targeting, firing, upgrades, selling
    projectile.js         — projectile movement, homing, AoE, pierce, hit detection
    wave.js               — wave system, scaling, boss waves, spawn timing
    quiz.js               — quiz UI, verb chain format, answer checking, coin rewards
    effects.js            — particles, explosions, freeze bursts, flying coins, screen flash
    ui.js                 — HUD updates, bottom panel, tower info, menus
    level.js              — level loading from JSON, level select
    audio.js              — sound effects and music (stub for now)
  assets/
    sprites/              — all sprite sheets (placeholder for now)
    levels/               — level JSON files
    audio/                — sound files (future)
  levels/
    level1.json           — level data (tile grid + paths + metadata)
```

### Game Loop
Use `requestAnimationFrame` with delta time. Variable timestep, capped at 50ms (20fps minimum) to prevent physics explosions on tab-switch.

```
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}
```

### Coordinate System
- The game world uses a tile grid. One tile = 1 world unit.
- Canvas renders the world scaled to fit the viewport.
- All game logic operates in world units. Only the renderer converts to pixels.
- Target aspect ratio: 16:9 landscape. The canvas scales to fill the browser window while maintaining aspect ratio (letterbox if needed).

### Entity Management
Do NOT use `querySelectorAll` or DOM queries for game entities. Maintain arrays:
```
state.enemies = [];      // all active enemies
state.towers = [];       // all placed towers
state.projectiles = [];  // all active projectiles
state.effects = [];      // all visual effects (particles, explosions, etc.)
```

Remove dead entities by filtering arrays each frame. Towers scan `state.enemies` directly — no DOM queries.

---

## Game Phases

Enum: `BUILD`, `BATTLE`, `WAVE_COMPLETE`, `QUIZ`, `GAME_OVER`, `VICTORY`

### Phase Transitions
| From | Trigger | To |
|------|---------|-----|
| BUILD | Player clicks "Start Wave" or presses Space | BATTLE |
| BATTLE | All enemies in wave killed or leaked, spawning complete | WAVE_COMPLETE |
| WAVE_COMPLETE | Player dismisses wave complete overlay (after ~2s auto-dismiss or click) | QUIZ |
| QUIZ | Both quiz questions answered | BUILD (next wave) |
| QUIZ | Both quiz questions answered AND this was the final wave | VICTORY |
| Any | lives <= 0 | GAME_OVER |

### Initialization (on level start)
```
currentLives = level.startingLives       // default 10
currentCoins = level.startingCoins       // default 60
currentWave = 0
phase = BUILD
```

### Keyboard Shortcuts
- **Space**: start wave (BUILD phase only)
- **1-4**: select tower type for placement
- **Escape**: cancel placement mode
- **Delete/Backspace**: sell selected tower

---

## Tile Grid & Level Format

### Grid Structure
Each level is a 2D grid of tiles. Each tile has a type:
- `ground` — valid for tower placement
- `path` — enemies walk on this, no tower placement
- `water` — decoration, no placement, no walking
- `obstacle` — decoration (trees, rocks), no placement
- `spawn` — enemy entry point (also path)
- `goal` — enemy exit point (also path)

### Level JSON Format
```json
{
  "name": "Level 1",
  "gridWidth": 30,
  "gridHeight": 18,
  "tiles": [[0,0,0,1,1,0,...], ...],
  "tileKey": { "0": "ground", "1": "path", "2": "water", "3": "obstacle", "4": "spawn", "5": "goal" },
  "paths": [
    {
      "spawnWeight": 1,
      "waypoints": [
        [0, 5], [8, 5], [8, 12], [20, 12], [20, 5], [29, 5]
      ]
    }
  ],
  "startingLives": 10,
  "startingCoins": 60,
  "totalWaves": 20,
  "enemyScaling": {
    "baseEnemyHealth": 30,
    "healthPerWave": 15,
    "baseEnemyCount": 5,
    "enemiesPerWave": 1.5,
    "baseEnemySpeed": 2
  },
  "economy": {
    "baseCoinsPerKill": 1,
    "waveCompletionBonus": 10
  },
  "quiz": {
    "questionsPerWave": 2,
    "coinsPerCorrectAnswer": 5
  }
}
```

### Placement Grid
Towers occupy a 3×3 block of underlying tiles. The placement grid divides the tilemap into coarser cells of `placementCellSize × placementCellSize` tiles (default 3).

**Pre-compute on level load:**
- Divide tilemap into 3×3 cells, aligned to tilemap origin.
- A cell is **structurally valid** if ALL 9 underlying tiles are `ground` (not path, water, obstacle, spawn, goal, or out of bounds).
- Track **occupied cells** separately (updated when towers are placed/sold).
- A cell is **available** = structurally valid AND not occupied.

**Coordinate conversions:**
```
worldToPlacementCell(worldX, worldY):
  tileX = floor(worldX)
  tileY = floor(worldY)
  cellX = floor(tileX / placementCellSize)
  cellY = floor(tileY / placementCellSize)
  return {cellX, cellY}

placementCellToWorld(cellX, cellY):
  centerX = (cellX * placementCellSize) + placementCellSize / 2
  centerY = (cellY * placementCellSize) + placementCellSize / 2
  return {centerX, centerY}
```

### Placement Overlay
When in placement mode:
- Show a grid overlay on the entire map.
- **Gray semi-transparent** overlay on available cells (valid and unoccupied).
- **Red semi-transparent** overlay on unavailable cells (structurally invalid OR occupied).
- Thin grid lines outline every placement cell.
- Overlay is visible on both PC and mobile.

---

## Tower System

### Tower Types and Base Stats

```javascript
const TOWERS = {
  basic: {
    name: "Tower",
    cost: 20,
    range: 2,
    fireRate: 1.5,        // shots per second
    damage: 25,
    projectileSpeed: 10,
    type: "basic",
    pierceMode: "none",   // "none", "hitTwo", "infinite"
    projectileRangeMultiplier: 1,
    description: "A basic tower.",
    upgrades: [
      {
        tier: 1, cost: 30,
        description: "Can hit two enemies",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "hitTwo",
        projectileRangeMultiplier: 1.5,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: false
      },
      {
        tier: 2, cost: 30,
        description: "Can hit many enemies",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "infinite",
        projectileRangeMultiplier: 10,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: false
      }
    ]
  },

  circleShooter: {
    name: "Circle Shooter",
    cost: 35,
    range: 3,
    fireRate: 0.5,
    damage: 15,
    projectileSpeed: 8,
    type: "circleShooter",
    projectilesPerBurst: 12,
    pierceMode: "none",
    projectileRangeMultiplier: 1,
    description: "A circle shooter.",
    upgrades: [
      {
        tier: 1, cost: 40,
        description: "Shoots 50% faster",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1.5,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: false
      },
      {
        tier: 2, cost: 50,
        description: "50% more damage",
        damageMultiplier: 1.5, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: false
      }
    ]
  },

  cannon: {
    name: "Cannon",
    cost: 50,
    range: 2,
    fireRate: 0.3,
    damage: 60,
    projectileSpeed: 10,
    type: "cannon",
    aoeRadius: 1.5,
    pierceMode: "none",
    projectileRangeMultiplier: 1,
    description: "A mortar.",
    upgrades: [
      {
        tier: 1, cost: 45,
        description: "Bigger boom",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1.5, freezeDurationMultiplier: 1,
        permanentSlow: false
      },
      {
        tier: 2, cost: 55,
        description: "Faster shooting",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1.5,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: false
      }
    ]
  },

  freeze: {
    name: "Freeze Tower",
    cost: 40,
    range: 2.5,
    fireRate: 0,          // not used — freeze has its own timing
    damage: 0,            // does no damage
    type: "freeze",
    freezeDuration: 2,    // seconds
    freezeCooldown: 4,    // seconds between pulses
    freezeRange: 2.5,     // overrides range
    description: "A freeze tower.",
    upgrades: [
      {
        tier: 1, cost: 35,
        description: "Deep freeze",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1.3,
        permanentSlow: false
      },
      {
        tier: 2, cost: 55,
        description: "Slows permanently.",
        damageMultiplier: 1, rangeMultiplier: 1, fireRateMultiplier: 1,
        pierceUpgrade: "none", projectileRangeMultiplier: 1,
        aoeRadiusMultiplier: 1, freezeDurationMultiplier: 1,
        permanentSlow: true
      }
    ]
  }
};
```

### Tower Placement Flow
1. Player clicks/taps a tower button → enter placement mode. Block if can't afford.
2. Show placement overlay (gray/red grid — see Placement Grid section).
3. **PC**: ghost tower follows mouse, snapped to placement cell center. Green tint on valid cells, red on invalid.
4. **Mobile**: no ghost follows (no hover). Player taps a cell directly.
5. Click/tap valid cell → spend coins, place tower at cell center, mark cell occupied, exit placement mode.
6. Click/tap invalid cell → nothing happens, stay in placement mode.
7. Right-click / Escape / tap same button again → cancel placement.
8. Click different tower button → switch to that tower's placement mode.

### Tower Targeting (all non-freeze towers)
Every frame:
1. If `currentTarget` is dead or out of range → clear it.
2. Scan `state.enemies` — find the **closest living enemy within range** (euclidean distance).
3. No target leading — fire at the target's current position at fire time.

### Tower Firing
- Maintain `fireCooldown` per tower. Each frame: `fireCooldown -= dt`.
- When `fireCooldown <= 0` and `currentTarget != null`: fire, reset `fireCooldown = 1 / fireRate`.

**Basic Tower**: fires one homing projectile at the current target.

**Circle Shooter**: fires `projectilesPerBurst` (12) non-homing projectiles at evenly-spaced angles (30° apart). Still needs a target in range to decide whether to fire, but projectiles go in all directions. Does NOT rotate toward target.

**Cannon/Mortar**: snapshots `targetPosition` at fire time. Fires one AoE projectile toward that position. Projectile does NOT home — flies to the snapshot position even if target moves or dies.

**Freeze Tower** — separate update loop, no projectiles:
1. Maintain `freezeReady` (bool) and `freezeTimer` (float).
2. Start with `freezeReady = true`.
3. When `freezeReady && any non-frozen enemy within range`:
   - `freezeReady = false`, `freezeTimer = freezeCooldown`
   - Spawn freeze burst visual (expanding ring, 0.25s)
   - After 0.15s delay: freeze ALL living non-frozen enemies within range for `freezeDuration` seconds
4. When `!freezeReady`: `freezeTimer -= dt`; at <= 0: `freezeReady = true`
5. Skip enemies that are already frozen when deciding whether to pulse.

### Tower Rotation
Non-CircleShooter, non-Freeze towers rotate to face their current target. The rotation angle points the tower's "forward" direction at the target.

### Upgrade System
- Max 2 upgrades per tower (`upgradeLevel` 0 → 1 → 2).
- Upgrades apply multiplicatively to base stats:
```
damage *= upgrade.damageMultiplier
range *= upgrade.rangeMultiplier
fireRate *= upgrade.fireRateMultiplier
if upgrade.pierceUpgrade > current: pierceMode = upgrade.pierceUpgrade
projectileRangeMultiplier *= upgrade.projectileRangeMultiplier
aoeRadius *= upgrade.aoeRadiusMultiplier
freezeDuration *= upgrade.freezeDurationMultiplier
if upgrade.permanentSlow: permanentSlow = true
totalInvested += upgrade.cost
upgradeLevel++
```
- Pierce only upgrades, never downgrades.

### Selling
```
sellValue = floor(totalInvested * 0.5)
```
`totalInvested` = base cost + all upgrade costs paid. Selling frees the placement cell and adds coins.

---

## Projectile System

### Directional Projectiles (Basic, CircleShooter)

**Movement:**
- If homing and target alive: each frame `direction = normalize(target.position - position)`.
- If target dies: direction freezes at last value, continues in straight line.
- `position += direction * speed * dt`

**Hit Detection:**
- Each frame, check all enemies. Hit any enemy within `hitRadius = 0.3` world units that hasn't already been hit by this projectile.
- Maintain a `hitEnemies` set per projectile.

**On Hit:**
- Apply damage to enemy.
- Add enemy to `hitEnemies`.
- On first hit: stop homing, reset `startPosition = currentPosition` (so piercing projectiles get full range from hit point, not fire point).

**Destruction:**
- `none` pierce: destroy after 1 hit.
- `hitTwo`: destroy after 2 hits.
- `infinite`: never destroyed by hits.
- All projectiles destroyed if `distance(position, startPosition) >= maxDistance` where `maxDistance = range * projectileRangeMultiplier`.
- All projectiles destroyed if `lifetime >= 5` seconds.

### AoE Projectiles (Cannon/Mortar)

**Movement:**
- Fly toward `targetPosition` in a straight line. Never homes — direction never updates.
- When within 0.3 units of `targetPosition`: explode.

**Explosion:**
- For every enemy: if `distance(explosion, enemy) <= aoeRadius`, apply damage with linear falloff:
```
falloff = 1 - (distance / aoeRadius) * 0.5
```
- 100% damage at center, 50% at edge (NOT 0% at edge).
- Spawn explosion visual effect (expanding ring, 0.3s, yellow-orange).
- Destroy projectile.

### Projectile Rotation
All projectiles rotate so their forward axis points in their travel direction.

---

## Enemy System

### Enemy Tiers

```javascript
const ENEMY_TIERS = [
  { name: "Grunt",   healthThreshold: 0,   scale: 1.8, speedMultiplier: 1.2, coinReward: 1 },
  { name: "Soldier", healthThreshold: 50,  scale: 2.3, speedMultiplier: 1.0, coinReward: 1 },
  { name: "Warrior", healthThreshold: 100, scale: 2.8, speedMultiplier: 0.9, coinReward: 2 },
  { name: "Brute",   healthThreshold: 200, scale: 3.3, speedMultiplier: 0.8, coinReward: 3 },
  { name: "Titan",   healthThreshold: 400, scale: 3.8, speedMultiplier: 0.7, coinReward: 4 }
];

const BOSS_TYPE = { name: "Boss", scale: 2.0, speedMultiplier: 0.6, coinReward: 5 };
```

**Tier assignment**: `getTierForHealth(hp)` — walk tiers from highest threshold to lowest. Return first tier where `tier.healthThreshold <= hp`. Fallback to Grunt (index 0).

### Enemy Initialization
```
maxHealth = currentHealth = assignedHealth
baseSpeed = waveSpeed                           // raw wave speed before tier modifier
moveSpeed = baseMoveSpeed = baseSpeed * tier.speedMultiplier
scale = tier.scale
coinReward = tier.coinReward
```

### Enemy Movement
Each frame (when not frozen and not dying):
```
target = waypoints[currentWaypointIndex]
direction = normalize(target - position)
position += direction * moveSpeed * dt
if distance(position, target) < 0.1:
    currentWaypointIndex++
    if currentWaypointIndex >= waypoints.length:
        reachEnd()
```
No curve smoothing — enemies turn instantly at waypoints.

**Directional animation**: track `direction` vector for sprite animation. The direction determines which walk cycle to play (down, up, left, right) based on the dominant axis.

### Status Effects: Freeze
**ApplyFreeze(duration, applyPermanentSlow):**
- `isFrozen = true`, `freezeTimer = duration`
- Tint color: `rgba(128, 204, 255, 1)` (light blue)
- Animation speed = 0 (frozen pose)
- If `applyPermanentSlow`: `isPermanentlySlowed = true`, `permanentSlowMultiplier = 0.5`

**Each frame while frozen:**
- `freezeTimer -= dt`
- When `freezeTimer <= 0`: unfreeze

**Unfreeze:**
- `isFrozen = false`
- If permanently slowed: `moveSpeed = baseMoveSpeed * 0.5`, tint 30% toward freeze blue
- If not slowed: restore original color, animation speed = 1
- If permanently slowed: animation speed = 0.5

**While frozen**: enemy does NOT move. Towers can still damage it. Freeze towers skip already-frozen enemies.

### Taking Damage
```
enemy.takeDamage(amount):
    if !isAlive or isDying: return
    currentHealth -= amount
    flash red for 0.1 seconds (damage tint)
    if currentHealth <= 0: die()
    else if !isBoss: checkTierTransformation()
```

### Tier Transformation (Downgrade)
Triggered when damage drops health below current tier's threshold.

```
newTier = getTierForHealth(currentHealth)
if newTier.healthThreshold < currentTier.healthThreshold:
    // Award coin difference
    coinDiff = currentTier.coinReward - newTier.coinReward
    if coinDiff > 0: addCoins(coinDiff)  // awarded immediately
    
    // Spawn visual effect (poof cloud)
    spawnPoofEffect(position)
    
    // Update stats in place
    currentTier = newTier
    baseMoveSpeed = baseSpeed * newTier.speedMultiplier
    if isPermanentlySlowed: moveSpeed = baseMoveSpeed * permanentSlowMultiplier
    else: moveSpeed = baseMoveSpeed
    coinReward = newTier.coinReward
    scale = newTier.scale
    
    // Clear freeze on transformation
    unfreeze()
    
    // Brief stun: enemy pauses for 0.3 seconds after transformation
    stunTimer = 0.3
```

**Key rules:**
- Exactly ONE new enemy replaces old (no splitting).
- Health is NOT reset — carries over.
- Inherits `baseSpeed` (wave speed). Effective speed = `baseSpeed × newTier.speedMultiplier`.
- Inherits permanent slow status.
- Does NOT inherit frozen state — always spawns unfrozen.
- Continues at same path waypoint index.
- Bosses NEVER tier-transform.

### Death
```
enemy.die():
    if !isAlive or isDying: return
    isAlive = false
    // Play death animation if available (delay removal by animation length)
    // Award kill coins via flying coin effect
    // Remove from state.enemies after animation
```

### Reaching the End
```
enemy.reachEnd():
    isAlive = false
    loseLife(1)    // always 1 life per enemy regardless of tier
    // Remove from state.enemies immediately (no death animation)
```

### Boss Specifics
- Bosses appear every 5 waves (wave 5, 10, 15, 20).
- Boss health = wave base health (no variation).
- Bosses never tier-transform.
- Display a health bar above the boss (horizontal, always horizontal regardless of rotation).
- Health bar colors: green → yellow → red as HP drops.
- `speedMultiplier: 0.6`, `coinReward: 5`.

### Per-Enemy Health Variation (non-boss)
Each normal enemy's health is randomized:
```
enemyHealth = random(waveBaseHP * 0.5, waveBaseHP * 1.5)
```
`healthVariation = 0.5` is the range factor.

---

## Wave System

### Formulas
```
enemyCount    = baseEnemyCount + floor((waveN - 1) * enemiesPerWave)
waveBaseHP    = baseEnemyHealth + (waveN - 1) * healthPerWave
enemySpeed    = baseEnemySpeed + (waveN - 1) * 0.05
spawnInterval = max(0.3, 1 - (waveN - 1) * 0.03)    // seconds between spawns
```

Default values: `baseEnemyHealth=30, healthPerWave=15, baseEnemyCount=5, enemiesPerWave=1.5, baseEnemySpeed=2, totalWaves=20`.

### Boss Waves
`isBossWave(waveN)`: `waveN % 5 === 0` → waves 5, 10, 15, 20.

On boss waves, spawn regular enemies AND one boss. Boss health = `waveBaseHP` (no variation).

### Spawn Loop
1. Set `waveInProgress = true`, `isSpawning = true`.
2. For each enemy (0 to enemyCount-1):
   - Pick path: weighted random across all paths based on `spawnWeight`.
   - Compute health: boss = `waveBaseHP`, normal = `random(waveBaseHP * 0.5, waveBaseHP * 1.5)`.
   - Determine tier from health via `getTierForHealth()`.
   - Spawn at path's first waypoint.
   - Initialize with health, speed, path, tier.
   - Wait `spawnInterval` seconds before next spawn (no delay after last).
3. Set `isSpawning = false`.

### Wave Completion
Check every frame: if `!isSpawning && enemiesAlive <= 0 && waveInProgress`:
- `waveInProgress = false`
- Show wave complete overlay (wave number + bonus coins)
- Award wave completion bonus coins
- After overlay dismissed → start quiz

### Multiple Paths
- A level can have multiple paths, each with `spawnWeight`.
- Each spawning enemy picks a path independently: probability = `path.spawnWeight / totalWeight`.
- Enemy is assigned a path at spawn and never switches.

---

## Coin Economy

### Sources
| Source | Amount | Timing |
|--------|--------|--------|
| Enemy kill | Current tier's `coinReward` (1-5) | Flying coin animation, coins added on arrival |
| Wave completion | `waveCompletionBonus` (default 10) | After wave complete overlay |
| Quiz correct answer | `coinsPerCorrectAnswer` (default 5) per correct question | Flying coin animation |
| Tier transformation | `oldTier.coinReward - newTier.coinReward` | Immediately on transformation |

### Sinks
| Sink | Amount |
|------|--------|
| Tower placement | Tower's base cost |
| Tower upgrade | Upgrade's cost |

### Flying Coin Effect
When coins are earned (kill, quiz), spawn small coin icons that fly from the source position to the coin counter in the HUD. Coins are added to the total when the first coin in the batch arrives at the counter. This creates a satisfying visual delay.

For tier transformation coins: add immediately (no flying coin delay).

---

## Quiz System

### Format: Complete the Chain (two-stage)
Between every wave, the player answers 2 questions about the SAME verb.

**Flow:**
1. Pick a random verb from the catalogue.
2. **Question 1** — ask for Simple Past:
   - Display: `verb → ??? → ___`
   - The past participle slot shows `___` (hidden, not a hint)
   - Show 3 answer buttons: the correct simple past + 2 wrong answers
   - Correct → fill in the simple past, award `coinsPerCorrectAnswer` coins
   - Wrong → briefly show correct answer highlighted, no coins, move on
3. **Question 2** — ask for Past Participle:
   - Display: `verb → pastForm → ???`
   - The simple past is now visible (whether they got Q1 right or wrong — always show the correct form)
   - Show 3 answer buttons: the correct past participle + 2 wrong answers
   - Correct → fill in the past participle, award `coinsPerCorrectAnswer` coins
   - Wrong → briefly show correct answer, no coins
4. Brief celebration if both correct (chain complete visual).
5. Return to BUILD phase (or VICTORY if final wave).

**Wrong answer feedback duration**: 1.5 seconds. Show the correct answer highlighted green, wrong answer highlighted red. Then auto-advance.

**Correct answer feedback duration**: 1.0 seconds. Highlight green, spawn flying coins, then advance.

### Verb Catalogue
```javascript
const VERBS = [
  { verb: "go",     past: "went",    pp: "gone",    pw: ["goed","wented","goeded"],     ppw: ["goned","wented","goden"] },
  { verb: "run",    past: "ran",     pp: "run",     pw: ["runned","ranned","runed"],     ppw: ["runned","ranned","runed"] },
  { verb: "eat",    past: "ate",     pp: "eaten",   pw: ["eated","ated","eatted"],       ppw: ["eated","aten","ated"] },
  { verb: "swim",   past: "swam",    pp: "swum",    pw: ["swimmed","swimd","swammed"],   ppw: ["swimmed","swammed","swimd"] },
  { verb: "fly",    past: "flew",    pp: "flown",   pw: ["flied","flyed","flewed"],      ppw: ["flied","flyed","flewed"] },
  { verb: "see",    past: "saw",     pp: "seen",    pw: ["seed","sawed","seeed"],        ppw: ["seed","sawed","seened"] },
  { verb: "write",  past: "wrote",   pp: "written", pw: ["writed","wroted","writeed"],   ppw: ["writed","wroten","writeed"] },
  { verb: "sing",   past: "sang",    pp: "sung",    pw: ["singed","sanged","singged"],   ppw: ["singed","sanged","singged"] },
  { verb: "drive",  past: "drove",   pp: "driven",  pw: ["drived","droved","driveed"],   ppw: ["drived","droved","driveen"] },
  { verb: "break",  past: "broke",   pp: "broken",  pw: ["breaked","broked","breakd"],   ppw: ["breaked","broked","breakd"] },
  { verb: "take",   past: "took",    pp: "taken",   pw: ["taked","tooked","takeed"],     ppw: ["taked","tooked","takeed"] },
  { verb: "give",   past: "gave",    pp: "given",   pw: ["gived","giveed","gaved"],      ppw: ["gived","giveed","gaved"] },
  { verb: "know",   past: "knew",    pp: "known",   pw: ["knowed","knewed","knowd"],     ppw: ["knowed","knewed","knowd"] },
  { verb: "come",   past: "came",    pp: "come",    pw: ["comed","camed","comeed"],      ppw: ["comed","camed","comen"] },
  { verb: "think",  past: "thought", pp: "thought", pw: ["thinked","thinkd","thinkted"], ppw: ["thinked","thinkd","thinkted"] },
  { verb: "buy",    past: "bought",  pp: "bought",  pw: ["buyed","buyd","buyted"],       ppw: ["buyed","buyd","buyted"] },
  { verb: "make",   past: "made",    pp: "made",    pw: ["maked","maded","makeed"],      ppw: ["maked","maded","makeed"] },
  { verb: "find",   past: "found",   pp: "found",   pw: ["finded","findeed","findd"],    ppw: ["finded","findeed","findd"] },
  { verb: "tell",   past: "told",    pp: "told",    pw: ["telled","telld","telleed"],    ppw: ["telled","telld","telleed"] },
  { verb: "drink",  past: "drank",   pp: "drunk",   pw: ["drinked","drinkd","dranked"],  ppw: ["drinked","dranked","drunkd"] },
  { verb: "begin",  past: "began",   pp: "begun",   pw: ["beginned","begined","beganned"], ppw: ["beginned","begined","begonned"] },
  { verb: "speak",  past: "spoke",   pp: "spoken",  pw: ["speaked","spoked","speakd"],   ppw: ["speaked","spoked","speakened"] },
  { verb: "fall",   past: "fell",    pp: "fallen",  pw: ["falled","felled","falld"],     ppw: ["falled","felled","falld"] },
  { verb: "grow",   past: "grew",    pp: "grown",   pw: ["growed","grewed","growd"],     ppw: ["growed","grewed","growd"] },
  { verb: "throw",  past: "threw",   pp: "thrown",  pw: ["throwed","threwed","throwd"],  ppw: ["throwed","threwed","throwd"] },
  { verb: "wear",   past: "wore",    pp: "worn",    pw: ["weared","wored","weard"],      ppw: ["weared","wored","weard"] },
  { verb: "ride",   past: "rode",    pp: "ridden",  pw: ["rided","roded","rideed"],      ppw: ["rided","roded","rideed"] },
  { verb: "choose", past: "chose",   pp: "chosen",  pw: ["choosed","chosed","chooseed"], ppw: ["choosed","chosed","chooseed"] },
  { verb: "forget", past: "forgot",  pp: "forgotten", pw: ["forgetted","forgoted","forgetd"], ppw: ["forgetted","forgoted","forgetd"] },
  { verb: "draw",   past: "drew",    pp: "drawn",   pw: ["drawed","drewed","drawd"],     ppw: ["drawed","drewed","drawd"] }
];
```

### Answer Generation
For each question, present 3 choices: 1 correct + 2 wrong.
- Simple past question: correct = `verb.past`, wrong answers = pick 2 random from `verb.pw`
- Past participle question: correct = `verb.pp`, wrong answers = pick 2 random from `verb.ppw`
- Shuffle the 3 choices randomly before displaying.

### Verb Selection
Random from the full list. No spaced repetition for MVP. No repeat prevention between waves (same verb can appear again).

---

## Visual Effects

All effects are rendered on Canvas, not DOM elements.

### Particles (on enemy kill / correct slash)
Spawn 8-12 small circles at the death position. Each particle has a random angle and distance, fades out over 0.3-0.5 seconds, shrinks to nothing.

### Explosion (AoE / Cannon)
Expanding ring from projectile impact position. Starts at 30% of aoeRadius, expands to 100% over 0.3 seconds. Yellow-orange color, fading opacity.

### Freeze Burst
Expanding ring from freeze tower position. Expands to `range * 2` diameter over 0.25 seconds. Light blue, fading opacity.

### Poof Cloud (tier transformation)
Small cloud burst at enemy position. 5-8 small white/gray circles expanding outward over 0.15 seconds.

### Flying Coins
Animated coin icons that fly from a world position (or UI position for quiz) to the coin counter in the HUD. Arc trajectory. 0.5-0.8 second flight time.

### Damage Tint
Enemy flashes red for 0.1 seconds when hit.

### Screen Edge Flash
Red vignette flash when a life is lost. 0.35 seconds, fading.

---

## UI Layout

All UI is HTML/CSS overlaid on the Canvas. The canvas fills the game area; HTML elements are positioned absolutely on top.

### Top Bar (always visible during gameplay)
Left to right:
- **Coin icon** (animated spinning coin — CSS sprite animation) + **coin count** (number only, no label)
- **Lives**: heart icons (filled = alive, empty = lost). No text label.
- **Phase indicator**: "BUILD PHASE" / "BATTLE PHASE" / centered, prominent
- **Wave counter**: "Wave 3/20"
- **End Game button** (small, unobtrusive, top-right corner)

### Bottom Panel (always visible during gameplay)
- **Tower buttons**: one per tower type, showing tower icon + cost. Grayed out if can't afford.
- When a placed tower is selected (clicked):
  - **Tower info panel**: name, description, current stats
  - **Upgrade button**: shows next upgrade description + cost. Hidden if max level.
  - **Sell button**: shows sell value.
- Background panel with consistent styling.

### Placement Mode Overlay
See Placement Grid section. Semi-transparent colored overlay on the entire map grid.

### Wave Complete Overlay
- Centered panel
- "Wave N Complete!"
- "Bonus: +10 coins" with flying coin animation
- Auto-dismisses after 2 seconds or on click

### Quiz Panel
- Full-screen semi-transparent overlay (blocks game interaction)
- Centered panel with:
  - "Question 1/2" or "Question 2/2" header
  - Verb chain display: `verb → ??? → ___` or `verb → past → ???`
  - 3 answer buttons
  - Feedback area (correct/wrong indicator)
  - Coins earned display

### Game Over Screen
- Full-screen overlay
- "Game Over"
- "Reached Wave: N/20"
- "Best: N" (highscore from localStorage)
- "Play Again" button
- "Menu" button

### Victory Screen
- Full-screen overlay
- "Victory!" with celebration
- Final score / stats
- "Play Again" and "Menu" buttons

### Start Screen / Menu
- Game title
- "Play" button (goes to level select or directly to game if single level)
- Simple, clean, minimal

---

## Placeholder Graphics

For initial development, use simple colored shapes. No sprite sheets needed yet — everything is drawn procedurally on Canvas.

### Tiles
- `ground`: green fill (`#4a7c2e`)
- `path`: brown/tan fill (`#c4a35a`)
- `water`: blue fill (`#3a8fd4`)
- `obstacle`: dark green circle on ground (`#2d5a1e`)
- `spawn`: path color with a yellow arrow marker
- `goal`: path color with a red X marker

### Towers
- **Basic**: blue circle with a small triangle pointing at target
- **Circle Shooter**: purple circle with dots around the edge
- **Cannon**: brown circle with a square on top
- **Freeze**: cyan/light blue circle with snowflake pattern (or just *)

### Enemies
- Colored circles that scale with tier:
  - Grunt: small green circle
  - Soldier: medium blue circle
  - Warrior: larger yellow circle
  - Brute: large red circle
  - Titan: very large purple circle
  - Boss: large dark circle with a visible health bar above

### Projectiles
- **Basic**: small white circle
- **Circle Shooter**: small pink circles
- **Cannon**: small brown circle (larger than basic)

### Range Indicator
Semi-transparent circle showing tower range during placement and when tower is selected.

---

## Input Handling

### Mouse (PC)
- `mousedown` on tower button: enter placement mode
- `mousemove` while in placement mode: update ghost position
- `mousedown` on valid cell: place tower
- `mousedown` on placed tower: select it (show info + upgrade/sell)
- `mousedown` on empty area (not in placement mode): deselect tower
- `contextmenu` (right-click): cancel placement mode
- Keyboard shortcuts as listed above

### Touch (Mobile)
- `touchstart` on tower button: enter placement mode
- `touchstart` on valid cell (while in placement mode): place tower
- `touchstart` on placed tower: select it
- No ghost preview (no hover on mobile)
- Same placement overlay visible on mobile

### Preventing Scroll
During gameplay, prevent default touch scrolling on the game area. Allow normal scrolling on menus.

---

## Persistence

### Highscores
Store in `localStorage`:
- Key: `td_highscore_level_{index}`
- Value: max wave reached (integer)
- Update on game over and victory

### No user accounts. No backend. All local.

---

## Performance Considerations

- Maintain a shared `state.enemies` array. Towers and projectiles iterate this array directly. Do NOT search the DOM.
- Cap effects (particles, flying coins) — max ~50 active particles, max ~10 flying coins at once.
- Object pooling is NOT needed for MVP. Simple create/destroy. Optimize later only if needed.
- Target 60fps on mid-range devices. The game is simple enough that this should be achievable without optimization tricks.

---

## Asset Pipeline (for when Mika delivers art)

The rendering system should be designed so swapping placeholder shapes for sprites is straightforward.

### Sprite Config Pattern
```javascript
const SPRITE_CONFIG = {
  enemies: {
    grunt:   { sheet: "assets/sprites/grunt.png",   frameWidth: 48, frameHeight: 48, walkFrames: 6, deathFrames: 4, directions: 4 },
    soldier: { sheet: "assets/sprites/soldier.png",  frameWidth: 48, frameHeight: 48, walkFrames: 6, deathFrames: 4, directions: 4 },
    // etc.
  },
  towers: {
    basic:  { image: "assets/sprites/tower_basic.png", width: 48, height: 48 },
    // etc.
  },
  tiles: {
    sheet: "assets/sprites/tileset.png",
    tileSize: 48,
    mapping: { ground: [0,0], path: [1,0], water: [2,0] }  // column, row in sheet
  }
};
```

When `SPRITE_CONFIG` has entries for an entity type, the renderer draws the sprite. When it doesn't, it falls back to the placeholder shape. This means Mika can deliver assets one category at a time and they drop in without code changes.

### Sprite Animation
For sprite sheets with directional walk cycles:
- Sheet layout assumed: rows = directions (down, up, right, left), columns = frames
- Track `animationTimer` per entity. Advance frame when timer exceeds `frameDuration = 1 / animationFPS`.
- Directions: pick row based on dominant movement axis (|dx| > |dy| → left/right, else up/down).

---

## What NOT to Build (for MVP)

- No audio system (stub the module, implement later)
- No level editor (hardcode one test level, build editor as a separate tool later)
- No pause menu
- No speed controls (fast-forward)
- No tutorial
- No settings menu
- No localization (English only for now)
- No level unlock progression (all levels accessible)
- No animations on towers (static sprites/shapes are fine)

---

## Implementation Order

Build in this sequence. Each step should result in something testable.

1. **Canvas + grid rendering**: show a hardcoded tile grid, render colored rectangles for tiles. Camera/viewport working.
2. **Path + enemy movement**: enemies spawn at start, follow waypoints, reach end. Just colored circles moving along the path.
3. **Tower placement**: placement grid overlay, click-to-place, towers appear as colored shapes on valid cells.
4. **Tower firing + projectiles**: basic tower shoots homing projectiles at enemies. Enemies take damage, die, get removed.
5. **All tower types**: circle shooter, cannon (AoE), freeze tower.
6. **Wave system**: wave scaling, spawn timing, boss waves, wave complete flow.
7. **Enemy tiers**: visual scaling by health, tier transformation on damage.
8. **Coin economy**: earn from kills/waves, spend on towers/upgrades. Flying coin effect.
9. **Upgrade + sell system**: upgrade buttons, stat multipliers, sell for refund.
10. **Quiz system**: quiz panel between waves, verb chain format, answer checking, coin rewards.
11. **UI polish**: HUD layout, tower info panel, game over/victory screens, start menu.
12. **Effects**: particles, explosions, freeze burst, damage tint, screen flash.

---

## Test Level Layout

For initial development, use this simple level (approx 30×18 grid):

```
Path enters from the left edge (row 9), goes right to column 15,
turns down to row 14, goes right to column 25, turns up to row 5,
goes right to the exit at column 29.

This creates an S-curve with several straight segments and corners,
giving space for tower placement on both sides of the path.
```

Encode this as the first `level1.json`. The exact tile positions are for CC to determine — just make sure there's enough ground space around the path for meaningful tower placement with the 3×3 placement cells.

---

## Summary for Claude Code

This is a complete game. Read the whole spec. Implement the systems in the order listed in "Implementation Order." Use placeholder graphics (colored shapes). Keep everything in plain JS — no framework, no build step. Make it fun and responsive. When in doubt about a mechanic, refer to the specific section in this document — every value and formula is defined.

The code should be clean, well-structured, and modular. Each system in its own file. State managed centrally. No DOM queries for game entities. Delta-time-based updates. Canvas for game rendering, HTML for UI overlays.

When you're done with step 12, the game should be fully playable: enemies walk, towers shoot, waves escalate, quizzes test irregular verbs, coins flow, and kids learn English.
