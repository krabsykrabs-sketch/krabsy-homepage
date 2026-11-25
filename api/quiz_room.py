"""Krabsy Quiz Room: live quiz rooms over WebSocket (games/quiz-show/CLAUDE.md).

A teacher opens a room with a question list (built in the teacher's browser by
the site question engine) and gets a ROOM CODE. Children join with the code and
a first name, walk around a shared 3D room as avatars, and answer each question
on a private card. The server is the referee: children never receive the right
answer before the reveal; scores are computed here.

Everything lives in memory (the API is a single uvicorn process). Nothing is
written to disk; a room disappears when it closes (2 h after creation, or 15 min
after the teacher left).

One endpoint:  WS /api/quiz/ws   (JSON messages, field "t" = type)

Teacher → server
  create  {questions:[…], bonus:[…], time:s, lang} → created {code, token}
          bonus = the "run to the answer" round at the end: the answer is the pad a
          child stands on when the time runs out (pad_at), no answer messages.
  resume  {code, token}                            → snapshot of the room
  start | next | end | lock {on} | remove {pid} | rename {pid, name} | close
  middle {on}                                      (everyone to the middle, until the next question)
  questions {questions:[…]}                       (lobby only: replace the list)
Child → server
  join    {code, name, avatar, color, token?}      → joined {pid, token, name, …}
  move    {p:[x,y,z], r, a}                        (about 10× per second)
  answer  {qi, opt}
  emote   {e}  ball {b, p, v}  boom                (play area: relayed / rate-limited)
Server → clients
  players {list}  pos {s:[[pid,x,y,z,r,a]…]}  question {…}  answered {pid}
  reveal  {…}     end {…}  error {code}  kicked  closed
  emote {pid, e}  ball {b, pid, p, v}  boom {pid}  middle {on}
  pads {counts}  (teacher, during a bonus question: children on each pad)
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import secrets
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # same as class codes: no 0/O, 1/I/L
CODE_LEN = 6
MAX_PLAYERS = 40
MAX_ROOMS = 200
MAX_QUESTIONS = 60
ROOM_TTL_S = 2 * 3600
TEACHER_GONE_S = 15 * 60
TICK_S = 0.1
TIME_MIN, TIME_MAX = 5, 120
MAX_MSG = 200_000            # create (question list); everything else is tiny
MSGS_PER_S = 40              # per connection; more are dropped
CREATES_PER_HOUR = 30        # per IP
AVATARS, COLORS = 16, 16
MAX_BALLS = 8
MAX_BONUS = 5
BONUS_EXTRA_S = 5            # bonus questions: a little longer, the children have to run
PAD_SEND_S = 0.5             # live pad counts to the teacher
# Bonus round answer pads (same as PADS in games/quiz-show/src/play.js): centres x, one z,
# half size. A child counts for the pad its feet were on when the time ran out.
PAD_X = (-6.6, -2.2, 2.2, 6.6)
PAD_Z = 3.5
PAD_HALF = 1.8
# The room grows with the group (never shrinks): scale of the floor plan by players in
# the room. Stations move apart, sizes stay; the answer pads grow a little. Same rule in
# games/quiz-show/src/layout.js (the client gets the scale from the server: "size").
SIZES = ((15, 1.0), (28, 1.25), (MAX_PLAYERS, 1.5))     # (up to n players, scale)


def size_for(n: int) -> float:
    return next((sc for lim, sc in SIZES if n <= lim), SIZES[-1][1])


def pad_half(scale: float) -> float:
    return round(PAD_HALF + (scale - 1.0) * 0.9, 3)
EMOTE_GAP_S = 0.8            # per child
BALL_GAP_S = 0.08            # per child
BOOM_GAP_S = 8.0             # per room

_ORIGIN = re.compile(os.environ.get(
    "QUIZ_ORIGIN_RE",
    r"^(https://(www\.)?krabsy\.com|http://(localhost|127\.0\.0\.1)(:\d+)?)$"))
_SLUG = re.compile(r"^[a-z0-9 _'-]{1,60}$")
_NAME_OK = re.compile(r"[^\w \-'.]", re.UNICODE)
# A short block list on top of the teacher's rename/remove (EN/DE/ES).
_BLOCK = {"fuck", "shit", "bitch", "nazi", "hitler", "sex", "porn", "puta", "puto", "mierda",
          "joder", "polla", "fotze", "hure", "wichser", "arsch", "fick", "nigger", "nigga"}

OUTBOX_POS_LIMIT = 8         # queued messages after which position updates are dropped
OUTBOX_MAX = 400             # a device this far behind is cut off (it reconnects and resyncs)

ROOMS: dict[str, "Room"] = {}
_creates: dict[str, list[float]] = {}


# --------------------------------------------------------------------------- sending

class Outbox:
    """One sender task per connection. Messages go out in order, never two sends at once,
    and a slow device can't hold up the room or anyone else. If a device falls behind,
    position updates (superseded a tenth of a second later anyway) are dropped first;
    nothing else is dropped. A device hopelessly behind is disconnected; it reconnects
    by itself and gets a fresh snapshot."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.q: deque = deque()
        self.ev = asyncio.Event()
        self.dead = False
        # Wake-ups go through the socket's own loop: uvicorn has one loop, but the test
        # client runs every connection in its own loop and thread.
        self.loop = asyncio.get_running_loop()
        self.task = asyncio.create_task(self._run())

    def put(self, msg: Optional[dict]) -> None:
        if self.dead:
            return
        if msg is not None:
            if msg.get("t") == "pos" and len(self.q) > OUTBOX_POS_LIMIT:
                return
            if len(self.q) > OUTBOX_MAX:
                self.q.clear()
                msg = None                      # close it
            else:
                msg = json.dumps(msg, separators=(",", ":"))
        self.q.append(msg)                      # None = close the socket after the rest
        try:
            self.loop.call_soon_threadsafe(self.ev.set)
        except RuntimeError:                    # loop already closed
            self.dead = True

    async def _run(self) -> None:
        try:
            while True:
                while not self.q:
                    self.ev.clear()
                    await self.ev.wait()
                txt = self.q.popleft()
                if txt is None:
                    self.dead = True
                    await self.ws.close()
                    return
                await self.ws.send_text(txt)
        except asyncio.CancelledError:
            pass
        except Exception:
            self.dead = True

    def stop(self) -> None:
        self.dead = True
        self.task.cancel()


