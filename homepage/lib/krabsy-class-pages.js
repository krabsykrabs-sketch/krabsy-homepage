/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — class pages UI (phase 2, 2026-11-22)

   One module for three pages, chosen by <main data-class-page="…">:
     join       /de/klasse/                       /es/clase/
     create     /de/lehrkraefte/klasse-erstellen/ /es/docentes/crear-clase/
     dashboard  /de/lehrkraefte/klasse/#t=…       /es/docentes/clase/#t=…
   Language = <html lang>. All text is in T below.

   The teacher token travels only in the URL fragment (#t=…), which the
   browser never sends to a server, and in the X-Teacher-Token header to
   the API. Classes created on this device are remembered in
   localStorage["krabsy_teacher_classes"] (name, code, token) for a "your
   classes" list — nothing else.
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase, getSession, join, leave } from '/lib/krabsy-class.js?v=2026-11-22b';

const LANG = document.documentElement.lang === 'es' ? 'es' : 'de';
const PATHS = {
  de: { join: '/de/klasse/', create: '/de/lehrkraefte/klasse-erstellen/', dash: '/de/lehrkraefte/klasse/',
        games: '/de/spiele/', verbs: '/de/unregelmaessige-verben/', home: '/de/' },
  es: { join: '/es/clase/', create: '/es/docentes/crear-clase/', dash: '/es/docentes/clase/',
        games: '/es/juegos/', verbs: '/es/verbos-irregulares/', home: '/es/' },
}[LANG];

