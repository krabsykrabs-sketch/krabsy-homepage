// Professor Krabsy's class. Questions render as chalk on the 3D blackboard
// canvas; answers come from clicking the board (raycast → UV → chip rects) or
// keys 1/2/3. Missed verbs persist in the save and seed the next class's
// review question — the spaced-repetition heart of the game.

import { buildClass } from './verbs.js';
import { drawBoardIdle } from './world.js';
import { sfx } from './audio.js';

const CHIP_COLORS = { teal: '#2ee6c0', coral: '#ff8585', amber: '#ffcf5e' };
const W = 768, H = 512;
// Three answer chips along the bottom of the board (canvas px).
const CHIP_RECTS = [0, 1, 2].map((i) => ({ x: 22 + i * 246, y: 368, w: 230, h: 104 }));

// Tiny deterministic rng for QA-seeded classes.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSchool(state, bb, hooks) {
  // hooks: { onComplete(summary), onAnswer(correct) } — game.js wires these.
  let active = false;
  let questions = [];
  let qIndex = 0;
  let correct = 0;
  let phase = 'question';        // 'question' | 'feedback' | 'done'
  let feedbackTimer = 0;
  let reviewVerbToday = null;

  const chalk = (ctx) => { ctx.fillStyle = 'rgba(255,255,255,0.92)'; };

  function drawQuestion() {
    const { ctx, tex } = bb;
    const q = questions[qIndex];
    ctx.fillStyle = '#1e3a2f'; ctx.fillRect(0, 0, W, H);
    // progress + review badge
    ctx.font = '28px Nunito, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`${qIndex + 1} / ${questions.length}`, W - 24, 44);
    if (q.isReview) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#ffcf5e';
      ctx.fillText('★ review', 24, 44);
    }
    // prompt — wrap if long (preposition sentences)
    ctx.textAlign = 'center'; chalk(ctx);
    ctx.font = '44px "Fredoka One", cursive';
    wrapText(ctx, q.prompt, W / 2, 150, W - 80, 56);
    // form-color underline cue
    ctx.fillStyle = CHIP_COLORS[q.color];
    ctx.fillRect(W / 2 - 120, 230, 240, 7);
    // chips
    q.chips.forEach((chip, i) => {
      const r = CHIP_RECTS[i];
      ctx.strokeStyle = CHIP_COLORS[q.color]; ctx.lineWidth = 4;
      rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
      chalk(ctx);
      ctx.font = fitFont(ctx, chip, r.w - 30, 40);
      ctx.fillText(chip, r.x + r.w / 2, r.y + r.h / 2 + 14);
      ctx.font = '24px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(String(i + 1), r.x + r.w / 2, r.y + 28);
    });
    tex.needsUpdate = true;
  }

  function drawFeedback(wasCorrect, q) {
    const { ctx, tex } = bb;
    ctx.fillStyle = '#1e3a2f'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (wasCorrect) {
      ctx.fillStyle = '#2ee6c0'; ctx.font = '90px "Fredoka One", cursive';
      ctx.fillText('✓', W / 2, 200);
      chalk(ctx); ctx.font = '40px Nunito, sans-serif';
      ctx.fillText('+5 coins', W / 2, 290);
    } else {
      ctx.fillStyle = '#ff8585'; ctx.font = '44px "Fredoka One", cursive';
      ctx.fillText('Not quite!', W / 2, 140);
      chalk(ctx);
      ctx.font = q.kind === 'verb' ? '52px "Fredoka One", cursive' : '40px "Fredoka One", cursive';
      ctx.fillText(q.chain, W / 2, 260);
      if (q.kind === 'verb') {
        // colour-code the chain words: base amber, past teal, pp coral
        ctx.font = '26px Nunito, sans-serif';
        ctx.fillStyle = '#ffcf5e'; ctx.fillText('base', W / 2 - 180, 310);
        ctx.fillStyle = '#2ee6c0'; ctx.fillText('past', W / 2, 310);
        ctx.fillStyle = '#ff8585'; ctx.fillText('participle', W / 2 + 180, 310);
      }
    }
    tex.needsUpdate = true;
  }

  function drawSummary(sum) {
    const { ctx, tex } = bb;
    ctx.fillStyle = '#1e3a2f'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; chalk(ctx);
    ctx.font = '54px "Fredoka One", cursive';
    ctx.fillText('Class over!', W / 2, 120);
    ctx.font = '44px Nunito, sans-serif';
    ctx.fillText(`${sum.correct} / ${sum.total} correct`, W / 2, 200);
    ctx.fillStyle = '#ffcf5e';
    ctx.fillText(`+${sum.coins} coins`, W / 2, 270);
    let y = 340;
    if (sum.specialSeed) { ctx.fillStyle = '#2ee6c0'; ctx.fillText('⭐ Star Fruit seed earned!', W / 2, y); y += 64; }
    if (sum.sticker) { ctx.fillStyle = '#ff8585'; ctx.fillText('🌟 Perfect! Star sticker!', W / 2, y); y += 64; }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '30px Nunito, sans-serif';
    ctx.fillText('The farm is open — go grow something!', W / 2, 470);
    tex.needsUpdate = true;
  }

  function start(seed) {
    if (active) return { ok: false, reason: 'in-class' };
    if (state.schooledDay === state.day) return { ok: false, reason: 'already-attended' };
    const rng = seed != null ? mulberry32(seed) : Math.random;
    reviewVerbToday = state.school.missed[0] ?? null;
    questions = buildClass(8, reviewVerbToday, rng);
    qIndex = 0; correct = 0; phase = 'question'; active = true;
    sfx.chalk();
    drawQuestion();
    return { ok: true };
  }

  function answer(i) {
    if (!active || phase !== 'question') return { ok: false, reason: 'not-question' };
    const q = questions[qIndex];
    if (i < 0 || i >= q.chips.length) return { ok: false, reason: 'bad-index' };
    const wasCorrect = q.chips[i] === q.correct;
    if (wasCorrect) {
      correct++;
      state.coins += 5;
      sfx.correct();
      // a correctly answered review verb graduates out of the missed list
      if (q.isReview && q.verb) state.school.missed = state.school.missed.filter((v) => v !== q.verb);
    } else {
      sfx.wrong();
      if (q.kind === 'verb' && q.verb && !state.school.missed.includes(q.verb)) {
        state.school.missed.push(q.verb);
      }
    }
    hooks.onAnswer?.(wasCorrect);
    phase = 'feedback';
    feedbackTimer = wasCorrect ? 0.9 : 2.2;
    drawFeedback(wasCorrect, q);
    return { ok: true, correct: wasCorrect };
  }

  function nextQuestion() {
    qIndex++;
    if (qIndex >= questions.length) return finish();
    phase = 'question';
    sfx.chalk();
    drawQuestion();
  }

  function finish() {
    phase = 'done';
    const sum = {
      correct, total: questions.length,
      coins: correct * 5,
      specialSeed: correct >= 6,
      sticker: correct === questions.length,
    };
    if (sum.specialSeed) state.seeds.starfruit = (state.seeds.starfruit ?? 0) + 1;
    if (sum.sticker) { state.school.stickers += 1; sfx.star(); }
    state.school.totalCorrect += correct;
    state.school.classesAttended += 1;
    state.schooledDay = state.day;
    drawSummary(sum);
    // Board lingers on the summary, then resets; class formally ends now.
    setTimeout(() => { if (!active) drawBoardIdle(bb); }, 6000);
    active = false;
    hooks.onComplete?.(sum);
    return sum;
  }

  // Click on the board mesh → canvas px → chip index.
  function handleBoardClick(uv) {
    if (!active || phase !== 'question') return;
    const px = uv.x * W, py = (1 - uv.y) * H;
    CHIP_RECTS.forEach((r, i) => {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) answer(i);
    });
  }

  // Advance feedback timer; call each frame.
  function update(dt) {
    if (!active || phase !== 'feedback') return;
    feedbackTimer -= dt;
    if (feedbackTimer <= 0) nextQuestion();
  }

  return {
    start, answer, update, handleBoardClick,
    get active() { return active; },
    get progress() { return { qIndex, correct, total: questions.length }; },
    get currentQuestion() { return questions[qIndex]; },
  };
}

// ── canvas helpers ──────────────────────────────────────────────────────
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy); line = w; yy += lineH;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}
function fitFont(ctx, text, maxW, base) {
  let size = base;
  do {
    ctx.font = `${size}px "Fredoka One", cursive`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 3;
  } while (size > 18);
  return ctx.font;
}