OUTBOXES: dict[int, Outbox] = {}


def send_to(ws: Optional[WebSocket], msg: dict) -> None:
    ob = OUTBOXES.get(id(ws)) if ws is not None else None
    if ob is not None:
        ob.put(msg)


async def close_ws(ws: Optional[WebSocket]) -> None:
    """Close after everything already queued for this socket has gone out."""
    if ws is None:
        return
    ob = OUTBOXES.get(id(ws))
    if ob is not None:
        ob.put(None)
    else:
        try:
            await ws.close()
        except Exception:
            pass


# --------------------------------------------------------------------------- helpers

def clean_name(raw) -> str:
    name = _NAME_OK.sub("", str(raw or ""))
    name = re.sub(r"\s+", " ", name).strip()[:16]
    low = re.sub(r"[^a-z]", "", name.lower())
    if any(b in low for b in _BLOCK):
        return ""
    return name


def _s(v, n: int) -> str:
    return str(v)[:n] if isinstance(v, (str, int, float)) else ""


def clean_question(q) -> Optional[dict]:
    """Validate one question from the teacher. Returns None if unusable."""
    if not isinstance(q, dict):
        return None
    kind = q.get("kind")
    opts = q.get("options")
    correct = q.get("correct")
    if kind not in ("trio", "gap") or not isinstance(opts, list) or len(opts) != 4:
        return None
    if not isinstance(correct, int) or not 0 <= correct < 4:
        return None
    out = {
        "kind": kind,
        "options": [_s(o, 40) for o in opts],
        "correct": correct,
        "teach": _s(q.get("teach") or "", 200),
        "item": _s(q.get("item") or "", 60),
        "topic": _s(q.get("topic") or "", 40),
        "form": _s(q.get("form") or "default", 20),
        "followUp": bool(q.get("followUp")),
    }
    if not all(out["options"]):
        return None
    if kind == "trio":
        slots = q.get("slots")
        if not isinstance(slots, list) or len(slots) != 2:
            return None
        out["base"] = _s(q.get("base") or "", 40)
        out["slots"] = [None if s is None else _s(s, 40) for s in slots]
        out["askIndex"] = 1 if q.get("askIndex") == 1 else 0
        ch = q.get("chain")
        if isinstance(ch, dict):
            out["chain"] = {k: _s(ch.get(k) or "", 40) for k in ("base", "past", "pp")}
        if not out["base"]:
            return None
    else:
        out["sentence"] = _s(q.get("sentence") or "", 200)
        if "___" not in out["sentence"]:
            return None
    return out


