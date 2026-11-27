/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — tutor pages (docs/tutor-platform.md phase 1, 2026-11-25)

   One module for three pages, chosen by <main data-tutor-page="…">:
     start    /en/spanish/tutors/                 what it is + create a space
     space    /en/spanish/tutors/space/           students; #s=<id> = one profile
     login    /en/spanish/tutors/login/#l=…       the sign-in link from the email
   Tutors sign in by email (api/tutor_auth.py): the session token is kept in
   localStorage["krabsy_tutor_session"] and sent as X-Tutor-Token. Spaces made
   earlier with a private link (#t=…) still open with it until an email is added.
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
import { apiBase, getSession } from '/lib/krabsy-class.js?v=2026-11-25b';
import { enter, people, activePerson, showPicker } from '/lib/krabsy-sync.js?v=2026-11-26';
import { tutorTopHtml, tutorHtml, tutorWire, meHtml, renderWorksheet } from '/lib/krabsy-tutor-lesson.js?v=2026-11-26b';
import { startLiveStudent } from '/lib/krabsy-live-student.js?v=2026-11-27c';
import { runningLessons, isRunning, markEnded, runningBar } from '/lib/krabsy-live-running.js?v=2026-11-27';

const LANG = 'en';
const PATHS = { start: '/en/spanish/tutors/', space: '/en/spanish/tutors/space/', me: '/en/spanish/me/', report: '/en/spanish/report/', profile: '/en/my-profile/',
  games: '/en/spanish/games/', home: '/en/spanish/' };

const T = {
  title: 'Krabsy for tutors',
  promise: 'Run your Spanish lessons on Krabsy',
  howH: 'How it works', welcome: (n) => (n ? `Welcome back, ${n}` : 'Welcome back'), openProfile: 'Open profile',
  spaceEyebrow: 'Your tutor space', studentsOf: (n) => (/students$/i.test(n) ? n : `${n}’s students`),
  noStars: 'No stars yet', noHw: 'No homework set', emptyH: 'Your first student',
  stats: { answers: 'answers', topics: 'topics started', hw: 'homework set', lessons: 'lesson notes' },
  repEyebrow: 'Progress report',
  lead: 'Every student gets a profile with a star map per topic. Their answers in the games fill it in by themselves, and you can always correct it. You give homework as a topic and a goal, they pick the game, and you keep a note for every lesson.',
  pilot: 'Pilot: free while we build it with tutors. Tell us what is missing.',
  how: [
    ['Add a student', 'First name only. Krabsy makes a personal link for them: no email, no password.'],
    ['They play', 'Every answer in the games and drills goes into their star map.'],
    ['You plan', 'See what sits and what doesn’t, give homework, write down what you did.'],
  ],
  createH: 'Create your tutor space', yourName: 'Your name (students see it)', yourNamePh: 'e.g. Nora',
  createBtn: 'Create my space', yourSpaces: 'Your spaces on this device',
  noSpaceYet: 'No tutor space yet?', createOne: 'Create one', haveSpace: 'Already have a space?',
  email: 'Your email', emailPh: 'you@example.com', signInH: 'Sign in', signInBtn: 'Send me a sign-in link',
  noPassword: 'No password: we email you a link that signs you in. It works once and for 20 minutes.',
  checkMail: (e) => `Check your email: we sent a link to <strong>${e}</strong>. Open it on this device or any other. Nothing there? Look in the spam folder.`,
  errEmail: 'That doesn’t look like an email address.', signedIn: 'Open my space', signedInAs: (e) => `Signed in as ${e}`,
  signOut: 'Sign out', loginWorking: 'Signing you in …', loginBad: 'This sign-in link has expired or was already used. Ask for a new one.',
  loginAgain: 'Sign in again', addEmailH: 'Add your email', addEmailLead: 'So you can sign in from any device and never lose your space. After you confirm it, this private link stops working and you sign in by email.',
  addEmailBtn: 'Confirm my email', emailTaken: 'This email already has a tutor space.',
  needSignIn: 'Please sign in to see your students.',
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
  privacy: 'Krabsy stores your email, only to send you sign-in links. For your students it stores the first name you type, the level and notes you write, the answers the student gives in games (word, right or wrong, when), and, so they can continue on another device, their figure, shells and game progress. No email, no surname, nothing about the device. Ask the parents before you send the link. A space that nobody uses for 6 months is deleted with everything in it, and you can delete it any time. Details in the <a href="/en/privacy/">privacy policy</a>.',
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
  hwH: 'Homework', hwLead: 'You give the content and a goal; the student picks any game or drill. Every answer in that topic since you gave it counts.',
  hwTopic: 'Topic', hwGoal: 'Goal', hwGoals: [20, 40, 60, 100], hwGoalUnit: 'answers', hwDiff: 'Difficulty', hwNote: 'Note for the student', hwNotePh: 'e.g. before Thursday',
  hwAdd: 'Give homework', hwNone: 'No homework yet.',
  hwProgress: (n, goal, p) => (goal ? `${Math.min(n, goal)} of ${goal} answers` : `${n} answers`) + (n ? ` · ${p} % right` : ''),
  hwDone: 'done ✓',
  adult: 'Adult learner', adultHint: 'Calmer student page: no shells, no gifts, quick practice first.', adultTag: 'adult',
  reportH: 'Report for parents', reportLead: 'A read-only link for the parents: star map, homework progress, number of lessons and your note below. Never your private notes.',
  reportNote: 'Note for the parents', reportNotePh: 'e.g. Lucas worked hard on ser vs estar this month …',
  reportMake: 'Make the parents’ link', reportNew: 'Make a new link', reportNewQ: 'Make a new parents’ link? The old one stops working.',
  reportUnknown: 'A parents’ link exists, but it was made on another device. Make a new one to see it here.',
  reportOpen: 'Open the report',
  levels: [['', 'Everything'], ['1', 'Easy'], ['2', 'Easy + medium']],
  lessonsH: 'Lesson notes', lessonDay: 'Date', lessonNote: 'What you did, what comes next',
  lessonAdd: 'Add note', lessonNone: 'No lesson notes yet.', del: 'Delete',
  where: 'Where they practised', remove: 'Remove student', removeQ: (n) => `Remove ${n}? Their notes and answers are deleted.`,
  meHi: (n) => `Hi ${n}!`, meFrom: (t) => `Homework from ${t}`, meNone: 'No homework right now. Play anything you like!',
  meAdultHi: (n) => `Your practice, ${n}`, meAdultFrom: (t) => `From ${t}`, meAdultNone: 'Nothing set right now. Quick practice is always here.',
  meGo: 'Play', meAll: 'All games', meBad: 'This link doesn’t work any more. Ask your tutor for a new one.',
  meCounts: 'Everything you answer on this device goes to your tutor, and your figure and shells are saved for your other devices.',
  meAdultCounts: 'Everything you answer on this device goes to your tutor.',
  meQuick: 'Quick practice', meQuickSub: 'fastest way to your goal', meGames: 'Games', meGamesSub: 'more fun, takes a bit longer',
  meProfile: 'My figure and shells →', meWho: 'Not you? Switch player', meDone: 'Goal reached! 🎉',
  repTitle: (n) => `${n}: progress report`, repFrom: (t) => `from ${t}`, repWeeks: 'Answers per week', repWeekNames: ['this week', 'last week', '2 weeks ago', '3 weeks ago'],
  repLessons: (n, d) => `${n} lesson${n === 1 ? '' : 's'} noted${d ? `, the last on ${d}` : ''}`, repMap: 'Star map', repHw: 'Homework', repBad: 'This report link doesn’t work any more. Ask the tutor for a new one.',
  repNote: 'Note from the tutor',
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
  return { bad_name: T.errName, too_many: T.errMany, space_full: T.errFull, bad_email: T.errEmail, email_taken: T.emailTaken }[code] || T.errNet;
}

/* ── local memory on the tutor's device ─────────────────────────────────── */
function read(key, dflt) { try { return JSON.parse(localStorage.getItem(key) || 'null') || dflt; } catch (_) { return dflt; } }
function write(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }
const spaces = () => read('krabsy_tutor_spaces', []);
function rememberSpace(s) { write('krabsy_tutor_spaces', [s, ...spaces().filter((x) => x.token !== s.token)].slice(0, 10)); }
function forgetSpace(token) { write('krabsy_tutor_spaces', spaces().filter((x) => x.token !== token)); }
// Student links shown again on this device: by student id (ids are unique across spaces);
// keys saved before sign-in existed used "<token prefix>:<id>".
const getKey = (token, sid) => { const k = read('krabsy_tutor_keys', {}); return k['id:' + sid] || (token ? k[`${token.slice(0, 10)}:${sid}`] : null) || null; };
function setKey(token, sid, key) { const k = read('krabsy_tutor_keys', {}); k['id:' + sid] = key; write('krabsy_tutor_keys', k); }
const SESSION = 'krabsy_tutor_session';
const session = () => read(SESSION, null);

const spaceUrl = (token) => `${location.origin}${PATHS.space}#t=${token}`;
const studentUrl = (key) => `${location.origin}${PATHS.me}#k=${key}`;
const reportUrl = (key) => `${location.origin}${PATHS.report}#r=${key}`;
const levelName = (d) => (T.levels.find((l) => l[0] === String(d)) || ['', ''])[1];
function progressBar(h) {
  const pct = h.goal ? Math.min(100, Math.round((h.answers / h.goal) * 100)) : (h.answers ? 100 : 0);
  return `<span class="kt-bar${h.goal && h.answers >= h.goal ? ' is-done' : ''}" role="img" aria-label="${pct} %"><span style="width:${pct}%"></span></span>`;
}

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
function linkFor(cat, topic, target, difficulty, glang) {
  return homeworkUrl(cat, { topic, target, difficulty, glang });
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

// Avatar: the first letter on one of five soft Krabsy tints (the same name always gets the same tint).
function avatarHtml(name, cls = '') {
  const n = String(name || '?').trim() || '?';
  let h = 0; for (const c of n) h = (h * 31 + c.codePointAt(0)) % 997;
  return `<span class="kt-av kt-tint-${h % 5}${cls ? ' ' + cls : ''}" aria-hidden="true">${esc([...n][0].toUpperCase())}</span>`;
}

/* ── start page ─────────────────────────────────────────────────────────── */
function renderStart(main) {
  const list = spaces();
  const ses = session();
  const HOW_ICONS = ['👋', '🎮', '🗓️'];
  main.innerHTML = `${ses ? runningBar(esc) : ''}
    <section class="kt-hero">
      <div class="kt-hero-text">
        <p class="kt-eyebrow">${T.title}</p>
        <h1>${T.promise}</h1>
        <p class="kc-lead">${T.lead}</p>
        <p class="kt-pilot">${T.pilot}</p>
      </div>
      <div class="kt-hero-side">
        ${ses ? `<section class="kc-card kt-welcome"><h2>${esc(T.welcome(ses.name))}</h2><p class="kc-row"><a class="kc-btn" href="${PATHS.space}">${T.signedIn}</a></p></section>` : ''}
        ${list.length ? `<section class="kc-card kt-spaces"><h2>${T.yourSpaces}</h2><ul class="kc-list">${list.map((s) =>
          `<li><a href="${PATHS.space}#t=${esc(s.token)}">${esc(s.name)}</a></li>`).join('')}</ul></section>` : ''}
        <form class="kc-card kt-signin" id="kt-signin">
          <h2 id="kt-auth-h">${T.signInH}</h2>
          <label class="kc-field" id="kt-name-row" hidden><span>${T.yourName}</span><input id="kt-name" maxlength="40" placeholder="${T.yourNamePh}" autocomplete="name"></label>
          <label class="kc-field"><span>${T.email}</span><input id="kt-semail" type="email" maxlength="254" placeholder="${T.emailPh}" autocomplete="email" required></label>
          <p class="kc-error" role="alert" hidden></p>
          <button class="kc-btn kt-block" type="submit" id="kt-auth-btn">${T.signInBtn}</button>
          <p class="kc-muted kt-nopw">${T.noPassword}</p>
          <p class="kc-muted kt-noaccount"><span id="kt-switch-q">${T.noSpaceYet}</span> <button type="button" class="kc-link" id="kt-switch">${T.createOne}</button></p>
        </form>
      </div>
      <div class="kt-demo" aria-hidden="true">
        <div class="kt-demo-card">
          <div class="kt-demo-top">${avatarHtml('Lucas')}<b>Lucas</b><span class="kt-level">A1</span><span class="kt-demo-live">Live lesson</span></div>
          <div class="kt-demo-row"><span>Yo soy … (ser)</span>${starsHtml(4)}</div>
          <div class="kt-demo-row"><span>Estoy … (estar)</span>${starsHtml(2)}</div>
          <div class="kt-demo-row"><span>Tengo … (tener)</span>${starsHtml(3)}</div>
          <div class="kt-demo-hw"><span class="kt-bar"><span style="width:65%"></span></span><span>Homework · 26 of 40 answers</span></div>
        </div>
        <span class="kt-demo-chip kt-demo-c1">⭐ new star</span>
        <span class="kt-demo-chip kt-demo-c2">🎮 plays at home</span>
        <img class="kt-demo-crab" src="/favicon.png?v=2026-11-27" alt="" decoding="async">
      </div>
    </section>
    <h2 class="kt-h2">${T.howH}</h2>
    <ol class="kt-how">${T.how.map(([h, p], i) => `<li><span class="kt-how-ico" aria-hidden="true">${HOW_ICONS[i] || ''}</span><strong>${h}</strong><span>${p}</span></li>`).join('')}</ol>
    <div class="kt-two">
      <section class="kc-card kt-sec kt-sec-scale"><h2>${T.scaleH}</h2>${scaleTable()}</section>
      <section class="kc-card kt-sec kt-sec-privacy"><h2>${T.privacyH}</h2><p>${T.privacy}</p></section>
    </div>`;
  const wire = (form, body) => form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button'); const err = form.querySelector('.kc-error');
    btn.disabled = true; err.hidden = true;
    try {
      const b = body();
      await api('/api/tutor/login', '', Object.assign({ lang: LANG }, b));
      form.innerHTML = `<p class="kt-sent">${T.checkMail(esc(b.email.trim()))}</p>`;
      form.classList.add('kc-done');
    } catch (e) {
      err.textContent = errorText(e.message); err.hidden = false; btn.disabled = false;
    }
  });
  let creating = false;
  const mode = (c) => {
    creating = c;
    $('#kt-name-row').hidden = !c; $('#kt-name').required = c;
    $('#kt-auth-h').textContent = c ? T.createH : T.signInH;
    $('#kt-auth-btn').textContent = c ? T.createBtn : T.signInBtn;
    $('#kt-switch-q').textContent = c ? T.haveSpace : T.noSpaceYet;
    $('#kt-switch').textContent = c ? T.signInH : T.createOne;
    (c ? $('#kt-name') : $('#kt-semail')).focus();
  };
  $('#kt-switch').addEventListener('click', () => mode(!creating));
  if (new URLSearchParams(location.search).get('create') === '1') mode(true);
  wire($('#kt-signin'), () => (creating ? { name: $('#kt-name').value, email: $('#kt-semail').value } : { email: $('#kt-semail').value }));
}

