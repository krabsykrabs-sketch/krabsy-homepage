"""Optional teacher sign-in ("Klasse sichern", api/accounts.py): one account
identity for teachers and tutors, one-time email links, sessions, attach /
detach / list classes, account deletion, no enumeration, rate limits, purge,
migration of the old tutor-only sign-in tables."""
import os
import re
import sys
import tempfile
from datetime import datetime, timedelta, timezone
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
    import accounts
    import classes
    import main
    classes.init_db()
    with classes.connect() as con:
        for t in ("classes", "tutors", "accounts", "account_links", "account_sessions"):
            con.execute(f"DELETE FROM {t}")
    classes._buckets.clear()
    accounts._buckets.clear()
    mailer.OUTBOX.clear()
    return TestClient(main.app)


def last_link():
    m = re.search(r"#l=([A-Za-z0-9_-]+)", mailer.OUTBOX[-1]["text"])
    return m.group(1) if m else None


def sign_in(c, email="lena@schule.de", lang="de", claim=""):
    assert c.post("/api/account/login", json={"email": email, "lang": lang, "claim": claim}).json()["ok"]
    v = c.post("/api/account/verify", json={"token": last_link()}).json()
    assert v["ok"] and v["context"] == "teacher"
    return {"X-Account-Token": v["session_token"]}, v


def test_claim_on_sign_in_then_my_classes():
    c = _client()
    if c is None:
        return
    made = c.post("/api/class/create", json={"name": "6b", "lang": "de"}).json()
    assert made["saved"] is False and made["class_id"] is None        # anonymous, as before
    T = {"X-Teacher-Token": made["teacher_token"]}
    assert c.get("/api/class/dashboard", headers=T).json()["class"]["saved"] is False
    # "Klasse sichern": the email is German, the link goes to the DE "Meine Klassen" page
    r = c.post("/api/account/login", json={"email": " Lena@Schule.DE ", "lang": "de", "claim": made["teacher_token"]})
    assert r.json() == {"ok": True, "minutes": 20}
    mail = mailer.OUTBOX[-1]
    assert mail["to"] == "lena@schule.de" and mail["lang"] == "de"
    assert mail["subject"] == "Klasse sichern bei Krabsy" and "/de/lehrkraefte/meine-klassen/#l=" in mail["text"]
    assert mail["text"].startswith("Hallo,") and "20 Minuten" in mail["text"]
    tok = last_link()
    v = c.post("/api/account/verify", json={"token": tok}).json()
    assert v["claimed"] is True and v["email"] == "lena@schule.de"
    A = {"X-Account-Token": v["session_token"]}
    assert c.post("/api/account/verify", json={"token": tok}).status_code == 410     # single use
    me = c.get("/api/account/me", headers=A).json()
    assert me["email"] == "lena@schule.de" and [k["name"] for k in me["classes"]] == ["6b"]
    cid = me["classes"][0]["id"]
    # the dashboard opens with the account (no secret link needed) …
    d = c.get(f"/api/class/dashboard?class_id={cid}", headers=A).json()
    assert d["class"]["mine"] and d["class"]["id"] == cid
    # … and still with the secret link; without the account it doesn't say whose it is
    d2 = c.get("/api/class/dashboard", headers=T).json()["class"]
    assert d2["saved"] is True and d2["mine"] is False and d2["id"] is None
    # class_id alone (no session) or a stranger's session opens nothing
    assert c.get(f"/api/class/dashboard?class_id={cid}").status_code == 404
    B, _ = sign_in(c, "other@schule.de")
    assert c.get(f"/api/class/dashboard?class_id={cid}", headers=B).status_code == 404
    assert c.post(f"/api/class/rename?class_id={cid}", json={"name": "x"}, headers=B).status_code == 404
    # owner actions by account
    assert c.post(f"/api/class/rename?class_id={cid}", json={"name": "6b Englisch"}, headers=A).json()["ok"]
    assert c.get("/api/account/me", headers=A).json()["classes"][0]["name"] == "6b Englisch"


