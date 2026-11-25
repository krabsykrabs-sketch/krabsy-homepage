// Students at scale: table, search, filter chips, sorting, groups, archive, bulk actions.
import { state, attention, nextLesson, lessonWhen, activeLabel, dueLabel, LEVELS, rng } from '../data.js';
import { esc, on, $, avatar, levelChip, sparkline, bar, toast, modal, go, pickMaterial, assignTo, icon } from '../ui.js';

const F = { q: '', filter: 'all', level: '', group: '', sort: 'next', dir: 1, archived: false, sel: new Set() };
const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['overdue', 'Homework overdue'], ['children', 'Children'], ['adults', 'Adults']];
const HIDDEN = { duetoday: 'Homework due today', done: 'Homework done' };

function rows() {
  let list = state.students.filter(s => s.archived === F.archived);
  const q = F.q.trim().toLowerCase();
  if (q) list = list.filter(s => (s.name + ' ' + s.groups.join(' ') + ' ' + s.level).toLowerCase().includes(q));
  if (F.filter === 'attention') list = list.filter(s => attention(s));
  if (F.filter === 'overdue') list = list.filter(s => s.hw && s.hw.status === 'late');
  if (F.filter === 'duetoday') list = list.filter(s => s.hw && s.hw.status === 'open' && s.hw.due === 0);
  if (F.filter === 'done') list = list.filter(s => s.hw && s.hw.status === 'done');
  if (F.filter === 'children') list = list.filter(s => !s.adult);
  if (F.filter === 'adults') list = list.filter(s => s.adult);
  if (F.level) list = list.filter(s => s.level === F.level);
  if (F.group) list = list.filter(s => s.groups.includes(F.group));
  const key = {
    name: s => s.name, level: s => LEVELS.indexOf(s.level),
    next: s => { const l = nextLesson(s); return l ? l.day * 10000 + parseInt(l.time.replace(':', ''), 10) : 1e9; },
    homework: s => !s.hw ? 3 : s.hw.status === 'late' ? 0 : s.hw.status === 'open' ? 1 + s.hw.done / s.hw.total : 2.5,
    active: s => s.lastActive === null ? 999 : s.lastActive, stars: s => -s.stars,
  }[F.sort];
  return list.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * F.dir; });
}

function hwCell(s) {
  if (!s.hw) return '<span class="mute">—</span>';
  if (s.hw.status === 'done') return `<span class="hw">${bar(1, 1, 'good')}<span>done · ${s.hw.score} %</span></span>`;
  return `<span class="hw">${bar(s.hw.done, s.hw.total, s.hw.status === 'late' ? 'bad' : '')}<span>${s.hw.done}/${s.hw.total} · <span class="${s.hw.status === 'late' ? 'txt-bad' : ''}">${dueLabel(s.hw.due)}</span></span></span>`;
}

