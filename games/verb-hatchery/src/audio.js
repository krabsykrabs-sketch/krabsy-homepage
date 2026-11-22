// All sound is synthesized with WebAudio, no audio files.
const STORE_KEY = 'krabsy_hatchery_sound';
function readMuted() { try { return localStorage.getItem(STORE_KEY) === 'off'; } catch (_) { return false; } }

class SFX {
  constructor() { this.ctx = null; this.muted = readMuted(); this.lastPlink = 0; }

  // must be called from a user gesture
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(STORE_KEY, m ? 'off' : 'on'); } catch (_) { /* ignore */ }
    if (this.master) this.master.gain.linearRampToValueAtTime(m ? 0 : 0.8, this.ctx.currentTime + 0.15);
  }
  tone({ f = 440, f1, type = 'sine', t = 0, dur = 0.2, g = 0.15, a = 0.008 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0, t0);
    gn.gain.linearRampToValueAtTime(g, t0 + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise({ t = 0, dur = 0.15, g = 0.12, f = 1800, q = 1, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + t;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(fl); fl.connect(gn); gn.connect(this.master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
  }
  // quiet belt hum, always on
  _hum() {
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 55;
    const fl = this.ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 160;
    this.humGain = this.ctx.createGain(); this.humGain.gain.value = 0.025;
    o.connect(fl); fl.connect(this.humGain); this.humGain.connect(this.master); o.start();
  }
  belt(on) { if (this.humGain) this.humGain.gain.linearRampToValueAtTime(on ? 0.025 : 0, this.ctx.currentTime + 0.3); }

  step(run) { this.noise({ dur: 0.05, f: run ? 900 : 700, q: 0.8, g: run ? 0.05 : 0.035, type: 'lowpass' }); }
  jump() { this.tone({ f: 300, f1: 520, type: 'sine', dur: 0.15, g: 0.08 }); }
  land() { this.noise({ dur: 0.08, f: 400, q: 0.7, g: 0.06, type: 'lowpass' }); }
  alarm() { this.tone({ f: 880, type: 'square', dur: 0.09, g: 0.04 }); this.tone({ f: 660, type: 'square', t: 0.11, dur: 0.12, g: 0.04 }); }
  bonk() { this.tone({ f: 180, f1: 90, type: 'sine', dur: 0.25, g: 0.25 }); this.noise({ dur: 0.06, f: 1200, g: 0.12 });
    [1400, 1700, 1400].forEach((f, i) => this.tone({ f, type: 'triangle', t: 0.15 + i * 0.08, dur: 0.1, g: 0.06 })); }
  steal() { [600, 500, 400, 300].forEach((f, i) => this.tone({ f, type: 'square', t: i * 0.09, dur: 0.1, g: 0.05 })); }
  whoosh() { this.noise({ dur: 0.35, f: 1500, q: 0.6, g: 0.1 }); this.tone({ f: 500, f1: 1200, type: 'sine', t: 0.1, dur: 0.3, g: 0.08 }); }
  tap() { this.tone({ f: 660, f1: 880, type: 'triangle', dur: 0.08, g: 0.1 }); }
  open() { this.tone({ f: 420, f1: 620, type: 'sine', dur: 0.18, g: 0.12 }); }
  right() {
    this.tone({ f: 660, type: 'triangle', dur: 0.12, g: 0.14 });
    this.tone({ f: 990, type: 'triangle', t: 0.08, dur: 0.2, g: 0.14 });
  }
  wrong() {
    this.tone({ f: 300, f1: 180, type: 'sawtooth', dur: 0.3, g: 0.06 });
  }
  roll() { for (let i = 0; i < 5; i++) this.tone({ f: 200 - i * 20, type: 'sine', t: i * 0.08, dur: 0.07, g: 0.08 }); }
  pop() { this.tone({ f: 520, f1: 1300, type: 'sine', dur: 0.12, g: 0.16 }); this.noise({ dur: 0.05, f: 3000, g: 0.05 }); }
  denied() { this.tone({ f: 220, type: 'square', dur: 0.1, g: 0.05 }); this.tone({ f: 180, type: 'square', t: 0.12, dur: 0.14, g: 0.05 }); }
  crack() { this.noise({ dur: 0.08, f: 2500, q: 3, g: 0.2 }); this.noise({ t: 0.12, dur: 0.06, f: 3200, q: 3, g: 0.15 }); }
  hatch(rarity) {
    const notes = { common: [523, 659, 784], uncommon: [523, 659, 784, 1046], rare: [587, 740, 880, 1175],
      epic: [523, 659, 784, 1046, 1318], legendary: [523, 659, 784, 1046, 1318, 1568, 2093] }[rarity] || [523, 659, 784];
    this.noise({ dur: 0.12, f: 2600, q: 2, g: 0.2 });
    notes.forEach((f, i) => this.tone({ f, type: 'triangle', t: 0.1 + i * 0.09, dur: 0.3, g: 0.12 }));
    if (rarity === 'legendary' || rarity === 'epic') {
      notes.forEach((f, i) => this.tone({ f: f * 1.5, type: 'sine', t: 0.12 + i * 0.09, dur: 0.4, g: 0.05 }));
    }
  }
  plink() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPlink < 0.12) return; // many creatures: don't machine-gun
    this.lastPlink = now;
    this.tone({ f: 1800 + Math.random() * 400, type: 'sine', dur: 0.08, g: 0.035 });
  }
  ding() {
    this.tone({ f: 1046, type: 'sine', dur: 0.5, g: 0.14 });
    this.tone({ f: 1568, type: 'sine', t: 0.06, dur: 0.6, g: 0.08 });
  }
  star() {
    [784, 988, 1175, 1568].forEach((f, i) => this.tone({ f, type: 'triangle', t: i * 0.1, dur: 0.35, g: 0.13 }));
  }
}
export const sfx = new SFX();
