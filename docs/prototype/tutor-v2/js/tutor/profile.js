// Student profile: fixed header + six tabs.
import { state, student, attention, nextLesson, lessonWhen, activeLabel, dueLabel, TOPICS, TOPIC_IDS, LEVELS, material, KINDS, DAYS, dateOf, TODAY_IDX, STEP_KINDS, rng } from '../data.js';
import { esc, on, $, avatar, levelChip, stars, bar, toast, modal, go, drawer, pickMaterial, assignTo, cover, icon } from '../ui.js';
import { startLive } from './live.js';

const TABS = [['overview', 'Overview'], ['progress', 'Progress'], ['materials', 'Materials & homework'], ['lessons', 'Lessons'], ['notes', 'Notes'], ['family', 'Family']];
const best = (s, dir) => TOPIC_IDS.filter(t => s.topicStars[t] > 0).sort((a, b) => (s.topicStars[a] - s.topicStars[b]) * dir)[0];
const tl = t => t ? `<b>${TOPICS[t].label}</b>` : '—';

export function renderProfile(el, id, tab) {
  const s = student(id); if (!s) return go('#/students');
  const draw = () => {
    const l = nextLesson(s), a = attention(s);
    el.innerHTML = `<div class="page profile">
      <a class="back" href="#/students">${icon('left')} Students</a>
      <header class="p-head card">
        ${avatar(s, 'xl')}
        <div class="p-id"><h1 class="title">${esc(s.name)}</h1>
          <p>${levelChip(s)} <span class="chip">${s.adult ? 'Adult' : `Child · ${s.age}`}</span>${s.groups.map(g => `<span class="chip chip-group">${esc(g)}</span>`).join('')}${s.archived ? '<span class="chip chip-arch">Archived</span>' : ''}</p>
          <p class="p-goal">🎯 ${esc(s.goal || 'No goal yet')}</p></div>
        <div class="p-next"><span class="mute">Next lesson</span><b>${lessonWhen(l)}</b>
          <div>${l ? `<a class="btn" href="#/lessons/${l.id}">Plan lesson</a><button class="btn primary" data-start="${l.id}">Start live ▶</button>` : '<a class="btn" href="#/lessons">Add a lesson</a>'}</div></div>
      </header>
      ${a ? `<div class="banner ${a.tone}"><span class="att-ic ${a.tone}">${a.icon}</span><span><b>${esc(s.name)}:</b> ${esc(a.reason)}</span><a class="btn small" href="#/students/${s.id}/${a.tab}">${esc(a.action)}</a></div>` : ''}
      <nav class="tabs" role="tablist">${TABS.map(([t, lbl]) => `<a href="#/students/${s.id}/${t}" class="${tab === t ? 'on' : ''}" role="tab">${t === 'family' && s.adult ? 'Report' : lbl}</a>`).join('')}</nav>
      <div class="tab-body">${({ overview, progress, materials, lessons, notes, family })[tab](s, l)}</div></div>`;
  };
  draw();

  on(el, 'click', '[data-start]', (e, b) => startLive(+b.dataset.start));
  on(el, 'click', '[data-topic]', (e, b) => topicDrawer(s, b.dataset.topic));
  on(el, 'click', '[data-assign]', () => pickMaterial({ title: `Material for ${s.name}`, onDone: m => { assignTo([s.id], m); draw(); } }));
  on(el, 'click', '[data-remind]', () => toast(`Reminder text for ${esc(s.name)}’s parents copied`));
  on(el, 'click', '[data-addnote]', () => { const t = $('[data-note]', el); if (!t.value.trim()) return; s.notes.unshift({ date: '25 Nov', text: t.value.trim() }); draw(); toast('Note saved. Only you can see it.'); });
  on(el, 'click', '[data-copy]', (e, b) => toast(`${b.dataset.copy} copied`));
  on(el, 'click', '[data-newlink]', () => modal({ title: 'Issue a new link?', body: `<p>The old link stops working at once. ${esc(s.name)}’s answers and stars stay.</p>`, actions: [{ label: 'Cancel' }, { label: 'Issue new link', primary: true, onClick: () => { s.linkIssued = '25 Nov'; s.linkCode = 'n' + Math.floor(Math.random() * 9000 + 1000); draw(); toast('New link issued'); } }] }));
  on(el, 'change', '[data-consent]', (e, c) => { s.consent = c.checked; toast(c.checked ? 'Consent noted with today’s date' : 'Consent removed. The report link is off.'); draw(); });
  on(el, 'click', '[data-ws-weak]', () => { toast('Worksheet made from these words. It is in “Mine”.'); go('#/library/m_60/edit?for=' + s.id); });
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */
function overview(s, l) {
  const weak = best(s, 1), strong = best(s, -1), on_ = TOPIC_IDS.find(t => s.topicStars[t] === 2 || s.topicStars[t] === 3) || weak;
  const max = Math.max(1, ...s.activity);
  return `<div class="grid-ov">
    <section class="card pad"><h3>Next lesson</h3>${l ? `<p class="big-line">${lessonWhen(l)} · ${l.mins}'</p>${l.plan.length ? `<ol class="mini-plan">${l.plan.map(p => `<li><span>${STEP_KINDS[p.kind][1]}</span>${esc(p.title)}<i>${p.mins}'</i></li>`).join('')}</ol>` : '<p class="mute">No plan yet.</p>'}
      <a class="btn small" href="#/lessons/${l.id}">${l.plan.length ? 'Open plan' : 'Plan lesson'}</a>` : '<p class="mute">Nothing planned.</p>'}</section>
    <section class="card pad"><h3>Homework</h3>${s.hw ? `<p class="big-line">${esc(s.hw.title)}</p><p>${bar(s.hw.done, s.hw.total, s.hw.status === 'late' ? 'bad' : s.hw.status === 'done' ? 'good' : '')} ${s.hw.done}/${s.hw.total}
        · <span class="${s.hw.status === 'late' ? 'txt-bad' : ''}">${s.hw.status === 'done' ? `done · ${s.hw.score} % right at first try` : dueLabel(s.hw.due)}</span></p>` : '<p class="mute">No homework at the moment.</p>'}
      <button class="btn small" data-assign>Give homework</button></section>
    <section class="card pad"><h3>Where ${esc(s.name)} stands</h3>
      <dl class="kv"><dt>Working on</dt><dd>${tl(on_)} ${on_ ? stars(s.topicStars[on_]) : ''}</dd><dt>Weakest</dt><dd>${tl(weak)} ${weak ? stars(s.topicStars[weak]) : ''}</dd><dt>Strongest</dt><dd>${tl(strong)} ${strong ? stars(s.topicStars[strong]) : ''}</dd><dt>Last active</dt><dd>${activeLabel(s.lastActive)}</dd></dl></section>
    <section class="card pad"><h3>Trips over</h3>${s.trips.length ? `<ul class="trips">${s.trips.map(([w, x, n]) => `<li><b>${esc(w)}</b><span class="mute">answers “${esc(x)}”</span><span class="trip-n">${n}×</span></li>`).join('')}</ul>
      <button class="btn small" data-ws-weak>Make a worksheet from these</button>` : '<p class="mute">No answers yet.</p>'}</section>
    <section class="card pad"><h3>Last lesson’s note</h3><p class="note-q">${s.noNote ? '<span class="txt-bad">No note for Monday’s lesson.</span>' : `“${esc(s.notes[0] ? s.notes[0].text : '—')}”`}</p><a class="btn small" href="#/students/${s.id}/${s.noNote ? 'lessons' : 'notes'}">${s.noNote ? 'Write note' : 'All notes'}</a></section>
    <section class="card pad"><h3>Last 4 weeks</h3><div class="act" aria-label="Answers per day">${s.activity.map(v => `<i style="height:${Math.max(6, v / max * 100)}%" class="${v ? '' : 'zero'}" title="${v} answers"></i>`).join('')}</div>
      <p class="mute">${s.activity.filter(Boolean).length} active days · ${s.activity.reduce((a, b) => a + b, 0)} answers</p></section>
  </div>`;
}

