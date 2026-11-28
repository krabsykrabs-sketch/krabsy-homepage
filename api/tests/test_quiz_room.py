"""Quiz Room: create, join, answer, reveal, end, teacher controls (games/quiz-show).

Runs under pytest or standalone; needs fastapi + httpx (skipped without).
"""

import os
import sys
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

WS = "/api/quiz/ws"


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None
    import main
    import quiz_room
    quiz_room.ROOMS.clear()
    quiz_room._creates.clear()
    return TestClient(main.app)


def Q(n=3):
    out = []
    for i in range(n):
        out.append({"kind": "trio", "base": f"go{i}", "slots": [None, None], "askIndex": 0,
                    "options": ["went", "goed", "gone", "wented"], "correct": 0,
                    "teach": f"go{i} → went → ___", "item": f"go{i}", "topic": "irregular_verbs",
                    "form": "past"})
    return out


def recv(ws, t, limit=50):
    """Next message of type t (skips players/pos/answered noise)."""
    for _ in range(limit):
        m = ws.receive_json()
        if m["t"] == t:
            return m
    raise AssertionError(f"no {t}")


def test_full_quiz():
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(2), "time": 30, "lang": "de"})
        created = recv(teacher, "created")
        code = created["code"]
        assert len(code) == 6 and created["token"] and created["phase"] == "lobby"
        with c.websocket_connect(WS) as a, c.websocket_connect(WS) as b:
            a.send_json({"t": "join", "code": code[:3] + "-" + code[3:].lower(), "name": "Mia", "avatar": 2})
            ja = recv(a, "joined")
            assert ja["name"] == "Mia" and ja["phase"] == "lobby" and "questions" not in ja
            b.send_json({"t": "join", "code": code, "name": "mia"})
            jb = recv(b, "joined")
            assert jb["name"] == "mia 2"                       # names are unique in a room
            pl = recv(teacher, "players")
            assert len(pl["list"]) >= 1

            teacher.send_json({"t": "start"})
            qa = recv(a, "question")
            assert "correct" not in qa["q"] and "teach" not in qa["q"]   # no answer leaks
            assert recv(teacher, "question")["q"]["correct"] == 0
            recv(b, "question")

            a.send_json({"t": "answer", "qi": 0, "opt": 0})
            a.send_json({"t": "answer", "qi": 0, "opt": 1})          # second answer ignored
            assert recv(b, "answered")["pid"] == ja["pid"]
            b.send_json({"t": "answer", "qi": 0, "opt": 2})
            ra = recv(a, "reveal")                                     # all answered → reveal
            assert ra["correct"] == 0 and ra["you"]["right"] and ra["you"]["pts"] >= 500
            assert ra["word"] == {"item": "go0", "topic": "irregular_verbs", "form": "past"}
            assert "item" not in qa["q"]                                # not before the reveal
            rb = recv(b, "reveal")
            assert not rb["you"]["right"] and rb["you"]["pts"] == 0 and "counts" not in rb
            rt = recv(teacher, "reveal")
            assert rt["counts"] == [1, 0, 1, 0] and rt["top"][0]["name"] == "Mia"

            teacher.send_json({"t": "next"})
            recv(a, "question")
            teacher.send_json({"t": "next"})                          # nobody answered: reveal
            r2 = recv(a, "reveal")
            assert r2["you"]["opt"] is None and r2["you"]["streak"] == 0
            teacher.send_json({"t": "next"})                          # after the last → end
            ea = recv(a, "end")
            assert ea["you"]["rank"] == 1 and "review" not in ea
            et = recv(teacher, "end")
            assert et["ranking"][0]["name"] == "Mia"
            # q0: one wrong; q1: both missed → go1 first
            assert [r["q"]["item"] for r in et["review"]] == ["go1", "go0"]
            assert et["review"][0]["n"] == 2


