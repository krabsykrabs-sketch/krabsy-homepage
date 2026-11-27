/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — live classroom, tutor page (docs/live-classroom.md, WP L4)

   /en/spanish/tutors/live/#s=<tutor student id>
     &start=1      (from the "Start live lesson" buttons) start the lesson at once
     &w=<id>       also show this saved v1 worksheet first
     &qp=<topic>   open "Quick practice" for this topic
     &t=<token>    old private-link spaces (krabsy-tutor.js LEGACY)
   Zoom stays for face and voice. The student's page renders the material
   itself; this page shows a MIRROR of it (the real player, role 'mirror')
   from the student's state, with their pointer as a ghost hand. The tutor
   points (click on the mirror), gives hints, shows answers, moves on, sends
   stars / gifts, builds the lesson queue on the fly (+ Add: Krabsy materials,
   quick practice, saved worksheets), sees the answers come in, keeps notes and
   ends the lesson with a summary saved as the lesson note.
   Layout: one column up to 1100 px (mirror, control bar, tabs), two above.
   Reload resumes: the relay keeps material, state, queue and answers.
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase } from '/lib/krabsy-class.js?v=2026-11-25b';
import { connectLive } from '/lib/krabsy-live.js?v=2026-11-26';
import { mountMaterial } from '/lib/activities/player.js?v=2026-11-27';
import { runningLessons, markRunning, markEnded } from '/lib/krabsy-live-running.js?v=2026-11-27';

const LANG = 'en';
const SPACE = '/en/spanish/tutors/space/';
const T = {
  live: 'LIVE', notLive: 'Ready',
  here: (n) => `${n} is here`, away: (n) => `${n} left the lesson tab`, notYet: (n) => `${n} is not here yet — send the link`,
  gone: (n) => `${n} left the lesson — ask them to open their page again`,
  copyLink: 'Copy link', copied: 'Copied ✓', reconnecting: 'Reconnecting …',
  replaced: 'This lesson is open in another tab.', useHere: 'Use it here',
  start: 'Start lesson', end: 'End lesson', profile: '← Profile', students: 'All students',
  keepsRunning: 'The lesson keeps running while you look at other pages. Come back with “Back to the lesson”.',
  tooMany: (names, oldest) => `You already have 3 live lessons running (${names}). Starting this one ends the lesson with ${oldest}.\n\nStart anyway?`,
  sees: (n) => `${n} sees`, nothing: 'Nothing on the screen yet',
  waitH: (t) => `${t} is getting the next thing ready`, waitP: 'This is what the student sees between materials.',
  addFirst: '+ Add material', startH: (n) => `Live lesson with ${n}`,
  startLead: (n) => `${n} opens their personal page (the bookmark). When you start, it switches to the lesson by itself. Keep Zoom for face and voice; nobody shares a screen.`,
  lastEnded: (t) => `The last lesson ended at ${t}.`,
  hint: '💡 Hint', reveal: 'Show answer', prev: '◀', next: '▶', prevL: 'Back', nextL: 'Next',
  star: '⭐', gift: '🎁', point: '◎ Point', pointTip: 'Left click on the screen: do it for the student. Right click: point. On a tablet switch Point on to point with a tap.',
  did: 'Done on their screen ✓', typeFor: (n) => `Type for ${n}`, typeHint: 'Enter = check', mouseHelp: 'Left click: do it · Right click: point',
  pointed: 'Pointed ✓', starSent: '⭐ sent', giftSent: '🎁 sent',
  nextItem: (t) => `Next: ${t} ▸`, finished: 'Finished ✓',
  tabQueue: 'Lesson', tabAnswers: 'Answers', tabNotes: 'Notes',
  queueH: 'This lesson', queueNone: 'Nothing in the lesson yet. Add a worksheet, a book or a quick practice.',
  add: '+ Add', up: 'Move up', down: 'Move down', remove: 'Remove', showNow: 'Show now', queueAdd: 'Add to list',
  answersH: 'Answers', answersNone: 'Answers appear here as they come.',
  firstTry: (r, n) => `<b>${r} of ${n}</b> right on the first try`, secondTry: 'later try', shownA: 'shown', rightIs: 'right:',
  notesH: 'Notes while teaching', notesPh: 'e.g. mixes up ser and estar with feelings',
  drawerH: 'Add to the lesson', dKrabsy: 'Krabsy materials', dQuick: 'Quick practice', dSaved: 'Saved worksheets',
  search: 'Search', kinds: { worksheet: 'Worksheet', book: 'Book', cards: 'Picture cards' },
  kindIco: { worksheet: '📄', book: '📖', cards: '🃏', quick: '⚡', v1: '📝' },
  min: (n) => `${n} min`,
  qpTopic: 'Topic', qpCount: 'Questions', qpMode: 'Answers', qpModes: [['typed', 'Type'], ['choice', 'Choose'], ['drag', 'Drag']],
  qpFocus: (n) => `Focus on the words to practise${n ? ` (${n})` : ''}`, qpMake: 'Making it …', qpFail: 'No questions for this topic.',
  qpTitle: (t) => `Quick practice: ${t}`,
  savedNone: 'No saved worksheets for this student yet (make them on the profile page).',
  savedMeta: (w) => `${w.count} questions · ${w.done ? `${w.done} done, ${w.right} right` : 'not started'}`,
  loadFail: 'Could not load this material.', tooBig: 'This material is too big to send.',
  offline: 'Not connected — it is sent when the connection is back.',
  offlineNow: 'Not connected — not sent. Try again in a moment.',
  endH: (n) => `End the lesson with ${n}?`, endMeta: (m, n, s) => `${m} min · ${n} material${n === 1 ? '' : 's'} · ⭐ ${s}`,
  endRight: 'Right on the first try', endWords: 'Words to practise', endNote: 'Lesson note (saved on the profile, editable)',
  keep: 'No, keep teaching', saveEnd: 'Yes, save and end', saving: 'Saving …', saveFail: 'Could not save the note. Try again.',
  savedH: 'Lesson saved ✓', savedP: (n) => `The note is on ${n}’s profile under Lesson notes.`,
  backTo: (n) => `Back to ${n}`, newLesson: 'Start a new lesson',
  notFinished: 'not finished',
  noteHead: (m) => `Live lesson · ${m} min`, noteWords: 'Words to practise', noteRight: (r, n) => `${r} of ${n} right on the first try`,
  needSignIn: 'Please sign in to open the live lesson.', signIn: 'Sign in', unknown: 'This student doesn’t exist (any more) in your space.',
  errNet: 'No connection. Try again in a moment.', noStudent: 'Open a student first.',
};
const KIND_ORDER = ['worksheet', 'book', 'cards'];
const MIRROR_H = 600;            // below this height the mirror is drawn at this size and scaled down

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function read(key, dflt) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? dflt; } catch (_) { return dflt; } }
function write(key, v) { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }

/* ── auth: same rules as krabsy-tutor.js (session token, or an old #t= link) ── */
function hashParams() {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = h.get('t');
  const legacy = !!(t && /^[A-Za-z0-9_-]{20,64}$/.test(t));
  const ses = read('krabsy_tutor_session', null);
  return { token: legacy ? t : (ses && ses.token) || null, legacy, sid: parseInt(h.get('s') || '', 10) || null,
    start: h.get('start') === '1', wid: parseInt(h.get('w') || '', 10) || null, qp: h.get('qp') || '' };
}
async function api(path, token, body) {
  const r = await fetch(apiBase() + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
    headers: Object.assign({ 'X-Tutor-Token': token }, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || 'http');
  return d;
}

/* ── catalogue: curated materials and topics ──────────────────────────────── */
let _index = null, _topics = null;
const materialIndex = () => (_index ||= fetch('/data/materials/index.json').then((r) => r.json()).catch(() => []));
const topicList = () => (_topics ||= fetch('/data/topics.json').then((r) => r.json()).then((t) =>
  Object.keys(t).filter((id) => t[id][LANG] && t[id].status !== 'coming_soon')
    .map((id) => ({ id, name: (t[id].display_name && (t[id].display_name[LANG] || t[id].display_name.de)) || id.replace(/^es_/, '').replace(/_/g, ' ') })))
  .catch(() => []));

/* ══ page ═════════════════════════════════════════════════════════════════ */
const main = document.querySelector('[data-live-page]');
if (main) boot(main);

async function boot(main) {
  const P = hashParams();
  if (!P.sid) { main.innerHTML = `<div class="kl-msg kc-card"><p>${T.noStudent}</p><p><a class="kc-btn" href="${SPACE}">${T.profile}</a></p></div>`; return; }
  if (!P.token) { main.innerHTML = `<div class="kl-msg kc-card"><p>${T.needSignIn}</p><p><a class="kc-btn" href="/en/spanish/tutors/">${T.signIn}</a></p></div>`; return; }
  let d;
  try { d = await api(`/api/tutor/student?id=${P.sid}`, P.token); }
  catch (e) {
    main.innerHTML = `<div class="kl-msg kc-card"><p>${e.message === 'unknown_student' ? T.unknown : T.errNet}</p><p><a class="kc-btn" href="${SPACE}">${T.profile}</a></p></div>`;
    return;
  }
  // keep only s (and t) in the address bar: a reload resumes, it does not start again
  try { history.replaceState(null, '', location.pathname + (P.legacy ? `#t=${P.token}&s=${P.sid}` : `#s=${P.sid}`)); } catch (_) {}
  new LivePage(main, P, d).run();
}

class LivePage {
  constructor(main, P, d) {
    this.main = main; this.P = P; this.d = d;
    this.name = d.student.name; this.adult = !!d.student.adult;
    this.tutor = read('krabsy_tutor_session', {})?.name || 'Your tutor';
    this.lesson = null;            // {started, ended}
    this.items = []; this.index = -1;
    this.material = null; this.state = null;
    this.answers = [];
    this.presence = { tutor: true, student: false, visible: false };
    this.mats = new Map();         // item key → material
    this.mirror = null; this.mirrorSig = '';
    this.pointOn = false; this.tab = 'queue'; this.firstReady = true; this.status = 'connecting';
    this.notesKey = `krabsy_live_notes:${P.sid}`;
    this.profileHref = SPACE + (P.legacy ? `#t=${P.token}&s=${P.sid}` : `#s=${P.sid}`);
    this.spaceHref = SPACE + (P.legacy ? `#t=${P.token}` : '');
    this.selfHref = location.pathname + (P.legacy ? `#t=${P.token}&s=${P.sid}` : `#s=${P.sid}`);
  }

  run() {
    this.shell();
    // keep this lesson on the device's "running" list while the page is open (krabsy-live-running.js)
    setInterval(() => this.trackRunning(), 60000);
    this.live = connectLive({
      hello: { role: 'tutor', token: this.P.token, student: this.P.sid },
      on: {
        ready: (m) => this.onReady(m),
        presence: (m) => { this.presence = m; this.header(); },
        status: (s) => { this.status = s; this.header(); },
        fatal: (code) => this.onFatal(code),
        message: (m) => this.onMessage(m),
      },
    });
    this.clock = setInterval(() => this.tick(), 1000);
  }

  /* ── layout ─────────────────────────────────────────────────────────────── */
  shell() {
    const n = esc(this.name);
    this.main.innerHTML = `
      <header class="kl-top">
        <span class="kl-badge" data-badge><span class="kl-dot"></span><span data-badge-t>${T.notLive}</span></span>
        <b class="kl-who">${n}</b>
        <span class="kl-pres" data-pres></span>
        <span class="kl-grow"></span>
        <span class="kl-clock" data-clock hidden>00:00</span>
        <a class="kl-btn kl-btn-dark" href="${esc(this.profileHref)}" title="${esc(T.keepsRunning)}">${T.profile}</a>
        <a class="kl-btn kl-btn-dark" href="${esc(this.spaceHref)}" title="${esc(T.keepsRunning)}">${T.students}</a>
        <button type="button" class="kl-btn kl-btn-primary" data-start hidden>${T.start}</button>
        <button type="button" class="kl-btn kl-btn-primary" data-end hidden>${T.end}</button>
      </header>
      <p class="kl-banner" data-banner hidden></p>
      <div class="kl-cols">
        <section class="kl-stagecol">
          <div class="kl-mirror-h"><h2>${T.sees(n)}</h2><span class="kl-mat" data-mattitle></span><span class="kl-mousehelp">${T.mouseHelp}</span></div>
          <div class="kl-mirror" data-mirror></div>
          <div class="kl-ctl" data-ctl role="toolbar" aria-label="Lesson controls">
            <button type="button" class="kl-btn" data-c="hint">${T.hint}</button>
            <button type="button" class="kl-btn" data-c="reveal">${T.reveal}</button>
            <span class="kl-ctl-pair"><button type="button" class="kl-btn" data-c="prev" aria-label="${T.prevL}" title="${T.prevL}">${T.prev}</button><button type="button" class="kl-btn" data-c="next" aria-label="${T.nextL}" title="${T.nextL}">${T.next}</button></span>
            <button type="button" class="kl-btn" data-reward="star" aria-label="Send a star" title="Send a star">${T.star}</button>
            ${this.adult ? '' : `<button type="button" class="kl-btn" data-reward="gift" aria-label="Send a gift" title="Send a gift">${T.gift}</button>`}
            <button type="button" class="kl-btn" data-point aria-pressed="false" title="${T.pointTip}">${T.point}</button>
            <button type="button" class="kl-btn kl-btn-primary" data-nextitem hidden></button>
            <button type="button" class="kl-btn kl-btn-add" data-add3 title="${T.drawerH}">${T.add}</button>
          </div>
        </section>
        <aside class="kl-side" data-tab="${this.tab}">
          <nav class="kl-tabs" role="tablist">
            <button type="button" role="tab" data-tabbtn="queue">${T.tabQueue}</button>
            <button type="button" role="tab" data-tabbtn="answers">${T.tabAnswers} <span class="kl-count" data-acount></span></button>
            <button type="button" role="tab" data-tabbtn="notes">${T.tabNotes}</button>
          </nav>
          <section class="kl-card kl-pane" data-pane="queue">
            <div class="kl-card-h"><h3>${T.queueH}</h3><button type="button" class="kl-btn kl-btn-sm kl-btn-primary" data-add>${T.add}</button></div>
            <ol class="kl-queue" data-queue></ol>
          </section>
          <section class="kl-card kl-pane" data-pane="answers">
            <div class="kl-card-h"><h3>${T.answersH}</h3><span class="kl-score" data-score></span></div>
            <ul class="kl-answers" data-answers></ul>
          </section>
          <section class="kl-card kl-pane" data-pane="notes">
            <h3>${T.notesH}</h3>
            <textarea class="kl-input" rows="5" maxlength="1500" data-notes placeholder="${esc(T.notesPh)}"></textarea>
          </section>
        </aside>
      </div>
      <div class="kl-toasts" data-toasts aria-live="polite"></div>`;
    const m = this.main;
    $('[data-notes]', m).value = read(this.notesKey, '') || '';
    $('[data-notes]', m).addEventListener('input', (e) => write(this.notesKey, e.target.value));
    $('[data-start]', m).addEventListener('click', () => this.startLesson());
    $('[data-end]', m).addEventListener('click', () => this.endDialog());
    $('[data-add]', m).addEventListener('click', () => this.drawer());
    $('[data-add3]', m).addEventListener('click', () => this.drawer());
    m.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { if (!this.live.cmd(b.dataset.c)) this.toast(T.offlineNow); }));
    m.querySelectorAll('[data-reward]').forEach((b) => b.addEventListener('click', () => {
      if (this.live.reward(b.dataset.reward)) this.toast(b.dataset.reward === 'gift' ? T.giftSent : T.starSent); else this.toast(T.offlineNow);
    }));
    $('[data-point]', m).addEventListener('click', (e) => {
      this.pointOn = !this.pointOn; e.currentTarget.classList.toggle('is-on', this.pointOn); e.currentTarget.setAttribute('aria-pressed', String(this.pointOn));
      $('[data-mirror]', m).classList.toggle('kl-pointing', this.pointOn);
    });
    $('[data-nextitem]', m).addEventListener('click', () => { if (this.index + 1 < this.items.length) this.show(this.index + 1); else this.drawer(); });
    m.querySelectorAll('[data-tabbtn]').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tabbtn)));
    const mir = $('[data-mirror]', m);
    mir.classList.toggle('kl-pointing', this.pointOn);
    // Left click: do it on the student's screen (live "act"). Right click (or Point switched
    // on, for tablets): point. Owner 2026-11-27: "click and point side by side".
    const pointAt = (e) => {
      const pos = this.mirror && this.mirror.anchorAt(e.clientX, e.clientY);
      if (!pos) return;
      this.mirror.point(pos);
      if (this.live.point(pos)) this.toast(T.pointed); else this.toast(T.offlineNow);
    };
    mir.addEventListener('contextmenu', (e) => { if (!this.mirror) return; e.preventDefault(); pointAt(e); });
    mir.addEventListener('click', (e) => {
      if (!this.mirror) return;
      if (this.pointOn) { pointAt(e); return; }
      const el = e.target.closest('[data-anchor]');
      if (!el || !mir.contains(el)) return;
      const a = el.dataset.anchor;
      const typed = el.matches('input.kp-type') ? el : (el.querySelectorAll('input.kp-type').length === 1 ? el.querySelector('input.kp-type') : null);
      if (typed && !typed.closest('.is-ok')) { this.typeBox(typed, typed.dataset.anchor || a); return; }
      if (!this.live.cmd('act', { kind: 'click', a })) { this.toast(T.offlineNow); return; }
      this.flashAt(e.clientX, e.clientY);
    });
    // the mirror is scaled down when there is less room than MIRROR_H (a laptop next to Zoom)
    if (window.ResizeObserver) new ResizeObserver(() => this.fitMirror()).observe(mir);
    this.setTab(this.tab);
    this.header(); this.renderStage(); this.renderQueue(); this.renderAnswers();
  }

  setTab(t) {
    this.tab = t;
    const side = $('.kl-side', this.main); side.dataset.tab = t;
    side.querySelectorAll('[data-tabbtn]').forEach((b) => { const on = b.dataset.tabbtn === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); });
    if (t === 'answers') side.querySelector('[data-tabbtn="answers"]').classList.remove('is-new');
  }

  active() { return !!(this.lesson && !this.lesson.ended); }

  // a small box over a typing gap in the mirror: the letters appear on the student's screen as you type
  typeBox(inputEl, a) {
    document.querySelector('.kl-typebox')?.remove();
    const r = inputEl.getBoundingClientRect();
    const box = document.createElement('div');
    box.className = 'kl-typebox';
    box.innerHTML = `<label>${esc(T.typeFor(this.name))}</label><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="80"><small>${esc(T.typeHint)}</small>`;
    Object.assign(box.style, { left: Math.max(8, Math.min(innerWidth - 260, r.left)) + 'px', top: (r.bottom + 6) + 'px' });
    document.body.appendChild(box);
    const inp = box.querySelector('input'); inp.value = inputEl.value || ''; inp.focus();
    this.live.cmd('act', { kind: 'click', a });
    const close = () => { box.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = (ev) => { if (!box.contains(ev.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    inp.addEventListener('input', () => this.live.cmd('act', { kind: 'type', a, text: inp.value }));
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); this.live.cmd('act', { kind: 'type', a, text: inp.value }); this.live.cmd('act', { kind: 'enter', a }); close(); this.toast(T.did); }
      else if (ev.key === 'Escape') close();
    });
  }

  flashAt(x, y) {
    const f = document.createElement('span'); f.className = 'kl-clickfx';
    Object.assign(f.style, { left: x + 'px', top: y + 'px' });
    document.body.appendChild(f); setTimeout(() => f.remove(), 600);
  }

  trackRunning() {
    if (this.active()) markRunning(this.P.sid, { name: this.name, started: this.lesson.started, href: this.selfHref });
    else markEnded(this.P.sid);
  }

  header() {
    this.trackRunning();
    const m = this.main; if (!m.isConnected) return;
    const n = this.name, p = this.presence;
    const pres = $('[data-pres]', m);
    if (p.student) this.seenStudent = true;
    let cls = 'is-away', txt = this.seenStudent ? T.gone(n) : T.notYet(n);
    if (p.student && p.visible) { cls = 'is-here'; txt = T.here(n); }
    else if (p.student) { cls = 'is-left'; txt = T.away(n); }
    const key = (read('krabsy_tutor_keys', {}) || {})['id:' + this.P.sid];
    pres.className = 'kl-pres ' + cls;
    pres.innerHTML = `<i></i><span>${esc(txt)}</span>${!p.student && key ? ` <button type="button" class="kl-linkbtn" data-copy>${T.copyLink}</button>` : ''}${this.status === 'retry' ? ` <em>${T.reconnecting}</em>` : ''}`;
    const cb = pres.querySelector('[data-copy]');
    if (cb) cb.addEventListener('click', async () => {
      const url = `${location.origin}/en/spanish/me/#k=${key}`;
      try { await navigator.clipboard.writeText(url); } catch (_) {}
      cb.textContent = T.copied; setTimeout(() => { cb.textContent = T.copyLink; }, 1600);
    });
    const on = this.active();
    $('[data-badge]', m).classList.toggle('is-live', on);
    $('[data-badge-t]', m).textContent = on ? T.live : T.notLive;
    $('[data-clock]', m).hidden = !on;
    $('[data-start]', m).hidden = on;
    $('[data-end]', m).hidden = !on;
    this.tick();
  }

  tick() {
    const c = $('[data-clock]', this.main); if (!c || !this.active()) return;
    const s = Math.max(0, Math.floor((Date.now() - Date.parse(this.lesson.started)) / 1000));
    const h = Math.floor(s / 3600), mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    c.textContent = h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  toast(text) {
    const box = $('[data-toasts]', this.main); if (!box) return;
    const t = document.createElement('div'); t.className = 'kl-toast'; t.textContent = text; box.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  /* ── the mirror ─────────────────────────────────────────────────────────── */
  renderStage() {
    const host = $('[data-mirror]', this.main);
    const title = $('[data-mattitle]', this.main);
    const ctl = $('[data-ctl]', this.main);
    if (!this.active()) {
      this.unmountMirror();
      title.textContent = '';
      const ended = this.lesson && this.lesson.ended;
      host.innerHTML = `<div class="kl-wait kl-startcard"><span class="kl-wait-pic" aria-hidden="true">🦀</span>
        <h2>${esc(T.startH(this.name))}</h2><p>${esc(T.startLead(this.name))}</p>
        ${ended ? `<p class="kl-mute">${esc(T.lastEnded(new Date(ended).toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit' })))}</p>` : ''}
        <button type="button" class="kl-btn kl-btn-primary kl-btn-big" data-start2>${T.start}</button></div>`;
      $('[data-start2]', host).addEventListener('click', () => this.startLesson());
      ctl.classList.add('is-off');
      return;
    }
    if (!this.material) {
      this.unmountMirror();
      title.textContent = '';
      host.innerHTML = `<div class="kl-wait"><span class="kl-wait-pic" aria-hidden="true">🦀</span>
        <h2>${esc(T.waitH(this.tutor))}</h2><p>${esc(T.waitP)}</p>
        <button type="button" class="kl-btn kl-btn-primary" data-add2>${T.addFirst}</button></div>`;
      $('[data-add2]', host).addEventListener('click', () => this.drawer());
      ctl.classList.add('is-off');
      return;
    }
    ctl.classList.remove('is-off');
    title.textContent = this.material.title || '';
    const sig = sigOf(this.material);
    if (!this.mirror || this.mirrorSig !== sig) {
      this.unmountMirror();
      host.innerHTML = '<div class="kl-mirror-in"></div>';
      this.mirror = mountMaterial(host.firstChild, this.material, { role: 'mirror', lang: LANG, adult: this.adult });
      this.mirrorSig = sig;
      this.fitMirror();
    }
    if (this.state && this.state.kind === (this.mirror.kind || this.state.kind)) this.mirror.apply(this.state);
    this.nextButton();
  }
  fitMirror() {
    const host = $('[data-mirror]', this.main), inn = host && host.querySelector('.kl-mirror-in'); if (!inn) return;
    const W = host.clientWidth, H = host.clientHeight;
    if (!W || !H || H >= MIRROR_H) { inn.style.cssText = ''; return; }
    const s = H / MIRROR_H;
    inn.style.cssText = `width:${(W / s).toFixed(1)}px;height:${MIRROR_H}px;transform:scale(${s.toFixed(4)});transform-origin:0 0`;
  }
  unmountMirror() { if (this.mirror) { try { this.mirror.destroy(); } catch (_) {} } this.mirror = null; this.mirrorSig = ''; }

  nextButton() {
    const b = $('[data-nextitem]', this.main); if (!b) return;
    const s = this.state, done = !!(s && (s.kind === 'book' ? s.finished : s.done));
    const nxt = this.items[this.index + 1];
    b.hidden = !done;
    b.textContent = nxt ? T.nextItem(nxt.title) : T.addFirst;
    $('[data-add3]', this.main).hidden = !b.hidden && !nxt;      // the bar's own "+ Add material" is there
    // Hint / Show answer act on the item the student is on: say which one
    let n = null; try { n = this.mirror && this.mirror.current ? this.mirror.current() : null; } catch (_) {}
    $('[data-c="hint"]', this.main).textContent = n ? `${T.hint} · ${n}` : T.hint;
    $('[data-c="reveal"]', this.main).textContent = n ? `${T.reveal} · ${n}` : T.reveal;
  }

  /* ── relay events ───────────────────────────────────────────────────────── */
  onReady(m) {
    this.setBanner(null);
    if (m.tutor) this.tutor = m.tutor;
    if (typeof m.adult === 'boolean') this.adult = m.adult;
    let L = m.lesson;
    const first = this.firstReady; this.firstReady = false;
    if (this.endPending) {
      // "Save and end" happened while we were offline: the note is saved, now end it on the relay
      const ep = this.endPending; this.endPending = null;
      // (the relay's lesson started before "Save and end" was pressed: it is this one, not a newer one)
      if (L && !L.ended && (L.started === ep.started || Date.parse(L.started) <= ep.at + 60000)) { this.live.end(ep.summary); L = Object.assign({}, L, { ended: new Date().toISOString() }); }
      if (!this.active()) { this.header(); return; }
    }
    if (L && !L.ended) {
      // started here: our clock's time vs the relay's (a few ms apart): the same lesson
      const sameLesson = this.lesson && (this.lesson.started === L.started || Math.abs(Date.parse(this.lesson.started) - Date.parse(L.started)) < 120000);
      this.lesson = { started: L.started, ended: null };
      if (first || !sameLesson) {
        this.items = Array.isArray(L.items) ? L.items : [];
        this.index = Number.isInteger(L.index) ? L.index : -1;
        this.material = L.material || null; this.state = L.state || null;
        this.answers = Array.isArray(L.answers) ? L.answers : [];
      } else {
        // we were offline: the relay's answers and the student's state are newer; our queue is newer
        this.answers = Array.isArray(L.answers) ? L.answers : this.answers;
        if (L.state) this.state = L.state;
        if (this.material && sigOf(this.material) !== sigOf(L.material)) this.live.load(this.material, this.items, this.index);
        else this.live.queue(this.items, this.index);
      }
    } else if (!first && this.active() && !L) {
      // we started (or went on) while the relay was away (server restart): send it again
      if (this.material) this.live.load(this.material, this.items, this.index); else this.live.start(this.items, this.index);
    } else {
      this.lesson = L ? { started: L.started, ended: L.ended } : null;
      this.material = null; this.state = null;
      if (first && !this.items.length && this.P.start) { this.P.start = false; this.startLesson(); this.afterFirstReady(); return; }
    }
    this.header(); this.renderStage(); this.renderQueue(); this.renderAnswers();
    if (first) this.afterFirstReady();
  }

  async afterFirstReady() {
    if (this.P.wid) {
      const w = (this.d.worksheets || []).find((x) => x.id === this.P.wid);
      this.P.wid = null;
      if (w && this.active()) { const it = this.v1Item(w); this.items.splice(this.index + 1, 0, it); await this.show(this.index + 1); }
    }
    if (this.P.qp) { const tp = this.P.qp; this.P.qp = ''; this.drawer('quick', tp); }
  }

  onFatal(code) {
    if (code === 'replaced') { this.setBanner('replaced'); return; }
    if (code === 'auth') { this.main.innerHTML = `<div class="kl-msg kc-card"><p>${T.needSignIn}</p><p><a class="kc-btn" href="/en/spanish/tutors/">${T.signIn}</a></p></div>`; clearInterval(this.clock); }
  }
  setBanner(kind) {
    const b = $('[data-banner]', this.main); if (!b) return;
    if (!kind) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = `${esc(T.replaced)} <button type="button" class="kl-btn kl-btn-sm">${T.useHere}</button>`;
    b.querySelector('button').addEventListener('click', () => { b.hidden = true; this.live.reconnect(); });
  }

  onMessage(m) {
    if (m.t === 'state') {
      // a state for the previous material (still on its way after a "show now") is dropped
      if (m.state && m.state.id && this.material && this.material.id && m.state.id !== this.material.id) return;
      this.state = m.state;
      const cur = this.items[this.index];
      if (cur && m.state && typeof m.state.stars === 'number') cur.stars = m.state.stars;
      if (cur && m.state && (m.state.kind === 'book' ? m.state.finished : m.state.done) && !cur.finished) { cur.finished = true; this.sync(); }
      if (this.mirror && m.state) this.mirror.apply(m.state);
      this.nextButton();
    } else if (m.t === 'cursor') {
      if (this.mirror) this.mirror.cursor({ a: m.a, x: m.x, y: m.y });
    } else if (m.t === 'answer') {
      const a = Object.assign({}, m); delete a.t;
      this.answers.push(a);
      if (this.answers.length > 400) this.answers.shift();
      this.renderAnswers(); this.renderQueue();
      if (this.tab !== 'answers') { const b = this.main.querySelector('[data-tabbtn="answers"]'); if (b) b.classList.add('is-new'); }
    } else if (m.t === 'error' && m.code === 'too_big') {
      this.toast(T.tooBig);
    }
  }

  /* ── lesson ─────────────────────────────────────────────────────────────── */
  startLesson() {
    if (this.active()) return;
    const others = runningLessons().filter((r) => r.sid !== Number(this.P.sid));
    if (others.length >= 3) {
      const oldest = others.slice().sort((a, b) => (a.seen || 0) - (b.seen || 0))[0];
      if (!confirm(T.tooMany(others.map((r) => r.name).join(', '), oldest.name))) return;
      markEnded(oldest.sid);
    }
    this.lesson = { started: new Date().toISOString(), ended: null };
    this.items = []; this.index = -1; this.material = null; this.state = null; this.answers = [];
    if (!this.live.start(this.items, this.index)) this.toast(T.offline);
    this.header(); this.renderStage(); this.renderQueue(); this.renderAnswers();
  }

  sync() { this.live.queue(this.items, this.index); }

  async resolve(it) {
    if (this.mats.has(it.key)) return this.mats.get(it.key);
    let mat = null;
    if (it.k === 'qp') mat = it.material;
    else if (it.k === 'm') mat = await fetch('/data/materials/' + encodeURIComponent(it.file)).then((r) => { if (!r.ok) throw new Error('http'); return r.json(); });
    else if (it.k === 'v1') {
      const r = await api(`/api/tutor/student/worksheet?id=${this.P.sid}&worksheet_id=${it.wid}`, this.P.token);
      const fe = await import('/lib/activities/from-engine.js?v=2026-11-26b');
      mat = fe.fromV1Worksheet(r.worksheet);
    }
    if (!mat) throw new Error('no material');
    this.mats.set(it.key, mat);
    it.mid = mat.id || it.mid || null;
    return mat;
  }

  async show(i) {
    const it = this.items[i]; if (!it) return;
    if (!this.active()) this.startLesson();
    let mat;
    try { mat = await this.resolve(it); } catch (e) { console.warn('live: material', e); this.toast(T.loadFail); return; }
    if (this.index >= 0 && this.items[this.index] && this.index !== i) this.items[this.index].done = true;
    this.index = i; it.done = false;
    this.material = mat; this.state = null;
    if (!this.live.load(mat, this.items, this.index)) this.toast(T.offline);
    this.renderStage(); this.renderQueue();
  }

  add(it, now) {
    if (!this.active()) this.startLesson();
    const at = now ? this.index + 1 : this.items.length;
    this.items.splice(at, 0, it);
    if (now) this.show(at); else { this.sync(); this.renderQueue(); }
  }

  /* ── queue ──────────────────────────────────────────────────────────────── */
  // first-try results: one per item (an item that comes back, "Play again" or a material
  // shown twice never counts twice)
  results(mid) {
    const seen = new Set(); let right = 0, total = 0;
    for (const a of this.answers) {
      if (!a.first || (mid && a.mat !== mid)) continue;
      const k = `${a.mat}|${a.step}|${a.item ?? a.a ?? ''}|${a.ref ?? ''}`;
      if (seen.has(k)) continue;
      seen.add(k); total++; if (a.correct) right++;
    }
    return { right, total };
  }

  renderQueue() {
    const ol = $('[data-queue]', this.main); if (!ol) return;
    if (!this.items.length) { ol.innerHTML = `<li class="kl-empty">${T.queueNone}</li>`; return; }
    ol.innerHTML = this.items.map((it, i) => {
      const now = i === this.index, r = it.mid ? this.results(it.mid) : { total: 0 };
      const mark = now ? '▶' : it.done ? '✓' : String(i + 1);
      return `<li class="${now ? 'is-now' : it.done ? 'is-done' : ''}">
        <button type="button" class="kl-q-main" data-show="${i}" title="${T.showNow}"><span class="kl-q-mark">${mark}</span>
          <span class="kl-q-t"><small>${esc(T.kindIco[it.ico] || '')} ${esc(it.sub || '')}</small><b>${esc(it.title)}</b>${r.total ? `<span class="kl-q-res">${r.right} of ${r.total} first try</span>` : ''}</span></button>
        <span class="kl-q-act"><button type="button" class="kl-icon" data-up="${i}" aria-label="${T.up}" title="${T.up}"${i ? '' : ' disabled'}>▲</button><button type="button" class="kl-icon" data-down="${i}" aria-label="${T.down}" title="${T.down}"${i < this.items.length - 1 ? '' : ' disabled'}>▼</button><button type="button" class="kl-icon" data-rm="${i}" aria-label="${T.remove}" title="${T.remove}">✕</button></span></li>`;
    }).join('');
    ol.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => this.show(Number(b.dataset.show))));
    const move = (i, j) => {
      if (j < 0 || j >= this.items.length) return;
      const [x] = this.items.splice(i, 1); this.items.splice(j, 0, x);
      if (this.index === i) this.index = j; else if (this.index === j) this.index = i;
      this.sync(); this.renderQueue();
    };
    ol.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.up), Number(b.dataset.up) - 1)));
    ol.querySelectorAll('[data-down]').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.down), Number(b.dataset.down) + 1)));
    ol.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.rm);
      this.items.splice(i, 1);
      if (i < this.index) this.index--;
      else if (i === this.index) this.index = -1;        // the student keeps the screen until the next "show"
      this.sync(); this.renderQueue(); this.nextButton();
    }));
    this.nextButton();
  }

  /* ── answers ────────────────────────────────────────────────────────────── */
  renderAnswers() {
    const ul = $('[data-answers]', this.main); if (!ul) return;
    const r = this.results(null);
    $('[data-score]', this.main).innerHTML = r.total ? T.firstTry(r.right, r.total) : '';
    $('[data-acount]', this.main).textContent = this.answers.length ? String(this.answers.length) : '';
    if (!this.answers.length) { ul.innerHTML = `<li class="kl-empty">${T.answersNone}</li>`; return; }
    ul.innerHTML = this.answers.slice(-80).reverse().map((a) => {
      const cls = a.correct ? 'ok' : a.shown ? 'shown' : 'no';
      const ico = a.correct ? '✓' : a.shown ? '→' : '✗';
      const given = a.given != null && a.given !== '' ? `“${esc(a.given)}”` : '';
      const ref = a.ref ? esc(a.ref) : '';
      return `<li class="${cls}"><span class="kl-a-ico">${ico}</span><span class="kl-a-t">${a.correct ? (given || ref) : `${given}${given && ref ? ` <span class="kl-mute">${T.rightIs}</span> ` : ''}${ref}`}
        ${a.correct && !a.first ? ` <em>${T.secondTry}</em>` : ''}${a.shown ? ` <em>${T.shownA}</em>` : ''}${a.mode === 'typed' ? ' <em>⌨</em>' : ''}${a.byTutor ? ' <em>by you</em>' : ''}</span></li>`;
    }).join('');
  }

  /* ── + Add drawer ───────────────────────────────────────────────────────── */
  mItem(row) { return { key: uid(), k: 'm', id: row.id, file: row.file, title: row.title, ico: row.kind, sub: T.kinds[row.kind] || row.kind, mid: row.id }; }
  v1Item(w) { return { key: uid(), k: 'v1', wid: w.id, title: w.title || 'Worksheet', ico: 'v1', sub: T.dSaved.replace(/s$/, '') }; }

  async drawer(tab = 'krabsy', preset = '') {
    this.closeDrawer();
    const wrap = document.createElement('div');
    wrap.className = 'kl-drawer-wrap';
    wrap.innerHTML = `<aside class="kl-drawer" role="dialog" aria-modal="true" aria-label="${T.drawerH}">
      <header class="kl-drawer-h"><h2>${T.drawerH}</h2><button type="button" class="kl-icon kl-x" data-x aria-label="Close">✕</button></header>
      <div class="kl-seg" role="tablist">
        <button type="button" data-dt="krabsy">${T.dKrabsy}</button><button type="button" data-dt="quick">${T.dQuick}</button><button type="button" data-dt="saved">${T.dSaved}</button></div>
      <div class="kl-drawer-body" data-dbody></div></aside>`;
    document.body.appendChild(wrap);
    this.drawerEl = wrap;
    const close = () => this.closeDrawer();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('[data-x]', wrap).addEventListener('click', close);
    this.onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', this.onEsc);
    const body = $('[data-dbody]', wrap);
    const setTab = async (t) => {
      wrap.querySelectorAll('[data-dt]').forEach((b) => b.classList.toggle('is-on', b.dataset.dt === t));
      if (t === 'krabsy') await this.dKrabsy(body);
      else if (t === 'quick') await this.dQuick(body, preset);
      else this.dSaved(body);
    };
    wrap.querySelectorAll('[data-dt]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.dt)));
    await setTab(tab);
    const f = body.querySelector('input,select,button'); if (f) f.focus();
  }
  closeDrawer() {
    if (this.drawerEl) { this.drawerEl.remove(); this.drawerEl = null; }
    if (this.onEsc) { document.removeEventListener('keydown', this.onEsc); this.onEsc = null; }
  }
  rowActions(i) {
    return `<span class="kl-row-act"><button type="button" class="kl-btn kl-btn-sm kl-btn-primary" data-now="${i}">${T.showNow}</button><button type="button" class="kl-btn kl-btn-sm" data-q="${i}">${T.queueAdd}</button></span>`;
  }
  wireRows(body, make) {
    body.querySelectorAll('[data-now]').forEach((b) => b.addEventListener('click', () => { const it = make(Number(b.dataset.now)); if (it) { this.add(it, true); this.closeDrawer(); } }));
    body.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const it = make(Number(b.dataset.q)); if (!it) return; this.add(it, false); b.textContent = '✓'; b.disabled = true;
    }));
  }

  async dKrabsy(body) {
    const rows = (await materialIndex()).slice().sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    body.innerHTML = `<input class="kl-input" type="search" data-search placeholder="${T.search}" aria-label="${T.search}">
      <ul class="kl-pick" data-list></ul>`;
    const list = $('[data-list]', body);
    const draw = (q) => {
      const f = fold(q);
      const vis = rows.map((r, i) => [r, i]).filter(([r]) => !f || fold(`${r.title} ${r.blurb || ''} ${r.topic} ${r.kind}`).includes(f));
      list.innerHTML = vis.map(([r, i]) => `<li><span class="kl-pick-ico" aria-hidden="true">${T.kindIco[r.kind] || '📄'}</span>
        <span class="kl-pick-t"><b>${esc(r.title)}</b><small>${esc(T.kinds[r.kind] || r.kind)} · ${esc(r.level || '')} · ${esc(T.min(r.minutes || 5))}</small>${r.blurb ? `<span>${esc(r.blurb)}</span>` : ''}</span>
        ${this.rowActions(i)}</li>`).join('') || `<li class="kl-empty">–</li>`;
      this.wireRows(list, (i) => this.mItem(rows[i]));
    };
    draw('');
    $('[data-search]', body).addEventListener('input', (e) => draw(e.target.value));
  }

  async dQuick(body, preset) {
    const topics = await topicList();
    const st = read('krabsy_live_qp', { count: 6, mode: 'typed', focus: true }) || {};
    const sel = preset && topics.some((t) => t.id === preset) ? preset : (st.topic && topics.some((t) => t.id === st.topic) ? st.topic : (topics[0] || {}).id);
    const practise = (tp) => ((this.d.topics || {})[tp] || {}).practise || [];
    body.innerHTML = `<form class="kl-qp" data-qp>
      <label class="kl-lbl">${T.qpTopic}<select class="kl-input" data-tp>${topics.map((t) => `<option value="${esc(t.id)}"${t.id === sel ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
      <div class="kl-lbl">${T.qpCount}<span class="kl-seg" data-count>${[6, 10].map((n) => `<button type="button" data-v="${n}" class="${n === st.count ? 'is-on' : ''}">${n}</button>`).join('')}</span></div>
      <div class="kl-lbl">${T.qpMode}<span class="kl-seg" data-mode>${T.qpModes.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === st.mode ? 'is-on' : ''}">${l}</button>`).join('')}</span></div>
      <label class="kl-check"><input type="checkbox" data-focus${st.focus !== false ? ' checked' : ''}> <span data-focusl></span></label>
      <p class="kl-err" data-err hidden></p>
      <p class="kl-row-act"><button type="button" class="kl-btn kl-btn-primary" data-qnow>${T.showNow}</button><button type="button" class="kl-btn" data-qadd>${T.queueAdd}</button></p></form>`;
    const f = $('[data-qp]', body);
    const focusL = () => { $('[data-focusl]', f).textContent = T.qpFocus(practise($('[data-tp]', f).value).length); };
    focusL();
    $('[data-tp]', f).addEventListener('change', focusL);
    f.querySelectorAll('.kl-seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('is-on', x === b));
    }));
    const go = async (now, btn) => {
      const tp = $('[data-tp]', f).value;
      const count = Number(($('[data-count] .is-on', f) || {}).dataset?.v || 6);
      const mode = ($('[data-mode] .is-on', f) || {}).dataset?.v || 'typed';
      const focus = $('[data-focus]', f).checked ? practise(tp) : [];
      write('krabsy_live_qp', { topic: tp, count, mode, focus: $('[data-focus]', f).checked });
      const err = $('[data-err]', f); err.hidden = true;
      const old = btn.textContent; btn.disabled = true; btn.textContent = T.qpMake;
      try {
        const fe = await import('/lib/activities/from-engine.js?v=2026-11-26b');
        const name = (topics.find((t) => t.id === tp) || {}).name || tp;
        const mat = await fe.quickPractice({ topic: tp, count, mode, focus, lang: LANG, title: T.qpTitle(name) });
        const it = { key: uid(), k: 'qp', title: mat.title, ico: 'quick', sub: `${T.dQuick} · ${mat.steps[0].sentences.length} · ${(T.qpModes.find((x) => x[0] === mode) || ['', mode])[1]}`, material: mat, mid: mat.id };
        this.mats.set(it.key, mat);
        this.add(it, now);
        if (now) this.closeDrawer(); else { btn.textContent = '✓'; setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1200); }
      } catch (e) {
        console.warn('live: quick practice', e);
        err.textContent = T.qpFail; err.hidden = false; btn.textContent = old; btn.disabled = false;
      }
    };
    $('[data-qnow]', f).addEventListener('click', (e) => go(true, e.currentTarget));
    $('[data-qadd]', f).addEventListener('click', (e) => go(false, e.currentTarget));
  }

  dSaved(body) {
    const wss = this.d.worksheets || [];
    if (!wss.length) { body.innerHTML = `<p class="kl-empty">${T.savedNone}</p>`; return; }
    body.innerHTML = `<ul class="kl-pick">${wss.map((w, i) => `<li><span class="kl-pick-ico" aria-hidden="true">📝</span>
      <span class="kl-pick-t"><b>${esc(w.title || w.topic)}</b><small>${esc(T.savedMeta(w))}</small></span>${this.rowActions(i)}</li>`).join('')}</ul>`;
    this.wireRows(body, (i) => this.v1Item(wss[i]));
  }

  /* ── end of the lesson ──────────────────────────────────────────────────── */
  summary() {
    const minutes = Math.max(1, Math.round((Date.now() - Date.parse(this.lesson.started)) / 60000));
    const shown = this.items.filter((it, i) => it.done || i === this.index);
    const mats = shown.map((it) => ({ title: it.title, finished: !!it.finished, ...(it.mid ? this.results(it.mid) : { right: 0, total: 0 }) }));
    const r = this.results(null);
    const words = [];
    for (const a of this.answers) {
      if (!(a.first && !a.correct) && !a.shown) continue;
      const w = String(a.ref || a.item || '').trim();
      if (w && !words.includes(w)) words.push(w);
    }
    const stars = shown.reduce((n, it) => n + (Number(it.stars) || 0), 0);
    return { minutes, mats, right: r.right, total: r.total, words: words.slice(0, 15), stars };
  }

  noteText(s) {
    const notes = ($('[data-notes]', this.main) || {}).value || '';
    const lines = [T.noteHead(s.minutes)];
    for (const m of s.mats) lines.push(`${m.finished ? '✓' : '·'} ${m.title}${m.finished ? '' : ` (${T.notFinished})`}${m.total ? ` — ${T.noteRight(m.right, m.total)}` : ''}`);
    if (s.words.length) lines.push(`${T.noteWords}: ${s.words.map(quoteWord).join('; ')}`);
    if (notes.trim()) lines.push('', notes.trim());
    return lines.join('\n').slice(0, 2000);
  }

  endDialog() {
    if (!this.active()) return;
    const s = this.summary();
    const wrap = document.createElement('div');
    wrap.className = 'kl-modal-wrap';
    wrap.innerHTML = `<div class="kl-modal" role="dialog" aria-modal="true" aria-labelledby="kl-endh">
      <header><h2 id="kl-endh">${esc(T.endH(this.name))}</h2></header>
      <div class="kl-modal-body">
        <p class="kl-mute">${esc(T.endMeta(s.minutes, s.mats.length, s.stars))}</p>
        ${s.mats.length ? `<ul class="kl-end-mats">${s.mats.map((m) => `<li>${m.finished ? '✓' : '·'} ${esc(m.title)}${m.finished ? '' : ` <span class="kl-mute">(${T.notFinished})</span>`}${m.total ? ` <b class="${m.right === m.total ? 'is-all' : ''}">${m.right} of ${m.total}</b>` : ''}</li>`).join('')}</ul>` : ''}
        ${s.total ? `<p><strong>${T.endRight}:</strong> ${s.right} of ${s.total}</p>` : ''}
        ${s.words.length ? `<p><strong>${T.endWords}:</strong> ${esc(s.words.map(quoteWord).join('; '))}</p>` : ''}
        <label class="kl-lbl">${T.endNote}<textarea class="kl-input" rows="7" maxlength="2000" data-endnote>${esc(this.noteText(s))}</textarea></label>
        <p class="kl-err" data-err hidden></p>
      </div>
      <footer><button type="button" class="kl-btn" data-keep>${T.keep}</button><button type="button" class="kl-btn kl-btn-primary" data-save>${T.saveEnd}</button></footer></div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    $('[data-keep]', wrap).addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    $('[data-endnote]', wrap).focus();
    $('[data-save]', wrap).addEventListener('click', async (e) => {
      const btn = e.currentTarget, err = $('[data-err]', wrap);
      btn.disabled = true; btn.textContent = T.saving; err.hidden = true;
      const note = $('[data-endnote]', wrap).value.trim();
      try {
        if (note) await api('/api/tutor/student/lesson', this.P.token, { id: this.P.sid, day: today(), note });
      } catch (_) {
        err.textContent = T.saveFail; err.hidden = false; btn.disabled = false; btn.textContent = T.saveEnd; return;
      }
      const sum = { minutes: s.minutes, materials: s.mats.length, first: s.right, total: s.total };
      if (!this.live.end(sum)) this.endPending = { at: Date.now(), started: this.lesson.started, summary: sum };   // sent on reconnect
      this.lesson = { started: this.lesson.started, ended: new Date().toISOString() };
      this.trackRunning();
      write(this.notesKey, null);
      close();
      this.savedCard();
    });
  }

  savedCard() {
    this.unmountMirror();
    this.material = null; this.state = null;
    this.header();
    const host = $('[data-mirror]', this.main);
    $('[data-mattitle]', this.main).textContent = '';
    $('[data-ctl]', this.main).classList.add('is-off');
    $('[data-notes]', this.main).value = '';
    host.innerHTML = `<div class="kl-wait kl-startcard"><span class="kl-wait-pic" aria-hidden="true">✅</span>
      <h2>${T.savedH}</h2><p>${esc(T.savedP(this.name))}</p>
      <p class="kl-row-act"><a class="kl-btn kl-btn-primary" href="${esc(this.profileHref)}">${esc(T.backTo(this.name))}</a>
      <button type="button" class="kl-btn" data-start3>${T.newLesson}</button></p></div>`;
    $('[data-start3]', host).addEventListener('click', () => this.startLesson());
  }
}

// a word as it is, a sentence in quotes without its final full stop
function quoteWord(w) { return /\s/.test(w) ? `“${w.replace(/[.。]\s*$/, '')}”` : w; }
function sigOf(m) { return m ? `${m.id || ''}|${m.title || ''}|${JSON.stringify(m).length}` : ''; }
