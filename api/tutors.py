"""Tutor spaces (docs/tutor-platform.md, phase 1, 2026-11-25).

A tutor creates a space without an account and gets a secret TUTOR TOKEN
(the private link, #t=… in the URL, like the class dashboard). In the space
the tutor adds students. Each student is stored as a hidden class of one
(classes.py) with exactly one pupil row, so every answer the student gives in
any game or drill reaches the tutor through the existing class pipeline
(krabsy-class.js → /api/class/answers). Nothing in the games changes.

The student's personal link carries a STUDENT KEY (#k=… in the URL). The key
IS the student token: the pupil row stores its SHA-256 hash, the browser keeps
the key in localStorage["krabsy_class"]. So the same link works on every
device of the student; "new link" replaces the key and old devices drop out.

On top of the class data a tutor keeps, per student: level, goals, notes,
lesson notes, homework (topic + game/drill + difficulty), and a star rating
per topic. Stars (same scale for every topic):

  ★ seen it · ★★ right with help · ★★★ right when choosing ·
  ★★★★ right when typing · ★★★★★ uses it freely (only the tutor sets 5)

Measured stars come from the answers (measure_stars, pure and tested); the
tutor can set stars by hand, which then win.

Privacy as for classes: first names only, no email, tokens hashed, spaces
idle for RETENTION_DAYS are deleted with all students and answers.
"""

from __future__ import annotations

import re
import secrets
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import classes
from classes import _err, _hash, _ip, _lock, _now, connect, limited

router = APIRouter()

MAX_STUDENTS = 100
MAX_LESSONS = 200
MAX_HOMEWORK = 50
TYPED_SOURCES = {"free_practice", "free-practice", "type-race"}   # pages where the answer is typed
_TARGET = re.compile(r"(drill:)?[a-z0-9-]{1,40}")
_LEVEL = re.compile(r"[\w .+/-]{0,20}", re.UNICODE)
_DATE = re.compile(r"\d{4}-\d\d-\d\d")

SCHEMA = """
CREATE TABLE IF NOT EXISTS tutors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'en',
  tutor_hash TEXT NOT NULL UNIQUE,
  created TEXT NOT NULL,
  last_active TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_students (
  id INTEGER PRIMARY KEY,
  tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_stars (
  ts_id INTEGER NOT NULL REFERENCES tutor_students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  stars INTEGER,
  note TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL,
  PRIMARY KEY (ts_id, topic)
);
CREATE TABLE IF NOT EXISTS tutor_lessons (
  id INTEGER PRIMARY KEY,
  ts_id INTEGER NOT NULL REFERENCES tutor_students(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  note TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_homework (
  id INTEGER PRIMARY KEY,
  ts_id INTEGER NOT NULL REFERENCES tutor_students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  target TEXT NOT NULL,
  difficulty INTEGER,
  glang TEXT,
  note TEXT NOT NULL DEFAULT '',
  created TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tutor_students_tutor ON tutor_students(tutor_id);
CREATE TABLE IF NOT EXISTS tutor_worksheets (
  id INTEGER PRIMARY KEY,
  ts_id INTEGER NOT NULL REFERENCES tutor_students(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'typed',        -- typed | choice | mixed
  questions TEXT NOT NULL,                   -- JSON list, snapshot from the question engine
  answers TEXT NOT NULL DEFAULT '{}',        -- JSON {index: {given, correct, at}} (first try only)
  created TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tutor_live (
  ts_id INTEGER PRIMARY KEY REFERENCES tutor_students(id) ON DELETE CASCADE,
  worksheet_id INTEGER,
  started TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]'          -- JSON [{seq, kind, text, at}] rewards and messages
);
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated TEXT NOT NULL
);
"""

# Columns added after the first version (ALTER on existing databases).
MIGRATIONS = [
    ("attempts", "mode", "TEXT"),                               # how the answer was given
    ("tutor_homework", "goal", "INTEGER"),                      # answers to reach
    ("tutor_students", "adult", "INTEGER NOT NULL DEFAULT 0"),
    ("tutor_students", "report_hash", "TEXT"),                  # parents' read-only link
    ("tutor_students", "report_note", "TEXT NOT NULL DEFAULT ''"),
    ("tutor_students", "plan", "TEXT NOT NULL DEFAULT ''"),     # lesson builder: the current plan (JSON)
]
PROFILE_MAX = 400 * 1024                                       # bytes of profile JSON per student
_PKEY = re.compile(r"[A-Za-z0-9_]{1,80}")


def init_db() -> None:
    with _lock, connect() as con:
        con.executescript(SCHEMA)
        for table, col, decl in MIGRATIONS:
            cols = {r["name"] for r in con.execute(f"PRAGMA table_info({table})")}
            if col not in cols:
                con.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")
    import tutor_auth          # email sign-in (tutors.email, links, sessions)
    tutor_auth.init_db()


