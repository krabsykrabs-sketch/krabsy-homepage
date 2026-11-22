// Show sounds, all synthesized with WebAudio (no audio files).
const STORE_KEY = 'krabsy_quizshow_sound';

class SFX {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem(STORE_KEY) === 'off'; } catch (_) { this.muted = false; }
  }

  init() { // from a user gesture
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(STORE_KEY, m ? 'off' : 'on'); } catch (_) {}
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.8, this.ctx.currentTime + 0.1);
  }

  tone({ f = 440, f1, type = 'sine', t = 0, dur = 0.2, g = 0.2, a = 0.01 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise({ t = 0, dur = 0.2, g = 0.2, f = 1200, q = 0.8, type = 'bandpass', a = 0.005 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(gn).connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // Short show jingle: rising major arpeggio with a final chord.
  jingle() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, type: 'square', t: i * 0.11, dur: 0.16, g: 0.08 }));
    [523, 659, 784].forEach((f) => this.tone({ f: f * 2, type: 'triangle', t: 0.46, dur: 0.6, g: 0.1 }));
    this.noise({ t: 0.46, dur: 0.4, g: 0.12, f: 6000, type: 'highpass' });
  }

  locked() { this.tone({ f: 880, f1: 1320, type: 'triangle', dur: 0.12, g: 0.15 }); }

  drumroll(dur = 1.1) {
    for (let t = 0; t < dur; t += 0.045) this.noise({ t, dur: 0.06, g: 0.06 + 0.1 * (t / dur), f: 300, q: 1.2 });
  }

  right(t = 0) {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone({ f, type: 'triangle', t: t + i * 0.08, dur: 0.3, g: 0.14 }));
  }

  wrong(t = 0) {
    this.tone({ f: 330, f1: 220, type: 'sawtooth', t, dur: 0.35, g: 0.09 });
    this.tone({ f: 311, f1: 207, type: 'sawtooth', t: t + 0.32, dur: 0.5, g: 0.09 });
  }

  buzz() {
    this.tone({ f: 140, type: 'square', dur: 0.4, g: 0.13 });
    this.tone({ f: 147, type: 'sawtooth', dur: 0.4, g: 0.08 });
  }

  tick(last) { this.tone({ f: last ? 1400 : 1000, type: 'square', dur: 0.04, g: 0.07, a: 0.002 }); }

  timeUp() { this.tone({ f: 600, f1: 300, type: 'square', dur: 0.5, g: 0.1 }); }

  applause(dur = 2.5) {
    for (let i = 0; i < 160; i++) {
      const t = Math.random() * dur;
      this.noise({ t, dur: 0.03 + Math.random() * 0.03, g: 0.05 * (1 - t / dur / 1.4), f: 1500 + Math.random() * 2500, q: 1.5 });
    }
  }

  boing() { this.tone({ f: 180, f1: 520, type: 'sine', dur: 0.28, g: 0.16 }); this.tone({ f: 360, f1: 900, type: 'triangle', t: 0.02, dur: 0.2, g: 0.05 }); }

  kick() { this.noise({ dur: 0.08, g: 0.18, f: 400, q: 1 }); this.tone({ f: 120, f1: 60, type: 'sine', dur: 0.12, g: 0.2 }); }

  swish() {
    this.noise({ dur: 0.35, g: 0.1, f: 3000, q: 0.7, a: 0.05 });
    [988, 1319].forEach((f, i) => this.tone({ f, type: 'triangle', t: 0.25 + i * 0.09, dur: 0.25, g: 0.1 }));
  }

  boom() {
    this.tone({ f: 90, f1: 40, type: 'sine', dur: 0.5, g: 0.3 });
    this.noise({ dur: 0.6, g: 0.2, f: 900, q: 0.5 });
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, type: 'square', t: 0.15 + i * 0.06, dur: 0.15, g: 0.05 }));
  }

  pop() { this.tone({ f: 600, f1: 1200, type: 'sine', dur: 0.09, g: 0.12 }); }

  whoosh() { this.noise({ dur: 0.35, g: 0.08, f: 900, q: 0.6, a: 0.12 }); }
}

export const sfx = new SFX();
