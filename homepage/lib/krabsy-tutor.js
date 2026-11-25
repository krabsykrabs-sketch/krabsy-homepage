/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — tutor pages (docs/tutor-platform.md phase 1, 2026-11-25)

   One module for three pages, chosen by <main data-tutor-page="…">:
     start    /en/spanish/tutors/                 what it is + create a space
     space    /en/spanish/tutors/space/#t=…       students; &s=<id> = one profile
     student  /en/spanish/me/#k=…                 the student's own page (homework)

   The tutor token (#t=) and the student key (#k=) travel only in the URL
   fragment, never to a server except as a header to the API. The student key
   is stored as the normal class session (krabsy-class.js adopt), so every
   answer the student gives in a game or drill reaches the tutor.

   Remembered on the tutor's device (localStorage, nothing else):
     krabsy_tutor_spaces  [{ name, token }]
     krabsy_tutor_keys    { "<token-prefix>:<student id>": key }  so the
                          student's link can be shown again (the server only
                          keeps a hash).
   English only for the pilot; texts in T for later languages.
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase, adopt, getSession } from '/lib/krabsy-class.js?v=2026-11-25';

const LANG = 'en';
const PATHS = { start: '/en/spanish/tutors/', space: '/en/spanish/tutors/space/', me: '/en/spanish/me/',
  games: '/en/spanish/games/', home: '/en/spanish/' };

