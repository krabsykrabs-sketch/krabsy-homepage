/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — class pages UI (phase 2 2026-11-22, optional teacher sign-in 2026-11-27)

   One module for four pages, chosen by <main data-class-page="…">:
     join       /de/klasse/                          /es/clase/
     create     /de/lehrkraefte/klasse-erstellen/    /es/docentes/crear-clase/
     dashboard  /de/lehrkraefte/klasse/#t=… | #c=…   /es/docentes/clase/#t=… | #c=…
     account    /de/lehrkraefte/meine-klassen/       /es/docentes/mis-clases/   (#l=… = sign-in link)
   Language = currentLang() (krabsy-lang.js), paths from data/sections.json,
   all text from data/ui_<lang>.json "classes" (i18n contract, docs/i18n-scaling.md).

   Classes work without an account, as before: the secret teacher token travels
   only in the URL fragment (#t=…), which the browser never sends to a server,
   and in the X-Teacher-Token header. A teacher MAY save classes to an account
   ("Klasse sichern": email + one-time link, lib/krabsy-account.js); saved
   classes open as #c=<id> with the account session, from any device.
   Classes opened on this device are remembered in
   localStorage["krabsy_teacher_classes"] (name, code, token) — nothing else.
   ────────────────────────────────────────────────────────────────────────── */
import { getSession, join, leave, apiBase } from '/lib/krabsy-class.js?v=2026-11-22b';
import { currentLang, defaultSection, uiPage, topicUrl, UI_LANGS, TOPICS, pickLang, FALLBACK_UI } from '/lib/krabsy-lang.js?v=2026-11-27-acct';
import { itemLabel } from '/lib/krabsy-me.js?v=2026-11-27';
import { getAccount, clearAccount, call, requestLink, verifyLink, signOut, tokenFromLink } from '/lib/krabsy-account.js?v=2026-11-27';

// Classes exist in the interface languages whose sections.json entry has a class page.
const LANG = currentLang({ supported: UI_LANGS.filter((l) => uiPage('class', l)) });
const SECTION = defaultSection(LANG);
const PATHS = {
  join: uiPage('class', LANG), create: uiPage('class_create', LANG), dash: uiPage('class_dashboard', LANG),
  account: uiPage('class_account', LANG),
  games: SECTION.games, verbs: topicUrl(SECTION.starter, LANG), home: SECTION.home,
};
const ICONS = '/lib/icons/krabsy-icons.svg?v=2026-11-27-acct';

/* ── texts ─────────────────────────────────────────────────────────────── */
let S = {};
async function loadTexts() {
  const get = (l) => fetch(`/data/ui_${l}.json`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let d = await get(LANG);
  if (!d.classes && LANG !== FALLBACK_UI) d = await get(FALLBACK_UI);     // contract rule 5: → en
  S = Object.assign({}, d.classes || {}, { invites: d.invites || {} });   // + the live-invite texts (Quiz Room for this class)
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function raw(key) {
  const v = key.split('.').reduce((o, k) => (o == null ? null : o[k]), S);
  return typeof v === 'string' ? v : key;              // never empty
}
function fill(s, vars, escape) {
  return s.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (m, k) => (k in vars ? (escape ? esc(vars[k]) : String(vars[k])) : m));
}
/** HTML-safe text for innerHTML (values escaped; only *_html keys keep their markup). */
const t = (key, vars = {}) => fill(key.endsWith('_html') ? raw(key) : esc(raw(key)), vars, true);
/** Plain text for textContent, confirm(), prompt(). */
const tx = (key, vars = {}) => fill(raw(key), vars, false);
const icon = (id) => `<svg class="ki" aria-hidden="true" focusable="false"><use href="${ICONS}#${id}"/></svg>`;

const $ = (sel, root = document) => root.querySelector(sel);

// Quiz-Raum codes look exactly like class codes (same letters, 6 characters), so a child
// may type one here. Ask the quiz room server whether such a room is open: a join with
// an empty name gets "bad_name" (room exists, nothing changes) or "no_room".
function isQuizRoom(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 6) return Promise.resolve(false);
  return new Promise((resolve) => {
    let ws, done = false;
    const end = (v) => { if (done) return; done = true; try { ws && ws.close(); } catch (_) {} resolve(v); };
    try {
      ws = new WebSocket(apiBase().replace(/^http/, 'ws') + '/api/quiz/ws');
      ws.onopen = () => ws.send(JSON.stringify({ t: 'join', code: c, name: '' }));
      ws.onmessage = (e) => { let m = {}; try { m = JSON.parse(e.data); } catch (_) {} end(m.t === 'error' && m.code !== 'no_room'); };
      ws.onerror = () => end(false);
    } catch (_) { end(false); }
    setTimeout(() => end(false), 4000);
  });
}

function errorKey(code) {
  return { unknown_code: 'err_code', bad_nickname: 'err_nick', class_full: 'err_full', too_many: 'err_many',
           bad_email: 'err_email', class_taken: 'err_taken', unknown_class: 'no_token', link_expired: 'link_bad',
           tutor_space: 'err_tutor_space' }[code] || 'err_net';
}

function copyButton(text) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'kc-btn kc-btn-ghost'; b.textContent = tx('copy');
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {} ta.remove();
    }
    b.textContent = tx('copied'); setTimeout(() => { b.textContent = tx('copy'); }, 1800);
  });
  return b;
}

