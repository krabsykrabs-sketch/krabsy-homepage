// Hash router + app shell (sidebar, top bar, live strip) + the student-view frame.
import { state, lesson, lessonNames, TOPICS, KINDS, TUTOR } from './data.js';
import { esc, icon, go, on, $, $$, avatar, modal, toast, closeDrawer } from './ui.js';
import { renderToday } from './tutor/today.js';
import { renderStudents, addStudentsModal } from './tutor/students.js';
import { renderProfile } from './tutor/profile.js';
import { renderLibrary } from './tutor/library.js';
import { renderEditor } from './tutor/editor.js';
import { renderLessons, renderPlanner, newLessonModal } from './tutor/lessons.js';
import { renderLive, liveClock } from './tutor/live.js';
import { renderMe, renderPlay, renderRead } from './student/me.js';

const app = $('#app');
const NAV = [['today', 'Today'], ['students', 'Students'], ['library', 'Library'], ['lessons', 'Lessons'], ['live', 'Live']];
let device = 'phone';

function parse() {
  const h = location.hash.replace(/^#/, '') || '/today';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

function shell() {
  if ($('.shell')) return;
  app.innerHTML = `<div class="shell">
    <aside class="side">
      <a class="brand" href="#/today"><span class="logo">K</span><span class="brand-t"><b>Krabsy</b><small>for tutors</small></span></a>
      <nav>${NAV.map(([id, l]) => `<a href="#/${id}" data-nav="${id}">${icon(id)}<span>${l}</span>${id === 'live' ? '<i class="livedot" hidden></i>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">
        <a href="#/settings" data-nav="settings">${icon('settings')}<span>Settings</span></a>
        <a href="#/me" class="side-student">${icon('eye')}<span>Student view</span></a>
        <p class="proto-tag">Prototype · fake data</p>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <div class="search"><label>${icon('search')}<input id="gsearch" type="search" placeholder="Search students and material" autocomplete="off"><kbd>/</kbd></label><div class="search-pop" id="gpop" hidden></div></div>
        <div class="top-right">
          <div class="menu"><button class="btn primary" id="newbtn">${icon('plus')}<span>New</span></button>
            <div class="menu-pop" id="newpop" hidden>
              <button data-new="student">${icon('user')} Students<small>paste a list of names</small></button>
              <button data-new="lesson">${icon('lessons')} Lesson<small>with a time, weekly if you like</small></button>
              <button data-new="homework">${icon('library')} Homework<small>pick material, then students</small></button>
              <button data-new="worksheet">${icon('copy')} Worksheet<small>start from a Krabsy one</small></button>
              <button data-new="me">${icon('eye')} Student view<small>see what Lucas sees</small></button>
            </div></div>
          <span class="av av-tutor" title="${TUTOR.name}">N</span>
        </div>
      </header>
      <div class="livestrip" id="livestrip" hidden></div>
      <div class="content" id="content"></div>
    </div>
    <nav class="tabbar">${NAV.map(([id, l]) => `<a href="#/${id}" data-nav="${id}">${icon(id)}<span>${l}</span></a>`).join('')}</nav>
  </div>`;

  // global search
  const inp = $('#gsearch'), pop = $('#gpop');
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  inp.addEventListener('input', () => {
    const q = norm(inp.value.trim()); if (!q) { pop.hidden = true; return; }
    const ss = state.students.filter(s => norm(s.name + ' ' + s.groups.join(' ')).includes(q)).slice(0, 5);
    const ms = state.materials.filter(m => norm(m.title + ' ' + TOPICS[m.topic].label + ' ' + KINDS[m.kind].label).includes(q)).slice(0, 6);
    pop.innerHTML = (ss.length ? `<h4>Students</h4>${ss.map(s => `<a href="#/students/${s.id}/overview">${avatar(s, 'sm')}<b>${esc(s.name)}</b><span class="mute">${s.level}${s.archived ? ' · archived' : ''}</span></a>`).join('')}` : '')
      + (ms.length ? `<h4>Library</h4>${ms.map(m => `<a href="#/library?open=${m.id}"><span class="kico">${KINDS[m.kind].icon}</span><b>${esc(m.title)}</b><span class="mute">${KINDS[m.kind].label} · ${m.level}</span></a>`).join('')}` : '')
      || '<p class="mute pad">Nothing found.</p>';
    pop.hidden = false;
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) pop.hidden = true; if (!e.target.closest('.menu')) $('#newpop') && ($('#newpop').hidden = true); });
  on(pop, 'click', 'a', () => { pop.hidden = true; inp.value = ''; });
  document.addEventListener('keydown', e => { if (e.key === '/' && !e.target.matches('input, textarea, [contenteditable]') && $('#gsearch')) { e.preventDefault(); $('#gsearch').focus(); } });
  $('#newbtn').addEventListener('click', () => { $('#newpop').hidden = !$('#newpop').hidden; });
  on($('#newpop'), 'click', '[data-new]', (e, b) => {
    $('#newpop').hidden = true;
    const k = b.dataset.new;
    if (k === 'student') addStudentsModal(() => route());
    if (k === 'lesson') newLessonModal(() => { go('#/lessons'); route(); });
    if (k === 'me') go('#/me');
    if (k === 'homework') go('#/library?shelf=krabsy&kind=practice');
    if (k === 'worksheet') { go('#/library?shelf=krabsy&kind=worksheet'); toast('Pick a worksheet, then “Duplicate & edit”. You never start from a blank page.'); }
  });
  setInterval(strip, 1000);
}

function strip() {
  const el = $('#livestrip'); if (!el) return;
  const dot = $('.livedot'); if (dot) dot.hidden = !state.live;
  const onLive = parse().parts[0] === 'live';
  if (!state.live || onLive) { el.hidden = true; return; }
  const l = lesson(state.live.lessonId);
  el.hidden = false;
  el.innerHTML = `<span class="pulse"></span><b>Live with ${esc(lessonNames(l))}</b><span>${liveClock()}</span><a class="btn small" href="#/live/${l.id}">Return to the lesson</a>`;
}

function studentFrame(render) {
  app.innerHTML = `<div class="sv dev-${device}">
    <div class="sv-bar"><span class="sv-tag">Prototype</span><span class="sv-who">Student view · Lucas, 8</span>
      <span class="seg">${['phone', 'tablet', 'full'].map(d => `<button data-dev="${d}" class="${device === d ? 'on' : ''}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</span>
      <a class="btn small" href="#/today">← Tutor app</a></div>
    <div class="sv-stage"><div class="sv-device"><div class="sv-screen" id="svscreen"></div></div></div>
  </div>`;
  on(app.firstElementChild, 'click', '[data-dev]', (e, b) => { device = b.dataset.dev; route(); });
  render($('#svscreen'));
}

export function route() {
  const { parts, q } = parse();
  closeDrawer(); $$('.modal-wrap').forEach(m => m.remove());
  const [a, b, c] = parts;
  if (a === 'me') return studentFrame(el => renderMe(el, b || 'home'));
  if (a === 'play') return studentFrame(el => renderPlay(el, b));
  if (a === 'read') return studentFrame(el => renderRead(el));
  shell();
  const old = $('#content'); const el = old.cloneNode(false); old.replaceWith(el);
  $$('[data-nav]').forEach(n => n.classList.toggle('on', n.dataset.nav === a));
  el.className = 'content page-' + a;
  window.scrollTo(0, 0); $('.main').scrollTop = 0;
  if (a === 'today') renderToday(el);
  else if (a === 'students' && b) renderProfile(el, +b, c || 'overview');
  else if (a === 'students') renderStudents(el, q);
  else if (a === 'library' && c === 'edit') renderEditor(el, b, q);
  else if (a === 'library') renderLibrary(el, q);
  else if (a === 'lessons' && b) renderPlanner(el, +b);
  else if (a === 'lessons') renderLessons(el);
  else if (a === 'live') renderLive(el, b ? +b : null);
  else if (a === 'settings') renderSettings(el);
  else go('#/today');
  strip();
}

function renderSettings(el) {
  el.innerHTML = `<div class="page narrow"><h1 class="title">Settings</h1>
    <section class="card pad"><h3>You</h3><div class="form-grid"><label>Name<input class="input" value="Nora"></label><label>Time zone<select class="input"><option>America/Montevideo (UTC−3)</option><option>Europe/Berlin</option><option>Europe/London</option></select></label>
      <label>I teach<select class="input"><option>Spanish</option></select></label><label>My students read<select class="input"><option>English</option><option>German</option></select></label></div></section>
    <section class="card pad"><h3>Plan</h3><p><span class="badge krabsy">Pilot · free</span> 28 of 100 students. Own material, editor, planner and live classroom are included during the pilot.</p></section>
    <section class="card pad"><h3>Reminders</h3><label class="check"><input type="checkbox" checked> Tell me on “Today” when a student has not practised for <input class="input tiny" value="10"> days</label>
      <label class="check"><input type="checkbox" checked> Tell me when a lesson within 24 hours has no plan</label></section></div>`;
}

window.addEventListener('hashchange', route);
route();