const T = {
  title: 'Krabsy for tutors',
  lead: 'Run your Spanish lessons on Krabsy. Every student gets a profile with a star map per topic. Their answers in the games fill it in by themselves, and you can always correct it. You send homework as a game, and you keep a note for every lesson.',
  pilot: 'Pilot: free while we build it with tutors. Tell us what is missing.',
  how: [
    ['Add a student', 'First name only. Krabsy makes a personal link for them: no email, no password.'],
    ['They play', 'Every answer in the games and drills goes into their star map.'],
    ['You plan', 'See what sits and what doesn’t, give homework, write down what you did.'],
  ],
  createH: 'Create your tutor space', yourName: 'Your name (students see it)', yourNamePh: 'e.g. Nora',
  createBtn: 'Create my space', yourSpaces: 'Your spaces on this device',
  created: 'Your space is ready', yourLink: 'Your private link',
  yourLinkWarn: 'Save this link as a bookmark. Whoever has it sees your students. There is no other way in.',
  open: 'Open my space', copy: 'Copy', copied: 'Copied ✓',
  scaleH: 'The star scale (the same for every topic)',
  scale: [
    ['★', 'Has seen it', 'first answers, or you'],
    ['★★', 'Gets it right with help', 'half of the recent answers right'],
    ['★★★', 'Gets it right when choosing', '80 % right in games with choices'],
    ['★★★★', 'Gets it right when typing', '80 % right when typing the answer'],
    ['★★★★★', 'Uses it freely in their own sentences', 'only you set this'],
  ],
  privacyH: 'Privacy',
  privacy: 'Krabsy stores the first name you type, the level and notes you write, and the answers the student gives in games (word, right or wrong, when). No email, no surname, nothing about the device. Ask the parents before you send the link. A space that nobody uses for 6 months is deleted with everything in it, and you can delete it any time.',
  noSpace: 'This space doesn’t exist (any more). The link is incomplete or the space was deleted.',
  errNet: 'No connection. Try again in a moment.', errName: 'Letters only, at most 20 characters.',
  errMany: 'Too many tries. Wait a moment.', errFull: 'This space is full.',
  students: 'Students', addH: 'Add a student', firstName: 'First name', level: 'Level', levelPh: 'e.g. A1',
  goals: 'Goals', goalsPh: 'e.g. ser vs estar before the summer', addBtn: 'Add student',
  consent: 'Only the first name. Ask the parents before you send the link.',
  noStudents: 'No students yet. Add your first one.',
  lastActive: 'last active', thisWeek: 'answers this week', never: 'not played yet', today: 'today',
  daysAgo: (n) => (n === 1 ? 'yesterday' : `${n} days ago`),
  rename: 'Rename', renamePrompt: 'New name for your space:', delSpace: 'Delete space',
  delSpaceQ: 'Delete the space with all students, notes and answers for good?', deleted: 'The space was deleted.',
  retention: (d) => `A space nobody opens for ${d} days is deleted automatically.`,
  back: '← All students',
  linkH: 'Personal link', linkLead: (n) => `Send this to ${n} or the parents. It opens ${n}’s page with the homework; whatever ${n} plays on that device counts here. It works on several devices.`,
  linkUnknown: 'The link was made on another device, so it can’t be shown here.',
  newLink: 'Make a new link', newLinkQ: 'Make a new link? The old link stops working, and devices using it drop out.',
  profileH: 'Profile', edit: 'Edit', save: 'Save', cancel: 'Cancel', notes: 'Notes about the student',
  notesPh: 'What helps, what to watch, interests …', saved: 'Saved ✓',
  mapH: 'Star map', mapLead: 'Measured from the answers. Click a star to set it yourself; your stars win.',
  measured: 'measured', set: 'set by you', auto: 'back to measured', answers: 'answers', right: 'right',
  practise: 'practise', noteFor: 'Note', notePrompt: 'Note for this topic (e.g. “mixes up ser/estar with feelings”):',
  hwH: 'Homework', hwLead: 'Shows up on the student’s page. Progress counts the answers in that topic since you gave it.',
  hwTopic: 'Topic', hwTarget: 'Game or drill', hwDiff: 'Difficulty', hwNote: 'Note for the student', hwNotePh: 'e.g. 10 minutes, twice this week',
  hwAdd: 'Give homework', hwNone: 'No homework yet.', hwProgress: (n, p) => (n ? `${n} answers since then · ${p} % right` : 'not started'),
  levels: [['', 'Everything'], ['1', 'Easy'], ['2', 'Easy + medium']],
  lessonsH: 'Lesson notes', lessonDay: 'Date', lessonNote: 'What you did, what comes next',
  lessonAdd: 'Add note', lessonNone: 'No lesson notes yet.', del: 'Delete',
  where: 'Where they practised', remove: 'Remove student', removeQ: (n) => `Remove ${n}? Their notes and answers are deleted.`,
  meHi: (n) => `Hi ${n}!`, meFrom: (t) => `Homework from ${t}`, meNone: 'No homework right now. Play anything you like!',
  meGo: 'Play', meAll: 'All games', meBad: 'This link doesn’t work any more. Ask your tutor for a new one.',
  meCounts: 'Everything you answer on this device goes to your tutor.',
  topicFallback: (id) => id.replace(/^es_/, '').replace(/_/g, ' '),
  sources: { sprint: 'Sprint', 'fill-the-gap': 'Fill the Gap', flashcards: 'Flashcards', free_practice: 'Free practice',
    'verb-towers': 'Verb Towers', 'verb-kitchen': 'Verb Kitchen', 'verb-platformer': 'Verb Platformer',
    'verb-hatchery': 'Verb Hatchery', 'quiz-room': 'Quiz Room', other: 'Other' },
};
const DRILLS = [{ id: 'sprint', name: 'Sprint' }, { id: 'fill-the-gap', name: 'Fill the Gap' }];

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

function ago(iso) {
  if (!iso) return T.never;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return days <= 0 ? T.today : T.daysAgo(days);
}

function copyButton(text) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'kc-btn kc-btn-ghost'; b.textContent = T.copy;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); } catch (_) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {} ta.remove();
    }
    b.textContent = T.copied; setTimeout(() => { b.textContent = T.copy; }, 1800);
  });
  return b;
}

function errorText(code) {
  return { bad_name: T.errName, too_many: T.errMany, space_full: T.errFull }[code] || T.errNet;
}

