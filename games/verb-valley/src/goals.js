// Daily goals: three stars per in-game day, so one day is a lesson-sized
// unit with a clear result a class can compare ("I got 3 stars!").
//   ⭐ 1  go to class (it unlocks the farm anyway; an easy first star)
//   ⭐ 2  a farm task picked from what is actually on the field this morning
//   ⭐ 3  an English task (fill the bucket at the well / right answers)
// Day 1 is the tutorial: class → plant 3 → water 3, with a hint line and a
// world arrow for the next step (tutorialStep()).
// Progress comes from state.today counters, which game.js bumps; goals are
// generated once per day (state.goals.day) and stars are kept in
// state.stars (all time) and state.today.stars.

import { CROPS } from './config.js';

const ripeCount = (s) => s.plots.filter((p) => p.crop && p.stage >= CROPS[p.crop].days).length;
const growingCount = (s) => s.plots.filter((p) => p.crop && p.stage < CROPS[p.crop].days).length;
const seedCount = (s) => Object.values(s.seeds).reduce((a, n) => a + n, 0);

export function makeGoals(state) {
  const d = state.day;
  let list;
  if (d === 1) {
    list = [{ kind: 'class', n: 1 }, { kind: 'plant', n: 3 }, { kind: 'water', n: 3 }];
  } else {
    let farm;
    const ripe = ripeCount(state), growing = growingCount(state), seeds = seedCount(state);
    if (ripe >= 1 && !(d % 3 === 0 && growing >= 2)) farm = { kind: 'harvest', n: Math.min(ripe, 4) };
    else if (growing >= 2) farm = { kind: 'water', n: Math.min(growing, 4) };
    else if (seeds >= 1) farm = { kind: 'plant', n: Math.min(seeds, 3) };
    else farm = { kind: 'hay', n: 4 };
    const english = d % 2 === 0 ? { kind: 'wells', n: 2 } : { kind: 'right', n: 7 };
    list = [{ kind: 'class', n: 1 }, farm, english];
  }
  state.goals = { day: d, list: list.map((g) => ({ ...g, done: false })) };
  return state.goals;
}

export function progressOf(state, g) {
  const t = state.today;
  switch (g.kind) {
    case 'class': return state.schooledDay === state.day ? 1 : 0;
    case 'plant': return t.planted;
    case 'water': return t.watered;
    case 'harvest': return t.harvested;
    case 'hay': return t.hayCut;
    case 'wells': return t.wellsFilled;
    case 'right': return t.correct;
    default: return 0;
  }
}

/** Mark goals that are now reached; returns the newly finished ones. */
export function checkGoals(state) {
  if (!state.goals || state.goals.day !== state.day) makeGoals(state);
  const fresh = [];
  for (const g of state.goals.list) {
    if (!g.done && progressOf(state, g) >= g.n) {
      g.done = true;
      state.stars = (state.stars ?? 0) + 1;
      state.today.stars = (state.today.stars ?? 0) + 1;
      fresh.push(g);
    }
  }
  return fresh;
}

export const starsToday = (state) => state.goals?.list.filter((g) => g.done).length ?? 0;

/** Day-1 guide: the next thing to do, with a world target for the arrow. */
export function tutorialStep(state, tilledFree) {
  if (state.day !== 1) return null;
  const t = state.today;
  if (state.schooledDay !== state.day) return { key: 'tutClass', target: 'school' };
  if (t.planted < 3) {
    if (tilledFree < 1) return { key: 'tutTill', target: 'field' };
    return { key: 'tutPlant', target: 'field' };
  }
  if (t.watered < 3) return { key: 'tutWater', target: 'field' };
  return { key: 'tutSleep', target: 'bed' };
}
