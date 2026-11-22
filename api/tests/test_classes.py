"""Classes (phase 2): create, join, answers, teacher dashboard, deletion.

Runs under pytest or standalone; needs fastapi + httpx (skipped without).
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
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
    import main
    classes.init_db()
    with classes.connect() as con:                    # empty tables, keep the file
        con.execute("DELETE FROM classes")
    classes._buckets.clear()
    return TestClient(main.app)


def _skip():
    print("  (skipped: fastapi/httpx not installed)")


def test_full_flow():
    c = _client()
    if c is None:
        return _skip()
    r = c.post("/api/class/create", json={"name": "  Klasse   6b ", "lang": "de"}).json()
    assert r["ok"] and r["name"] == "Klasse 6b" and len(r["code"]) == 7 and r["code"][3] == "-"
    code, teacher = r["code"], r["teacher_token"]

    # join with a sloppy code; same nickname later = same pupil
    mia = c.post("/api/class/join", json={"code": code.lower().replace("-", " "), "nickname": "Mia"}).json()
    assert mia["ok"] and mia["class_name"] == "Klasse 6b"
    tom = c.post("/api/class/join", json={"code": code, "nickname": "Tom"}).json()
    again = c.post("/api/class/join", json={"code": code, "nickname": "mia"}).json()
    assert again["ok"]
    assert c.post("/api/class/join", json={"code": "ZZZ-ZZZ", "nickname": "X"}).status_code == 404
    assert c.post("/api/class/join", json={"code": code, "nickname": "<script>"}).status_code == 400

    def send(tok, answers):
        return c.post("/api/class/answers", json={"answers": answers}, headers={"X-Student-Token": tok})

    a = lambda item, ok, form="past": {"topic": "irregular_verbs", "item": item, "form": form,  # noqa: E731
                                       "correct": ok, "source": "verb-towers"}
    # Mia's first token was replaced by the re-join -> old token no longer works
    assert send(mia["student_token"], [a("go", True)]).status_code == 401
    r = send(again["student_token"], [a("bring", False), a("bring", False), a("bring", True), a("go", True),
                                      {"topic": "evil", "item": "x", "form": "past", "correct": True}]).json()
    assert r["stored"] == 4                                   # bad topic dropped
    send(tom["student_token"], [a("bring", False), a("go", True), a("go", True)])

    d = c.get("/api/class/dashboard", headers={"X-Teacher-Token": teacher}).json()
    assert d["class"]["code"] == code and d["class"]["delete_after_days"] == 180
    assert d["week"] == {"active_students": 2, "students": 2, "answers": 7, "correct_pct": 57}
    hard = {w["item"]: w for w in d["hard_words"]}
    assert set(hard) == {"bring"} and hard["bring"]["unsure"] == ["Mia", "Tom"]
    assert {w["item"] for w in d["solid_words"]} == {"go"}
    by_nick = {s["nickname"]: s for s in d["students"]}
    assert by_nick["Mia"]["answers"] == 4 and by_nick["Mia"]["hard_words"] == [{"topic": "irregular_verbs", "item": "bring"}]
    assert by_nick["Tom"]["correct_pct"] == 67

    # wrong token sees nothing; rename; remove a pupil; delete the class
    assert c.get("/api/class/dashboard", headers={"X-Teacher-Token": "nope"}).status_code == 404
    assert c.post("/api/class/rename", json={"name": "7a"}, headers={"X-Teacher-Token": teacher}).json()["ok"]
    c.post("/api/class/remove-student", json={"nickname": "Tom"}, headers={"X-Teacher-Token": teacher})
    assert send(tom["student_token"], [a("go", True)]).status_code == 401
    d = c.get("/api/class/dashboard", headers={"X-Teacher-Token": teacher}).json()
    assert d["class"]["name"] == "7a" and [s["nickname"] for s in d["students"]] == ["Mia"]
    assert c.post("/api/class/delete", headers={"X-Teacher-Token": teacher}).json()["ok"]
    assert c.get("/api/class/dashboard", headers={"X-Teacher-Token": teacher}).status_code == 404
    assert send(again["student_token"], [a("go", True)]).status_code == 401


def test_answers_by_beacon_body_token():
    c = _client()
    if c is None:
        return _skip()
    import json
    r = c.post("/api/class/create", json={"name": "B"}).json()
    j = c.post("/api/class/join", json={"code": r["code"], "nickname": "Lu"}).json()
    body = json.dumps({"token": j["student_token"], "answers": [
        {"topic": "prepositions", "item": "prep_in_month", "form": "default", "correct": True, "source": "sprint"}]})
    res = c.post("/api/class/answers", content=body, headers={"Content-Type": "text/plain;charset=UTF-8"})
    assert res.json()["stored"] == 1
    assert c.post("/api/class/answers", content="not json").status_code == 400


def test_tokens_are_hashed_and_purge():
    c = _client()
    if c is None:
        return _skip()
    import classes
    r = c.post("/api/class/create", json={"name": "Alt"}).json()
    j = c.post("/api/class/join", json={"code": r["code"], "nickname": "Ana"}).json()
    raw = classes.DB_FILE.read_bytes()
    for wal in classes.DB_FILE.parent.glob(classes.DB_FILE.name + "-wal"):
        raw += wal.read_bytes()
    assert r["teacher_token"].encode() not in raw and j["student_token"].encode() not in raw
    assert classes.purge_inactive(now=datetime.now(timezone.utc) + timedelta(days=179)) == 0
    assert classes.purge_inactive(now=datetime.now(timezone.utc) + timedelta(days=181)) == 1
    assert c.get("/api/class/dashboard", headers={"X-Teacher-Token": r["teacher_token"]}).status_code == 404


def test_create_rate_limit():
    c = _client()
    if c is None:
        return _skip()
    codes = [c.post("/api/class/create", json={}).status_code for _ in range(22)]
    assert codes.count(200) == 20 and codes[-1] == 429


if __name__ == "__main__":
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"ok    {name}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"FAIL  {name}: {exc!r}")
    sys.exit(1 if failed else 0)