def test_second_device_create_attach_detach():
    c = _client()
    if c is None:
        return
    old = c.post("/api/class/create", json={"name": "5a", "lang": "de"}).json()       # anonymous, older class
    A, _ = sign_in(c)
    A2, _ = sign_in(c)                                                                 # "second device"
    assert A != A2
    # a signed-in teacher's new class is saved automatically
    new = c.post("/api/class/create", json={"name": "7c", "lang": "de"}, headers=A2).json()
    assert new["saved"] is True and new["class_id"]
    # attach the old class with its secret link (idempotent)
    r = c.post("/api/account/attach", json={"teacher_token": old["teacher_token"]}, headers=A2).json()
    assert r["ok"] and r["class_id"]
    assert c.post("/api/account/attach", json={"teacher_token": old["teacher_token"]}, headers=A).json()["ok"]
    names = sorted(k["name"] for k in c.get("/api/account/me", headers=A).json()["classes"])
    assert names == ["5a", "7c"]
    # another account can't take it while it is attached
    B, _ = sign_in(c, "b@example.org")
    assert c.post("/api/account/attach", json={"teacher_token": old["teacher_token"]}, headers=B).status_code == 409
    assert c.post("/api/account/attach", json={"teacher_token": "nope" * 6}, headers=A).status_code == 404
    assert c.post("/api/account/attach", json={"teacher_token": old["teacher_token"]}).status_code == 401
    # detach: gone from the list, the class keeps working by its link
    c.post("/api/account/detach", json={"class_id": r["class_id"]}, headers=B)        # not B's: no effect
    assert len(c.get("/api/account/me", headers=A).json()["classes"]) == 2
    assert c.post("/api/account/detach", json={"class_id": r["class_id"]}, headers=A).json()["ok"]
    assert [k["name"] for k in c.get("/api/account/me", headers=A).json()["classes"]] == ["7c"]
    assert c.get("/api/class/dashboard", headers={"X-Teacher-Token": old["teacher_token"]}).json()["class"]["saved"] is False
    # now B may attach it
    assert c.post("/api/account/attach", json={"teacher_token": old["teacher_token"]}, headers=B).json()["ok"]
    # a claim on a class that is someone else's doesn't attach it (and doesn't fail the sign-in)
    _, v = sign_in(c, "lena@schule.de", claim=old["teacher_token"])
    assert v["claimed"] is False
    # logout ends one device only
    c.post("/api/account/logout", headers=A2)
    assert c.get("/api/account/me", headers=A2).status_code == 401
    assert c.get("/api/account/me", headers=A).status_code == 200


def test_new_secret_link_only_for_owner():
    c = _client()
    if c is None:
        return
    A, _ = sign_in(c)
    made = c.post("/api/class/create", json={"name": "8a"}, headers=A).json()
    T = {"X-Teacher-Token": made["teacher_token"]}
    assert c.post("/api/class/new-link", headers=T).status_code == 403              # the link alone can't rotate itself
    r = c.post(f"/api/class/new-link?class_id={made['class_id']}", headers=A).json()
    assert r["ok"] and r["teacher_token"] != made["teacher_token"]
    assert c.get("/api/class/dashboard", headers=T).status_code == 404              # old link stopped
    assert c.get("/api/class/dashboard", headers={"X-Teacher-Token": r["teacher_token"]}).json()["ok"]


def test_delete_account_keeps_classes():
    c = _client()
    if c is None:
        return
    made = c.post("/api/class/create", json={"name": "9b", "lang": "es"}).json()
    A, _ = sign_in(c, "ana@colegio.es", "es", claim=made["teacher_token"])
    assert mailer.OUTBOX[-1]["subject"] == "Guardar su clase en Krabsy" and "/es/docentes/mis-clases/#l=" in mailer.OUTBOX[-1]["text"]
    c.post("/api/account/login", json={"email": "ana@colegio.es", "lang": "es"})     # an open link …
    assert c.post("/api/account/delete", headers=A).json()["ok"]
    assert c.get("/api/account/me", headers=A).status_code == 401                    # sessions gone
    assert c.post("/api/account/verify", json={"token": last_link()}).status_code == 410   # … and open links
    import classes
    with classes.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 0
        assert con.execute("SELECT COUNT(*) FROM account_links WHERE email = 'ana@colegio.es'").fetchone()[0] == 0
    d = c.get("/api/class/dashboard", headers={"X-Teacher-Token": made["teacher_token"]}).json()
    assert d["ok"] and d["class"]["saved"] is False                                  # class still works by its link


