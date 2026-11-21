// Tiny WebAudio synth — zero assets (Krabsy convention). Lazily created and
// resumed on the first user gesture (browsers block autoplay before that).
let ctx = null, master = null;

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

export function unlockAudio() {
  ensure();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(freq, dur, { type = 'sine', vol = 0.3, slideTo = null, delay = 0 } = {}) {
  // silent until a user gesture has created + resumed the context (no autoplay warning)
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

export const audio = {
  coin() { tone(880, 0.10, { type: 'triangle', vol: 0.22, slideTo: 1320 }); tone(1320, 0.09, { type: 'triangle', vol: 0.18, delay: 0.06 }); },
  build() { tone(150, 0.16, { type: 'square', vol: 0.22, slideTo: 90 }); tone(300, 0.10, { type: 'triangle', vol: 0.12, delay: 0.02 }); },
  moveIn() { tone(520, 0.10, { type: 'sine', vol: 0.22, slideTo: 800 }); },
  levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.22, delay: i * 0.085 })); },
  nope() { tone(190, 0.13, { type: 'sawtooth', vol: 0.18, slideTo: 130 }); },
};
