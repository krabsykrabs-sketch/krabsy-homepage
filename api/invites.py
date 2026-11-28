"""Live invites (docs/classroom-concept.md "Live invites", owner decisions 2026-11-28).

When a teacher opens the Quiz Room "for class X" (quiz_room.py) or a tutor starts a
live lesson (live.py; a tutor's student is a hidden class of one), an INVITE for that
class is opened here. Every Krabsy page on a device that holds a class or student key
asks every ~15–20 s while the tab is visible (lib/krabsy-invite.js):

    POST /api/invites          {tokens: [student tokens on this device]}
      → {ok, poll, invites: [{id, kind, class, host, target, name, who}]}
         kind   quiz | lesson
         class  the class name (quiz) · host  who started it (teacher's name in the
         room / the tutor's name) · target  the page to open · name  the pupil it
         is for · who  index of that pupil's token in the request
    POST /api/invites/respond  {token, invite, answer: join | decline}

"Jetzt nicht" (decline) is kept per pupil and invite, so that invite doesn't come
back for that pupil; joining is recorded too (and by the room itself when the pupil
arrives). The teacher / tutor sees joined / declined / waiting (status()).

Privacy: everything here lives in memory only (single uvicorn process, like the
Quiz Room). Nothing is written to disk. An invite and all its answers are gone when
the session ends (room closed or quiz over, lesson ended) or at the latest after
its TTL (2 h for a quiz, 3 h for a lesson). Tokens arrive in the POST body, never in
a URL, and are only compared as SHA-256 hashes with the class database.
"""

from __future__ import annotations

import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Callable, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from classes import _err, _hash, _ip, _lock, connect, limited, LIMITS

router = APIRouter()

KINDS = ("quiz", "lesson")
TTL_S = {"quiz": 2 * 3600, "lesson": 3 * 3600}
MAX_TOKENS = 8                 # people on one device (siblings) sent per poll
MAX_INVITES = 2000
POLL_S = 18                    # the clients' polling interval (sent along, so it can be changed here)
LIMITS.update({"invites": (1200, 60.0),    # per IP: a school behind one address polls a lot
               "invite_respond": (300, 60.0)})

STATUSES = ("joined", "declined", "removed")


@dataclass
class Invite:
    id: str
    class_id: int
    kind: str
    class_name: str
    host: str
    target: str
    expires: float
    roster: dict = field(default_factory=dict)       # student id → first name (the class)
    responses: dict = field(default_factory=dict)    # student id → joined | declined | removed
    paused: bool = False                              # e.g. the Quiz Room is locked
    on_change: Optional[Callable[["Invite"], None]] = None

    def alive(self, now: float) -> bool:
        return now < self.expires

    def status(self) -> dict:
        """For the teacher / tutor: every pupil of the class, joined / declined / waiting."""
        with _ilock:
            pupils, answers = dict(self.roster), dict(self.responses)
        rows = []
        for sid, name in sorted(pupils.items(), key=lambda kv: kv[1].lower()):
            s = answers.get(sid, "waiting")
            if s != "removed":
                rows.append({"name": name, "s": s})
        count = {k: sum(1 for r in rows if r["s"] == k) for k in ("joined", "declined", "waiting")}
        return {"t": "invite", "class": self.class_name, "list": rows, **count}


INVITES: dict[str, Invite] = {}
_ilock = threading.Lock()


def _notify(inv: Invite) -> None:
    if inv.on_change is not None:
        try:
            inv.on_change(inv)
        except Exception:      # a closed socket never breaks a poll
            pass


def sweep(now: Optional[float] = None) -> None:
    now = time.monotonic() if now is None else now
    with _ilock:
        for k in [k for k, v in INVITES.items() if not v.alive(now)]:
            INVITES.pop(k, None)


def roster(class_id: int) -> dict:
    """The class's pupils {student id: first name} (blocking: call from a thread)."""
    with _lock, connect() as con:
        return {r["id"]: r["nickname"] for r in con.execute(
            "SELECT id, nickname FROM students WHERE class_id = ?", (class_id,))}


