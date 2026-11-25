// Small shared helpers: escaping, icons, toast, modal, drawer, pickers.
import { state, student, TOPICS, KINDS } from './data.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const go = hash => { location.hash = hash; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function on(root, type, sel, fn) {
  root.addEventListener(type, e => { const t = e.target.closest(sel); if (t && root.contains(t)) fn(e, t); });
}

const I = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  students: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5c2.6.2 4.2 1.9 4.6 4.5"/>',
  library: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5c-.8 0-1.5-.7-1.5-1.5z"/><path d="M11 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H11"/><path d="M7 8h1.5M7 11h1.5"/>',
  lessons: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  live: '<circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.3-1.3L14 3h-4l-.3 2.4a7 7 0 0 0-2.3 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.3 1.3L10 21h4l.3-2.4a7 7 0 0 0 2.3-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  up: '<path d="m6 14 6-6 6 6"/>', down: '<path d="m6 10 6 6 6-6"/>',
  left: '<path d="m14 6-6 6 6 6"/>', right: '<path d="m10 6 6 6-6 6"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V6a2 2 0 0 1 2-2h8"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  undo: '<path d="M8 5 4 9l4 4"/><path d="M4 9h10a5.5 5.5 0 0 1 0 11h-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1-4 4-6 8-6s7 2 8 6"/>',
};
export const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

export const stars = (n, max = 5) => `<span class="stars" aria-label="${n} of ${max} stars">${'<i class="on">★</i>'.repeat(Math.round(n))}${'<i>★</i>'.repeat(max - Math.round(n))}</span>`;
export const avatar = (s, size = '') => `<span class="av ${size}" style="background:${s.color}">${esc(s.name[0])}</span>`;
export const levelChip = s => `<span class="chip chip-level ${s.adult ? 'is-adult' : ''}">${esc(s.level)}</span>`;
export function sparkline(arr) {
  const w = 44, h = 18, lo = Math.min(...arr) - 0.15, hi = Math.max(...arr) + 0.15;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * (w - 4) + 2},${h - 3 - ((v - lo) / (hi - lo)) * (h - 6)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export const bar = (done, total, tone = '') => `<span class="bar ${tone}"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></span>`;
export function cover(m, cls = '') {
  const t = TOPICS[m.topic]; const k = [...m.title].reduce((n, c) => n + c.charCodeAt(0), 0) % t.emoji.length; const e = [...t.emoji.slice(k), ...t.emoji.slice(0, k)];
  if (cls.includes('xs')) return `<span class="cover xs tint-${t.tint}"><b>${e[0]}</b></span>`;
  const art = m.kind === 'worksheet' || m.kind === 'practice' ? `<span class="cv-sheet"><b>${e[0]}</b><i></i><i></i><i class="s"></i></span>`
    : m.kind === 'template' ? `<span class="cv-run"><i>${e[0]}</i><i>▤</i><i>📖</i><i>▶</i></span>`
    : m.kind === 'game' ? `<span class="cv-game">${e[0]}<b>▶</b></span>`
    : m.kind === 'book' ? `<span class="cv-book"><b>${e[0]}</b><em>${esc(m.title)}</em></span>`
    : `<span class="cv-pics">${e.map(x => `<i>${x}</i>`).join('')}</span>`;
  return `<span class="cover tint-${t.tint} kind-${m.kind} ${cls}">${art}</span>`;
}

export function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3000);
}

