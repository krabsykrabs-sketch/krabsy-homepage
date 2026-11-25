// Live classroom: the plan becomes the run sheet; the middle shows what the student sees.
import { state, lesson, lessonStudents, lessonNames, TODAY_IDX, STEP_KINDS, farmSteps, cardsOnly, lucasPlan, dateOf, material, KINDS } from '../data.js';
import { esc, on, $, avatar, toast, go, modal, pickMaterial, icon, levelChip } from '../ui.js';
import { mountPlayer } from '../student/player.js';
import { mountBook } from '../student/book.js';

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const elapsed = () => { const L = state.live; if (!L) return 0; return ((L.paused ? L.pausedAt : Date.now()) - L.startedAt) / 1000; };
export const liveClock = () => fmt(elapsed());

export function startLive(id) {
  const l = lesson(id);
  if (state.live && state.live.lessonId !== id) return toast('Another lesson is live. End it first.');
  if (!l.plan.length) { l.plan = lucasPlan().slice(0, 5); toast('No plan yet, so Krabsy made a first draft.'); }
  if (!state.live) state.live = { lessonId: id, startedAt: Date.now(), step: 0, stepAt: Date.now(), stars: 0, note: '', done: new Set(), results: {} };
  l.status = 'ready';
  go('#/live/' + id);
}