function progress(s) {
  return `<p class="mute">Stars count first tries only: choosing gets up to ★3, typing ★4, speaking with you ★5. Click a topic to see the words behind it.</p>
    ${LEVELS.slice(1).map(lv => { const ts = TOPIC_IDS.filter(t => TOPICS[t].level === lv); return ts.length ? `<h3 class="lv-h">${lv}</h3><div class="starmap">${ts.map(t => `<button class="sm-cell tint-${TOPICS[t].tint} ${s.drop && s.drop[0] === t ? 'dropped' : ''}" data-topic="${t}">
        <span class="sm-pic">${TOPICS[t].emoji[0]}</span><b>${TOPICS[t].label}</b>${stars(s.topicStars[t] || 0)}<small>${s.topicStars[t] ? `${12 + s.topicStars[t] * 9} answers` : 'not started'}${s.drop && s.drop[0] === t ? ' · ↓ was ★' + s.drop[1] : ''}</small></button>`).join('')}</div>` : ''; }).join('')}
    <h3 class="lv-h">B1</h3><p class="mute">Topics for B1 come later (por / para, past tenses).</p>`;
}

function topicDrawer(s, t) {
  const T = TOPICS[t];
  drawer(`<header class="dr-h"><div><span class="mute">${esc(s.name)} · ${T.level}</span><h2>${T.label}</h2></div><button class="iconbtn" data-close>${icon('x')}</button></header>
    <div class="dr-body"><p>${stars(s.topicStars[t] || 0)} · example: <i>${esc(T.es)}</i></p>
      <h4>Wrong at first try, most often</h4><ul class="trips">${s.trips.map(([w, x, n]) => `<li><b>${esc(w)}</b><span class="mute">answered “${esc(x)}”</span><span class="trip-n">${n}×</span></li>`).join('')}</ul>
      <h4>How the answers came in</h4><dl class="kv"><dt>Chosen</dt><dd>41 answers · 78 % right</dd><dt>Typed</dt><dd>12 answers · 58 % right</dd><dt>With a hint</dt><dd>9 answers</dd></dl>
      <div class="dr-actions"><button class="btn primary" data-mk>Make a worksheet from these</button><a class="btn" href="#/library?topic=${t}">Material for ${T.label}</a></div></div>`,
    w => on(w, 'click', '[data-mk]', () => { toast('Worksheet made from these words. It is in “Mine”.'); go('#/library/m_60/edit?for=' + s.id); }));
}

