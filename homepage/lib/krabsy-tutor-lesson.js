/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — tutor lesson tools (docs/tutor-platform.md, 2026-11-25)

   Used by krabsy-tutor.js on two pages:
     tutor's student profile  lesson plan (lesson builder) · worksheets (make,
                              preview, send, results) · live lesson panel
     student's page /me/      worksheets from the tutor · the worksheet itself
                              (#w=<id>) · live: the tutor's worksheet opens by
                              itself, stars and gifts arrive while the page is open

   Worksheets are interactive: the student types (or picks) each answer, sees
   right/wrong and the teach line at once. The first try counts: it is saved
   on the worksheet for the tutor and recorded like any game answer
   (recordAttempt, mode 'typed' or 'choice'), so typed answers count towards
   ★★★★ in the star map.
   Live = polling (tutor 2 s, student 2.5 s), no extra server parts.
   ────────────────────────────────────────────────────────────────────────── */

const T = {
  wsH: 'Worksheets', wsLead: 'Interactive: the student types or picks each answer and sees at once if it’s right. The first try counts for the star map.',
  wsMake: 'Make a worksheet', wsTopic: 'Topic', wsCount: 'Questions', wsMode: 'Answers',
  modes: [['typed', 'Type the answer'], ['choice', 'Choose'], ['mixed', 'Mixed']],
  wsFocus: (n) => `Start with what ${n || 'the student'} still gets wrong`, wsTitle: 'Title', wsPreview: 'Make it', wsSend: 'Save worksheet',
  wsSwap: 'Swap', wsRemove: 'Remove', wsNone: 'No worksheets yet.', wsDone: (d, n, r) => (d ? `${d} of ${n} done · ${r} right` : `${n} questions · not started`),
  wsResults: 'Results', wsLive: 'Show live', wsDel: 'Delete', wsDelQ: 'Delete this worksheet and its results?',
  wsCancel: 'Cancel', wsNotAnswered: 'not answered yet',
  liveH: (n) => `Live with ${n}`, liveLead: (n) => `${n} sees this worksheet now on their page (their personal link must be open). Answers appear here as they come in.`,
  liveStar: 'Send a star ⭐', liveGift: 'Send a gift 🎁', liveStop: 'End live', liveSent: 'Sent ✓', liveWaiting: 'waiting …',
  planH: 'Lesson plan', planLead: 'A plan for the next lesson from the star map: weakest topic first. Change, remove or tick off blocks.',
  planMake: 'Plan a lesson', planMinutes: 'minutes', planNew: 'New plan', planSaveNote: 'Save as lesson note', planSaved: 'Saved as a lesson note ✓',
  planClear: 'Remove plan', planNoTopics: 'No topics yet.',
  blocks: {
    warmup: 'Warm-up', review: 'Check the homework', teach: 'Explain', worksheet: 'Worksheet', game: 'Game', homework: 'Homework',
  },
  blockHelp: {
    warmup: 'Quick practice on something that already sits, to start with a win.',
    review: 'Look at the homework results together.',
    teach: 'Explain the pattern with the examples on the topic page.',
    worksheet: 'Show a worksheet live and watch the answers come in.',
    game: 'The student picks a game on the topic; you watch or play along.',
    homework: 'Give the topic as homework with a goal.',
  },
  open: 'Open ↗', makeLive: 'Make worksheet & show live', give: 'Give homework', given: 'Given ✓',
  noteLine: (b, done) => `${done ? '✓' : '–'} ${b}`,
  // student side
  meWsH: (t) => `Worksheets from ${t}`, meWsOpen: 'Open', meWsBack: '← Back', meCheck: 'Check', meRight: 'Right!', meWrong: (a) => `Not quite. Right: ${a}`,
  meScore: (r, n) => `${r} of ${n} right`, meAllDone: 'All done! 🎉', meLive: (t) => `${t} started a worksheet with you`,
  meStar: (t) => `${t} sent you a star!`, meGift: (t) => `${t} sent you a gift!`, mePick: 'Pick one:',
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);

/* ── questions from the engine ─────────────────────────────────────────── */
async function makeQuestions(topic, count, focus) {
  const KQ = await import('/lib/krabsy-questions.js');
  const base = { topic, withOptions: 3, lang: 'en' };
  let first = [];
  if (focus && focus.length) { try { first = await KQ.getQuizSet({ ...base, count, ids: focus }); } catch (_) { first = []; } }
  const pool = await KQ.getQuizSet({ ...base, count: count * 2 });
  const seen = new Set(first.map((q) => q.id));
  const all = [...first, ...pool.filter((q) => !seen.has(q.id))];
  return all.map((q) => ({
    item: q.item, form: q.form || 'default',
    sentence: q.display && q.display.kind === 'gap' ? (q.display.plain || q.display.sentence) : (q.display && q.display.sentence) || '',
    hint: (q.display && q.display.hint) || '',
    answer: q.answer, accepts: (q.accepts || [q.answer]).slice(0, 8), options: (q.options || []).slice(0, 6),
    teach: (q.teach && q.teach.line) || '',
  })).filter((q) => q.sentence && q.answer);
}

function sentenceHtml(q, slot) {
  const parts = esc(q.sentence).split('___');
  return parts.length > 1 ? parts.join(slot) : `${esc(q.sentence)} ${slot}`;
}

/* ══ tutor side ═══════════════════════════════════════════════════════════ */

/** HTML for the student profile (plan + worksheets + live). */
export function tutorTopHtml(ctx) {
  return `
    <section class="kc-card kt-live" id="kt-live" hidden></section>
    <section class="kc-card" id="kt-plan">${planHtml(ctx)}</section>`;
}

export function tutorHtml(ctx) {
  const { d, cat, topicName } = ctx;
  const ws = d.worksheets || [];
  return `
    <section class="kc-card" id="kt-ws">
      <h2>${T.wsH}</h2>
      <p class="kc-muted">${T.wsLead}</p>
      ${ws.length ? `<ul class="kt-hw">${ws.map((w) => `<li>
        <span><strong>${esc(w.title || topicName(cat, w.topic))}</strong><br><span class="kc-muted">${esc(topicName(cat, w.topic))} · ${esc((T.modes.find((m) => m[0] === w.mode) || ['', ''])[1])}</span></span>
        <span class="kc-muted">${T.wsDone(w.done, w.count, w.right)}</span>
        <span class="kc-row"><button type="button" class="kc-btn kc-btn-ghost kt-sm" data-wslive="${w.id}">${T.wsLive}</button>
          <button type="button" class="kc-link" data-wsres="${w.id}">${T.wsResults}</button>
          <button type="button" class="kc-link" data-wsdel="${w.id}">${T.wsDel}</button></span>
        <div class="kt-wsres" id="kt-wsres-${w.id}" hidden></div></li>`).join('')}</ul>` : `<p class="kc-muted">${T.wsNone}</p>`}
      <button type="button" class="kc-btn kc-btn-ghost" id="kt-wsnew">+ ${T.wsMake}</button>
      <div id="kt-wsmaker" hidden></div>
    </section>`;
}

function resultsHtml(w) {
  return `<ol class="kt-wsresults">${w.questions.map((q, i) => {
    const a = w.answers[String(i)];
    return `<li class="${a ? (a.correct ? 'is-right' : 'is-wrong') : ''}">${sentenceHtml(q, `<b>${esc(q.answer)}</b>`)}
      <span class="kc-muted"> · ${a ? `${a.correct ? '✓' : '✗'} “${esc(a.given)}”` : T.wsNotAnswered}</span></li>`;
  }).join('')}</ol>`;
}

/** Wire the profile sections. ctx: { d, cat, sid, api, post, reload, topicName, linkFor, name } */
export function tutorWire(main, ctx) {
  const { d, cat, post, reload, topicName } = ctx;
  wirePlan(main, ctx);
  // results
  main.querySelectorAll('[data-wsres]').forEach((b) => b.addEventListener('click', async () => {
    const box = $(`#kt-wsres-${b.dataset.wsres}`);
    if (!box.hidden) { box.hidden = true; return; }
    const r = await ctx.api(`/api/tutor/student/worksheet?id=${ctx.sid}&worksheet_id=${b.dataset.wsres}`);
    box.innerHTML = resultsHtml(r.worksheet); box.hidden = false;
  }));
  main.querySelectorAll('[data-wsdel]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(T.wsDelQ)) return;
    await post('/api/tutor/student/worksheet-delete', { worksheet_id: Number(b.dataset.wsdel) }); reload();
  }));
  main.querySelectorAll('[data-wslive]').forEach((b) => b.addEventListener('click', async () => {
    await post('/api/tutor/student/live', { worksheet_id: Number(b.dataset.wslive) });
    startLivePanel(main, ctx, Number(b.dataset.wslive));
  }));
  // maker
  $('#kt-wsnew').addEventListener('click', () => openMaker(main, ctx));
  if (d.live && d.live.worksheet_id) startLivePanel(main, ctx, d.live.worksheet_id);
}