def purge_inactive(now: Optional[datetime] = None) -> int:
    """Delete tutor spaces idle for RETENTION_DAYS, with their students' classes."""
    cutoff = ((now or datetime.now(timezone.utc)) - timedelta(days=classes.RETENTION_DAYS)).isoformat(timespec="seconds")
    with _lock, connect() as con:
        import tutor_auth
        tutor_auth.purge(con)                  # expired sign-in links and sessions
        ids = [r["id"] for r in con.execute("SELECT id FROM tutors WHERE last_active < ?", (cutoff,))]
        for tid in ids:
            con.execute("DELETE FROM classes WHERE id IN (SELECT class_id FROM tutor_students WHERE tutor_id = ?)", (tid,))
            con.execute("DELETE FROM tutors WHERE id = ?", (tid,))
        return len(ids)


def _clean(raw: str, n: int) -> str:
    return re.sub(r"[ \t]+", " ", (raw or "").replace("\r", "")).strip()[:n]


def _tutor(con: sqlite3.Connection, token: str):
    """The tutor for a private link token (old spaces) or an email sign-in session."""
    t = con.execute("SELECT * FROM tutors WHERE tutor_hash = ?", (_hash(token or "-"),)).fetchone()
    if t:
        return t
    import tutor_auth
    tid = tutor_auth.session_tutor_id(con, token)
    return con.execute("SELECT * FROM tutors WHERE id = ?", (tid,)).fetchone() if tid else None


def _touch(con: sqlite3.Connection, tutor_id: int) -> None:
    """An active tutor keeps all their students' classes alive."""
    now = _now()
    con.execute("UPDATE tutors SET last_active = ? WHERE id = ?", (now, tutor_id))
    con.execute("UPDATE classes SET last_active = ? WHERE id IN (SELECT class_id FROM tutor_students WHERE tutor_id = ?)",
                (now, tutor_id))


def _student(con: sqlite3.Connection, tutor_id: int, sid: int):
    return con.execute("SELECT * FROM tutor_students WHERE id = ? AND tutor_id = ?", (sid, tutor_id)).fetchone()


def is_tutor_class(con: sqlite3.Connection, class_id: int) -> bool:
    return con.execute("SELECT 1 FROM tutor_students WHERE class_id = ?", (class_id,)).fetchone() is not None


# ── stars from answers (pure) ─────────────────────────────────────────────────

def answer_mode(a) -> str:
    keys = a.keys() if hasattr(a, "keys") else a
    mode = a["mode"] if "mode" in keys else None
    if mode in ("choice", "typed", "hint"):
        return mode
    return "typed" if (a["source"] or "") in TYPED_SOURCES else "choice"


def measure_stars(attempts: list) -> int:
    """Stars 0–4 for one topic from its answers in time order.

    0 no answers · 1 has answered · 2 ≥ 5 answers, half of the last 20 right ·
    3 ≥ 10 choice answers, 80 % of the last 20 right, ≥ 4 different words right ·
    4 level 3 and ≥ 8 typed answers, 80 % of the last 10 right. 5 is never
    measured: "uses it freely" is the tutor's judgement."""
    if not attempts:
        return 0
    stars = 1
    last = [a["correct"] for a in attempts[-20:]]
    if len(attempts) >= 5 and sum(last) >= len(last) * 0.5:
        stars = 2
    else:
        return stars
    choice = [a for a in attempts if answer_mode(a) == "choice"]
    typed = [a for a in attempts if answer_mode(a) == "typed"]
    # typed answers are harder than choosing, so they count for level 3 too
    pool = choice + typed
    pool.sort(key=lambda a: a["at"])
    recent = [a["correct"] for a in pool[-20:]]
    right_items = {a["item"] for a in pool if a["correct"]}
    if len(pool) >= 10 and sum(recent) >= len(recent) * 0.8 and len(right_items) >= min(4, len({a["item"] for a in pool})):
        stars = 3
    else:
        return stars
    t_recent = [a["correct"] for a in typed[-10:]]
    if len(typed) >= 8 and sum(t_recent) >= len(t_recent) * 0.8:
        stars = 4
    return stars


def topic_summary(attempts: list) -> dict:
    """Per topic: measured stars, answers, % right, last answer, words to practise."""
    by_topic: dict[str, list] = defaultdict(list)
    for a in attempts:
        by_topic[a["topic"]].append(a)
    out = {}
    for topic, rows in by_topic.items():
        words: dict[str, list] = defaultdict(list)
        for a in rows:
            words[a["item"]].append(a["correct"])
        practise = sorted((w for w, r in words.items() if sum(r[-3:]) < len(r[-3:]) * 2 / 3),
                          key=lambda w: sum(words[w]) / len(words[w]))[:8]
        out[topic] = {
            "measured": measure_stars(rows), "answers": len(rows),
            "correct_pct": round(sum(a["correct"] for a in rows) / len(rows) * 100),
            "last": rows[-1]["at"], "practise": practise,
        }
    return out


def homework_progress(hw, attempts: list) -> dict:
    rows = [a for a in attempts if a["topic"] == hw["topic"] and a["at"] >= hw["created"]]
    return {"answers": len(rows),
            "correct_pct": round(sum(a["correct"] for a in rows) / len(rows) * 100) if rows else None,
            "last": rows[-1]["at"] if rows else None}


# ── request models ────────────────────────────────────────────────────────────