// Modal. opts: { title, body, wide, actions: [{label, primary, onClick(el) -> false keeps open}], onMount(el, close) }
export function modal(opts) {
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''} ${opts.cls || ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
    <header><h2>${esc(opts.title)}</h2><button class="iconbtn" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">${opts.body}</div>
    ${opts.actions ? `<footer>${opts.actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}
  </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', key); opts.onClose && opts.onClose(); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-act]');
    if (b) { const a = opts.actions[+b.dataset.act]; if (!a.onClick || a.onClick(wrap) !== false) close(); }
  });
  $('#layer').appendChild(wrap);
  opts.onMount && opts.onMount(wrap, close);
  return close;
}

export function drawer(html, onMount, onClose) {
  closeDrawer();
  const wrap = document.createElement('div'); wrap.className = 'drawer-wrap';
  wrap.innerHTML = `<aside class="drawer" role="dialog" aria-label="Details">${html}</aside>`;
  const close = () => { wrap.remove(); onClose && onClose(); };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  $('#layer').appendChild(wrap);
  onMount && onMount(wrap, close);
  return close;
}
export const closeDrawer = () => $$('.drawer-wrap').forEach(d => d.remove());

// Pick students (tick list with search and group shortcuts).
export function pickStudents({ title, sub = '', pre = [], confirm = 'Assign', extra = '', onDone }) {
  const sel = new Set(pre);
  const list = q => state.students.filter(s => !s.archived && s.name.toLowerCase().includes(q.toLowerCase()))
    .map(s => `<label class="pick-row"><input type="checkbox" value="${s.id}" ${sel.has(s.id) ? 'checked' : ''}>${avatar(s, 'sm')}<b>${esc(s.name)}</b>${levelChip(s)}<span class="mute">${esc(s.groups.join(', '))}</span></label>`).join('');
  modal({
    title, body: `${sub ? `<p class="mute">${sub}</p>` : ''}
      <input class="input" type="search" placeholder="Search students" data-q>
      <div class="chips">${state.groups.map(g => `<button class="chip-btn" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <div class="pick-list" data-list>${list('')}</div>${extra}
      <p class="mute" data-count></p>`,
    actions: [{ label: 'Cancel' }, { label: confirm, primary: true, onClick: el => { if (!sel.size) { toast('Tick at least one student'); return false; } onDone([...sel], el); } }],
    onMount(el) {
      const count = () => { $('[data-count]', el).textContent = `${sel.size} selected`; }; count();
      el.addEventListener('change', e => { if (e.target.matches('.pick-row input')) { e.target.checked ? sel.add(+e.target.value) : sel.delete(+e.target.value); count(); } });
      $('[data-q]', el).addEventListener('input', e => { $('[data-list]', el).innerHTML = list(e.target.value); });
      on(el, 'click', '[data-g]', (e, b) => { state.students.filter(s => !s.archived && s.groups.includes(b.dataset.g)).forEach(s => sel.add(s.id)); $('[data-list]', el).innerHTML = list($('[data-q]', el).value); count(); });
    },
  });
}

// Pick one material from the library.
export function pickMaterial({ title = 'Choose material', kinds = null, onDone }) {
  const list = q => state.materials.filter(m => (!kinds || kinds.includes(m.kind)) && !m.draft && (m.title + ' ' + TOPICS[m.topic].label).toLowerCase().includes(q.toLowerCase())).slice(0, 40)
    .map(m => `<button class="pick-row as-btn" data-m="${m.id}">${cover(m, 'xs')}<span><b>${esc(m.title)}</b><br><span class="mute">${KINDS[m.kind].label} · ${TOPICS[m.topic].label} · ${m.level}${m.mins ? ` · ${m.mins}'` : ''}</span></span><span class="badge ${m.owner}">${m.owner === 'mine' ? 'Mine' : 'Krabsy ✓'}</span></button>`).join('') || '<p class="mute">Nothing found.</p>';
  modal({
    title, wide: true, body: `<input class="input" type="search" placeholder="Search the library: farm, estar, feelings …" data-q><div class="pick-list tall" data-list>${list('')}</div>`,
    onMount(el, close) {
      $('[data-q]', el).addEventListener('input', e => { $('[data-list]', el).innerHTML = list(e.target.value); });
      on(el, 'click', '[data-m]', (e, b) => { close(); onDone(state.materials.find(m => m.id === b.dataset.m)); });
      $('[data-q]', el).focus();
    },
  });
}

export function assignTo(ids, m, due = 'Fri 27 Nov') {
  ids.forEach(id => { if (!state.assignments.some(a => a.materialId === m.id && a.studentId === id && a.status !== 'done')) state.assignments.push({ materialId: m.id, studentId: id, due, status: 'open', score: null }); });
  m.used += ids.length;
  const names = ids.map(i => student(i).name);
  toast(`<b>${esc(m.title)}</b> assigned to ${names.length > 3 ? names.length + ' students' : esc(names.join(', '))}`);
}

export function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'es-ES'; u.rate = 0.85;
    const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('es')); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* no speech in this browser */ }
}
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const refresh = () => window.dispatchEvent(new Event('hashchange'));