def test_rejoin_lock_remove_rename():
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(1), "time": 30})
        code = recv(teacher, "created")["code"]
        with c.websocket_connect(WS) as a:
            a.send_json({"t": "join", "code": code, "name": "Leo"})
            ja = recv(a, "joined")
        # Same token comes back as the same player (reload / sleeping Chromebook).
        with c.websocket_connect(WS) as a2:
            a2.send_json({"t": "join", "code": code, "name": "Other", "token": ja["token"]})
            j2 = recv(a2, "joined")
            assert j2["pid"] == ja["pid"] and j2["name"] == "Leo"
            teacher.send_json({"t": "rename", "pid": ja["pid"], "name": "Leon"})
            assert recv(a2, "renamed")["name"] == "Leon"
            teacher.send_json({"t": "lock", "on": True})
            recv(a2, "players")
            with c.websocket_connect(WS) as x:
                x.send_json({"t": "join", "code": code, "name": "New"})
                assert recv(x, "error")["code"] == "locked"
            teacher.send_json({"t": "remove", "pid": ja["pid"]})
            assert recv(a2, "kicked")
        with c.websocket_connect(WS) as a3:
            a3.send_json({"t": "join", "code": code, "name": "Leo", "token": ja["token"]})
            assert recv(a3, "error")["code"] == "removed"


def test_teacher_resume_and_errors():
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": [{"kind": "trio"}], "time": 30})
        assert recv(teacher, "error")["code"] == "no_questions"
        teacher.send_json({"t": "create", "questions": Q(1), "time": 1})
        created = recv(teacher, "created")
        assert created["time"] == 5                                   # clamped
    with c.websocket_connect(WS) as t2:
        t2.send_json({"t": "resume", "code": created["code"], "token": "wrong"})
        assert recv(t2, "error")["code"] == "no_room"
        t2.send_json({"t": "resume", "code": created["code"], "token": created["token"]})
        assert recv(t2, "resumed")["questions"][0]["correct"] == 0
    with c.websocket_connect(WS) as x:
        x.send_json({"t": "join", "code": "ZZZZZZ", "name": "A"})
        assert recv(x, "error")["code"] == "no_room"
        x.send_json({"t": "join", "code": created["code"], "name": "  ##  "})
        assert recv(x, "error")["code"] == "bad_name"


def test_edit_questions_in_lobby_only():
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(2), "time": 30})
        code = recv(teacher, "created")["code"]
        teacher.send_json({"t": "questions", "questions": Q(5)})
        assert recv(teacher, "questions_set")["n"] == 5
        teacher.send_json({"t": "questions", "questions": []})
        assert recv(teacher, "error")["code"] == "no_questions"
        with c.websocket_connect(WS) as a:
            a.send_json({"t": "join", "code": code, "name": "Ida"})
            recv(a, "joined")
            teacher.send_json({"t": "start"})
            assert recv(a, "question")["n"] == 5
            teacher.send_json({"t": "questions", "questions": Q(1)})
            assert recv(teacher, "error")["code"] == "started"


def test_play_area_messages():
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(1), "time": 30})
        code = recv(teacher, "created")["code"]
        with c.websocket_connect(WS) as a, c.websocket_connect(WS) as b:
            a.send_json({"t": "join", "code": code, "name": "Ana"}); recv(a, "joined")
            b.send_json({"t": "join", "code": code, "name": "Ben"}); recv(b, "joined")
            a.send_json({"t": "emote", "e": 2})
            assert recv(b, "emote")["e"] == 2
            a.send_json({"t": "ball", "b": 1, "p": [1, 0.3, 2], "v": [99, 4, 0]})
            ball = recv(b, "ball")
            assert ball["b"] == 1 and ball["v"][0] == 30            # clamped
            a.send_json({"t": "boom"})
            assert recv(b, "boom")["pid"]
            a.send_json({"t": "boom"})                                # cooldown: dropped
            teacher.send_json({"t": "middle", "on": True})
            m = recv(b, "middle")                                     # (no second boom before it)
            assert m["on"] is True
            teacher.send_json({"t": "start"})
            recv(b, "question")
            with c.websocket_connect(WS) as b2:                       # middle ends with the question
                b2.send_json({"t": "join", "code": code, "name": "Cy"})
                assert recv(b2, "joined")["middle"] is False