class CreateBody(BaseModel):
    name: str = Field("", max_length=80)
    lang: str = Field("en", max_length=5)


class NameBody(BaseModel):
    name: str = Field(..., max_length=80)


class StudentAdd(BaseModel):
    name: str = Field(..., max_length=40)
    level: str = Field("", max_length=40)
    goals: str = Field("", max_length=600)
    adult: bool = False


class StudentRef(BaseModel):
    id: int


class StudentUpdate(BaseModel):
    id: int
    name: Optional[str] = Field(None, max_length=40)
    level: Optional[str] = Field(None, max_length=40)
    goals: Optional[str] = Field(None, max_length=600)
    notes: Optional[str] = Field(None, max_length=4000)
    adult: Optional[bool] = None
    report_note: Optional[str] = Field(None, max_length=1000)


class StarsBody(BaseModel):
    id: int
    topic: str = Field(..., max_length=40)
    stars: Optional[int] = Field(None, ge=0, le=5)      # None = back to measured
    note: str = Field("", max_length=300)


class LessonBody(BaseModel):
    id: int
    day: str = Field(..., max_length=10)
    note: str = Field(..., max_length=2000)


class ItemRef(BaseModel):
    id: int
    item_id: int


class HomeworkBody(BaseModel):
    id: int
    topic: str = Field(..., max_length=40)
    target: str = Field("", max_length=50)               # "" = any game or drill (default)
    goal: Optional[int] = Field(None, ge=1, le=500)      # answers to reach
    difficulty: Optional[int] = Field(None, ge=1, le=3)
    glang: Optional[str] = Field(None, max_length=5)
    note: str = Field("", max_length=300)


# ── endpoints: tutor ──────────────────────────────────────────────────────────

@router.post("/api/tutor/create")
def create_space(body: CreateBody, request: Request) -> JSONResponse:
    if limited("create", _ip(request)):
        return _err(429, "too_many")
    lang = body.lang if body.lang in ("de", "es", "en") else "en"
    name = _clean(body.name, 40) or "My students"
    token = secrets.token_urlsafe(24)
    now = _now()
    with _lock, connect() as con:
        con.execute("INSERT INTO tutors (name, lang, tutor_hash, created, last_active) VALUES (?,?,?,?,?)",
                    (name, lang, _hash(token), now, now))
    return JSONResponse({"ok": True, "tutor_token": token, "name": name})


