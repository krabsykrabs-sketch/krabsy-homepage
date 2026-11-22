// Professor Krabsy's class: the short daily start (4 questions). It opens
// with yesterday's missed items, unlocks the farm and pays coins + the
// rare-seed ladder. Answers happen on the shared question panel (quiz.js);
// the 3D blackboard mirrors the current question in chalk.

import { drawBoardIdle } from './world.js';
import { sfx } from './audio.js';
import { CROPS, SCHOOL_LADDER } from './config.js';
import * as Q from './questions.js';
import * as quiz from './quiz.js';

const W = 768, H = 512;
export const CLASS_QUESTIONS = 4;
const COINS_PER_RIGHT = 5;

export function createSchool(state, bb, hooks) {
  // hooks: { onComplete(summary) } — game.js wires it.
  let active = false;
  let asked = 0, correct = 0;

  const chalk = (ctx) => { ctx.fillStyle = 'rgba(255,255,255,0.92)'; };

  // Blackboard mirror: the same positional notation, in chalk.
  function drawStep(step) {
    const { ctx, tex } = bb;
    ctx.fillStyle = '#1e3a2f'; ctx.fillRect(0, 0, W, H);
    ctx.font = '28px Nunito, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`${Math.min(asked + 1, CLASS_QUESTIONS)} / ${CLASS_QUESTIONS}`, W - 24, 44);
    ctx.textAlign = 'center';
    const d = step.display;
    if (d.kind === 'trio') {
      const parts = [d.base, d.slots[0] ?? (d.askIndex === 0 ? '?' : '___'), d.slots[1] ?? (d.askIndex === 1 ? '?' : '___')];
      const cols = ['#ffcf5e', '#2ee6c0', '#ff8585'];
      ctx.font = '62px "Fredoka One", cursive';
      const text = parts.join('  →  ');
      let x = W / 2 - ctx.measureText(text).width / 2;
      ctx.textAlign = 'left';
      parts.forEach((p, i) => {
        ctx.fillStyle = (i === 0 || d.slots[i - 1]) ? cols[i] : (d.askIndex === i - 1 ? cols[i] : 'rgba(255,255,255,0.5)');
        ctx.fillText(p, x, 250); x += ctx.measureText(p).width;
        if (i < 2) { chalk(ctx); ctx.fillText('  →  ', x, 250); x += ctx.measureText('  →  ').width; }
      });
    } else {
      chalk(ctx); ctx.font = '48px "Fredoka One", cursive';
      wrapText(ctx, d.sentence.replace('___', '?'), W / 2, 220, W - 80, 60);
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
    ctx.fillText(`${sum.correct} / ${sum.total} ✓`, W / 2, 200);
    ctx.fillStyle = '#ffcf5e';
    ctx.fillText(`+${sum.coins} coins`, W / 2, 270);
    let y = 340;
    if (sum.specialSeed) {
      const c = CROPS[sum.seedAwarded];
      ctx.fillStyle = '#2ee6c0';
      ctx.fillText(`${c.emoji} ${c.name} seed!`, W / 2, y); y += 64;
    }
    if (sum.sticker) { ctx.fillStyle = '#ff8585'; ctx.fillText('🌟 Star sticker!', W / 2, y); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '30px Nunito, sans-serif';
    ctx.fillText('The farm is open!', W / 2, 470);
    tex.needsUpdate = true;
  }

  async function run() {
    // Review first (yesterday's misses), then fresh units up to 4 questions.
    const per = Q.topic === 'irregular_verbs' ? 2 : 1;
    const units = Q.reviewUnits(state, Math.ceil(CLASS_QUESTIONS / per));
    const avoid = units.map((u) => u.item);
    while (units.reduce((n, u) => n + u.steps.length, 0) < CLASS_QUESTIONS) {
      const u = Q.nextUnit(avoid); avoid.push(u.item); units.push(u);
    }
    for (const unit of units) {
      if (asked >= CLASS_QUESTIONS) break;
      const r = await quiz.ask(unit, {
        title: 'Professor Krabsy’s class',
        reward: () => `+${COINS_PER_RIGHT} 🪙`,
        onShow: (step) => { sfx.chalk(); drawStep(step); },
        onStep: (i, ok) => {
          asked++;
          if (ok) { correct++; state.coins += COINS_PER_RIGHT; }
          Q.recordStep(state, unit, i, ok);
        },
      });
      Q.recordUnit(state, unit, r.correct === r.total);
    }
    return finish();
  }

  function start() {
    if (active) return { ok: false, reason: 'in-class' };
    if (state.schooledDay === state.day) return { ok: false, reason: 'already-attended' };
    active = true; asked = 0; correct = 0;
    run();
    return { ok: true };
  }

  function finish() {
    const sum = {
      correct, total: asked,
      coins: correct * COINS_PER_RIGHT,
      specialSeed: correct >= CLASS_QUESTIONS - 1,
      sticker: correct === asked,
    };
    if (sum.specialSeed) {
      // Rare-seed ladder strictly by what you've GROWN: star → moon →
      // rainbow. Holding an unplanted seed doesn't advance it.
      const next = SCHOOL_LADDER.find((c) => !state.collection?.[c]) ?? SCHOOL_LADDER[0];
      state.seeds[next] = (state.seeds[next] ?? 0) + 1;
      sum.seedAwarded = next;
    }
    if (sum.sticker) { state.school.stickers += 1; sfx.star(); }
    state.school.totalCorrect += correct;
    state.school.classesAttended += 1;
    state.schooledDay = state.day;
    drawSummary(sum);
    setTimeout(() => { if (!active) drawBoardIdle(bb); }, 6000);
    active = false;
    hooks.onComplete?.(sum);
    return sum;
  }

  return {
    start,
    get active() { return active; },
    get progress() { return { asked, correct, total: CLASS_QUESTIONS }; },
  };
}

// ── canvas helpers ──────────────────────────────────────────────────────
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