def test_bonus_round_by_position():
    c = _client()
    if c is None:
        return
    import quiz_room
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(1), "bonus": Q(2), "time": 30})
        created = recv(teacher, "created")
        assert created["n"] == 3 and created["questions"][1]["bonus"] is True
        with c.websocket_connect(WS) as a, c.websocket_connect(WS) as b:
            a.send_json({"t": "join", "code": created["code"], "name": "Ana"}); recv(a, "joined")
            b.send_json({"t": "join", "code": created["code"], "name": "Ben"}); recv(b, "joined")
            teacher.send_json({"t": "start"}); recv(a, "question")
            teacher.send_json({"t": "next"}); recv(a, "reveal"); recv(b, "reveal")   # normal question, nobody answered
            teacher.send_json({"t": "next"})
            qb = recv(a, "question")
            assert qb["q"]["bonus"] and qb["bonus"] == {"i": 0, "n": 2} and "correct" not in qb["q"]
            assert qb["ends_in"] > 30000                                # extra time to run
            a.send_json({"t": "answer", "qi": qb["qi"], "opt": 0})     # ignored in the bonus round
            # Ana on pad A (right), Ben on pad C (wrong).
            a.send_json({"t": "move", "p": [quiz_room.PAD_X[0], 0, quiz_room.PAD_Z], "r": 0, "a": 0})
            b.send_json({"t": "move", "p": [quiz_room.PAD_X[2] + 1, 0, quiz_room.PAD_Z - 1], "r": 0, "a": 0})
            pads = recv(teacher, "pads")
            for _ in range(10):
                if pads["counts"] == [1, 0, 1, 0]:
                    break
                pads = recv(teacher, "pads")
            assert pads["counts"] == [1, 0, 1, 0]
            teacher.send_json({"t": "next"})
            ra = recv(a, "reveal"); rb = recv(b, "reveal")
            assert ra["you"]["right"] and ra["you"]["opt"] == 0 and ra["you"]["pts"] == 500
            assert not rb["you"]["right"] and rb["you"]["opt"] == 2


def test_room_grows_with_the_group():
    """The floor plan grows in steps as children join (never shrinks), not during a bonus
    question; bonus answers are judged on the grown pads."""
    c = _client()
    if c is None:
        return
    import quiz_room
    old = quiz_room.SIZES
    quiz_room.SIZES = ((1, 1.0), (2, 1.25), (40, 1.5))      # small steps for the test
    try:
        with c.websocket_connect(WS) as teacher:
            teacher.send_json({"t": "create", "questions": Q(1), "bonus": Q(1), "time": 30})
            created = recv(teacher, "created")
            assert created["size"] == 1.0
            code = created["code"]
            with c.websocket_connect(WS) as a, c.websocket_connect(WS) as b, c.websocket_connect(WS) as d:
                a.send_json({"t": "join", "code": code, "name": "Ana"}); assert recv(a, "joined")["size"] == 1.0
                b.send_json({"t": "join", "code": code, "name": "Ben"})
                assert recv(b, "joined")["size"] == 1.0                    # snapshot before the step
                assert recv(b, "size")["s"] == 1.25 and recv(a, "size")["s"] == 1.25
                assert recv(teacher, "size")["s"] == 1.25
                teacher.send_json({"t": "start"}); recv(a, "question")
                teacher.send_json({"t": "next"}); recv(a, "reveal")
                teacher.send_json({"t": "next"}); qb = recv(a, "question"); assert qb["q"]["bonus"]
                d.send_json({"t": "join", "code": code, "name": "Dan"}); jd = recv(d, "joined")
                assert jd["size"] == 1.25                                  # held back in the bonus round
                # Ana stands on pad A as it is at 1.25 (would be off the pad at 1.0).
                x, z = quiz_room.PAD_X[0] * 1.25, quiz_room.PAD_Z * 1.25 + quiz_room.pad_half(1.25) - 0.1
                assert quiz_room.pad_at([x, 0, z]) is None and quiz_room.pad_at([x, 0, z], 1.25) == 0
                a.send_json({"t": "move", "p": [x, 0, z], "r": 0, "a": 0})
                for _ in range(10):
                    pads = recv(teacher, "pads")
                    if pads["counts"][0] == 1:
                        break
                assert pads["counts"][0] == 1
                teacher.send_json({"t": "next"}); ra = recv(a, "reveal")
                assert ra["you"]["right"] and ra["you"]["opt"] == 0
    finally:
        quiz_room.SIZES = old
    assert quiz_room.size_for(1) == 1.0 and quiz_room.size_for(16) == 1.25 and quiz_room.size_for(40) == 1.5