/* ── the link from the email ───────────────────────────────────────────── */
async function renderLogin(main) {
  const m = location.hash.match(/[#&]l=([A-Za-z0-9_-]{20,80})/);
  main.innerHTML = `<div class="kt-center"><img class="kt-center-crab" src="/favicon.png?v=2026-11-27" alt="" decoding="async"><h1>${T.title}</h1><p class="kc-card kt-working">${T.loginWorking}</p></div>`;
  try { history.replaceState(null, '', location.pathname); } catch (_) {}
  try {
    if (!m) throw new Error('link_expired');
    const d = await api('/api/tutor/verify', '', { token: m[1] });
    write(SESSION, { token: d.session_token, name: d.name, id: d.space_id });
    location.replace(PATHS.space);
  } catch (e) {
    main.innerHTML = `<div class="kt-center"><img class="kt-center-crab" src="/favicon.png?v=2026-11-27" alt="" decoding="async"><h1>${T.title}</h1><p class="kc-card">${e.message === 'link_expired' ? T.loginBad : T.errNet}</p>
      <p><a class="kc-btn" href="${PATHS.start}">${T.loginAgain}</a></p></div>`;
  }
}

function scaleTable() {
  return `<table class="kc-table kt-scale"><tbody>${T.scale.map(([s, m, w], i) =>
    `<tr><td>${starsHtml(i + 1)}</td><td><strong>${m}</strong></td><td class="kc-muted">${w}</td></tr>`).join('')}</tbody></table>`;
}

/* ── space page ─────────────────────────────────────────────────────────── */
let LEGACY = false;          // opened with an old private link (#t=…)
function hashParams() {
  const h = new URLSearchParams(location.hash.slice(1));
  const t = h.get('t');
  LEGACY = !!(t && /^[A-Za-z0-9_-]{20,64}$/.test(t));
  const ses = session();
  return { token: LEGACY ? t : (ses && ses.token) || null, sid: parseInt(h.get('s') || '', 10) || null };
}
// Links inside the space keep the private token only for old spaces.
const hrefTo = (token, sid) => (LEGACY ? `#t=${esc(token)}${sid ? `&s=${sid}` : ''}` : (sid ? `#s=${sid}` : '#'));
// The live classroom (docs/live-classroom.md): its own page; it replaces the v1 "Show live" (polling).
const liveHref = (token, sid, extra = '') => `/en/spanish/tutors/live/#${LEGACY ? `t=${esc(token)}&` : ''}s=${sid}&start=1${extra}`;
function liveCss() {
  if (document.querySelector('link[data-live-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/lib/krabsy-live.css?v=2026-11-27'; l.dataset.liveCss = '1'; document.head.appendChild(l);
}
function liveEntries(main, token, sid) {
  main.querySelectorAll('[data-wslive]').forEach((b) => { const a = document.createElement('a'); a.className = b.className; a.textContent = b.textContent; a.href = liveHref(token, sid, `&w=${Number(b.dataset.wslive)}`); b.replaceWith(a); });
  main.querySelectorAll('[data-blive]').forEach((b) => { const sel = b.closest('li') && b.closest('li').querySelector('select[data-topic]'); const a = document.createElement('a'); a.className = b.className; a.textContent = 'Live lesson ↗'; a.href = liveHref(token, sid, sel ? `&qp=${encodeURIComponent(sel.value)}` : ''); b.replaceWith(a); });
}

async function renderSpace(main) {
  const { token, sid } = hashParams();
  if (sid) return renderStudent(main, token, sid);
  let d, cat;
  try {
    if (!token) throw new Error('unknown_space');
    [d, cat] = await Promise.all([api('/api/tutor/space', token), catalogue()]);
  } catch (e) {
    if (e.message === 'unknown_space' && token) { if (LEGACY) forgetSpace(token); else write(SESSION, null); }
    main.innerHTML = `<div class="kt-center"><img class="kt-center-crab" src="/favicon.png?v=2026-11-27" alt="" decoding="async"><h1>${T.students}</h1><p class="kc-card">${!token ? T.needSignIn : (e.message === 'unknown_space' ? T.noSpace : T.errNet)}</p>
      <p><a class="kc-btn" href="${PATHS.start}">${T.signInH}</a></p></div>`;
    return;
  }
  if (LEGACY) rememberSpace({ name: d.space.name, token });
  liveCss();
  const cards = d.students.map((s) => {
    const tps = Object.entries(s.stars).filter(([, n]) => n > 0)
      .sort((a, b) => cat.ids.indexOf(a[0]) - cat.ids.indexOf(b[0]));
    return `<div class="kt-scard-wrap"><a class="kt-scard" href="${hrefTo(token, s.id)}">
      <span class="kt-scard-top">${avatarHtml(s.name, 'is-lg')}<span class="kt-scard-id">
        <span class="kt-scard-name">${esc(s.name)}${s.level ? ` <span class="kt-level">${esc(s.level)}</span>` : ''}${s.adult ? ` <span class="kt-level is-adult">${T.adultTag}</span>` : ''}</span>
        <span class="kc-muted kt-scard-meta">${T.lastActive}: ${ago(s.last_active)} · ${s.answers_week} ${T.thisWeek}</span></span></span>
      ${s.homework ? `<span class="kt-hwprog kt-cardhw">${progressBar(s.homework)}<span class="kc-muted">${esc(topicName(cat, s.homework.topic))} · ${T.hwProgress(s.homework.answers, s.homework.goal, s.homework.correct_pct)}</span></span>`
        : `<span class="kc-muted kt-cardhw kt-cardhw-none">${T.noHw}</span>`}
      ${tps.length ? `<span class="kt-mini">${tps.slice(0, 4).map(([tp, n]) => `<span><span class="kt-mini-t">${esc(topicName(cat, tp))}</span>${starsHtml(n)}</span>`).join('')}</span>`
        : `<span class="kt-mini kt-mini-none"><span><span class="kt-mini-t kc-muted">${T.noStars}</span>${starsHtml(0)}</span></span>`}
    </a><div class="kt-scard-foot"><a class="kt-scard-open" href="${hrefTo(token, s.id)}" tabindex="-1" aria-hidden="true">${T.openProfile} →</a><a class="kt-livebtn${isRunning(s.id) ? ' is-running' : ''}" href="${liveHref(token, s.id)}">${isRunning(s.id) ? 'Back to live lesson' : 'Start live lesson'}</a></div></div>`;
  }).join('');
  main.innerHTML = `${runningBar(esc)}
    <div class="kt-pagehead">${avatarHtml(d.space.name, 'is-xl is-tutor')}
      <div class="kt-pagehead-id"><p class="kt-eyebrow">${T.spaceEyebrow}</p>
        <h1>${esc(T.studentsOf(d.space.name))}${d.students.length ? ` <span class="kt-count">${d.students.length}</span>` : ''}</h1>
        <p class="kc-muted kt-pagehead-meta">${d.space.email ? `${esc(T.signedInAs(d.space.email))} · ` : ''}<button class="kc-link" id="kt-rename">${T.rename}</button>${LEGACY ? '' : ` · <button class="kc-link" id="kt-signout">${T.signOut}</button>`}</p></div>
      <p class="kc-row kt-pagehead-act"><button class="kc-btn" id="kt-addopen" aria-expanded="false">+ ${T.addH}</button></p></div>
    ${d.space.email ? '' : `<form class="kc-card kt-addemail" id="kt-addemail"><h2>${T.addEmailH}</h2><p>${T.addEmailLead}</p>
      <label class="kc-field"><span>${T.email}</span><input id="kt-aemail" type="email" maxlength="254" placeholder="${T.emailPh}" autocomplete="email" required></label>
      <p class="kc-error" role="alert" hidden></p><button class="kc-btn" type="submit">${T.addEmailBtn}</button></form>`}
    ${d.students.length ? '' : `<div class="kt-empty"><span class="kt-empty-ico" aria-hidden="true">🦀</span><p>${T.noStudents}</p></div>`}
    <form class="kc-card kt-sec kt-addform" id="kt-add"${d.students.length ? ' hidden' : ''}>
      <h2>${d.students.length ? T.addH : T.emptyH}</h2>
      <div class="kt-form-row">
        <label class="kc-field"><span>${T.firstName}</span><input id="kt-sname" maxlength="20" autocomplete="off" required></label>
        <label class="kc-field kt-narrow"><span>${T.level}</span><input id="kt-slevel" maxlength="20" placeholder="${T.levelPh}"></label>
      </div>
      <label class="kc-field kt-wide"><span>${T.goals}</span><input id="kt-sgoals" maxlength="600" placeholder="${T.goalsPh}"></label>
      <label class="kt-check"><input type="checkbox" id="kt-sadult"> <span><strong>${T.adult}</strong> <span class="kc-muted">${T.adultHint}</span></span></label>
      <p class="kc-muted">${T.consent}</p>
      <p class="kc-error" id="kt-err" role="alert" hidden></p>
      <p class="kc-row"><button class="kc-btn" type="submit">${T.addBtn}</button>${d.students.length ? `<button class="kc-btn kc-btn-ghost" type="button" id="kt-addcancel">${T.cancel}</button>` : ''}</p>
    </form>
    ${cards ? `<section class="kt-grid">${cards}</section>` : ''}
    <details class="kc-card kt-more"><summary>${T.scaleH}</summary>${scaleTable()}</details>
    <p class="kc-muted kt-foot">${T.retention(d.space.delete_after_days)} <button class="kc-link" id="kt-delspace">${T.delSpace}</button></p>`;
  $('#kt-addopen').addEventListener('click', () => {
    const f = $('#kt-add'); f.hidden = false; $('#kt-addopen').setAttribute('aria-expanded', 'true');
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); $('#kt-sname').focus();
  });
  $('#kt-addcancel')?.addEventListener('click', () => { $('#kt-add').hidden = true; $('#kt-addopen').setAttribute('aria-expanded', 'false'); });
  $('#kt-signout')?.addEventListener('click', async () => {
    try { await api('/api/tutor/logout', token, {}); } catch (_) {}
    write(SESSION, null); location.href = PATHS.start;
  });
  $('#kt-addemail')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = $('#kt-addemail'); const err = f.querySelector('.kc-error'); const em = $('#kt-aemail').value;
    try { await api('/api/tutor/email', token, { email: em }); f.innerHTML = `<p class="kt-sent">${T.checkMail(esc(em.trim()))}</p>`; f.classList.add('kc-done'); }
    catch (e) { err.textContent = errorText(e.message); err.hidden = false; }
  });
  $('#kt-rename').addEventListener('click', async () => {
    const name = prompt(T.renamePrompt, d.space.name);
    if (name && name.trim()) { await api('/api/tutor/rename', token, { name }); renderSpace(main); }
  });
  $('#kt-add').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#kt-add button'); btn.disabled = true;
    try {
      const r = await api('/api/tutor/student/add', token, { name: $('#kt-sname').value.trim(), level: $('#kt-slevel').value, goals: $('#kt-sgoals').value, adult: $('#kt-sadult').checked });
      setKey(token, r.id, r.student_key);
      location.hash = hrefTo(token, r.id).slice(1);
    } catch (e) {
      const el = $('#kt-err'); el.textContent = errorText(e.message); el.hidden = false; btn.disabled = false;
    }
  });
  $('#kt-delspace').addEventListener('click', async () => {
    const running = runningLessons();
    if (!confirm(T.delSpaceQ + (running.length ? `\n\nThe live lesson${running.length > 1 ? 's' : ''} running now (${running.map((r) => r.name).join(', ')}) will end.` : ''))) return;
    running.forEach((r) => markEnded(r.sid));
    await api('/api/tutor/delete', token, {});
    forgetSpace(token); write(SESSION, null);
    main.innerHTML = `<div class="kt-center"><h1>${T.students}</h1><p class="kc-card">${T.deleted}</p></div>`;
  });
}

