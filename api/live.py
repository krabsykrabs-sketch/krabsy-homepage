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
Non-fatal errors     error {code: too_big} (load material > MAX_MATERIAL or message > MAX_MSG)
A second connection of the same role replaces the first: the old one gets
error {code: replaced} and is closed (clients must not auto-reconnect after that).
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import tutors
from classes import _lock, connect
from quiz_room import Outbox, OUTBOX_POS_LIMIT, _origin_ok

router = APIRouter()

MAX_MSG = 256 * 1024          # bytes of one message
MAX_MATERIAL = 200 * 1024     # bytes of one material (load)
MSGS_PER_S = 60               # per connection; more are dropped
CURSOR_PER_S = 20             # cursor/point per connection; more are dropped
MAX_ROOMS = 500
ROOM_TTL_S = 3 * 3600         # after the last message
PING_S = 25.0
MAX_ANSWERS = 400             # answers kept in the lesson snapshot (tutor reload)
MAX_ITEMS = 60                # lesson queue entries
CMD_TYPES = {"hint", "reveal", "next", "prev", "goto"}
REWARDS = {"star", "gift"}


class _Outbox(Outbox):
    """Quiz Room outbox; cursor updates are dropped first when a device falls behind."""

    def put(self, msg: Optional[dict]) -> None:
        if msg is not None and msg.get("t") == "cursor" and len(self.q) > OUTBOX_POS_LIMIT:
            return
        super().put(msg)


class Room:
    def __init__(self, ts_id: int):
        self.ts_id = ts_id
        self.tutor: Optional[WebSocket] = None
        self.student: Optional[WebSocket] = None
        self.visible = True
        self.lesson: Optional[dict] = None
        self.last = time.monotonic()
        self.presence_sent: Optional[tuple] = None

    def active(self) -> bool:
        return self.lesson is not None and not self.lesson.get("ended")

    def snapshot(self, role: str) -> Optional[dict]:
        if self.lesson is None:
            return None
        if role == "student":
            if not self.active():
                return None
            return {k: self.lesson[k] for k in ("started", "material", "state", "items", "index")}
        return self.lesson

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


def send_to(ws: Optional[WebSocket], msg: Optional[dict]) -> None:
    ob = OUTBOXES.get(id(ws)) if ws is not None else None
    if ob is not None:
        ob.put(msg)


def _iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sweep(now: Optional[float] = None) -> int:
    """Drop rooms nobody is in whose last message is older than ROOM_TTL_S."""
    now = time.monotonic() if now is None else now
    old = [k for k, r in ROOMS.items()
           if r.tutor is None and r.student is None and now - r.last > ROOM_TTL_S]
    for k in old:
        del ROOMS[k]
    return len(old)


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


@router.websocket("/api/live/ws")
async def live_ws(ws: WebSocket):
    if not _origin_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    ob = _Outbox(ws)
    OUTBOXES[id(ws)] = ob
    role: Optional[str] = None
    room: Optional[Room] = None
    window, count, cwindow, ccount = time.monotonic(), 0, time.monotonic(), 0

    async def pinger():
        while True:
            await asyncio.sleep(PING_S)
            ob.put({"t": "ping"})

    ping_task = asyncio.create_task(pinger())

    def fail(code: str) -> None:
        ob.put({"t": "error", "code": code})
        ob.put(None)

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
                    fail("bad")
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
                    fail("bad"); continue
                res = _auth(msg)
                if res is None:
                    fail("auth"); continue
                r_role, ts, tutor_name = res
                r = ROOMS.get(ts["id"])
                if r is None:
                    if len(ROOMS) >= MAX_ROOMS:
                        sweep()
                    if len(ROOMS) >= MAX_ROOMS:
                        fail("busy"); continue
                    r = ROOMS[ts["id"]] = Room(ts["id"])
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
                        room.lesson = _new_lesson()
                        send_to(room.student, {"t": "start", "lesson": room.snapshot("student")})
                    room.lesson["material"], room.lesson["state"] = mat, None
                    _queue(room, msg)
                    send_to(room.student, {"t": "load", "material": mat})
                elif t == "queue":
                    if room.active():
                        _queue(room, msg)
                elif t == "end":
                    if room.active():
                        summary = msg.get("summary")
                        if summary is not None and len(json.dumps(summary)) > 20000:
                            summary = None
                        room.lesson["ended"], room.lesson["summary"] = _iso(), summary
                        room.lesson["material"], room.lesson["state"] = None, None
                        send_to(room.student, {"t": "end", "summary": summary})
                elif t == "cmd":
                    if msg.get("type") not in CMD_TYPES:
                        continue
                    out = {"t": "cmd", "type": msg["type"]}
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
                    st = msg.get("state")
                    if room.active():
                        room.lesson["state"] = st
                    send_to(room.tutor, {"t": "state", "state": st})
                elif t == "cursor":
                    p = _pos(msg)
                    if p:
                        send_to(room.tutor, {"t": "cursor", **p})
                elif t == "answer":
                    ans = {k: v for k, v in msg.items() if k != "t"}
                    if len(json.dumps(ans)) > 4000:
                        continue
                    ans["at"] = _iso()
                    if room.active():
                        room.lesson["answers"] = (room.lesson["answers"] + [ans])[-MAX_ANSWERS:]
                    send_to(room.tutor, {"t": "answer", **ans})
                elif t == "focus":
                    v = msg.get("visible")
                    if isinstance(v, bool):
                        room.visible = v
                        room.send_presence()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ping_task.cancel()
        OUTBOXES.pop(id(ws), None)
        ob.stop()
        if room is not None:
            if role == "tutor" and room.tutor is ws:
                room.tutor = None
            elif role == "student" and room.student is ws:
                room.student = None
            room.last = time.monotonic()
            room.send_presence()