function ago(iso) {
  if (!iso) return t('never');
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return days <= 0 ? t('today') : days === 1 ? t('yesterday') : t('days_ago', { n: days });
}

// Sentence topics (format v2: en_simple_past …) store item ids like "sp_regular";
// the dashboard shows the item's label ("walk → walked") and the topic's short name.
// Filled by loadWordLabels() before the dashboard renders.
const gapLabels = new Map();   // "topic/item" → label
let topicNames = {};

async function loadWordLabels(d) {
  const all = [...(d.hard_words || []), ...(d.solid_words || []), ...(d.students || []).flatMap((s) => s.hard_words || [])];
  const gap = all.filter((w) => TOPICS[w.topic] && TOPICS[w.topic].file && !gapLabels.has(w.topic + '/' + w.item));
  if (!gap.length) return;
  try { topicNames = await fetch('/data/topics.json').then((r) => r.json()); } catch (_) { topicNames = {}; }
  await Promise.all(gap.map(async (w) => {
    const label = await itemLabel(w.topic, w.item).catch(() => null);
    gapLabels.set(w.topic + '/' + w.item, label || w.item);
  }));
}

function wordLabel(w) {
  // Verbs: the base form; prepositions: the use-case id is shown readable.
  if (w.topic === 'prepositions') return `${esc(w.item.replace(/^prep_/, '').replace(/_/g, ' '))} <span class="kc-muted">(${t('topic_prep')})</span>`;
  const key = w.topic + '/' + w.item;
  if (gapLabels.has(key)) {
    const tp = topicNames[w.topic] || {};
    const name = pickLang(tp.short_name, LANG) || pickLang(tp.display_name, LANG) || '';
    const learn = (TOPICS[w.topic] && TOPICS[w.topic].learn) || 'en';
    return `<span lang="${esc(learn)}">${esc(gapLabels.get(key))}</span>${name ? ` <span class="kc-muted">(${esc(name)})</span>` : ''}`;
  }
  return `<span lang="en">${esc(w.item)}</span>`;
}

