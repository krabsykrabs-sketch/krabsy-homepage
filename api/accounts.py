"""One account identity for teachers and tutors (docs/classroom-concept.md
"Decision: teacher accounts", docs/tutor-platform.md "Email sign-in").

An ACCOUNT is an email address, nothing else (no password, no name). What it
can do comes from what hangs on it:
  • teacher role: classes whose classes.account_id points to it ("Meine Klassen");
  • tutor role:   a tutor space whose tutors.account_id points to it.
Both sign in the same way: the person types their email and gets a one-time
link (valid LINK_MINUTES, single use). Opening it signs that device in with a
SESSION TOKEN (SESSION_DAYS after its last use). Pages send it as
X-Account-Token (teacher pages) or X-Tutor-Token (tutor pages, tutor_auth.py);
it is the same session either way.

  POST /api/account/login   {email, lang, claim?}  send a sign-in link; with
                            claim = a class's secret teacher token, the class is
                            attached when the link is opened ("Klasse sichern")
  POST /api/account/verify  {token}                the link from the email →
                            {session_token, context, claimed} (tutor links too)
  POST /api/account/logout  X-Account-Token         this device signs out
  GET  /api/account/me      X-Account-Token         email + "Meine Klassen"
  POST /api/account/attach  {teacher_token}         add an existing class
  POST /api/account/detach  {class_id}              remove a class from the account
                                                    (the class keeps working by its link)
  POST /api/account/delete                          delete the account: email,
                                                    sessions, links; classes stay

No account enumeration: /login always answers {"ok": true, "minutes": N}, and
the teacher email is the same whether the address has an account or not (an
account is created when the link is opened). Rate limits per IP and per email.
Only SHA-256 hashes of link and session tokens are stored.

Purge (with the 6-hourly class purge): expired links and sessions; accounts
with no class and no tutor space whose last sign-in/use is older than
classes.RETENTION_DAYS. Classes themselves keep their own 180-day rule.
"""
from __future__ import annotations

import os
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import catalog
import mailer
from classes import RETENTION_DAYS, _err, _hash, _ip, _lock, _now, connect

router = APIRouter()