const T = {
  de: {
    joinTitle: 'Einer Klasse beitreten', joinLead: 'Gib den Code ein, den deine Lehrerin oder dein Lehrer dir gegeben hat, und deinen Vornamen.',
    code: 'Klassencode', nick: 'Dein Vorname', nickHint: 'Nur der Vorname. Gibt es ihn in der Klasse zweimal, häng den ersten Buchstaben deines Nachnamens an, z. B. „Mia S.“', joinBtn: 'Beitreten',
    takenQ: (n) => `In dieser Klasse gibt es schon „${n}“. Bist du das?`,
    takenMe: (n) => `Ja, ich bin ${n} (anderes Gerät)`, takenOther: 'Nein, ich bin jemand anderes',
    takenHint: 'Dann schreib den ersten Buchstaben deines Nachnamens dazu, z. B. „Mia S.“',
    joined: (n, c) => `Du bist in <strong>${n}</strong> als <strong>${c}</strong>.`,
    joinedLead: 'Alles, was du jetzt in Spielen und Übungen beantwortest, sieht deine Lehrkraft. So weiß sie, welche Wörter ihr noch üben solltet.',
    toGames: 'Zu den Spielen', toPractice: 'Zum Üben', notMe: 'Nicht du? Klasse verlassen',
    errCode: 'Diesen Code gibt es nicht. Prüf ihn noch einmal.', errNick: 'Bitte nur Buchstaben, höchstens 20 Zeichen.',
    errFull: 'Diese Klasse ist voll.', errNet: 'Keine Verbindung. Versuch es gleich noch einmal.', errMany: 'Zu viele Versuche. Warte kurz.',
    createTitle: 'Klasse erstellen', createLead: 'Sie bekommen einen Code für die Klasse und einen privaten Link zu Ihrer Übersicht. Kein Konto, keine E-Mail.',
    className: 'Name der Klasse', classNamePh: 'z. B. 6b Englisch', createBtn: 'Klasse erstellen',
    created: 'Ihre Klasse ist bereit', codeForPupils: 'Code für die Schülerinnen und Schüler',
    pupilLink: 'Link für die Klasse (z. B. in Moodle oder Teams teilen)', yourLink: 'Ihr privater Link zur Übersicht',
    yourLinkWarn: 'Speichern Sie diesen Link als Lesezeichen. Wer ihn hat, sieht die Klasse. Es gibt keinen anderen Zugang.',
    copy: 'Kopieren', copied: 'Kopiert ✓', openDash: 'Übersicht öffnen', showCode: 'Code groß anzeigen',
    yourClasses: 'Ihre Klassen auf diesem Gerät', noClasses: '',
    dashTitle: 'Klassenübersicht', noToken: 'Diese Klasse gibt es nicht (mehr). Der Link ist unvollständig oder die Klasse wurde gelöscht.',
    week: 'Diese Woche', active: 'aktiv', answers: 'Antworten', right: 'richtig',
    hard: 'Diese Wörter sind für die Klasse noch schwer', hardNone: 'Noch keine schwierigen Wörter – oder noch zu wenige Antworten.',
    unsure: 'unsicher', solid: 'Das sitzt schon', pupils: 'Schülerinnen und Schüler', nickCol: 'Vorname',
    lastActive: 'zuletzt aktiv', thisWeek: 'diese Woche', total: 'gesamt', practise: 'noch üben',
    remove: 'Entfernen', removeQ: (n) => `${n} aus der Klasse entfernen? Die Antworten werden gelöscht.`,
    noPupils: 'Noch niemand beigetreten. Geben Sie der Klasse den Code oder den Link.',
    where: 'Womit geübt wurde', rename: 'Umbenennen', renamePrompt: 'Neuer Name der Klasse:',
    del: 'Klasse löschen', delQ: 'Klasse mit allen Namen und Antworten endgültig löschen?',
    deleted: 'Die Klasse wurde gelöscht.', retention: (d) => `Ohne Aktivität wird die Klasse nach ${d} Tagen automatisch gelöscht.`,
    never: '–', today: 'heute', daysAgo: (n) => (n === 1 ? 'gestern' : `vor ${n} Tagen`),
    sources: { sprint: 'Sprint', flashcards: 'Karteikarten', 'free-practice': 'Freies Üben', 'verb-towers': 'Verb Towers',
               'verb-snake': 'Verb Snake', 'air-control': 'Air Control', 'quiz-room': 'Quiz-Raum', other: 'Sonstiges' },
    topicPrep: 'Präposition',
  },
  es: {
    joinTitle: 'Unirse a una clase', joinLead: 'Escribe el código que te dio tu profesor o profesora y tu nombre.',
    code: 'Código de la clase', nick: 'Tu nombre', nickHint: 'Solo el nombre. Si en tu clase hay dos con el mismo nombre, añade la inicial de tu apellido, p. ej. «Lucía M.»', joinBtn: 'Unirme',
    takenQ: (n) => `En esta clase ya hay «${n}». ¿Eres tú?`,
    takenMe: (n) => `Sí, soy ${n} (otro dispositivo)`, takenOther: 'No, soy otra persona',
    takenHint: 'Entonces añade la inicial de tu apellido, p. ej. «Lucía M.»',
    joined: (n, c) => `Estás en <strong>${n}</strong> como <strong>${c}</strong>.`,
    joinedLead: 'Todo lo que respondas ahora en juegos y ejercicios lo verá tu profesor. Así sabe qué palabras hay que practicar.',
    toGames: 'Ir a los juegos', toPractice: 'Ir a practicar', notMe: '¿No eres tú? Salir de la clase',
    errCode: 'Ese código no existe. Revísalo.', errNick: 'Solo letras, máximo 20 caracteres.',
    errFull: 'Esta clase está llena.', errNet: 'Sin conexión. Inténtalo de nuevo.', errMany: 'Demasiados intentos. Espera un momento.',
    createTitle: 'Crear una clase', createLead: 'Recibirá un código para la clase y un enlace privado a su resumen. Sin cuenta y sin correo.',
    className: 'Nombre de la clase', classNamePh: 'p. ej. 1.º ESO B inglés', createBtn: 'Crear clase',
    created: 'Su clase está lista', codeForPupils: 'Código para el alumnado',
    pupilLink: 'Enlace para la clase (p. ej. en Classroom, Teams o Moodle)', yourLink: 'Su enlace privado al resumen',
    yourLinkWarn: 'Guarde este enlace en marcadores. Quien lo tenga ve la clase. No hay otro acceso.',
    copy: 'Copiar', copied: 'Copiado ✓', openDash: 'Abrir el resumen', showCode: 'Mostrar el código en grande',
    yourClasses: 'Sus clases en este dispositivo', noClasses: '',
    dashTitle: 'Resumen de la clase', noToken: 'Esta clase no existe (o ya no existe). El enlace está incompleto o la clase se eliminó.',
    week: 'Esta semana', active: 'activos', answers: 'respuestas', right: 'correctas',
    hard: 'Estas palabras aún le cuestan a la clase', hardNone: 'Todavía no hay palabras difíciles, o aún hay pocas respuestas.',
    unsure: 'inseguros', solid: 'Esto ya lo dominan', pupils: 'Alumnado', nickCol: 'Nombre',
    lastActive: 'última actividad', thisWeek: 'esta semana', total: 'total', practise: 'por practicar',
    remove: 'Quitar', removeQ: (n) => `¿Quitar a ${n} de la clase? Se borrarán sus respuestas.`,
    noPupils: 'Todavía no se ha unido nadie. Comparta el código o el enlace.',
    where: 'Con qué se practicó', rename: 'Cambiar nombre', renamePrompt: 'Nuevo nombre de la clase:',
    del: 'Eliminar la clase', delQ: '¿Eliminar definitivamente la clase con todos los nombres y respuestas?',
    deleted: 'La clase se ha eliminado.', retention: (d) => `Sin actividad, la clase se elimina automáticamente tras ${d} días.`,
    never: '–', today: 'hoy', daysAgo: (n) => (n === 1 ? 'ayer' : `hace ${n} días`),
    sources: { sprint: 'Sprint', flashcards: 'Tarjetas', 'free-practice': 'Práctica libre', 'verb-towers': 'Verb Towers',
               'verb-snake': 'Verb Snake', 'air-control': 'Air Control', 'quiz-room': 'Sala de quiz', other: 'Otros' },
    topicPrep: 'preposición',
  },
}[LANG];

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function errorText(code) {
  return { unknown_code: T.errCode, bad_nickname: T.errNick, class_full: T.errFull, too_many: T.errMany }[code] || T.errNet;
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

function ago(iso) {
  if (!iso) return T.never;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return days <= 0 ? T.today : T.daysAgo(days);
}

function wordLabel(w) {
  // Verbs: the base form; prepositions: the use-case id is shown readable.
  if (w.topic === 'prepositions') return `${esc(w.item.replace(/^prep_/, '').replace(/_/g, ' '))} <span class="kc-muted">(${T.topicPrep})</span>`;
  return `<span lang="en">${esc(w.item)}</span>`;
}

/* ── join ──────────────────────────────────────────────────────────────── */
function renderJoin(main) {
  const s = getSession();
  if (s) {
    main.innerHTML = `
      <h1>${T.joinTitle}</h1>
      <div class="kc-card kc-done">
        <p class="kc-big">${T.joined(esc(s.name), esc(s.nickname))}</p>
        <p>${T.joinedLead}</p>
        <p class="kc-row"><a class="kc-btn" href="${PATHS.games}">${T.toGames}</a>
          <a class="kc-btn kc-btn-ghost" href="${PATHS.verbs}">${T.toPractice}</a></p>
        <p><button type="button" class="kc-link" id="kc-leave">${T.notMe}</button></p>
      </div>`;
    $('#kc-leave').addEventListener('click', () => { leave(); renderJoin(main); });
    return;
  }
  const pre = new URLSearchParams(location.search).get('code') || '';
  main.innerHTML = `
    <h1>${T.joinTitle}</h1>
    <p class="kc-lead">${T.joinLead}</p>
    <form class="kc-card" id="kc-join" novalidate>
      <label class="kc-field"><span>${T.code}</span>
        <input id="kc-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
               maxlength="9" placeholder="ABC-123" value="${esc(pre)}" class="kc-code-input" required></label>
      <label class="kc-field"><span>${T.nick}</span>
        <input id="kc-nick" name="nickname" autocomplete="given-name" maxlength="20" required>
        <small>${T.nickHint}</small></label>
      <p class="kc-error" id="kc-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${T.joinBtn}</button>
    </form>`;
  (pre ? $('#kc-nick') : $('#kc-code')).focus();
  const err = $('#kc-err');
  async function tryJoin(samePerson) {
    const btn = $('#kc-join button[type=submit]'); btn.disabled = true;
    const name = $('#kc-nick').value.trim();
    const r = await join($('#kc-code').value, name, samePerson);
    btn.disabled = false;
    if (r.ok) { renderJoin(main); return; }
    if (r.error === 'name_taken') { askSameName(name); return; }
    err.textContent = errorText(r.error); err.hidden = false;
  }
  // Same first name already in the class: never merge two pupils silently.
  function askSameName(name) {
    err.hidden = false;
    err.innerHTML = `<span>${esc(T.takenQ(name))}</span>
      <span class="kc-row" style="margin-top:8px">
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-me">${esc(T.takenMe(name))}</button>
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-other">${esc(T.takenOther)}</button></span>`;
    $('#kc-me').addEventListener('click', () => tryJoin(true));
    $('#kc-other').addEventListener('click', () => {
      err.textContent = T.takenHint;
      const input = $('#kc-nick'); input.value = name + ' '; input.focus();
    });
  }
  $('#kc-join').addEventListener('submit', (ev) => { ev.preventDefault(); tryJoin(false); });
}

/* ── create ────────────────────────────────────────────────────────────── */
function rememberedClasses() {
  try { return JSON.parse(localStorage.getItem('krabsy_teacher_classes') || '[]') || []; } catch (_) { return []; }
}
function remember(c) {
  const list = rememberedClasses().filter((x) => x.token !== c.token);
  list.unshift(c);
  try { localStorage.setItem('krabsy_teacher_classes', JSON.stringify(list.slice(0, 30))); } catch (_) {}
}
function forget(token) {
  try { localStorage.setItem('krabsy_teacher_classes', JSON.stringify(rememberedClasses().filter((x) => x.token !== token))); } catch (_) {}
}
const dashUrl = (token) => `${location.origin}${PATHS.dash}#t=${token}`;
const joinUrl = (code) => `${location.origin}${PATHS.join}?code=${encodeURIComponent(code)}`;

function renderCreate(main) {
  const list = rememberedClasses();
  main.innerHTML = `
    <h1>${T.createTitle}</h1>
    <p class="kc-lead">${T.createLead}</p>
    <form class="kc-card" id="kc-create">
      <label class="kc-field"><span>${T.className}</span>
        <input id="kc-name" maxlength="40" placeholder="${T.classNamePh}"></label>
      <p class="kc-error" id="kc-err" role="alert" hidden></p>
      <button class="kc-btn" type="submit">${T.createBtn}</button>
    </form>
    <div id="kc-result"></div>
    ${list.length ? `<section class="kc-card"><h2>${T.yourClasses}</h2><ul class="kc-list">${list.map((c) =>
      `<li><a href="${PATHS.dash}#t=${esc(c.token)}">${esc(c.name)}</a> <span class="kc-muted">${esc(c.code)}</span></li>`).join('')}</ul></section>` : ''}`;
  $('#kc-create').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('#kc-create button'); btn.disabled = true;
    try {
      const r = await fetch(apiBase() + '/api/class/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ name: $('#kc-name').value, lang: LANG }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'http');
      remember({ name: d.name, code: d.code, token: d.teacher_token });
      $('#kc-create').hidden = true;
      showCreated($('#kc-result'), d);
    } catch (e) {
      const el = $('#kc-err'); el.textContent = errorText(e.message); el.hidden = false; btn.disabled = false;
    }
  });
}