/* ── one student ────────────────────────────────────────────────────────── */
async function renderStudent(main, token, sid) {
  let d, cat;
  try {
    [d, cat] = await Promise.all([api(`/api/tutor/student?id=${sid}`, token), catalogue()]);
  } catch (e) {
    main.innerHTML = `<p class="kt-back"><a href="${hrefTo(token, null)}">${T.back}</a></p><p class="kc-card">${e.message === 'unknown_student' ? T.noSpace : T.errNet}</p>`;
    return;
  }
  const s = d.student;
  const key = getKey(token, sid);
  const rkey = getKey(token, 'r' + sid);
  const reload = () => renderStudent(main, token, sid);
  const post = (path, body) => api(path, token, Object.assign({ id: sid }, body));

  // topics: every topic of this section, plus any other the student answered in
  const topicIds = [...cat.ids, ...Object.keys(d.topics).filter((t) => !cat.ids.includes(t))];
  const empty = { measured: 0, set: null, stars: 0, answers: 0, correct_pct: null, practise: [], note: '' };
  const rows = topicIds.map((tp) => {
    const x = d.topics[tp] || empty;
    const stars = [1, 2, 3, 4, 5].map((i) => `<button type="button" class="kt-star-btn${i <= x.stars ? ' is-on' : ''}" data-topic="${esc(tp)}" data-stars="${i}" title="${esc(T.scale[i - 1][1])}" aria-label="${i}: ${esc(T.scale[i - 1][1])}">★</button>`).join('');
    return `<tr>
      <td class="kt-map-topic"><strong>${esc(topicName(cat, tp))}</strong>${x.note ? `<div class="kt-note">${esc(x.note)}</div>` : ''}</td>
      <td class="kt-starcell"><span class="kt-star-set">${stars}</span>
        <div class="kc-muted kt-src">${x.set != null ? `${T.set} · ${T.measured}: ${x.measured} <button type="button" class="kc-link" data-auto="${esc(tp)}">${T.auto}</button>` : (x.answers ? T.measured : '')}</div></td>
      <td class="num" data-l="${T.answers}">${x.answers || '–'}</td>
      <td class="num" data-l="${T.right}">${x.correct_pct == null ? '–' : x.correct_pct + ' %'}</td>
      <td class="kt-map-pr" data-l="${T.practise}">${x.practise.length ? x.practise.map((w) => esc(w.replace(/_/g, ' '))).join(', ') : '–'}</td>
      <td class="kt-map-note"><button type="button" class="kc-link" data-note="${esc(tp)}">${T.noteFor}</button></td></tr>`;
  }).join('');

  const hwTopic = topicIds.find((tp) => cat.ids.includes(tp)) || topicIds[0];
  const lctx = { d: Object.assign({}, d, { topics: d.topics, plan: d.plan }), cat, sid, name: s.name, topicName, linkFor,
    api: (path) => api(path, token), post, reload };
  const liveNow = isRunning(sid);
  main.innerHTML = `${runningBar(esc, sid)}
    <p class="kt-back"><a href="${hrefTo(token, null)}">${T.back}</a></p>
    <div class="kc-card kt-phead">${avatarHtml(s.name, 'is-xl')}
      <div class="kt-phead-id"><h1>${esc(s.name)}${s.level ? ` <span class="kt-level">${esc(s.level)}</span>` : ''}${s.adult ? ` <span class="kt-level is-adult">${T.adultTag}</span>` : ''}</h1>
        <p class="kc-muted">${T.lastActive}: ${ago(s.last_active)} · ${s.answers} ${T.answers}</p>
        ${s.goals ? `<p class="kt-phead-goal"><span aria-hidden="true">🎯</span> ${esc(s.goals)}</p>` : ''}</div>
      <p class="kc-row kt-phead-act"><a class="kt-livebtn is-big${liveNow ? ' is-running' : ''}" href="${liveHref(token, sid)}">${liveNow ? 'Back to live lesson' : 'Start live lesson'}</a></p>
      <ul class="kt-pstats">
        <li><b>${s.answers}</b><span>${T.stats.answers}</span></li>
        <li><b>${topicIds.filter((tp) => (d.topics[tp] || empty).stars > 0).length}<small> / ${topicIds.length}</small></b><span>${T.stats.topics}</span></li>
        <li><b>${d.homework.length}</b><span>${T.stats.hw}</span></li>
        <li><b>${d.lessons.length}</b><span>${T.stats.lessons}</span></li>
      </ul></div>

    <div class="kt-cols"><div class="kt-col-main">

${tutorTopHtml(lctx)}

    <section class="kc-card kt-sec kt-sec-map">
      <h2>${T.mapH}</h2>
      <p class="kc-muted">${T.mapLead}</p>
      <div class="kc-table-wrap"><table class="kc-table kt-map"><thead><tr><th></th><th></th>
        <th class="num">${T.answers}</th><th class="num">${T.right}</th><th>${T.practise}</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
    </section>

${tutorHtml(lctx)}

    <section class="kc-card kt-sec kt-sec-hw">
      <h2>${T.hwH}</h2>
      <p class="kc-muted">${T.hwLead}</p>
      ${d.homework.length ? `<ul class="kt-hw">${d.homework.map((h) => `<li>
          <span><strong>${esc(topicName(cat, h.topic))}</strong>${h.target ? ` · ${esc(targetName(cat, h.topic, h.target))}` : ''}${h.difficulty ? ` · ${esc(levelName(h.difficulty))}` : ''}
          ${h.note ? `<br><span class="kc-muted">“${esc(h.note)}”</span>` : ''}</span>
          <span class="kt-hwprog">${progressBar(h)}<span class="kc-muted">${new Date(h.created).toLocaleDateString(LANG)} · ${T.hwProgress(h.answers, h.goal, h.correct_pct)}</span></span>
          <button type="button" class="kc-link" data-delhw="${h.id}">${T.del}</button></li>`).join('')}</ul>` : `<p class="kc-muted">${T.hwNone}</p>`}
      <form id="kt-hwform" class="kt-hwform">
        <label class="kc-field"><span>${T.hwTopic}</span><select id="kt-hwtopic">${cat.ids.map((tp) => `<option value="${esc(tp)}"${tp === hwTopic ? ' selected' : ''}>${esc(topicName(cat, tp))}</option>`).join('')}</select></label>
        <label class="kc-field"><span>${T.hwGoal}</span><select id="kt-hwgoal">${T.hwGoals.map((n) => `<option value="${n}"${n === 40 ? ' selected' : ''}>${n} ${T.hwGoalUnit}</option>`).join('')}</select></label>
        <label class="kc-field"><span>${T.hwDiff}</span><select id="kt-hwdiff">${T.levels.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
        <label class="kc-field kt-wide"><span>${T.hwNote}</span><input id="kt-hwnote" maxlength="300" placeholder="${T.hwNotePh}"></label>
        <button class="kc-btn" type="submit">${T.hwAdd}</button>
      </form>
    </section>

    <section class="kc-card kt-sec kt-sec-lessons">
      <h2>${T.lessonsH}</h2>
      <form id="kt-lessonform" class="kt-lessonform">
        <label class="kc-field kt-narrow"><span>${T.lessonDay}</span><input type="date" id="kt-lday" value="${today()}" required></label>
        <label class="kc-field kt-wide"><span>${T.lessonNote}</span><textarea id="kt-lnote" rows="2" maxlength="2000" required></textarea></label>
        <button class="kc-btn" type="submit">${T.lessonAdd}</button>
      </form>
      ${d.lessons.length ? `<ul class="kt-lessons">${d.lessons.map((l) => `<li><span class="kt-lday">${esc(new Date(l.day + 'T12:00:00').toLocaleDateString(LANG, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
        <span class="kt-lnote">${esc(l.note)}</span><button type="button" class="kc-link" data-dellesson="${l.id}">${T.del}</button></li>`).join('')}</ul>` : `<p class="kc-muted">${T.lessonNone}</p>`}
    </section>

    </div><aside class="kt-col-side">

    <section class="kc-card kt-sec kt-sec-profile" id="kt-profile">
      <h2>${T.profileH}</h2>
      <div id="kt-prof-view"><p><strong>${T.goals}:</strong> ${esc(s.goals) || '–'}${s.adult ? ` · <span class="kt-level is-adult">${T.adultTag}</span>` : ''}</p>
        <button type="button" class="kc-btn kc-btn-ghost kt-sm" id="kt-edit">${T.edit}</button></div>
      <form id="kt-prof-form" hidden>
        <div class="kt-form-row">
          <label class="kc-field"><span>${T.firstName}</span><input id="kt-pname" maxlength="20" value="${esc(s.name)}" required></label>
          <label class="kc-field kt-narrow"><span>${T.level}</span><input id="kt-plevel" maxlength="20" value="${esc(s.level)}" placeholder="${T.levelPh}"></label>
        </div>
        <label class="kc-field kt-wide"><span>${T.goals}</span><input id="kt-pgoals" maxlength="600" value="${esc(s.goals)}" placeholder="${T.goalsPh}"></label>
        <label class="kt-check"><input type="checkbox" id="kt-padult"${s.adult ? ' checked' : ''}> <span><strong>${T.adult}</strong> <span class="kc-muted">${T.adultHint}</span></span></label>
        <p class="kc-row"><button class="kc-btn" type="submit">${T.save}</button><button class="kc-btn kc-btn-ghost" type="button" id="kt-pcancel">${T.cancel}</button></p>
      </form>
      <label class="kc-field kt-wide"><span>${T.notes}</span>
        <textarea id="kt-notes" rows="3" maxlength="4000" placeholder="${T.notesPh}">${esc(s.notes)}</textarea>
        <small id="kt-notes-ok" hidden>${T.saved}</small></label>
    </section>

    <section class="kc-card kt-sec kt-sec-link">
      <h2>${T.linkH}</h2>
      <p class="kc-muted">${T.linkLead(esc(s.name))}</p>
      ${key ? `<p class="kc-row"><code class="kc-url">${esc(studentUrl(key))}</code><span id="kt-lc"></span></p>` : `<p class="kc-muted">${T.linkUnknown}</p>`}
      <p><button type="button" class="kc-btn kc-btn-ghost kt-sm" id="kt-newlink">${T.newLink}</button></p>
    </section>

    <section class="kc-card kt-sec kt-sec-report">
      <h2>${T.reportH}</h2>
      <p class="kc-muted">${T.reportLead}</p>
      <label class="kc-field kt-wide"><span>${T.reportNote}</span>
        <textarea id="kt-rnote" rows="3" maxlength="1000" placeholder="${T.reportNotePh}">${esc(s.report_note)}</textarea>
        <small id="kt-rnote-ok" hidden>${T.saved}</small></label>
      ${rkey ? `<p class="kc-row"><code class="kc-url">${esc(reportUrl(rkey))}</code><span id="kt-rc"></span><a href="${esc(reportUrl(rkey))}" target="_blank" rel="noopener">${T.reportOpen} ↗</a></p>`
        : (s.has_report ? `<p class="kc-muted">${T.reportUnknown}</p>` : '')}
      <p><button type="button" class="kc-btn kc-btn-ghost kt-sm" id="kt-rlink">${rkey || s.has_report ? T.reportNew : T.reportMake}</button></p>
    </section>

    ${d.sources.length ? `<section class="kc-card kt-sec kt-sec-where"><h2>${T.where}</h2><p class="kt-srcs">${d.sources.map(([k, n]) => `<span class="kt-srcchip">${esc(T.sources[k] || k)} <b>${n}</b></span>`).join(' ')}</p></section>` : ''}
    <p class="kt-danger"><button class="kc-btn kc-btn-danger kt-sm" id="kt-remove">${T.remove}</button></p>
    </aside></div>`;

  if (key) $('#kt-lc').appendChild(copyButton(studentUrl(key)));
  tutorWire(main, lctx);
  liveCss(); liveEntries(main, token, sid);
  if (rkey) $('#kt-rc').appendChild(copyButton(reportUrl(rkey)));
  const rnote = $('#kt-rnote');
  rnote.addEventListener('change', async () => {
    try { await post('/api/tutor/student/update', { report_note: rnote.value }); const ok = $('#kt-rnote-ok'); ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 1800); }
    catch (e) { alert(errorText(e.message)); }
  });
  $('#kt-rlink').addEventListener('click', async () => {
    if ((rkey || s.has_report) && !confirm(T.reportNewQ)) return;
    const r = await post('/api/tutor/student/report-link', {});
    setKey(token, 'r' + sid, r.report_key);
    reload();
  });

  // profile edit
  $('#kt-edit').addEventListener('click', () => { $('#kt-prof-view').hidden = true; $('#kt-prof-form').hidden = false; $('#kt-pname').focus(); });
  $('#kt-pcancel').addEventListener('click', () => { $('#kt-prof-view').hidden = false; $('#kt-prof-form').hidden = true; });
  $('#kt-prof-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await post('/api/tutor/student/update', { name: $('#kt-pname').value.trim(), level: $('#kt-plevel').value, goals: $('#kt-pgoals').value, adult: $('#kt-padult').checked }); reload(); }
    catch (e) { alert(errorText(e.message)); }
  });
  const notes = $('#kt-notes');
  notes.addEventListener('change', async () => {
    try { await post('/api/tutor/student/update', { notes: notes.value }); const ok = $('#kt-notes-ok'); ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 1800); }
    catch (e) { alert(errorText(e.message)); }
  });

  // link
  $('#kt-newlink').addEventListener('click', async () => {
    if ((key || liveNow) && !confirm(T.newLinkQ + (liveNow ? `\n\n${s.name}'s live lesson running now ends for ${s.name} until they open the new link.` : ''))) return;
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
  $('#kt-hwform').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const diff = $('#kt-hwdiff').value;
    await post('/api/tutor/student/homework', { topic: $('#kt-hwtopic').value, goal: Number($('#kt-hwgoal').value),
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
    if (!confirm(T.removeQ(s.name) + (liveNow ? `\n\nThe live lesson with ${s.name} running now will end.` : ''))) return;
    markEnded(sid);
    await post('/api/tutor/student/remove', {});
    location.hash = hrefTo(token, null).slice(1);
  });
}

/* ── the student's page ─────────────────────────────────────────────────── */
async function renderMe(main) {
  const m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{20,64})/);
  const ap = activePerson();
  const key = m ? m[1] : ((ap && ap.token) || (getSession() || {}).token);
  let d, cat;
  try {
    if (!key) throw new Error('unknown_student');
    [d, cat] = await Promise.all([api('/api/tutor/me', key, undefined, 'X-Student-Token'), catalogue()]);
  } catch (e) {
    main.innerHTML = `<h1>Krabsy</h1><p class="kc-card">${e.message === 'unknown_student' ? T.meBad : T.errNet}</p>
      <p><a class="kc-btn" href="${PATHS.games}">${T.meAll}</a></p>`;
    return;
  }
  // This device now plays as this student (another person on the device is parked,
  // see krabsy-sync.js), and their saved figure/shells come back from the server.
  await enter({ code: d.code, name: d.tutor_name, nickname: d.name, token: key }, { adult: d.adult });
  // Keep the key out of the address bar (screenshots, sharing); the device remembers it.
  if (m) { try { history.replaceState(null, '', location.pathname); } catch (_) {} }
  const adult = !!d.adult;
  const others = people().list.length > 1;
  let wsList = [];
  try { wsList = (await api('/api/tutor/me/worksheets', key, undefined, 'X-Student-Token')).worksheets; } catch (_) {}
  ME = { key, tutor: d.tutor_name, adult };
  const wm = location.hash.match(/[#&]w=(\d+)/);
  if (wm) { await showWorksheet(main, Number(wm[1])); startMeLive(main); return; }
  const card = (h) => {
    const quick = targetsFor(cat, h.topic).filter((x) => x.id.startsWith('drill:'));
    const games = targetsFor(cat, h.topic).filter((x) => !x.id.startsWith('drill:'));
    const done = h.goal && h.answers >= h.goal;
    const tile = (x) => `<a class="kt-tile" href="${esc(linkFor(cat, h.topic, x.id, h.difficulty, h.glang))}">
      ${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy" decoding="async">` : '<span class="kt-tile-ico" aria-hidden="true">⚡</span>'}<span>${esc(x.name)}</span></a>`;
    const groups = [[T.meQuick, T.meQuickSub, quick], [T.meGames, T.meGamesSub, games]];
    if (!adult) groups.reverse();          // children: games first; adults: quick practice first
    return `<section class="kc-card kt-mecard">
      <h2>${esc(topicName(cat, h.topic))}</h2>
      ${h.note ? `<p class="kc-muted">${esc(h.note)}</p>` : ''}
      <div class="kt-hwprog">${progressBar(h)}<span>${done ? T.meDone : T.hwProgress(h.answers, h.goal, h.correct_pct)}</span></div>
      ${groups.filter((g) => g[2].length).map(([title, sub, list]) => `<h3 class="kt-group">${title} <span class="kc-muted">· ${sub}</span></h3>
        <div class="kt-tiles">${list.map(tile).join('')}</div>`).join('')}
    </section>`;
  };
  main.innerHTML = `
    <h1>${esc(adult ? T.meAdultHi(d.name) : T.meHi(d.name))}</h1>
    <p class="kc-muted">${esc(adult ? T.meAdultFrom(d.tutor_name) : T.meFrom(d.tutor_name))}</p>
    ${meHtml(wsList, d.tutor_name, topicName, cat)}
    ${d.homework.length ? d.homework.map(card).join('') : `<p class="kc-card">${adult ? T.meAdultNone : T.meNone}</p>`}
    <p class="kc-row"><a class="kc-btn kc-btn-ghost" href="${PATHS.games}">${T.meAll}</a>
      ${adult ? '' : `<a class="kc-btn kc-btn-ghost" href="${PATHS.profile}">${T.meProfile}</a>`}</p>
    <p class="kc-muted">${adult ? T.meAdultCounts : T.meCounts}</p>
    ${others ? `<p><button type="button" class="kc-link" id="kt-who">${T.meWho}</button></p>` : ''}`;
  if (others) $('#kt-who').addEventListener('click', () => showPicker({ onDone: () => { location.href = PATHS.me; location.reload(); } }));
  startMeLive(main);
}

/* the student's page: one worksheet, and the tutor's live state */
let ME = null, ME_TIMER = null;
async function showWorksheet(main, wid) {
  try {
    await renderWorksheet(main, { key: ME.key, wid, api, tutor: ME.tutor,
      onBack: () => { try { history.replaceState(null, '', location.pathname); } catch (_) {} renderMe(main); } });
  } catch (_) { try { history.replaceState(null, '', location.pathname); } catch (_) {} renderMe(main); }
}
function startMeLive() {
  // the live classroom (krabsy-live-student.js) replaces the v1 polling (meLive)
  if (ME_TIMER && ME_TIMER.key === ME.key) return;
  if (ME_TIMER) ME_TIMER.live.close();
  ME_TIMER = { key: ME.key, live: startLiveStudent({ key: ME.key, tutor: ME.tutor, adult: ME.adult }) };
}

/* ── the parents' report ───────────────────────────────────────────────── */
async function renderReport(main) {
  const m = location.hash.match(/[#&]r=([A-Za-z0-9_-]{20,64})/);
  let d, cat;
  try {
    if (!m) throw new Error('unknown_report');
    [d, cat] = await Promise.all([api('/api/report', m[1], undefined, 'X-Report-Key'), catalogue()]);
  } catch (e) {
    main.innerHTML = `<div class="kt-center"><img class="kt-center-crab" src="/favicon.png?v=2026-11-27" alt="" decoding="async"><h1>Krabsy</h1><p class="kc-card">${e.message === 'unknown_report' ? T.repBad : T.errNet}</p></div>`;
    return;
  }
  const tps = [...cat.ids.filter((t) => d.topics[t]), ...Object.keys(d.topics).filter((t) => !cat.ids.includes(t))];
  const maxW = Math.max(1, ...d.weeks);
  const fmt = (day) => new Date(day + 'T12:00:00').toLocaleDateString(LANG, { day: 'numeric', month: 'short' });
  main.innerHTML = `
    <div class="kc-card kt-phead kt-rephead">${avatarHtml(d.name, 'is-xl')}
      <div class="kt-phead-id"><p class="kt-eyebrow">${T.repEyebrow}</p><h1>${esc(T.repTitle(d.name))}</h1>
      <p class="kc-muted">${esc(T.repFrom(d.tutor_name))} · ${esc(T.repLessons(d.lessons, d.last_lesson ? fmt(d.last_lesson) : ''))}</p></div></div>
    ${d.note ? `<section class="kc-card kt-sec kt-repnote"><h2>${T.repNote}</h2><p class="kt-lnote">${esc(d.note)}</p></section>` : ''}
    <section class="kc-card kt-sec kt-sec-map"><h2>${T.repMap}</h2>
      ${tps.length ? `<table class="kc-table kt-scale"><tbody>${tps.map((tp) => `<tr><td><strong>${esc(topicName(cat, tp))}</strong></td>
        <td>${starsHtml(d.topics[tp].stars)}</td><td class="kc-muted">${esc(T.scale[Math.max(0, d.topics[tp].stars - 1)][1])}</td>
        <td class="num kc-muted">${d.topics[tp].answers} ${T.answers}</td></tr>`).join('')}</tbody></table>` : `<p class="kc-muted">–</p>`}
      <p class="kc-muted kt-replegend">${T.scaleH}: ${T.scale.map((x, i) => `${i + 1} = ${x[1]}`).join(' · ')}</p></section>
    <section class="kc-card kt-sec kt-sec-weeks"><h2>${T.repWeeks}</h2>
      <div class="kt-weeks">${d.weeks.map((n, i) => `<div><span class="kt-wbar" style="height:${Math.round((n / maxW) * 100)}%"></span><b>${n}</b><small>${T.repWeekNames[i]}</small></div>`).reverse().join('')}</div></section>
    ${d.homework.length ? `<section class="kc-card kt-sec kt-sec-hw"><h2>${T.repHw}</h2><ul class="kt-hw">${d.homework.map((h) => `<li>
      <span><strong>${esc(topicName(cat, h.topic))}</strong>${h.note ? `<br><span class="kc-muted">${esc(h.note)}</span>` : ''}</span>
      <span class="kt-hwprog">${progressBar(h)}<span class="kc-muted">${new Date(h.created).toLocaleDateString(LANG)} · ${T.hwProgress(h.answers, h.goal, h.correct_pct)}</span></span></li>`).join('')}</ul></section>` : ''}`;
}

const main = document.querySelector('[data-tutor-page]');
if (main) {
  const page = main.dataset.tutorPage;
  if (page === 'start') renderStart(main);
  else if (page === 'space') { renderSpace(main); window.addEventListener('hashchange', () => renderSpace(main)); }
  else if (page === 'student') {
    renderMe(main);
    // another student's link opened in the same tab only changes the #fragment
    window.addEventListener('hashchange', () => {
      if (/[#&]k=/.test(location.hash)) renderMe(main);
      else if (/[#&]w=\d+/.test(location.hash) && ME) showWorksheet(main, Number(location.hash.match(/w=(\d+)/)[1]));
      else if (!location.hash && ME) renderMe(main);
    });
  }
  else if (page === 'report') renderReport(main);
  else if (page === 'login') renderLogin(main);
}
