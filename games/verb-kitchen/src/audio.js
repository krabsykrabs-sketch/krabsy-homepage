// WebAudio synth — no samples. All SFX built from oscillators + noise.
const SOUND_KEY = 'krabsy_vkitchen_sound';

class Audio {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(SOUND_KEY) === 'off';
    this.master = null;
    this.sizzleNode = null;
    this.alarmTimer = null;
    this.franticTimer = null;
    this.franticOn = false;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem(SOUND_KEY, m ? 'off' : 'on');
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // ---- primitives ----
  env(node, t0, a, peak, d) {
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  tone(freq, dur = 0.15, type = 'sine', peak = 0.3, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    this.env(g, t0, 0.008, peak, dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur = 0.2, peak = 0.25, when = 0, filterFreq = 2000, type = 'bandpass') {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    this.env(g, t0, 0.005, peak, dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  // ---- named SFX ----
  chop() { this.noise(0.07, 0.5, 0, 600, 'lowpass'); this.tone(160, 0.06, 'square', 0.12); }
  pickup() { this.tone(520, 0.07, 'triangle', 0.2); this.tone(740, 0.07, 'triangle', 0.16, 0.05); }
  putdown() { this.tone(300, 0.08, 'triangle', 0.18); }
  reject() { this.tone(140, 0.12, 'sawtooth', 0.15, 0, -40); }
  ding() { this.tone(1320, 0.5, 'sine', 0.25); this.tone(1980, 0.4, 'sine', 0.1, 0.02); }
  serve() { // ding + cha-ching
    this.tone(880, 0.12, 'sine', 0.25); this.tone(1175, 0.12, 'sine', 0.25, 0.1);
    this.noise(0.12, 0.18, 0.22, 5000); this.tone(1568, 0.3, 'sine', 0.22, 0.24);
  }
  trash() { this.noise(0.18, 0.3, 0, 300, 'lowpass'); this.tone(90, 0.15, 'square', 0.12, 0.02, -30); }
  splash() { this.noise(0.35, 0.3, 0, 1200); this.noise(0.25, 0.18, 0.12, 2400); }
  clatter() {
    this.tone(2200, 0.05, 'square', 0.08); this.tone(1800, 0.05, 'square', 0.07, 0.06);
    this.tone(2600, 0.06, 'square', 0.05, 0.12); this.noise(0.08, 0.1, 0.02, 4000);
  }
  correct() { // bright arpeggio
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.22, i * 0.07));
  }
  wrong() { this.tone(180, 0.25, 'sawtooth', 0.2); this.tone(150, 0.3, 'sawtooth', 0.18, 0.05); }
  trombone() { // sad wah-wah-wahhh
    [330, 311, 294].forEach((f, i) => this.tone(f, i === 2 ? 0.6 : 0.25, 'sawtooth', 0.13, i * 0.28, i === 2 ? -50 : -10));
  }
  skid() { this.noise(0.1, 0.12, 0, 3000, 'highpass'); }
  tick() { this.tone(900, 0.04, 'square', 0.06); }

  sizzle(on) {
    if (!this.ctx) return;
    if (on && !this.sizzleNode) {
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3500;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      this.sizzleNode = src;
    } else if (!on && this.sizzleNode) {
      try { this.sizzleNode.stop(); } catch (e) {}
      this.sizzleNode = null;
    }
  }

  alarm(on) {
    if (on && !this.alarmTimer) {
      const beep = () => { this.tone(950, 0.18, 'square', 0.14); this.tone(950, 0.18, 'square', 0.12, 0.28); };
      beep();
      this.alarmTimer = setInterval(beep, 900);
    } else if (!on && this.alarmTimer) {
      clearInterval(this.alarmTimer); this.alarmTimer = null;
    }
  }

  frantic(on) {
    if (on === this.franticOn) return;
    this.franticOn = on;
    if (on && !this.franticTimer) {
      let step = 0;
      const seq = [220, 0, 220, 247, 0, 220, 0, 196];
      this.franticTimer = setInterval(() => {
        const f = seq[step % seq.length];
        if (f) { this.tone(f, 0.09, 'square', 0.07); this.tone(f * 2, 0.05, 'square', 0.03); }
        step++;
      }, 140);
    } else if (!on && this.franticTimer) {
      clearInterval(this.franticTimer); this.franticTimer = null;
    }
  }

  stopAll() { this.sizzle(false); this.alarm(false); this.frantic(false); }
}

export const audio = new Audio();
