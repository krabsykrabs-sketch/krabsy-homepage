// WebAudio synth — zero asset files. Every sound is generated. A persisted
// mute toggle lives in localStorage. The night cricket loop fades with the
// day/night cycle (driven from daycycle via setNight()).

import { SOUND_KEY } from './config.js';

let ctx = null;
let master = null;
let enabled = JSON.parse(localStorage.getItem(SOUND_KEY) ?? 'true');
let nightGain = null;     // controls cricket/ambient bed volume
let started = false;

function ensure() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.9 : 0;
  master.connect(ctx.destination);
}

// Browsers require a user gesture before audio. Call on first click/keydown.
export function unlock() {
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
  if (!started) { started = true; startAmbient(); }
}

export function isEnabled() { return enabled; }
export function setEnabled(on) {
  enabled = on;
  localStorage.setItem(SOUND_KEY, JSON.stringify(on));
  if (master) master.gain.linearRampToValueAtTime(on ? 0.9 : 0, (ctx?.currentTime ?? 0) + 0.1);
}
export function toggle() { setEnabled(!enabled); return enabled; }

function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2, hp = 800, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

// ── Event sounds ──────────────────────────────────────────────────────
export const sfx = {
  bell()    { tone(880, 0.5, 'sine', 0.3); tone(1318, 0.6, 'sine', 0.22, 0.04); tone(660, 0.8, 'sine', 0.18, 0.1); },
  chalk()   { noise(0.08, 0.06, 2500); tone(2200, 0.05, 'square', 0.03); },
  correct() { tone(660, 0.12, 'triangle', 0.3); tone(880, 0.14, 'triangle', 0.3, 0.1); tone(1320, 0.18, 'triangle', 0.25, 0.2); },
  wrong()   { tone(300, 0.18, 'sawtooth', 0.18, 0, 180); },
  till()    { noise(0.16, 0.18, 400); },
  plant()   { tone(520, 0.1, 'sine', 0.2, 0, 760); },
  water()   { for (let i = 0; i < 6; i++) noise(0.06, 0.05, 3000 + i * 200, i * 0.03); },
  harvest() { tone(440, 0.08, 'sine', 0.25, 0, 880); tone(880, 0.1, 'sine', 0.2, 0.06); },
  coin()    { tone(1046, 0.08, 'square', 0.18); tone(1568, 0.12, 'square', 0.16, 0.06); },
  chop()    { noise(0.12, 0.25, 200); tone(140, 0.12, 'sawtooth', 0.12, 0, 80); },
  buy()     { tone(660, 0.1, 'square', 0.18); tone(990, 0.12, 'square', 0.16, 0.07); tone(1320, 0.14, 'square', 0.14, 0.14); },
  sleep()   { tone(330, 0.5, 'sine', 0.2, 0, 160); },
  star()    { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, 'triangle', 0.22, i * 0.08)); },
  deny()    { tone(220, 0.12, 'sine', 0.14, 0, 180); },
};

// ── Ambient bed: gentle birds by day, crickets by night ───────────────
function startAmbient() {
  if (!ctx) return;
  nightGain = ctx.createGain();
  nightGain.gain.value = 0;
  nightGain.connect(master);
  // Cricket-ish pulse using a slow LFO-gated oscillator.
  const crick = ctx.createOscillator();
  crick.type = 'triangle'; crick.frequency.value = 2400;
  const cg = ctx.createGain(); cg.gain.value = 0;
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 8;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.012;
  lfo.connect(lfoG); lfoG.connect(cg.gain);
  crick.connect(cg); cg.connect(nightGain);
  crick.start(); lfo.start();
}

// 0 = full day, 1 = full night. Crossfades the cricket bed in.
export function setNight(amt) {
  if (!nightGain || !ctx) return;
  nightGain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, amt)) * 0.8, ctx.currentTime + 0.5);
}

// Morning birds — a few random chirps; call once at wake.
export function birds() {
  if (!enabled) return;
  for (let i = 0; i < 4; i++) {
    const base = 1800 + Math.random() * 900;
    tone(base, 0.08, 'sine', 0.06, 0.3 + i * 0.4, base * 1.3);
    tone(base * 1.2, 0.06, 'sine', 0.05, 0.4 + i * 0.4);
  }
}
