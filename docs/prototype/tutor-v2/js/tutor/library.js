// Library: three shelves, search + filters in the browser, preview drawer with the real player.
import { state, TOPICS, TOPIC_IDS, KINDS, LEVELS, material, student, farmSteps, cardsOnly, lucasPlan, STEP_KINDS } from '../data.js';
import { esc, on, $, toast, go, drawer, pickStudents, assignTo, cover, icon, avatar } from '../ui.js';
import { mountPlayer } from '../student/player.js';
import { mountBook } from '../student/book.js';

const F = { shelf: 'krabsy', q: '', kind: '', topic: '', level: '', fav: false };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const outWith = m => state.assignments.filter(a => a.materialId === m.id && a.status !== 'done');

function items() {
  let list = state.materials.filter(m => F.shelf === 'assigned' ? outWith(m).length : m.owner === F.shelf);
  const q = norm(F.q.trim());
  if (q) list = list.filter(m => norm(`${m.title} ${TOPICS[m.topic].label} ${TOPICS[m.topic].es} ${KINDS[m.kind].label} ${m.level}`).includes(q));
  if (F.kind) list = list.filter(m => m.kind === F.kind);
  if (F.topic) list = list.filter(m => m.topic === F.topic);
  if (F.level) list = list.filter(m => m.level === F.level);
  if (F.fav) list = list.filter(m => m.fav);
  return list;
}

export function duplicate(m) {
  const c = { ...m, id: 'm_' + (state.materials.length + 100), owner: 'mine', draft: true, from: m.title, title: m.title + ' (my version)', used: 0, fav: false, updated: '25 Nov' };
  if (m.id === 'm_book_granja') c.id = 'm_copy_' + state.materials.length;
  state.materials.push(c); return c;
}