/* ── join ──────────────────────────────────────────────────────────────── */
function renderJoin(main) {
  const s = getSession();
  if (s) {
    main.innerHTML = `
      <h1>${t('join_title')}</h1>
      <div class="kc-card kc-done">
        <p class="kc-big">${t('joined_html', { class: s.name, name: s.nickname })}</p>
        <p>${t('joined_lead')}</p>
        <p class="kc-row"><a class="kc-btn" href="${PATHS.games}">${t('to_games')}</a>
          <a class="kc-btn kc-btn-ghost" href="${PATHS.verbs}">${t('to_practice')}</a></p>
        <p><button type="button" class="kc-link" id="kc-leave">${t('not_me')}</button></p>
      </div>`;
    $('#kc-leave').addEventListener('click', () => { leave(); renderJoin(main); });
    return;
  }
  const pre = new URLSearchParams(location.search).get('code') || '';
  main.innerHTML = `
    <h1>${t('join_title')}</h1>
    <p class="kc-lead">${t('join_lead')}</p>
    <form class="kc-card" id="kc-join" novalidate>
      <label class="kc-field"><span>${t('code')}</span>
        <input id="kc-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
               maxlength="9" placeholder="ABC-123" value="${esc(pre)}" class="kc-code-input" required></label>
      <label class="kc-field"><span>${t('nick')}</span>
        <input id="kc-nick" name="nickname" autocomplete="given-name" maxlength="20" required>
        <small>${t('nick_hint')}</small></label>
      <p class="kc-error" id="kc-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${t('join_btn')}</button>
    </form>`;
  (pre ? $('#kc-nick') : $('#kc-code')).focus();
  const err = $('#kc-err');
  async function tryJoin(samePerson) {
    const btn = $('#kc-join button[type=submit]'); btn.disabled = true;
    const name = $('#kc-nick').value.trim();
    const r = await join($('#kc-code').value, name, samePerson);
    btn.disabled = false;
    if (r.ok) {
      // Register the pupil as this device's person (siblings, profile saved to the key: krabsy-sync.js).
      try { await (await import('/lib/krabsy-sync.js?v=2026-11-27l')).enter(r.session); } catch (_) {}
      renderJoin(main); return;
    }
    if (r.error === 'name_taken') { askSameName(name); return; }
    const code = $('#kc-code').value;
    if (r.error === 'unknown_code' && await isQuizRoom(code)) {
      err.textContent = tx('quiz_code'); err.hidden = false;
      setTimeout(() => { location.href = `/quiz/?code=${encodeURIComponent(code.toUpperCase().replace(/[^A-Z0-9]/g, ''))}&lang=${LANG}`; }, 1200);
      return;
    }
    err.textContent = tx(errorKey(r.error)); err.hidden = false;
  }
  // Same first name already in the class: never merge two pupils silently.
  function askSameName(name) {
    err.hidden = false;
    err.innerHTML = `<span>${t('taken_q', { name })}</span>
      <span class="kc-row" style="margin-top:8px">
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-me">${t('taken_me', { name })}</button>
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-other">${t('taken_other')}</button></span>`;
    $('#kc-me').addEventListener('click', () => tryJoin(true));
    $('#kc-other').addEventListener('click', () => {
      err.textContent = tx('taken_hint');
      const input = $('#kc-nick'); input.value = name + ' '; input.focus();
    });
  }
  $('#kc-join').addEventListener('submit', (ev) => { ev.preventDefault(); tryJoin(false); });
}

/* ── classes remembered on this device ─────────────────────────────────── */
function rememberedClasses() {
  try { return JSON.parse(localStorage.getItem('krabsy_teacher_classes') || '[]') || []; } catch (_) { return []; }
}
function remember(c) {
  const list = rememberedClasses().filter((x) => x.token !== c.token && x.code !== c.code);
  list.unshift(c);
  try { localStorage.setItem('krabsy_teacher_classes', JSON.stringify(list.slice(0, 30))); } catch (_) {}
}
function forget(token) {
  try { localStorage.setItem('krabsy_teacher_classes', JSON.stringify(rememberedClasses().filter((x) => x.token !== token))); } catch (_) {}
}
const dashUrl = (token) => `${location.origin}${PATHS.dash}#t=${token}`;
const joinUrl = (code) => `${location.origin}${PATHS.join}?code=${encodeURIComponent(code)}`;

/* ── shared account pieces ─────────────────────────────────────────────── */

/** Email form that asks for a sign-in link. claim = secret class token to save
    with it ("Klasse sichern"); without it, a plain sign-in. */
function emailForm(box, { claim, button, sentKey }) {
  box.innerHTML = `
    <form class="kc-save-form" novalidate>
      <label class="kc-field"><span>${t('email')}</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="${t('email_ph')}" required></label>
      <p class="kc-error" role="alert" hidden></p>
      <p class="kc-row"><button class="kc-btn" type="submit">${icon('ki-mail')}<span>${t(button)}</span></button></p>
    </form>`;
  const form = $('form', box), err = $('.kc-error', form), btn = $('button', form), input = $('input', form);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = input.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email)) { err.textContent = tx('err_email'); err.hidden = false; input.focus(); return; }
    btn.disabled = true; err.hidden = true;
    try {
      const d = await requestLink(email, LANG, claim);
      box.innerHTML = `<p class="kc-sent" role="status">${icon('ki-mail')}<span>${t(sentKey, { email, minutes: d.minutes || 20 })}</span></p>`;
    } catch (e) {
      err.textContent = tx(errorKey(e.message)); err.hidden = false; btn.disabled = false;
    }
  });
  return input;
}

