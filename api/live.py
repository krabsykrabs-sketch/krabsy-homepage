"""Krabsy live classroom: one WebSocket relay room per tutor student (docs/live-classroom.md).

Zoom stays for face and voice; both computers render the material themselves and
only small messages travel through here: the student's state, pointer and answers
to the tutor, the tutor's commands to the student. Memory only (single uvicorn
process, like the Quiz Room): a room lives ROOM_TTL_S after its last message.

One endpoint:  WS /api/live/ws   (JSON messages, field "t" = type)

Hello (first message)
  tutor   {t:hello, role:tutor, token, student:<tutor_students.id>}
  student {t:hello, role:student, key}
  → ready {role, name, tutor, adult, lesson}   lesson = snapshot or null
  → error {code: auth|busy|bad} and close
Tutor → student      start {items?, index?} · end {summary?} · load {material, items?, index?}
                     cmd {type, step?, page?} · point {a, x, y} · reward {kind}
                     queue {items, index}   (stored for the tutor's reload, not relayed)
Student → tutor      state {state} · cursor {a, x, y} · answer {…} · focus {visible}
Server → both        presence {tutor, student, visible} · ping (every PING_S)
Either may send      ping → pong
Non-fatal errors     error {code: too_big} (load material > MAX_MATERIAL, state > MAX_STATE
                     or message > MAX_MSG)
A second connection of the same role replaces the first: the old one gets
error {code: replaced} and is closed (clients must not auto-reconnect after that).

Room life (review 2026-11-26): a room belongs to one tutor_students row (id + tutor + class +
created, so a reused id never sees an old lesson). It is deleted as soon as nobody is connected
if it never had a lesson (an ended lesson keeps only its summary, no answers), swept 3 h after its last message (checked at most every SWEEP_S), and
dropped at once when the student is removed / the space deleted (drop_room, from tutors.py).
A new student link closes the open student socket; every socket re-checks its credential every
RECHECK_S (logout, removed student). Per tutor at most MAX_LESSONS_PER_TUTOR running lessons
(starting one more ends the tutor's longest-idle one), per IP at most CONNS_PER_IP sockets.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import tutors
from classes import _lock, connect
from quiz_room import Outbox, OUTBOX_POS_LIMIT, _ip, _origin_ok

router = APIRouter()

MAX_MSG = 256 * 1024          # bytes of one message
MAX_MATERIAL = 200 * 1024     # bytes of one material (load)
MAX_STATE = 64 * 1024         # bytes of one student state (real ones are a few KB)
MAX_ANSWER = 2000             # bytes of one answer
MAX_ANSWERS_BYTES = 160 * 1024  # all answers kept in a lesson snapshot
OUTBOX_BYTES = 2 * 1024 * 1024  # a connection this far behind is cut off (it reconnects)
MSGS_PER_S = 60               # per connection; more are dropped
CURSOR_PER_S = 20             # cursor/point per connection; more are dropped
MAX_ROOMS = 500
MAX_LESSONS_PER_TUTOR = 3     # running lessons at once
CONNS_PER_IP = 60             # open live sockets per IP
ROOM_TTL_S = 3 * 3600         # after the last message
SWEEP_S = 600.0               # sweep at most this often (from hellos and pings)
RECHECK_S = 60.0              # each socket re-checks its token / key this often
PING_S = 25.0
MAX_ANSWERS = 400             # answers kept in the lesson snapshot (tutor reload)
MAX_ITEMS = 60                # lesson queue entries
CMD_TYPES = {"hint", "reveal", "next", "prev", "goto", "act"}
ACT_KINDS = {"click", "type", "enter"}   # the tutor does it on the student's screen (2026-11-27)
_ANCHOR = re.compile(r"[\w.:\-]{1,120}", re.UNICODE)
REWARDS = {"star", "gift"}


_STATE_PREFIX = '{"t":"state",'


class _Outbox(Outbox):
    """Quiz Room outbox; cursor updates are dropped first when a device falls behind, only
    the newest unsent state is kept (each one is the full state), and a connection with more
    than OUTBOX_BYTES waiting is cut off (it reconnects and gets the snapshot)."""

    def put(self, msg: Optional[dict]) -> None:
        if self.dead:
            return
        if msg is not None:
            if msg.get("t") == "cursor" and len(self.q) > OUTBOX_POS_LIMIT:
                return
            try:                                # the sender task may pop meanwhile (tests: other thread)
                waiting = list(self.q)
            except RuntimeError:
                waiting = []
            if msg.get("t") == "state":
                for x in waiting:
                    if isinstance(x, str) and x.startswith(_STATE_PREFIX):
                        try:
                            self.q.remove(x)
                        except ValueError:
                            pass
            if sum(len(x) for x in waiting if isinstance(x, str)) > OUTBOX_BYTES:
                self.q.clear()
                msg = None                      # close it
        super().put(msg)


class Room:
    def __init__(self, ts_id: int, ident: tuple = (), tutor_id: Optional[int] = None):
        self.ts_id = ts_id
        self.ident = ident                     # (tutor_id, class_id, created) of the student row
        self.tutor_id = tutor_id
        self.tutor: Optional[WebSocket] = None
        self.student: Optional[WebSocket] = None
        self.visible = True
        self.lesson: Optional[dict] = None
        self.last = time.monotonic()
        self.presence_sent: Optional[tuple] = None
        self.dirty = False                     # lesson changed since the last save
        self.saved_at = 0.0

    def active(self) -> bool:
        return self.lesson is not None and not self.lesson.get("ended")

    def snapshot(self, role: str) -> Optional[dict]:
        if self.lesson is None:
            return None
        if role == "student":
            if not self.active():
                return None
            return {k: self.lesson.get(k) for k in ("started", "material", "state", "items", "index", "state_at")}
        return {k: v for k, v in self.lesson.items() if k != "abytes"}

    def presence(self) -> dict:
        return {"t": "presence", "tutor": self.tutor is not None, "student": self.student is not None,
                "visible": self.student is not None and self.visible}

    def send_presence(self, force_to: Optional[WebSocket] = None) -> None:
        p = self.presence()
        key = (p["tutor"], p["student"], p["visible"])
        if key != self.presence_sent:
            self.presence_sent = key
            send_to(self.tutor, p)
            send_to(self.student, p)
        elif force_to is not None:
            send_to(force_to, p)


ROOMS: dict[int, Room] = {}
OUTBOXES: dict[int, _Outbox] = {}
_IPS: dict[str, int] = {}
_last_sweep = [0.0]


def send_to(ws: Optional[WebSocket], msg: Optional[dict]) -> None:
    ob = OUTBOXES.get(id(ws)) if ws is not None else None
    if ob is not None:
        ob.put(msg)


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sweep(now: Optional[float] = None) -> int:
    """Drop rooms nobody is in whose last message is older than ROOM_TTL_S."""
    now = time.monotonic() if now is None else now
    _last_sweep[0] = now
    old = [k for k, r in list(ROOMS.items())
           if r.tutor is None and r.student is None and now - r.last > ROOM_TTL_S]
    for k in old:
        ROOMS.pop(k, None)
    return len(old)


def maybe_sweep(now: float) -> None:
    if now - _last_sweep[0] >= SWEEP_S:
        sweep(now)


def _make_space() -> bool:
    """Room limit reached: sweep, then drop the longest-idle room nobody is connected to."""
    sweep()
    if len(ROOMS) < MAX_ROOMS:
        return True
    idle = [r for r in ROOMS.values() if r.tutor is None and r.student is None]
    if not idle:
        return False
    ROOMS.pop(min(idle, key=lambda r: r.last).ts_id, None)
    return True


def _forget_if_empty(room: Room) -> None:
    """A room that never had a lesson is gone as soon as nobody is connected (an ended
    lesson keeps its short snapshot, without the answers, until the sweep)."""
    if room.tutor is None and room.student is None and room.lesson is None and ROOMS.get(room.ts_id) is room:
        ROOMS.pop(room.ts_id, None)


def _close(ws: Optional[WebSocket], code: str) -> None:
    send_to(ws, {"t": "error", "code": code})
    send_to(ws, None)


def drop_room(ts_id: int, student_only: bool = False) -> None:
    """The student row changed (removed, space deleted) or got a new key (student_only):
    close the sockets with error auth; a removed student's room (and lesson) is deleted.
    Called from the tutors endpoints (another thread): only queue messages and pop."""
    room = ROOMS.get(ts_id)
    if room is None:
        return
    st = room.student
    room.student = None
    _close(st, "auth")
    if student_only:
        room.send_presence()
        return
    tu = room.tutor
    room.tutor = None
    _close(tu, "auth")
    ROOMS.pop(ts_id, None)
    # (its saved copy in live_lessons is ignored later: the identity no longer matches.
    #  No database call here: the caller holds classes._lock.)


def _end_lesson(room: Room, summary=None) -> None:
    room.lesson["ended"], room.lesson["summary"] = _iso(), summary
    room.lesson["material"], room.lesson["state"] = None, None
    room.lesson["answers"], room.lesson["abytes"] = [], 0     # saved in the lesson note; not kept here
    send_to(room.student, {"t": "end", "summary": summary})


def _lesson_slot(room: Room) -> None:
    """Before a new lesson: at most MAX_LESSONS_PER_TUTOR running per tutor; the tutor's
    longest-idle other one is ended."""
    mine = [r for r in ROOMS.values() if r is not room and r.tutor_id == room.tutor_id and r.active()]
    while len(mine) >= MAX_LESSONS_PER_TUTOR:
        old = min(mine, key=lambda r: r.last)
        _end_lesson(old)
        mine.remove(old)


def _same_state_id(room: Room, st) -> bool:
    """A state for the previous material (still on its way after a load) is dropped."""
    mat = room.lesson and room.lesson.get("material")
    mid = mat.get("id") if isinstance(mat, dict) else None
    sid = st.get("id") if isinstance(st, dict) else None
    return not (mid and sid and mid != sid)


def _ident(ts) -> tuple:
    return (ts["tutor_id"], ts["class_id"], ts["created"])


def _still_ok(role: str, cred: str, ts_id: int, ident: tuple) -> bool:
    """Re-check an open socket: the token / key still leads to the same student row."""
    try:
        with _lock, connect() as con:
            if role == "tutor":
                t = tutors._tutor(con, cred)
                ts = t and tutors._student(con, t["id"], ts_id)
            else:
                ts = tutors._student_ts(con, cred)
            return bool(ts) and ts["id"] == ts_id and _ident(ts) == ident
    except Exception:
        return True                            # a DB hiccup never throws a lesson out


def _auth(msg: dict):
    """→ (role, ts row, tutor name) or None."""
    role = msg.get("role")
    with _lock, connect() as con:
        if role == "tutor":
            token, sid = msg.get("token"), msg.get("student")
            if not isinstance(token, str) or not token or len(token) > 64 or isinstance(sid, bool):
                return None
            try:
                sid = int(sid)
            except (TypeError, ValueError):
                return None
            t = tutors._tutor(con, token)
            ts = t and tutors._student(con, t["id"], sid)
            if not ts:
                return None
            tutors._touch(con, t["id"])
            return role, ts, t["name"]
        if role == "student":
            key = msg.get("key")
            if not isinstance(key, str) or not key or len(key) > 64:
                return None
            ts = tutors._student_ts(con, key)
            if not ts:
                return None
            t = con.execute("SELECT name FROM tutors WHERE id = ?", (ts["tutor_id"],)).fetchone()
            return role, ts, t["name"] if t else ""
    return None


def _num01(v) -> Optional[float]:
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != v:
        return None
    return round(max(0.0, min(1.0, float(v))), 4)


def _pos(msg: dict) -> Optional[dict]:
    a = msg.get("a")
    x, y = _num01(msg.get("x")), _num01(msg.get("y"))
    if not isinstance(a, str) or not 0 < len(a) <= 80 or x is None or y is None:
        return None
    return {"a": a, "x": x, "y": y}


def _int(v) -> Optional[int]:
    return v if isinstance(v, int) and not isinstance(v, bool) and -1 <= v < 10000 else None


def _queue(room: Room, msg: dict) -> None:
    items = msg.get("items")
    if isinstance(items, list):
        room.lesson["items"] = items[:MAX_ITEMS]
    idx = _int(msg.get("index"))
    if idx is not None:
        room.lesson["index"] = idx


def _new_lesson() -> dict:
    return {"started": _iso(), "material": None, "state": None, "items": [], "index": -1,
            "answers": [], "ended": None, "summary": None}


# ── a running lesson survives a server restart (owner 2026-11-27: "save the progress of an
# ongoing live session regularly"): the lesson (material, the student's state, queue, answers)
# is written to SQLite at most every SAVE_EVERY_S while it changes, and at once on end /
# disconnect; a new room for that student loads it back (if not older than ROOM_TTL_S).
SAVE_EVERY_S = 2.0
_db_ready = [False]


def _db():
    import classes
    con = classes.connect()
    if not _db_ready[0]:
        con.execute("CREATE TABLE IF NOT EXISTS live_lessons (ts_id INTEGER PRIMARY KEY, ident TEXT NOT NULL, "
                    "tutor_id INTEGER, lesson TEXT NOT NULL, updated REAL NOT NULL)")
        _db_ready[0] = True
    return con


def save_lesson(room: "Room", force: bool = False) -> None:
    if not force and (not room.dirty or time.time() - room.saved_at < SAVE_EVERY_S):
        return
    room.dirty, room.saved_at = False, time.time()
    try:
        import classes
        with classes._lock, _db() as con:
            if room.active():
                con.execute("INSERT INTO live_lessons (ts_id, ident, tutor_id, lesson, updated) VALUES (?,?,?,?,?) "
                            "ON CONFLICT (ts_id) DO UPDATE SET ident = excluded.ident, tutor_id = excluded.tutor_id, "
                            "lesson = excluded.lesson, updated = excluded.updated",
                            (room.ts_id, json.dumps(list(room.ident)), room.tutor_id,
                             json.dumps(room.lesson, separators=(",", ":")), time.time()))
            else:
                con.execute("DELETE FROM live_lessons WHERE ts_id = ?", (room.ts_id,))
    except Exception as exc:  # noqa: BLE001  (never break a lesson because of the backup)
        print(f"[krabsy] live: save failed: {exc}", flush=True)


def restore_lesson(room: "Room") -> None:
    try:
        import classes
        with classes._lock, _db() as con:
            row = con.execute("SELECT ident, lesson, updated FROM live_lessons WHERE ts_id = ?", (room.ts_id,)).fetchone()
            if row is None:
                return
            if time.time() - row["updated"] > ROOM_TTL_S or json.loads(row["ident"]) != list(room.ident):
                con.execute("DELETE FROM live_lessons WHERE ts_id = ?", (room.ts_id,))
                return
        lesson = json.loads(row["lesson"])
        if isinstance(lesson, dict) and not lesson.get("ended"):
            room.lesson = lesson
    except Exception as exc:  # noqa: BLE001
        print(f"[krabsy] live: restore failed: {exc}", flush=True)


def _forget_saved(ts_id: int) -> None:
    """Delete a saved lesson (never call this while holding classes._lock)."""
    try:
        import classes
        with classes._lock, _db() as con:
            con.execute("DELETE FROM live_lessons WHERE ts_id = ?", (ts_id,))
    except Exception:  # noqa: BLE001
        pass


@router.websocket("/api/live/ws")
async def live_ws(ws: WebSocket):
    if not _origin_ok(ws):
        await ws.close(code=1008)
        return
    ip = _ip(ws)
    if _IPS.get(ip, 0) >= CONNS_PER_IP:
        await ws.close(code=1013)
        return
    _IPS[ip] = _IPS.get(ip, 0) + 1
    await ws.accept()
    ob = _Outbox(ws)
    OUTBOXES[id(ws)] = ob
    role: Optional[str] = None
    room: Optional[Room] = None
    cred = ""
    window, count, cwindow, ccount = time.monotonic(), 0, time.monotonic(), 0

    async def pinger():
        checked = time.monotonic()
        while True:
            await asyncio.sleep(PING_S)
            ob.put({"t": "ping"})
            now = time.monotonic()
            maybe_sweep(now)
            if role is not None and room is not None and now - checked >= RECHECK_S:
                checked = now
                ok = await asyncio.to_thread(_still_ok, role, cred, room.ts_id, room.ident)
                if not ok:
                    if (room.tutor if role == "tutor" else room.student) is ws:
                        if role == "tutor":
                            room.tutor = None
                        else:
                            room.student = None
                        room.send_presence()
                    _close(ws, "auth")
                    return

    ping_task = asyncio.create_task(pinger())

    async def fail(code: str) -> None:
        """Hello failed: send the error, close, and stop reading (no second hello)."""
        ob.put({"t": "error", "code": code})
        ob.put(None)
        try:
            await asyncio.wait_for(asyncio.shield(ob.task), 2.0)
        except Exception:
            pass

    try:
        while True:
            raw = await ws.receive_text()
            now = time.monotonic()
            if now - window >= 1.0:
                window, count = now, 0
            count += 1
            if count > MSGS_PER_S:
                continue
            if len(raw) > MAX_MSG:
                ob.put({"t": "error", "code": "too_big"})
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                msg = None
            if not isinstance(msg, dict):
                if role is None:
                    await fail("bad")
                    break
                continue
            t = msg.get("t")
            if t == "ping":
                ob.put({"t": "pong"})
                if room is not None:
                    room.last = now
                continue

            # ---------------- hello
            if role is None:
                if t != "hello" or msg.get("role") not in ("tutor", "student"):
                    await fail("bad"); break
                res = await asyncio.to_thread(_auth, msg)
                if res is None:
                    await fail("auth"); break
                r_role, ts, tutor_name = res
                maybe_sweep(now)
                r = ROOMS.get(ts["id"])
                if r is not None and r.ident != _ident(ts):
                    drop_room(ts["id"])              # an old room of a deleted student with this id
                    await asyncio.to_thread(_forget_saved, ts["id"])   # and its saved lesson
                    r = None
                if r is None:
                    if len(ROOMS) >= MAX_ROOMS and not _make_space():
                        await fail("busy"); break
                    r = ROOMS[ts["id"]] = Room(ts["id"], _ident(ts), ts["tutor_id"])
                    await asyncio.to_thread(restore_lesson, r)
                old = r.tutor if r_role == "tutor" else r.student
                if old is not None and old is not ws:
                    send_to(old, {"t": "error", "code": "replaced"})
                    send_to(old, None)
                if r_role == "tutor":
                    r.tutor = ws
                else:
                    r.student = ws
                    r.visible = True
                room, role, room.last = r, r_role, now
                cred = msg.get("token") if role == "tutor" else msg.get("key")
                ob.put({"t": "ready", "role": role, "name": ts["name"], "tutor": tutor_name,
                        "adult": bool(ts["adult"]), "lesson": room.snapshot(role)})
                room.send_presence(force_to=ws)
                continue

            # ---------------- in a room: a replaced connection is ignored
            if (room.tutor if role == "tutor" else room.student) is not ws:
                continue
            room.last = now
            if t in ("cursor", "point"):
                if now - cwindow >= 1.0:
                    cwindow, ccount = now, 0
                ccount += 1
                if ccount > CURSOR_PER_S:
                    continue

            if role == "tutor":
                if t == "start":
                    if not room.active():
                        _lesson_slot(room)
                        room.lesson = _new_lesson()
                    _queue(room, msg)
                    send_to(room.student, {"t": "start", "lesson": room.snapshot("student")})
                elif t == "load":
                    mat = msg.get("material")
                    if not isinstance(mat, dict):
                        continue
                    if len(json.dumps(mat, separators=(",", ":"))) > MAX_MATERIAL:
                        ob.put({"t": "error", "code": "too_big"}); continue
                    if not room.active():
                        _lesson_slot(room)
                        room.lesson = _new_lesson()
                        send_to(room.student, {"t": "start", "lesson": room.snapshot("student")})
                    fresh = msg.get("fresh") is True
                    prev = room.lesson.get("material")
                    same = isinstance(prev, dict) and prev.get("id") is not None and prev.get("id") == mat.get("id")
                    # the same material again keeps the student's progress; "Start again" (fresh) resets it
                    room.lesson["material"] = mat
                    if fresh or not same:
                        room.lesson["state"] = None
                    _queue(room, msg)
                    send_to(room.student, {"t": "load", "material": mat, "fresh": fresh})
                elif t == "queue":
                    if room.active():
                        _queue(room, msg)
                elif t == "end":
                    if room.active():
                        summary = msg.get("summary")
                        if summary is not None and len(json.dumps(summary)) > 20000:
                            summary = None
                        _end_lesson(room, summary)
                elif t == "cmd":
                    if msg.get("type") not in CMD_TYPES:
                        continue
                    out = {"t": "cmd", "type": msg["type"]}
                    if msg["type"] == "act":
                        a, kind, text = msg.get("a"), msg.get("kind"), msg.get("text", "")
                        if kind not in ACT_KINDS or not isinstance(a, str) or not _ANCHOR.fullmatch(a) or not isinstance(text, str) or len(text) > 80:
                            continue
                        out.update(a=a, kind=kind, text=text if kind == "type" else "")
                    for k in ("step", "page"):
                        v = _int(msg.get(k))
                        if v is not None:
                            out[k] = v
                    send_to(room.student, out)
                elif t == "point":
                    p = _pos(msg)
                    if p:
                        send_to(room.student, {"t": "point", **p})
                elif t == "reward":
                    if msg.get("kind") in REWARDS:
                        send_to(room.student, {"t": "reward", "kind": msg["kind"]})
            else:
                if t == "state":
                    if len(raw) > MAX_STATE:
                        ob.put({"t": "error", "code": "too_big"}); continue
                    st = msg.get("state")
                    if room.active():
                        if not _same_state_id(room, st):
                            continue
                        room.lesson["state"] = st
                        room.lesson["state_at"] = time.time()
                    send_to(room.tutor, {"t": "state", "state": st})
                elif t == "cursor":
                    p = _pos(msg)
                    if p:
                        send_to(room.tutor, {"t": "cursor", **p})
                elif t == "answer":
                    if len(raw) > MAX_ANSWER:
                        continue
                    ans = {k: v for k, v in msg.items() if k != "t"}
                    ans["at"] = _iso()
                    if room.active():
                        L = room.lesson
                        L["answers"].append(ans)
                        L["abytes"] = L.get("abytes", 0) + len(json.dumps(ans))
                        while len(L["answers"]) > 1 and (len(L["answers"]) > MAX_ANSWERS or L["abytes"] > MAX_ANSWERS_BYTES):
                            L["abytes"] -= len(json.dumps(L["answers"].pop(0)))
                    send_to(room.tutor, {"t": "answer", **ans})
                elif t == "focus":
                    v = msg.get("visible")
                    if isinstance(v, bool):
                        room.visible = v
                        room.send_presence()
            # keep a copy of the running lesson in the database (a restart must not lose it)
            if t in ("start", "load", "queue", "end", "state", "answer") and room is not None and room.lesson is not None:
                room.dirty = True
                await asyncio.to_thread(save_lesson, room, t in ("end", "load", "start"))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ping_task.cancel()
        OUTBOXES.pop(id(ws), None)
        ob.stop()
        n = _IPS.get(ip, 1) - 1
        if n > 0:
            _IPS[ip] = n
        else:
            _IPS.pop(ip, None)
        if room is not None and room.dirty:
            save_lesson(room, True)
        if room is not None:
            if role == "tutor" and room.tutor is ws:
                room.tutor = None
            elif role == "student" and room.student is ws:
                room.student = None
            room.last = time.monotonic()
            room.send_presence()
            _forget_if_empty(room)