def test_teacher_figure():
    """The teacher has a figure: name from create (filtered), position relayed as pid 0,
    emotes, online/offline for the children; it is never a player."""
    c = _client()
    if c is None:
        return
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(1), "time": 30, "host": "Frau Ahrens"})
        created = recv(teacher, "created")
        assert created["host"]["name"] == "Frau Ahrens" and created["host"]["online"]
        token = created["token"]
        with c.websocket_connect(WS) as a:
            a.send_json({"t": "join", "code": created["code"], "name": "Ana"})
            ja = recv(a, "joined")
            assert ja["host"]["name"] == "Frau Ahrens" and ja["host"]["online"]
            assert all(p["pid"] != 0 for p in ja["players"])
            teacher.send_json({"t": "move", "p": [3, 0, -4], "r": 1.5, "a": 1})
            for _ in range(20):
                m = recv(a, "pos")
                hp = [e for e in m["s"] if e[0] == 0]
                if hp:
                    break
            assert hp and hp[0][1:4] == [3, 0, -4] and hp[0][5] == 1
            teacher.send_json({"t": "emote", "e": 2})
            assert recv(a, "emote") == {"t": "emote", "pid": 0, "e": 2}
            teacher.send_json({"t": "host", "name": "Mr K"})
            assert recv(a, "host")["name"] == "Mr K"
            a.send_json({"t": "host", "name": "Hacker"})           # children can't rename the teacher
        with c.websocket_connect(WS) as b:
            b.send_json({"t": "join", "code": created["code"], "name": "Ben"})
            assert recv(b, "joined")["host"]["name"] == "Mr K"
            teacher.close()
            assert recv(b, "host")["online"] is False
            with c.websocket_connect(WS) as t2:
                t2.send_json({"t": "resume", "code": created["code"], "token": token})
                assert recv(t2, "resumed")["host"]["online"]
                assert recv(b, "host")["online"] is True


def test_outbox_slow_device():
    """A slow device gets every important message, in order; old positions are dropped."""
    try:
        import quiz_room
    except Exception:
        return
    import asyncio

    class Slow:
        def __init__(self):
            self.sent = []

        async def send_text(self, txt):
            await asyncio.sleep(0.02)
            self.sent.append(txt)

        async def close(self):
            self.sent.append("CLOSED")

    async def run():
        ws = Slow()
        ob = quiz_room.Outbox(ws)
        for i in range(40):
            ob.put({"t": "pos", "i": i})
        ob.put({"t": "question", "qi": 1})
        ob.put({"t": "reveal", "qi": 1})
        ob.put(None)
        await asyncio.sleep(0.6)
        return ws.sent

    sent = asyncio.run(run())
    pos = [x for x in sent if '"pos"' in x]
    assert len(pos) <= quiz_room.OUTBOX_POS_LIMIT + 1
    assert sent[-3:] == ['{"t":"question","qi":1}', '{"t":"reveal","qi":1}', "CLOSED"]


