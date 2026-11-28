"""Live invites (api/invites.py): poll, respond, decline sticks, expiry, status.

Runs under pytest or standalone; needs fastapi + httpx (skipped without).
"""

import os
import sys
import tempfile
import time
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None
    import classes
    import invites
    import main
    classes.init_db()
    with classes.connect() as con:
        con.execute("DELETE FROM classes")
    classes._buckets.clear()
    invites.INVITES.clear()
    return TestClient(main.app)


def _class(c, name="6b", pupils=("Mia", "Leo")):
    r = c.post("/api/class/create", json={"name": name, "lang": "de"}).json()
    toks = {}
    for p in pupils:
        j = c.post("/api/class/join", json={"code": r["code"], "nickname": p}).json()
        toks[p] = j["student_token"]
    import classes
    with classes.connect() as con:
        cid = con.execute("SELECT id FROM classes WHERE code = ?", (r["code"].replace("-", ""),)).fetchone()["id"]
    return cid, r["teacher_token"], toks


def test_poll_respond_status():
    c = _client()
    if c is None:
        return
    import invites
    cid, _t, toks = _class(c)
    other_cid, _t2, other = _class(c, "7a", ("Ana",))
    # nothing live: empty answer, no database needed
    r = c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()
    assert r == {"ok": True, "poll": invites.POLL_S, "invites": []}
    changes = []
    inv = invites.open_invite(cid, "quiz", class_name="6b", host="Frau K", target="/games/quiz-room/index.html?code=ABCDEF",
                              pupils=invites.roster(cid), on_change=lambda i: changes.append(i.status()))
    st = inv.status()
    assert st["waiting"] == 2 and st["joined"] == 0 and [x["name"] for x in st["list"]] == ["Leo", "Mia"]
    # a device with two people (siblings) and an unknown token: one invite each, in token order
    r = c.post("/api/invites", json={"tokens": ["nope", toks["Leo"], toks["Mia"]]}).json()
    assert [(x["name"], x["who"]) for x in r["invites"]] == [("Leo", 1), ("Mia", 2)]
    x = r["invites"][0]
    assert x["kind"] == "quiz" and x["class"] == "6b" and x["host"] == "Frau K" and x["target"].startswith("/games/quiz-room/")
    assert "token" not in str(x)
    # another class sees nothing
    assert c.post("/api/invites", json={"tokens": [other["Ana"]]}).json()["invites"] == []
    # Jetzt nicht: recorded, not shown again for that pupil, the teacher sees it
    assert c.post("/api/invites/respond", json={"token": toks["Mia"], "invite": inv.id, "answer": "decline"}).json()["ok"]
    r = c.post("/api/invites", json={"tokens": [toks["Mia"], toks["Leo"]]}).json()
    assert [x["name"] for x in r["invites"]] == ["Leo"]
    assert changes[-1]["declined"] == 1 and {"name": "Mia", "s": "declined"} in changes[-1]["list"]
    # join
    assert c.post("/api/invites/respond", json={"token": toks["Leo"], "invite": inv.id, "answer": "join"}).json()["ok"]
    assert c.post("/api/invites", json={"tokens": [toks["Leo"]]}).json()["invites"] == []
    assert inv.status()["joining"] == 1                  # pressed Beitreten, not in the room yet
    # a pupil of another class can't answer this invite; bad answers are refused
    assert c.post("/api/invites/respond", json={"token": other["Ana"], "invite": inv.id, "answer": "join"}).status_code == 404
    assert c.post("/api/invites/respond", json={"token": toks["Leo"], "invite": inv.id, "answer": "maybe"}).status_code == 400
    # paused (room locked): not shown; session ends: gone with its answers
    invites.set_paused(inv, True)
    new = c.post("/api/class/join", json={"code": _code(cid), "nickname": "Zoe"}).json()["student_token"]
    assert c.post("/api/invites", json={"tokens": [new]}).json()["invites"] == []
    invites.set_paused(inv, False)
    assert len(c.post("/api/invites", json={"tokens": [new]}).json()["invites"]) == 1
    invites.close_invite(inv)
    assert c.post("/api/invites", json={"tokens": [new]}).json()["invites"] == []
    assert c.post("/api/invites/respond", json={"token": new, "invite": inv.id, "answer": "join"}).status_code == 404
    assert not invites.INVITES


