/* ──────────────────────────────────────────────────────────────────────────
   Krabsy — optional teacher sign-in ("Klasse sichern", 2026-11-27)

   One account identity for teachers and tutors (api/accounts.py): an email,
   a one-time link, a session per device. The session token is kept in
   localStorage["krabsy_account"] = { token, email } (like the tutor pages keep
   theirs in krabsy_tutor_session) and sent as X-Account-Token. Nothing else is
   stored. No text here: the class pages bring their own (ui_<lang>.json).
   ────────────────────────────────────────────────────────────────────────── */
import { apiBase } from '/lib/krabsy-class.js?v=2026-11-22b';

const KEY = 'krabsy_account';

export function getAccount() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    return a && a.token ? a : null;
  } catch (_) { return null; }
}

export function setAccount(a) {
  try { localStorage.setItem(KEY, JSON.stringify({ token: a.token, email: a.email || '' })); } catch (_) {}
}

export function clearAccount() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

/** Call the API. Throws Error(<api error code> | 'http'); a 401 'signed_out'
    also forgets the session on this device. */
export async function call(path, { body, teacherToken, classId, account = true } = {}) {
  const a = account ? getAccount() : null;
  const headers = {};
  if (a) headers['X-Account-Token'] = a.token;
  if (teacherToken) headers['X-Teacher-Token'] = teacherToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const url = apiBase() + path + (classId != null ? (path.includes('?') ? '&' : '?') + 'class_id=' + encodeURIComponent(classId) : '');
  let r;
  try {
    r = await fetch(url, { method: body === undefined ? 'GET' : 'POST', credentials: 'omit', headers,
      body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (_) { throw new Error('net'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) {
    if (d.error === 'signed_out') clearAccount();
    throw new Error(d.error || 'http');
  }
  return d;
}

/** Ask for a sign-in link. claim = a class's secret token: that class is
    saved to the account when the link is opened. Resolves { minutes }. */
export function requestLink(email, lang, claim) {
  return call('/api/account/login', { body: { email, lang, claim: claim || '' }, account: false });
}

/** The link from the email (#l=…): signs this device in. */
export async function verifyLink(token) {
  const d = await call('/api/account/verify', { body: { token }, account: false });
  setAccount({ token: d.session_token, email: d.email });
  return d;
}

export async function signOut() {
  try { await call('/api/account/logout', { body: {} }); } catch (_) {}
  clearAccount();
}

/** A class's secret token from a pasted dashboard link (…#t=…) or the bare token. */
export function tokenFromLink(text) {
  const s = String(text || '').trim();
  const m = s.match(/[#&]t=([A-Za-z0-9_-]{20,64})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,64}$/.test(s) ? s : null;
}