def test_pad_at():
    import quiz_room
    assert quiz_room.pad_at([-6.6, 0, 3.5]) == 0
    assert quiz_room.pad_at([6.6 + 1.7, 0.3, 3.5 - 1.7]) == 3
    assert quiz_room.pad_at([-4.4, 0, 3.5]) is None                   # gap between pads
    assert quiz_room.pad_at([2.2, -1.1, 3.5]) is None                 # fell into the pit
    assert quiz_room.pad_at([2.2, 0, 6.0]) is None


def test_origin_and_names():
    import quiz_room
    assert quiz_room._ORIGIN.match("https://krabsy.com")
    assert quiz_room._ORIGIN.match("http://localhost:8142")
    assert not quiz_room._ORIGIN.match("https://evil.example")
    assert quiz_room.clean_name("  Ana   María ") == "Ana María"
    assert quiz_room.clean_name("<b>Tom</b>") == "bTomb"   # tags stripped to letters
    assert quiz_room.clean_name("Shithead") == ""
    assert quiz_room.points(0, 20) == 1000 and quiz_room.points(20000, 20) == 500


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)


def test_class_room_invite():
    """A room "for class X": invite on any page, pupils join with their class identity
    (no code typed, no name), the teacher sees joined / declined / waiting; code joins
    still work; the invite ends with the quiz (live invites, api/invites.py)."""
    c = _client()
    if c is None:
        return
    import classes
    import invites
    classes.init_db()
    classes._buckets.clear()
    invites.INVITES.clear()
    cr = c.post("/api/class/create", json={"name": "6b", "lang": "de"}).json()
    toks = {n: c.post("/api/class/join", json={"code": cr["code"], "nickname": n}).json()["student_token"]
            for n in ("Mia", "Leo", "Ida")}
    other = c.post("/api/class/create", json={"name": "7a"}).json()
    ana = c.post("/api/class/join", json={"code": other["code"], "nickname": "Ana"}).json()["student_token"]
    with c.websocket_connect(WS) as teacher:
        # a class the teacher doesn't own: refused, no room
        teacher.send_json({"t": "create", "questions": Q(1), "class": {"teacher_token": "x" * 30}})
        assert recv(teacher, "error")["code"] == "no_class"
        teacher.send_json({"t": "create", "questions": Q(1), "time": 30, "lang": "es", "host": "Profe Ana",
                           "class": {"teacher_token": cr["teacher_token"]}})
        code = recv(teacher, "created")["code"]
        st = recv(teacher, "invite")
        assert st["class"] == "6b" and st["waiting"] == 3 and st["joined"] == 0
        # every pupil of the class gets the invite, the other class nothing
        inv = c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()["invites"]
        assert len(inv) == 1 and inv[0]["kind"] == "quiz" and inv[0]["host"] == "Profe Ana"
        assert inv[0]["target"] == f"/games/quiz-room/index.html?code={code}&lang=es&class=1"
        assert c.post("/api/invites", json={"tokens": [ana]}).json()["invites"] == []
        iid = inv[0]["id"]
        # Leo: Jetzt nicht → the teacher sees it, no invite again
        c.post("/api/invites/respond", json={"token": toks["Leo"], "invite": iid, "answer": "decline"})
        st = recv(teacher, "invite")
        assert st["declined"] == 1 and {"name": "Leo", "s": "declined"} in st["list"]
        assert c.post("/api/invites", json={"tokens": [toks["Leo"]]}).json()["invites"] == []
        with c.websocket_connect(WS) as mia, c.websocket_connect(WS) as kid, c.websocket_connect(WS) as bad:
            # Mia joins with her class identity: no name typed, the class name is used
            mia.send_json({"t": "join", "code": code, "student": toks["Mia"], "avatar": 3})
            jm = recv(mia, "joined")
            assert jm["name"] == "Mia" and jm["cls"] == "6b" and jm["you"]["avatar"] == 3
            st = recv(teacher, "invite")
            assert st["joined"] == 1 and {"name": "Mia", "s": "joined"} in st["list"]
            assert c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()["invites"] == []
            # a pupil of another class can't use the identity path
            bad.send_json({"t": "join", "code": code, "student": ana})
            assert recv(bad, "error")["code"] == "not_in_class"
            # joining by code still works for everyone else
            kid.send_json({"t": "join", "code": code, "name": "Gast"})
            assert recv(kid, "joined")["name"] == "Gast"
            # Mia on a second device = the same player
            with c.websocket_connect(WS) as mia2:
                mia2.send_json({"t": "join", "code": code, "student": toks["Mia"]})
                assert recv(mia2, "joined")["pid"] == jm["pid"]
                # locked: the invite pauses
                teacher.send_json({"t": "lock", "on": True})
                recv(teacher, "players")
                assert c.post("/api/invites", json={"tokens": [toks["Ida"]]}).json()["invites"] == []
                teacher.send_json({"t": "lock", "on": False})
                recv(teacher, "players")
                assert len(c.post("/api/invites", json={"tokens": [toks["Ida"]]}).json()["invites"]) == 1
                # the answers: the reveal gives the word, which the pupil's device records
                # for the class (krabsy-stats recordAttempt → /api/class/answers)
                teacher.send_json({"t": "start"})
                q = recv(mia2, "question")
                mia2.send_json({"t": "answer", "qi": q["qi"], "opt": 0})
                kid.send_json({"t": "answer", "qi": q["qi"], "opt": 1})
                rv = recv(mia2, "reveal")
                assert rv["you"]["right"] and rv["word"]["item"] == "go0"
                teacher.send_json({"t": "next"})                 # after the last question → end
                recv(teacher, "end")
                # quiz over: nobody is invited any more, nothing kept
                assert c.post("/api/invites", json={"tokens": [toks["Ida"]]}).json()["invites"] == []
                assert not invites.INVITES


