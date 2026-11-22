// node tools/qa-touch.cjs port w h lang shotPrefix — plays level 1 by touch (stick drags via CDP, taps). See CLAUDE.md.
// Questions open only with the sword button (book, chest, boss stone); walking onto things asks nothing.
const { chromium } = require('/home/janah/dev/Worksheets/app/node_modules/playwright');
const [port = 8152, W = 1024, H = 768, LANG = 'de', PRE = 'T-tablet'] = process.argv.slice(2);
const w = +W, h = +H;
const SHOTS = process.env.SHOTS || require('path').join(__dirname, '..', '_shots');
const log = (...a) => console.log(...a);
let fails = 0;
const check = (ok, what, extra = '') => { log(ok ? 'OK  ' : 'FAIL', what, extra); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    localStorage.setItem('krabsy_vdungeon_save', JSON.stringify({ coins: 60, owned: ['knight'], hero: 'knight' }));
    document.hasFocus = () => false; // an iframe without keyboard focus: touch must still play
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const info = () => ev(() => window.__VD.info());
  const pos = () => ev(() => [window.__VD.hero.pos.x, window.__VD.hero.pos.z]);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${PRE}-${name}.png` });

  await page.goto(`http://localhost:${port}/?lang=${LANG}`);
  await page.waitForFunction(() => window.__VD && document.getElementById('menu').classList.contains('on'), null, { timeout: 120000 });
  await wait(500);
  // The first touch switches the touch controls on (coarse pointer already does).
  check(await ev(() => document.documentElement.classList.contains('touch')), 'touch mode on (pointer: coarse)');
  check(/Stick|stick|Joystick/.test(await ev(() => document.getElementById('howto').textContent)), 'menu how-to shows the stick', await ev(() => document.getElementById('howto').textContent));
  // Buy + select the barbarian by tapping its card.
  const box = async (sel, i = 0) => { const b = await page.locator(sel).nth(i).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const tapAt = async ([x, y]) => { await page.touchscreen.tap(x, y); };
  await tapAt(await box('#heroes .hero', 1));
  await wait(1200);
  const sv = await ev(() => JSON.parse(localStorage.getItem('krabsy_vdungeon_save')));
  check(sv.hero === 'barbarian' && sv.owned.includes('barbarian') && sv.coins === 20, 'tap buys + selects the barbarian', JSON.stringify(sv));
  await tapAt(await box('#heroes .hero', 3)); await wait(300); // too expensive: stays barbarian
  check((await ev(() => JSON.parse(localStorage.getItem('krabsy_vdungeon_save')).hero)) === 'barbarian', 'tap on a hero you cannot afford keeps the choice');
  await tapAt(await box('#heroes .hero', 0)); await wait(600); // back to the knight (owned)
  await shot('menu');
  // Start level 1 by tapping it.
  await tapAt(await box('#levels .lvl', 0));
  await page.waitForFunction(() => window.__VD.G.mode === 'play' && !window.__VD.G.locked && window.__VD.room.type, null, { timeout: 60000 });
  await wait(600);
  check(!(await ev(() => document.getElementById('focus').classList.contains('on'))), 'no "click to play" overlay while touch-playing without focus');
  check(await ev(() => getComputedStyle(document.getElementById('tSword')).display === 'block'), 'sword button visible in play');
  await ev(() => { window.__VD.G.invuln = 1e9; });

  // ── the stick ──
  const S0 = [Math.round(w * 0.17), Math.round(h * 0.72)], RR = h < 500 ? 46 : 58;
  let held = false;
  const stickTo = async (dx, dz) => { // dx, dz in −1…1 (screen direction)
    const p = [S0[0] + dx * RR, S0[1] + dz * RR];
    if (!held) { await touch('touchStart', [S0]); held = true; }
    await touch('touchMove', [p]);
  };
  const lift = async () => { if (held) { await touch('touchEnd', []); held = false; } };
  // Walk to (x, z) by steering the stick every 60 ms.
  const walkTo = async (x, z, tol = 0.45, ms = 40000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const [px, pz] = await pos();
      const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
      if (d < tol) break;
      if (await ev(() => !!window.__VD.G.card)) break;
      await stickTo(dx / d, dz / d);
      await wait(60);
    }
    await lift();
    const [px, pz] = await pos();
    return Math.hypot(x - px, z - pz);
  };
  const goThrough = async (x = 0) => { // walk up through the open door until the next room (or the end)
    const r0 = (await info()).room, t0 = Date.now();
    await walkTo(x, -5.0, 0.5, 20000); // line up first (the far ledge has columns by the door)
    await walkTo(x, -6.6, 0.5, 20000);
    while (Date.now() - t0 < 60000) { // generous: headless frame rates drop a lot on a busy machine
      const i = await info();
      if (i.room !== r0 || i.mode !== 'play') break;
      await stickTo(0, -1); await wait(80);
    }
    await lift();
    await page.waitForFunction(() => window.__VD.G.mode !== 'play' || !window.__VD.G.locked, null, { timeout: 60000 });
    await wait(300);
  };
  const waitCard = async () => { for (let i = 0; i < 20 && !(await ev(() => !!window.__VD.G.card)); i++) await wait(100); };
  const push = async (dx, dz, ms) => { await stickTo(dx, dz); await wait(ms); await lift(); };
  const sword = async () => { const c = [w - (h < 500 ? 66 : 86), h - (h < 500 ? 64 : 86)]; await touch('touchStart', [c]); await wait(80); await touch('touchEnd', []); await wait(450); };
  const tapChip = async (right = true) => {
    const q = await ev(() => window.__VD.cardNow());
    const i = right ? q.options.indexOf(q.answer) : q.options.findIndex((o) => o !== q.answer);
    await tapAt(await box('#chips .chip', i)); await wait(350);
    return `${q.base}:${q.ask}:${q.options[i]}`;
  };

  // The verb book: walk into its circle (beside the stand), the sword button opens the card.
  const toBook = async () => { // from the front, so the stand is never in the way
    const b = await ev(() => { const b = window.__VD.room.book; return [b.x, b.z]; });
    await walkTo(b[0] - 1.1, b[1] + 2.2, 0.4);
    const d = await walkTo(b[0] - 1.1, b[1] + 0.5, 0.35);
    log('     to book: dist', d.toFixed(2), 'hero', (await pos()).map((v) => v.toFixed(2)).join(','), 'prompt', (await info()).prompt);
    return d;
  };
  // Walk into the circle and press the sword button (once more if the walk fell short: slow headless frames).
  const openBook = async () => {
    let pr;
    for (let k = 0; k < 3 && !(await info()).card; k++) { await toBook(); pr = (await info()).prompt; if (pr === 'book') { await sword(); await waitCard(); } }
    return pr;
  };
  const readBook = async (wrongFirst) => {
    const pr = await openBook();
    const inf = await info();
    check(pr === 'book' && inf.card === 'book:past', 'in the circle the sword button opens the book', `${pr} ${inf.card}`);
    if (wrongFirst) log('     chip', await tapChip(false));
    log('     chip', await tapChip(true));
    check((await info()).card === 'book:pp', 'after the 2nd form the book asks the 3rd', (await info()).card);
    log('     chip', await tapChip(true));
    await wait(300);
    const i2 = await info();
    check(!i2.card && i2.book === 'done' && (i2.phase === 'door' || i2.phase === 'open'), 'book answered: the door unlocks', `${i2.book} ${i2.phase}`);
  };
  const searchRoom = async () => {
    for (let k = 0; k < 4 && (await info()).key === 'hidden'; k++) {
      const sp = await ev(() => { const r = window.__VD.room; const i = r.search.findIndex((s) => !s.done); if (i < 0) return null; const s = r.search[i]; return { i, x: s.x, z: s.z, r: s.r }; });
      if (!sp) break;
      const side = sp.x > 0 ? -1 : 1;
      const d = await walkTo(sp.x + side * (sp.r + 0.75), sp.z, 0.4);
      await push(-side, 0, 160); // face it
      await sword();
      const done = await ev((i) => window.__VD.room.search[i].done, sp.i);
      log('     search', sp.i, 'dist', d.toFixed(2), 'searched', done, 'key', (await info()).key);
    }
  };
  const START = Number(process.env.START || 0), ONLY = process.env.ONLY ? Number(process.env.ONLY) : 99;
  let inf;
  if (START > 0) {
    await ev((n) => { for (let i = 0; i < n; i++) window.__VD.playRoom(false); }, START);
    await page.waitForFunction(() => !window.__VD.G.locked, null, { timeout: 20000 });
    await ev(() => { window.__VD.G.invuln = 1e9; });
  }
  const seg = (k) => START <= k && k <= ONLY;
  // Stick moves the hero (up = into the room).
  if (seg(0)) {
  let a = await pos(); await push(0, -1, 700); let b = await pos();
  check(b[1] < a[1] - 0.8, 'stick up walks the hero into the room', `${a.map((v) => v.toFixed(2))} → ${b.map((v) => v.toFixed(2))}`);
  a = b; await push(1, 0, 500); b = await pos();
  check(b[0] > a[0] + 0.5, 'stick right walks right', `${a[0].toFixed(2)} → ${b[0].toFixed(2)}`);
  // Screenshot with the stick held.
  await stickTo(-0.7, -0.5); await wait(250); await shot('room'); await lift();
  check(await ev(() => window.__VD.G.mode === 'play'), 'still playing');

  // ── Room 1: the book without the key asks nothing; smash the crates with the sword button ──
  await toBook(); await sword(); await wait(200);
  inf = await info();
  check(!inf.card && inf.book === 'shut', 'sword button at the book without the key: no card (hint)', `${inf.card} ${await ev(() => document.getElementById('hint').textContent)}`);
  await searchRoom();
  inf = await info();
  check(inf.key === 'floor' || inf.key === 'fly', 'sword button searched until the key popped out', inf.key + ' ' + inf.hide);
  for (let i = 0; i < 60 && (await info()).key === 'fly'; i++) await wait(100);
  const keyAt = await ev(() => { const k = window.__VD.keyObj(); return [k.x, k.z]; });
  await walkTo(keyAt[0], keyAt[1], 0.3); await wait(300);
  inf = await info();
  check(!inf.card && inf.key === 'taken', 'walking onto the key takes it, no card', `${inf.card} ${inf.key}`);
  await toBook(); await wait(200);
  await shot('book-prompt');
  await openBook();
  inf = await info();
  check(inf.card === 'book:past', 'sword button in the circle opens the book card', inf.card);
  await shot('card');
  log('     chip', await tapChip(false));
  check(await ev(() => document.querySelectorAll('#chips .chip.wrong').length === 1), 'wrong chip greys out');
  await shot('card-wrong');
  log('     chip', await tapChip(true));
  check((await info()).card === 'book:pp', 'after the 2nd form the card asks the 3rd', (await info()).card);
  log('     chip', await tapChip(true));
  inf = await info();
  check(!inf.card && inf.book === 'done', 'book answered by tapping chips', inf.book);
  // To the door, and through.
  await walkTo(0, -5.6, 0.6);
  await wait(500);
  check((await info()).door === true, 'door opened');
  await goThrough();
  inf = await info();
  check(inf.room === 1, 'walked through the door into room 2', `room ${inf.room}`);
  await page.waitForFunction(() => !window.__VD.G.locked, null, { timeout: 20000 });
  await ev(() => { window.__VD.G.invuln = 1e9; });

  }
  if (seg(1)) {
  // ── Room 2: chest "later" by tap, bonk a skeleton with the sword, search ──
  const ch = await ev(() => ({ x: window.__VD.room.chest.x, z: window.__VD.room.chest.z }));
  const dch = await walkTo(ch.x - 1.6, ch.z, 0.3, 25000); await wait(300);
  inf = await info();
  log('     chest at', JSON.stringify(ch), 'hero', (await pos()).map((v) => v.toFixed(2)).join(','), 'dist', dch.toFixed(2));
  check(!inf.card && inf.prompt === 'chest', 'walking up to the chest asks nothing (prompt shown)', `${inf.card} ${inf.prompt}`);
  await sword(); await waitCard();
  inf = await info();
  check(inf.card === 'chest:past', 'sword button at the chest opens its card', inf.card);
  await tapAt(await box('#askLater')); await wait(300);
  check(!(await info()).card, 'tapping "later" closes the chest card');
  await sword(); await waitCard();
  inf = await info();
  check(inf.card === 'chest:past', 'sword button asks again after "later"', inf.card);
  log('     chip', await tapChip(true));
  await wait(600);
  check(await ev(() => window.__VD.room.chest.open), 'chest opened by tap');
  // bonk the skeleton: stand ~1.6 in front of it, face it, tap the sword button
  for (let k = 0; k < 6; k++) {
    const s = await ev(() => { const s = window.__VD.skeletons[0]; return [s.pos.x, s.pos.z, s.mode]; });
    if (s[2] !== 'patrol') break;
    const [px, pz] = await pos(); const dx = px - s[0], dz = pz - s[1], d = Math.hypot(dx, dz) || 1;
    await walkTo(s[0] + dx / d * 1.6, s[1] + dz / d * 1.6, 0.4, 4000);
    const [qx, qz] = await pos(); const ex = s[0] - qx, ez = s[1] - qz, e = Math.hypot(ex, ez) || 1;
    await push(ex / e, ez / e, 60);
    log('     skel', s.slice(0, 2).map((v) => v.toFixed(2)).join(','), 'hero', (await pos()).map((v) => v.toFixed(2)).join(','));
    await sword();
  }
  const skm = await ev(() => window.__VD.skeletons[0].mode);
  check(skm !== 'patrol', 'sword button bonked the skeleton', skm);
  { // two fingers: walk with the stick and press the sword button at the same time
    const c = [w - (h < 500 ? 66 : 86), h - (h < 500 ? 64 : 86)], p1 = [S0[0], S0[1] + RR];
    await touch('touchStart', [S0]); await touch('touchMove', [p1]); await wait(200);
    const z0 = (await pos())[1];
    await touch('touchStart', [p1, c]); await wait(60);
    const sw = await ev(() => window.__VD.G.attackT > 0);
    await touch('touchEnd', [p1]); await wait(250);
    const z1 = (await pos())[1];
    await touch('touchEnd', []);
    check(sw && z1 > z0, 'stick held + sword button: swings while walking', `attack ${sw}, z ${z0.toFixed(2)} → ${z1.toFixed(2)}`);
  }
  await searchRoom();
  for (let i = 0; i < 60 && (await info()).key === 'fly'; i++) await wait(100);
  await wait(500);
  inf = await info();
  if (inf.key === 'floor') { const kp = await ev(() => { const k = window.__VD.keyObj(); return [k.x, k.z]; }); await walkTo(kp[0], kp[1], 0.3); await wait(300); }
  inf = await info();
  check(inf.key === 'taken', 'room 2 key taken', inf.key + ' ' + inf.hide);
  if (inf.key !== 'taken') { await ev(() => { window.__VD.findKey(); window.__VD.takeKey(); }); }
  await readBook(false);
  await walkTo(0, -5.6, 0.6); await wait(400); await goThrough();
  inf = await info();
  check(inf.type === 'bridge', 'room 3 is the bridge', inf.type);

  }
  // ── Room 3: the bridge, walked by stick (one wrong stone first) ──
  const bridgeRow = async (right) => {
    const st = await ev((right) => { const V = window.__VD, b = V.room.bridge, q = b.pair.steps[b.step];
      const i = q.options.findIndex((o, k) => (o === q.answer) === right && !(q.tried && q.tried.includes(k)));
      return { i, x: [-4.2, 0, 4.2][i], step: b.step, word: q.options[i] }; }, right);
    const near = st.step === 0 ? 4.4 : -1.6;
    await walkTo(st.x, near + 1.0, 0.25);
    // Hold the stick up until this row is decided (solved or dropped), whatever the frame rate.
    const key = async () => (await info()).bridge;
    const k0 = await key(), t0 = Date.now();
    await stickTo(0, -1);
    while (Date.now() - t0 < 8000) {
      const k = await key();
      if (k.split(':')[0] !== k0.split(':')[0] || /fall/.test(k)) break;
      await wait(80);
    }
    if (right) { // walk on off the stone onto the floor beyond
      const far = st.step === 0 ? 1.6 : -4.4;
      for (let i = 0; i < 60 && (await pos())[1] > far - 0.8; i++) await wait(80);
    }
    await lift(); await wait(900);
    return st;
  };
  if (seg(2)) {
  await shot('bridge-start');
  let st = await bridgeRow(false);
  inf = await info();
  check(/^0:/.test(inf.bridge) && inf.missed.length >= 1, `wrong stone "${st.word}" crumbled, hero back`, inf.bridge);
  await page.waitForFunction(() => !window.__VD.G.locked, null, { timeout: 10000 });
  st = await bridgeRow(true);
  inf = await info();
  check(/^1:/.test(inf.bridge), `right stone "${st.word}" crossed (row A)`, inf.bridge);
  await shot('bridge-sign');
  st = await bridgeRow(true);
  await wait(600);
  inf = await info();
  check(inf.phase === 'open', `right stone "${st.word}" crossed (row B), door open`, `${inf.bridge} ${inf.phase}`);
  await goThrough();
  inf = await info();
  check(inf.type === 'rune', 'room 4 is the rune room', inf.type);

  }
  // ── Room 4: rune doors, walked into ──
  // Two walls: the first one across the room (2nd form, at z RUNE_WALL.z = 0), the back wall (3rd form).
  const runeDoor = async (right) => {
    const d = await ev((right) => { const V = window.__VD, r = V.room.rune, q = r.pair.steps[r.step];
      const doors = r.step === 0 ? V.room.inner.gates : V.room.doors;
      const i = q.options.findIndex((o, k) => (o === q.answer) === right && !(q.tried && q.tried.includes(k)));
      return { i, x: doors[i].x, word: q.options[i], step: r.step }; }, right);
    await walkTo(d.x, d.step === 0 ? 2.8 : -5.0, 0.3);
    const key0 = await ev(() => { const V = window.__VD; return `${V.G.roomIdx}:${V.room.rune && V.room.rune.step}:${JSON.stringify(V.room.rune && V.room.rune.pair.steps.map((q) => q.tried))}`; });
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const k = await ev(() => { const V = window.__VD; return `${V.G.roomIdx}:${V.room.rune && V.room.rune.step}:${JSON.stringify(V.room.rune && V.room.rune.pair.steps.map((q) => q.tried))}`; });
      if (k !== key0) break;
      await stickTo(0, -1); await wait(80);
    }
    await lift(); await wait(1200);
    await page.waitForFunction(() => !window.__VD.G.locked, null, { timeout: 20000 });
    return d;
  };
  if (seg(3)) {
  await shot('rune');
  let d = await runeDoor(false);
  inf = await info();
  log('     rune wrong', d.word, inf.phase, inf.missed.join(','));
  check(/^0:/.test(inf.rune) && inf.missed.length >= 1, 'wrong door in the first wall: brick wall, pushed back', inf.rune);
  d = await runeDoor(true);
  inf = await info();
  check(/^1:/.test(inf.rune), 'right door in the first wall opens (2nd form)', inf.rune);
  await walkTo(d.x, -2.6, 0.4); // through the open door into the antechamber
  inf = await info();
  check(/^1:-/.test(inf.rune) && parseFloat(inf.rune.split(':')[1]) < -1.5, 'walked through the first wall into the antechamber', inf.rune);
  await shot('rune-round2');
  d = await runeDoor(true);
  await wait(800);
  inf = await info();
  check(inf.type === 'boss' || inf.room === 4, 'walked through the right rune doors to the boss', `${inf.type} room ${inf.room} ${inf.phase}`);
  await page.waitForFunction(() => !window.__VD.G.locked, null, { timeout: 20000 });

  }
  if (seg(4)) {
  // ── Boss: walk onto the stone, tap the chip, bonk with the sword ──
  await ev(() => { window.__VD.G.invuln = 1e9; });
  for (let round = 0; round < 10 && (await info()).mode === 'play' && (await info()).type === 'boss'; round++) {
    await page.waitForFunction(() => window.__VD.room.boss.stone || window.__VD.room.boss.state === 'dead', null, { timeout: 60000 });
    const s = await ev(() => window.__VD.room.boss.stone && [window.__VD.room.boss.stone.x, window.__VD.room.boss.stone.z]);
    if (!s) break;
    await walkTo(s[0], s[1], 0.35, 8000); await wait(150);
    if (round === 0) check(!(await info()).card, 'standing on the stone asks nothing until the sword button');
    await sword(); await waitCard();
    if (!(await info()).card) continue;
    if (round === 0) await shot('boss-card');
    await tapChip(true); await wait(300);
    const hp0 = (await info()).boss;
    for (let k = 0; k < 5 && /:stun:/.test((await info()).boss || '') && (await info()).boss === hp0; k++) {
      const g = await ev(() => window.__VD.golemPos());
      await walkTo(g[0], g[1] + 1.9, 0.4, 2500);
      await push(0, -1, 60); await sword();
    }
    log('     boss', (await info()).boss);
  }
  inf = await info();
  check(/dead/.test(inf.boss || '') || inf.phase === 'open', 'golem down by touch', inf.boss);
  await page.waitForFunction(() => window.__VD.room.phase === 'open', null, { timeout: 30000 }).catch(() => {}); // coins fly, then the exit opens
  await wait(500);
  await goThrough();
  await page.waitForFunction(() => window.__VD.G.mode === 'end', null, { timeout: 20000 }).catch(() => {});
  await wait(800);
  inf = await info();
  check(inf.mode === 'end', 'level 1 played to the end screen by touch', inf.mode);
  await shot('end');
  // End screen buttons by tap: "Levels" → menu.
  await tapAt(await box('#btnMenu')); await wait(600);
  check((await info()).mode === 'menu', 'end screen button by tap → menu');
  // Sound toggle by tap (in play).
  await tapAt(await box('#levels .lvl', 0));
  await page.waitForFunction(() => window.__VD.G.mode === 'play' && !window.__VD.G.locked, null, { timeout: 60000 });
  const m0 = await ev(() => localStorage.getItem('krabsy_vdungeon_sound'));
  await tapAt(await box('#mute')); await wait(300);
  const m1 = await ev(() => localStorage.getItem('krabsy_vdungeon_sound'));
  check(m0 !== m1, 'sound toggle by tap', `${m0} → ${m1}`);
  check(await ev(() => window.scrollY === 0 && document.scrollingElement.scrollTop === 0 && visualViewport.scale === 1), 'no page scroll / zoom');
  }
  inf = await info();
  log('source', inf.source, 'tiers', inf.tiers, 'askLog', (await ev(() => window.__VD.askLog.join(' '))));
  log('ERRORS', JSON.stringify(errs));
  log(fails ? `${fails} FAILED` : 'ALL OK');
  await browser.close();
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