function openMaker(main, ctx, preset = {}) {
  const { d, cat, topicName } = ctx;
  const box = $('#kt-wsmaker');
  $('#kt-wsnew').hidden = true;
  box.hidden = false;
  const topic = preset.topic || cat.ids[0];
  box.innerHTML = `<form class="kt-hwform" id="kt-wsform">
      <label class="kc-field"><span>${T.wsTopic}</span><select id="kt-wstopic">${cat.ids.map((tp) => `<option value="${esc(tp)}"${tp === topic ? ' selected' : ''}>${esc(topicName(cat, tp))}</option>`).join('')}</select></label>
      <label class="kc-field"><span>${T.wsCount}</span><select id="kt-wscount">${[6, 10, 15].map((n) => `<option${n === 10 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="kc-field"><span>${T.wsMode}</span><select id="kt-wsmode">${T.modes.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label class="kt-check kt-wide"><input type="checkbox" id="kt-wsfocus" checked> <span>${esc(T.wsFocus(ctx.name))}</span></label>
      <p class="kc-row"><button class="kc-btn" type="submit">${T.wsPreview}</button><button class="kc-btn kc-btn-ghost" type="button" id="kt-wscancel">${T.wsCancel}</button></p>
    </form><div id="kt-wsprev"></div>`;
  $('#kt-wscancel').addEventListener('click', () => { box.hidden = true; box.innerHTML = ''; $('#kt-wsnew').hidden = false; });
  $('#kt-wsform').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const tp = $('#kt-wstopic').value, n = Number($('#kt-wscount').value), mode = $('#kt-wsmode').value;
    const focus = $('#kt-wsfocus').checked ? ((d.topics[tp] || {}).practise || []) : [];
    const all = await makeQuestions(tp, n, focus);
    preview(main, ctx, { topic: tp, mode, list: all.slice(0, n), spare: all.slice(n), live: preset.live, onSaved: preset.onSaved });
  });
  if (preset.auto) $('#kt-wsform').requestSubmit();
}

function preview(main, ctx, st) {
  const { cat, topicName } = ctx;
  const box = $('#kt-wsprev');
  const title = `${topicName(cat, st.topic)} · ${new Date().toLocaleDateString('en', { day: 'numeric', month: 'short' })}`;
  const render = () => {
    box.innerHTML = `<label class="kc-field kt-wide"><span>${T.wsTitle}</span><input id="kt-wstitle" maxlength="80" value="${esc(st.title || title)}"></label>
      <ol class="kt-wsprev">${st.list.map((q, i) => `<li><span>${sentenceHtml(q, `<b>${esc(q.answer)}</b>`)}${q.hint ? ` <span class="kc-muted">(${esc(q.hint)})</span>` : ''}</span>
        <span class="kc-row">${st.spare.length ? `<button type="button" class="kc-link" data-swap="${i}">${T.wsSwap}</button>` : ''}
        <button type="button" class="kc-link" data-rm="${i}">${T.wsRemove}</button></span></li>`).join('')}</ol>
      <p class="kc-row"><button type="button" class="kc-btn" id="kt-wssave">${st.live ? T.makeLive : T.wsSend}</button></p>`;
    box.querySelectorAll('[data-swap]').forEach((b) => b.addEventListener('click', () => {
      st.title = $('#kt-wstitle').value; st.list[Number(b.dataset.swap)] = st.spare.shift(); render();
    }));
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
      st.title = $('#kt-wstitle').value; st.list.splice(Number(b.dataset.rm), 1); render();
    }));
    $('#kt-wssave').addEventListener('click', async () => {
      if (!st.list.length) return;
      const r = await ctx.post('/api/tutor/student/worksheet', { topic: st.topic, mode: st.mode, title: $('#kt-wstitle').value, questions: st.list });
      if (st.live) await ctx.post('/api/tutor/student/live', { worksheet_id: r.worksheet_id });
      if (st.onSaved) st.onSaved(r.worksheet_id);
      ctx.reload();
    });
  };
  render();
}

/* live panel on the tutor's side */
let liveTimer = null;
function startLivePanel(main, ctx, wid) {
  const box = $('#kt-live');
  if (!box) return;
  clearInterval(liveTimer);
  box.hidden = false;
  box.innerHTML = `<div class="kc-head"><h2>🔴 ${esc(T.liveH(ctx.name))}</h2>
      <p class="kc-row"><button type="button" class="kc-btn kc-btn-ghost" data-reward="star">${T.liveStar}</button>
      <button type="button" class="kc-btn kc-btn-ghost" data-reward="gift">${T.liveGift}</button>
      <button type="button" class="kc-btn kc-btn-danger" id="kt-livestop">${T.liveStop}</button></p></div>
    <p class="kc-muted">${esc(T.liveLead(ctx.name))}</p><div id="kt-liveres">${T.liveWaiting}</div>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const tick = async () => {
    if (!document.body.contains(box)) { clearInterval(liveTimer); return; }
    try {
      const r = await ctx.api(`/api/tutor/student/worksheet?id=${ctx.sid}&worksheet_id=${wid}`);
      const w = r.worksheet;
      $('#kt-liveres').innerHTML = `<p><strong>${esc(w.title)}</strong> · ${T.wsDone(w.done, w.count, w.right)}</p>${resultsHtml(w)}`;
    } catch (_) {}
  };
  tick(); liveTimer = setInterval(tick, 2000);
  box.querySelectorAll('[data-reward]').forEach((b) => b.addEventListener('click', async () => {
    await ctx.post('/api/tutor/student/reward', { kind: b.dataset.reward });
    const old = b.textContent; b.textContent = T.liveSent; setTimeout(() => { b.textContent = old; }, 1500);
  }));
  $('#kt-livestop').addEventListener('click', async () => {
    clearInterval(liveTimer);
    await ctx.post('/api/tutor/student/live', { worksheet_id: null });
    ctx.reload();
  });
}

/* ── lesson builder ─────────────────────────────────────────────────────── */
function suggestPlan(ctx, minutes) {
  const { d, cat } = ctx;
  const info = (tp) => d.topics[tp] || { stars: 0, answers: 0, practise: [] };
  // focus: lowest stars among topics already started (or the next new one in order)
  const started = cat.ids.filter((tp) => info(tp).answers > 0 || info(tp).set != null);
  const weak = [...started].sort((a, b) => info(a).stars - info(b).stars).find((tp) => info(tp).stars < 4)
    || cat.ids.find((tp) => !started.includes(tp)) || cat.ids[0];
  const solid = [...started].sort((a, b) => info(b).stars - info(a).stars).find((tp) => tp !== weak) || weak;
  const hw = (d.homework || [])[0];
  const share = { warmup: 0.1, review: hw ? 0.1 : 0, teach: 0.2, worksheet: 0.3, game: 0.2, homework: 0.1 };
  const total = Object.values(share).reduce((a, b) => a + b, 0);
  const mins = (k) => Math.max(3, Math.round((minutes * share[k]) / total));
  const blocks = [
    { kind: 'warmup', topic: solid, minutes: mins('warmup') },
    ...(hw ? [{ kind: 'review', topic: hw.topic, minutes: mins('review') }] : []),
    { kind: 'teach', topic: weak, minutes: mins('teach') },
    { kind: 'worksheet', topic: weak, minutes: mins('worksheet') },
    { kind: 'game', topic: weak, minutes: mins('game') },
    { kind: 'homework', topic: weak, minutes: mins('homework') },
  ];
  return { minutes, day: today(), blocks: blocks.map((b) => ({ ...b, done: false })) };
}

function planHtml(ctx) {
  const { d, cat, topicName } = ctx;
  let plan = null;
  try { plan = d.plan ? JSON.parse(d.plan) : null; } catch (_) { plan = null; }
  ctx.plan = plan;
  if (!plan) {
    return `<h2>${T.planH}</h2><p class="kc-muted">${T.planLead}</p>
      <p class="kc-row"><select id="kt-planmin">${[30, 45, 50, 60, 90].map((m) => `<option value="${m}"${m === 50 ? ' selected' : ''}>${m} ${T.planMinutes}</option>`).join('')}</select>
      <button type="button" class="kc-btn" id="kt-planmake">${T.planMake}</button></p>`;
  }
  const opts = (sel) => cat.ids.map((tp) => `<option value="${esc(tp)}"${tp === sel ? ' selected' : ''}>${esc(topicName(cat, tp))}</option>`).join('');
  return `<div class="kc-head"><h2>${T.planH} · ${plan.minutes} ${T.planMinutes}</h2>
      <p class="kc-row"><button type="button" class="kc-link" id="kt-plannew">${T.planNew}</button> <button type="button" class="kc-link" id="kt-planclear">${T.planClear}</button></p></div>
    <ol class="kt-plan">${plan.blocks.map((b, i) => `<li class="${b.done ? 'is-done' : ''}">
      <label class="kt-plan-tick"><input type="checkbox" data-done="${i}"${b.done ? ' checked' : ''}><span class="kt-plan-min">${b.minutes}′</span></label>
      <div><strong>${T.blocks[b.kind]}</strong> · <select data-topic="${i}" class="kt-plan-topic">${opts(b.topic)}</select>
        <div class="kc-muted">${T.blockHelp[b.kind]}</div></div>
      <div class="kc-row kt-plan-act">${blockAction(ctx, b, i)}<button type="button" class="kc-link" data-rmblock="${i}">${T.wsRemove}</button></div></li>`).join('')}</ol>
    <p class="kc-row"><button type="button" class="kc-btn kc-btn-ghost" id="kt-plannote">${T.planSaveNote}</button></p>`;
}

function blockAction(ctx, b, i) {
  const { cat, linkFor } = ctx;
  const t = cat.topics[b.topic] || {};
  const topicPage = t.en ? `/en/${t.en}/` : '';
  if (b.kind === 'warmup' || b.kind === 'review') {
    const url = linkFor(cat, b.topic, 'drill:sprint', null, null);
    return b.kind === 'warmup' ? `<a href="${esc(url)}" target="_blank" rel="noopener">${T.open}</a>` : '';
  }
  if (b.kind === 'teach') return topicPage ? `<a href="${esc(topicPage)}" target="_blank" rel="noopener">${T.open}</a>` : '';
  if (b.kind === 'worksheet') return `<button type="button" class="kc-btn kc-btn-ghost kt-sm" data-blive="${i}">${T.makeLive}</button>`;
  if (b.kind === 'game') return `<a href="${esc(`/en/spanish/games/`)}" target="_blank" rel="noopener">${T.open}</a>`;
  if (b.kind === 'homework') return b.given ? `<span class="kc-muted">${T.given}</span>` : `<button type="button" class="kc-btn kc-btn-ghost kt-sm" data-bhw="${i}">${T.give}</button>`;
  return '';
}

function wirePlan(main, ctx) {
  const save = async (plan) => { await ctx.post('/api/tutor/student/plan', { plan: plan ? JSON.stringify(plan) : '' }); };
  $('#kt-planmake')?.addEventListener('click', async () => { await save(suggestPlan(ctx, Number($('#kt-planmin').value))); ctx.reload(); });
  $('#kt-plannew')?.addEventListener('click', async () => { await save(null); ctx.reload(); });
  $('#kt-planclear')?.addEventListener('click', async () => { await save(null); ctx.reload(); });
  const plan = ctx.plan;
  if (!plan) return;
  main.querySelectorAll('[data-done]').forEach((c) => c.addEventListener('change', async () => {
    plan.blocks[Number(c.dataset.done)].done = c.checked; c.closest('li').classList.toggle('is-done', c.checked); await save(plan);
  }));
  main.querySelectorAll('[data-topic]').forEach((s) => s.addEventListener('change', async () => {
    plan.blocks[Number(s.dataset.topic)].topic = s.value; await save(plan); ctx.reload();
  }));
  main.querySelectorAll('[data-rmblock]').forEach((b) => b.addEventListener('click', async () => {
    plan.blocks.splice(Number(b.dataset.rmblock), 1); await save(plan); ctx.reload();
  }));
  main.querySelectorAll('[data-blive]').forEach((b) => b.addEventListener('click', () => {
    const blk = plan.blocks[Number(b.dataset.blive)];
    $('#kt-ws').scrollIntoView({ behavior: 'smooth' });
    openMaker(main, ctx, { topic: blk.topic, live: true, auto: true, onSaved: async () => { blk.done = true; await save(plan); } });
  }));
  main.querySelectorAll('[data-bhw]').forEach((b) => b.addEventListener('click', async () => {
    const blk = plan.blocks[Number(b.dataset.bhw)];
    await ctx.post('/api/tutor/student/homework', { topic: blk.topic, goal: 40 });
    blk.given = true; blk.done = true; await save(plan); ctx.reload();
  }));
  $('#kt-plannote')?.addEventListener('click', async () => {
    const lines = plan.blocks.map((b) => T.noteLine(`${T.blocks[b.kind]}: ${ctx.topicName(ctx.cat, b.topic)} (${b.minutes}′)`, b.done));
    await ctx.post('/api/tutor/student/lesson', { day: plan.day || today(), note: lines.join('\n') });
    $('#kt-plannote').textContent = T.planSaved;
    setTimeout(() => ctx.reload(), 900);
  });
}

/* ══ student side ════════════════════════════════════════════════════════ */

/** Worksheets list for the student's page (HTML; call meWire afterwards). */
export function meHtml(list, tutor, topicName, cat) {
  if (!list.length) return '';
  return `<section class="kc-card"><h2>${esc(T.meWsH(tutor))}</h2><ul class="kt-mehw">${list.map((w) => `<li>
    <span><strong>${esc(w.title || topicName(cat, w.topic))}</strong><br><span class="kc-muted">${w.done >= w.count ? T.meScore(w.right, w.count) : T.wsDone(w.done, w.count, w.right)}</span></span>
    <a class="kc-btn${w.done >= w.count ? ' kc-btn-ghost' : ''}" href="#w=${w.id}">${T.meWsOpen}</a></li>`).join('')}</ul></section>`;
}

/** Render one worksheet for the student. */
export async function renderWorksheet(main, { key, wid, api, tutor, onBack }) {
  const r = await api(`/api/tutor/me/worksheet?worksheet_id=${wid}`, key, undefined, 'X-Student-Token');
  const w = r.worksheet;
  const stats = await import('/lib/krabsy-stats.js');
  const modeOf = (i) => (w.mode === 'mixed' ? (i % 2 ? 'choice' : 'typed') : w.mode);
  const answered = { ...w.answers };
  const score = () => { const v = Object.values(answered); return `${v.filter((a) => a.correct).length} / ${w.count}`; };
  main.innerHTML = `<p><a href="#" id="kt-back">${T.meWsBack}</a></p>
    <h1>${esc(w.title)}</h1><p class="kc-muted" id="kt-wsscore">${score()}</p>
    <ol class="kt-sheet">${w.questions.map((q, i) => {
      const a = answered[String(i)];
      const slot = modeOf(i) === 'typed'
        ? `<input class="kt-gap" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="answer ${i + 1}"${a ? ` value="${esc(a.given)}" disabled` : ''}>`
        : `<span class="kt-gap-blank">___</span>`;
      return `<li class="kt-q${a ? (a.correct ? ' is-right' : ' is-wrong') : ''}" data-q="${i}">
        <div class="kt-q-s">${sentenceHtml(q, slot)}${q.hint ? ` <span class="kc-muted">(${esc(q.hint)})</span>` : ''}</div>
        ${modeOf(i) === 'choice' ? `<div class="kt-chips">${q.options.map((o) => `<button type="button" class="kt-chip" data-i="${i}" data-o="${esc(o)}"${a ? ' disabled' : ''}>${esc(o)}</button>`).join('')}</div>`
          : `<button type="button" class="kc-btn kc-btn-ghost kt-sm" data-check="${i}"${a ? ' hidden' : ''}>${T.meCheck}</button>`}
        <div class="kt-fb" aria-live="polite">${a ? feedback(q, a.correct) : ''}</div></li>`;
    }).join('')}</ol>
    <p class="kt-sheet-end" id="kt-end"${Object.keys(answered).length >= w.count ? '' : ' hidden'}>${T.meAllDone}</p>`;
  $('#kt-back').addEventListener('click', (e) => { e.preventDefault(); onBack(); });
  const submit = async (i, given) => {
    if (answered[String(i)]) return;
    const q = w.questions[i];
    const correct = (q.accepts.length ? q.accepts : [q.answer]).map(norm).includes(norm(given));
    answered[String(i)] = { given, correct };
    const li = main.querySelector(`[data-q="${i}"]`);
    li.classList.add(correct ? 'is-right' : 'is-wrong');
    li.querySelectorAll('input,button.kt-chip').forEach((el) => { el.disabled = true; });
    li.querySelector('[data-check]')?.setAttribute('hidden', '');
    li.querySelector('.kt-fb').innerHTML = feedback(q, correct);
    $('#kt-wsscore').textContent = score();
    if (Object.keys(answered).length >= w.count) $('#kt-end').hidden = false;
    try { stats.recordAttempt(q.item, q.form || 'default', correct, 'worksheet', w.topic, modeOf(i)); } catch (_) {}
    try { await api('/api/tutor/me/worksheet-answer', key, { worksheet_id: w.id, index: i, given, correct }, 'X-Student-Token'); } catch (_) {}
    const next = main.querySelector('.kt-q:not(.is-right):not(.is-wrong) input');
    if (next && modeOf(i) === 'typed') next.focus();
  };
  main.querySelectorAll('input.kt-gap').forEach((inp) => inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inp.value.trim()) submit(Number(inp.dataset.i), inp.value.trim());
  }));
  main.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', () => {
    const inp = main.querySelector(`input.kt-gap[data-i="${b.dataset.check}"]`);
    if (inp.value.trim()) submit(Number(b.dataset.check), inp.value.trim());
  }));
  main.querySelectorAll('.kt-chip').forEach((b) => b.addEventListener('click', () => {
    b.classList.add('is-picked'); submit(Number(b.dataset.i), b.dataset.o);
  }));
  main.querySelector('input.kt-gap:not([disabled])')?.focus();
}

