// All sound is synthesized (WebAudio), no audio files. Tone/noise helpers from Verb Dungeon.
const STORE_KEY = 'krabsy_vgolf_sound';

class SFX {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem(STORE_KEY) === 'off'; } catch (_) { this.muted = false; }
  }

  // call from a user gesture
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._startRoll();
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(STORE_KEY, m ? 'off' : 'on'); } catch (_) { /* private mode */ }
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.15);
  }

  tone({ f = 440, f1, type = 'sine', t = 0, dur = 0.2, g = 0.18, a = 0.008, vib = 0, vibF = 6 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (vib > 0) {
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      lfo.frequency.value = vibF; lg.gain.value = vib;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur);
    }
    o.connect(gn); gn.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise({ t = 0, dur = 0.25, g = 0.2, f = 800, f1, type = 'lowpass', q = 1 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(gn); gn.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // rolling: a looped low noise whose volume follows the ball's speed (roll(speed) each frame)
  _startRoll() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 260; flt.Q.value = 0.8;
    this.rollGain = this.ctx.createGain(); this.rollGain.gain.value = 0;
    src.connect(flt); flt.connect(this.rollGain); this.rollGain.connect(this.master);
    this.rollFlt = flt;
    src.start();
  }
  roll(speed) {
    if (!this.ctx) return;
    const s = Math.min(1, speed / 12);
    this.rollGain.gain.setTargetAtTime(s * 0.22, this.ctx.currentTime, 0.05);
    this.rollFlt.frequency.setTargetAtTime(180 + s * 380, this.ctx.currentTime, 0.05);
  }

  // ---- game events ----
  uiClick() { this.tone({ f: 620, f1: 920, type: 'triangle', dur: 0.09, g: 0.12 }); }
  putt(power) {
    this.tone({ f: 900 + power * 500, f1: 500, type: 'triangle', dur: 0.07, g: 0.22 + power * 0.15 });
    this.noise({ dur: 0.05, g: 0.12 + power * 0.1, f: 3000, f1: 900, type: 'bandpass', q: 1.5 });
  }
  clunk(strength) {
    const s = Math.min(1, strength / 10);
    this.tone({ f: 210, f1: 120, type: 'sine', dur: 0.12, g: 0.1 + s * 0.25 });
    this.noise({ dur: 0.05, g: 0.05 + s * 0.12, f: 1400, f1: 400 });
  }
  lip() { this.tone({ f: 520, f1: 380, type: 'triangle', dur: 0.1, g: 0.12 }); }
  cup() {
    // rattle into the cup, then a bright plink
    [0, 0.06, 0.11, 0.15].forEach((t, i) => this.tone({ f: 340 - i * 30, f1: 200, type: 'triangle', t, dur: 0.06, g: 0.16 - i * 0.025 }));
    this.tone({ f: 1568, type: 'sine', t: 0.22, dur: 0.35, g: 0.12 });
  }
  cheer() {
    const seq = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]];
    seq.forEach(([f, t]) => this.tone({ f, type: 'triangle', t, dur: 0.3, g: 0.14 }));
    [1047, 1319, 1568].forEach((f) => this.tone({ f, type: 'triangle', t: 0.58, dur: 0.8, g: 0.08 }));
    for (let i = 0; i < 10; i++) this.noise({ t: 0.5 + i * 0.05, dur: 0.06, g: 0.05, f: 2500 + Math.random() * 2500, type: 'bandpass', q: 4 });
  }
  cardOpen() { [660, 990].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.07, dur: 0.18, g: 0.1 })); }
  right() { [784, 1047, 1319].forEach((f, i) => this.tone({ f, type: 'sine', t: i * 0.06, dur: 0.22, g: 0.13 })); }
  wrong() {
    this.tone({ f: 260, f1: 180, type: 'square', dur: 0.2, g: 0.07 });
    this.tone({ f: 262, f1: 176, type: 'sawtooth', dur: 0.2, g: 0.04 });
  }
  boing() { this.tone({ f: 180, f1: 420, type: 'sine', dur: 0.25, g: 0.2, vib: 30, vibF: 14 }); }
  whoosh() { this.noise({ dur: 0.35, g: 0.1, f: 300, f1: 1600, type: 'bandpass', q: 1.6 }); }
  sparkle() { [1047, 1319, 1568, 2093].forEach((f, i) => this.tone({ f, type: 'sine', t: i * 0.05, dur: 0.25, g: 0.09 })); }
  fanfare() {
    const seq = [[523, 0], [659, 0.13], [784, 0.26], [1047, 0.42]];
    seq.forEach(([f, t]) => this.tone({ f, type: 'triangle', t, dur: 0.32, g: 0.15 }));
    [1047, 1319, 1568].forEach((f) => this.tone({ f, type: 'triangle', t: 0.65, dur: 0.9, g: 0.09 }));
    this.sparkle();
  }
  charge(p) { this.tone({ f: 300 + p * 500, type: 'sine', dur: 0.05, g: 0.03 }); }
}

export const sfx = new SFX();