function materials(s) {
  const mine = state.assignments.filter(a => a.studentId === s.id);
  const row = a => { const m = material(a.materialId); return `<tr><td class="c-name"><a href="#/library?open=${m.id}">${cover(m, 'xs')}<span><b>${esc(m.title)}</b><small>${KINDS[m.kind].label} · ${TOPICS[m.topic].label}</small></span></a></td>
    <td data-l="Status"><span class="st st-${a.status === 'done' ? 'ready' : a.status === 'late' ? 'late' : 'draft'}">${a.status === 'done' ? 'Done' : a.status === 'late' ? 'Late' : 'Open'}</span></td><td data-l="Due">${esc(a.due || 'no date')}</td>
    <td data-l="Result">${a.score ? `${a.score} % at first try` : a.status === 'late' ? '12 of 40 answered' : '<span class="mute">—</span>'}</td>
    <td>${a.status === 'late' ? '<button class="btn small" data-remind>Remind</button>' : a.status === 'done' ? `<a class="btn small ghost" href="#/library?open=${m.id}">Look</a>` : ''}</td></tr>`; };
  return `<div class="row-between"><p class="mute">Everything ${esc(s.name)} has from you. The same material can be out with other students too.</p><button class="btn primary" data-assign>${icon('plus')} Assign material</button></div>
    <div class="card table-card"><table class="tbl"><thead><tr><th>Material</th><th>Status</th><th>Due</th><th>Result</th><th></th></tr></thead><tbody>
    ${mine.length ? mine.sort((a, b) => (a.status === 'done') - (b.status === 'done')).map(row).join('') : '<tr><td colspan="5" class="empty">Nothing assigned yet.</td></tr>'}</tbody></table></div>`;
}

function lessons(s) {
  const R = rng(s.id * 3); const wk = state.lessons.filter(l => l.studentIds.includes(s.id));
  const past = [16, 9, 2].map((d, i) => ({ date: `${d} Nov`, note: ['Farm animals with picture cards. He knew 9 of 12. “Está” for places clicked today.', 'Feelings: contento, triste, cansado. Homework was half done.', 'First lesson after the break. Review of ser with colours.'][i], steps: 5 + Math.floor(R() * 2) }));
  return `<ol class="timeline">${wk.map(l => `<li class="${l.status === 'done' ? 'past' : 'next'}"><span class="tm-dot"></span><div class="card pad"><div class="row-between"><b>${DAYS[l.day]} ${dateOf(l.day)} · ${l.time} · ${l.mins}'</b>
      <span class="st st-${l.status === 'ready' ? 'ready' : l.status === 'done' ? 'done' : l.status === 'draft' ? 'draft' : 'none'}">${l.status === 'done' ? 'Taught' : l.status === 'ready' ? 'Plan ready' : l.status === 'draft' ? 'Draft' : 'No plan'}</span></div>
      ${l.plan.length ? `<p class="steps-line">${l.plan.map(p => `<span title="${esc(p.title)}">${l.status === 'done' ? '✓ ' : ''}${STEP_KINDS[p.kind][0]}</span>`).join('')}</p>` : ''}
      ${l.status === 'done' ? (l.note ? `<p class="note-q">“${esc(l.note)}”</p>` : `<p class="txt-bad">No note yet.</p><a class="btn small" href="#/lessons/${l.id}">Write note</a>`) : `<a class="btn small" href="#/lessons/${l.id}">${l.plan.length ? 'Open plan' : 'Plan lesson'}</a>`}</div></li>`).join('')}
    ${past.map(p => `<li class="past"><span class="tm-dot"></span><div class="card pad"><div class="row-between"><b>${p.date} · 50'</b><span class="st st-done">Taught</span></div><p class="mute">${p.steps} steps, as taught</p><p class="note-q">“${esc(p.note)}”</p></div></li>`).join('')}</ol>`;
}

