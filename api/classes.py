"""Classes for teachers (classroom concept phase 2, docs/classroom-concept.md).

A teacher creates a class without an account and gets two things:
  • a class CODE for pupils (6 chars, e.g. "KR4B7X", shown as KR4-B7X), and
  • a secret TEACHER TOKEN (the private dashboard link, #t=… in the URL).
Pupils join with the code and a nickname and get a STUDENT TOKEN, kept in
their browser. Every answer they give in a game or drill is sent here
(topic, word id, form, right/wrong, game/drill id, time) so the teacher
sees what the class — and each nickname — still gets wrong.

Optional teacher sign-in (2026-11-27, api/accounts.py): a teacher MAY attach
classes to an account (email + one-time link) to find them on any device.
Attached classes open with the account session (X-Account-Token + ?class_id=)
as well as with their secret link; anonymous classes work exactly as before.

Privacy by design (owner decisions 2026-11-22):
  • no email (unless the teacher chooses to save classes), no password, no real
    names required; first names only;
  • tokens are stored as SHA-256 hashes, never in plain text;
  • nothing about the IP or device is stored with class data;
  • classes are deleted 6 months after their last activity (with all
    pupils and answers); a teacher can delete a class at any time.

Storage: SQLite in the same /data volume as the analytics log (EU server).
The API runs as a single uvicorn process, so one connection per request
with WAL mode is plenty.
"""

from __future__ import annotations

import hashlib
import os
import re
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import catalog

DATA_DIR = Path(os.environ.get("KRABSY_DATA_DIR", "/data"))
DB_FILE = DATA_DIR / "classes.sqlite3"

RETENTION_DAYS = 180                      # owner decision: 6 months after last activity
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # no 0/O, 1/I/L
CODE_LEN = 6
MAX_STUDENTS = 60
MAX_BATCH = 200                           # answers per request
TOPICS = catalog.TOPICS                   # homepage/data/topics.json via api/catalog.json
_SLUG = re.compile(r"[a-z0-9_-]{1,40}")
_ITEM = re.compile(r"[a-z0-9 _'-]{1,60}")          # verb base forms ("wake up") / use-case ids
_NICK = re.compile(r"[\w .'-]{1,20}", re.UNICODE)

router = APIRouter()
_lock = threading.Lock()


# ── storage ──────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'de',
  teacher_hash TEXT NOT NULL UNIQUE,
  created TEXT NOT NULL,
  last_active TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created TEXT NOT NULL,
  last_active TEXT NOT NULL,
  UNIQUE (class_id, nickname)
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  item TEXT NOT NULL,
  form TEXT NOT NULL,
  correct INTEGER NOT NULL,
  source TEXT,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempts_student ON attempts(student_id, at);