export function renderLive(el, id) {
  if (!id && state.live) return go('#/live/' + state.live.lessonId);
  if (!state.live || state.live.lessonId !== id) {
    const todays = state.lessons.filter(l => l.day === TODAY_IDX && l.status !== 'done');
    el.innerHTML = `<div class="page narrow"><h1 class="title">Live</h1><p class="lead">No lesson is running. Start one, and its plan becomes your run sheet. Krabsy is the second screen next to Zoom or Meet.</p>
      <ul class="card les-list">${todays.map(l => `<li><time>${l.time}</time><div class="les-who">${lessonStudents(l).map(s => `${avatar(s, 'sm')}<b>${esc(s.name)}</b>${levelChip(s)}`).join('')}</div><span class="les-goal">${l.plan.length ? `${l.plan.length} steps` : 'no plan yet'}</span><span class="les-act"><button class="btn primary" data-start="${l.id}">Start ▶</button></span></li>`).join('')}</ul></div>`;
    on(el, 'click', '[data-start]', (e, b) => startLive(+b.dataset.start));
    return;
  }
  const L = state.live, l = lesson(id), ss = lessonStudents(l), s = ss[0];
  let api = null, kind = '', bookWho = 'student', last = null;

  el.innerHTML = `<div class="live">
    <header class="live-top"><span class="live-badge"><span class="pulse"></span>LIVE</span><b>${esc(lessonNames(l))}</b><span class="live-clock"><b data-clock>00:00</b> / ${l.mins}:00</span>
      <span class="online"><i></i>${esc(s.name)} is online</span><span class="grow"></span>
      <button class="btn" data-pause>Pause</button><button class="btn primary" data-end>End lesson</button></header>
    <div class="live-cols">
      <aside class="card live-run"><h3>Run sheet</h3><ol data-run></ol>
        <div class="run-nav"><button class="btn" data-prev>${icon('left')} Back</button><button class="btn primary" data-next>Next ${icon('right')}</button></div>
        <button class="link" data-lib>+ Something from the library</button></aside>
      <section class="live-mid">
        <div class="live-mid-h"><h3>${esc(s.name)} sees</h3><span class="seg"><button data-fr="phone" class="on">Phone</button><button data-fr="tablet">Tablet</button></span></div>
        <div class="frame phone" data-frame><div class="frame-screen"><div class="lm-bar"><span class="lm-dots" data-dots></span><span class="lm-stars">⭐ <b data-lstars>0</b></span></div><div class="lm-stage" data-stage></div></div></div>
        <div class="live-ctl" data-ctl></div>
        <p class="proto-note">Prototype: you play ${esc(s.name)}’s part in this frame. In the real lesson it mirrors what ${esc(s.name)} does on their own device.</p>
      </section>
      <aside class="live-side">
        ${ss.map((x, i) => `<div class="card pad"><div class="ls-h">${avatar(x)}<div><b>${esc(x.name)}</b><br><span class="mute" data-now${i}>${i ? 'watching' : ''}</span></div></div>
          ${i ? '' : `<p class="ls-score" data-score>—</p><ul class="ls-log" data-log><li class="mute">Answers appear here.</li></ul>`}
          <div class="btn-row"><button class="btn" data-star>⭐ Star</button><button class="btn" data-gift="🎈">🎈</button><button class="btn" data-gift="🍦">🍦</button><button class="btn" data-gift="🏆">🏆</button></div></div>`).join('')}
        <div class="card pad"><h3>Notes while teaching</h3><textarea class="input" rows="4" data-lnote placeholder="e.g. start next time with “estoy”">${esc(L.note)}</textarea>
          <p class="mute small">Last time: “${esc(s.notes[0] ? s.notes[0].text : '')}”</p></div>
      </aside>
    </div></div>`;

  const runSheet = () => {
    $('[data-run]', el).innerHTML = l.plan.map((p, i) => `<li class="${i === L.step ? 'now' : L.done.has(i) ? 'done' : ''}" data-step="${i}"><span class="rk">${L.done.has(i) && i !== L.step ? '✓' : i === L.step ? '▶' : STEP_KINDS[p.kind][1]}</span>
      <div><small>${STEP_KINDS[p.kind][0]}</small><b>${esc(p.title)}</b>${L.results[i] ? `<span class="res">${esc(L.results[i])}</span>` : ''}</div><span class="rt" ${i === L.step ? 'data-steptime' : ''}>${p.mins}'</span></li>`).join('');
    $('[data-dots]', el).innerHTML = l.plan.map((p, i) => `<i class="${i < L.step ? 'on' : i === L.step ? 'now' : ''}"></i>`).join('');
    $('[data-prev]', el).disabled = L.step === 0; $('[data-next]', el).innerHTML = L.step === l.plan.length - 1 ? 'Finish' : `Next ${icon('right')}`;
  };
  const panel = st => {
    last = st;
    $('[data-now0]', el).textContent = st.label || `${st.title}${st.item && !['pairs', 'cards'].includes(st.item) ? ' · ' + st.item : ''}`;
    if (st.total !== undefined) { $('[data-score]', el).innerHTML = st.total ? `<b>${st.first} of ${st.total}</b> right at first try` : 'no answers yet'; L.results[L.step] = st.total ? `${st.first} of ${st.total} at first try` : '';
      $('[data-log]', el).innerHTML = st.log.slice(-6).reverse().map(x => `<li class="${x.ok ? 'ok' : 'no'}"><span>${x.ok ? '✓' : x.shown ? '→' : '✗'}</span>${esc(x.text || '')}${x.ok && !x.first ? ' <em>second try</em>' : ''}</li>`).join('') || '<li class="mute">Answers appear here.</li>'; }
    else if (st.word || st.answered) { const lg = $('[data-log]', el); if (lg.querySelector('.mute')) lg.innerHTML = ''; lg.insertAdjacentHTML('afterbegin', `<li class="${st.answered && st.answered.includes('✗') ? 'no' : 'ok'}"><span>${st.word ? '👆' : ''}</span>${esc(st.word ? 'tapped “' + st.word + '”' : st.answered)}</li>`); }
    $('[data-lstars]', el).textContent = L.stars + (st.stars || 0);
  };
  const wait = (pic, h, p) => `<div class="me-wait in-live"><span class="pic">${pic}</span><h2>${h}</h2><p>${p}</p></div>`;
  const controls = () => {
    $('[data-ctl]', el).innerHTML = kind === 'player' ? `<button class="btn" data-c="hint">💡 Give a hint</button><button class="btn" data-c="reveal">Show the answer</button><button class="btn" data-c="skip">Skip</button><button class="btn" data-c="point">◎ Point</button>`
      : kind === 'book' ? `<span class="seg"><button data-who="student" class="${bookWho === 'student' ? 'on' : ''}">${esc(s.name)} turns the pages</button><button data-who="tutor" class="${bookWho === 'tutor' ? 'on' : ''}">I turn the pages</button></span>
        <button class="btn" data-c="prev" ${bookWho === 'tutor' ? '' : 'disabled'}>◀</button><button class="btn" data-c="next" ${bookWho === 'tutor' ? '' : 'disabled'}>▶</button><button class="btn" data-c="point">◎ Point at a word</button>`
      : '<span class="mute">Nothing to steer in this step. Talk, then press “Next”.</span>';
  };
  function mountStep() {
    const p = l.plan[L.step], stage = $('[data-stage]', el); if (api && api.destroy) api.destroy(); api = null; kind = '';
    $('[data-log]', el).innerHTML = '<li class="mute">Answers appear here.</li>'; $('[data-score]', el).textContent = '—'; $('[data-now0]', el).textContent = STEP_KINDS[p.kind][0];
    stage.innerHTML = wait('🦀', 'Nora is getting the next thing ready', 'Stay here. It opens by itself.');
    runSheet(); controls();
    setTimeout(() => {
      if (!stage.isConnected || l.plan[L.step] !== p) return;
      const m = p.ref && material(p.ref);
      if (p.kind === 'book' || (m && m.kind === 'book')) { kind = 'book'; api = mountBook(stage, { onState: panel, locked: bookWho === 'tutor' }); }
      else if (m && ['worksheet', 'pictures', 'practice'].includes(m.kind)) { kind = 'player'; api = mountPlayer(stage, m.kind === 'pictures' ? cardsOnly() : farmSteps(), { onState: panel }); }
      else stage.innerHTML = p.kind === 'homework' ? wait('📋', 'Your homework', 'estar · 31 of 40 right at first try. ¡Muy bien!')
        : p.kind === 'game' ? wait('🥚', esc(p.title), 'The game opens here, full screen.')
        : p.kind === 'sethw' ? wait('🏠', 'New homework', `${esc(p.title)} · ${esc(p.detail || 'for next time')}`)
        : p.kind === 'break' ? wait('🧘', 'Short break', 'Stand up and stretch!')
        : wait('👂', 'Listen to Nora', 'Eyes on the video call.');
      controls();
    }, 900);
  }
  const goto = i => { if (i < 0) return; L.done.add(L.step); if (last && last.stars) L.stars += last.stars; last = null; if (i >= l.plan.length) return end(); L.step = i; L.stepAt = Date.now(); mountStep(); };

  function end() {
    modal({ title: `Lesson with ${lessonNames(l)} finished`, body: `<p class="mute">${fmt(elapsed())} · ${L.done.size} of ${l.plan.length} steps · ⭐ ${L.stars} stars</p>
        <ul class="end-steps">${l.plan.map((p, i) => `<li class="${L.done.has(i) ? 'ok' : ''}">${L.done.has(i) ? '✓' : '○'} ${STEP_KINDS[p.kind][0]}: ${esc(p.title)} ${L.results[i] ? `<b>${esc(L.results[i])}</b>` : ''}</li>`).join('')}</ul>
        <label class="lbl">What went well? What next?<textarea class="input" rows="3" data-endnote>${esc(L.note)}</textarea></label>
        <label class="check"><input type="checkbox" checked> Put this on top of the next lesson’s plan</label><label class="check"><input type="checkbox"> Add a line to the parents’ report</label>`,
      actions: [{ label: 'Keep teaching' }, { label: 'Save and close', primary: true, onClick: w => { l.note = $('[data-endnote]', w).value; l.status = 'done'; if (l.note) ss.forEach(x => x.notes.unshift({ date: dateOf(l.day), text: l.note }));
        state.recent.unshift({ who: s.name, text: 'had a lesson with you', score: `⭐ ${L.stars}`, when: 'just now' }); state.live = null; toast('Lesson saved. The plan is now the record.'); go(`#/students/${s.id}/lessons`); } }] });
  }

  mountStep();
  const tick = setInterval(() => {
    if (!el.isConnected) return clearInterval(tick);
    $('[data-clock]', el).textContent = liveClock();
    const st = $('[data-steptime]', el); if (st && !L.paused) { const sec = (Date.now() - L.stepAt) / 1000, p = l.plan[L.step]; st.textContent = `${fmt(sec)} / ${p.mins}'`; st.classList.toggle('txt-bad', sec > p.mins * 60); }
  }, 1000);

  on(el, 'click', '[data-step]', (e, li) => { const i = +li.dataset.step; if (i !== L.step) goto(i); });
  on(el, 'click', '[data-next]', () => goto(L.step + 1));
  on(el, 'click', '[data-prev]', () => { if (L.step > 0) { L.step--; L.stepAt = Date.now(); mountStep(); } });
  on(el, 'click', '[data-end]', end);
  on(el, 'click', '[data-pause]', (e, b) => { if (L.paused) { L.startedAt += Date.now() - L.pausedAt; L.paused = false; b.textContent = 'Pause'; } else { L.paused = true; L.pausedAt = Date.now(); b.textContent = 'Go on'; } });
  on(el, 'click', '[data-fr]', (e, b) => { $('[data-frame]', el).className = 'frame ' + b.dataset.fr; el.querySelectorAll('[data-fr]').forEach(x => x.classList.toggle('on', x === b)); });
  on(el, 'click', '[data-c]', (e, b) => { const c = b.dataset.c; if (!api) return; if (c === 'skip' && kind === 'player') api.skip(); else if (api[c]) api[c](); if (c === 'point') toast(`${esc(s.name)} sees a ring around it`); });
  on(el, 'click', '[data-who]', (e, b) => { bookWho = b.dataset.who; api && api.lock && api.lock(bookWho === 'tutor'); controls(); });
  on(el, 'click', '[data-star]', () => { L.stars++; if (kind === 'player' && api) { api.star(); L.stars--; } else $('[data-lstars]', el).textContent = L.stars; toast(`⭐ for ${esc(s.name)}`); });
  on(el, 'click', '[data-gift]', (e, b) => { if (kind === 'player' && api) api.gift(b.dataset.gift); toast(`${b.dataset.gift} sent`); });
  on(el, 'input', '[data-lnote]', (e, f) => { L.note = f.value; });
  on(el, 'click', '[data-lib]', () => pickMaterial({ onDone: m => { l.plan.splice(L.step + 1, 0, { kind: m.kind === 'book' ? 'book' : m.kind === 'game' ? 'game' : 'material', mins: m.mins || 5, title: m.title, detail: KINDS[m.kind].label, ref: m.id }); runSheet(); toast('Added after the current step'); } }));
}