/* ── local memory on the tutor's device ─────────────────────────────────── */
function read(key, dflt) { try { return JSON.parse(localStorage.getItem(key) || 'null') || dflt; } catch (_) { return dflt; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }
const spaces = () => read('krabsy_tutor_spaces', []);
function rememberSpace(s) { write('krabsy_tutor_spaces', [s, ...spaces().filter((x) => x.token !== s.token)].slice(0, 10)); }
function forgetSpace(token) { write('krabsy_tutor_spaces', spaces().filter((x) => x.token !== token)); }
const keyId = (token, sid) => `${token.slice(0, 10)}:${sid}`;
const getKey = (token, sid) => read('krabsy_tutor_keys', {})[keyId(token, sid)] || null;
function setKey(token, sid, key) { const k = read('krabsy_tutor_keys', {}); k[keyId(token, sid)] = key; write('krabsy_tutor_keys', k); }

const spaceUrl = (token) => `${location.origin}${PATHS.space}#t=${token}`;
const studentUrl = (key) => `${location.origin}${PATHS.me}#k=${key}`;

/* ── catalogue: topic names, homework targets and their links ──────────── */
let _cat = null;
async function catalogue() {
  if (_cat) return _cat;
  const [topics, games] = await Promise.all([
    fetch('/data/topics.json').then((r) => r.json()),
    fetch('/data/games.json').then((r) => r.json()),
  ]);
  const ids = Object.keys(topics).filter((id) => topics[id][LANG] && topics[id].status !== 'coming_soon');
  _cat = { topics, games, ids };
  return _cat;
}
function topicName(cat, id) {
  const t = cat.topics[id];
  return (t && t.display_name && (t.display_name[LANG] || t.display_name.de)) || T.topicFallback(id);
}
function targetsFor(cat, topic) {
  const t = cat.topics[topic] || {};
  const g = cat.games.filter((x) => (x.topics || []).includes(topic) && x.status !== 'coming_soon' && x.audience !== 'teacher')
    .map((x) => ({ id: x.id, name: (x.name && (x.name[LANG] || x.name.en || x.name.de)) || x.id, thumb: x.thumb_small || x.thumbnail || '' }));
  const d = DRILLS.filter((x) => t.pages && t.pages[x.id] && t.pages[x.id][LANG]).map((x) => ({ id: 'drill:' + x.id, name: x.name, thumb: '' }));
  return [...g, ...d];
}
function targetName(cat, topic, target) {
  const x = targetsFor(cat, topic).find((y) => y.id === target);
  return x ? x.name : target.replace(/^drill:/, '');
}
function homeworkUrl(cat, hw) {
  const q = new URLSearchParams();
  let path;
  if (hw.target.startsWith('drill:')) {
    const t = cat.topics[hw.topic] || {};
    const id = hw.target.slice(6);
    if (!t[LANG] || !t.pages || !t.pages[id] || !t.pages[id][LANG]) return PATHS.games;
    path = `/${LANG}/${t[LANG]}/${t.pages[id][LANG]}/`;
  } else {
    path = PATHS.games + hw.target + '/';
    q.set('topic', hw.topic);
    if (hw.glang && hw.glang !== LANG) q.set('lang', hw.glang);
  }
  if (hw.difficulty) q.set('difficulty', String(hw.difficulty));
  q.set('from', 'teacher');
  return path + '?' + q.toString();
}

/* ── API ────────────────────────────────────────────────────────────────── */
async function api(path, token, body, header = 'X-Tutor-Token') {
  const r = await fetch(apiBase() + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
    headers: Object.assign({ [header]: token }, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || 'http');
  return d;
}

function starsHtml(n, { max = 5, cls = '' } = {}) {
  let s = '';
  for (let i = 1; i <= max; i++) s += `<span class="kt-star${i <= n ? ' is-on' : ''}" aria-hidden="true">★</span>`;
  return `<span class="kt-stars ${cls}" role="img" aria-label="${n} of ${max} stars">${s}</span>`;
}

/* ── start page ─────────────────────────────────────────────────────────── */
function renderStart(main) {
  const list = spaces();
  main.innerHTML = `
    <h1>${T.title}</h1>
    <p class="kc-lead">${T.lead}</p>
    <p class="kt-pilot">${T.pilot}</p>
    <ol class="kt-how">${T.how.map(([h, p]) => `<li><strong>${h}</strong><span>${p}</span></li>`).join('')}</ol>
    ${list.length ? `<section class="kc-card"><h2>${T.yourSpaces}</h2><ul class="kc-list">${list.map((s) =>
      `<li><a href="${PATHS.space}#t=${esc(s.token)}">${esc(s.name)}</a></li>`).join('')}</ul></section>` : ''}
    <form class="kc-card" id="kt-create">
      <h2>${T.createH}</h2>
      <label class="kc-field"><span>${T.yourName}</span><input id="kt-name" maxlength="40" placeholder="${T.yourNamePh}" required></label>
      <p class="kc-error" id="kt-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${T.createBtn}</button>
    </form>
    <div id="kt-result"></div>
    <section class="kc-card"><h2>${T.scaleH}</h2>${scaleTable()}</section>
    <section class="kc-card"><h2>${T.privacyH}</h2><p>${T.privacy}</p></section>`;
  $('#kt-create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#kt-create button'); btn.disabled = true;
    try {
      const d = await api('/api/tutor/create', '', { name: $('#kt-name').value, lang: LANG });
      rememberSpace({ name: d.name, token: d.tutor_token });
      $('#kt-create').hidden = true;
      const box = $('#kt-result');
      box.innerHTML = `<section class="kc-card kc-done"><h2>${T.created}</h2>
        <p class="kc-label">${T.yourLink}</p>
        <p class="kc-row"><code class="kc-url">${esc(spaceUrl(d.tutor_token))}</code><span id="kt-c"></span></p>
        <p class="kc-warn">${T.yourLinkWarn}</p>
        <p><a class="kc-btn" href="${PATHS.space}#t=${esc(d.tutor_token)}">${T.open}</a></p></section>`;
      $('#kt-c').appendChild(copyButton(spaceUrl(d.tutor_token)));
    } catch (e) {
      const el = $('#kt-err'); el.textContent = errorText(e.message); el.hidden = false; btn.disabled = false;
    }
  });
}