CREATE INDEX IF NOT EXISTS students_class ON students(class_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_FILE, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    return con


def init_db() -> None:
    with _lock, connect() as con:
        con.executescript(SCHEMA)
    import tutors          # tutor spaces live in the same database (tutors.py); adds attempts.mode
    tutors.init_db()


def purge_inactive(now: Optional[datetime] = None) -> int:
    """Delete classes (with pupils and answers) idle for RETENTION_DAYS."""
    cutoff = ((now or datetime.now(timezone.utc)) - timedelta(days=RETENTION_DAYS)).isoformat(timespec="seconds")
    with _lock, connect() as con:
        cur = con.execute("DELETE FROM classes WHERE last_active < ?", (cutoff,))
        return cur.rowcount


def _purger() -> None:
    while True:
        try:
            n = purge_inactive()
            if n:
                print(f"[krabsy] classes: deleted {n} inactive class(es)")
            import tutors
            n = tutors.purge_inactive()
            if n:
                print(f"[krabsy] tutors: deleted {n} inactive tutor space(s)")
            import accounts
            n = accounts.purge_inactive()
            if n:
                print(f"[krabsy] accounts: deleted {n} unused account(s)")
        except Exception as exc:  # noqa: BLE001
            print(f"[krabsy] classes purge failed: {exc}")
        time.sleep(6 * 3600)


def start_background() -> None:
    init_db()
    threading.Thread(target=_purger, name="classes-purge", daemon=True).start()


# ── small helpers ────────────────────────────────────────────────────────────

def format_code(code: str) -> str:
    return f"{code[:3]}-{code[3:]}"


def normalize_code(raw: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (raw or "").upper())[:CODE_LEN]


def clean_nickname(raw: str) -> Optional[str]:
    nick = re.sub(r"\s+", " ", (raw or "").strip())
    return nick if _NICK.fullmatch(nick) else None


def clean_class_name(raw: str) -> str:
    name = re.sub(r"\s+", " ", (raw or "").strip())[:40]
    return name or "Klasse"


# Rate limits per IP for the write endpoints (separate from analytics).
_buckets: dict[str, deque] = defaultdict(deque)
LIMITS = {"create": (20, 3600.0), "join": (120, 600.0), "answers": (1200, 60.0)}


def limited(kind: str, ip: str) -> bool:
    n, window = LIMITS[kind]
    key = f"{kind}:{ip}"
    now = time.monotonic()
    b = _buckets[key]
    while b and now - b[0] > window:
        b.popleft()
    if len(b) >= n:
        return True
    b.append(now)
    return False


def _ip(request: Request) -> str:
    return (request.client.host if request.client else "") or "unknown"


def _err(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


# ── request models ───────────────────────────────────────────────────────────

class CreateBody(BaseModel):
    name: str = Field("", max_length=80)
    lang: str = Field("de", max_length=5)


class JoinBody(BaseModel):
    code: str = Field(..., max_length=16)
    nickname: str = Field(..., max_length=40)      # the pupil's first name (API name kept)
    same_person: bool = False                      # "yes, that's me on another device"


class Answer(BaseModel):
    topic: str = Field(..., max_length=40)
    item: str = Field(..., max_length=80)
    form: str = Field(..., max_length=40)
    correct: bool
    source: Optional[str] = Field(None, max_length=40)
    at: Optional[str] = Field(None, max_length=40)
    mode: Optional[str] = Field(None, max_length=10)     # choice | typed | hint (tutor stars)


class AnswersBody(BaseModel):
    answers: list[Answer] = Field(..., max_length=MAX_BATCH)
    token: Optional[str] = Field(None, max_length=64)   # beacon can't send headers


class RenameBody(BaseModel):
    name: str = Field(..., max_length=80)


# ── endpoints ────────────────────────────────────────────────────────────────

@router.post("/api/class/create")
def create_class(body: CreateBody, request: Request, x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    if limited("create", _ip(request)):
        return _err(429, "too_many")
    lang = catalog.ui_lang(body.lang, catalog.CLASS_LANGS)   # languages with class pages
    token = secrets.token_urlsafe(24)
    now = _now()
    with _lock, connect() as con:
        acc = None
        if x_account_token:                    # signed-in teacher: the class is saved to the account
            import accounts
            acc = accounts.session_account(con, x_account_token)
        for _ in range(20):
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
            try:
                cur = con.execute(
                    "INSERT INTO classes (code, name, lang, teacher_hash, created, last_active, account_id) VALUES (?,?,?,?,?,?,?)",
                    (code, clean_class_name(body.name), lang, _hash(token), now, now, acc["id"] if acc else None))
                break
            except sqlite3.IntegrityError:
                continue
        else:
            return _err(500, "no_code")
    return JSONResponse({"ok": True, "code": format_code(code), "teacher_token": token,
                         "name": clean_class_name(body.name), "saved": bool(acc),
                         "class_id": cur.lastrowid if acc else None})


@router.post("/api/class/join")
def join_class(body: JoinBody, request: Request) -> JSONResponse:
    if limited("join", _ip(request)):
        return _err(429, "too_many")
    code = normalize_code(body.code)
    nick = clean_nickname(body.nickname)
    if len(code) != CODE_LEN:
        return _err(404, "unknown_code")
    if not nick:
        return _err(400, "bad_nickname")
    now = _now()
    token = secrets.token_urlsafe(24)
    with _lock, connect() as con:
        cls = con.execute("SELECT id, name FROM classes WHERE code = ?", (code,)).fetchone()
        if not cls or con.execute("SELECT 1 FROM tutor_students WHERE class_id = ?", (cls["id"],)).fetchone():
            return _err(404, "unknown_code")        # a tutor's student (hidden class of one) can't be joined by code
        existing = con.execute("SELECT id FROM students WHERE class_id = ? AND nickname = ? COLLATE NOCASE",
                               (cls["id"], nick)).fetchone()
        if existing and not body.same_person:
            # Two pupils with the same first name are common. Ask instead of
            # silently merging them: the page offers "that's me (other
            # device)" or "I'm another one -> add your surname's initial".
            return _err(409, "name_taken")
        if existing:
            # Same pupil on another device / cleared browser: continue as
            # them. Phase 3 adds picture codes against impersonation.
            con.execute("UPDATE students SET token_hash = ?, last_active = ? WHERE id = ?",
                        (_hash(token), now, existing["id"]))
        else:
            n = con.execute("SELECT COUNT(*) FROM students WHERE class_id = ?", (cls["id"],)).fetchone()[0]
            if n >= MAX_STUDENTS:
                return _err(409, "class_full")
            con.execute("INSERT INTO students (class_id, nickname, token_hash, created, last_active) VALUES (?,?,?,?,?)",
                        (cls["id"], nick, _hash(token), now, now))
        con.execute("UPDATE classes SET last_active = ? WHERE id = ?", (now, cls["id"]))
    return JSONResponse({"ok": True, "student_token": token, "class_name": cls["name"],
                         "code": format_code(code), "nickname": nick})


@router.post("/api/class/answers")
async def post_answers(request: Request, x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    # Raw body so navigator.sendBeacon (text/plain, no custom headers, no
    # CORS preflight) works when a pupil closes the tab mid-game.
    if limited("answers", _ip(request)):
        return _err(429, "too_many")
    try:
        raw = await request.body()
        if len(raw) > 64 * 1024:
            return _err(413, "too_big")
        body = AnswersBody.model_validate_json(raw)
    except Exception:  # noqa: BLE001
        return _err(400, "bad_body")
    token = x_student_token or body.token or ""
    now = _now()
    rows = []
    for a in body.answers:
        if a.topic not in TOPICS or not _SLUG.fullmatch(a.form) or not _ITEM.fullmatch(a.item):
            continue
        src = a.source if a.source and _SLUG.fullmatch(a.source) else None
        at = a.at if a.at and re.fullmatch(r"\d{4}-\d\d-\d\dT[\d:.]+(Z|[+-]\d\d:\d\d)?", a.at) else now
        mode = a.mode if a.mode in ("choice", "typed", "hint") else None
        rows.append((a.topic, a.item, a.form, 1 if a.correct else 0, src, at, mode))
    with _lock, connect() as con:
        st = con.execute("SELECT id, class_id FROM students WHERE token_hash = ?",
                         (_hash(token or "-"),)).fetchone()
        if not st:
            return _err(401, "not_in_class")     # class deleted or pupil removed
        con.executemany("INSERT INTO attempts (student_id, topic, item, form, correct, source, at, mode) "
                        "VALUES (?,?,?,?,?,?,?,?)", [(st["id"],) + r for r in rows])
        con.execute("UPDATE students SET last_active = ? WHERE id = ?", (now, st["id"]))
        con.execute("UPDATE classes SET last_active = ? WHERE id = ?", (now, st["class_id"]))
    return JSONResponse({"ok": True, "stored": len(rows)})


def _teacher_class(con: sqlite3.Connection, token: str, account_token: str = "", class_id: Optional[int] = None):
    """The class for its secret teacher token, or (signed-in teacher) for
    class_id + an account session that owns it. Returns (class, account|None)."""
    acc = None
    if account_token:
        import accounts
        acc = accounts.session_account(con, account_token)
    if class_id is not None:
        if not acc:
            return None, None
        return con.execute("SELECT * FROM classes WHERE id = ? AND account_id = ?", (class_id, acc["id"])).fetchone(), acc
    return con.execute("SELECT * FROM classes WHERE teacher_hash = ?", (_hash(token or "-"),)).fetchone(), acc


def _missing(class_id, acc) -> JSONResponse:
    """No class: 401 when an account path was used without a valid session (the
    page asks to sign in again), else 404."""
    return _err(401, "signed_out") if class_id is not None and not acc else _err(404, "unknown_class")


def _owner(cls, acc) -> bool:
    return bool(acc and cls and cls["account_id"] == acc["id"])


@router.get("/api/class/dashboard")
def class_dashboard(class_id: Optional[int] = None, x_teacher_token: str = Header("", max_length=64),
                    x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        cls, acc = _teacher_class(con, x_teacher_token, x_account_token, class_id)
        if not cls:
            return _missing(class_id, acc)
        students = con.execute("SELECT id, nickname, last_active FROM students WHERE class_id = ? ORDER BY nickname COLLATE NOCASE",
                               (cls["id"],)).fetchall()
        attempts = con.execute(
            "SELECT a.student_id, a.topic, a.item, a.form, a.correct, a.source, a.at "
            "FROM attempts a JOIN students s ON s.id = a.student_id WHERE s.class_id = ? ORDER BY a.at",
            (cls["id"],)).fetchall()
    out = summarize(cls, students, attempts)
    # Account state for the page: saved to an account at all, saved to the viewer's.
    mine = _owner(cls, acc)
    out["class"].update(saved=bool(cls["account_id"]), mine=mine, id=cls["id"] if mine else None)
    return JSONResponse(out)


def summarize(cls, students, attempts, now: Optional[datetime] = None) -> dict:
    """Turn raw answers into the teacher view (pure; tested directly)."""
    now = now or datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    nick = {s["id"]: s["nickname"] for s in students}

    words: dict[tuple, dict] = {}
    per_student: dict[int, dict] = {s["id"]: {"answers": 0, "correct": 0, "week": 0, "words": defaultdict(list)}
                                    for s in students}
    sources: dict[str, int] = defaultdict(int)
    week_active: set = set()
    week_answers = week_correct = 0
    for a in attempts:
        key = (a["topic"], a["item"])
        w = words.setdefault(key, {"answers": 0, "correct": 0, "students": set(), "last": {}})
        w["answers"] += 1
        w["correct"] += a["correct"]
        w["students"].add(a["student_id"])
        w["last"].setdefault(a["student_id"], []).append(a["correct"])
        ps = per_student.get(a["student_id"])
        if ps is not None:
            ps["answers"] += 1
            ps["correct"] += a["correct"]
            ps["words"][key].append(a["correct"])
            if a["at"] >= week_ago:
                ps["week"] += 1
        sources[a["source"] or "other"] += 1
        if a["at"] >= week_ago:
            week_active.add(a["student_id"])
            week_answers += 1
            week_correct += a["correct"]

    def unsure(results: list) -> bool:
        last = results[-3:]
        return sum(last) < len(last) * 2 / 3      # fewer than 2 of the last 3 right

    word_rows = []
    for (topic, item), w in words.items():
        word_rows.append({
            "topic": topic, "item": item, "answers": w["answers"],
            "correct_pct": round(w["correct"] / w["answers"] * 100),
            "students": len(w["students"]),
            "unsure": sorted(nick[sid] for sid, r in w["last"].items() if sid in nick and unsure(r)),
        })
    hard = sorted([r for r in word_rows if r["answers"] >= 3 and r["unsure"]],
                  key=lambda r: (-len(r["unsure"]), r["correct_pct"]))[:20]
    solid = sorted([r for r in word_rows if r["answers"] >= 3 and not r["unsure"]],
                   key=lambda r: (-r["answers"],))[:20]

    student_rows = []
    for s in students:
        ps = per_student[s["id"]]
        hard_words = sorted(
            ((k, r) for k, r in ps["words"].items() if unsure(r)),
            key=lambda kv: sum(kv[1]) / len(kv[1]))[:6]
        student_rows.append({
            "nickname": s["nickname"], "last_active": s["last_active"],
            "answers": ps["answers"], "answers_week": ps["week"],
            "correct_pct": round(ps["correct"] / ps["answers"] * 100) if ps["answers"] else None,
            "hard_words": [{"topic": k[0], "item": k[1]} for k, _ in hard_words],
        })
    return {
        "ok": True,
        "class": {"name": cls["name"], "code": format_code(cls["code"]), "lang": cls["lang"],
                  "created": cls["created"], "last_active": cls["last_active"],
                  "delete_after_days": RETENTION_DAYS},
        "week": {"active_students": len(week_active), "students": len(students),
                 "answers": week_answers,
                 "correct_pct": round(week_correct / week_answers * 100) if week_answers else None},
        "hard_words": hard,
        "solid_words": solid,
        "students": student_rows,
        "sources": sorted(sources.items(), key=lambda kv: -kv[1]),
    }


@router.post("/api/class/rename")
def rename_class(body: RenameBody, class_id: Optional[int] = None, x_teacher_token: str = Header("", max_length=64),
                 x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        cls, _acc = _teacher_class(con, x_teacher_token, x_account_token, class_id)
        if not cls:
            return _missing(class_id, _acc)
        con.execute("UPDATE classes SET name = ? WHERE id = ?", (clean_class_name(body.name), cls["id"]))
    return JSONResponse({"ok": True})


class RemoveBody(BaseModel):
    nickname: str = Field(..., max_length=40)


@router.post("/api/class/remove-student")
def remove_student(body: RemoveBody, class_id: Optional[int] = None, x_teacher_token: str = Header("", max_length=64),
                   x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        cls, _acc = _teacher_class(con, x_teacher_token, x_account_token, class_id)
        if not cls:
            return _missing(class_id, _acc)
        con.execute("DELETE FROM students WHERE class_id = ? AND nickname = ?", (cls["id"], body.nickname))
    return JSONResponse({"ok": True})


@router.post("/api/class/delete")
def delete_class(class_id: Optional[int] = None, x_teacher_token: str = Header("", max_length=64),
                 x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        cls, _acc = _teacher_class(con, x_teacher_token, x_account_token, class_id)
        if not cls:
            return _missing(class_id, _acc)
        con.execute("DELETE FROM classes WHERE id = ?", (cls["id"],))
    return JSONResponse({"ok": True})


@router.post("/api/class/new-link")
def new_teacher_link(class_id: Optional[int] = None, x_teacher_token: str = Header("", max_length=64),
                     x_account_token: str = Header("", max_length=64)) -> JSONResponse:
    """Replace the secret dashboard link (e.g. it was forwarded): only the
    signed-in owner can, the old link stops working at once."""
    with _lock, connect() as con:
        cls, acc = _teacher_class(con, x_teacher_token, x_account_token, class_id)
        if not cls:
            return _missing(class_id, acc)
        if not _owner(cls, acc):
            return _err(403, "not_owner")
        token = secrets.token_urlsafe(24)
        con.execute("UPDATE classes SET teacher_hash = ? WHERE id = ?", (_hash(token), cls["id"]))
    return JSONResponse({"ok": True, "teacher_token": token})