/** The "Klasse sichern" card: recommended, skippable. */
function saveCard(box, claim, { quiet = false } = {}) {
  box.innerHTML = `
    <section class="kc-card kc-save${quiet ? ' kc-save-quiet' : ''}" aria-labelledby="kc-save-h">
      <div class="kc-save-head">${icon('ki-saved')}
        <div><h2 id="kc-save-h">${t('save_title')}${quiet ? '' : ` <span class="kc-pill">${t('save_recommended')}</span>`}</h2>
          <p class="kc-save-lead">${t('save_lead')}</p></div></div>
      ${quiet ? `<p class="kc-row"><button type="button" class="kc-btn kc-btn-ghost" id="kc-save-open">${t('save_title')}</button></p>` : ''}
      <div id="kc-save-body"${quiet ? ' hidden' : ''}></div>
      <p class="kc-muted kc-save-note"${quiet ? ' hidden' : ''}>${t('save_note')}</p>
      ${quiet ? '' : `<p><button type="button" class="kc-link" id="kc-save-skip">${t('save_skip')}</button></p>`}
    </section>`;
  const body = $('#kc-save-body', box);
  emailForm(body, { claim, button: 'save_btn', sentKey: 'sent_html' });
  const open = $('#kc-save-open', box);
  if (open) open.addEventListener('click', () => {
    open.parentElement.hidden = true; body.hidden = false; $('.kc-save-note', box).hidden = false; $('input', body).focus();
  });
  const skip = $('#kc-save-skip', box);
  if (skip) skip.addEventListener('click', () => saveCard(box, claim, { quiet: true }));
}

function accountLine(email) {
  return `<p class="kc-account-line">${icon('ki-saved')}<span>${t('signed_in_as', { email })} · <a href="${PATHS.account}">${t('my_classes')}</a></span></p>`;
}

/* ── create ────────────────────────────────────────────────────────────── */
function renderCreate(main) {
  const list = rememberedClasses();
  const acc = getAccount();
  main.innerHTML = `
    <h1>${t('create_title')}</h1>
    ${acc ? accountLine(acc.email) : ''}
    <p class="kc-lead">${t('create_lead')}</p>
    <form class="kc-card" id="kc-create">
      <label class="kc-field"><span>${t('class_name')}</span>
        <input id="kc-name" maxlength="40" placeholder="${t('class_name_ph')}"></label>
      <p class="kc-error" id="kc-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${t('create_btn')}</button>
    </form>
    <div id="kc-result"></div>
    <div id="kc-save"></div>
    ${!acc && PATHS.account ? `<p class="kc-muted">${t('have_account')} <a href="${PATHS.account}">${t('my_classes')}</a></p>` : ''}
    ${list.length ? `<section class="kc-card"><h2>${t('your_classes')}</h2><ul class="kc-list">${list.map((c) =>
      `<li><a href="${PATHS.dash}#t=${esc(c.token)}">${esc(c.name)}</a> <span class="kc-muted">${esc(c.code)}</span></li>`).join('')}</ul></section>` : ''}`;
  $('#kc-create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#kc-create button'); btn.disabled = true;
    try {
      const d = await call('/api/class/create', { body: { name: $('#kc-name').value, lang: LANG } });
      if (acc && !d.saved) clearAccount();              // the session had expired
      remember({ name: d.name, code: d.code, token: d.teacher_token });
      $('#kc-create').hidden = true;
      showCreated($('#kc-result'), d);
      if (!d.saved && PATHS.account) saveCard($('#kc-save'), d.teacher_token);
    } catch (e) {
      const el = $('#kc-err'); el.textContent = tx(errorKey(e.message)); el.hidden = false; btn.disabled = false;
    }
  });
}

function showCreated(box, d) {
  const open = d.saved ? `${PATHS.dash}#c=${d.class_id}` : `${PATHS.dash}#t=${esc(d.teacher_token)}`;
  const secret = `
      <p class="kc-row"><code class="kc-url">${esc(dashUrl(d.teacher_token))}</code><span id="kc-c2"></span></p>`;
  box.innerHTML = `
    <section class="kc-card kc-done">
      <h2>${t('created', { name: d.name })}</h2>
      <p class="kc-label">${t('code_for_pupils')}</p>
      <p class="kc-code">${esc(d.code)}</p>
      <p class="kc-label">${t('pupil_link')}</p>
      <p class="kc-row"><code class="kc-url">${esc(joinUrl(d.code))}</code><span id="kc-c1"></span></p>
      ${d.saved
        ? `<p class="kc-account-line">${icon('ki-saved')}<span>${t('created_saved')}</span></p>
           <details class="kc-details"><summary>${t('secret_optional')}</summary>${secret}</details>`
        : `<p class="kc-label">${t('your_link')}</p>${secret}<p class="kc-warn">${t('your_link_warn')}</p>`}
      <p class="kc-row"><a class="kc-btn" href="${open}">${t('open_dash')}</a>
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-big">${t('show_code')}</button></p>
    </section>`;
  $('#kc-c1').appendChild(copyButton(joinUrl(d.code)));
  $('#kc-c2').appendChild(copyButton(dashUrl(d.teacher_token)));
  $('#kc-big').addEventListener('click', () => showBigCode(d.code));
}

