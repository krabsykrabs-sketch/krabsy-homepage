// The running game: three rooms, two players, every puzzle object behind a question.
// createGame(canvas, opts) → { start(), pause(b), restartRoom(), dispose(), debug }
import * as THREE from 'three';
import { ROOMS, W, H } from './levels.js';
import { World, ROLES } from './physics.js';
import { buildRoom, questionMarker, carriedKey } from './world.js';
import { makeFigure } from './figures.js';
import { createCards } from './cards.js';
import { KEY_LABEL } from './input.js';
import { t } from './i18n.js';
import { sfx } from './sound.js';

const COLORS = ['#2ee6c0', '#ff8585'];
const ASKS = new Set(['lever', 'switch', 'post', 'heavylever', 'gate', 'locked', 'key', 'portal', 'exit']);

export async function createGame(canvas, opts) {
  const { input, players: cfg, touch, onEvent = () => {} } = opts;
  // cfg: [{ choice, role, queue, recorded, name }, …] for player 1 and 2

  // ── renderer / scene ────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const shadows = new URLSearchParams(location.search).get('shadows') !== '0';
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3048, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.9);
  sun.position.set(W / 2 - 8, H + 10, 18);
  sun.target.position.set(W / 2, H / 2, 0);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -W / 2 - 4, right: W / 2 + 4, top: H / 2 + 6, bottom: -H / 2 - 6, near: 1, far: 80 });
  sun.shadow.bias = -0.0015;
  scene.add(sun, sun.target);

  // ── DOM overlays ────────────────────────────────────────────────────────────────────
  const overlay = document.getElementById('play-overlay');
  const keyHints = [0, 1].map((pi) => (touch ? '' : t('chooseKeys', pi === 0 ? '1 2 3' : '8 9 0')));
  const cards = createCards(overlay, input, keyHints, !touch);
  const prompts = [0, 1].map((pi) => {
    const el = document.createElement('div');
    el.className = `prompt p${pi + 1}`; el.hidden = true;
    el.textContent = touch ? '✋' : KEY_LABEL[pi];
    overlay.appendChild(el); return el;
  });
  const toasts = [0, 1].map((pi) => {
    const el = document.createElement('div');
    el.className = `toast p${pi + 1}`; el.hidden = true;
    overlay.appendChild(el); return { el, until: 0 };
  });
  const tags = [0, 1].map((pi) => {
    const el = document.createElement('div');
    el.className = `tag p${pi + 1}`;
    el.textContent = `${pi + 1}`;
    overlay.appendChild(el); return el;
  });
  const banner = document.getElementById('banner');
  const hudRoom = document.getElementById('hud-room');
  const hudScore = document.getElementById('hud-score');
  const hudTime = document.getElementById('hud-time');

  // ── players ─────────────────────────────────────────────────────────────────────────
  const players = [];
  for (let pi = 0; pi < 2; pi++) {
    const c = cfg[pi];
    const role = ROLES[c.role];
    const fig = await makeFigure(c.choice, role.look, pi === 0 ? 0x2ee6c0 : 0xff8585);
    scene.add(fig.root);
    const key = carriedKey(); key.visible = false; fig.root.add(key);
    players.push({ pi, role: c.role, fig, key, cfg: c, body: null, hasKey: false, holding: null, carrying: null,
      inZone: new Set(), portalCd: 0, card: false, near: null, answers: 0, right: 0, wasGround: true });
  }

  // ── stats ───────────────────────────────────────────────────────────────────────────
  const log = [];          // { pi, correct, room, item, t }
  const missed = new Map(); // reveal text → count (shown on the results screen)
  let played = 0;          // seconds of play (no pause, no menus)

  // ── room state ──────────────────────────────────────────────────────────────────────
  let roomIdx = 0, room = null, world = null, view = null, objs = null, boxes = [], markers = [];
  let state = 'loading', roomDoneAt = 0, bannerUntil = 0;
  const cam = { x: W / 2, y: H / 2, h: 14, init: false };

  function cellsOf(o) {
    if (o.type === 'bridge') { const c = []; for (let x = o.x0; x <= o.x1; x++) c.push([x, o.y]); return c; }
    if (o.type === 'door' || o.type === 'gate' || o.type === 'locked') {
      const c = []; for (let y = o.y; y < o.y + o.h; y++) c.push([o.x, y]); return c;
    }
    return [];
  }

  function loadRoom(i) {
    if (view) view.dispose();
    for (const m of markers) m.sprite.parent?.remove(m.sprite);
    cards.closeAll();
    roomIdx = i;
    room = ROOMS[i];
    world = new World(room);
    view = buildRoom(scene, room, world);
    scene.background = new THREE.Color(view.theme.sky);
    objs = new Map();
    for (const o of room.objects) {
      const s = { def: o, on: false, open: false, held: false, propped: false, taken: false, active: !!o.active && !o.ask,
        cells: cellsOf(o), wantSolid: false, solid: false };
      if (o.type === 'door' || o.type === 'gate' || o.type === 'locked') { s.wantSolid = true; }
      objs.set(o.id, s);
    }
    // cage boxes hang still until released
    boxes = [];
    const addBox = (x, y, hanging = null) => {
      const b = world.addBody({ kind: 'box', x: x + 0.02, y, w: 0.96, h: 0.96, static: !!hanging });
      b.mesh = view.crateView(); b.cage = hanging;
      boxes.push(b); return b;
    };
    for (const [x, y] of room.boxes) addBox(x, y);
    for (const o of room.objects) if (o.type === 'cage') objs.get(o.id).box = addBox(o.x, o.y, o.id);
    for (const p of players) {
      const role = ROLES[p.role];
      const [sx, sy] = room.spawn[p.role];
      p.body = world.addBody({ kind: 'player', role: p.role, x: sx - role.w / 2, y: sy, w: role.w, h: role.h, facing: 1, pi: p.pi });
      p.hasKey = false; p.holding = null; p.carrying = null; p.inZone.clear(); p.card = false; p.portalCd = 0;
      p.key.visible = false;
    }
    syncSolids(true);
    markers = [];
    for (const o of room.objects) {
      if (!ASKS.has(o.type) || (o.type === 'portal' && !o.ask)) continue;
      const sprite = questionMarker();
      view.group.add(sprite);
      markers.push({ id: o.id, sprite, base: anchor(o) });
    }
    hudRoom.textContent = `${t('room', i + 1, ROOMS.length)} · ${t(room.name)}`;
    showBanner(t(room.goal), 6);
    cam.init = false;
    state = 'playing';
    roomStart = played;
    onEvent('room', { room: i + 1 });
  }
  let roomStart = 0;

  function syncSolids(force = false) {
    for (const s of objs.values()) {
      if (!s.cells.length) continue;
      if (s.wantSolid && !s.solid) {
        if (force || world.cellsFree(s.cells)) { world.setSolid(s.cells, true); s.solid = true; if (!force) sfx('thud'); }
      } else if (!s.wantSolid && s.solid) { world.setSolid(s.cells, false); s.solid = false; }
    }
  }

  // ── where an object is used from ─────────────────────────────────────────────────────
  function anchor(o) {
    switch (o.type) {
      case 'exit': return { x: o.x, y: o.y, rx: 1.15, top: 2.9 };
      case 'door': case 'gate': case 'locked': return { x: o.x + 0.5, y: o.y, rx: 1.25, top: o.h + 0.6 };
      case 'portal': return { x: o.x + 0.5, y: o.y, rx: 0.75, top: 2.2 };
      case 'switch': return { x: o.x + 0.5, y: o.y, rx: 0.95, top: 1.4 };
      case 'cage': case 'bridge': return null;
      default: return { x: o.x + 0.5, y: o.y, rx: 0.9, top: o.type === 'post' ? 1.85 : 1.35 };
    }
  }
  function inRange(p, o) {
    const a = anchor(o); if (!a) return false;
    const b = p.body;
    const cx = b.x + b.w / 2;
    return Math.abs(cx - a.x) < a.rx && b.y > a.y - 0.7 && b.y < a.y + 0.8;
  }
  function needsAnswer(s) {
    const o = s.def;
    switch (o.type) {
      case 'lever': case 'switch': case 'post': case 'heavylever': return !s.on;
      case 'gate': return !s.open;
      case 'locked': return !s.open;
      case 'key': return !s.taken;
      case 'portal': return o.ask && !s.active;
      case 'exit': return !s.open;
      default: return false;
    }
  }
  // the object a player would use now (nearest in range), or null
  function usable(p) {
    let best = null, bd = 9;
    for (const s of objs.values()) {
      const o = s.def;
      if (!ASKS.has(o.type)) continue;
      if (o.type === 'key' && s.taken) continue;
      if (o.type === 'portal' && !o.ask && !s.active) continue;
      if (!inRange(p, o)) continue;
      if (!needsAnswer(s) && !(o.type === 'portal' && s.active)) continue;
      const d = Math.abs(p.body.x + p.body.w / 2 - anchor(o).x);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ── actions ─────────────────────────────────────────────────────────────────────────
  function toast(p, msg) {
    const tt = toasts[p.pi];
    tt.el.textContent = msg; tt.el.hidden = false; tt.until = performance.now() + 2200;
    sfx('nope');
  }
  function showBanner(msg, secs) {
    banner.textContent = msg; banner.hidden = false; bannerUntil = performance.now() + secs * 1000;
  }

  function activate(id) {
    const s = objs.get(id); if (!s) return;
    const o = s.def;
    sfx('open');
    switch (o.type) {
      case 'door': s.open = true; s.wantSolid = false; break;
      case 'gate': s.propped = true; s.open = true; s.wantSolid = false; break;
      case 'bridge': s.on = true; s.wantSolid = true; break;
      case 'cage': s.on = true; if (s.box) { s.box.static = false; s.box.onGround = false; } break;
      case 'portal': s.active = true; break;
    }
  }

  function ask(p, s, onRight) {
    const q = p.cfg.queue.next();
    p.card = true;
    p.body.vx = 0;
    const who = `${p.cfg.name} · ${t('role.' + p.role)}`;
    cards.open(p.pi, q, {
      who,
      onAnswer(correct) {
        log.push({ pi: p.pi, correct, room: roomIdx + 1, item: q.item, t: played });
        p.answers++; if (correct) p.right++;
        if (p.cfg.recorded) p.cfg.queue.record(q, correct);
        if (!correct) {
          const line = q.display.kind === 'trio' ? (q.teach?.line || '') : (q.display.plain || q.display.sentence || '').replace(/_{2,}/, q.answer);
          if (line) missed.set(line, (missed.get(line) || 0) + 1);
        }
        onEvent('answer', { player: p.pi + 1, correct, object: s.def.type });
        updateHud();
      },
      done(correct) {
        p.card = false;
        if (correct) onRight();
      },
    });
  }

  function use(p) {
    if (p.holding) { release(p); return; }
    const s = usable(p);
    if (!s) {
      const door = [...objs.values()].find((d) => d.def.type === 'door' && !d.open && inRange(p, d.def));
      if (door && !p.carrying) { toast(p, t('needLever')); return; }
      if (p.role === 'strong') carryOrDrop(p);
      return;
    }
    const o = s.def;
    switch (o.type) {
      case 'heavylever':
        if (p.role !== 'strong') { toast(p, t('needStrong')); return; }
        ask(p, s, () => { s.on = true; o.targets.forEach(activate); });
        return;
      case 'lever': case 'switch': case 'post':
        ask(p, s, () => { s.on = true; o.targets.forEach(activate); });
        return;
      case 'gate':
        if (p.role !== 'strong') { toast(p, t('needStrong')); return; }
        if (p.carrying) { toast(p, t('needStrong')); return; }
        ask(p, s, () => { s.open = true; s.held = true; s.wantSolid = false; p.holding = s; sfx('open'); toast(p, t('holding')); });
        return;
      case 'locked':
        if (!p.hasKey) { toast(p, t('needKey')); return; }
        ask(p, s, () => { s.open = true; s.wantSolid = false; p.hasKey = false; p.key.visible = false; sfx('open'); });
        return;
      case 'key':
        ask(p, s, () => { s.taken = true; p.hasKey = true; p.key.visible = true; sfx('key'); });
        return;
      case 'portal':
        if (s.active) { teleport(p, s); return; }
        ask(p, s, () => { s.active = true; const pair = objs.get(o.pair); if (pair) pair.active = true; sfx('portal'); });
        return;
      case 'exit':
        ask(p, s, () => { s.open = true; sfx('open'); showBanner(t('bothExit'), 3); });
        return;
    }
  }

  function release(p) {
    const s = p.holding; if (!s) return;
    p.holding = null; s.held = false;
    if (!s.propped) { s.open = false; s.wantSolid = true; }
  }

  function teleport(p, from) {
    const to = objs.get(from.def.pair); if (!to) return;
    const b = p.body;
    b.x = to.def.x + 0.5 - b.w / 2; b.y = to.def.y + 0.02; b.vx = 0; b.vy = 0;
    b.support = null;
    p.portalCd = 0.6; p.inZone.add(to.def.id);
    if (p.carrying) { /* the crate comes along */ }
    sfx('portal');
  }

  function carryOrDrop(p) {
    const b = p.body;
    if (p.carrying) {
      const box = p.carrying;
      const tryAt = (x, y) => {
        const cells = [];
        for (let cy = Math.floor(y + 0.01); cy <= Math.floor(y + box.h - 0.01); cy++)
          for (let cx = Math.floor(x + 0.01); cx <= Math.floor(x + box.w - 0.01); cx++) cells.push([cx, cy]);
        if (cells.some(([cx, cy]) => world.solid(cx, cy))) return false;
        for (const o of world.bodies) {
          if (o === box || o.carried || o === b) continue;
          if (x < o.x + o.w && x + box.w > o.x && y < o.y + o.h && y + box.h > o.y) return false;
        }
        box.x = x; box.y = y; return true;
      };
      const fx = b.facing > 0 ? b.x + b.w + 0.04 : b.x - box.w - 0.04;
      if (tryAt(fx, b.y + 0.02) || tryAt(fx, b.y + 1.02) || tryAt(fx, b.y + 2.02)) {
        box.carried = false; box.vy = 0; box.onGround = false; p.carrying = null; sfx('thud');
      } else toast(p, '✋');
      return;
    }
    // pick up a crate right in front, at foot level
    for (const box of boxes) {
      if (box.static || box.carried) continue;
      const front = b.facing > 0 ? box.x - (b.x + b.w) : b.x - (box.x + box.w);
      if (front > -0.05 && front < 0.35 && Math.abs(box.y - b.y) < 0.3) {
        // nothing standing on it
        if (world.bodies.some((o) => o.support === box && o.onGround)) continue;
        box.carried = true; p.carrying = box; sfx('select');
        return;
      }
    }
  }

  // ── per frame ───────────────────────────────────────────────────────────────────────
  const tmp = new THREE.Vector3();
  function toScreen(x, y, z = 0) {
    tmp.set(x, y, z).project(camera);
    return { x: (tmp.x + 1) / 2 * window.innerWidth, y: (1 - tmp.y) / 2 * window.innerHeight, ok: tmp.z < 1 };
  }

  function updateHud() {
    const n = log.length, r = log.filter((a) => a.correct).length;
    hudScore.textContent = `✓ ${r} / ${n}`;
  }

  let paused = false;
  let manual = false;    // tests: frames only advance through debug.advance()
  const STEP = 1 / 120;
  let acc = 0;

  function frame(dt) {
    if (state !== 'playing' && state !== 'roomDone') return;
    if (paused) return;
    played += dt;
    hudTime.textContent = fmtTime(played);

    // inputs
    const inputs = new Map();
    for (const p of players) {
      const r = input.read(p.pi);
      if (p.card) continue;
      if (p.holding) {
        if (r.anyMovePressed || r.actionPressed) release(p);
        continue;
      }
      if (r.actionPressed && state === 'playing') use(p);
      if (p.card || p.holding) continue;
      inputs.set(p.body, r);
    }

    acc = Math.min(acc + dt, STEP * 8);
    while (acc >= STEP) {
      world.step(STEP, inputs);
      for (const r of inputs.values()) r.jumpPressed = false;
      acc -= STEP;
    }
    syncSolids();

    // portals: walking into an active portal
    for (const p of players) {
      p.portalCd = Math.max(0, p.portalCd - dt);
      for (const s of objs.values()) {
        if (s.def.type !== 'portal') continue;
        const inside = inRange(p, s.def);
        if (!inside) { p.inZone.delete(s.def.id); continue; }
        if (s.active && !p.inZone.has(s.def.id) && p.portalCd <= 0 && !p.card) { teleport(p, s); break; }
        p.inZone.add(s.def.id);
      }
    }

    // carried crates ride on the strong one's head
    for (const p of players) {
      if (!p.carrying) continue;
      const b = p.body;
      p.carrying.x = b.x + b.w / 2 - p.carrying.w / 2;
      p.carrying.y = b.y + b.h + 0.05;
    }

    // fell out of the room somehow → back to the spawn
    for (const p of players) if (p.body.y < -3) {
      const [sx, sy] = room.spawn[p.role]; p.body.x = sx - p.body.w / 2; p.body.y = sy; p.body.vy = 0;
    }

    // room done when both stand in the open exit
    const ex = room.objects.find((o) => o.type === 'exit');
    const exS = objs.get(ex.id);
    if (state === 'playing' && exS.open && players.every((p) => {
      const b = p.body; const cx = b.x + b.w / 2;
      return Math.abs(cx - ex.x) < 1.05 && b.y >= ex.y - 0.1 && b.y < ex.y + 1;
    })) {
      state = 'roomDone'; roomDoneAt = performance.now();
      cards.closeAll(); players.forEach((p) => { p.card = false; });
      sfx('room'); showBanner(t('roomDone'), 1.8);
      const secs = played - roomStart;
      const rl = log.filter((a) => a.room === roomIdx + 1);
      console.info(`[duo] room ${roomIdx + 1}: ${rl.length} answers in ${secs.toFixed(0)} s`);
      onEvent('roomDone', { room: roomIdx + 1, seconds: secs, answers: rl.length });
    }
    if (state === 'roomDone' && performance.now() - roomDoneAt > 1900) {
      if (roomIdx + 1 < ROOMS.length) loadRoom(roomIdx + 1);
      else { state = 'done'; onEvent('done', summary()); }
    }
  }

  function render(dt) {
    if (!room) return;
    // views
    for (const [id, v] of view.views) v.update(objs.get(id), dt);
    for (const b of boxes) {
      b.mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, 0);
      if (b.landed) { b.landed = false; sfx('thud'); }
    }
    const now = performance.now();
    for (const m of markers) {
      const s = objs.get(m.id);
      m.sprite.visible = needsAnswer(s);
      const a = m.base;
      m.sprite.position.set(a.x, a.y + a.top + Math.sin(now / 300 + a.x) * 0.08, 0.6);
    }
    // figures
    for (const p of players) {
      const b = p.body, f = p.fig;
      f.root.position.set(b.x + b.w / 2, b.y, 0);
      let st = 'idle';
      if (p.card) { st = 'answer'; f.face(0, false, true); }
      else if (p.holding) { st = 'hold'; f.face(p.holding.def.x + 0.5 > b.x ? 1 : -1); }
      else if (b.climbing) { st = 'climb'; f.face(0, true); }
      else {
        if (!b.onGround) st = 'jump';
        else if (b.pushing && Math.abs(b.vx) > 0.2) st = 'push';
        else if (Math.abs(b.vx) > 0.4) st = p.role === 'climber' ? 'run' : 'walk';
        f.face(b.facing || 1);
      }
      if (b.jumped) { b.jumped = false; sfx('jump'); }
      f.setState(st);
      f.update(dt);
      p.key.position.set(0, (ROLES[p.role].look + 0.35) / f.root.scale.y, 0);
    }
    // camera: frame both players, never more than the room
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const xs = players.map((p) => p.body.x + p.body.w / 2), ys = players.map((p) => p.body.y + p.body.h / 2);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const reqW = Math.max(20, maxX - minX + 11), reqH = Math.max(11, maxY - minY + 7);
    let visH = Math.max(reqH, reqW / aspect);
    const maxH = Math.max(H + 0.6, (W + 0.6) / aspect);
    visH = Math.min(visH, maxH);
    const visW = visH * aspect;
    let cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + 0.6;
    cx = visW >= W ? W / 2 : Math.max(visW / 2, Math.min(W - visW / 2, cx));
    cy = visH >= H ? H / 2 : Math.max(visH / 2, Math.min(H - visH / 2, cy));
    const k = cam.init ? Math.min(1, dt * 3) : 1;
    cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; cam.h += (visH - cam.h) * k; cam.init = true;
    camera.aspect = aspect;
    const dist = (cam.h / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(cam.x, cam.y + 1.2, dist);
    camera.lookAt(cam.x, cam.y, 0);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    // DOM: cards, prompts, toasts, player tags
    const pos = players.map((p) => {
      const b = p.body;
      return toScreen(b.x + b.w / 2, b.y + ROLES[p.role].look + 0.3);
    });
    cards.place(pos.map((s, i) => (players[i].card ? s : null)));
    players.forEach((p, i) => {
      const tg = tags[i];
      tg.style.transform = `translate(${Math.round(pos[i].x - 11)}px, ${Math.round(pos[i].y - 30)}px)`;
      tg.hidden = p.card;
      // prompt over the object this player could use
      const pr = prompts[i];
      const s = state === 'playing' && !p.card && !p.holding ? usable(p) : null;
      if (s) {
        const a = anchor(s.def);
        const sp = toScreen(a.x + (i ? 0.32 : -0.32), a.y + a.top + 0.45, 0.6);
        pr.hidden = false;
        pr.style.transform = `translate(${Math.round(sp.x - 18)}px, ${Math.round(sp.y - 16)}px)`;
      } else pr.hidden = true;
      const tt = toasts[i];
      if (!tt.el.hidden) {
        if (now > tt.until || p.card) tt.el.hidden = true;
        else tt.el.style.transform = `translate(${Math.round(pos[i].x - tt.el.offsetWidth / 2)}px, ${Math.round(pos[i].y - 70)}px)`;
      }
    });
    if (!banner.hidden && now > bannerUntil) banner.hidden = true;
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  window.addEventListener('resize', resize);
  resize();

  let raf = 0, last = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!manual) frame(dt);
    render(paused ? 0 : dt);
  }

  function summary() {
    const n = log.length, r = log.filter((a) => a.correct).length;
    const per = players.map((p) => ({ name: p.cfg.name, role: p.role, answers: p.answers, right: p.right, recorded: !!p.cfg.recorded }));
    return { answers: n, right: r, pct: n ? Math.round((r / n) * 100) : 0, seconds: played, minutes: played / 60,
      perAnswerSeconds: n ? played / n : 0, players: per, missed: [...missed.keys()] };
  }

  return {
    start() { played = 0; log.length = 0; missed.clear(); players.forEach((p) => { p.answers = 0; p.right = 0; }); updateHud(); loadRoom(0); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); },
    pause(b) { paused = !!b; input.clear(); },
    restartRoom() { paused = false; loadRoom(roomIdx); },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      cards.closeAll();
      view?.dispose();
      players.forEach((p) => p.fig.dispose());
      overlay.innerHTML = '';
      renderer.dispose();
    },
    get state() { return state; },
    summary,
    debug: {
      room: () => roomIdx + 1,
      state: () => state,
      players: () => players.map((p) => ({ pi: p.pi, role: p.role, x: p.body.x, y: p.body.y, w: p.body.w, h: p.body.h, vx: p.body.vx,
        onGround: p.body.onGround, climbing: !!p.body.climbing, card: p.card, hasKey: p.hasKey, holding: p.holding?.def.id || null,
        carrying: !!p.carrying, near: usable(p)?.def.id || null, figure: p.fig.char, built: p.fig.built })),
      objects: () => Object.fromEntries([...objs].map(([id, s]) => [id, { type: s.def.type, on: s.on, open: s.open, held: s.held,
        propped: s.propped, taken: s.taken, active: s.active, solid: s.solid }])),
      boxes: () => boxes.map((b) => ({ x: b.x, y: b.y, carried: !!b.carried, static: !!b.static })),
      // tests: run the simulation without drawing (headless software GL is ~4 fps)
      manual(b) { manual = !!b; },
      advance(seconds, dt = 1 / 60) { for (let s = 0; s < seconds; s += dt) frame(dt); },
      press: (pi, b) => input._press(pi, b),
      release: (pi, b) => input._release(pi, b),
      teleport(pi, x, y) { const b = players[pi].body; b.x = x - b.w / 2; b.y = y; b.vx = 0; b.vy = 0; b.support = null; },
      card: (pi) => cards.peek(pi),
      log: () => log.slice(),
      summary,
    },
  };
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
