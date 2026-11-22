// Ball physics on the course's height field. Fixed time step, no library:
// slopes pull the ball (gravity along the height gradient), rolling friction slows it,
// wall segments (capsules) bounce it, the cup catches it when it is slow enough.
import { BALL_R, CUP_R } from './course.js';

export const DT = 1 / 240;
export const MAX_SPEED = 16;     // a full-power shot
const G = 12;                    // slope pull per unit of gradient
const MU = 1.7, K = 0.38;        // friction: constant + linear in speed
const BOUNCE = 0.72;             // energy kept off a wall (normal part)
const CUP_V = 6.2;               // faster than this, the ball skips over the cup
const STOP_V = 0.1;

// One fixed step. Returns events: { wall: strength } | { cup: true } | { stop: true } | { lip: true }
export function step(ball, course) {
  const ev = {};
  const [gx, gz] = course.gradAt(ball.x, ball.z);
  ball.vx -= G * gx * DT;
  ball.vz -= G * gz * DT;

  // the cup: a gentle pull when slow and close, caught when slow and over it
  const cup = course.cup;
  const dx = cup.x - ball.x, dz = cup.z - ball.z, dc = Math.hypot(dx, dz);
  let sp = Math.hypot(ball.vx, ball.vz);
  if (dc < CUP_R * 1.7 && sp < 2.6 && dc > 1e-4) {
    ball.vx += (dx / dc) * 3.2 * DT; ball.vz += (dz / dc) * 3.2 * DT;
  }
  if (dc < CUP_R) {
    if (sp < CUP_V) { ev.cup = true; return ev; }
    if (!ball.lipped) { // skipped over: a small kick off the lip
      ball.lipped = true; ev.lip = true;
      const a = (Math.random() - 0.5) * 0.5, c = Math.cos(a), s = Math.sin(a);
      const vx = ball.vx * c - ball.vz * s, vz = ball.vx * s + ball.vz * c;
      ball.vx = vx * 0.85; ball.vz = vz * 0.85;
    }
  } else ball.lipped = false;

  sp = Math.hypot(ball.vx, ball.vz);
  if (sp > 0) {
    const dec = (MU + K * sp) * DT;
    const f = dec >= sp ? 0 : (sp - dec) / sp;
    ball.vx *= f; ball.vz *= f;
  }
  ball.x += ball.vx * DT;
  ball.z += ball.vz * DT;

  for (const s of course.segs) {
    const ex = s.bx - s.ax, ez = s.bz - s.az;
    const len2 = ex * ex + ez * ez;
    let t = len2 > 0 ? ((ball.x - s.ax) * ex + (ball.z - s.az) * ez) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = s.ax + ex * t, pz = s.az + ez * t;
    let nx = ball.x - px, nz = ball.z - pz;
    const d = Math.hypot(nx, nz), min = BALL_R + s.ht;
    if (d >= min || d < 1e-6) continue;
    nx /= d; nz /= d;
    ball.x = px + nx * min; ball.z = pz + nz * min;
    const vn = ball.vx * nx + ball.vz * nz;
    if (vn < 0) {
      ball.vx -= (1 + BOUNCE) * vn * nx; ball.vz -= (1 + BOUNCE) * vn * nz;
      if (-vn > 0.6) ev.wall = Math.max(ev.wall || 0, -vn);
    }
  }

  const g2 = Math.abs(gx) + Math.abs(gz);
  if (Math.hypot(ball.vx, ball.vz) < STOP_V && g2 < 1e-4) {
    ball.vx = 0; ball.vz = 0; ev.stop = true;
  }
  return ev;
}
