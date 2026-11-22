// Sound on/off for the whole game (owner request 2026-11-22: a classroom full of tablets needs
// a mute button). Remembered in localStorage `krabsy_vp_mute` ('1' = muted). playSfx
// (assets.js) and the results jingle (celebrate.js) ask isMuted() before they play.
const KEY = 'krabsy_vp_mute';
let muted = false;
try { muted = localStorage.getItem(KEY) === '1'; } catch (_) { /* private mode */ }
const listeners = new Set();

export const isMuted = () => muted;
export function setMuted(m) {
  muted = !!m;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (_) { /* ignore */ }
  listeners.forEach(fn => fn(muted));
}
export const toggleMuted = () => setMuted(!muted);
export const onMuteChange = fn => { listeners.add(fn); fn(muted); };
