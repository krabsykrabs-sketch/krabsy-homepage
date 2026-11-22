// All sound is synthesized (WebAudio), no audio files.
const STORE_KEY = 'krabsy_vcatapult_sound';
const store = { get() { try { return localStorage.getItem(STORE_KEY); } catch (_) { return null; } },
  set(v) { try { localStorage.setItem(STORE_KEY, v); } catch (_) { /* private mode */ } } };

class SFX {
  constructor() { this.ctx = null; this.muted = store.get() === 'off'; this.lastHit = 0; }

  init() { // from a user gesture
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) {
    this.muted = m; store.set(m ? 'off' : 'on');
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.9, this.ctx.currentTime + 0.15);
  }
  tone({ f = 440, f1, type = 'sine', t = 0, dur = 0.2, g = 0.18, a = 0.008 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t, o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise({ t = 0, dur = 0.25, g = 0.2, f = 800, f1, type = 'lowpass', q = 1 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t, src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const flt = this.ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(g, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt); flt.connect(gn); gn.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  // A cap on hit sounds per moment, so a collapsing fort doesn't clip.
  _gate(ms = 45) { const n = performance.now(); if (n - this.lastHit < ms) return false; this.lastHit = n; return true; }

  click() { this.tone({ f: 620, f1: 920, type: 'triangle', dur: 0.09, g: 0.12 }); }
  creak() { this.tone({ f: 180, f1: 120, type: 'sawtooth', dur: 0.25, g: 0.04 }); }
  thwack() {
    this.noise({ dur: 0.18, g: 0.3, f: 1800, f1: 200 });
    this.tone({ f: 140, f1: 50, dur: 0.25, g: 0.4 });
    this.noise({ t: 0.03, dur: 0.35, g: 0.08, f: 400, f1: 2400, type: 'bandpass', q: 1.5 });
  }
  woodHit(k = 1) { if (!this._gate()) return; this.tone({ f: 260 + Math.random() * 80, f1: 140, type: 'triangle', dur: 0.12, g: 0.2 * k }); this.noise({ dur: 0.05, g: 0.1 * k, f: 1500 }); }
  stoneHit(k = 1) { if (!this._gate()) return; this.tone({ f: 90, f1: 40, dur: 0.25, g: 0.45 * k }); this.noise({ dur: 0.1, g: 0.15 * k, f: 600 }); }
  crack() { this.noise({ dur: 0.22, g: 0.32, f: 3000, f1: 500, type: 'bandpass', q: 0.8 }); this.tone({ f: 200, f1: 90, type: 'square', dur: 0.08, g: 0.06 }); }
  crumble() { for (let i = 0; i < 5; i++) this.noise({ t: i * 0.04, dur: 0.12, g: 0.18, f: 500 + Math.random() * 400 }); }
  oof() {
    this.tone({ f: 420, f1: 240, type: 'triangle', dur: 0.22, g: 0.2 });
    [1318, 1175, 988, 880, 740].forEach((f, i) => this.tone({ f: f * (0.97 + Math.random() * 0.06), t: 0.15 + i * 0.05, dur: 0.14, g: 0.12 }));
  }
  boom() { this.noise({ dur: 0.9, g: 0.5, f: 900, f1: 60, q: 0.7 }); this.tone({ f: 70, f1: 30, dur: 0.8, g: 0.5 }); }
  pop() { this.tone({ f: 500, f1: 1100, dur: 0.1, g: 0.15 }); }
  right() { [659, 988].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.08, dur: 0.22, g: 0.16 })); }
  wrong() { this.tone({ f: 220, f1: 150, type: 'square', dur: 0.25, g: 0.07 }); }
  upgrade() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, t: i * 0.05, dur: 0.3, g: 0.13 })); }
  cheer() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.1, dur: 0.25, g: 0.15 })); }
}
export const sfx = new SFX();
