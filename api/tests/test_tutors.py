"""Tutor spaces (docs/tutor-platform.md phase 1): space, students, personal
key, answers through the class pipeline, stars, homework, lessons, deletion."""

import os
import sys
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

import tutors  # noqa: E402


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None
    import classes
    import main
    classes.init_db()
    with classes.connect() as con:
        con.execute("DELETE FROM classes")
        con.execute("DELETE FROM tutors")
    classes._buckets.clear()
    return TestClient(main.app)


def A(item, correct, at, source="sprint", mode=None, topic="es_ser"):
    return {"topic": topic, "item": item, "form": "default", "correct": correct, "source": source, "mode": mode, "at": at}


def test_measure_stars_scale():
    t = lambda i: f"2026-11-25T10:{i:02d}:00+00:00"
    assert tutors.measure_stars([]) == 0
    assert tutors.measure_stars([A("a", 0, t(0))]) == 1
    half = [A(f"w{i % 3}", i % 2, t(i)) for i in range(6)]
    assert tutors.measure_stars(half) == 2
    good = [A(f"w{i % 5}", 1, t(i)) for i in range(12)]
    assert tutors.measure_stars(good) == 3
    typed = good + [A(f"w{i % 5}", 1, t(20 + i), source="free_practice") for i in range(8)]
    assert tutors.measure_stars(typed) == 4
    explicit = good + [A(f"w{i % 5}", 1, t(20 + i), mode="typed") for i in range(8)]
    assert tutors.measure_stars(explicit) == 4
    # hint answers never lift a student above two stars
    hints = [A(f"w{i % 5}", 1, t(i), mode="hint") for i in range(20)]
    assert tutors.measure_stars(hints) == 2


def test_space_student_flow():
    c = _client()
    if c is None:
        return
    r = c.post("/api/tutor/create", json={"name": "Nora", "lang": "en"}).json()
    T = {"X-Tutor-Token": r["tutor_token"]}
    assert c.get("/api/tutor/space", headers={"X-Tutor-Token": "nope-nope-nope-nope-nope"}).status_code == 404

    s = c.post("/api/tutor/student/add", json={"name": "Lucas", "level": "A1", "goals": "ser vs estar"}, headers=T).json()
    sid, key = s["id"], s["student_key"]

    # the student page knows who they are
    me = c.get("/api/tutor/me", headers={"X-Student-Token": key}).json()
    assert me["name"] == "Lucas" and me["tutor_name"] == "Nora"

    # answers through the class pipeline, with and without mode
    ans = [A("soy_name", True, f"2026-11-25T10:{i:02d}:00+00:00") for i in range(12)]
    ans[0]["mode"] = "choice"
    ok = c.post("/api/class/answers", json={"answers": ans}, headers={"X-Student-Token": key}).json()
    assert ok["stored"] == 12

    st = c.get(f"/api/tutor/student?id={sid}", headers=T).json()
    assert st["student"]["level"] == "A1" and st["student"]["answers"] == 12
    assert st["topics"]["es_ser"]["measured"] >= 2

    # tutor's stars win; None goes back to measured
    assert c.post("/api/tutor/student/stars", json={"id": sid, "topic": "es_ser", "stars": 5, "note": "uses it"}, headers=T).json()["ok"]
    sp = c.get("/api/tutor/space", headers=T).json()
    assert sp["students"][0]["stars"]["es_ser"] == 5
    c.post("/api/tutor/student/stars", json={"id": sid, "topic": "es_ser", "stars": None}, headers=T)
    st = c.get(f"/api/tutor/student?id={sid}", headers=T).json()
    assert st["topics"]["es_ser"]["set"] is None
    assert c.post("/api/tutor/student/stars", json={"id": sid, "topic": "nope", "stars": 2}, headers=T).status_code == 400

    # homework + progress, visible on the student page
    hw = c.post("/api/tutor/student/homework", json={"id": sid, "topic": "es_estar", "target": "drill:sprint", "difficulty": 1, "note": "10 min"}, headers=T).json()
    assert hw["ok"]
    c.post("/api/class/answers", json={"answers": [A("estoy_bien", True, "2099-01-01T00:00:00+00:00", topic="es_estar")]},
           headers={"X-Student-Token": key})
    me = c.get("/api/tutor/me", headers={"X-Student-Token": key}).json()
    assert me["homework"][0]["target"] == "drill:sprint" and me["homework"][0]["answers"] == 1

    # lessons
    les = c.post("/api/tutor/student/lesson", json={"id": sid, "day": "2026-11-25", "note": "ser with origin"}, headers=T).json()
    assert c.get(f"/api/tutor/student?id={sid}", headers=T).json()["lessons"][0]["note"] == "ser with origin"
    c.post("/api/tutor/student/lesson-delete", json={"id": sid, "item_id": les["lesson_id"]}, headers=T)
    assert c.get(f"/api/tutor/student?id={sid}", headers=T).json()["lessons"] == []

    # update profile
    c.post("/api/tutor/student/update", json={"id": sid, "notes": "likes football"}, headers=T)
    assert c.get(f"/api/tutor/student?id={sid}", headers=T).json()["student"]["notes"] == "likes football"

    # a second tutor can't see Lucas
    other = {"X-Tutor-Token": c.post("/api/tutor/create", json={"name": "X"}).json()["tutor_token"]}
    assert c.get(f"/api/tutor/student?id={sid}", headers=other).status_code == 404

    # the hidden class can't be joined by code
    import classes
    with classes.connect() as con:
        code = con.execute("SELECT c.code FROM classes c JOIN tutor_students ts ON ts.class_id = c.id").fetchone()["code"]
    assert c.post("/api/class/join", json={"code": code, "nickname": "Eve"}).status_code == 404

    # new link: old key stops working
    new = c.post("/api/tutor/student/new-link", json={"id": sid}, headers=T).json()["student_key"]
    assert c.get("/api/tutor/me", headers={"X-Student-Token": key}).status_code == 404
    assert c.get("/api/tutor/me", headers={"X-Student-Token": new}).status_code == 200

    # remove student, delete space
    c.post("/api/tutor/student/remove", json={"id": sid}, headers=T)
    assert c.get("/api/tutor/space", headers=T).json()["students"] == []
    assert c.post("/api/tutor/delete", headers=T).json()["ok"]
    assert c.get("/api/tutor/space", headers=T).status_code == 404


def test_purge_idle_space():
    c = _client()
    if c is None:
        return
    import classes
    from datetime import datetime, timedelta, timezone
    r = c.post("/api/tutor/create", json={"name": "Old"}).json()
    T = {"X-Tutor-Token": r["tutor_token"]}
    c.post("/api/tutor/student/add", json={"name": "Mia"}, headers=T)
    later = datetime.now(timezone.utc) + timedelta(days=classes.RETENTION_DAYS + 1)
    assert tutors.purge_inactive(later) == 1
    with classes.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM classes").fetchone()[0] == 0


if __name__ == "__main__":
    test_measure_stars_scale(); test_space_student_flow(); test_purge_idle_space()
    print("ok")