def test_no_enumeration():
    c = _client()
    if c is None:
        return
    sign_in(c, "known@schule.de")
    r1 = c.post("/api/account/login", json={"email": "known@schule.de", "lang": "de"})
    m1 = mailer.OUTBOX[-1]
    r2 = c.post("/api/account/login", json={"email": "unknown@schule.de", "lang": "de"})
    m2 = mailer.OUTBOX[-1]
    assert r1.status_code == r2.status_code == 200 and r1.json() == r2.json()
    assert m1["subject"] == m2["subject"]
    strip = lambda t: re.sub(r"#l=[A-Za-z0-9_-]+", "", t)
    assert strip(m1["text"]) == strip(m2["text"])
    # a wrong claim token is ignored silently (it doesn't reveal which tokens exist)
    r3 = c.post("/api/account/login", json={"email": "unknown@schule.de", "lang": "de", "claim": "x" * 30})
    assert r3.json() == r1.json() and mailer.OUTBOX[-1]["subject"] == m1["subject"]
    assert c.post("/api/account/login", json={"email": "nope"}).status_code == 400


def test_rate_limits():
    c = _client()
    if c is None:
        return
    codes = [c.post("/api/account/login", json={"email": "x@example.org", "lang": "de"}).status_code for _ in range(6)]
    assert codes == [200] * 5 + [429]
    # the per-address limit is shared with the tutor sign-in (one account identity)
    assert c.post("/api/tutor/login", json={"email": "x@example.org"}).status_code == 429
    # per IP: 30 an hour over all addresses
    codes = [c.post("/api/account/login", json={"email": f"p{i}@example.org"}).status_code for i in range(30)]
    assert codes.count(429) == 7 and codes[-1] == 429                 # 23 left after the 7 requests above
    import accounts
    accounts._buckets.clear()
    codes = [c.post("/api/account/verify", json={"token": "x" * 30}).status_code for _ in range(61)]
    assert codes[:60] == [410] * 60 and codes[60] == 429


def test_tutor_and_teacher_share_one_account():
    c = _client()
    if c is None:
        return
    c.post("/api/tutor/login", json={"email": "nora@example.com", "name": "Nora"})
    v = c.post("/api/tutor/verify", json={"token": last_link()}).json()
    assert v["context"] == "tutor" and v["name"] == "Nora"
    S = {"X-Tutor-Token": v["session_token"]}
    assert c.get("/api/tutor/space", headers=S).json()["space"]["email"] == "nora@example.com"
    # the same session works on the teacher side, and vice versa
    assert c.get("/api/account/me", headers={"X-Account-Token": v["session_token"]}).json()["tutor"] is True
    A, _ = sign_in(c, "nora@example.com", "es")
    assert c.get("/api/tutor/space", headers={"X-Tutor-Token": A["X-Account-Token"]}).status_code == 200
    import classes
    with classes.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM accounts").fetchone()[0] == 1
    # an account with a tutor space is deleted with the space, not from the teacher page
    assert c.post("/api/account/delete", headers=A).status_code == 409
    made = c.post("/api/class/create", json={"name": "4c"}, headers=A).json()
    c.post("/api/tutor/delete", headers=S)
    assert c.get("/api/account/me", headers=A).json()["classes"][0]["name"] == "4c"   # classes keep the account
    c.post("/api/account/detach", json={"class_id": made["class_id"]}, headers=A)
    assert c.post("/api/account/delete", headers=A).json()["ok"]
    # a tutor with no classes: deleting the space deletes the account (email) too
    c.post("/api/tutor/login", json={"email": "solo@example.com", "name": "Solo"})
    S2 = {"X-Tutor-Token": c.post("/api/tutor/verify", json={"token": last_link()}).json()["session_token"]}
    c.post("/api/tutor/delete", headers=S2)
    with classes.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM accounts WHERE email = 'solo@example.com'").fetchone()[0] == 0


