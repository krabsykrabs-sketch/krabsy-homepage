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
"""


def init_db() -> None:
    with _lock, connect() as con:
        con.executescript(SCHEMA)
        cols = {r["name"] for r in con.execute("PRAGMA table_info(attempts)")}
        if "mode" not in cols:                       # how the answer was given
            con.execute("ALTER TABLE attempts ADD COLUMN mode TEXT")


def purge_inactive(now: Optional[datetime] = None) -> int:
    """Delete tutor spaces idle for RETENTION_DAYS, with their students' classes."""
    cutoff = ((now or datetime.now(timezone.utc)) - timedelta(days=classes.RETENTION_DAYS)).isoformat(timespec="seconds")
    with _lock, connect() as con:
        ids = [r["id"] for r in con.execute("SELECT id FROM tutors WHERE last_active < ?", (cutoff,))]
        for tid in ids:
            con.execute("DELETE FROM classes WHERE id IN (SELECT class_id FROM tutor_students WHERE tutor_id = ?)", (tid,))
            con.execute("DELETE FROM tutors WHERE id = ?", (tid,))
        return len(ids)


def _clean(raw: str, n: int) -> str:
    return re.sub(r"[ \t]+", " ", (raw or "").replace("\r", "")).strip()[:n]


def _tutor(con: sqlite3.Connection, token: str):
    return con.execute("SELECT * FROM tutors WHERE tutor_hash = ?", (_hash(token or "-"),)).fetchone()


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


class StudentRef(BaseModel):
    id: int


class StudentUpdate(BaseModel):
    id: int
    name: Optional[str] = Field(None, max_length=40)
    level: Optional[str] = Field(None, max_length=40)
    goals: Optional[str] = Field(None, max_length=600)
    notes: Optional[str] = Field(None, max_length=4000)


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
    target: str = Field(..., max_length=50)
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
            out.append({"id": s["id"], "name": s["name"], "level": s["level"],
                        "last_active": s["seen"] if att else None,
                        "answers_week": sum(1 for a in att if a["at"] >= week_ago),
                        "answers": len(att), "stars": stars})
    return JSONResponse({"ok": True, "space": {"name": t["name"], "lang": t["lang"], "created": t["created"],
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
        cur = con.execute("INSERT INTO tutor_students (tutor_id, class_id, name, level, goals, created) VALUES (?,?,?,?,?,?)",
                          (t["id"], class_id, name, _clean(body.level, 20), _clean(body.goals, 600), now))
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
        "created": s["created"], "last_active": seen["last_active"] if (seen and att) else None,
        "answers": len(att)},
        "topics": topics, "lessons": lessons,
        "homework": [dict(id=h["id"], topic=h["topic"], target=h["target"], difficulty=h["difficulty"],
                          glang=h["glang"], note=h["note"], created=h["created"], **homework_progress(h, att)) for h in hw],
        "sources": sorted(sources.items(), key=lambda kv: -kv[1])})


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
        con.execute("UPDATE tutor_students SET name = ?, level = ?, goals = ?, notes = ? WHERE id = ?",
                    (name,
                     _clean(body.level, 20) if body.level is not None else s["level"],
                     _clean(body.goals, 600) if body.goals is not None else s["goals"],
                     (body.notes or "").replace("\r", "")[:4000] if body.notes is not None else s["notes"],
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
    if body.topic not in classes.TOPICS or not _TARGET.fullmatch(body.target):
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
        cur = con.execute("INSERT INTO tutor_homework (ts_id, topic, target, difficulty, glang, note, created) VALUES (?,?,?,?,?,?,?)",
                          (s["id"], body.topic, body.target, body.difficulty, glang, _clean(body.note, 300), _now()))
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
    return JSONResponse({"ok": True, "name": ts["name"], "tutor_name": ts["tutor_name"],
                         "code": classes.format_code(st["code"]),
                         "homework": [dict(id=h["id"], topic=h["topic"], target=h["target"], difficulty=h["difficulty"],
                                           glang=h["glang"], note=h["note"], created=h["created"],
                                           **homework_progress(h, att)) for h in hw]})