def _vec3(v) -> bool:
    return isinstance(v, list) and len(v) == 3 and all(isinstance(x, (int, float)) for x in v)


def pad_at(pos, scale: float = 1.0) -> Optional[int]:
    x, y, z = pos
    half = pad_half(scale)
    if abs(z - PAD_Z * scale) > half or y < -0.5:
        return None
    for i, cx in enumerate(PAD_X):
        if abs(x - cx * scale) <= half:
            return i
    return None


def questions_from(msg: dict) -> list:
    """The quiz list from a create/questions message: normal questions, then the bonus
    round (single questions only; marked "bonus")."""
    qs = msg.get("questions")
    qs = [c for c in (clean_question(q) for q in (qs if isinstance(qs, list) else [])[:MAX_QUESTIONS]) if c]
    bs = msg.get("bonus")
    bs = [c for c in (clean_question(q) for q in (bs if isinstance(bs, list) else [])[:MAX_BONUS]) if c]
    for b in bs:
        b["bonus"] = True
        b["followUp"] = False
    return qs + bs if qs else []


def public_question(q: dict) -> dict:
    """What a child may see before the reveal: no answer, no teach beat."""
    keep = ("kind", "options", "base", "slots", "askIndex", "sentence", "bonus")
    return {k: q[k] for k in keep if k in q}


def points(ms: int, time_s: int) -> int:
    frac = max(0.0, 1.0 - ms / (time_s * 1000.0))
    return int(round(500 + 500 * frac))


# --------------------------------------------------------------------------- model

@dataclass
class Player:
    pid: int
    name: str
    token: str
    avatar: int = 0
    color: int = 0
    score: int = 0
    streak: int = 0
    ws: Optional[WebSocket] = None
    pos: list = field(default_factory=lambda: [0.0, 0.0, 0.0])
    rot: float = 0.0
    anim: int = 0
    moved: bool = False
    answers: dict = field(default_factory=dict)   # qi → {opt, ms, right, pts}
    emote_at: float = 0.0
    ball_at: float = 0.0

    def public(self) -> dict:
        return {"pid": self.pid, "name": self.name, "avatar": self.avatar, "color": self.color,
                "online": self.ws is not None}