export function renderStudents(el, q) {
  if (q && q.get('filter')) { F.filter = q.get('filter'); F.archived = false; }
  if (q && q.get('sort')) { F.sort = q.get('sort'); F.dir = 1; }
  F.sel.clear();
  let active, nAtt, nOver;
  const recount = () => { active = state.students.filter(s => !s.archived); nAtt = active.filter(s => attention(s)).length; nOver = active.filter(s => s.hw && s.hw.status === 'late').length; };
  recount();
  const th = (id, label) => `<th><button class="th ${F.sort === id ? 'on' : ''}" data-sort="${id}">${label}<span>${F.sort === id ? (F.dir > 0 ? '▲' : '▼') : ''}</span></button></th>`;
  const heads = () => `<tr><th class="cb"><input type="checkbox" data-all aria-label="Select all"></th>${th('name', 'Name')}${th('level', 'Level')}${th('next', 'Next lesson')}${th('homework', 'Homework')}${th('active', 'Last active')}${th('stars', 'Stars')}</tr>`;
  el.innerHTML = `<div class="page">
    <div class="page-head"><div><h1 class="title">Students <span class="count" data-n>${active.length}</span></h1></div>
      <div class="quick"><button class="btn" data-links>Copy all links</button><button class="btn primary" data-add>${icon('plus')} Add students</button></div></div>
    <div class="toolbar">
      <label class="field-search">${icon('search')}<input type="search" placeholder="Search name, group, level" data-q value="${esc(F.q)}"></label>
      <div class="chips" data-chips></div>
      <select class="input sel" data-level><option value="">Level</option>${LEVELS.map(l => `<option ${F.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="input sel" data-group><option value="">Group</option>${state.groups.map(g => `<option ${F.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
      <label class="check sm"><input type="checkbox" data-arch ${F.archived ? 'checked' : ''}> Archived (<span data-narch>${state.students.length - active.length}</span>)</label>
    </div>
    <div class="card table-card">
      <table class="tbl students"><thead data-head>${heads()}</thead>
        <tbody data-body></tbody></table>
      <p class="tbl-foot" data-foot></p>
    </div>
    <div class="bulk" data-bulk hidden></div></div>`;
  const chips = () => { $('[data-chips]', el).innerHTML = FILTERS.map(([id, l]) => `<button class="chip-btn ${F.filter === id ? 'on' : ''}" data-f="${id}">${l}${id === 'attention' ? ` <b>${nAtt}</b>` : id === 'overdue' ? ` <b>${nOver}</b>` : ''}</button>`).join('')
    + (HIDDEN[F.filter] ? `<button class="chip-btn on" data-f="all">${HIDDEN[F.filter]} ✕</button>` : ''); };
  const body = () => {
    recount(); chips(); $('[data-n]', el).textContent = active.length; $('[data-narch]', el).textContent = state.students.length - active.length;
    const list = rows();
    $('[data-body]', el).innerHTML = list.map(s => {
      const a = attention(s), l = nextLesson(s);
      return `<tr data-id="${s.id}" class="${F.sel.has(s.id) ? 'sel' : ''}">
        <td class="cb"><input type="checkbox" data-cb="${s.id}" ${F.sel.has(s.id) ? 'checked' : ''} aria-label="Select ${esc(s.name)}"></td>
        <td class="c-name"><a href="#/students/${s.id}/overview">${avatar(s)}<span><b>${esc(s.name)}</b>${a ? `<span class="flag ${a.tone}" title="${esc(a.reason)}">${a.icon}</span>` : ''}<small>${s.adult ? 'adult' : s.age + ' y'}${s.groups.length ? ' · ' + esc(s.groups.join(', ')) : ''}${s.archived ? ' · ' + esc(s.archivedNote) : ''}</small></span></a></td>
        <td data-l="Level">${levelChip(s)}</td>
        <td data-l="Next lesson" class="${l && l.day === 2 ? 'strong' : ''}">${lessonWhen(l)}</td>
        <td data-l="Homework">${hwCell(s)}</td>
        <td data-l="Last active" class="${s.lastActive === null || s.lastActive >= 10 ? 'txt-bad' : ''}">${activeLabel(s.lastActive)}${s.lastActive === null ? ' ⚠' : ''}</td>
        <td data-l="Stars" class="c-stars">${s.lastActive === null ? '<span class="mute">—</span>' : `<b>${s.stars.toFixed(1)}</b>${sparkline(s.trend)}`}</td></tr>`;
    }).join('') || `<tr><td colspan="7" class="empty">No students match. <button class="link" data-reset>Clear filters</button></td></tr>`;
    $('[data-foot]', el).textContent = `${list.length} of ${F.archived ? state.students.length - active.length : active.length} ${F.archived ? 'archived ' : ''}students · stars = average over all topics, line = last 3 weeks`;
    bulk();
  };
  const bulk = () => {
    const b = $('[data-bulk]', el); b.hidden = !F.sel.size;
    b.innerHTML = `<b>${F.sel.size} selected</b><button class="btn primary" data-bulk-a="assign">Assign material</button><button class="btn" data-bulk-a="hw">Give homework</button>
      <button class="btn" data-bulk-a="group">Add to group</button><button class="btn" data-bulk-a="archive">${F.archived ? 'Bring back' : 'Archive'}</button><button class="link" data-bulk-a="clear">Clear</button>`;
    $('[data-all]', el).checked = F.sel.size > 0 && F.sel.size === rows().length;
  };
  chips(); body();

  $('[data-q]', el).addEventListener('input', e => { F.q = e.target.value; body(); });
  on(el, 'click', '[data-f]', (e, b) => { F.filter = b.dataset.f; chips(); body(); });
  on(el, 'click', '[data-reset]', () => { Object.assign(F, { q: '', filter: 'all', level: '', group: '' }); $('[data-q]', el).value = ''; $('[data-level]', el).value = ''; $('[data-group]', el).value = ''; body(); });
  $('[data-level]', el).addEventListener('change', e => { F.level = e.target.value; body(); });
  $('[data-group]', el).addEventListener('change', e => { F.group = e.target.value; body(); });
  $('[data-arch]', el).addEventListener('change', e => { F.archived = e.target.checked; F.sel.clear(); body(); });
  on(el, 'click', '[data-sort]', (e, b) => { if (F.sort === b.dataset.sort) F.dir *= -1; else { F.sort = b.dataset.sort; F.dir = 1; } $('[data-head]', el).innerHTML = heads(); body(); });
  on(el, 'change', '[data-cb]', (e, c) => { c.checked ? F.sel.add(+c.dataset.cb) : F.sel.delete(+c.dataset.cb); c.closest('tr').classList.toggle('sel', c.checked); bulk(); });
  on(el, 'change', '[data-all]', (e, c) => { F.sel.clear(); if (c.checked) rows().forEach(s => F.sel.add(s.id)); body(); });
  on(el, 'click', 'tbody tr', (e, tr) => { if (!e.target.closest('a, input, button') && tr.dataset.id) go(`#/students/${tr.dataset.id}/overview`); });
  on(el, 'click', '[data-links]', () => toast(`${active.length} personal links copied as a plain list`));
  on(el, 'click', '[data-add]', () => addStudentsModal(() => body()));
  on(el, 'click', '[data-bulk-a]', (e, b) => {
    const ids = [...F.sel], a = b.dataset.bulkA;
    if (a === 'clear') { F.sel.clear(); return body(); }
    if (a === 'assign' || a === 'hw') return pickMaterial({ title: `${a === 'hw' ? 'Homework' : 'Material'} for ${ids.length} student${ids.length > 1 ? 's' : ''}`, kinds: a === 'hw' ? ['practice', 'worksheet'] : null,
      onDone: m => { assignTo(ids, m); if (a === 'hw') ids.forEach(id => { const s = state.students.find(x => x.id === id); s.hw = { title: m.title, done: 0, total: 20, due: 3, status: 'open', score: 0 }; }); F.sel.clear(); body(); } });
    if (a === 'archive') { ids.forEach(id => { const s = state.students.find(x => x.id === id); s.archived = !F.archived; s.archivedNote = 'Archived today'; }); toast(F.archived ? `${ids.length} brought back` : `${ids.length} archived. Their data stays; bring them back any time.`); F.sel.clear(); return body(); }
    if (a === 'group') modal({ title: 'Add to group', body: `<div class="chips">${state.groups.map(g => `<button class="chip-btn" data-pickg="${esc(g)}">${esc(g)}</button>`).join('')}</div><label class="lbl">Or a new group<input class="input" data-newg placeholder="e.g. Thursday"></label>`,
      actions: [{ label: 'Cancel' }, { label: 'Add', primary: true, onClick: w => { const g = $('[data-newg]', w).value.trim() || w.dataset.g; if (!g) { toast('Pick or name a group'); return false; } if (!state.groups.includes(g)) state.groups.push(g); ids.forEach(id => { const s = state.students.find(x => x.id === id); if (!s.groups.includes(g)) s.groups.push(g); }); toast(`${ids.length} added to “${esc(g)}”`); F.sel.clear(); body(); } }],
      onMount: w => on(w, 'click', '[data-pickg]', (ev, c) => { w.dataset.g = c.dataset.pickg; w.querySelectorAll('[data-pickg]').forEach(x => x.classList.toggle('on', x === c)); }) });
  });
}

// Add several at once: paste names, preview, nothing is created before the button.
export function addStudentsModal(done) {
  const parseList = txt => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [name, ...rest] = l.split(',').map(x => x.trim()); const r = rest.join(' ').toLowerCase();
    return { name, adult: /adult/.test(r), level: (LEVELS.find(v => r.includes(v.toLowerCase())) || 'A1') }; });
  modal({
    title: 'Add students', wide: true,
    body: `<div class="two"><div><label class="lbl">One first name per line. Level and “adult” after a comma, if you like.
        <textarea class="input" rows="9" data-names placeholder="Julia&#10;Marco, A2&#10;Helen, adult, B1"></textarea></label>
        <button class="link" data-sample>Fill with an example</button></div>
      <div><p class="lbl">Preview</p><div class="preview-list" data-prev><p class="mute">Nothing yet. No account, no email: each student gets a personal link.</p></div></div></div>`,
    actions: [{ label: 'Cancel' }, { label: 'Add students', primary: true, onClick: w => {
      const list = parseList($('[data-names]', w).value); if (!list.length) { toast('Type at least one name'); return false; }
      const R = rng(Date.now() % 1000);
      list.forEach(p => { const id = Math.max(...state.students.map(s => s.id)) + 1; state.students.push({ id, name: p.name, age: p.adult ? 30 : 9, adult: p.adult, level: p.level, groups: [], slot: null, goal: '', color: ['#f2937e', '#babfd8', '#cdd9b4', '#f4c95d'][id % 4],
        hw: null, lastActive: null, stars: 0, trend: [0, 0, 0], topicStars: {}, drop: null, noNote: false, low: null, linkIssued: '25 Nov', archived: false, archivedNote: '', consent: p.adult, notes: [], trips: [], activity: Array(28).fill(0), dismissed: false, r: R() }); });
      toast(`${list.length} student${list.length > 1 ? 's' : ''} added. Their link cards are on each profile under “Family”.`); done && done();
    } }],
    onMount(w) {
      const ta = $('[data-names]', w);
      const prev = () => { const list = parseList(ta.value); $('[data-prev]', w).innerHTML = list.length ? list.map(p => `<div class="pick-row"><span class="av sm" style="background:#cdd9b4">${esc(p.name[0] || '?')}</span><b>${esc(p.name)}</b><span class="chip chip-level ${p.adult ? 'is-adult' : ''}">${p.level}</span><span class="mute">${p.adult ? 'adult' : 'child'} · link ready</span></div>`).join('') : '<p class="mute">Nothing yet.</p>';
        w.querySelector('[data-act="1"]').textContent = list.length ? `Add ${list.length} student${list.length > 1 ? 's' : ''}` : 'Add students'; };
      ta.addEventListener('input', prev);
      on(w, 'click', '[data-sample]', () => { ta.value = 'Julia\nMarco, A2\nHelen, adult, B1\nPablo, Pre-A1'; prev(); });
      ta.focus();
    },
  });
}