@router.get("/api/tutor/space")
def get_space(x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        _touch(con, t["id"])
        studs = con.execute("SELECT ts.*, s.last_active AS seen FROM tutor_students ts "
                            "LEFT JOIN students s ON s.class_id = ts.class_id WHERE ts.tutor_id = ? "
                            "ORDER BY ts.name COLLATE NOCASE", (t["id"],)).fetchall()
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        out = []
        for s in studs:
            att = _attempts(con, s["class_id"])
            set_stars = {r["topic"]: r["stars"] for r in con.execute(
                "SELECT topic, stars FROM tutor_stars WHERE ts_id = ?", (s["id"],))}
            summ = topic_summary(att)
            stars = {tp: v["measured"] for tp, v in summ.items()}
            stars.update({tp: v for tp, v in set_stars.items() if v is not None})   # the tutor's stars win
            hw = con.execute("SELECT * FROM tutor_homework WHERE ts_id = ? ORDER BY created DESC LIMIT 1", (s["id"],)).fetchone()
            out.append({"id": s["id"], "name": s["name"], "level": s["level"], "adult": bool(s["adult"]),
                        "homework": dict(topic=hw["topic"], goal=hw["goal"], **homework_progress(hw, att)) if hw else None,
                        "last_active": s["seen"] if att else None,
                        "answers_week": sum(1 for a in att if a["at"] >= week_ago),
                        "answers": len(att), "stars": stars})
    return JSONResponse({"ok": True, "space": {"id": t["id"], "name": t["name"], "lang": t["lang"], "created": t["created"],
                                               "email": t["email"],
                                               "delete_after_days": classes.RETENTION_DAYS},
                         "students": out})


@router.post("/api/tutor/rename")
def rename_space(body: NameBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        con.execute("UPDATE tutors SET name = ? WHERE id = ?", (_clean(body.name, 40) or t["name"], t["id"]))
    return JSONResponse({"ok": True})


@router.post("/api/tutor/delete")
def delete_space(x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        con.execute("DELETE FROM classes WHERE id IN (SELECT class_id FROM tutor_students WHERE tutor_id = ?)", (t["id"],))
        con.execute("DELETE FROM tutors WHERE id = ?", (t["id"],))
    return JSONResponse({"ok": True})


# ── endpoints: students ───────────────────────────────────────────────────────

def _attempts(con: sqlite3.Connection, class_id: int) -> list:
    return con.execute("SELECT a.topic, a.item, a.form, a.correct, a.source, a.mode, a.at FROM attempts a "
                       "JOIN students s ON s.id = a.student_id WHERE s.class_id = ? ORDER BY a.at, a.id",
                       (class_id,)).fetchall()


def _new_key(con: sqlite3.Connection, class_id: int, name: str) -> str:
    """Give the student a fresh personal key (old links and devices stop working)."""
    key = secrets.token_urlsafe(24)
    now = _now()
    row = con.execute("SELECT id FROM students WHERE class_id = ?", (class_id,)).fetchone()
    if row:
        con.execute("UPDATE students SET token_hash = ?, nickname = ? WHERE id = ?", (_hash(key), name, row["id"]))
    else:
        con.execute("INSERT INTO students (class_id, nickname, token_hash, created, last_active) VALUES (?,?,?,?,?)",
                    (class_id, name, _hash(key), now, now))
    return key


@router.post("/api/tutor/student/add")
def add_student(body: StudentAdd, request: Request, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if limited("join", _ip(request)):
        return _err(429, "too_many")
    name = classes.clean_nickname(body.name)
    if not name:
        return _err(400, "bad_name")
    now = _now()
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        if not t:
            return _err(404, "unknown_space")
        n = con.execute("SELECT COUNT(*) FROM tutor_students WHERE tutor_id = ?", (t["id"],)).fetchone()[0]
        if n >= MAX_STUDENTS:
            return _err(409, "space_full")
        for _ in range(20):          # a hidden class of one; its code is never shown
            code = "".join(secrets.choice(classes.CODE_ALPHABET) for _ in range(classes.CODE_LEN))
            try:
                cur = con.execute("INSERT INTO classes (code, name, lang, teacher_hash, created, last_active) "
                                  "VALUES (?,?,?,?,?,?)",
                                  (code, name, t["lang"], _hash(secrets.token_urlsafe(24)), now, now))
                break
            except sqlite3.IntegrityError:
                continue
        else:
            return _err(500, "no_code")
        class_id = cur.lastrowid
        cur = con.execute("INSERT INTO tutor_students (tutor_id, class_id, name, level, goals, adult, created) VALUES (?,?,?,?,?,?,?)",
                          (t["id"], class_id, name, _clean(body.level, 20), _clean(body.goals, 600), 1 if body.adult else 0, now))
        key = _new_key(con, class_id, name)
        _touch(con, t["id"])
    return JSONResponse({"ok": True, "id": cur.lastrowid, "name": name, "student_key": key})


@router.get("/api/tutor/student")
def get_student(id: int, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], id)
        if not s:
            return _err(404, "unknown_student")
        att = _attempts(con, s["class_id"])
        set_rows = {r["topic"]: dict(r) for r in con.execute("SELECT topic, stars, note, updated FROM tutor_stars WHERE ts_id = ?", (s["id"],))}
        lessons = [dict(r) for r in con.execute("SELECT id, day, note FROM tutor_lessons WHERE ts_id = ? ORDER BY day DESC, id DESC", (s["id"],))]
        hw = con.execute("SELECT * FROM tutor_homework WHERE ts_id = ? ORDER BY created DESC", (s["id"],)).fetchall()
        seen = con.execute("SELECT last_active FROM students WHERE class_id = ?", (s["class_id"],)).fetchone()
        wss = con.execute("SELECT * FROM tutor_worksheets WHERE ts_id = ? ORDER BY created DESC LIMIT 20", (s["id"],)).fetchall()
        live = con.execute("SELECT worksheet_id FROM tutor_live WHERE ts_id = ?", (s["id"],)).fetchone()
    summ = topic_summary(att)
    topics = {}
    for tp in set(summ) | set(set_rows):
        m = summ.get(tp, {"measured": 0, "answers": 0, "correct_pct": None, "last": None, "practise": []})
        r = set_rows.get(tp, {})
        topics[tp] = dict(m, set=r.get("stars"), note=r.get("note", ""),
                          stars=r["stars"] if r.get("stars") is not None else m["measured"])
    sources: dict[str, int] = defaultdict(int)
    for a in att:
        sources[a["source"] or "other"] += 1
    return JSONResponse({"ok": True, "student": {
        "id": s["id"], "name": s["name"], "level": s["level"], "goals": s["goals"], "notes": s["notes"],
        "adult": bool(s["adult"]), "report_note": s["report_note"], "has_report": bool(s["report_hash"]),
        "created": s["created"], "last_active": seen["last_active"] if (seen and att) else None,
        "answers": len(att)},
        "topics": topics, "lessons": lessons,
        "homework": [dict(id=h["id"], topic=h["topic"], target=h["target"], goal=h["goal"], difficulty=h["difficulty"],
                          glang=h["glang"], note=h["note"], created=h["created"], **homework_progress(h, att)) for h in hw],
        "sources": sorted(sources.items(), key=lambda kv: -kv[1]),
        "worksheets": [_ws_out(w, with_answers=False) for w in wss],
        "live": {"worksheet_id": live["worksheet_id"]} if live else None,
        "plan": s["plan"] or ""})


@router.post("/api/tutor/student/update")
def update_student(body: StudentUpdate, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        name = s["name"]
        if body.name is not None:
            name = classes.clean_nickname(body.name)
            if not name:
                return _err(400, "bad_name")
        con.execute("UPDATE tutor_students SET name = ?, level = ?, goals = ?, notes = ?, adult = ?, report_note = ? WHERE id = ?",
                    (name,
                     _clean(body.level, 20) if body.level is not None else s["level"],
                     _clean(body.goals, 600) if body.goals is not None else s["goals"],
                     (body.notes or "").replace("\r", "")[:4000] if body.notes is not None else s["notes"],
                     (1 if body.adult else 0) if body.adult is not None else s["adult"],
                     (body.report_note or "").replace("\r", "").strip()[:1000] if body.report_note is not None else s["report_note"],
                     s["id"]))
        con.execute("UPDATE students SET nickname = ? WHERE class_id = ?", (name, s["class_id"]))
        con.execute("UPDATE classes SET name = ? WHERE id = ?", (name, s["class_id"]))
    return JSONResponse({"ok": True})


@router.post("/api/tutor/student/stars")
def set_stars(body: StarsBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if body.topic not in classes.TOPICS:
        return _err(400, "bad_topic")
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("INSERT INTO tutor_stars (ts_id, topic, stars, note, updated) VALUES (?,?,?,?,?) "
                    "ON CONFLICT (ts_id, topic) DO UPDATE SET stars = excluded.stars, note = excluded.note, updated = excluded.updated",
                    (s["id"], body.topic, body.stars, _clean(body.note, 300), _now()))
    return JSONResponse({"ok": True})


@router.post("/api/tutor/student/lesson")
def add_lesson(body: LessonBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if not _DATE.fullmatch(body.day) or not body.note.strip():
        return _err(400, "bad_lesson")
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        n = con.execute("SELECT COUNT(*) FROM tutor_lessons WHERE ts_id = ?", (s["id"],)).fetchone()[0]
        if n >= MAX_LESSONS:
            con.execute("DELETE FROM tutor_lessons WHERE id = (SELECT id FROM tutor_lessons WHERE ts_id = ? ORDER BY day, id LIMIT 1)", (s["id"],))
        cur = con.execute("INSERT INTO tutor_lessons (ts_id, day, note) VALUES (?,?,?)",
                          (s["id"], body.day, body.note.replace("\r", "").strip()[:2000]))
    return JSONResponse({"ok": True, "lesson_id": cur.lastrowid})


@router.post("/api/tutor/student/lesson-delete")
def delete_lesson(body: ItemRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("DELETE FROM tutor_lessons WHERE id = ? AND ts_id = ?", (body.item_id, s["id"]))
    return JSONResponse({"ok": True})


@router.post("/api/tutor/student/homework")
def add_homework(body: HomeworkBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if body.topic not in classes.TOPICS or (body.target and not _TARGET.fullmatch(body.target)):
        return _err(400, "bad_homework")
    glang = body.glang if body.glang in ("de", "es", "en") else None
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        n = con.execute("SELECT COUNT(*) FROM tutor_homework WHERE ts_id = ?", (s["id"],)).fetchone()[0]
        if n >= MAX_HOMEWORK:
            con.execute("DELETE FROM tutor_homework WHERE id = (SELECT id FROM tutor_homework WHERE ts_id = ? ORDER BY created LIMIT 1)", (s["id"],))
        cur = con.execute("INSERT INTO tutor_homework (ts_id, topic, target, goal, difficulty, glang, note, created) VALUES (?,?,?,?,?,?,?,?)",
                          (s["id"], body.topic, body.target, body.goal, body.difficulty, glang, _clean(body.note, 300), _now()))
    return JSONResponse({"ok": True, "homework_id": cur.lastrowid})


@router.post("/api/tutor/student/homework-delete")
def delete_homework(body: ItemRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("DELETE FROM tutor_homework WHERE id = ? AND ts_id = ?", (body.item_id, s["id"]))
    return JSONResponse({"ok": True})


@router.post("/api/tutor/student/new-link")
def new_link(body: StudentRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        key = _new_key(con, s["class_id"], s["name"])
    return JSONResponse({"ok": True, "student_key": key})


@router.post("/api/tutor/student/remove")
def remove_student(body: StudentRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("DELETE FROM classes WHERE id = ?", (s["class_id"],))     # cascades to everything
    return JSONResponse({"ok": True})


# ── endpoint: the student's own page ─────────────────────────────────────────

@router.get("/api/tutor/me")
def student_me(x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        st = con.execute("SELECT s.class_id, c.code FROM students s JOIN classes c ON c.id = s.class_id "
                         "WHERE s.token_hash = ?", (_hash(x_student_token or "-"),)).fetchone()
        ts = st and con.execute("SELECT ts.*, t.name AS tutor_name FROM tutor_students ts JOIN tutors t ON t.id = ts.tutor_id "
                                "WHERE ts.class_id = ?", (st["class_id"],)).fetchone()
        if not ts:
            return _err(404, "unknown_student")
        att = _attempts(con, ts["class_id"])
        hw = con.execute("SELECT * FROM tutor_homework WHERE ts_id = ? ORDER BY created DESC LIMIT 10", (ts["id"],)).fetchall()
    return JSONResponse({"ok": True, "name": ts["name"], "tutor_name": ts["tutor_name"], "adult": bool(ts["adult"]),
                         "code": classes.format_code(st["code"]),
                         "homework": [dict(id=h["id"], topic=h["topic"], target=h["target"], goal=h["goal"], difficulty=h["difficulty"],
                                           glang=h["glang"], note=h["note"], created=h["created"],
                                           **homework_progress(h, att)) for h in hw]})


# ── parents' report (read-only link, #r=… ) ──────────────────────────────────

@router.post("/api/tutor/student/report-link")
def report_link(body: StudentRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    """A new read-only link for the parents (the old one stops working)."""
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        key = secrets.token_urlsafe(24)
        con.execute("UPDATE tutor_students SET report_hash = ? WHERE id = ?", (_hash(key), s["id"]))
    return JSONResponse({"ok": True, "report_key": key})


@router.get("/api/report")
def parent_report(x_report_key: str = Header("", max_length=64)) -> JSONResponse:
    """What parents see: stars, homework progress, lessons count, the tutor's note
    for parents. Never the tutor's private notes or per-topic notes."""
    with _lock, connect() as con:
        ts = con.execute("SELECT ts.*, t.name AS tutor_name FROM tutor_students ts JOIN tutors t ON t.id = ts.tutor_id "
                         "WHERE ts.report_hash = ?", (_hash(x_report_key or "-"),)).fetchone()
        if not ts:
            return _err(404, "unknown_report")
        att = _attempts(con, ts["class_id"])
        set_stars = {r["topic"]: r["stars"] for r in con.execute("SELECT topic, stars FROM tutor_stars WHERE ts_id = ?", (ts["id"],))}
        hw = con.execute("SELECT * FROM tutor_homework WHERE ts_id = ? ORDER BY created DESC LIMIT 10", (ts["id"],)).fetchall()
        lessons = con.execute("SELECT day FROM tutor_lessons WHERE ts_id = ? ORDER BY day DESC", (ts["id"],)).fetchall()
    summ = topic_summary(att)
    topics = {}
    for tp in set(summ) | {k for k, v in set_stars.items() if v is not None}:
        m = summ.get(tp, {"measured": 0, "answers": 0, "correct_pct": None})
        topics[tp] = {"stars": set_stars[tp] if set_stars.get(tp) is not None else m["measured"],
                      "answers": m["answers"], "correct_pct": m["correct_pct"]}
    now = datetime.now(timezone.utc)
    weeks = []
    for w in range(4):          # answers per week, this week first
        hi = (now - timedelta(days=7 * w)).isoformat()
        lo = (now - timedelta(days=7 * (w + 1))).isoformat()
        weeks.append(sum(1 for a in att if lo <= a["at"] < hi))
    return JSONResponse({"ok": True, "name": ts["name"], "tutor_name": ts["tutor_name"], "adult": bool(ts["adult"]),
                         "note": ts["report_note"], "topics": topics, "weeks": weeks,
                         "lessons": len(lessons), "last_lesson": lessons[0]["day"] if lessons else None,
                         "homework": [dict(topic=h["topic"], goal=h["goal"], note=h["note"], created=h["created"],
                                           **homework_progress(h, att)) for h in hw]})


# ── profile saved to the student's key (figure, shells, gifts, stats, game saves) ──
# Any student with a token (teacher classes and tutor students) can save. The data
# is opaque to the server: { "<localStorage key>": {"v": "<string>", "at": "<iso>"} }.

def _student_id(con: sqlite3.Connection, token: str):
    row = con.execute("SELECT id FROM students WHERE token_hash = ?", (_hash(token or "-"),)).fetchone()
    return row["id"] if row else None


@router.get("/api/profile")
def get_profile(x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        sid = _student_id(con, x_student_token)
        if not sid:
            return _err(401, "not_in_class")
        row = con.execute("SELECT data, updated FROM student_profiles WHERE student_id = ?", (sid,)).fetchone()
    import json
    return JSONResponse({"ok": True, "data": json.loads(row["data"]) if row else {}, "updated": row["updated"] if row else None})


@router.post("/api/profile")
async def post_profile(request: Request, x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    """Merge changed keys: {"changes": {"<key>": "<value string>" | null}, "token"?: …}.
    Raw body so it also works from sendBeacon (token in the body)."""
    import json
    if limited("answers", _ip(request)):
        return _err(429, "too_many")
    raw = await request.body()
    if len(raw) > PROFILE_MAX + 4096:
        return _err(413, "too_big")
    try:
        body = json.loads(raw)
        changes = body.get("changes") or {}
        assert isinstance(changes, dict)
    except Exception:  # noqa: BLE001
        return _err(400, "bad_body")
    token = x_student_token or str(body.get("token") or "")[:64]
    now = _now()
    with _lock, connect() as con:
        sid = _student_id(con, token)
        if not sid:
            return _err(401, "not_in_class")
        row = con.execute("SELECT data FROM student_profiles WHERE student_id = ?", (sid,)).fetchone()
        data = json.loads(row["data"]) if row else {}
        for k, v in changes.items():
            if not _PKEY.fullmatch(str(k)):
                continue
            if v is None:
                data.pop(k, None)
            elif isinstance(v, str):
                data[k] = {"v": v, "at": now}
        out = json.dumps(data, separators=(",", ":"))
        if len(out) > PROFILE_MAX:
            return _err(413, "too_big")
        con.execute("INSERT INTO student_profiles (student_id, data, updated) VALUES (?,?,?) "
                    "ON CONFLICT (student_id) DO UPDATE SET data = excluded.data, updated = excluded.updated",
                    (sid, out, now))
    return JSONResponse({"ok": True, "updated": now})


# ── interactive worksheets (made by the tutor, filled in by the student) ────────
import json as _json

MAX_WS_QUESTIONS = 30
WS_MAX_BYTES = 40 * 1024
_WS_MODES = ("typed", "choice", "mixed")


class WsQuestion(BaseModel):
    item: str = Field(..., max_length=80)
    form: str = Field("default", max_length=40)
    sentence: str = Field(..., max_length=300)
    hint: str = Field("", max_length=200)
    answer: str = Field(..., max_length=80)
    accepts: list[str] = Field(default_factory=list, max_length=8)
    options: list[str] = Field(default_factory=list, max_length=6)
    teach: str = Field("", max_length=400)


class WorksheetBody(BaseModel):
    id: int
    topic: str = Field(..., max_length=40)
    title: str = Field("", max_length=80)
    mode: str = Field("typed", max_length=10)
    questions: list[WsQuestion] = Field(..., min_length=1, max_length=MAX_WS_QUESTIONS)


class WsRef(BaseModel):
    id: int
    worksheet_id: int


def _ws_out(w, with_answers=True) -> dict:
    qs = _json.loads(w["questions"])
    ans = _json.loads(w["answers"] or "{}")
    done = len(ans)
    right = sum(1 for a in ans.values() if a.get("correct"))
    out = {"id": w["id"], "topic": w["topic"], "title": w["title"], "mode": w["mode"], "created": w["created"],
           "count": len(qs), "done": done, "right": right}
    if with_answers:
        out["questions"] = qs
        out["answers"] = ans
    return out


@router.post("/api/tutor/student/worksheet")
def add_worksheet(body: WorksheetBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if body.topic not in classes.TOPICS or body.mode not in _WS_MODES:
        return _err(400, "bad_worksheet")
    qs = [q.model_dump() for q in body.questions]
    raw = _json.dumps(qs, ensure_ascii=False)
    if len(raw.encode()) > WS_MAX_BYTES:
        return _err(413, "too_big")
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        n = con.execute("SELECT COUNT(*) FROM tutor_worksheets WHERE ts_id = ?", (s["id"],)).fetchone()[0]
        if n >= MAX_HOMEWORK:
            con.execute("DELETE FROM tutor_worksheets WHERE id = (SELECT id FROM tutor_worksheets WHERE ts_id = ? ORDER BY created LIMIT 1)", (s["id"],))
        cur = con.execute("INSERT INTO tutor_worksheets (ts_id, topic, title, mode, questions, created) VALUES (?,?,?,?,?,?)",
                          (s["id"], body.topic, _clean(body.title, 80), body.mode, raw, _now()))
    return JSONResponse({"ok": True, "worksheet_id": cur.lastrowid})


@router.get("/api/tutor/student/worksheet")
def get_worksheet(id: int, worksheet_id: int, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], id)
        w = s and con.execute("SELECT * FROM tutor_worksheets WHERE id = ? AND ts_id = ?", (worksheet_id, s["id"])).fetchone()
        if not w:
            return _err(404, "unknown_worksheet")
    return JSONResponse({"ok": True, "worksheet": _ws_out(w)})


@router.post("/api/tutor/student/worksheet-delete")
def delete_worksheet(body: WsRef, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("DELETE FROM tutor_worksheets WHERE id = ? AND ts_id = ?", (body.worksheet_id, s["id"]))
    return JSONResponse({"ok": True})


def _student_ts(con, token: str):
    st = con.execute("SELECT class_id FROM students WHERE token_hash = ?", (_hash(token or "-"),)).fetchone()
    return st and con.execute("SELECT * FROM tutor_students WHERE class_id = ?", (st["class_id"],)).fetchone()


@router.get("/api/tutor/me/worksheet")
def me_worksheet(worksheet_id: int, x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        ts = _student_ts(con, x_student_token)
        w = ts and con.execute("SELECT * FROM tutor_worksheets WHERE id = ? AND ts_id = ?", (worksheet_id, ts["id"])).fetchone()
        if not w:
            return _err(404, "unknown_worksheet")
    return JSONResponse({"ok": True, "worksheet": _ws_out(w)})


class WsAnswer(BaseModel):
    worksheet_id: int
    index: int = Field(..., ge=0, lt=MAX_WS_QUESTIONS)
    given: str = Field("", max_length=80)
    correct: bool


@router.post("/api/tutor/me/worksheet-answer")
def me_worksheet_answer(body: WsAnswer, request: Request, x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    """First try per question counts (later tries after a hint are practice)."""
    if limited("answers", _ip(request)):
        return _err(429, "too_many")
    with _lock, connect() as con:
        ts = _student_ts(con, x_student_token)
        w = ts and con.execute("SELECT * FROM tutor_worksheets WHERE id = ? AND ts_id = ?", (body.worksheet_id, ts["id"])).fetchone()
        if not w:
            return _err(404, "unknown_worksheet")
        if body.index >= len(_json.loads(w["questions"])):
            return _err(400, "bad_index")
        ans = _json.loads(w["answers"] or "{}")
        key = str(body.index)
        if key not in ans:
            ans[key] = {"given": body.given.strip()[:80], "correct": bool(body.correct), "at": _now()}
            con.execute("UPDATE tutor_worksheets SET answers = ? WHERE id = ?", (_json.dumps(ans, ensure_ascii=False), w["id"]))
    return JSONResponse({"ok": True})


@router.get("/api/tutor/me/worksheets")
def me_worksheets(x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        ts = _student_ts(con, x_student_token)
        if not ts:
            return _err(404, "unknown_student")
        rows = con.execute("SELECT * FROM tutor_worksheets WHERE ts_id = ? ORDER BY created DESC LIMIT 20", (ts["id"],)).fetchall()
    return JSONResponse({"ok": True, "worksheets": [_ws_out(w, with_answers=False) for w in rows]})


# ── live lesson: the tutor shows a worksheet on the student's screen, sends rewards ──

class LiveBody(BaseModel):
    id: int
    worksheet_id: Optional[int] = None          # None = stop


class RewardBody(BaseModel):
    id: int
    kind: str = Field("star", max_length=10)     # star | gift
    text: str = Field("", max_length=120)


@router.post("/api/tutor/student/live")
def set_live(body: LiveBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        if body.worksheet_id is None:
            con.execute("DELETE FROM tutor_live WHERE ts_id = ?", (s["id"],))
            return JSONResponse({"ok": True, "live": None})
        if not con.execute("SELECT 1 FROM tutor_worksheets WHERE id = ? AND ts_id = ?", (body.worksheet_id, s["id"])).fetchone():
            return _err(404, "unknown_worksheet")
        row = con.execute("SELECT events FROM tutor_live WHERE ts_id = ?", (s["id"],)).fetchone()
        con.execute("INSERT INTO tutor_live (ts_id, worksheet_id, started, events) VALUES (?,?,?,?) "
                    "ON CONFLICT (ts_id) DO UPDATE SET worksheet_id = excluded.worksheet_id, started = excluded.started",
                    (s["id"], body.worksheet_id, _now(), row["events"] if row else "[]"))
    return JSONResponse({"ok": True, "live": {"worksheet_id": body.worksheet_id}})


@router.post("/api/tutor/student/reward")
def send_reward(body: RewardBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    kind = body.kind if body.kind in ("star", "gift") else "star"
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        row = con.execute("SELECT events FROM tutor_live WHERE ts_id = ?", (s["id"],)).fetchone()
        ev = _json.loads(row["events"]) if row else []
        seq = (ev[-1]["seq"] + 1) if ev else 1
        ev = (ev + [{"seq": seq, "kind": kind, "text": _clean(body.text, 120), "at": _now()}])[-20:]
        con.execute("INSERT INTO tutor_live (ts_id, worksheet_id, started, events) VALUES (?,?,?,?) "
                    "ON CONFLICT (ts_id) DO UPDATE SET events = excluded.events",
                    (s["id"], None, _now(), _json.dumps(ev, ensure_ascii=False)))
    return JSONResponse({"ok": True, "seq": seq})


@router.get("/api/tutor/me/live")
def me_live(since: int = 0, x_student_token: str = Header("", max_length=64)) -> JSONResponse:
    """Polled by the student's page every few seconds while it is open."""
    with _lock, connect() as con:
        ts = _student_ts(con, x_student_token)
        if not ts:
            return _err(404, "unknown_student")
        row = con.execute("SELECT * FROM tutor_live WHERE ts_id = ?", (ts["id"],)).fetchone()
    if not row:
        return JSONResponse({"ok": True, "worksheet_id": None, "events": [], "seq": 0})
    ev = _json.loads(row["events"])
    return JSONResponse({"ok": True, "worksheet_id": row["worksheet_id"],
                         "events": [e for e in ev if e["seq"] > since], "seq": ev[-1]["seq"] if ev else 0})


# ── lesson builder: the current plan per student (JSON made by the page) ────────

class PlanBody(BaseModel):
    id: int
    plan: str = Field("", max_length=20000)     # JSON string, "" = no plan


@router.post("/api/tutor/student/plan")
def save_plan(body: PlanBody, x_tutor_token: str = Header("", max_length=64)) -> JSONResponse:
    if body.plan:
        try:
            assert isinstance(_json.loads(body.plan), dict)
        except Exception:  # noqa: BLE001
            return _err(400, "bad_plan")
    with _lock, connect() as con:
        t = _tutor(con, x_tutor_token)
        s = t and _student(con, t["id"], body.id)
        if not s:
            return _err(404, "unknown_student")
        con.execute("UPDATE tutor_students SET plan = ? WHERE id = ?", (body.plan, s["id"]))
    return JSONResponse({"ok": True})