function showCreated(box, d) {
  box.innerHTML = `
    <section class="kc-card kc-done">
      <h2>${T.created}: ${esc(d.name)}</h2>
      <p class="kc-label">${T.codeForPupils}</p>
      <p class="kc-code">${esc(d.code)}</p>
      <p class="kc-label">${T.pupilLink}</p>
      <p class="kc-row"><code class="kc-url">${esc(joinUrl(d.code))}</code><span id="kc-c1"></span></p>
      <p class="kc-label">${T.yourLink}</p>
      <p class="kc-row"><code class="kc-url">${esc(dashUrl(d.teacher_token))}</code><span id="kc-c2"></span></p>
      <p class="kc-warn">${T.yourLinkWarn}</p>
      <p class="kc-row"><a class="kc-btn" href="${PATHS.dash}#t=${esc(d.teacher_token)}">${T.openDash}</a>
        <button type="button" class="kc-btn kc-btn-ghost" id="kc-big">${T.showCode}</button></p>
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
function teacherToken() {
  const m = location.hash.match(/[#&]t=([A-Za-z0-9_-]{20,64})/);
  return m ? m[1] : null;
}

async function api(path, token, body) {
  const r = await fetch(apiBase() + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'omit',
    headers: Object.assign({ 'X-Teacher-Token': token }, body === undefined ? {} : { 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || 'http');
  return d;
}

async function renderDashboard(main) {
  const token = teacherToken();
  let d;
  try { if (!token) throw new Error('unknown_class'); d = await api('/api/class/dashboard', token); }
  catch (e) {
    main.innerHTML = `<h1>${T.dashTitle}</h1><p class="kc-card">${e.message === 'unknown_class' ? T.noToken : T.errNet}</p>
      <p><a class="kc-btn" href="${PATHS.create}">${T.createTitle}</a></p>`;
    return;
  }
  const c = d.class, w = d.week;
  remember({ name: c.name, code: c.code, token });
  const pct = (v) => (v == null ? '–' : `${v} %`);
  const words = (list) => list.map((x) => `<li><span class="kc-word">${wordLabel(x)}</span>
      <span class="kc-muted">${pct(x.correct_pct)} ${T.right}${x.unsure.length ? ` · ${T.unsure}: ${x.unsure.map(esc).join(', ')}` : ''}</span></li>`).join('');
  main.innerHTML = `
    <div class="kc-head">
      <div><h1>${esc(c.name)}</h1>
        <p class="kc-muted">${T.code}: <strong class="kc-code-inline">${esc(c.code)}</strong> · <a href="${PATHS.join}?code=${encodeURIComponent(c.code)}">${esc(location.host + PATHS.join)}</a></p></div>
      <p class="kc-row"><button class="kc-btn kc-btn-ghost" id="kc-big">${T.showCode}</button>
        <button class="kc-btn kc-btn-ghost" id="kc-rename">${T.rename}</button></p>
    </div>
    <section class="kc-stats">
      <div class="kc-stat"><span>${w.active_students} / ${w.students}</span>${T.active} · ${T.week}</div>
      <div class="kc-stat"><span>${w.answers}</span>${T.answers} · ${T.week}</div>
      <div class="kc-stat"><span>${pct(w.correct_pct)}</span>${T.right}</div>
    </section>
    <section class="kc-card"><h2>${T.hard}</h2>${d.hard_words.length ? `<ul class="kc-words">${words(d.hard_words)}</ul>` : `<p class="kc-muted">${T.hardNone}</p>`}</section>
    ${d.solid_words.length ? `<section class="kc-card"><h2>${T.solid}</h2><ul class="kc-words">${words(d.solid_words.slice(0, 10))}</ul></section>` : ''}
    <section class="kc-card"><h2>${T.pupils}</h2>
      ${d.students.length ? `<div class="kc-table-wrap"><table class="kc-table"><thead><tr><th>${T.nickCol}</th><th>${T.lastActive}</th>
        <th class="num">${T.thisWeek}</th><th class="num">${T.total}</th><th class="num">${T.right}</th><th>${T.practise}</th><th></th></tr></thead><tbody>
        ${d.students.map((s) => `<tr><td><strong>${esc(s.nickname)}</strong></td><td>${ago(s.last_active)}</td>
          <td class="num">${s.answers_week}</td><td class="num">${s.answers}</td><td class="num">${pct(s.correct_pct)}</td>
          <td>${s.hard_words.map(wordLabel).join(', ') || '–'}</td>
          <td><button class="kc-link" data-remove="${esc(s.nickname)}">${T.remove}</button></td></tr>`).join('')}
        </tbody></table></div>` : `<p class="kc-muted">${T.noPupils}</p>`}
    </section>
    ${d.sources.length ? `<section class="kc-card"><h2>${T.where}</h2><p>${d.sources.map(([k, n]) => `${esc(T.sources[k] || k)} <span class="kc-muted">${n}</span>`).join(' · ')}</p></section>` : ''}
    <p class="kc-muted">${T.retention(c.delete_after_days)}</p>
    <p><button class="kc-btn kc-btn-danger" id="kc-delete">${T.del}</button></p>`;
  $('#kc-big').addEventListener('click', () => showBigCode(c.code));
  $('#kc-rename').addEventListener('click', async () => {
    const name = prompt(T.renamePrompt, c.name);
    if (name && name.trim()) { await api('/api/class/rename', token, { name }); renderDashboard(main); }
  });
  main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(T.removeQ(b.dataset.remove))) return;
    await api('/api/class/remove-student', token, { nickname: b.dataset.remove });
    renderDashboard(main);
  }));
  $('#kc-delete').addEventListener('click', async () => {
    if (!confirm(T.delQ)) return;
    await api('/api/class/delete', token, {});
    forget(token);
    main.innerHTML = `<h1>${T.dashTitle}</h1><p class="kc-card">${T.deleted}</p>`;
  });
}

const main = document.querySelector('[data-class-page]');
if (main) {
  const page = main.dataset.classPage;
  if (page === 'join') renderJoin(main);
  else if (page === 'create') renderCreate(main);
  else if (page === 'dashboard') { renderDashboard(main); window.addEventListener('hashchange', () => renderDashboard(main)); }
}