class Room:
    def __init__(self, code: str, token: str, questions: list, time_s: int, lang: str):
        self.code = code
        self.token = token
        self.questions = questions
        self.time = time_s
        self.lang = lang
        self.phase = "lobby"            # lobby | question | reveal | end
        self.qi = -1
        self.q_started = 0.0
        self.deadline = 0.0
        self.asked: set[int] = set()     # pids online when the question started
        self.players: dict[int, Player] = {}
        self.banned: set[str] = set()
        self.locked = False
        self.teacher: Optional[WebSocket] = None
        self.teacher_left = time.monotonic()
        self.created = time.monotonic()
        self.next_pid = 1
        self.size = 1.0                  # floor-plan scale, grows with the group
        # The teacher's own figure (a character children can't pick): name shown on its tag
        # ("" = the default "Lehrkraft"/"Profe" on the clients), position like a player's.
        self.host_name = ""
        self.host_pos = [0.0, 0.0, -7.0]
        self.host_rot = 0.0
        self.host_anim = 0
        self.host_moved = False
        self.host_emote_at = 0.0
        self.missed: dict[str, dict] = {}   # topic|item → {q, n}
        self.task: Optional[asyncio.Task] = None
        self.closed = False
        self.middle = False             # "everyone to the middle": avatars frozen until the next question
        self.boom_at = 0.0              # last confetti-button blast (room-wide cooldown)
        self.pads_sent = 0.0

    # ---- sending
    async def _send(self, ws: Optional[WebSocket], msg: dict) -> None:
        send_to(ws, msg)

    async def to_teacher(self, msg: dict) -> None:
        await self._send(self.teacher, msg)

    async def to_players(self, msg: dict) -> None:
        await asyncio.gather(*(self._send(p.ws, msg) for p in self.players.values() if p.ws))

    async def to_all(self, msg: dict) -> None:
        await asyncio.gather(self.to_teacher(msg), self.to_players(msg))

    def host_info(self) -> dict:
        return {"name": self.host_name, "online": self.teacher is not None,
                "p": [round(v, 2) for v in self.host_pos], "r": round(self.host_rot, 2)}

    async def send_host(self) -> None:
        await self.to_players({"t": "host", **self.host_info()})

    async def grow(self) -> None:
        """Make the room bigger when the group has outgrown it (never smaller). Not while a
        bonus question runs: the pads would move under the children's feet."""
        if self.phase == "question" and self.questions[self.qi].get("bonus"):
            return
        new = size_for(len(self.players))
        if new > self.size:
            self.size = new
            await self.to_all({"t": "size", "s": self.size})

    async def send_players_list(self) -> None:
        await self.to_all({"t": "players", "list": [p.public() for p in self.players.values()],
                           "locked": self.locked})

    # ---- views
    def ranking(self) -> list[Player]:
        return sorted(self.players.values(), key=lambda p: (-p.score, p.pid))

    def top(self, n: int = 5) -> list[dict]:
        return [{"pid": p.pid, "name": p.name, "score": p.score, "avatar": p.avatar, "color": p.color}
                for p in self.ranking()[:n]]

    def answered_pids(self) -> list[int]:
        return [p.pid for p in self.players.values() if self.qi in p.answers]

    def question_msg(self, for_teacher: bool) -> dict:
        q = self.questions[self.qi]
        msg = {"t": "question", "qi": self.qi, "n": len(self.questions), "time": self.time,
               "ends_in": max(0, int((self.deadline - time.monotonic()) * 1000)),
               "q": q if for_teacher else public_question(q),
               "answered": self.answered_pids()}
        if q.get("bonus"):
            bonus = [i for i, x in enumerate(self.questions) if x.get("bonus")]
            msg["bonus"] = {"i": bonus.index(self.qi), "n": len(bonus)}
        return msg

    def snapshot(self, for_teacher: bool, player: Optional[Player] = None) -> dict:
        snap = {"phase": self.phase, "code": self.code, "n": len(self.questions), "qi": self.qi,
                "time": self.time, "size": self.size, "host": self.host_info(), "locked": self.locked, "middle": self.middle,
                "players": [p.public() for p in self.players.values()]}
        if self.phase == "question":
            snap["question"] = self.question_msg(for_teacher)
            if player and self.qi in player.answers:
                snap["question"]["mine"] = player.answers[self.qi]["opt"]
        elif self.phase == "reveal":
            snap["reveal"] = self.reveal_msg(for_teacher, player)
        elif self.phase == "end":
            snap["end"] = self.end_msg(for_teacher, player)
        if for_teacher:
            snap["questions"] = self.questions
        return snap

    def reveal_msg(self, for_teacher: bool, player: Optional[Player] = None) -> dict:
        q = self.questions[self.qi]
        msg = {"t": "reveal", "qi": self.qi, "n": len(self.questions), "correct": q["correct"],
               "teach": q["teach"], "top": self.top(5), "answered": len(self.answered_pids()),
               "asked": len(self.asked)}
        if for_teacher:
            counts = [0, 0, 0, 0]
            for p in self.players.values():
                a = p.answers.get(self.qi)
                if a:
                    counts[a["opt"]] += 1
            msg["counts"] = counts
        if player is not None:
            a = player.answers.get(self.qi)
            rank = next((i + 1 for i, p in enumerate(self.ranking()) if p.pid == player.pid), 0)
            # The word (item/topic/form) only now: a preposition's use-case id can hint at
            # the answer. The child's device records it in its own learning stats.
            msg["word"] = {"item": q["item"], "topic": q["topic"], "form": q["form"]}
            msg["you"] = {"opt": a["opt"] if a else None, "right": bool(a and a["right"]),
                          "pts": a["pts"] if a else 0, "score": player.score, "rank": rank,
                          "of": len(self.players), "streak": player.streak}
        return msg

    def end_msg(self, for_teacher: bool, player: Optional[Player] = None) -> dict:
        msg = {"t": "end", "top": self.top(5), "n": len(self.questions)}
        if for_teacher:
            msg["ranking"] = [{"pid": p.pid, "name": p.name, "score": p.score,
                               "right": sum(1 for a in p.answers.values() if a["right"])}
                              for p in self.ranking()]
            review = sorted(self.missed.values(), key=lambda e: -e["n"])[:8]
            msg["review"] = [{"n": e["n"], "q": e["q"]} for e in review if e["n"] > 0]
            total = sum(len(p.answers) for p in self.players.values())
            right = sum(1 for p in self.players.values() for a in p.answers.values() if a["right"])
            msg["answers"], msg["right"] = total, right
        if player is not None:
            rank = next((i + 1 for i, p in enumerate(self.ranking()) if p.pid == player.pid), 0)
            msg["you"] = {"score": player.score, "rank": rank, "of": len(self.players),
                          "right": sum(1 for a in player.answers.values() if a["right"])}
        return msg

    # ---- flow
    async def start_question(self, qi: int) -> None:
        self.middle = False
        self.qi = qi
        self.phase = "question"
        self.q_started = time.monotonic()
        self.deadline = self.q_started + self.time + (BONUS_EXTRA_S if self.questions[qi].get("bonus") else 0)
        self.asked = {p.pid for p in self.players.values() if p.ws is not None}
        if not self.questions[qi].get("bonus"):
            await self.grow()            # a size step held back during a bonus question
        await self.to_teacher(self.question_msg(True))
        await self.to_players(self.question_msg(False))

    async def reveal(self) -> None:
        if self.phase != "question":
            return
        self.phase = "reveal"
        q = self.questions[self.qi]
        if q.get("bonus"):
            # Answers come from where the children stand.
            for p in self.players.values():
                if p.pid not in self.asked and p.ws is None:
                    continue
                opt = pad_at(p.pos, self.size)
                if opt is None:
                    continue
                right = opt == q["correct"]
                pts = 0
                if right:
                    p.streak += 1
                    pts = 500 + (100 if p.streak >= 3 else 0)
                else:
                    p.streak = 0
                p.score += pts
                p.answers[self.qi] = {"opt": opt, "ms": 0, "right": right, "pts": pts}
        missed = 0
        for p in self.players.values():
            a = p.answers.get(self.qi)
            if a is None:
                if p.pid in self.asked:
                    missed += 1
                    p.streak = 0
            elif not a["right"]:
                missed += 1
        key = f"{q['topic']}|{q['item']}"
        e = self.missed.setdefault(key, {"q": q, "n": 0})
        e["n"] += missed
        await self.to_teacher(self.reveal_msg(True))
        await asyncio.gather(*(self._send(p.ws, self.reveal_msg(False, p))
                               for p in self.players.values() if p.ws))

    async def end(self) -> None:
        if self.phase == "question":
            await self.reveal()
        self.phase = "end"
        await self.to_teacher(self.end_msg(True))
        await asyncio.gather(*(self._send(p.ws, self.end_msg(False, p))
                               for p in self.players.values() if p.ws))

    async def advance(self) -> None:
        if self.phase == "lobby":
            if self.questions:
                await self.start_question(0)
        elif self.phase == "question":
            await self.reveal()
        elif self.phase == "reveal":
            if self.qi + 1 < len(self.questions):
                await self.start_question(self.qi + 1)
            else:
                await self.end()

    async def answer(self, p: Player, qi, opt) -> None:
        if self.phase != "question" or qi != self.qi or self.qi in p.answers:
            return
        if self.questions[self.qi].get("bonus"):
            return                      # bonus round: the pad you stand on is the answer
        if not isinstance(opt, int) or not 0 <= opt < 4:
            return
        ms = int((time.monotonic() - self.q_started) * 1000)
        right = opt == self.questions[self.qi]["correct"]
        pts = 0
        if right:
            p.streak += 1
            pts = points(ms, self.time) + (100 if p.streak >= 3 else 0)
        else:
            p.streak = 0
        p.score += pts
        p.answers[self.qi] = {"opt": opt, "ms": ms, "right": right, "pts": pts}
        await self.to_all({"t": "answered", "pid": p.pid})
        online = [x for x in self.players.values() if x.ws is not None]
        if online and all(self.qi in x.answers for x in online):
            await self.reveal()

    # ---- background loop: positions, timer, expiry
    async def run(self) -> None:
        try:
            while not self.closed:
                await asyncio.sleep(TICK_S)
                now = time.monotonic()
                moved = [p for p in self.players.values() if p.moved]
                if moved or self.host_moved:
                    s = [[p.pid, round(p.pos[0], 2), round(p.pos[1], 2), round(p.pos[2], 2),
                          round(p.rot, 2), p.anim] for p in moved]
                    for p in moved:
                        p.moved = False
                    if self.host_moved:            # the teacher's figure is pid 0
                        self.host_moved = False
                        s.append([0, *[round(v, 2) for v in self.host_pos], round(self.host_rot, 2), self.host_anim])
                    await self.to_all({"t": "pos", "s": s})
                if self.phase == "question" and self.questions[self.qi].get("bonus") and now - self.pads_sent >= PAD_SEND_S:
                    self.pads_sent = now
                    counts = [0, 0, 0, 0]
                    for p in self.players.values():
                        i = pad_at(p.pos, self.size) if p.ws is not None else None
                        if i is not None:
                            counts[i] += 1
                    await self.to_teacher({"t": "pads", "counts": counts})
                if self.phase == "question" and now >= self.deadline:
                    await self.reveal()
                gone = self.teacher is None and now - self.teacher_left > TEACHER_GONE_S
                if gone or now - self.created > ROOM_TTL_S:
                    await self.close()
        except asyncio.CancelledError:
            pass

    async def close(self) -> None:
        if self.closed:
            return
        self.closed = True
        await self.to_all({"t": "closed"})
        for ws in [self.teacher, *(p.ws for p in self.players.values())]:
            await close_ws(ws)
        ROOMS.pop(self.code, None)