def open_invite(class_id: int, kind: str, *, class_name: str = "", host: str = "", target: str,
                pupils: Optional[dict] = None, on_change=None, ttl: Optional[float] = None) -> Invite:
    """Open an invite for a class. `pupils` = roster() (read beforehand, outside the event loop)."""
    assert kind in KINDS
    sweep()
    with _ilock:
        if len(INVITES) >= MAX_INVITES:                 # never more than this: the oldest go first
            for k in sorted(INVITES, key=lambda k: INVITES[k].expires)[:len(INVITES) - MAX_INVITES + 1]:
                INVITES.pop(k, None)
        inv = Invite(id=secrets.token_urlsafe(9), class_id=class_id, kind=kind, class_name=class_name[:40],
                     host=host[:40], target=target, expires=time.monotonic() + (ttl or TTL_S[kind]),
                     roster=dict(pupils or {}), on_change=on_change)
        INVITES[inv.id] = inv
    return inv


def close_invite(inv: Optional[Invite]) -> None:
    """The session ended: the invite and every answer to it are gone."""
    if inv is None:
        return
    with _ilock:
        INVITES.pop(inv.id, None)
    inv.on_change = None


def is_open(inv: Optional[Invite]) -> bool:
    return inv is not None and INVITES.get(inv.id) is inv and inv.alive(time.monotonic())


def set_paused(inv: Optional[Invite], paused: bool) -> None:
    if inv is not None:
        inv.paused = bool(paused)


def mark(inv: Optional[Invite], student_id: int, status: str, name: Optional[str] = None) -> None:
    """Record a pupil's answer (joined also comes from the room when the pupil arrives)."""
    if inv is None or status not in STATUSES:
        return
    with _ilock:
        if name and student_id not in inv.roster:
            inv.roster[student_id] = name
        if inv.responses.get(student_id) == status:
            return
        if inv.responses.get(student_id) == "removed":    # removed by the teacher: stays removed
            return
        inv.responses[student_id] = status
    _notify(inv)


# ── endpoints ────────────────────────────────────────────────────────────────

class PollBody(BaseModel):
    tokens: list[str] = Field(default_factory=list, max_length=MAX_TOKENS * 2)


class RespondBody(BaseModel):
    token: str = Field(..., max_length=64)
    invite: str = Field(..., max_length=32)
    answer: str = Field(..., max_length=10)        # join | decline


def _students(tokens: list) -> list:
    """Pupil rows (id, class_id, nickname) for the device's tokens, in request order."""
    toks = [t for t in tokens if isinstance(t, str) and 0 < len(t) <= 64][:MAX_TOKENS]
    if not toks:
        return []
    hashes = [_hash(t) for t in toks]
    with _lock, connect() as con:
        rows = con.execute(f"SELECT id, class_id, nickname, token_hash FROM students WHERE token_hash IN "
                           f"({','.join('?' * len(hashes))})", hashes).fetchall()
    by = {r["token_hash"]: r for r in rows}
    return [(i, by[h]) for i, h in enumerate(hashes) if h in by]


@router.post("/api/invites")
def poll(body: PollBody, request: Request) -> JSONResponse:
    if limited("invites", _ip(request)):
        return _err(429, "too_many")
    now = time.monotonic()
    out = []
    if INVITES:                     # the usual case (nothing live anywhere) needs no database
        sweep(now)
        live = [v for v in list(INVITES.values()) if not v.paused]
        if live:
            for who, st in _students(body.tokens):
                for inv in live:
                    if inv.class_id == st["class_id"] and st["id"] not in inv.responses:
                        out.append({"id": inv.id, "kind": inv.kind, "class": inv.class_name, "host": inv.host,
                                    "target": inv.target, "name": st["nickname"], "who": who})
    return JSONResponse({"ok": True, "poll": POLL_S, "invites": out})


@router.post("/api/invites/respond")
def respond(body: RespondBody, request: Request) -> JSONResponse:
    if limited("invite_respond", _ip(request)):
        return _err(429, "too_many")
    if body.answer not in ("join", "decline"):
        return _err(400, "bad_answer")
    inv = INVITES.get(body.invite)
    if inv is None or not inv.alive(time.monotonic()):
        return _err(404, "no_invite")          # ended meanwhile: the page just closes the overlay
    found = _students([body.token])
    st = found[0][1] if found else None
    if st is None or st["class_id"] != inv.class_id:
        return _err(404, "no_invite")
    mark(inv, st["id"], "joined" if body.answer == "join" else "declined", st["nickname"])
    return JSONResponse({"ok": True})
