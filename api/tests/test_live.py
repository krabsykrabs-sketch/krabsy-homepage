"""Live classroom relay (docs/live-classroom.md, WS /api/live/ws): auth, relay both
ways, presence, snapshot on reconnect, replacement, cursor rate limit, size limits."""

import os
import sys
import tempfile
import types
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

WS = "/api/live/ws"
FARM = {"id": "m_es_farm_1", "kind": "worksheet", "title": "Lucas visits the farm",
        "steps": [{"type": "tap", "title": "Tap", "items": [{"word": "vaca", "options": ["vaca", "pato"]}]}]}


def _setup():
    """→ (client, tutor token, student id, student key, other tutor's student id) or None."""
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None
    import classes
    import live
    import main
    classes.init_db()
    with classes.connect() as con:
        con.execute("DELETE FROM classes")
        con.execute("DELETE FROM tutors")
    classes._buckets.clear()
    live.ROOMS.clear()
    c = TestClient(main.app)
    tok = c.post("/api/tutor/create", json={"name": "Nora"}).json()["tutor_token"]
    s = c.post("/api/tutor/student/add", json={"name": "Lucas"}, headers={"X-Tutor-Token": tok}).json()
    tok2 = c.post("/api/tutor/create", json={"name": "Other"}).json()["tutor_token"]
    s2 = c.post("/api/tutor/student/add", json={"name": "Mia"}, headers={"X-Tutor-Token": tok2}).json()
    return c, tok, s["id"], s["student_key"], s2["id"]


def recv(ws, t, limit=50):
    """Next message of type t (skips presence/ping noise)."""
    for _ in range(limit):
        m = ws.receive_json()
        if m["t"] == t:
            return m
    raise AssertionError(f"no {t}")


def until(ws, t, limit=200):
    """All messages up to and including the next one of type t."""
    out = []
    for _ in range(limit):
        m = ws.receive_json()
        out.append(m)
        if m["t"] == t:
            return out
    raise AssertionError(f"no {t}")


def hello_tutor(ws, tok, sid):
    ws.send_json({"t": "hello", "role": "tutor", "token": tok, "student": sid})
    return recv(ws, "ready")


def hello_student(ws, key):
    ws.send_json({"t": "hello", "role": "student", "key": key})
    return recv(ws, "ready")


