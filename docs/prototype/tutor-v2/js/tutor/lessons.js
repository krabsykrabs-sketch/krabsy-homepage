// Lessons: the week as a list, and the planner for one lesson.
import { state, lesson, lessonStudents, lessonNames, DAYS_LONG, DAYS, dateOf, TODAY_IDX, STEP_KINDS, lucasPlan, TOPICS, TOPIC_IDS, material, KINDS } from '../data.js';
import { esc, on, $, avatar, levelChip, toast, go, modal, pickMaterial, stars, icon, cover } from '../ui.js';
import { startLive } from './live.js';

const ST = { ready: ['Plan ready', 'ready'], draft: ['Draft', 'draft'], none: ['No plan', 'none'], done: ['Taught', 'done'] };

export function renderLessons(el) {
  const ls = state.lessons, mins = ls.reduce((n, l) => n + l.mins, 0);
  el.innerHTML = `<div class="page">
    <div class="page-head"><div><h1 class="title">Lessons</h1><p class="lead">${ls.length} lessons this week · ${Math.floor(mins / 60)} h ${mins % 60} min · ${ls.filter(l => l.status === 'none' && l.day >= TODAY_IDX).length} still without a plan</p></div>
      <div class="quick"><span class="weeknav"><button class="iconbtn" data-wk aria-label="Week before">${icon('left')}</button><b>23 – 29 November</b><button class="iconbtn" data-wk aria-label="Week after">${icon('right')}</button></span><button class="btn primary" data-new>${icon('plus')} New lesson</button></div></div>
    <p class="mute tz">Times are shown in your time zone (Montevideo). Students see their own.</p>
    ${DAYS_LONG.map((d, i) => { const day = ls.filter(l => l.day === i); return `<section class="day ${i === TODAY_IDX ? 'today' : i < TODAY_IDX ? 'past' : ''}">
      <h2><b>${d}</b> ${dateOf(i)}${i === TODAY_IDX ? '<span class="st st-ready">Today</span>' : ''}</h2>
      ${day.length ? `<ul class="card les-list">${day.map(l => { const ss = lessonStudents(l), [lbl, cls] = ST[l.status];
        return `<li><time>${l.time}</time><div class="les-who">${ss.map(s => `<a href="#/students/${s.id}/overview">${avatar(s, 'sm')}<b>${esc(s.name)}</b></a>${levelChip(s)}`).join('')}</div>
          <span class="les-meta">${l.mins}'${l.weekly ? ' · <span title="Repeats weekly">↻ weekly</span>' : ''}</span>
          <span class="les-goal">${l.status === 'done' && !l.note ? '<span class="txt-bad">No note yet</span>' : esc(l.goal || '')}</span>
          <span class="st st-${cls}">${lbl}${l.plan.length && l.status !== 'done' ? ` · ${l.plan.length} steps` : ''}</span>
          <span class="les-act"><a class="btn small ${l.status === 'none' ? '' : 'ghost'}" href="#/lessons/${l.id}">${l.status === 'done' ? (l.note ? 'Open' : 'Write note') : l.status === 'none' ? 'Plan lesson' : 'Plan'}</a>
            ${i === TODAY_IDX && l.status !== 'done' ? `<button class="btn small primary" data-start="${l.id}">Start ▶</button>` : ''}</span></li>`; }).join('')}</ul>` : '<p class="mute day-empty">No lessons.</p>'}</section>`; }).join('')}</div>`;
  on(el, 'click', '[data-start]', (e, b) => startLive(+b.dataset.start));
  on(el, 'click', '[data-wk]', () => toast('The prototype has this one week. Weekly lessons repeat by themselves.'));
  on(el, 'click', '[data-new]', () => newLessonModal(() => renderLessonsAgain()));
  const renderLessonsAgain = () => window.dispatchEvent(new Event('hashchange'));
}

export function newLessonModal(done) {
  modal({ title: 'New lesson', body: `<div class="form-grid">
      <label>Student<select class="input" data-s>${state.students.filter(s => !s.archived).map(s => `<option value="${s.id}">${esc(s.name)} · ${s.level}</option>`).join('')}</select></label>
      <label>Day<select class="input" data-d>${DAYS_LONG.map((d, i) => `<option value="${i}" ${i === 3 ? 'selected' : ''}>${d} ${dateOf(i)}</option>`).join('')}</select></label>
      <label>Time<input class="input" type="time" value="14:00" data-t></label>
      <label>Minutes<select class="input" data-m><option>30</option><option selected>50</option><option>60</option></select></label></div>
      <label class="check"><input type="checkbox" checked data-w> Repeat every week at this time</label>
      <label class="lbl">Goal in one line (optional)<input class="input" data-g placeholder="e.g. feelings with estar"></label>`,
    actions: [{ label: 'Cancel' }, { label: 'Add lesson', primary: true, onClick: w => {
      state.lessons.push({ id: Math.max(...state.lessons.map(l => l.id)) + 1, key: 'new' + Date.now(), studentIds: [+$('[data-s]', w).value], day: +$('[data-d]', w).value, time: $('[data-t]', w).value || '14:00', mins: +$('[data-m]', w).value,
        status: 'none', plan: [], note: '', goal: $('[data-g]', w).value, weekly: $('[data-w]', w).checked });
      state.lessons.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time)); toast('Lesson added'); done && done(); } }] });
}