function scaleTable() {
  return `<table class="kc-table kt-scale"><tbody>${T.scale.map(([s, m, w], i) =>
    `<tr><td>${starsHtml(i + 1)}</td><td><strong>${m}</strong></td><td class="kc-muted">${w}</td></tr>`).join('')}</tbody></table>`;
}

/* ── space page ─────────────────────────────────────────────────────────── */
function hashParams() {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = h.get('t');
  return { token: t && /^[A-Za-z0-9_-]{20,64}$/.test(t) ? t : null, sid: parseInt(h.get('s') || '', 10) || null };
}

async function renderSpace(main) {
  const { token, sid } = hashParams();
  if (sid) return renderStudent(main, token, sid);
  let d, cat;
  try {
    if (!token) throw new Error('unknown_space');
    [d, cat] = await Promise.all([api('/api/tutor/space', token), catalogue()]);
  } catch (e) {
    main.innerHTML = `<h1>${T.students}</h1><p class="kc-card">${e.message === 'unknown_space' ? T.noSpace : T.errNet}</p>
      <p><a class="kc-btn" href="${PATHS.start}">${T.createH}</a></p>`;
    if (e.message === 'unknown_space' && token) forgetSpace(token);
    return;
  }
  rememberSpace({ name: d.space.name, token });
  const cards = d.students.map((s) => {
    const tps = Object.entries(s.stars).filter(([, n]) => n > 0)
      .sort((a, b) => cat.ids.indexOf(a[0]) - cat.ids.indexOf(b[0]));
    return `<a class="kt-scard" href="#t=${esc(token)}&s=${s.id}">
      <span class="kt-scard-name">${esc(s.name)}${s.level ? ` <span class="kt-level">${esc(s.level)}</span>` : ''}</span>
      <span class="kc-muted">${T.lastActive}: ${ago(s.last_active)} · ${s.answers_week} ${T.thisWeek}</span>
      ${tps.length ? `<span class="kt-mini">${tps.slice(0, 4).map(([tp, n]) => `<span><span class="kt-mini-t">${esc(topicName(cat, tp))}</span>${starsHtml(n)}</span>`).join('')}</span>` : ''}
    </a>`;
  }).join('');
  main.innerHTML = `
    <div class="kc-head"><div><h1>${esc(d.space.name)}</h1><p class="kc-muted">${T.students}: ${d.students.length}</p></div>
      <p class="kc-row"><button class="kc-btn kc-btn-ghost" id="kt-rename">${T.rename}</button></p></div>
    <section class="kt-grid">${cards || `<p class="kc-card kc-muted">${T.noStudents}</p>`}</section>
    <form class="kc-card" id="kt-add">
      <h2>${T.addH}</h2>
      <div class="kt-form-row">
        <label class="kc-field"><span>${T.firstName}</span><input id="kt-sname" maxlength="20" autocomplete="off" required></label>
        <label class="kc-field kt-narrow"><span>${T.level}</span><input id="kt-slevel" maxlength="20" placeholder="${T.levelPh}"></label>
      </div>
      <label class="kc-field kt-wide"><span>${T.goals}</span><input id="kt-sgoals" maxlength="600" placeholder="${T.goalsPh}"></label>
      <p class="kc-muted">${T.consent}</p>
      <p class="kc-error" id="kt-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${T.addBtn}</button>
    </form>
    <section class="kc-card"><h2>${T.scaleH}</h2>${scaleTable()}</section>
    <p class="kc-muted">${T.retention(d.space.delete_after_days)}</p>
    <p><button class="kc-btn kc-btn-danger" id="kt-delspace">${T.delSpace}</button></p>`;
  $('#kt-rename').addEventListener('click', async () => {
    const name = prompt(T.renamePrompt, d.space.name);
    if (name && name.trim()) { await api('/api/tutor/rename', token, { name }); renderSpace(main); }
  });
  $('#kt-add').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#kt-add button'); btn.disabled = true;
    try {
      const r = await api('/api/tutor/student/add', token, { name: $('#kt-sname').value.trim(), level: $('#kt-slevel').value, goals: $('#kt-sgoals').value });
      setKey(token, r.id, r.student_key);
      location.hash = `t=${token}&s=${r.id}`;
    } catch (e) {
      const el = $('#kt-err'); el.textContent = errorText(e.message); el.hidden = false; btn.disabled = false;
    }
  });
  $('#kt-delspace').addEventListener('click', async () => {
    if (!confirm(T.delSpaceQ)) return;
    await api('/api/tutor/delete', token, {});
    forgetSpace(token);
    main.innerHTML = `<h1>${T.students}</h1><p class="kc-card">${T.deleted}</p>`;
  });
}