function showBigCode(code) {
  const o = document.createElement('div');
  o.className = 'kc-overlay';
  o.innerHTML = `<div><p class="kc-overlay-url">${esc(location.host + PATHS.join)}</p><p class="kc-overlay-code">${esc(code)}</p></div>`;
  o.addEventListener('click', () => o.remove());
  document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { o.remove(); document.removeEventListener('keydown', k); } });
  document.body.appendChild(o);
}

/* ── dashboard ─────────────────────────────────────────────────────────── */
function dashAuth() {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9_-]{20,64})/);
  if (m) return { teacherToken: m[1] };
  const c = location.hash.match(/[#&]c=(\d{1,12})/);
  return c ? { classId: Number(c[1]) } : null;
}

async function renderDashboard(main) {
  const auth = dashAuth();
  const acc = getAccount();
  if (auth && auth.classId != null && !acc) {          // a saved class, this device not signed in
    main.innerHTML = `<h1>${t('dash_title')}</h1><section class="kc-card"><p>${t('signin_to_open')}</p><div id="kc-signin"></div></section>`;
    emailForm($('#kc-signin'), { button: 'signin_btn', sentKey: 'sent_signin_html' });
    return;
  }
  let d;
  try { if (!auth) throw new Error('unknown_class'); d = await call('/api/class/dashboard', auth); }
  catch (e) {
    if (e.message === 'signed_out') return renderDashboard(main);     // session ended: ask to sign in
    main.innerHTML = `<h1>${t('dash_title')}</h1><p class="kc-card">${e.message === 'unknown_class' ? t('no_token') : t('err_net')}</p>
      <p class="kc-row"><a class="kc-btn" href="${PATHS.create}">${t('create_title')}</a>
        ${acc && PATHS.account ? `<a class="kc-btn kc-btn-ghost" href="${PATHS.account}">${t('my_classes')}</a>` : ''}</p>`;
    return;
  }
  const c = d.class, w = d.week;
  if (auth.teacherToken) remember({ name: c.name, code: c.code, token: auth.teacherToken });
  await loadWordLabels(d);
  const pct = (v) => (v == null ? '–' : `${v} %`);
  const words = (list) => list.map((x) => `<li><span class="kc-word">${wordLabel(x)}</span>
      <span class="kc-muted">${pct(x.correct_pct)} ${t('right')}${x.unsure.length ? ` · ${t('unsure')}: ${x.unsure.map(esc).join(', ')}` : ''}</span></li>`).join('');
  main.innerHTML = `
    <div class="kc-head">
      <div><h1>${esc(c.name)}</h1>
        <p class="kc-muted">${t('code')}: <strong class="kc-code-inline">${esc(c.code)}</strong> · <a href="${PATHS.join}?code=${encodeURIComponent(c.code)}">${esc(location.host + PATHS.join)}</a></p></div>
      <p class="kc-row"><a class="kc-btn kc-btn-ghost" href="/games/quiz-room/teacher.html?lang=${encodeURIComponent(LANG)}&amp;class=${encodeURIComponent(c.code.replace(/[^A-Za-z0-9]/g, ''))}">${icon('ki-quiz')} ${t('invites.room_open_for')}</a>
        <button class="kc-btn kc-btn-ghost" id="kc-big">${t('show_code')}</button>
        <button class="kc-btn kc-btn-ghost" id="kc-rename">${t('rename')}</button></p>
    </div>
    <div id="kc-acct"></div>
    <section class="kc-stats">
      <div class="kc-stat"><span>${w.active_students} / ${w.students}</span>${t('active')} · ${t('week')}</div>
      <div class="kc-stat"><span>${w.answers}</span>${t('answers')} · ${t('week')}</div>
      <div class="kc-stat"><span>${pct(w.correct_pct)}</span>${t('right')}</div>
    </section>
    <section class="kc-card"><h2>${t('hard')}</h2>${d.hard_words.length ? `<ul class="kc-words">${words(d.hard_words)}</ul>` : `<p class="kc-muted">${t('hard_none')}</p>`}</section>
    ${d.solid_words.length ? `<section class="kc-card"><h2>${t('solid')}</h2><ul class="kc-words">${words(d.solid_words.slice(0, 10))}</ul></section>` : ''}
    <section class="kc-card"><h2>${t('pupils')}</h2>
      ${d.students.length ? `<div class="kc-table-wrap"><table class="kc-table"><thead><tr><th>${t('nick_col')}</th><th>${t('last_active')}</th>
        <th class="num">${t('this_week')}</th><th class="num">${t('total')}</th><th class="num">${t('right')}</th><th>${t('practise')}</th><th></th></tr></thead><tbody>
        ${d.students.map((s) => `<tr><td><strong>${esc(s.nickname)}</strong></td><td>${ago(s.last_active)}</td>
          <td class="num">${s.answers_week}</td><td class="num">${s.answers}</td><td class="num">${pct(s.correct_pct)}</td>
          <td>${s.hard_words.map(wordLabel).join(', ') || '–'}</td>
          <td><button class="kc-link" data-remove="${esc(s.nickname)}">${t('remove')}</button></td></tr>`).join('')}
        </tbody></table></div>` : `<p class="kc-muted">${t('no_pupils')}</p>`}
    </section>
    ${d.sources.length ? `<section class="kc-card"><h2>${t('where')}</h2><p>${d.sources.map(([k, n]) => `${S.sources && S.sources[k] ? t('sources.' + k) : esc(k)} <span class="kc-muted">${n}</span>`).join(' · ')}</p></section>` : ''}
    ${c.mine ? `<section class="kc-card" id="kc-secret"><h2>${t('secret_h')}</h2><p class="kc-muted">${t('secret_lead')}</p>
      <div id="kc-secret-out"></div><p><button type="button" class="kc-btn kc-btn-ghost" id="kc-newlink">${t('secret_btn')}</button></p></section>` : ''}
    <p class="kc-muted">${t('retention', { days: c.delete_after_days })}</p>
    <p><button class="kc-btn kc-btn-danger" id="kc-delete">${t('del')}</button></p>`;
  accountBox($('#kc-acct'), c, auth, main);
  $('#kc-big').addEventListener('click', () => showBigCode(c.code));
  $('#kc-rename').addEventListener('click', async () => {
    const name = prompt(tx('rename_prompt'), c.name);
    if (name && name.trim()) { await call('/api/class/rename', Object.assign({ body: { name } }, auth)); renderDashboard(main); }
  });
  main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(tx('remove_q', { name: b.dataset.remove }))) return;
    await call('/api/class/remove-student', Object.assign({ body: { nickname: b.dataset.remove } }, auth));
    renderDashboard(main);
  }));
  const nl = $('#kc-newlink');
  if (nl) nl.addEventListener('click', async () => {
    if (!confirm(tx('secret_q'))) return;
    nl.disabled = true;
    try {
      const r = await call('/api/class/new-link', { body: {}, classId: c.id });
      if (auth.teacherToken) forget(auth.teacherToken);
      remember({ name: c.name, code: c.code, token: r.teacher_token });
      const out = $('#kc-secret-out');
      out.innerHTML = `<p>${t('secret_done')}</p><p class="kc-row"><code class="kc-url">${esc(dashUrl(r.teacher_token))}</code><span></span></p>`;
      $('span', $('.kc-row', out)).appendChild(copyButton(dashUrl(r.teacher_token)));
      if (auth.teacherToken) history.replaceState(null, '', `${location.pathname}#c=${c.id}`);   // the old link is dead
    } catch (e) { alert(tx(errorKey(e.message))); }
    nl.disabled = false;
  });
  $('#kc-delete').addEventListener('click', async () => {
    if (!confirm(tx('del_q'))) return;
    await call('/api/class/delete', Object.assign({ body: {} }, auth));
    if (auth.teacherToken) forget(auth.teacherToken);
    main.innerHTML = `<h1>${t('dash_title')}</h1><p class="kc-card">${t('deleted')}</p>
      ${c.mine ? `<p><a class="kc-btn kc-btn-ghost" href="${PATHS.account}">${t('my_classes')}</a></p>` : ''}`;
  });
}