def test_auth():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, other_sid = s
    for bad in ({"t": "hello", "role": "tutor", "token": "nope", "student": sid},
                {"t": "hello", "role": "tutor", "token": tok, "student": other_sid},
                {"t": "hello", "role": "tutor", "token": tok, "student": "x"},
                {"t": "hello", "role": "student", "key": "nope"}):
        with c.websocket_connect(WS) as ws:
            ws.send_json(bad)
            assert ws.receive_json() == {"t": "error", "code": "auth"}
    with c.websocket_connect(WS) as ws:
        ws.send_json({"t": "load", "material": FARM})
        assert ws.receive_json() == {"t": "error", "code": "bad"}
    with c.websocket_connect(WS) as ws:
        r = hello_tutor(ws, tok, sid)
        assert r == {"t": "ready", "role": "tutor", "name": "Lucas", "tutor": "Nora", "adult": False, "lesson": None}
        assert recv(ws, "presence") == {"t": "presence", "tutor": True, "student": False, "visible": False}
        ws.send_json({"t": "ping"})
        assert recv(ws, "pong") == {"t": "pong"}
    with c.websocket_connect(WS) as ws:
        r = hello_student(ws, key)
        assert r["role"] == "student" and r["name"] == "Lucas" and r["tutor"] == "Nora" and r["lesson"] is None
    from starlette.websockets import WebSocketDisconnect
    try:
        with c.websocket_connect(WS, headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()
        assert False, "foreign origin must be closed"
    except WebSocketDisconnect as e:
        assert e.code == 1008


def test_relay_and_presence():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, _ = s
    with c.websocket_connect(WS) as st:
        hello_student(st, key)
        assert recv(st, "presence") == {"t": "presence", "tutor": False, "student": True, "visible": True}
        with c.websocket_connect(WS) as tu:
            hello_tutor(tu, tok, sid)
            both = {"t": "presence", "tutor": True, "student": True, "visible": True}
            assert recv(tu, "presence") == both and recv(st, "presence") == both

            # tutor → student
            tu.send_json({"t": "start", "items": [{"id": "m_es_farm_1"}], "index": 0})
            m = recv(st, "start")
            assert m["lesson"]["material"] is None and m["lesson"]["items"] == [{"id": "m_es_farm_1"}]
            tu.send_json({"t": "load", "material": FARM})
            assert recv(st, "load") == {"t": "load", "material": FARM}
            tu.send_json({"t": "cmd", "type": "goto", "step": 2, "evil": 1})
            assert recv(st, "cmd") == {"t": "cmd", "type": "goto", "step": 2}
            tu.send_json({"t": "cmd", "type": "rm -rf"})          # dropped
            tu.send_json({"t": "point", "a": "s2.gap3", "x": 0.5, "y": 1.7})
            assert recv(st, "point") == {"t": "point", "a": "s2.gap3", "x": 0.5, "y": 1.0}
            tu.send_json({"t": "reward", "kind": "gift"})
            assert recv(st, "reward") == {"t": "reward", "kind": "gift"}

            # student → tutor
            state = {"step": 0, "inputs": {"s0.gap0": "vac"}}
            st.send_json({"t": "state", "state": state})
            assert recv(tu, "state") == {"t": "state", "state": state}
            st.send_json({"t": "cursor", "a": "s0.opt.vaca", "x": 0.25, "y": 0.75})
            assert recv(tu, "cursor") == {"t": "cursor", "a": "s0.opt.vaca", "x": 0.25, "y": 0.75}
            st.send_json({"t": "answer", "step": 0, "item": "vaca", "given": "vaca", "correct": True, "first": True})
            a = recv(tu, "answer")
            assert a["item"] == "vaca" and a["correct"] is True and a["at"]
            st.send_json({"t": "focus", "visible": False})
            assert recv(tu, "presence") == {"t": "presence", "tutor": True, "student": True, "visible": False}
            st.send_json({"t": "focus", "visible": True})
            assert recv(tu, "presence")["visible"] is True

            # a student can't send tutor commands
            st.send_json({"t": "reward", "kind": "star"})
            st.send_json({"t": "cursor", "a": "marker", "x": 0, "y": 0})
            assert recv(tu, "cursor")["a"] == "marker"

            # end: student gets it, the tutor's snapshot keeps the summary
            tu.send_json({"t": "end", "summary": {"done": 1}})
            assert recv(st, "end") == {"t": "end", "summary": {"done": 1}}
        assert recv(st, "presence") == {"t": "presence", "tutor": False, "student": True, "visible": True}
    with c.websocket_connect(WS) as tu:
        r = hello_tutor(tu, tok, sid)
        assert r["lesson"]["ended"] and r["lesson"]["summary"] == {"done": 1}
        assert len(r["lesson"]["answers"]) == 1
    with c.websocket_connect(WS) as st:
        assert hello_student(st, key)["lesson"] is None      # the lesson is over for the student


def test_snapshot_after_reconnect():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, _ = s
    state = {"step": 1, "results": {"s0.vaca": True}, "inputs": {"s1.gap0": "es"}}
    with c.websocket_connect(WS) as tu:
        hello_tutor(tu, tok, sid)
        with c.websocket_connect(WS) as st:
            hello_student(st, key)
            tu.send_json({"t": "load", "material": FARM, "items": [{"id": "a"}, {"id": "b"}], "index": 1})
            assert recv(st, "start")["lesson"]["started"]      # load starts the lesson by itself
            recv(st, "load")
            st.send_json({"t": "state", "state": state})
            recv(tu, "state")
        assert recv(tu, "presence")["student"] is False
        # the student reloads the page: same material, same place
        with c.websocket_connect(WS) as st:
            r = hello_student(st, key)
            assert r["lesson"]["material"] == FARM and r["lesson"]["state"] == state
            assert r["lesson"]["index"] == 1 and "answers" not in r["lesson"]
        tu.send_json({"t": "queue", "items": [{"id": "b"}], "index": 0})
        tu.send_json({"t": "ping"})
        recv(tu, "pong")
    # the tutor reloads too
    with c.websocket_connect(WS) as tu:
        r = hello_tutor(tu, tok, sid)
        assert r["lesson"]["material"] == FARM and r["lesson"]["state"] == state
        assert r["lesson"]["items"] == [{"id": "b"}] and r["lesson"]["index"] == 0
        # start during a running lesson keeps it
        tu.send_json({"t": "start"})
        tu.send_json({"t": "ping"})
        recv(tu, "pong")
    import live
    assert live.ROOMS[sid].lesson["material"] == FARM


def test_second_connection_replaces_first():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, _ = s
    with c.websocket_connect(WS) as st, c.websocket_connect(WS) as tu1:
        hello_student(st, key)
        hello_tutor(tu1, tok, sid)
        with c.websocket_connect(WS) as tu2:
            hello_tutor(tu2, tok, sid)
            assert recv(tu1, "error") == {"t": "error", "code": "replaced"}
            tu2.send_json({"t": "reward", "kind": "star"})
            assert recv(st, "reward")["kind"] == "star"
            # the replaced tab can't steer anymore; the student still sees the tutor
            st.send_json({"t": "cursor", "a": "x", "x": 0, "y": 0})
            assert recv(tu2, "cursor")["a"] == "x"
        assert recv(st, "presence")["tutor"] is False
        # a second student tab replaces the first, too
        with c.websocket_connect(WS) as st2:
            hello_student(st2, key)
            assert recv(st, "error") == {"t": "error", "code": "replaced"}


def test_cursor_rate_limit(monkeypatch=None):
    s = _setup()
    if s is None:
        return
    import live
    real = live.time
    live.time = types.SimpleNamespace(monotonic=lambda: 1000.0)   # one frozen second
    try:
        c, tok, sid, key, _ = s
        with c.websocket_connect(WS) as tu, c.websocket_connect(WS) as st:
            hello_tutor(tu, tok, sid)
            hello_student(st, key)
            for i in range(30):
                st.send_json({"t": "cursor", "a": "step", "x": i / 30, "y": 0})
            st.send_json({"t": "state", "state": {"marker": 1}})
            got = until(tu, "state")
            assert sum(1 for m in got if m["t"] == "cursor") == live.CURSOR_PER_S
    finally:
        live.time = real


def test_message_size_limits():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, _ = s
    import live
    with c.websocket_connect(WS) as tu, c.websocket_connect(WS) as st:
        hello_tutor(tu, tok, sid)
        hello_student(st, key)
        tu.send_text('{"t":"load","material":{"x":"' + "a" * live.MAX_MSG + '"}}')
        assert recv(tu, "error") == {"t": "error", "code": "too_big"}
        tu.send_json({"t": "load", "material": {"x": "a" * (live.MAX_MATERIAL + 10)}})
        assert recv(tu, "error") == {"t": "error", "code": "too_big"}
        st.send_text('{"t":"state","state":"' + "b" * live.MAX_MSG + '"}')
        assert recv(st, "error")["code"] == "too_big"
        # the connection keeps working
        tu.send_json({"t": "load", "material": FARM})
        m = recv(st, "start") and recv(st, "load")
        assert m["material"] == FARM
        st.send_json({"t": "state", "state": {"ok": 1}})
        assert recv(tu, "state")["state"] == {"ok": 1}


def test_sweep_and_busy():
    s = _setup()
    if s is None:
        return
    c, tok, sid, key, _ = s
    import live
    old = live.Room(999999)
    old.last -= live.ROOM_TTL_S + 1
    live.ROOMS[999999] = old
    real = live.MAX_ROOMS
    live.MAX_ROOMS = 1
    try:
        with c.websocket_connect(WS) as tu:
            hello_tutor(tu, tok, sid)            # the stale room is swept to make space
        assert 999999 not in live.ROOMS
        live.ROOMS[123456] = live.Room(123456)   # fresh, full again
        live.ROOMS.pop(sid)
        with c.websocket_connect(WS) as tu:
            tu.send_json({"t": "hello", "role": "tutor", "token": tok, "student": sid})
            assert tu.receive_json() == {"t": "error", "code": "busy"}
    finally:
        live.MAX_ROOMS = real
        live.ROOMS.clear()


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("ok")