def test_purge_unused_accounts_only():
    c = _client()
    if c is None:
        return
    import accounts
    import classes
    A, _ = sign_in(c, "keep@schule.de")
    c.post("/api/class/create", json={"name": "1a"}, headers=A)
    sign_in(c, "empty@schule.de")
    sign_in(c, "fresh@schule.de")
    old = (datetime.now(timezone.utc) - timedelta(days=classes.RETENTION_DAYS + 1)).isoformat(timespec="seconds")
    with classes.connect() as con:
        con.execute("UPDATE accounts SET last_active = ? WHERE email IN ('keep@schule.de', 'empty@schule.de')", (old,))
    assert accounts.purge_inactive() == 1
    with classes.connect() as con:
        left = sorted(r[0] for r in con.execute("SELECT email FROM accounts"))
    assert left == ["fresh@schule.de", "keep@schule.de"]
    # the class purge is unchanged: an idle class goes, and then its idle account
    with classes.connect() as con:
        con.execute("UPDATE classes SET last_active = ?", (old,))
    assert classes.purge_inactive() == 1
    assert accounts.purge_inactive() == 1


def test_migrates_tutor_only_sign_in():
    """Databases from 2026-11-25: tutors.email + tutor_sessions + tutor_links."""
    if _client() is None:
        return
    import accounts
    import classes
    now = datetime.now(timezone.utc)
    later = (now + timedelta(days=5)).isoformat(timespec="seconds")
    with classes.connect() as con:
        if "email" not in {r[1] for r in con.execute("PRAGMA table_info(tutors)")}:
            con.execute("ALTER TABLE tutors ADD COLUMN email TEXT")     # the 2026-11-25 column
        con.executescript("""
          CREATE TABLE tutor_links (id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL,
            email TEXT NOT NULL, tutor_id INTEGER, name TEXT NOT NULL DEFAULT '', lang TEXT NOT NULL DEFAULT 'en',
            expires TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE tutor_sessions (token_hash TEXT PRIMARY KEY, tutor_id INTEGER NOT NULL, created TEXT NOT NULL, expires TEXT NOT NULL);
        """)
        cur = con.execute("INSERT INTO tutors (name, lang, tutor_hash, email, created, last_active) VALUES ('Old','en','h1','old@example.com',?,?)",
                          (now.isoformat(), now.isoformat()))
        con.execute("INSERT INTO tutor_sessions VALUES (?,?,?,?)", (classes._hash("SESSION-OLD-xxxxxxxxxxxx"), cur.lastrowid, now.isoformat(), later))
        con.execute("INSERT INTO tutor_links (token_hash, purpose, email, tutor_id, expires) VALUES (?,?,?,?,?)",
                    (classes._hash("LINK-OLD-xxxxxxxxxxxxxxxxx"), "login", "old@example.com", cur.lastrowid, later))
    accounts.init_db()
    accounts.init_db()                                                  # idempotent
    from fastapi.testclient import TestClient
    import main
    c = TestClient(main.app)
    sp = c.get("/api/tutor/space", headers={"X-Tutor-Token": "SESSION-OLD-xxxxxxxxxxxx"}).json()
    assert sp["space"]["name"] == "Old" and sp["space"]["email"] == "old@example.com"   # still signed in
    v = c.post("/api/tutor/verify", json={"token": "LINK-OLD-xxxxxxxxxxxxxxxxx"}).json()   # open link still works
    assert v["ok"] and v["name"] == "Old"
    with classes.connect() as con:
        tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        assert "tutor_sessions" not in tables and "tutor_links" not in tables
        assert con.execute("SELECT email FROM tutors WHERE name = 'Old'").fetchone()[0] is None