function feedback(q, correct) {
  return correct ? `<span class="kt-ok">✓ ${T.meRight}</span>`
    : `<span class="kt-no">✗ ${esc(T.meWrong(q.answer))}</span>${q.teach ? `<div class="kc-muted">${esc(q.teach)}</div>` : ''}`;
}

/** Poll the tutor's live state while the student's page is open. */
export function meLive({ key, api, tutor, adult, onWorksheet }) {
  let since = 0, current = null, first = true;
  const tick = async () => {
    let r;
    try { r = await api(`/api/tutor/me/live?since=${since}`, key, undefined, 'X-Student-Token'); } catch (_) { return; }
    if (first) { since = r.seq; first = false; }        // rewards sent before the page was open don't replay
    else {
      for (const e of r.events) celebrate(e, tutor, adult);
      if (r.events.length) since = r.events[r.events.length - 1].seq;
    }
    if (r.worksheet_id && r.worksheet_id !== current) { current = r.worksheet_id; onWorksheet(r.worksheet_id); }
    if (!r.worksheet_id) current = null;
  };
  tick();
  return setInterval(tick, 2500);
}

async function celebrate(e, tutor, adult) {
  const o = document.createElement('div');
  o.className = 'kt-burst';
  o.innerHTML = `<div><span class="kt-burst-ico">${e.kind === 'gift' && !adult ? '🎁' : '⭐'}</span><p>${esc(e.kind === 'gift' ? T.meGift(tutor) : T.meStar(tutor))}</p>${e.text ? `<p class="kc-muted">${esc(e.text)}</p>` : ''}</div>`;
  document.body.appendChild(o);
  setTimeout(() => o.remove(), 3200);
  o.addEventListener('click', () => o.remove());
  if (e.kind === 'gift' && !adult) {
    try {
      const ui = await import('/lib/krabsy-gifts-ui.js');
      const rw = await import('/lib/krabsy-rewards.js');
      const g = rw.grantGift({ source: 'tutor' });
      if (g && g.ok) setTimeout(() => ui.showGifts([g], { lang: 'en' }), 1200);
    } catch (_) { /* the star burst is enough */ }
  }
}
