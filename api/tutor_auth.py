"""Email sign-in for tutors (docs/tutor-platform.md, 2026-11-25).

No passwords. A tutor types their email and gets a one-time link (valid
LINK_MINUTES). Opening it signs that device in with a SESSION TOKEN, which the
pages send as X-Tutor-Token exactly like the old private link, so every tutor
endpoint accepts both (tutors._tutor). Sessions last SESSION_DAYS after their
last use.

  POST /api/tutor/login   {email, name?, lang?}   sign in, or create a space
  POST /api/tutor/email   {email}  + X-Tutor-Token add an email to a space
                                                   made with a private link
  POST /api/tutor/verify  {token}                 the link from the email →
                                                   {session_token}
  POST /api/tutor/logout  X-Tutor-Token           this device signs out

Answers never reveal whether an email has a space (always {"ok": true}); the
email itself says what happened. When an email is confirmed for an existing
space, its old private link stops working: from then on it's email sign-in.
Only hashes of link and session tokens are stored.
"""
from __future__ import annotations

import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import mailer
from classes import _err, _hash, _ip, _lock, _now, connect

router = APIRouter()

LINK_MINUTES = 20
SESSION_DAYS = 60
_EMAIL = re.compile(r"[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,24}")
LOGIN_PATH = {"en": "/en/spanish/tutors/login/"}
START_PATH = {"en": "/en/spanish/tutors/"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS tutor_links (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,              -- login | signup | add_email
  email TEXT NOT NULL,
  tutor_id INTEGER REFERENCES tutors(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'en',
  expires TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tutor_sessions (
  token_hash TEXT PRIMARY KEY,
  tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  created TEXT NOT NULL,
  expires TEXT NOT NULL
);
"""


def init_db() -> None:
    with _lock, connect() as con:
        cols = {r["name"] for r in con.execute("PRAGMA table_info(tutors)")}
        if "email" not in cols:
            con.execute("ALTER TABLE tutors ADD COLUMN email TEXT")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS tutors_email ON tutors(email)")
        con.executescript(SCHEMA)


def purge(con) -> None:
    now = _now()
    con.execute("DELETE FROM tutor_links WHERE expires < ?", (now,))
    con.execute("DELETE FROM tutor_sessions WHERE expires < ?", (now,))


def session_tutor_id(con, token: str):
    """Tutor id for a valid session token (and extend it), else None."""
    h = _hash(token or "-")
    row = con.execute("SELECT tutor_id, expires FROM tutor_sessions WHERE token_hash = ?", (h,)).fetchone()
    now = datetime.now(timezone.utc)
    if not row or row["expires"] < now.isoformat(timespec="seconds"):
        return None
    con.execute("UPDATE tutor_sessions SET expires = ? WHERE token_hash = ?",
                ((now + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds"), h))
    return row["tutor_id"]


def clean_email(raw: str):
    e = (raw or "").strip().lower()
    return e if len(e) <= 254 and _EMAIL.fullmatch(e) else None


# Rate limits: per IP and per email address.
_buckets: dict[str, deque] = defaultdict(deque)


def _limited(key: str, n: int, window: float) -> bool:
    now = time.monotonic()
    b = _buckets[key]
    while b and now - b[0] > window:
        b.popleft()
    if len(b) >= n:
        return True
    b.append(now)
    return False


def _site() -> str:
    return os.environ.get("SITE_URL", "https://krabsy.com").rstrip("/")


def _mail(kind: str, to: str, lang: str, token: str | None = None, name: str = "") -> None:
    link = f"{_site()}{LOGIN_PATH.get(lang, LOGIN_PATH['en'])}#l={token}" if token else ""
    start = f"{_site()}{START_PATH.get(lang, START_PATH['en'])}"
    hi = f"Hi {name}," if name else "Hi,"
    foot = (f"The link works once and for {LINK_MINUTES} minutes. If you didn't ask for it, "
            "you can ignore this email.\n\nKrabsy · krabsy.com")
    if kind == "login":
        subject, text = "Your Krabsy sign-in link", f"{hi}\n\nhere is your link to sign in to your Krabsy tutor space:\n\n{link}\n\n{foot}"
    elif kind == "signup":
        subject, text = "Create your Krabsy tutor space", f"{hi}\n\nclick this link to create your Krabsy tutor space and sign in:\n\n{link}\n\n{foot}"
    elif kind == "add_email":
        subject, text = "Confirm your email for Krabsy", (f"{hi}\n\nclick this link to sign in to your Krabsy tutor space with this "
                                                          f"email from now on:\n\n{link}\n\nAfter that, your old private link stops "
                                                          f"working.\n\n{foot}")
    else:   # no space for this address
        subject, text = "Krabsy: no tutor space for this email", (
            f"Hi,\n\nsomeone asked to sign in to Krabsy with this email, but there is no tutor space for it.\n"
            f"To create one, go to:\n\n{start}\n\nIf you didn't ask for this, you can ignore this email.\n\nKrabsy · krabsy.com")
    mailer.send(to, subject, text)


def _new_link(con, purpose: str, email: str, tutor_id, name: str, lang: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=LINK_MINUTES)).isoformat(timespec="seconds")
    con.execute("INSERT INTO tutor_links (token_hash, purpose, email, tutor_id, name, lang, expires) VALUES (?,?,?,?,?,?,?)",
                (_hash(token), purpose, email, tutor_id, name, lang, expires))
    return token


class LoginBody(BaseModel):
    email: str = Field(..., max_length=260)
    name: str = Field("", max_length=80)
    lang: str = Field("en", max_length=5)


class EmailBody(BaseModel):
    email: str = Field(..., max_length=260)


class VerifyBody(BaseModel):
    token: str = Field(..., max_length=80)


@router.post("/api/tutor/login")
def login(body: LoginBody, request: Request) -> JSONResponse:
    email = clean_email(body.email)
    if not email:
        return _err(400, "bad_email")
    if _limited("ip:" + _ip(request), 30, 3600) or _limited("mail:" + email, 5, 3600):
        return _err(429, "too_many")
    lang = body.lang if body.lang in LOGIN_PATH else "en"
    name = re.sub(r"\s+", " ", body.name or "").strip()[:40]
    with _lock, connect() as con:
        t = con.execute("SELECT id, name FROM tutors WHERE email = ?", (email,)).fetchone()
        if t:
            kind, token, who = "login", _new_link(con, "login", email, t["id"], "", lang), t["name"]
        elif name:
            kind, token, who = "signup", _new_link(con, "signup", email, None, name, lang), name
        else:
            kind, token, who = "unknown", None, ""
    _mail(kind, email, lang, token, who)
    return JSONResponse({"ok": True})


@router.post("/api/tutor/email")
def add_email(body: EmailBody, request: Request, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    import tutors
    email = clean_email(body.email)
    if not email:
        return _err(400, "bad_email")
    if _limited("ip:" + _ip(request), 30, 3600) or _limited("mail:" + email, 5, 3600):
        return _err(429, "too_many")
    with _lock, connect() as con:
        t = tutors._tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        token = _new_link(con, "add_email", email, t["id"], "", t["lang"] if t["lang"] in LOGIN_PATH else "en")
    _mail("add_email", email, "en", token, t["name"])
    return JSONResponse({"ok": True})


@router.post("/api/tutor/verify")
def verify(body: VerifyBody, request: Request) -> JSONResponse:
    if _limited("verify:" + _ip(request), 60, 600):
        return _err(429, "too_many")
    now = _now()
    with _lock, connect() as con:
        purge(con)
        ln = con.execute("SELECT * FROM tutor_links WHERE token_hash = ?", (_hash(body.token or "-"),)).fetchone()
        if not ln or ln["used"] or ln["expires"] < now:
            return _err(410, "link_expired")
        con.execute("UPDATE tutor_links SET used = 1 WHERE id = ?", (ln["id"],))
        owner = con.execute("SELECT id FROM tutors WHERE email = ?", (ln["email"],)).fetchone()
        if ln["purpose"] == "login":
            tid = ln["tutor_id"]
        elif ln["purpose"] == "signup":
            if owner:                           # created meanwhile (two links clicked)
                tid = owner["id"]
            else:
                cur = con.execute("INSERT INTO tutors (name, lang, tutor_hash, email, created, last_active) VALUES (?,?,?,?,?,?)",
                                  (ln["name"] or "My students", ln["lang"], _hash(secrets.token_urlsafe(24)), ln["email"], now, now))
                tid = cur.lastrowid
        else:                                   # add_email
            if owner and owner["id"] != ln["tutor_id"]:
                return _err(409, "email_taken")
            tid = ln["tutor_id"]
            # From now on: email sign-in only; the old private link stops working.
            con.execute("UPDATE tutors SET email = ?, tutor_hash = ? WHERE id = ?",
                        (ln["email"], _hash(secrets.token_urlsafe(24)), tid))
        t = con.execute("SELECT id, name FROM tutors WHERE id = ?", (tid,)).fetchone()
        if not t:
            return _err(410, "link_expired")
        session = secrets.token_urlsafe(32)
        con.execute("INSERT INTO tutor_sessions (token_hash, tutor_id, created, expires) VALUES (?,?,?,?)",
                    (_hash(session), tid, now,
                     (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")))
        con.execute("UPDATE tutors SET last_active = ? WHERE id = ?", (now, tid))
    return JSONResponse({"ok": True, "session_token": session, "name": t["name"], "space_id": t["id"]})


@router.post("/api/tutor/logout")
def logout(x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        con.execute("DELETE FROM tutor_sessions WHERE token_hash = ?", (_hash(x_tutor_token or "-"),))
    return JSONResponse({"ok": True})