/* ── one student ────────────────────────────────────────────────────────── */
async function renderStudent(main, token, sid) {
  let d, cat;
  try {
    [d, cat] = await Promise.all([api(`/api/tutor/student?id=${sid}`, token), catalogue()]);
  } catch (e) {
    main.innerHTML = `<p><a href="#t=${esc(token || '')}">${T.back}</a></p><p class="kc-card">${e.message === 'unknown_student' ? T.noSpace : T.errNet}</p>`;
    return;
  }
  const s = d.student;
  const key = getKey(token, sid);
  const reload = () => renderStudent(main, token, sid);
  const post = (path, body) => api(path, token, Object.assign({ id: sid }, body));

  // topics: every topic of this section, plus any other the student answered in
  const topicIds = [...cat.ids, ...Object.keys(d.topics).filter((t) => !cat.ids.includes(t))];
  const empty = { measured: 0, set: null, stars: 0, answers: 0, correct_pct: null, practise: [], note: '' };
  const rows = topicIds.map((tp) => {
    const x = d.topics[tp] || empty;
    const stars = [1, 2, 3, 4, 5].map((i) => `<button type="button" class="kt-star-btn${i <= x.stars ? ' is-on' : ''}" data-topic="${esc(tp)}" data-stars="${i}" title="${esc(T.scale[i - 1][1])}" aria-label="${i}: ${esc(T.scale[i - 1][1])}">★</button>`).join('');
    return `<tr>
      <td><strong>${esc(topicName(cat, tp))}</strong>${x.note ? `<div class="kt-note">${esc(x.note)}</div>` : ''}</td>
      <td class="kt-starcell"><span class="kt-star-set">${stars}</span>
        <div class="kc-muted kt-src">${x.set != null ? `${T.set} · ${T.measured}: ${x.measured} <button type="button" class="kc-link" data-auto="${esc(tp)}">${T.auto}</button>` : (x.answers ? T.measured : '')}</div></td>
      <td class="num">${x.answers || '–'}</td>
      <td class="num">${x.correct_pct == null ? '–' : x.correct_pct + ' %'}</td>
      <td>${x.practise.length ? x.practise.map((w) => esc(w.replace(/_/g, ' '))).join(', ') : '–'}</td>
      <td><button type="button" class="kc-link" data-note="${esc(tp)}">${T.noteFor}</button></td></tr>`;
  }).join('');

  const hwTopic = topicIds.find((tp) => cat.ids.includes(tp)) || topicIds[0];
  main.innerHTML = `
    <p><a href="#t=${esc(token)}">${T.back}</a></p>
    <div class="kc-head"><div><h1>${esc(s.name)}${s.level ? ` <span class="kt-level">${esc(s.level)}</span>` : ''}</h1>
      <p class="kc-muted">${T.lastActive}: ${ago(s.last_active)} · ${s.answers} ${T.answers}</p></div></div>

    <section class="kc-card" id="kt-profile">
      <h2>${T.profileH}</h2>
      <div id="kt-prof-view"><p><strong>${T.goals}:</strong> ${esc(s.goals) || '–'}</p>
        <button type="button" class="kc-btn kc-btn-ghost" id="kt-edit">${T.edit}</button></div>
      <form id="kt-prof-form" hidden>
        <div class="kt-form-row">
          <label class="kc-field"><span>${T.firstName}</span><input id="kt-pname" maxlength="20" value="${esc(s.name)}" required></label>
          <label class="kc-field kt-narrow"><span>${T.level}</span><input id="kt-plevel" maxlength="20" value="${esc(s.level)}" placeholder="${T.levelPh}"></label>
        </div>
        <label class="kc-field kt-wide"><span>${T.goals}</span><input id="kt-pgoals" maxlength="600" value="${esc(s.goals)}" placeholder="${T.goalsPh}"></label>
        <p class="kc-row"><button class="kc-btn" type="submit">${T.save}</button><button class="kc-btn kc-btn-ghost" type="button" id="kt-pcancel">${T.cancel}</button></p>
      </form>
      <label class="kc-field kt-wide"><span>${T.notes}</span>
        <textarea id="kt-notes" rows="3" maxlength="4000" placeholder="${T.notesPh}">${esc(s.notes)}</textarea>
        <small id="kt-notes-ok" hidden>${T.saved}</small></label>
    </section>

    <section class="kc-card">
      <h2>${T.linkH}</h2>
      <p>${T.linkLead(esc(s.name))}</p>
      ${key ? `<p class="kc-row"><code class="kc-url">${esc(studentUrl(key))}</code><span id="kt-lc"></span></p>` : `<p class="kc-muted">${T.linkUnknown}</p>`}
      <p><button type="button" class="kc-btn kc-btn-ghost" id="kt-newlink">${T.newLink}</button></p>
    </section>

    <section class="kc-card">
      <h2>${T.mapH}</h2>
      <p class="kc-muted">${T.mapLead}</p>
      <div class="kc-table-wrap"><table class="kc-table kt-map"><thead><tr><th></th><th></th>
        <th class="num">${T.answers}</th><th class="num">${T.right}</th><th>${T.practise}</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </section>

    <section class="kc-card">
      <h2>${T.hwH}</h2>
      <p class="kc-muted">${T.hwLead}</p>
      ${d.homework.length ? `<ul class="kt-hw">${d.homework.map((h) => `<li>
          <span><strong>${esc(topicName(cat, h.topic))}</strong> · ${esc(targetName(cat, h.topic, h.target))}${h.difficulty ? ` · ${esc((T.levels.find((l) => l[0] === String(h.difficulty)) || ['', ''])[1])}` : ''}
          ${h.note ? `<br><span class="kc-muted">“${esc(h.note)}”</span>` : ''}</span>
          <span class="kc-muted">${new Date(h.created).toLocaleDateString(LANG)} · ${T.hwProgress(h.answers, h.correct_pct)}</span>
          <span class="kc-row"><a href="${esc(homeworkUrl(cat, h))}" target="_blank" rel="noopener">${T.meGo} ↗</a>
          <button type="button" class="kc-link" data-delhw="${h.id}">${T.del}</button></span></li>`).join('')}</ul>` : `<p class="kc-muted">${T.hwNone}</p>`}
      <form id="kt-hwform" class="kt-hwform">
        <label class="kc-field"><span>${T.hwTopic}</span><select id="kt-hwtopic">${cat.ids.map((tp) => `<option value="${esc(tp)}"${tp === hwTopic ? ' selected' : ''}>${esc(topicName(cat, tp))}</option>`).join('')}</select></label>
        <label class="kc-field"><span>${T.hwTarget}</span><select id="kt-hwtarget"></select></label>
        <label class="kc-field"><span>${T.hwDiff}</span><select id="kt-hwdiff">${T.levels.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="kc-field kt-wide"><span>${T.hwNote}</span><input id="kt-hwnote" maxlength="300" placeholder="${T.hwNotePh}"></label>
        <button class="kc-btn" type="submit">${T.hwAdd}</button>
      </form>
    </section>

    <section class="kc-card">
      <h2>${T.lessonsH}</h2>
      <form id="kt-lessonform" class="kt-lessonform">
        <label class="kc-field kt-narrow"><span>${T.lessonDay}</span><input type="date" id="kt-lday" value="${today()}" required></label>
        <label class="kc-field kt-wide"><span>${T.lessonNote}</span><textarea id="kt-lnote" rows="2" maxlength="2000" required></textarea></label>
        <button class="kc-btn" type="submit">${T.lessonAdd}</button>
      </form>
      ${d.lessons.length ? `<ul class="kt-lessons">${d.lessons.map((l) => `<li><span class="kt-lday">${esc(new Date(l.day + 'T12:00:00').toLocaleDateString(LANG, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
        <span class="kt-lnote">${esc(l.note)}</span><button type="button" class="kc-link" data-dellesson="${l.id}">${T.del}</button></li>`).join('')}</ul>` : `<p class="kc-muted">${T.lessonNone}</p>`}
    </section>

    ${d.sources.length ? `<section class="kc-card"><h2>${T.where}</h2><p>${d.sources.map(([k, n]) => `${esc(T.sources[k] || k)} <span class="kc-muted">${n}</span>`).join(' · ')}</p></section>` : ''}
    <p><button class="kc-btn kc-btn-danger" id="kt-remove">${T.remove}</button></p>`;

  if (key) $('#kt-lc').appendChild(copyButton(studentUrl(key)));

  // profile edit
  $('#kt-edit').addEventListener('click', () => { $('#kt-prof-view').hidden = true; $('#kt-prof-form').hidden = false; $('#kt-pname').focus(); });
  $('#kt-pcancel').addEventListener('click', () => { $('#kt-prof-view').hidden = false; $('#kt-prof-form').hidden = true; });
  $('#kt-prof-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await post('/api/tutor/student/update', { name: $('#kt-pname').value.trim(), level: $('#kt-plevel').value, goals: $('#kt-pgoals').value }); reload(); }
    catch (e) { alert(errorText(e.message)); }
  });
  const notes = $('#kt-notes');
  notes.addEventListener('change', async () => {
    try { await post('/api/tutor/student/update', { notes: notes.value }); const ok = $('#kt-notes-ok'); ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 1800); }
    catch (e) { alert(errorText(e.message)); }
  });

  // link
  $('#kt-newlink').addEventListener('click', async () => {
    if (key && !confirm(T.newLinkQ)) return;
    const r = await post('/api/tutor/student/new-link', {});
    setKey(token, sid, r.student_key);
    reload();
  });

  // stars
  main.querySelectorAll('.kt-star-btn').forEach((b) => b.addEventListener('click', async () => {
    const tp = b.dataset.topic;
    await post('/api/tutor/student/stars', { topic: tp, stars: Number(b.dataset.stars), note: (d.topics[tp] || {}).note || '' });
    reload();
  }));
  main.querySelectorAll('[data-auto]').forEach((b) => b.addEventListener('click', async () => {
    const tp = b.dataset.auto;
    await post('/api/tutor/student/stars', { topic: tp, stars: null, note: (d.topics[tp] || {}).note || '' });
    reload();
  }));
  main.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', async () => {
    const tp = b.dataset.note;
    const x = d.topics[tp] || {};
    const note = prompt(T.notePrompt, x.note || '');
    if (note === null) return;
    await post('/api/tutor/student/stars', { topic: tp, stars: x.set ?? null, note });
    reload();
  }));

  // homework
  const fillTargets = () => {
    $('#kt-hwtarget').innerHTML = targetsFor(cat, $('#kt-hwtopic').value).map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  };
  fillTargets();
  $('#kt-hwtopic').addEventListener('change', fillTargets);
  $('#kt-hwform').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const diff = $('#kt-hwdiff').value;
    if (!$('#kt-hwtarget').value) return;
    await post('/api/tutor/student/homework', { topic: $('#kt-hwtopic').value, target: $('#kt-hwtarget').value,
      difficulty: diff ? Number(diff) : null, note: $('#kt-hwnote').value });
    reload();
  });
  main.querySelectorAll('[data-delhw]').forEach((b) => b.addEventListener('click', async () => {
    await post('/api/tutor/student/homework-delete', { item_id: Number(b.dataset.delhw) }); reload();
  }));

  // lessons
  $('#kt-lessonform').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!$('#kt-lnote').value.trim()) return;
    await post('/api/tutor/student/lesson', { day: $('#kt-lday').value, note: $('#kt-lnote').value }); reload();
  });
  main.querySelectorAll('[data-dellesson]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(T.del + '?')) return;
    await post('/api/tutor/student/lesson-delete', { item_id: Number(b.dataset.dellesson) }); reload();
  }));

  $('#kt-remove').addEventListener('click', async () => {
    if (!confirm(T.removeQ(s.name))) return;
    await post('/api/tutor/student/remove', {});
    location.hash = `t=${token}`;
  });
}

