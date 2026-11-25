"""Email sign-in for tutors: sign up, sign in, add email to an old space, logout."""
import os
import re
import sys
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API_DIR))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))
os.environ.pop("SMTP_HOST", None)

import mailer  # noqa: E402


def _client():
    try:
        from fastapi.testclient import TestClient
    except Exception:
        return None
    import classes
    import main
    import tutor_auth
    classes.init_db()
    with classes.connect() as con:
        con.execute("DELETE FROM classes")
        con.execute("DELETE FROM tutors")
        con.execute("DELETE FROM tutor_links")
    classes._buckets.clear()
    tutor_auth._buckets.clear()
    mailer.OUTBOX.clear()
    return TestClient(main.app)


def last_link():
    m = re.search(r"#l=([A-Za-z0-9_-]+)", mailer.OUTBOX[-1]["text"])
    return m.group(1) if m else None


def test_signup_login_logout():
    c = _client()
    if c is None:
        return
    assert c.post("/api/tutor/login", json={"email": "not-an-email"}).status_code == 400
    # unknown email without a name: ok, but the mail says there is no space (no link)
    assert c.post("/api/tutor/login", json={"email": "nora@example.com"}).json() == {"ok": True}
    assert mailer.OUTBOX[-1]["subject"].startswith("Krabsy: no tutor space") and last_link() is None
    # sign up
    c.post("/api/tutor/login", json={"email": "Nora@Example.com ", "name": "Nora"})
    tok = last_link()
    v = c.post("/api/tutor/verify", json={"token": tok}).json()
    S = {"X-Tutor-Token": v["session_token"]}
    sp = c.get("/api/tutor/space", headers=S).json()
    assert sp["space"]["name"] == "Nora" and sp["space"]["email"] == "nora@example.com"
    # a link works only once
    assert c.post("/api/tutor/verify", json={"token": tok}).status_code == 410
    # sign in again (other device): same space, another session; both work
    c.post("/api/tutor/login", json={"email": "nora@example.com", "name": "ignored"})
    assert mailer.OUTBOX[-1]["subject"] == "Your Krabsy sign-in link"
    v2 = c.post("/api/tutor/verify", json={"token": last_link()}).json()
    S2 = {"X-Tutor-Token": v2["session_token"]}
    assert c.post("/api/tutor/student/add", json={"name": "Lucas"}, headers=S2).json()["ok"]
    assert len(c.get("/api/tutor/space", headers=S).json()["students"]) == 1
    # logout ends only that session
    c.post("/api/tutor/logout", headers=S2)
    assert c.get("/api/tutor/space", headers=S2).status_code == 404
    assert c.get("/api/tutor/space", headers=S).status_code == 200


def test_add_email_to_old_space_stops_private_link():
    c = _client()
    if c is None:
        return
    old = c.post("/api/tutor/create", json={"name": "Nora"}).json()["tutor_token"]
    P = {"X-Tutor-Token": old}
    c.post("/api/tutor/student/add", json={"name": "Mia"}, headers=P)
    assert c.post("/api/tutor/email", json={"email": "nora@example.com"}, headers=P).json()["ok"]
    assert mailer.OUTBOX[-1]["subject"] == "Confirm your email for Krabsy"
    v = c.post("/api/tutor/verify", json={"token": last_link()}).json()
    S = {"X-Tutor-Token": v["session_token"]}
    assert c.get("/api/tutor/space", headers=S).json()["students"][0]["name"] == "Mia"
    assert c.get("/api/tutor/space", headers=P).status_code == 404       # private link stopped
    # a second space can't take the same email
    other = {"X-Tutor-Token": c.post("/api/tutor/create", json={"name": "X"}).json()["tutor_token"]}
    c.post("/api/tutor/email", json={"email": "nora@example.com"}, headers=other)
    assert c.post("/api/tutor/verify", json={"token": last_link()}).status_code == 409


def test_rate_limit_per_email():
    c = _client()
    if c is None:
        return
    codes = [c.post("/api/tutor/login", json={"email": "x@example.com"}).status_code for _ in range(6)]
    assert codes[:5] == [200] * 5 and codes[5] == 429
