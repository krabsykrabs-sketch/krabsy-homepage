"""Email sign-in for tutors (docs/tutor-platform.md, 2026-11-25).

Since 2026-11-27 tutors and teachers share ONE account identity and sign-in
(api/accounts.py: accounts, one-time links, sessions, mail texts). This module
keeps the tutor endpoints the tutor pages use; the session token they get is
an account session, sent as X-Tutor-Token (tutors._tutor resolves it).

  POST /api/tutor/login   {email, name?, lang?}   sign in, or create a space
  POST /api/tutor/email   {email}  + X-Tutor-Token add an email to a space
                                                   made with a private link
  POST /api/tutor/verify  {token}                 the link from the email →
                                                   {session_token} (= /api/account/verify)
  POST /api/tutor/logout  X-Tutor-Token           this device signs out

Answers never reveal whether an email has a space (always {"ok": true}); the
email itself says what happened. When an email is confirmed for an existing
space, its old private link stops working: from then on it's email sign-in.
Only hashes of link and session tokens are stored.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import accounts
from accounts import clean_email  # noqa: F401  (kept for callers of the old module)
from classes import _err, _lock, connect

router = APIRouter()

LINK_MINUTES = accounts.LINK_MINUTES
SESSION_DAYS = accounts.SESSION_DAYS
LOGIN_PATH = {"en": "/en/spanish/tutors/login/"}     # tutor pages exist for this section only (N16)
_buckets = accounts._buckets                          # shared limits (tests clear them here)


def init_db() -> None:
    accounts.init_db()


def purge(con) -> None:
    accounts.purge(con)


def session_tutor_id(con, token: str):
    """Tutor id for a valid session token (and extend it), else None."""
    acc = accounts.session_account(con, token)
    if not acc:
        return None
    t = con.execute("SELECT id FROM tutors WHERE account_id = ?", (acc["id"],)).fetchone()
    return t["id"] if t else None


def name_from_email(email: str) -> str:
    """"nora.garcia@…" → "Nora" (a space created from the one-click link; the tutor can rename it)."""
    part = re.split(r"[._+\-\d]", email.split("@")[0])[0]
    return part[:20].capitalize() if len(part) >= 2 else "My students"


def _lang(lang: str) -> str:
    return lang if lang in LOGIN_PATH else "en"


def _link(lang: str, token: str) -> str:
    return f"{accounts.site()}{LOGIN_PATH[_lang(lang)]}#l={token}"


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
    if accounts.login_limited(request, email):
        return _err(429, "too_many")
    lang = _lang(body.lang)
    name = re.sub(r"\s+", " ", body.name or "").strip()[:40]
    with _lock, connect() as con:
        t = con.execute("SELECT t.id, t.name FROM tutors t JOIN accounts a ON a.id = t.account_id WHERE a.email = ?",
                        (email,)).fetchone()
        if t:
            kind, token, who = "tutor_login", accounts.new_link(con, "tutor", "login", email, lang, tutor_id=t["id"]), t["name"]
        elif name:
            kind, token, who = "tutor_signup", accounts.new_link(con, "tutor", "signup", email, lang, name=name), name
        else:   # no space yet: the email offers to create one with one click
            kind, token, who = "tutor_unknown", accounts.new_link(con, "tutor", "signup", email, lang), ""
    accounts.send_mail(email, lang, kind, _link(lang, token), who)
    return JSONResponse({"ok": True})


@router.post("/api/tutor/email")
def add_email(body: EmailBody, request: Request, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    import tutors
    email = clean_email(body.email)
    if not email:
        return _err(400, "bad_email")
    if accounts.login_limited(request, email):
        return _err(429, "too_many")
    with _lock, connect() as con:
        t = tutors._tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        lang = _lang(t["lang"])
        token = accounts.new_link(con, "tutor", "add_email", email, lang, tutor_id=t["id"])
    accounts.send_mail(email, lang, "tutor_add_email", _link(lang, token), t["name"])
    return JSONResponse({"ok": True})


@router.post("/api/tutor/verify")
def verify(body: VerifyBody, request: Request) -> JSONResponse:
    return accounts.verify_link(body.token, request)


@router.post("/api/tutor/logout")
def logout(x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        accounts.end_session(con, x_tutor_token)
    return JSONResponse({"ok": True})