def _code(cid):
    import classes
    with classes.connect() as con:
        return con.execute("SELECT code FROM classes WHERE id = ?", (cid,)).fetchone()["code"]


def test_expiry_and_limits():
    c = _client()
    if c is None:
        return
    import classes
    import invites
    cid, _t, toks = _class(c)
    inv = invites.open_invite(cid, "lesson", host="Nora", target="/en/spanish/me/", pupils=invites.roster(cid), ttl=0.05)
    assert len(c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()["invites"]) == 1
    time.sleep(0.08)
    assert c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()["invites"] == []
    assert inv.id not in invites.INVITES                     # swept: nothing kept after the expiry
    # too many tokens in one request are cut, oversized bodies refused
    assert c.post("/api/invites", json={"tokens": ["x"] * 40}).status_code == 422
    # rate limit per IP
    n, _w = classes.LIMITS["invites"]
    classes.LIMITS["invites"] = (3, 60.0)
    classes._buckets.clear()
    try:
        codes = [c.post("/api/invites", json={"tokens": []}).status_code for _ in range(5)]
        assert codes[:3] == [200, 200, 200] and codes[3] == 429
    finally:
        classes.LIMITS["invites"] = (n, _w)
        classes._buckets.clear()


def test_removed_stays_removed():
    c = _client()
    if c is None:
        return
    import invites
    cid, _t, toks = _class(c)
    inv = invites.open_invite(cid, "quiz", class_name="6b", target="/x", pupils=invites.roster(cid))
    sid = next(k for k, v in inv.roster.items() if v == "Mia")
    invites.mark(inv, sid, "removed")
    invites.mark(inv, sid, "joined")
    assert inv.responses[sid] == "removed"
    assert [x["name"] for x in inv.status()["list"]] == ["Leo"]
    assert c.post("/api/invites", json={"tokens": [toks["Mia"]]}).json()["invites"] == []


def test_left_is_invited_again():
    """Owner 2026-11-28 "yes, re-invite": only Jetzt nicht stops the invite. Left (was in,
    now offline) comes back after REJOIN_S; Beitreten without arriving after JOINING_S."""
    c = _client()
    if c is None:
        return
    import invites
    cid, _t, toks = _class(c)
    inv = invites.open_invite(cid, "quiz", class_name="6b", target="/x", pupils=invites.roster(cid))
    mia = next(k for k, v in inv.roster.items() if v == "Mia")
    leo = next(k for k, v in inv.roster.items() if v == "Leo")
    poll = lambda t: [x["name"] for x in c.post("/api/invites", json={"tokens": [t]}).json()["invites"]]
    old = invites.REJOIN_S, invites.JOINING_S
    invites.REJOIN_S, invites.JOINING_S = 0.15, 0.15
    try:
        invites.mark(inv, mia, "left")                   # never in: "left" is ignored
        assert mia not in inv.responses
        invites.mark(inv, mia, "joined")
        assert poll(toks["Mia"]) == []                   # in the room: no overlay
        invites.mark(inv, mia, "left")
        assert poll(toks["Mia"]) == []                   # just left (reload, network): wait
        st = inv.status()
        assert st["left"] == 1 and {"name": "Mia", "s": "left"} in st["list"]
        time.sleep(0.2)
        assert poll(toks["Mia"]) == ["Mia"]              # gone for a while: invited again
        invites.mark(inv, mia, "joined")                 # back in the room
        assert poll(toks["Mia"]) == []
        # Beitreten pressed but never arrived: back after JOINING_S
        r = c.post("/api/invites/respond", json={"token": toks["Leo"], "invite": inv.id, "answer": "join"}).json()
        assert r["ok"] and inv.responses[leo] == "joining" and poll(toks["Leo"]) == []
        time.sleep(0.2)
        assert poll(toks["Leo"]) == ["Leo"]
        # Jetzt nicht sticks, also after leaving
        c.post("/api/invites/respond", json={"token": toks["Leo"], "invite": inv.id, "answer": "decline"})
        invites.mark(inv, leo, "left")
        time.sleep(0.2)
        assert poll(toks["Leo"]) == [] and inv.responses[leo] == "declined"
    finally:
        invites.REJOIN_S, invites.JOINING_S = old


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
