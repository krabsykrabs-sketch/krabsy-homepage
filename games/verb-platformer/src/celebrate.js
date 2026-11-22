// Results-screen celebration: canvas confetti + a short WebAudio jingle. No assets.
const COLORS = ['#2ee6c0', '#ff8585', '#ffcf5e', '#ffffff', '#7fb6ff'];

let raf = 0;

export function stopConfetti(canvas) {
  cancelAnimationFrame(raf);
  raf = 0;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** `amount` 1–3 (stars): more stars, more paper. */
export function startConfetti(canvas, amount = 3) {
  stopConfetti(canvas);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const w = canvas.width = window.innerWidth;
  const h = canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const n = Math.round((40 + amount * 35) * Math.min(1, w / 1000 + 0.3));
  const bits = [];
  for (let i = 0; i < n; i++) {
    const left = i % 2 === 0;
    const a = (left ? -1 : 1) * (0.25 + Math.random() * 0.9);     // fan out from the two lower corners
    const speed = h * (0.9 + Math.random() * 0.9);
    bits.push({
      x: left ? -10 : w + 10, y: h * 0.82,
      vx: Math.sin(-a) * speed * 0.75, vy: -Math.cos(a) * speed,
      size: 7 + Math.random() * 7, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 12,
      color: COLORS[i % COLORS.length], delay: Math.random() * 0.35, flip: Math.random() * 6.3,
    });
  }
  const t0 = performance.now();
  let last = t0;
  const DURATION = 3.6;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const age = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    if (age > DURATION) { raf = 0; return; }
    ctx.globalAlpha = Math.min(1, (DURATION - age) / 0.6);
    for (const b of bits) {
      if (age < b.delay) continue;
      b.vy += h * 1.5 * dt;
      b.vx *= 1 - 0.9 * dt;
      if (b.vy > h * 0.35) b.vy = h * 0.35;                       // paper flutters down, it does not drop
      b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.flip += 9 * dt;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(1, Math.cos(b.flip));
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.size / 2, -b.size / 3, b.size, b.size * 0.66);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}

let audioCtx = null;

/** A rising arpeggio, then one bright note per star (timed with the stars popping in). */
export function playJingle(stars = 3) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const now = audioCtx.currentTime + 0.03;
    const note = (freq, at, len, vol, type = 'triangle') => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + at);
      g.gain.exponentialRampToValueAtTime(vol, now + at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + len);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + at);
      o.stop(now + at + len + 0.05);
    };
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.28, 0.16));
    const starNotes = [1318.5, 1568, 2093];
    for (let i = 0; i < stars; i++) note(starNotes[i], 0.55 + i * 0.32, 0.4, 0.13, 'sine');
  } catch (_) { /* no audio */ }
}
