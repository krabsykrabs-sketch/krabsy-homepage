"""api/catalog.py: one source for languages, topics and sections (i18n N5)."""
import json
import os
import sys
import tempfile
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
ROOT = API_DIR.parent
sys.path.insert(0, str(API_DIR))
sys.path.insert(0, str(ROOT / "tools"))
os.environ.setdefault("KRABSY_DATA_DIR", tempfile.mkdtemp(prefix="krabsy-test-"))

import catalog  # noqa: E402
import dashboard  # noqa: E402
import krabsy_registry  # noqa: E402


def test_catalog_json_is_generated_from_homepage_data():
    # api/catalog.json must match what tools/krabsy_registry.py writes from
    # homepage/data (run the tool after editing sections.json / topics.json).
    want = krabsy_registry.render_api()
    assert (API_DIR / "catalog.json").read_text(encoding="utf-8") == want


def test_topics_and_languages_come_from_topics_json():
    topics = json.loads((ROOT / "homepage/data/topics.json").read_text(encoding="utf-8"))
    assert catalog.TOPICS == frozenset(topics)
    assert catalog.TOPIC_LEARN["es_ser"] == "es"
    assert catalog.TOPIC_LEARN["irregular_verbs"] == "en"
    assert catalog.UI_LANGS == ("de", "es", "en")
    assert catalog.CLASS_LANGS == ("de", "es")   # /en/ has no class pages (yet)


def test_ui_lang():
    assert catalog.ui_lang("es") == "es"
    assert catalog.ui_lang("xx") == catalog.DEFAULT_UI
    assert catalog.ui_lang(None) == catalog.DEFAULT_UI
    assert catalog.ui_lang("en", catalog.CLASS_LANGS) == catalog.DEFAULT_UI
    assert catalog.ui_lang("xx", default="en") == "en"


def test_game_pages_and_landings_of_every_section():
    assert dashboard.game_id_for_path("/de/spiele/verb-towers/") == "verb-towers"
    assert dashboard.game_id_for_path("/es/juegos/verb-snake/") == "verb-snake"
    assert dashboard.game_id_for_path("/en/spanish/games/verb-kitchen/") == "verb-kitchen"
    assert dashboard.game_id_for_path("/de/spiele/") is None
    assert dashboard.game_id_for_path("/de/unregelmaessige-verben/sprint/") is None
    assert set(dashboard.LANDING_PATHS) == {"/de/", "/es/", "/en/spanish/"}


def test_fallback_when_catalog_missing(tmp_path):
    cat = catalog.load(tmp_path / "nope.json")
    assert "irregular_verbs" in cat["topics"] and cat["default_ui"] == "de"
    broken = tmp_path / "broken.json"
    broken.write_text('{"default_ui": "de"}', encoding="utf-8")
    assert catalog.load(broken)["ui_langs"] == ["de", "es", "en"]


def test_new_section_is_data_only(tmp_path):
    # A future de/spanisch section: its games folder is a game page, no code change.
    data = json.loads((API_DIR / "catalog.json").read_text(encoding="utf-8"))
    data["sections"].append({"id": "de/spanisch", "ui": "de", "subject": "spanish",
                             "home": "/de/spanisch/", "games": "/de/spanisch/spiele/"})
    p = tmp_path / "catalog.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    import importlib
    os.environ["KRABSY_CATALOG"] = str(p)
    try:
        c2 = importlib.reload(catalog)
        assert c2.GAME_PAGE.match("/de/spanisch/spiele/verb-kitchen/").group(1) == "verb-kitchen"
        assert c2.GAME_PAGE.match("/de/spiele/verb-kitchen/").group(1) == "verb-kitchen"
        assert "/de/spanisch/" in c2.LANDING_PATHS
    finally:
        del os.environ["KRABSY_CATALOG"]
        importlib.reload(catalog)


def test_class_language_and_topics_follow_the_catalog():
    from fastapi.testclient import TestClient
    import classes
    import main
    classes.init_db()
    classes._buckets.clear()
    c = TestClient(main.app)
    got = []
    for lang in ("es", "en", "xx"):
        assert c.post("/api/class/create", json={"name": "6b " + lang, "lang": lang}).status_code == 200
        with classes.connect() as con:
            got.append(con.execute("SELECT lang FROM classes WHERE name = ?", ("6b " + lang,)).fetchone()[0])
    # es has class pages; en (no class pages yet) and unknown fall back to the site default
    assert got == ["es", catalog.DEFAULT_UI, catalog.DEFAULT_UI]
    assert classes.TOPICS == catalog.TOPICS and "es_tener" in classes.TOPICS
