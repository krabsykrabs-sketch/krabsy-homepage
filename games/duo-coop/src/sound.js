// WebAudio synth sounds (no files). Muted state in localStorage krabsy_duo_mute.
const KEY = 'krabsy_duo_mute';
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch (_) { /* private mode */ }
let ctx = null;

export const isMuted = () => muted;
export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) { /* ignore */ }
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.18, at = 0, slide = 0 } = {}) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export function sfx(name) {
  if (muted) return;
  try {
    switch (name) {
      case 'right': tone(660, 0.12, { type: 'triangle' }); tone(990, 0.18, { type: 'triangle', at: 0.09 }); break;
      case 'wrong': tone(220, 0.25, { type: 'sine', vol: 0.14, slide: 0.8 }); break;
      case 'open': tone(180, 0.35, { type: 'sawtooth', vol: 0.05, slide: 2.2 }); break;
      case 'jump': tone(420, 0.1, { type: 'square', vol: 0.035, slide: 1.6 }); break;
      case 'card': tone(880, 0.06, { type: 'triangle', vol: 0.08 }); break;
      case 'select': tone(740, 0.04, { type: 'triangle', vol: 0.05 }); break;
      case 'nope': tone(160, 0.12, { type: 'square', vol: 0.04 }); break;
      case 'portal': tone(300, 0.4, { type: 'sine', vol: 0.12, slide: 3 }); break;
      case 'key': [880, 1175, 1568].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.1, at: i * 0.07 })); break;
      case 'room': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.12, at: i * 0.11 })); break;
      case 'fall': tone(520, 0.7, { type: 'triangle', vol: 0.1, slide: 0.25 }); break;
      case 'thud': tone(90, 0.18, { type: 'sine', vol: 0.18, slide: 0.6 }); break;
    }
  } catch (_) { /* audio not available */ }
}