# --------------------------------------------------------------------------- endpoint

def _origin_ok(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    return origin is None or bool(_ORIGIN.match(origin))


def _ip(ws: WebSocket) -> str:
    return ws.client.host if ws.client else "?"


def _create_limited(ip: str) -> bool:
    now = time.monotonic()
    lst = [t for t in _creates.get(ip, []) if now - t < 3600]
    if len(lst) >= CREATES_PER_HOUR:
        _creates[ip] = lst
        return True
    lst.append(now)
    _creates[ip] = lst
    return False


def _new_code() -> str:
    while True:
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
        if code not in ROOMS:
            return code


def _norm_code(raw) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(raw or "").upper())[:CODE_LEN]


def _unique_name(room: Room, name: str, me: Optional[int] = None) -> str:
    taken = {p.name.lower() for p in room.players.values() if p.pid != me}
    if name.lower() not in taken:
        return name
    for i in range(2, 100):
        cand = f"{name[:13]} {i}"
        if cand.lower() not in taken:
            return cand
    return name


@router.websocket("/api/quiz/ws")
async def quiz_ws(ws: WebSocket):
    if not _origin_ok(ws):
        await ws.close(code=1008)
        return
    await ws.accept()
    OUTBOXES[id(ws)] = Outbox(ws)
    role: Optional[str] = None
    room: Optional[Room] = None
    me: Optional[Player] = None
    window_start, count = time.monotonic(), 0

    async def err(code: str):
        send_to(ws, {"t": "error", "code": code})

    try:
        while True:
            raw = await ws.receive_text()
            now = time.monotonic()
            if now - window_start >= 1.0:
                window_start, count = now, 0
            count += 1
            if count > MSGS_PER_S or len(raw) > MAX_MSG or (role == "player" and len(raw) > 4000):
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            t = msg.get("t")

            # ---------------- not yet in a room
            if role is None:
                if t == "create":
                    if _create_limited(_ip(ws)):
                        await err("rate_limited"); continue
                    if len(ROOMS) >= MAX_ROOMS:
                        await err("busy"); continue
                    qs = questions_from(msg)
                    if not qs:
                        await err("no_questions"); continue
                    try:
                        time_s = min(TIME_MAX, max(TIME_MIN, int(msg.get("time", 20))))
                    except (TypeError, ValueError):
                        time_s = 20
                    lang = msg.get("lang") if msg.get("lang") in ("de", "es", "en") else "de"
                    room = Room(_new_code(), secrets.token_urlsafe(24), qs, time_s, lang)
                    room.host_name = clean_name(msg.get("host"))
                    ROOMS[room.code] = room
                    room.teacher, role = ws, "teacher"
                    room.task = asyncio.create_task(room.run())
                    send_to(ws, ({"t": "created", "code": room.code, "token": room.token,
                                                   **room.snapshot(True)}))
                elif t == "resume":
                    r = ROOMS.get(_norm_code(msg.get("code")))
                    if not r or not secrets.compare_digest(str(msg.get("token") or ""), r.token):
                        await err("no_room"); continue
                    if r.teacher is not None and r.teacher is not ws:
                        await close_ws(r.teacher)
                    room, role = r, "teacher"
                    room.teacher = ws
                    send_to(ws, ({"t": "resumed", "code": room.code, **room.snapshot(True)}))
                    await room.send_host()                 # the teacher's figure is back
                elif t == "join":
                    r = ROOMS.get(_norm_code(msg.get("code")))
                    if not r:
                        await err("no_room"); continue
                    token = str(msg.get("token") or "")
                    if token and token in r.banned:
                        await err("removed"); continue
                    p = next((x for x in r.players.values() if token and secrets.compare_digest(x.token, token)), None)
                    if p is None:
                        if r.locked:
                            await err("locked"); continue
                        if len(r.players) >= MAX_PLAYERS:
                            await err("full"); continue
                        name = clean_name(msg.get("name"))
                        if not name:
                            await err("bad_name"); continue
                        p = Player(pid=r.next_pid, name=_unique_name(r, name), token=secrets.token_urlsafe(18))
                        r.next_pid += 1
                        r.players[p.pid] = p
                    elif p.ws is not None and p.ws is not ws:
                        old = p.ws
                        p.ws = None
                        await close_ws(old)
                    for k, lim in (("avatar", AVATARS), ("color", COLORS)):
                        v = msg.get(k)
                        if isinstance(v, int) and 0 <= v < lim:
                            setattr(p, k, v)
                    p.ws = ws
                    room, me, role = r, p, "player"
                    send_to(ws, ({"t": "joined", "pid": p.pid, "token": p.token, "name": p.name,
                                                   "you": {"score": p.score, "avatar": p.avatar, "color": p.color},
                                                   **room.snapshot(False, p)}))
                    await room.send_players_list()
                    await room.grow()
                    # Everyone needs the newcomer's position once.
                    p.moved = True
                    send_to(ws, ({"t": "pos", "s": [
                        [x.pid, *[round(v, 2) for v in x.pos], round(x.rot, 2), x.anim]
                        for x in room.players.values() if x.pid != p.pid]}))
                continue

            if room is None or room.closed:
                await err("no_room"); continue

            # ---------------- teacher
            if role == "teacher":
                if t in ("start", "next"):
                    await room.advance()
                elif t == "end":
                    await room.end()
                elif t == "lock":
                    room.locked = bool(msg.get("on"))
                    await room.send_players_list()
                elif t == "remove":
                    p = room.players.pop(msg.get("pid"), None) if isinstance(msg.get("pid"), int) else None
                    if p:
                        room.banned.add(p.token)
                        if p.ws:
                            await room._send(p.ws, {"t": "kicked"})
                            await close_ws(p.ws)
                        await room.send_players_list()
                elif t == "rename":
                    p = room.players.get(msg.get("pid")) if isinstance(msg.get("pid"), int) else None
                    name = clean_name(msg.get("name"))
                    if p and name:
                        p.name = _unique_name(room, name, p.pid)
                        await room._send(p.ws, {"t": "renamed", "name": p.name})
                        await room.send_players_list()
                elif t == "questions":
                    # The teacher may still change the list while children are joining.
                    if room.phase != "lobby":
                        await err("started"); continue
                    qs = questions_from(msg)
                    if not qs:
                        await err("no_questions"); continue
                    room.questions = qs
                    send_to(ws, ({"t": "questions_set", "n": len(qs), "questions": qs}))
                elif t == "middle":
                    room.middle = bool(msg.get("on"))
                    await room.to_all({"t": "middle", "on": room.middle})
                elif t == "close":
                    await room.close()
                elif t == "move":
                    pos = msg.get("p")
                    if _vec3(pos):
                        room.host_pos = [max(-60.0, min(60.0, float(v))) for v in pos]
                        r = msg.get("r")
                        room.host_rot = float(r) if isinstance(r, (int, float)) else 0.0
                        a = msg.get("a")
                        room.host_anim = a if isinstance(a, int) and 0 <= a < 32 else 0
                        room.host_moved = True
                elif t == "emote":
                    e = msg.get("e")
                    if isinstance(e, int) and 0 <= e < 8 and now - room.host_emote_at >= EMOTE_GAP_S:
                        room.host_emote_at = now
                        await room.to_all({"t": "emote", "pid": 0, "e": e})
                elif t == "host":
                    room.host_name = clean_name(msg.get("name"))
                    await room.send_host()
                    send_to(ws, {"t": "host", **room.host_info()})

            # ---------------- player
            elif role == "player" and me is not None:
                if t == "move":
                    pos = msg.get("p")
                    if isinstance(pos, list) and len(pos) == 3 and all(isinstance(v, (int, float)) for v in pos):
                        me.pos = [max(-60.0, min(60.0, float(v))) for v in pos]
                        r = msg.get("r")
                        me.rot = float(r) if isinstance(r, (int, float)) else 0.0
                        a = msg.get("a")
                        me.anim = a if isinstance(a, int) and 0 <= a < 32 else 0
                        me.moved = True
                elif t == "answer":
                    await room.answer(me, msg.get("qi"), msg.get("opt"))
                elif t == "emote":
                    e = msg.get("e")
                    if isinstance(e, int) and 0 <= e < 8 and now - me.emote_at >= EMOTE_GAP_S:
                        me.emote_at = now
                        await room.to_all({"t": "emote", "pid": me.pid, "e": e})
                elif t == "ball":
                    # A child kicked a ball: relay its new state to everyone else.
                    b, pos, vel = msg.get("b"), msg.get("p"), msg.get("v")
                    if (isinstance(b, int) and 0 <= b < MAX_BALLS and _vec3(pos) and _vec3(vel)
                            and now - me.ball_at >= BALL_GAP_S):
                        me.ball_at = now
                        out = {"t": "ball", "b": b, "pid": me.pid,
                               "p": [round(max(-60.0, min(60.0, float(x))), 2) for x in pos],
                               "v": [round(max(-30.0, min(30.0, float(x))), 2) for x in vel]}
                        await asyncio.gather(*(room._send(x.ws, out) for x in room.players.values()
                                               if x.ws and x is not me), room.to_teacher(out))
                elif t == "boom":
                    # The big red button: confetti for the whole room, at most every BOOM_GAP_S.
                    if now - room.boom_at >= BOOM_GAP_S:
                        room.boom_at = now
                        await room.to_all({"t": "boom", "pid": me.pid})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        ob = OUTBOXES.pop(id(ws), None)
        if ob is not None:
            ob.stop()
        if room is not None and not room.closed:
            if role == "teacher" and room.teacher is ws:
                room.teacher = None
                room.teacher_left = time.monotonic()
                try:
                    await room.send_host()         # the teacher's figure disappears meanwhile
                except Exception:
                    pass
            elif role == "player" and me is not None and me.ws is ws:
                me.ws = None
                try:
                    await room.send_players_list()
                    # A child leaving can make "everyone answered" true.
                    if room.phase == "question":
                        online = [x for x in room.players.values() if x.ws is not None]
                        if online and all(room.qi in x.answers for x in online):
                            await room.reveal()
                except Exception:
                    pass