export function renderLibrary(el, q) {
  ['shelf', 'kind', 'topic'].forEach(k => { if (q.get(k)) F[k] = q.get(k); });
  if (q.get('topic') || q.get('kind')) { F.q = ''; }
  const counts = () => ({ krabsy: state.materials.filter(m => m.owner === 'krabsy').length, mine: state.materials.filter(m => m.owner === 'mine').length, assigned: state.materials.filter(m => outWith(m).length).length });
  el.innerHTML = `<div class="page">
    <div class="page-head"><div><h1 class="title">Library</h1><p class="lead">Krabsy’s material and yours. Assign it, or make it your own.</p></div></div>
    <div class="shelves" data-shelves></div>
    <div class="toolbar">
      <label class="field-search">${icon('search')}<input type="search" placeholder="Search: granja, feelings, estar …" data-q value="${esc(F.q)}"></label>
      <select class="input sel" data-s="kind"><option value="">Kind</option>${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${F.kind === k ? 'selected' : ''}>${v.plural}</option>`).join('')}</select>
      <select class="input sel" data-s="topic"><option value="">Topic</option>${TOPIC_IDS.map(t => `<option value="${t}" ${F.topic === t ? 'selected' : ''}>${TOPICS[t].label}</option>`).join('')}</select>
      <select class="input sel" data-s="level"><option value="">Level</option>${LEVELS.map(l => `<option ${F.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="chip-btn" data-fav>☆ Favourites</button>
      <span class="grow"></span><span class="mute" data-n></span>
    </div>
    <div data-grid></div></div>`;
  const shelves = () => { const c = counts(); $('[data-shelves]', el).innerHTML = [['krabsy', 'Krabsy', 'curated, ready to use'], ['mine', 'Mine', 'your own and your copies'], ['assigned', 'Assigned', 'out with students now']]
    .map(([id, l, sub]) => `<button class="shelf-tab ${F.shelf === id ? 'on' : ''}" data-shelf="${id}"><b>${l} <span class="count">${c[id]}</span></b><small>${sub}</small></button>`).join(''); };
  const grid = () => {
    const list = items(); $('[data-n]', el).textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
    $('[data-fav]', el).classList.toggle('on', F.fav); $('[data-fav]', el).textContent = (F.fav ? '★' : '☆') + ' Favourites';
    if (!list.length) { $('[data-grid]', el).innerHTML = `<div class="empty-box">Nothing here with these filters. <button class="link" data-reset>Clear filters</button></div>`; return; }
    if (F.shelf === 'assigned') { $('[data-grid]', el).innerHTML = `<div class="card table-card"><table class="tbl"><thead><tr><th>Material</th><th>Out with</th><th>Due</th><th>Finished</th></tr></thead><tbody>${list.map(m => { const out = outWith(m), all = state.assignments.filter(a => a.materialId === m.id);
      return `<tr data-open="${m.id}"><td class="c-name"><a>${cover(m, 'xs')}<span><b>${esc(m.title)}</b><small>${KINDS[m.kind].label} · ${TOPICS[m.topic].label} · ${m.level}</small></span></a></td>
        <td data-l="Out with"><span class="avs">${out.slice(0, 5).map(a => avatar(student(a.studentId), 'sm')).join('')}</span> ${out.length} student${out.length > 1 ? 's' : ''}${out.some(a => a.status === 'late') ? ' · <span class="txt-bad">1 late</span>' : ''}</td>
        <td data-l="Due">${esc(out[0].due || 'no date')}</td><td data-l="Finished">${all.length - out.length} of ${all.length}</td></tr>`; }).join('')}</tbody></table></div>`; return; }
    $('[data-grid]', el).innerHTML = `<div class="lib-grid">${list.map(m => `<article class="lib-card" data-open="${m.id}" tabindex="0">
        ${cover(m)}
        <button class="fav ${m.fav ? 'on' : ''}" data-favm="${m.id}" aria-label="Favourite">${m.fav ? '★' : '☆'}</button>
        <div class="lib-meta"><span class="kind">${KINDS[m.kind].label}</span><span class="chip chip-level">${m.level}</span></div>
        <h3>${esc(m.title)}</h3>
        <p class="mute">${TOPICS[m.topic].label} · ${esc(m.size)}${m.mins ? ` · ${m.mins}'` : ''}</p>
        <p class="lib-foot">${m.draft ? '<span class="badge draft">Draft</span>' : `<span class="badge ${m.owner}">${m.owner === 'mine' ? 'Mine' : 'Krabsy ✓'}</span>`}<span class="mute">${m.used ? `used ${m.used}×` : 'not used yet'}</span></p></article>`).join('')}</div>`;
  };
  shelves(); grid();
  $('[data-q]', el).addEventListener('input', e => { F.q = e.target.value; grid(); });
  on(el, 'change', '[data-s]', (e, s) => { F[s.dataset.s] = s.value; grid(); });
  on(el, 'click', '[data-shelf]', (e, b) => { F.shelf = b.dataset.shelf; shelves(); grid(); });
  on(el, 'click', '[data-fav]', () => { F.fav = !F.fav; grid(); });
  on(el, 'click', '[data-reset]', () => { Object.assign(F, { q: '', kind: '', topic: '', level: '', fav: false }); el.querySelectorAll('[data-s]').forEach(s => { s.value = ''; }); $('[data-q]', el).value = ''; grid(); });
  on(el, 'click', '[data-favm]', (e, b) => { e.stopPropagation(); const m = material(b.dataset.favm); m.fav = !m.fav; grid(); });
  on(el, 'click', '[data-open]', (e, c) => { if (!e.target.closest('[data-favm]')) preview(material(c.dataset.open), () => { shelves(); grid(); }); });
  on(el, 'keydown', '.lib-card', (e, c) => { if (e.key === 'Enter') preview(material(c.dataset.open), () => { shelves(); grid(); }); });
  if (q.get('open') && material(q.get('open'))) preview(material(q.get('open')), () => { shelves(); grid(); });
}

function preview(m, changed) {
  const out = outWith(m); const playable = ['worksheet', 'practice', 'pictures', 'book'].includes(m.kind);
  drawer(`<header class="dr-h"><div><span class="mute">${KINDS[m.kind].label} · ${TOPICS[m.topic].label} · ${m.level}${m.mins ? ` · about ${m.mins} min` : ''}</span><h2>${esc(m.title)}</h2>
      <p>${m.draft ? '<span class="badge draft">Draft</span>' : `<span class="badge ${m.owner}">${m.owner === 'mine' ? 'Mine' : 'Krabsy ✓'}</span>`} ${m.from ? `<span class="mute">made from “${esc(m.from)}”</span>` : ''} <span class="mute">· ${esc(m.size)} · used ${m.used}×</span></p></div>
      <button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="dr-actions"><button class="btn primary" data-a="assign">Assign to students</button>
      ${playable ? `<a class="btn" href="${m.kind === 'book' ? '#/read' : '#/play/' + (m.kind === 'pictures' ? 'm_pic_animals' : 'm_ws_farm')}">Try as student</a>` : ''}
      ${m.kind === 'worksheet' || m.kind === 'book' || m.kind === 'template' ? `<button class="btn" data-a="${m.owner === 'mine' ? 'edit' : 'dup'}">${m.owner === 'mine' ? 'Edit' : 'Duplicate & edit'}</button>` : ''}
      <button class="btn ghost" data-a="link">Copy public link</button></div>
    <div class="dr-body">
      ${m.blurb ? `<p>${esc(m.blurb)}</p>` : ''}
      ${out.length ? `<p class="dr-out"><span class="avs">${out.slice(0, 6).map(a => avatar(student(a.studentId), 'sm')).join('')}</span> Out with ${out.length} student${out.length > 1 ? 's' : ''} now</p>` : ''}
      ${playable ? `<div class="dr-prev-h"><h4>Preview: this is the real student page. Play it.</h4><span class="seg"><button data-fr="phone" class="on">Phone</button><button data-fr="tablet">Tablet</button></span></div>
        <div class="frame phone" data-frame><div class="frame-screen" data-player></div></div>
        ${m.id !== 'm_ws_farm' && m.id !== 'm_book_granja' && m.id !== 'm_pic_animals' ? '<p class="proto-note">Prototype: only “Lucas visits the farm”, “La granja” and the animal cards have real content. This preview shows them as a stand-in.</p>' : ''}`
      : m.kind === 'template' ? `<h4>Run sheet</h4><ol class="run-read">${lucasPlan().map(p => `<li><span class="rk">${STEP_KINDS[p.kind][1]}</span><div><b>${STEP_KINDS[p.kind][0]} · ${p.mins}'</b><br>${esc(p.title)} <span class="mute">${esc(p.detail)}</span></div></li>`).join('')}</ol><button class="btn" data-a="uselesson">Use for a lesson</button>`
      : `<div class="game-ph"><span>🥚</span><b>${esc(m.title)}</b><p class="mute">Opens the real Krabsy game with this topic. Answers count for the student’s stars.</p></div>`}
    </div>`, (w, close) => {
    const mount = () => { const host = $('[data-player]', w); if (!host) return; host.innerHTML = '';
      if (m.kind === 'book') mountBook(host, {}); else mountPlayer(host, m.blocks ? JSON.parse(JSON.stringify(m.blocks)) : m.kind === 'pictures' ? cardsOnly() : farmSteps(), {}); };
    mount();
    on(w, 'click', '[data-fr]', (e, b) => { $('[data-frame]', w).className = 'frame ' + b.dataset.fr; w.querySelectorAll('[data-fr]').forEach(x => x.classList.toggle('on', x === b)); w.querySelector('.drawer').classList.toggle('wide', b.dataset.fr === 'tablet'); });
    on(w, 'click', '[data-a]', (e, b) => {
      const a = b.dataset.a;
      if (a === 'assign') pickStudents({ title: `Assign “${m.title}”`, sub: 'Tick students, or tap a group to tick all of it.',
        extra: '<label class="lbl inline">Due <select class="input sel" data-due><option>Fri 27 Nov</option><option>Mon 30 Nov</option><option>next lesson</option><option value="">no date</option></select></label>',
        onDone: (ids, mw) => { assignTo(ids, m, $('[data-due]', mw).value); close(); changed(); } });
      if (a === 'link') toast('Public link copied. Anyone can play it; results are only tracked when you assign it.');
      if (a === 'dup') { const c = duplicate(m); toast(`Copy saved in “Mine” as a draft`); go(`#/library/${c.id}/edit`); }
      if (a === 'edit') go(`#/library/${m.id}/edit`);
      if (a === 'uselesson') { toast('Open a lesson and choose “Templates” to use it.'); go('#/lessons'); }
    });
  });
}