/** Under the class header: saved (mine) / add to my account / quiet "Klasse sichern". */
function accountBox(box, c, auth, main) {
  if (!PATHS.account) return;
  const acc = getAccount();
  if (c.mine) {
    box.innerHTML = `<p class="kc-account-line">${icon('ki-saved')}<span>${t('saved_mine', { email: acc ? acc.email : '' })} · <a href="${PATHS.account}">${t('my_classes')}</a></span></p>`;
  } else if (c.saved) {
    box.innerHTML = `<p class="kc-account-line kc-muted">${icon('ki-saved')}<span>${t('saved_other')}</span></p>`;
  } else if (acc && auth.teacherToken) {
    box.innerHTML = `<section class="kc-card kc-save kc-save-quiet"><p class="kc-row kc-attach">${icon('ki-saved')}<span>${t('attach_q')}</span>
      <button type="button" class="kc-btn" id="kc-attach">${t('attach_btn')}</button></p><p class="kc-error" role="alert" hidden></p></section>`;
    $('#kc-attach').addEventListener('click', async () => {
      const b = $('#kc-attach'); b.disabled = true;
      try { await call('/api/account/attach', { body: { teacher_token: auth.teacherToken } }); renderDashboard(main); }
      catch (e) {
        if (e.message === 'signed_out') { renderDashboard(main); return; }
        const el = $('.kc-error', box); el.textContent = tx(errorKey(e.message)); el.hidden = false; b.disabled = false;
      }
    });
  } else if (auth.teacherToken) {
    saveCard(box, auth.teacherToken, { quiet: true });
  }
}