/* ── the student's page ─────────────────────────────────────────────────── */
async function renderMe(main) {
  const m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{20,64})/);
  const key = m ? m[1] : (getSession() || {}).token;
  let d, cat;
  try {
    if (!key) throw new Error('unknown_student');
    [d, cat] = await Promise.all([api('/api/tutor/me', key, undefined, 'X-Student-Token'), catalogue()]);
  } catch (e) {
    main.innerHTML = `<h1>Krabsy</h1><p class="kc-card">${e.message === 'unknown_student' ? T.meBad : T.errNet}</p>
      <p><a class="kc-btn" href="${PATHS.games}">${T.meAll}</a></p>`;
    return;
  }
  adopt({ code: d.code, name: d.tutor_name, nickname: d.name, token: key });
  // Keep the key out of the address bar (screenshots, sharing); the session remembers it.
  if (m) { try { history.replaceState(null, '', location.pathname); } catch (_) {} }
  main.innerHTML = `
    <h1>${esc(T.meHi(d.name))}</h1>
    <section class="kc-card">
      <h2>${esc(T.meFrom(d.tutor_name))}</h2>
      ${d.homework.length ? `<ul class="kt-mehw">${d.homework.map((h) => `<li>
        <span><strong>${esc(targetName(cat, h.topic, h.target))}</strong> · ${esc(topicName(cat, h.topic))}
        ${h.note ? `<br><span class="kc-muted">${esc(h.note)}</span>` : ''}</span>
        <a class="kc-btn" href="${esc(homeworkUrl(cat, h))}">${T.meGo}</a></li>`).join('')}</ul>` : `<p>${T.meNone}</p>`}
    </section>
    <p class="kc-row"><a class="kc-btn kc-btn-ghost" href="${PATHS.games}">${T.meAll}</a></p>
    <p class="kc-muted">${T.meCounts}</p>`;
}

const main = document.querySelector('[data-tutor-page]');
if (main) {
  const page = main.dataset.tutorPage;
  if (page === 'start') renderStart(main);
  else if (page === 'space') { renderSpace(main); window.addEventListener('hashchange', () => renderSpace(main)); }
  else if (page === 'student') renderMe(main);
}
