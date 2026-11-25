// Today: what do I have to do today, and who needs me?
import { state, TODAY_IDX, attention, lessonStudents, lessonNames, student } from '../data.js';
import { esc, on, avatar, levelChip, toast, go, pickMaterial, pickStudents, assignTo } from '../ui.js';
import { startLive } from './live.js';

export function renderToday(el) {
  const draw = () => {
    const todays = state.lessons.filter(l => l.day === TODAY_IDX);
    const att = state.students.map(s => [s, attention(s)]).filter(x => x[1]);
    const noPlan = state.lessons.filter(l => l.day === TODAY_IDX && l.status === 'none' && !l.dismissed);
    const act = state.students.filter(s => !s.archived);
    const dueToday = act.filter(s => s.hw && s.hw.status === 'open' && s.hw.due === 0).length;
    const overdue = act.filter(s => s.hw && s.hw.status === 'late').length;
    const unrev = act.filter(s => s.hw && s.hw.status === 'done').length;
    const first = todays.find(l => l.status !== 'done');
    el.innerHTML = `<div class="page">
      <div class="page-head"><div><p class="eyebrow">Wednesday 25 November · 14:35 in Montevideo</p><h1 class="title">Good afternoon, Nora</h1>
        <p class="lead">${todays.length} lessons today. ${first ? `${esc(lessonNames(first))} is first, in 25 minutes.` : ''} ${att.length + noPlan.length} things need you.</p></div>
        <div class="quick"><button class="btn" data-q="hw">Give homework</button><button class="btn" data-q="lesson">Plan a lesson</button><a class="btn" href="#/library">Open library</a></div></div>

      <div class="grid-today">
        <section class="card">
          <header class="card-h"><h2>Today’s lessons</h2><a href="#/lessons">Whole week</a></header>
          <ul class="tl">${todays.map(l => {
            const ss = lessonStudents(l);
            return `<li class="tl-row ${l.status === 'done' ? 'past' : ''}"><time>${l.time}</time>
              <div class="tl-main"><div class="tl-who">${ss.map(s => `<a href="#/students/${s.id}/overview">${avatar(s, 'sm')}<b>${esc(s.name)}</b></a>${levelChip(s)}`).join('')}<span class="mute">${l.mins}'</span></div>
                <div class="tl-plan">${l.status === 'ready' ? `<span class="st st-ready">Plan ready</span> ${esc(l.goal)} · ${l.plan.length} steps`
                  : l.status === 'draft' ? `<span class="st st-draft">Draft</span> ${l.plan.length} steps so far`
                  : l.status === 'done' ? '<span class="st st-done">Done</span>' : '<span class="st st-none">No plan yet</span>'}</div></div>
              <div class="tl-act">${l.status === 'ready' ? `<a class="btn ghost" href="#/lessons/${l.id}">Plan</a><button class="btn primary" data-start="${l.id}">Start ▶</button>`
                : l.status === 'done' ? `<a class="btn ghost" href="#/lessons/${l.id}">Open</a>` : `<a class="btn" href="#/lessons/${l.id}">Plan lesson</a>`}</div></li>`; }).join('')}</ul>
        </section>

        <section class="card">
          <header class="card-h"><h2>Needs attention <span class="count">${att.length + noPlan.length}</span></h2><a href="#/students?filter=attention">In the list</a></header>
          <ul class="att">${att.map(([s, a]) => `<li><span class="att-ic ${a.tone}">${a.icon}</span>
              <div><a href="#/students/${s.id}/${a.tab}"><b>${esc(s.name)}</b></a> <span>${esc(a.reason)}</span></div>
              <a class="btn small" href="#/students/${s.id}/${a.tab}">${esc(a.action)}</a><button class="iconbtn" data-dismiss="${s.id}" title="Hide for 7 days" aria-label="Hide for 7 days">✕</button></li>`).join('')}
            ${noPlan.map(l => `<li><span class="att-ic info">▤</span><div><b>${esc(lessonNames(l))}</b> <span>lesson ${l.day === TODAY_IDX ? 'today' : 'tomorrow'} ${l.time} has no plan</span></div>
              <a class="btn small" href="#/lessons/${l.id}">Plan lesson</a><button class="iconbtn" data-dismiss-l="${l.id}" aria-label="Hide">✕</button></li>`).join('')}
            ${att.length + noPlan.length ? '' : '<li class="empty">Nothing needs you right now. 🌿</li>'}</ul>
        </section>

        <section class="card">
          <header class="card-h"><h2>Since you last looked</h2><span class="mute">yesterday 17:30</span></header>
          <ul class="feed">${state.recent.map(r => { const s = state.students.find(x => x.name === r.who); return `<li><a href="#/students/${s.id}/materials">${avatar(s, 'sm')}</a><div><a href="#/students/${s.id}/materials"><b>${esc(r.who)}</b></a> ${esc(r.text)}${r.score ? ` · <b>${esc(r.score)}</b>` : ''}<br><span class="mute">${esc(r.when)}</span></div></li>`; }).join('')}</ul>
        </section>

        <section class="card">
          <header class="card-h"><h2>Homework</h2><a href="#/students?sort=homework">All homework</a></header>
          <div class="tiles">
            <a class="tile" href="#/students?filter=duetoday"><b>${dueToday}</b><span>due today</span></a>
            <a class="tile bad" href="#/students?filter=overdue"><b>${overdue}</b><span>overdue</span></a>
            <a class="tile good" href="#/students?filter=done"><b>${unrev}</b><span>done, not looked at</span></a>
          </div>
          <p class="mute pad-t">Tomorrow: ${act.filter(s => s.hw && s.hw.status === 'open' && s.hw.due === 1).map(s => esc(s.name)).join(', ')} have homework due.</p>
        </section>
      </div></div>`;
  };
  draw();
  on(el, 'click', '[data-dismiss]', (e, b) => { student(b.dataset.dismiss).dismissed = true; toast('Hidden for 7 days'); draw(); });
  on(el, 'click', '[data-dismiss-l]', (e, b) => { state.lessons.find(l => l.id === +b.dataset.dismissL).dismissed = true; draw(); });
  on(el, 'click', '[data-start]', (e, b) => startLive(+b.dataset.start));
  on(el, 'click', '[data-q]', (e, b) => {
    if (b.dataset.q === 'lesson') return go('#/lessons');
    pickMaterial({ title: 'Give homework: choose material', kinds: ['practice', 'worksheet', 'book'], onDone: m => pickStudents({ title: `Who gets “${m.title}”?`, onDone: ids => { assignTo(ids, m); draw(); } }) });
  });
}