/* ── account: "Meine Klassen" (+ the sign-in link from the email) ──────── */
async function renderAccount(main, notice = '') {
  const link = location.hash.match(/[#&]l=([A-Za-z0-9_-]{20,80})/);
  if (link) {
    main.innerHTML = `<h1>${t('my_classes')}</h1><p class="kc-card" role="status">${t('signing_in')}</p>`;
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
    try {
      const v = await verifyLink(link[1]);
      notice = v.claimed === true ? 'claimed' : v.claimed === false ? 'claim_failed' : '';
    } catch (e) {
      main.innerHTML = `<h1>${t('my_classes')}</h1><section class="kc-card"><p class="kc-error">${t(errorKey(e.message))}</p><div id="kc-signin"></div></section>`;
      emailForm($('#kc-signin'), { button: 'signin_btn', sentKey: 'sent_signin_html' });
      return;
    }
  }
  if (!getAccount()) return renderSignedOut(main, notice);
  let me;
  try { me = await call('/api/account/me'); } catch (e) {
    if (e.message === 'signed_out') return renderSignedOut(main);
    main.innerHTML = `<h1>${t('my_classes')}</h1><p class="kc-card">${t('err_net')}</p>`;
    return;
  }
  const mineCodes = new Set(me.classes.map((k) => k.code));
  const device = rememberedClasses().filter((k) => !mineCodes.has(k.code));
  main.innerHTML = `
    <div class="kc-head"><div><h1>${t('my_classes')}</h1>
      <p class="kc-muted">${t('signed_in_as', { email: me.email })}</p></div>
      <p class="kc-row"><a class="kc-btn" href="${PATHS.create}">${t('new_class')}</a></p></div>
    ${notice ? `<p class="kc-card kc-done" role="status">${t(notice)}</p>` : ''}
    <section class="kc-card">
      ${me.classes.length ? `<ul class="kc-classes">${me.classes.map((k) => `
        <li><div class="kc-class-main"><a class="kc-class-name" href="${PATHS.dash}#c=${k.id}">${esc(k.name)}</a>
          <span class="kc-muted"><strong class="kc-code-inline">${esc(k.code)}</strong> · ${t('pupils_count', { n: k.students })} · ${t('last_active')}: ${ago(k.last_active)}</span></div>
          <div class="kc-row"><a class="kc-btn kc-btn-ghost" href="${PATHS.dash}#c=${k.id}">${t('open_dash')}</a>
            <button type="button" class="kc-link" data-detach="${k.id}" data-name="${esc(k.name)}">${t('detach')}</button></div></li>`).join('')}</ul>`
        : `<p class="kc-muted">${t('no_classes_yet')}</p>`}
    </section>
    ${device.length ? `<section class="kc-card"><h2>${t('device_h')}</h2><p class="kc-muted">${t('device_lead')}</p>
      <ul class="kc-classes">${device.map((k) => `<li><div class="kc-class-main"><strong>${esc(k.name)}</strong> <span class="kc-muted kc-code-inline">${esc(k.code)}</span></div>
        <div class="kc-row"><button type="button" class="kc-btn kc-btn-ghost" data-add="${esc(k.token)}">${t('add_btn')}</button></div></li>`).join('')}</ul>
      <p class="kc-error" id="kc-add-err" role="alert" hidden></p></section>` : ''}
    <section class="kc-card"><h2>${t('add_link_h')}</h2><p class="kc-muted">${t('add_link_lead')}</p>
      <form id="kc-addlink" class="kc-row kc-addlink" novalidate>
        <label class="kc-field"><span>${t('add_link_label')}</span><input id="kc-addlink-in" autocomplete="off" spellcheck="false" placeholder="${esc(location.host + PATHS.dash)}#t=…"></label>
        <button class="kc-btn kc-btn-ghost" type="submit">${t('add_btn')}</button></form>
      <p class="kc-error" id="kc-addlink-err" role="alert" hidden></p></section>
    <section class="kc-card"><h2>${t('account_h')}</h2>
      <p>${t('signed_in_as', { email: me.email })}</p>
      <p><button type="button" class="kc-btn kc-btn-ghost" id="kc-signout">${t('sign_out')}</button></p>
      <p class="kc-muted">${t('account_retention', { days: me.delete_after_days })}</p>
      <h3 class="kc-h3">${t('delete_account')}</h3>
      <p class="kc-muted">${t('delete_account_lead')}</p>
      <p class="kc-error" id="kc-del-err" role="alert" hidden></p>
      <p><button type="button" class="kc-btn kc-btn-danger" id="kc-delacc">${t('delete_account')}</button></p>
    </section>`;
  main.querySelectorAll('[data-detach]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(tx('detach_q', { name: b.dataset.name }))) return;
    try { await call('/api/account/detach', { body: { class_id: Number(b.dataset.detach) } }); } catch (_) {}
    renderAccount(main);
  }));
  const attach = async (token, errEl) => {
    try { await call('/api/account/attach', { body: { teacher_token: token } }); renderAccount(main, 'attached'); }
    catch (e) {
      if (e.message === 'unknown_class') forget(token);
      errEl.textContent = tx(errorKey(e.message)); errEl.hidden = false;
    }
  };
  main.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { b.disabled = true; attach(b.dataset.add, $('#kc-add-err')); }));
  $('#kc-addlink').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const tok = tokenFromLink($('#kc-addlink-in').value), el = $('#kc-addlink-err');
    if (!tok) { el.textContent = tx('err_link'); el.hidden = false; return; }
    attach(tok, el);
  });
  $('#kc-signout').addEventListener('click', async () => { await signOut(); renderAccount(main); });
  $('#kc-delacc').addEventListener('click', async () => {
    if (!confirm(tx('delete_account_q'))) return;
    try { await call('/api/account/delete', { body: {} }); }
    catch (e) { const el = $('#kc-del-err'); el.textContent = tx(errorKey(e.message)); el.hidden = false; return; }
    clearAccount();
    main.innerHTML = `<h1>${t('my_classes')}</h1><p class="kc-card kc-done" role="status">${t('account_deleted')}</p>
      <p><a class="kc-btn kc-btn-ghost" href="${PATHS.create}">${t('create_title')}</a></p>`;
  });
}

function renderSignedOut(main, notice = '') {
  main.innerHTML = `
    <h1>${t('my_classes')}</h1>
    ${notice ? `<p class="kc-card kc-done" role="status">${t(notice)}</p>` : ''}
    <p class="kc-lead">${t('account_lead')}</p>
    <section class="kc-card" id="kc-signin"></section>
    <p class="kc-muted">${t('no_account_note')} <a href="${PATHS.create}">${t('create_title')}</a></p>`;
  emailForm($('#kc-signin'), { button: 'signin_btn', sentKey: 'sent_signin_html' });
}

/* ── start ─────────────────────────────────────────────────────────────── */
const main = document.querySelector('[data-class-page]');
if (main) {
  loadTexts().then(() => {
    const page = main.dataset.classPage;
    if (page === 'join') renderJoin(main);
    else if (page === 'create') renderCreate(main);
    else if (page === 'dashboard') { renderDashboard(main); window.addEventListener('hashchange', () => renderDashboard(main)); }
    else if (page === 'account') { renderAccount(main); window.addEventListener('hashchange', () => { if (/[#&]l=/.test(location.hash)) renderAccount(main); }); }
  });
}
