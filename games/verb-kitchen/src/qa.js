// QA hook (window.__VK) + ?qa= frozen scenes for headless screenshots.
import { makeIngredient, makePlate, buildItemMesh } from './stations.js';
import { ITEMS } from './recipes.js';
import { seedRng } from './verbs.js';
import { ui } from './ui.js';

export function initQA(game, save, startLevel, params) {
  const VK = {
    game, save,
    state() {
      return {
        level: game.level?.id,
        score: game.score,
        combo: game.combo,
        timeLeft: game.timeLeft,
        questionOpen: game.questionOpen,
        carried: game.carried(),
        rackPlates: game.rackStation?.plates,
        dirtyPlates: game.sinkStation?.dirtyPlates,
        tickets: game.orders?.tickets.map((t) => ({ dish: t.dish, patience: Math.round(t.patience) })),
        stations: game.world?.stations.filter((s) => s.item || s.state !== 'idle')
          .map((s) => ({ type: s.type, item: s.item?.type === 'plate' ? `plate[${s.item.contents}]` : s.item?.id, state: s.state })),
        fps: Math.round(game.fpsAvg),
        roundOver: game.roundOver,
      };
    },
    teleport(col, row) {
      const p = game.world.tileWorld(col, row);
      game.chef.pos.set(p.x, 0, p.z);
    },
    face(dx, dz) { game.chef.facing.set(dx, dz); },
    give(id) {
      const item = id === 'plate' ? makePlate([]) : makeIngredient(id);
      game.chef.setCarried(item, buildItemMesh(item));
    },
    givePlate(contents) {
      const p = makePlate(contents);
      game.chef.setCarried(p, buildItemMesh(p));
    },
    clearHands() { game.chef.setCarried(null); },
    pressE() { game.interactE(); },
    holdSpace(seconds) {           // simulate held Space for n seconds of game time
      game.keys[' '] = true;
      let left = seconds;
      while (left > 0) { const dt = Math.min(left, 1 / 30); game.update(dt); left -= dt; }
      game.keys[' '] = false;
    },
    pressSpace() { game.spacePress(); },
    tick(seconds) {                // advance game time deterministically
      let left = seconds;
      while (left > 0) { const dt = Math.min(left, 1 / 30); game.update(dt); left -= dt; }
    },
    spawnTicket(dish) { return game.orders.spawn(dish); },
    expireTickets() { for (const t of game.orders.tickets) t.patience = 0.01; game.orders.update(0.02, 1); },
    dirtyPlates(n) {
      game.sinkStation.dirtyPlates = n;
      game.sinkStation.refreshStack();
    },
    openQuestion() { game.quiz.openQuestion(); },
    currentQuestion() { return game.quiz.current; },
    answer(correct) {
      const q = game.quiz.current;
      if (!q) return false;
      game.quiz.lockUntil = 0;
      const idx = correct ? q.chips.indexOf(q.answer) : q.chips.findIndex((c) => c !== q.answer);
      game.quiz.answer(idx);
      return true;
    },
    continueAfterWrong() { game.quiz.nextAfterWrong(); },
    setTimeLeft(s) { game.timeLeft = s; },
    endRound() { game.endRound(); },
    freeze(on = true) { game.qaFrozen = on; },
    setNoSpawn(on = true) { game.orders.spawningEnabled = !on; },
    startLevel,
    saveRaw: () => localStorage.getItem('krabsy_vkitchen_save'),
  };
  game.carried = () => {
    const c = game.chef?.carried;
    if (!c) return null;
    return c.type === 'plate' ? `plate[${c.contents}]${c.dish ? ':' + c.dish : ''}` : c.id;
  };
  window.__VK = VK;

  const qa = params.get('qa');
  if (!qa) return;

  seedRng(42);

  (async () => {
    const scene = qa;
    const lvIdx = { level1: 0, level2: 1, level3: 2, question: 0, burn: 1, stars: 0 }[scene] ?? 0;
    if (scene === 'loading') {       // loader overlay showcase (stays up)
      ui.loading(true);
      window.__VK_READY = true;
      return;
    }
    await startLevel(lvIdx, { skipCountdown: true });
    VK.setNoSpawn(true);

    const put = (col, row, item) => {
      const st = game.world.stationAtTile(col, row);
      if (st) st.setItem(item, false);
    };
    if (scene === 'level1' || scene === 'level2' || scene === 'level3') {
      VK.spawnTicket(null);
      VK.spawnTicket(null);
      if (scene === 'level2') {
        // showcase: visible burger builds on the island counters
        put(3, 2, makePlate(['bun', 'patty_cooked']));
        put(6, 2, makePlate(['bun', 'patty_cooked', 'lettuce_chopped']));
        put(2, 4, makePlate(['bun', 'patty_cooked', 'lettuce_chopped', 'cheese_chopped']));
        put(6, 4, makeIngredient('cheese_half'));
      }
      if (scene === 'level3') {
        // showcase: pizza build stages left-to-right
        put(3, 2, makeIngredient('dough_base'));
        put(6, 2, makeIngredient('dough_sauced'));
        put(2, 4, makeIngredient('pizza_raw_mushroom'));
        put(6, 4, makePlate(['pizza_cheese']));
      }
      VK.tick(0.5);
    } else if (scene === 'chop') {
      // frozen mid-chop: progress bar visible over the cutting board
      const board = game.world.stations.find((s) => s.type === 'board');
      VK.give('lettuce');
      VK.teleport(board.col, board.row + 1);
      VK.face(0, -1);
      VK.pressE();
      VK.holdSpace(1.25);   // freeze at the TOP of the knife swing
      VK.freeze(true);
    } else if (scene === 'carry') {
      // worst case for carry visibility: chef faces away from the camera
      // (head between camera and item) holding the smallest item
      VK.give('ketchup');
      VK.teleport(4, 3);
      VK.face(0, -1);
      VK.tick(0.3);
      VK.freeze(true);
    } else if (scene === 'question') {
      VK.spawnTicket('salad');
      VK.dirtyPlates(2);
      VK.tick(0.3);
      VK.openQuestion();
    } else if (scene === 'burn') {
      VK.spawnTicket('burger');
      const stove = game.world.stations.find((s) => s.type === 'stove');
      stove.startCooking(makeIngredient('patty_cooked'));
      stove.state = 'ready';
      VK.tick(12.5);             // ride through burn → smoke
    } else if (scene === 'stars') {
      game.score = 250;
      game.quiz.missedThisRound = ['go|past', 'eat|pp'];
      VK.endRound();
    }
    window.__VK_READY = true;
  })();
}