def test_class_room_remove_and_close():
    c = _client()
    if c is None:
        return
    import classes
    import invites
    classes.init_db()
    classes._buckets.clear()
    invites.INVITES.clear()
    cr = c.post("/api/class/create", json={"name": "5c"}).json()
    tok = c.post("/api/class/join", json={"code": cr["code"], "nickname": "Tom"}).json()["student_token"]
    with c.websocket_connect(WS) as teacher:
        teacher.send_json({"t": "create", "questions": Q(1), "class": {"teacher_token": cr["teacher_token"]}})
        code = recv(teacher, "created")["code"]
        recv(teacher, "invite")
        with c.websocket_connect(WS) as tom:
            tom.send_json({"t": "join", "code": code, "student": tok})
            pid = recv(tom, "joined")["pid"]
            teacher.send_json({"t": "remove", "pid": pid})
            recv(tom, "kicked")
        with c.websocket_connect(WS) as tom2:                      # removed stays removed
            tom2.send_json({"t": "join", "code": code, "student": tok})
            assert recv(tom2, "error")["code"] == "removed"
        assert recv(teacher, "invite")["joined"] == 1
        st = recv(teacher, "invite")                              # removed: off the list
        assert st["list"] == [] and st["waiting"] == 0
        # a code room (no class) refuses the identity path
        with c.websocket_connect(WS) as t2:
            t2.send_json({"t": "create", "questions": Q(1)})
            code2 = recv(t2, "created")["code"]
            with c.websocket_connect(WS) as k:
                k.send_json({"t": "join", "code": code2, "student": tok})
                assert recv(k, "error")["code"] == "no_class"
        teacher.send_json({"t": "close"})
        recv(teacher, "closed")
    assert not invites.INVITES
