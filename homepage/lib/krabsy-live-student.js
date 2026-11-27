/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — live classroom, student side (docs/live-classroom.md, WP L4)

   Runs on the student's own page /en/spanish/me/ (krabsy-tutor.js renderMe
   calls startLiveStudent once the student key is known). While the page is
   open it keeps one WebSocket to the relay. When the tutor starts a lesson a
   full-screen lesson view opens over the page:
     waiting card  "Nora is getting the next thing ready" until a material loads
     player        the real activity player / book (role 'student'): its state,
                   pointer and answers go to the tutor's mirror
     tutor         point (pulse), hint / show answer / next / prev (cmd),
                   star / gift (celebration as in v1; adults: star only)
     end           a short "Lesson done" card, then back to the normal page
   Page hidden → focus {visible:false}. A reload resumes from the relay's
   snapshot (material + last state).
   ────────────────────────────────────────────────────────────────────────── */
import { connectLive } from '/lib/krabsy-live.js?v=2026-11-27';

const T = {
  bar: (t) => `Lesson with ${t}`,
  waitH: (t) => `${t} is getting the next thing ready`,
  waitP: 'Stay here. It opens by itself.',
  waitAdultP: 'It opens here by itself.',
  doneH: 'Lesson done!', doneAdultH: 'Lesson finished',
  doneP: (t) => `Thank you for learning with ${t}.`,
  doneRight: (r, n) => `${r} of ${n} right on the first try`,
  back: 'Back to my page',
  star: (t) => `${t} sent you a star!`, gift: (t) => `${t} sent you a gift!`,
  retry: 'Connecting again …',
  replaced: 'The lesson is open in another tab or on another device.', useHere: 'Use it here',
};
const GIFTS = ['🎁', '🎈', '🍦', '🏆'];
const GIFT_KEY = 'krabsy_live_gifts';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cssDone = false;
function loadCss() {
  if (cssDone) return; cssDone = true;
  for (const href of ['/lib/fonts/krabsy-fonts.css?v=2026-11-26f', '/lib/activities/activities.css?v=2026-11-26', '/lib/krabsy-live.css?v=2026-11-27']) {
    if (document.querySelector(`link[href="${href}"]`)) continue;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
}

/**
 * Connect the student's page to the live room.
 *   key    the student key (student token)
 *   tutor  the tutor's name, adult: calmer view (no gifts)
 * → { close() }
 */
export function startLiveStudent({ key, tutor = '', adult = false, lang = 'en' } = {}) {
  loadCss();
  let view = null;          // the lesson layer (null = normal page)
  let player = null, mat = null, matSig = '';
  let tutorName = tutor || 'Your tutor';
  let isAdult = !!adult;
  let endT = null;
  let unsent = [];          // answers given while offline: sent after the reconnect (≤ 50)

  const live = connectLive({
    hello: { role: 'student', key },
    on: {
      ready(m) {
        if (m.tutor) tutorName = m.tutor;
        if (typeof m.adult === 'boolean') isAdult = m.adult;
        setBanner(null);
        if (document.hidden) live.focus(false);
        const L = m.lesson;
        const queued = unsent; unsent = [];
        if (!L) { if (view && !view.classList.contains('is-done')) closeView(); return; }
        for (const a of queued) live.answer(a);
        openView();
        if (!L.material) { if (player) unmount(); waiting(); return; }
        if (player && sig(L.material) === matSig) {
          // our screen is newer than the relay's copy (we were offline): send it
          const s = player.getState(); if (s) live.state(s);
          return;
        }
        mount(L.material, bestState(L.material, L.state, L.state_at));
      },
      status(s) { if (view) view.classList.toggle('is-retry', s === 'retry'); },
      fatal(code) {
        if (code === 'replaced') setBanner('replaced');
        // auth: the key no longer works (new link) — the normal page shows that already
      },
      message(m) {
        switch (m.t) {
          case 'start': {
            openView();
            const L = m.lesson || {};
            if (L.material && sig(L.material) !== matSig) mount(L.material, bestState(L.material, L.state, L.state_at));
            else if (!player) waiting();
            break;
          }
          case 'load': {
            openView();
            if (m.fresh) { dropBackup(m.material); mount(m.material, null); break; }       // "Start again"
            if (player && sig(m.material) === matSig) { const s = player.getState(); if (s) live.state(s); break; }  // same material: keep the progress
            const b = backupFor(m.material);
            mount(m.material, b ? b.state : null);
            break;
          }
          case 'cmd': if (player) player.cmd({ type: m.type, step: m.step, page: m.page, a: m.a, kind: m.kind, text: m.text }); break;
          case 'point': if (player) player.point({ a: m.a, x: m.x, y: m.y }); break;
          case 'reward': reward(m.kind); break;
          case 'end': ended(m.summary); break;
          default: break;
        }
      },
    },
  });

  const onVis = () => live.focus(!document.hidden);
  document.addEventListener('visibilitychange', onVis);

  function sig(material) { return material ? `${material.id || ''}|${material.title || ''}|${JSON.stringify(material).length}` : ''; }

  /* ── the lesson layer ─────────────────────────────────────────────────── */
  function openView() {
    clearTimeout(endT);
    if (view && !view.classList.contains('is-done')) return;
    if (view) view.remove();
    view = document.createElement('section');
    view.className = 'kl-lesson';
    view.setAttribute('role', 'dialog'); view.setAttribute('aria-modal', 'true'); view.setAttribute('aria-label', T.bar(tutorName));
    view.innerHTML = `<header class="kl-lesson-bar"><span class="kl-dot" aria-hidden="true"></span><b>${esc(T.bar(tutorName))}</b>
        <span class="kl-lesson-retry">${esc(T.retry)}</span><span class="kl-grow"></span><span class="kl-lesson-banner" hidden></span></header>
      <div class="kl-lesson-stage" data-stage></div>`;
    document.body.appendChild(view);
    document.documentElement.classList.add('kl-locked');
  }
  function closeView() {
    clearTimeout(endT);
    unmount();
    if (view) view.remove();
    view = null;
    document.documentElement.classList.remove('kl-locked');
    showGiftsLater();
  }
  const stage = () => view && view.querySelector('[data-stage]');
  function setBanner(kind) {
    if (!view) { if (kind === 'replaced') { openView(); waiting(); } else return; }
    const b = view.querySelector('.kl-lesson-banner');
    if (!kind) { b.hidden = true; b.innerHTML = ''; return; }
    b.hidden = false;
    b.innerHTML = `${esc(T.replaced)} <button type="button" class="kl-btn kl-btn-sm">${esc(T.useHere)}</button>`;
    b.querySelector('button').addEventListener('click', () => { setBanner(null); live.reconnect(); });
  }

  function waiting() {
    const el = stage(); if (!el) return;
    el.innerHTML = `<div class="kl-wait"><span class="kl-wait-pic" aria-hidden="true">${isAdult ? '☕' : '🦀'}</span>
      <h2>${esc(T.waitH(tutorName))}</h2><p>${esc(isAdult ? T.waitAdultP : T.waitP)}</p>
      <span class="kl-wait-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
  }

  // Local backup of the progress per material (owner 2026-11-27: progress must survive a
  // connection error or a server restart). The relay saves it too; whichever is newer wins.
  const BK = 'krabsy_live_states';
  const readBk = () => { try { return JSON.parse(localStorage.getItem(BK) || '{}') || {}; } catch (_) { return {}; } };
  const writeBk = (o) => { try { localStorage.setItem(BK, JSON.stringify(o)); } catch (_) {} };
  let bkTimer = null, bkPending = null;
  function saveBackup(material, state) {
    bkPending = [sig(material), state];
    if (bkTimer) return;
    bkTimer = setTimeout(() => {
      bkTimer = null; if (!bkPending) return;
      const [k, st] = bkPending; bkPending = null;
      const o = readBk(); o[k] = { at: Date.now(), state: st };
      const keys = Object.keys(o).sort((a, b) => o[b].at - o[a].at); keys.slice(12).forEach((x) => delete o[x]);
      writeBk(o);
    }, 800);
  }
  function backupFor(material) {
    const e = readBk()[sig(material)];
    return e && Date.now() - e.at < 3 * 3600 * 1000 ? e : null;
  }
  function dropBackup(material) { const o = readBk(); delete o[sig(material)]; writeBk(o); }
  // the newer of the relay's copy (state_at, seconds) and the local backup (at, ms)
  function bestState(material, relayState, relayAt) {
    const b = backupFor(material);
    if (relayState && relayState.kind && (!b || (relayAt || 0) * 1000 >= b.at)) return relayState;
    return b ? b.state : (relayState || null);
  }

  async function mount(material, state) {
    unmount();
    const el = stage(); if (!el || !material) return;
    el.innerHTML = '<div class="kl-lesson-player"></div>';
    const host = el.firstChild;
    mat = material; matSig = sig(material);
    let mod;
    try { mod = await import('/lib/activities/player.js?v=2026-11-27c'); } catch (e) { console.error('live: player', e); return; }
    if (mat !== material || !host.isConnected) return;
    const p = mod.mountMaterial(host, material, {
      role: 'student', lang, adult: isAdult,
      state: state && state.kind ? state : undefined,
      onState: (s) => { live.state(s); saveBackup(material, s); },
      onCursor: (pos) => live.cursor(pos),
      onAnswer: (a) => {
        const msg = Object.assign({}, a, { mat: material.id || null });
        if (!live.answer(msg)) { unsent.push(msg); if (unsent.length > 50) unsent.shift(); }
      },
      onEnd: () => {},
    });
    player = p;
    // a fresh mount: the tutor's mirror gets the first state at once
    Promise.resolve(p.ready).then(() => { if (player === p) { const s = p.getState(); if (s) live.state(s); } });
  }
  function unmount() {
    if (player) { try { player.destroy(); } catch (_) {} }
    player = null; mat = null; matSig = '';
  }

  /* ── star / gift: the player's own celebration (also on the mirror) plus the v1 burst ── */
  async function reward(kind) {
    const gift = kind === 'gift' && !isAdult;
    let shown = false;
    if (player && player.reward) { try { player.reward({ kind: gift ? 'gift' : 'star', g: gift ? GIFTS[Math.floor(Math.random() * GIFTS.length)] : undefined }); shown = gift; } catch (_) {} }
    const o = document.createElement('div');
    o.className = 'kt-burst kl-burst';
    o.innerHTML = `<div><span class="kt-burst-ico">${gift ? '🎁' : '⭐'}</span><p>${esc(gift ? T.gift(tutorName) : T.star(tutorName))}</p></div>`;
    if (!shown) document.body.appendChild(o);       // a gift: the player's own card is the one message
    const t = setTimeout(() => o.remove(), 2600);
    o.addEventListener('click', () => { clearTimeout(t); o.remove(); });
    if (gift) {
      // The gift is owned at once; its card ("Have a look →" leads to the figure page)
      // waits until the lesson view closes, so it never covers the lesson or leads away.
      // (krabsy-live.css also hides the site's own gift popup while the lesson layer is open)
      try {
        const rw = await import('/lib/krabsy-rewards.js');
        const g = rw.grantGift({ source: 'tutor' });
        if (g && g.ok) { const l = lessonGifts(); l.push(g); lessonGifts(l); }
      } catch (_) { /* the burst is enough */ }
    }
  }
  // this lesson's gifts, kept per tab so a reload in the lesson does not lose the card
  function lessonGifts(set) {
    try {
      if (set) { if (set.length) sessionStorage.setItem(GIFT_KEY, JSON.stringify(set.slice(-10))); else sessionStorage.removeItem(GIFT_KEY); return set; }
      const v = JSON.parse(sessionStorage.getItem(GIFT_KEY) || '[]'); return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }
  async function showGiftsLater() {
    if (document.querySelector('.k-gift')) { lessonGifts([]); return; }   // the site's popup card is there: it shows now
    try {
      const rw = await import('/lib/krabsy-rewards.js');
      const list = rw.takePending();
      for (const g of lessonGifts()) if (!list.some((x) => x.id === g.id)) list.push(g);
      lessonGifts([]);
      if (!list.length) return;
      const ui = await import('/lib/krabsy-gifts-ui.js');
      setTimeout(() => ui.showGifts(list, { lang: 'en' }), 400);
    } catch (_) { /* no card then; the gifts are owned anyway (header "new" badge) */ }
  }

  /* ── lesson over ──────────────────────────────────────────────────────── */
  function ended(summary) {
    writeBk({});                       // a new lesson starts its materials fresh
    if (!view) return;
    unmount();
    view.classList.add('is-done');
    const s = summary && typeof summary === 'object' ? summary : {};
    const el = stage();
    el.innerHTML = `<div class="kl-wait kl-done"><span class="kl-wait-pic" aria-hidden="true">${isAdult ? '✅' : '🎉'}</span>
      <h2>${esc(isAdult ? T.doneAdultH : T.doneH)}</h2><p>${esc(T.doneP(tutorName))}</p>
      ${s.total && isAdult ? `<p class="kl-done-score">${esc(T.doneRight(s.first || 0, s.total))}</p>` : ''}
      <button type="button" class="kl-btn kl-btn-primary" data-back>${esc(T.back)}</button></div>`;
    el.querySelector('[data-back]').addEventListener('click', closeView);
    el.querySelector('[data-back]').focus();
    endT = setTimeout(closeView, 12000);
  }

  return {
    close() { document.removeEventListener('visibilitychange', onVis); live.close(); closeView(); },
    get connected() { return live.connected; },
  };
}