function notes(s) {
  return `<div class="narrow-col"><div class="card pad"><h3>Private notes</h3><p class="mute">Only you see these. They never appear in the report.</p>
    <textarea class="input" rows="3" data-note placeholder="What should you remember about ${esc(s.name)}?"></textarea><button class="btn primary" data-addnote>Save note</button></div>
    ${s.notes.map(n => `<div class="card pad note"><span class="mute">${n.date}</span><p>${esc(n.text)}</p></div>`).join('')}</div>`;
}

function family(s) {
  const code = s.linkCode || ('k' + (s.id * 7919 % 9000 + 1000));
  const R = rng(s.id * 11); const qr = Array.from({ length: 121 }, (_, i) => { const x = i % 11, y = Math.floor(i / 11); const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); return corner || R() > 0.55 ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''; }).join('');
  return `<div class="grid-fam">
    <section class="card pad"><h3>${esc(s.name)}’s link card</h3>
      <div class="linkcard"><svg viewBox="0 0 11 11" class="qr" aria-label="QR code (fake)">${qr}</svg><div><b>${esc(s.name)}</b><code>krabsy.com/en/spanish/me/#${code}</code>
        <span class="mute">${s.lastActive === null ? `Never opened · issued ${s.linkIssued}` : `Issued ${s.linkIssued || '2 Sep'} · first used ${s.linkIssued ? 'today' : '3 Sep'}`}</span></div></div>
      <div class="btn-row"><button class="btn" data-copy="Link">Copy link</button><button class="btn" data-copy="Printable card">Print card</button><button class="btn" data-copy="Message for parents">Message for parents</button><button class="link" data-newlink>Issue a new link</button></div>
      <p class="mute">No account, no email, no ads. The link is the key, so it goes to the family only.</p></section>
    <section class="card pad"><h3>${s.adult ? 'Report' : 'Report for parents'}</h3>
      ${s.adult ? '' : `<label class="check"><input type="checkbox" data-consent ${s.consent ? 'checked' : ''}> A parent agreed that I keep progress data for ${esc(s.name)}${s.consent ? ' <span class="mute">(noted 3 Sep 2026)</span>' : ''}</label>`}
      ${s.consent ? `<label class="lbl">A note for ${s.adult ? esc(s.name) : 'the parents'}<textarea class="input" rows="2">${esc(s.name)} is doing well with animal words. Please read “La granja” together once this week.</textarea></label>
      <div class="btn-row"><button class="btn" data-copy="Report link">Copy report link</button></div>` : '<p class="banner warn">Without consent there is no report link.</p>'}</section>
    ${s.consent ? `<section class="card pad span2"><h3>What ${s.adult ? esc(s.name) : 'the parents'} see</h3>
      <div class="parent-view"><p class="pv-h"><b>${esc(s.name)}</b> · Spanish with Nora · 25 Nov</p>
        <div class="pv-row">${TOPIC_IDS.filter(t => s.topicStars[t]).slice(0, 5).map(t => `<span>${TOPICS[t].emoji[0]} ${TOPICS[t].label} ${stars(s.topicStars[t])}</span>`).join('')}</div>
        <p>This month: ${s.activity.filter(Boolean).length} days of practice, 1 book read, 9 animal words in the album.</p>
        <p class="pv-note">“${esc(s.name)} is doing well with animal words. Please read “La granja” together once this week.” <span class="mute">Nora</span></p></div></section>` : ''}
  </div>`;
}
