// All sound is synthesized with WebAudio, no audio files.
// Sound modes (the speaker button cycles): 'all' (effects + music) → 'fx' (effects
// only) → 'off'. Saved in localStorage; ?sound=off / ?music=off for teacher links.
const STORE_KEY = 'krabsy_hatchery_sound';
function readMode() {
  const q = new URLSearchParams(location.search);
  if (q.get('sound') === 'off') return 'off';
  let m = 'all';
  try { const v = localStorage.getItem(STORE_KEY); if (v === 'off' || v === 'fx' || v === 'all') m = v; else if (v === 'on') m = 'all'; } catch (_) { /* ignore */ }
  if (q.get('music') === 'off' && m === 'all') m = 'fx';
  return m;
}

// Island music: a slow, sunny loop in C major pentatonic (marimba-like plucks, a soft
// pad, a bass), 96 bpm. Moods: 'calm' (outside), 'chase' (a crab hunts you: drums and
// a busier bass join), 'hall' (Hall of Fame: chimes, no bass).
const BPM = 96, STEP = 60 / BPM / 2; // eighth notes
const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]; // C, Am, F, G
const MEL = [72, null, 69, 67, null, 64, 67, null, 69, null, 72, 74, null, 72, 69, null];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class SFX {
  constructor() { this.ctx = null; this.mode = readMode(); this.muted = this.mode === 'off'; this.lastPlink = 0; this.mood = 'calm'; this.step = 0; }

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
    this.music = this.ctx.createGain(); this.music.gain.value = this.mode === 'all' ? 0.55 : 0; this.music.connect(this.master);
    this.nextT = this.ctx.currentTime + 0.3;
    this.timer = setInterval(() => this._schedule(), 100);
    // silence while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'hidden') this.ctx.suspend(); else this.ctx.resume();
    });
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, len);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  setMode(m) {
    this.mode = m; this.muted = m === 'off';
    try { localStorage.setItem(STORE_KEY, m); } catch (_) { /* ignore */ }
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.2;
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.8, t);
    this.music.gain.linearRampToValueAtTime(m === 'all' ? 0.55 : 0, t);
  }
  cycleMode() { this.setMode({ all: 'fx', fx: 'off', off: 'all' }[this.mode]); return this.mode; }
  setMuted(m) { this.setMode(m ? 'off' : 'all'); }
  setMood(m) { this.mood = m; }
  // ── music: schedule the next eighth notes a little ahead ──
  _schedule() {
    if (!this.ctx || this.mode !== 'all' || this.ctx.state !== 'running') { if (this.ctx) this.nextT = this.ctx.currentTime + 0.1; return; }
    while (this.nextT < this.ctx.currentTime + 0.35) { this._note(this.step, this.nextT); this.step++; this.nextT += STEP; }
  }
  _voice(f, t0, dur, g, type, dest, a = 0.01) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(g, t0 + a); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(gn); gn.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  _note(i, t0) {
    const bar = Math.floor(i / 8) % 4, beat = i % 8, ch = CHORDS[bar], M = this.music, mood = this.mood;
    if (mood !== 'hall') {
      // bass on 1 and 5 (busier when chased)
      if (beat === 0 || beat === 4 || (mood === 'chase' && beat % 2 === 0)) this._voice(midi(ch[0] - 24), t0, 0.35, 0.16, 'triangle', M);
      // marimba melody (calm: every other bar a little quieter)
      const n = MEL[(i % 16)];
      if (n) { this._voice(midi(n), t0, 0.5, bar % 2 ? 0.06 : 0.08, 'sine', M); this._voice(midi(n) * 4, t0, 0.12, 0.015, 'sine', M); }
    } else if (beat === 0 || beat === 3 || beat === 6) {
      // hall: chimes from the chord, high and soft
      this._voice(midi(ch[(beat / 3) % 3] + 24), t0, 1.4, 0.035, 'sine', M, 0.005);
    }
    // pad: the chord, swelling once per bar
    if (beat === 0) for (const nn of ch) this._voice(midi(nn), t0, STEP * 8, mood === 'hall' ? 0.03 : 0.022, 'triangle', M, 0.6);
    if (mood === 'chase') {
      // drums: kick on 1/5, a shaker on every eighth
      if (beat === 0 || beat === 4) { this._voice(110, t0, 0.18, 0.22, 'sine', M); }
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const fl = this.ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 6000;
      const gn = this.ctx.createGain(); gn.gain.setValueAtTime(beat % 2 ? 0.03 : 0.05, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      s.connect(fl); fl.connect(gn); gn.connect(M); s.start(t0, Math.random() * 0.5); s.stop(t0 + 0.08);
    }
  }
  // a little "voice" for a creature: a chirp whose pitch depends on its size
  creature(size = 1, happy = true) {
    const f = 900 / Math.max(0.4, Math.min(2.5, size));
    this.tone({ f, f1: f * (happy ? 1.6 : 0.7), type: 'sine', dur: 0.14, g: 0.12 });
    this.tone({ f: f * 1.25, f1: f * (happy ? 2 : 0.8), type: 'triangle', t: 0.13, dur: 0.16, g: 0.09 });
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
  heart() { this.tone({ f: 70, f1: 45, type: 'sine', dur: 0.12, g: 0.16 }); this.tone({ f: 62, f1: 40, type: 'sine', t: 0.16, dur: 0.14, g: 0.12 }); }
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