LINK_MINUTES = 20
SESSION_DAYS = 60
_EMAIL = re.compile(r"[^@\s]{1,64}@[^@\s]{1,190}\.[A-Za-z]{2,24}")

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  lang TEXT NOT NULL DEFAULT 'en',
  created TEXT NOT NULL,
  last_active TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_links (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  context TEXT NOT NULL,              -- teacher | tutor
  purpose TEXT NOT NULL,              -- login | signup (tutor) | add_email (tutor)
  email TEXT NOT NULL,
  tutor_id INTEGER,                   -- tutor login / add_email: the space
  class_id INTEGER,                   -- teacher: the class to attach ("Klasse sichern")
  name TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'en',
  expires TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created TEXT NOT NULL,
  expires TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_links_email ON account_links(email);
"""


# ── storage + migration ──────────────────────────────────────────────────────

def _cols(con, table: str) -> set:
    return {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}


def _tables(con) -> set:
    return {r["name"] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}


def init_db() -> None:
    """Create the account tables and move the tutor-only sign-in (2026-11-25:
    tutors.email, tutor_links, tutor_sessions) onto accounts. Idempotent."""
    with _lock, connect() as con:
        con.executescript(SCHEMA)
        for table in ("classes", "tutors"):
            if "account_id" not in _cols(con, table):
                con.execute(f"ALTER TABLE {table} ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL")
        con.execute("CREATE INDEX IF NOT EXISTS classes_account ON classes(account_id)")
        con.execute("CREATE UNIQUE INDEX IF NOT EXISTS tutors_account ON tutors(account_id)")
        tables = _tables(con)
        # 1) tutors.email → accounts (the column stays, emptied: SQLite keeps old columns)
        if "email" in _cols(con, "tutors"):
            for t in con.execute("SELECT id, email, lang, created, last_active FROM tutors "
                                 "WHERE email IS NOT NULL AND account_id IS NULL").fetchall():
                con.execute("INSERT OR IGNORE INTO accounts (email, lang, created, last_active) VALUES (?,?,?,?)",
                            (t["email"], t["lang"], t["created"], t["last_active"]))
                aid = con.execute("SELECT id FROM accounts WHERE email = ?", (t["email"],)).fetchone()["id"]
                con.execute("UPDATE tutors SET account_id = ?, email = NULL WHERE id = ?", (aid, t["id"]))
        # 2) tutor sessions → account sessions (signed-in tutors stay signed in)
        if "tutor_sessions" in tables:
            con.execute("INSERT OR IGNORE INTO account_sessions (token_hash, account_id, created, expires) "
                        "SELECT s.token_hash, t.account_id, s.created, s.expires FROM tutor_sessions s "
                        "JOIN tutors t ON t.id = s.tutor_id WHERE t.account_id IS NOT NULL")
            con.execute("DROP TABLE tutor_sessions")
        # 3) open tutor sign-in links (20 minutes) → account links
        if "tutor_links" in tables:
            con.execute("INSERT OR IGNORE INTO account_links (token_hash, context, purpose, email, tutor_id, name, lang, expires, used) "
                        "SELECT token_hash, 'tutor', purpose, email, tutor_id, name, lang, expires, used FROM tutor_links")
            con.execute("DROP TABLE tutor_links")


def purge(con, now: Optional[datetime] = None) -> int:
    """Expired links and sessions; accounts without classes and tutor space
    unused for RETENTION_DAYS. Returns the number of accounts deleted."""
    now_dt = now or datetime.now(timezone.utc)
    stamp = now_dt.isoformat(timespec="seconds")
    con.execute("DELETE FROM account_links WHERE expires < ?", (stamp,))
    con.execute("DELETE FROM account_sessions WHERE expires < ?", (stamp,))
    cutoff = (now_dt - timedelta(days=RETENTION_DAYS)).isoformat(timespec="seconds")
    cur = con.execute(
        "DELETE FROM accounts WHERE last_active < ? "
        "AND NOT EXISTS (SELECT 1 FROM classes c WHERE c.account_id = accounts.id) "
        "AND NOT EXISTS (SELECT 1 FROM tutors t WHERE t.account_id = accounts.id)", (cutoff,))
    return cur.rowcount


def purge_inactive(now: Optional[datetime] = None) -> int:
    with _lock, connect() as con:
        return purge(con, now)


def drop_if_unused(con, account_id) -> None:
    """After a tutor space is deleted: an account with nothing left goes too
    (the tutor asked to delete their data, the email included)."""
    if not account_id:
        return
    con.execute("DELETE FROM accounts WHERE id = ? "
                "AND NOT EXISTS (SELECT 1 FROM classes WHERE account_id = ?) "
                "AND NOT EXISTS (SELECT 1 FROM tutors WHERE account_id = ?)", (account_id, account_id, account_id))


# ── helpers ──────────────────────────────────────────────────────────────────

def clean_email(raw: str) -> Optional[str]:
    e = (raw or "").strip().lower()
    return e if len(e) <= 254 and _EMAIL.fullmatch(e) else None


# Rate limits per IP and per email, shared by teacher and tutor sign-in.
_buckets: dict[str, deque] = defaultdict(deque)


def limited(key: str, n: int, window: float) -> bool:
    now = time.monotonic()
    b = _buckets[key]
    while b and now - b[0] > window:
        b.popleft()
    if len(b) >= n:
        return True
    b.append(now)
    return False


def login_limited(request: Request, email: str) -> bool:
    """30 link requests per IP and 5 per address per hour."""
    return limited("ip:" + _ip(request), 30, 3600) or limited("mail:" + email, 5, 3600)


def site() -> str:
    return os.environ.get("SITE_URL", "https://krabsy.com").rstrip("/")


def new_link(con, context: str, purpose: str, email: str, lang: str, *, tutor_id=None,
             class_id=None, name: str = "") -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(minutes=LINK_MINUTES)).isoformat(timespec="seconds")
    con.execute("INSERT INTO account_links (token_hash, context, purpose, email, tutor_id, class_id, name, lang, expires) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (_hash(token), context, purpose, email, tutor_id, class_id, name, lang, expires))
    return token


def send_mail(to: str, lang: str, kind: str, link: str, name: str = "") -> None:
    """Plain short email from the catalogue (ui_<lang>.json "mail"): greeting,
    <kind>_body with the link, footer."""
    greet = catalog.mail_text(lang, "greeting_name", name=name) if name else catalog.mail_text(lang, "greeting")
    text = "\n\n".join([greet, catalog.mail_text(lang, kind + "_body", link=link),
                        catalog.mail_text(lang, "footer", minutes=LINK_MINUTES)])
    mailer.send(to, catalog.mail_text(lang, kind + "_subject"), text, lang=lang)


def account_for_email(con, email: str, lang: str, create: bool = True):
    row = con.execute("SELECT * FROM accounts WHERE email = ?", (email,)).fetchone()
    if row or not create:
        return row
    now = _now()
    cur = con.execute("INSERT INTO accounts (email, lang, created, last_active) VALUES (?,?,?,?)", (email, lang, now, now))
    return con.execute("SELECT * FROM accounts WHERE id = ?", (cur.lastrowid,)).fetchone()


def new_session(con, account_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    con.execute("INSERT INTO account_sessions (token_hash, account_id, created, expires) VALUES (?,?,?,?)",
                (_hash(token), account_id, now,
                 (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")))
    con.execute("UPDATE accounts SET last_active = ? WHERE id = ?", (now, account_id))
    return token


def session_account(con, token: str):
    """The account for a valid session token (extends the session), else None."""
    if not token:
        return None
    h = _hash(token)
    row = con.execute("SELECT account_id, expires FROM account_sessions WHERE token_hash = ?", (h,)).fetchone()
    now = datetime.now(timezone.utc)
    if not row or row["expires"] < now.isoformat(timespec="seconds"):
        return None
    con.execute("UPDATE account_sessions SET expires = ? WHERE token_hash = ?",
                ((now + timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds"), h))
    con.execute("UPDATE accounts SET last_active = ? WHERE id = ?", (now.isoformat(timespec="seconds"), row["account_id"]))
    return con.execute("SELECT * FROM accounts WHERE id = ?", (row["account_id"],)).fetchone()


def end_session(con, token: str) -> None:
    con.execute("DELETE FROM account_sessions WHERE token_hash = ?", (_hash(token or "-"),))


def teacher_class_by_token(con, teacher_token: str):
    """A teacher's class (not a tutor student's hidden class) for its secret token."""
    return con.execute("SELECT * FROM classes WHERE teacher_hash = ? "
                       "AND id NOT IN (SELECT class_id FROM tutor_students)", (_hash(teacher_token or "-"),)).fetchone()


def _class_lang(lang: Optional[str]) -> str:
    return catalog.ui_lang(lang, catalog.CLASS_LANGS) if catalog.CLASS_LANGS else catalog.DEFAULT_UI


# ── one verify for every sign-in link ────────────────────────────────────────

def _verify_tutor(con, ln, now: str):
    """Tutor links (tutor_auth.py): log in, create the space, or add the email
    to an old private-link space. Returns (account_id, tutor_id) or a JSONResponse."""
    acc = account_for_email(con, ln["email"], ln["lang"])
    own = con.execute("SELECT id FROM tutors WHERE account_id = ?", (acc["id"],)).fetchone()
    if ln["purpose"] == "login":
        tid = ln["tutor_id"]
    elif ln["purpose"] == "signup":
        if own:                                   # created meanwhile (two links clicked)
            tid = own["id"]
        else:
            import tutor_auth
            cur = con.execute("INSERT INTO tutors (name, lang, tutor_hash, account_id, created, last_active) VALUES (?,?,?,?,?,?)",
                              (ln["name"] or tutor_auth.name_from_email(ln["email"]), ln["lang"],
                               _hash(secrets.token_urlsafe(24)), acc["id"], now, now))
            tid = cur.lastrowid
    else:                                         # add_email
        if own and own["id"] != ln["tutor_id"]:
            return _err(409, "email_taken")
        tid = ln["tutor_id"]
        # From now on: email sign-in only; the old private link stops working.
        con.execute("UPDATE tutors SET account_id = ?, tutor_hash = ? WHERE id = ?",
                    (acc["id"], _hash(secrets.token_urlsafe(24)), tid))
    t = con.execute("SELECT id, name FROM tutors WHERE id = ? AND account_id = ?", (tid, acc["id"])).fetchone()
    if not t:
        return _err(410, "link_expired")
    con.execute("UPDATE tutors SET last_active = ? WHERE id = ?", (now, tid))
    return acc["id"], t


def verify_link(token: str, request: Request) -> JSONResponse:
    if limited("verify:" + _ip(request), 60, 600):
        return _err(429, "too_many")
    now = _now()
    with _lock, connect() as con:
        purge(con)
        ln = con.execute("SELECT * FROM account_links WHERE token_hash = ?", (_hash(token or "-"),)).fetchone()
        if not ln or ln["used"] or ln["expires"] < now:
            return _err(410, "link_expired")
        con.execute("UPDATE account_links SET used = 1 WHERE id = ?", (ln["id"],))
        out = {"ok": True, "context": ln["context"]}
        if ln["context"] == "tutor":
            r = _verify_tutor(con, ln, now)
            if isinstance(r, JSONResponse):
                return r
            aid, t = r
            out.update(name=t["name"], space_id=t["id"])
        else:
            acc = account_for_email(con, ln["email"], ln["lang"])
            aid = acc["id"]
            out["claimed"] = None
            if ln["class_id"]:
                cur = con.execute("UPDATE classes SET account_id = ? WHERE id = ? AND (account_id IS NULL OR account_id = ?)",
                                  (aid, ln["class_id"], aid))
                out["claimed"] = bool(cur.rowcount)
        out["session_token"] = new_session(con, aid)
        out["email"] = ln["email"]
    return JSONResponse(out)


# ── teacher endpoints ────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    email: str = Field(..., max_length=260)
    lang: str = Field("", max_length=5)
    claim: str = Field("", max_length=64)        # a class's secret teacher token


class VerifyBody(BaseModel):
    token: str = Field(..., max_length=80)


class AttachBody(BaseModel):
    teacher_token: str = Field(..., max_length=64)


class DetachBody(BaseModel):
    class_id: int


@router.post("/api/account/login")
def login(body: LoginBody, request: Request) -> JSONResponse:
    email = clean_email(body.email)
    if not email:
        return _err(400, "bad_email")
    if login_limited(request, email):
        return _err(429, "too_many")
    lang = _class_lang(body.lang)
    with _lock, connect() as con:
        cls = teacher_class_by_token(con, body.claim) if body.claim else None
        token = new_link(con, "teacher", "login", email, lang, class_id=cls["id"] if cls else None)
    page = catalog.ui_page(lang, "class_account") or "/"
    # The same email for known and new addresses (no enumeration); "claim" only
    # changes the wording, and it depends on the request, not on the account.
    send_mail(email, lang, "teacher_claim" if cls else "teacher_login", f"{site()}{page}#l={token}")
    return JSONResponse({"ok": True, "minutes": LINK_MINUTES})


@router.post("/api/account/verify")
def verify(body: VerifyBody, request: Request) -> JSONResponse:
    return verify_link(body.token, request)


@router.post("/api/account/logout")
def logout(x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        end_session(con, x_account_token)
    return JSONResponse({"ok": True})


def _class_rows(con, account_id: int) -> list:
    rows = con.execute(
        "SELECT c.id, c.name, c.code, c.lang, c.created, c.last_active, "
        "(SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS students "
        "FROM classes c WHERE c.account_id = ? ORDER BY c.last_active DESC", (account_id,)).fetchall()
    from classes import format_code
    return [{"id": r["id"], "name": r["name"], "code": format_code(r["code"]), "lang": r["lang"],
             "created": r["created"], "last_active": r["last_active"], "students": r["students"]} for r in rows]


@router.get("/api/account/me")
def me(x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        acc = session_account(con, x_account_token)
        if not acc:
            return _err(401, "signed_out")
        tutor = con.execute("SELECT 1 FROM tutors WHERE account_id = ?", (acc["id"],)).fetchone()
        classes = _class_rows(con, acc["id"])
    return JSONResponse({"ok": True, "email": acc["email"], "tutor": bool(tutor), "classes": classes,
                         "delete_after_days": RETENTION_DAYS})


@router.post("/api/account/attach")
def attach(body: AttachBody, request: Request, x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    if limited("attach:" + _ip(request), 60, 3600):
        return _err(429, "too_many")
    with _lock, connect() as con:
        acc = session_account(con, x_account_token)
        if not acc:
            return _err(401, "signed_out")
        cls = teacher_class_by_token(con, body.teacher_token)
        if not cls:
            return _err(404, "unknown_class")
        if cls["account_id"] and cls["account_id"] != acc["id"]:
            return _err(409, "class_taken")      # the owner can detach it first
        con.execute("UPDATE classes SET account_id = ? WHERE id = ?", (acc["id"], cls["id"]))
    return JSONResponse({"ok": True, "class_id": cls["id"]})


@router.post("/api/account/detach")
def detach(body: DetachBody, x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        acc = session_account(con, x_account_token)
        if not acc:
            return _err(401, "signed_out")
        con.execute("UPDATE classes SET account_id = NULL WHERE id = ? AND account_id = ?", (body.class_id, acc["id"]))
    return JSONResponse({"ok": True})


@router.post("/api/account/delete")
def delete(x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        acc = session_account(con, x_account_token)
        if not acc:
            return _err(401, "signed_out")
        if con.execute("SELECT 1 FROM tutors WHERE account_id = ?", (acc["id"],)).fetchone():
            return _err(409, "tutor_space")      # delete the tutor space on the tutor page first
        con.execute("UPDATE classes SET account_id = NULL WHERE account_id = ?", (acc["id"],))
        con.execute("DELETE FROM account_links WHERE email = ?", (acc["email"],))
        con.execute("DELETE FROM accounts WHERE id = ?", (acc["id"],))   # sessions cascade
    return JSONResponse({"ok": True})
