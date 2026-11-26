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
import { connectLive } from '/lib/krabsy-live.js?v=2026-11-26';

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
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let cssDone = false;
function loadCss() {
  if (cssDone) return; cssDone = true;
  for (const href of ['/lib/fonts/krabsy-fonts.css', '/lib/activities/activities.css?v=2026-11-26', '/lib/krabsy-live.css?v=2026-11-26']) {
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

  const live = connectLive({
    hello: { role: 'student', key },
    on: {
      ready(m) {
        if (m.tutor) tutorName = m.tutor;
        if (typeof m.adult === 'boolean') isAdult = m.adult;
        setBanner(null);
        if (document.hidden) live.focus(false);
        const L = m.lesson;
        if (!L) { if (view && !view.classList.contains('is-done')) closeView(); return; }
        openView();
        if (!L.material) { if (player) unmount(); waiting(); return; }
        if (player && sig(L.material) === matSig) {
          // our screen is newer than the relay's copy (we were offline): send it
          const s = player.getState(); if (s) live.state(s);
          return;
        }
        mount(L.material, L.state);
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
            if (L.material && sig(L.material) !== matSig) mount(L.material, L.state);
            else if (!player) waiting();
            break;
          }
          case 'load': openView(); mount(m.material, null); break;
          case 'cmd': if (player) player.cmd({ type: m.type, step: m.step, page: m.page }); break;
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

  async function mount(material, state) {
    unmount();
    const el = stage(); if (!el || !material) return;
    el.innerHTML = '<div class="kl-lesson-player"></div>';
    const host = el.firstChild;
    mat = material; matSig = sig(material);
    let mod;
    try { mod = await import('/lib/activities/player.js?v=2026-11-26'); } catch (e) { console.error('live: player', e); return; }
    if (mat !== material || !host.isConnected) return;
    const p = mod.mountMaterial(host, material, {
      role: 'student', lang, adult: isAdult,
      state: state && state.kind ? state : undefined,
      onState: (s) => live.state(s),
      onCursor: (pos) => live.cursor(pos),
      onAnswer: (a) => live.answer(Object.assign({}, a, { mat: material.id || null })),
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
    if (player && player.reward) { try { player.reward({ kind: gift ? 'gift' : 'star', g: gift ? GIFTS[Math.floor(Math.random() * GIFTS.length)] : undefined }); } catch (_) {} }
    const o = document.createElement('div');
    o.className = 'kt-burst kl-burst';
    o.innerHTML = `<div><span class="kt-burst-ico">${gift ? '🎁' : '⭐'}</span><p>${esc(gift ? T.gift(tutorName) : T.star(tutorName))}</p></div>`;
    document.body.appendChild(o);
    const t = setTimeout(() => o.remove(), 2600);
    o.addEventListener('click', () => { clearTimeout(t); o.remove(); });
    if (gift) {
      try {
        const ui = await import('/lib/krabsy-gifts-ui.js');
        const rw = await import('/lib/krabsy-rewards.js');
        const g = rw.grantGift({ source: 'tutor' });
        if (g && g.ok) setTimeout(() => ui.showGifts([g], { lang: 'en' }), 1400);
      } catch (_) { /* the burst is enough */ }
    }
  }

  /* ── lesson over ──────────────────────────────────────────────────────── */
  function ended(summary) {
    if (!view) return;
    unmount();
    view.classList.add('is-done');
    const s = summary && typeof summary === 'object' ? summary : {};
    const el = stage();
    el.innerHTML = `<div class="kl-wait kl-done"><span class="kl-wait-pic" aria-hidden="true">${isAdult ? '✅' : '🎉'}</span>
      <h2>${esc(isAdult ? T.doneAdultH : T.doneH)}</h2><p>${esc(T.doneP(tutorName))}</p>
      ${s.total ? `<p class="kl-done-score">${esc(T.doneRight(s.first || 0, s.total))}</p>` : ''}
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