/* ── Planner ────────────────────────────────────────────────────────────── */
export function renderPlanner(el, id) {
  const l = lesson(id); if (!l) return go('#/lessons');
  const s = lessonStudents(l)[0];
  const weak = TOPIC_IDS.filter(t => s.topicStars[t] > 0).sort((a, b) => s.topicStars[a] - s.topicStars[b])[0] || 'animals';
  const sug = state.materials.filter(m => m.topic === weak && !m.draft && ['worksheet', 'book'].includes(m.kind)).slice(0, 3);
  const unused = state.materials.filter(m => m.level === s.level && m.kind !== 'template' && !m.draft && !state.assignments.some(a => a.studentId === s.id && a.materialId === m.id)).slice(4, 7);
  const stepFrom = m => ({ kind: m.kind === 'book' ? 'book' : m.kind === 'game' ? 'game' : m.kind === 'practice' ? 'sethw' : m.kind === 'pictures' ? 'warmup' : 'material', mins: m.mins || 5, title: m.title, detail: `${KINDS[m.kind].label} · ${m.size}`, ref: m.id });
  const touch = () => { if (l.status === 'none') l.status = 'draft'; };

  const draw = () => {
    const total = l.plan.reduce((n, p) => n + p.mins, 0), done = l.status === 'done';
    el.innerHTML = `<div class="page planner">
      <a class="back" href="#/lessons">${icon('left')} Lessons</a>
      <header class="pl-head card pad"><div class="pl-who">${lessonStudents(l).map(x => avatar(x, 'lg')).join('')}<div><h1 class="title">${esc(lessonNames(l))}</h1><p>${DAYS[l.day]} ${dateOf(l.day)} · ${l.time} · ${l.mins}' ${l.weekly ? '· ↻ weekly' : ''}</p></div></div>
        <label class="pl-goal">Goal of this lesson<input class="input" data-goal value="${esc(l.goal)}" placeholder="One line: what should be better afterwards?"></label>
        <div class="pl-status">${done ? '<span class="st st-done">Taught</span>' : `<span class="seg"><button data-st="draft" class="${l.status !== 'ready' ? 'on' : ''}">Draft</button><button data-st="ready" class="${l.status === 'ready' ? 'on' : ''}">Ready</button></span>
          ${l.day === TODAY_IDX ? `<button class="btn primary" data-start>Start ▶</button>` : ''}`}</div></header>
      ${done ? `<section class="card pad"><h3>After the lesson</h3><label class="lbl">What went well? What next?<textarea class="input" rows="3" data-note placeholder="Two lines are enough.">${esc(l.note)}</textarea></label>
        <div class="btn-row"><button class="btn primary" data-savenote>Save note</button><button class="btn" data-obj>Make it the next lesson’s goal</button><button class="btn" data-rep>Add a line to the parents’ report</button></div></section>` : ''}
      <div class="pl-cols">
        ${done ? '' : `<aside class="card pad pl-sug"><h3>Suggestions for ${esc(s.name)}</h3>
          <p class="sug-h">Weakest: <b>${TOPICS[weak].label}</b> ${stars(s.topicStars[weak] || 0)}</p>
          ${sug.map(m => `<button class="sug" data-addm="${m.id}">${cover(m, 'xs')}<span><b>${esc(m.title)}</b><small>${KINDS[m.kind].label} · ${m.mins}'</small></span><i>+</i></button>`).join('')}
          <p class="sug-h">Trips over</p><p class="sug-words">${s.trips.slice(0, 3).map(t => `<span>${esc(t[0])}</span>`).join('')}</p>
          <button class="sug" data-addk="review"><span class="rk">↻</span><span><b>Review: 8 words are due</b><small>from earlier lessons · 4'</small></span><i>+</i></button>
          <p class="sug-h">Not used with ${esc(s.name)} yet</p>
          ${unused.map(m => `<button class="sug" data-addm="${m.id}">${cover(m, 'xs')}<span><b>${esc(m.title)}</b><small>${KINDS[m.kind].label} · ${TOPICS[m.topic].label}</small></span><i>+</i></button>`).join('')}
          <div class="btn-row"><button class="btn small" data-lib>Search library</button><button class="btn small" data-tpl>Templates</button></div></aside>`}
        <section class="card pad pl-plan"><div class="row-between"><h3>${done ? 'The plan, as taught' : 'Plan'}</h3><b class="${total > l.mins ? 'txt-bad' : ''}">${total} / ${l.mins}'</b></div>
          <div class="timebar ${total > l.mins ? 'over' : ''}">${l.plan.map(p => `<i class="k-${p.kind}" style="flex:${p.mins}" title="${esc(p.title)} · ${p.mins}'"></i>`).join('')}${total < l.mins ? `<i class="free" style="flex:${l.mins - total}"></i>` : ''}</div>
          ${l.plan.length ? `<ol class="plan">${l.plan.map((p, i) => `<li class="k-${p.kind}"><span class="rk">${done ? '✓' : STEP_KINDS[p.kind][1]}</span>
              <div class="plan-main"><small>${STEP_KINDS[p.kind][0]}</small><b>${esc(p.title)}</b><span class="mute">${esc(p.detail || '')}</span></div>
              ${done ? `<span class="mute">${p.mins}'</span>` : `<span class="mins"><button data-min="${i}" data-d="-1" aria-label="Shorter">−</button><b>${p.mins}'</b><button data-min="${i}" data-d="1" aria-label="Longer">+</button></span>
              <button class="iconbtn" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Up">${icon('up')}</button><button class="iconbtn" data-down="${i}" ${i < l.plan.length - 1 ? '' : 'disabled'} aria-label="Down">${icon('down')}</button><button class="iconbtn" data-del="${i}" aria-label="Remove">${icon('x')}</button>`}</li>`).join('')}</ol>`
            : `<div class="empty-box">No steps yet. Pick from the suggestions on the left, or let Krabsy make a first draft.<br><button class="btn primary" data-build>Build it for me</button></div>`}
          ${done ? '' : `<div class="addstep"><span class="mute">Add a step:</span>${Object.entries(STEP_KINDS).filter(([k]) => !['material', 'book', 'game'].includes(k)).map(([k, v]) => `<button class="chip-btn" data-addk="${k}">${v[1]} ${v[0]}</button>`).join('')}</div>
          <div class="btn-row pl-foot"><button class="btn" data-build>Build it for me</button><button class="btn" data-copylast>Copy from last lesson</button><button class="btn ghost" data-savetpl>Save as template</button></div>`}
        </section></div></div>`;
  };
  draw();
  const add = step => { l.plan.push(step); touch(); draw(); };
  on(el, 'input', '[data-goal]', (e, f) => { l.goal = f.value; });
  on(el, 'click', '[data-st]', (e, b) => { l.status = b.dataset.st; draw(); if (l.status === 'ready') toast('Marked ready. “Start ▶” turns this plan into the run sheet.'); });
  on(el, 'click', '[data-start]', () => startLive(l.id));
  on(el, 'click', '[data-addm]', (e, b) => add(stepFrom(material(b.dataset.addm))));
  on(el, 'click', '[data-addk]', (e, b) => { const k = b.dataset.addk; add({ kind: k, mins: k === 'break' ? 2 : 5, title: { warmup: 'Quick warm-up', homework: 'Look at the homework together', explain: 'Explain with examples', talk: 'Talk: ¿Cuál es tu animal favorito?', review: 'Review: 8 words that are due', sethw: 'New homework', break: 'Stretch and breathe' }[k], detail: '' }); });
  on(el, 'click', '[data-min]', (e, b) => { const p = l.plan[+b.dataset.min]; p.mins = Math.max(1, p.mins + +b.dataset.d); draw(); });
  on(el, 'click', '[data-up]', (e, b) => { const i = +b.dataset.up; [l.plan[i - 1], l.plan[i]] = [l.plan[i], l.plan[i - 1]]; draw(); });
  on(el, 'click', '[data-down]', (e, b) => { const i = +b.dataset.down; [l.plan[i + 1], l.plan[i]] = [l.plan[i], l.plan[i + 1]]; draw(); });
  on(el, 'click', '[data-del]', (e, b) => { l.plan.splice(+b.dataset.del, 1); draw(); });
  on(el, 'click', '[data-build]', () => { l.plan = lucasPlan(); if (l.mins < 50) l.plan = l.plan.slice(0, 4); touch(); draw(); toast('A first draft. Change what does not fit.'); });
  on(el, 'click', '[data-copylast]', () => { l.plan = lucasPlan().slice(0, 5); touch(); draw(); toast('Copied the plan of 18 Nov'); });
  on(el, 'click', '[data-savetpl]', () => toast('Saved as a lesson template in “Mine”'));
  on(el, 'click', '[data-lib]', () => pickMaterial({ onDone: m => add(stepFrom(m)) }));
  on(el, 'click', '[data-tpl]', () => pickMaterial({ title: 'Choose a lesson template', kinds: ['template'], onDone: m => { l.plan = lucasPlan(); touch(); draw(); toast(`Plan filled from “${esc(m.title)}”`); } }));
  on(el, 'click', '[data-savenote]', () => { l.note = $('[data-note]', el).value; lessonStudents(l).forEach(x => { x.noNote = false; if (l.note) x.notes.unshift({ date: dateOf(l.day), text: l.note }); }); toast('Note saved'); draw(); });
  on(el, 'click', '[data-obj]', () => toast('It will sit on top of the next lesson’s plan'));
  on(el, 'click', '[data-rep]', () => toast('Added to the parents’ report'));
}
