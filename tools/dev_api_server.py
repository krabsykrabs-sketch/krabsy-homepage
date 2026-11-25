#!/usr/bin/env python3
"""Local preview WITH the API (classes, tutor spaces, Quiz Room) on one port.

    python3 tools/dev_api_server.py            # → http://localhost:8010/
    python3 tools/dev_api_server.py 8020

Serves homepage/ like `python3 -m http.server`, plus the FastAPI app from api/
on the same origin, and adds `window.KRABSY_API = location.origin` to every HTML
page, so the pages talk to this local API instead of api.krabsy.com.
Data goes to _incoming/dev-data/ (gitignored), never to the real server.

Needs the API requirements: pip install -r api/requirements.txt
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("KRABSY_DATA_DIR", str(ROOT / "_incoming" / "dev-data"))
Path(os.environ["KRABSY_DATA_DIR"]).mkdir(parents=True, exist_ok=True)
os.environ.setdefault("GEOIP_DB_PATH", str(Path(os.environ["KRABSY_DATA_DIR"]) / "none.mmdb"))
sys.path.insert(0, str(ROOT / "api"))

import uvicorn  # noqa: E402
from fastapi.responses import FileResponse, HTMLResponse, Response  # noqa: E402

import main  # noqa: E402  (the API app)

SITE = ROOT / "homepage"
INJECT = "<script>window.KRABSY_API=location.origin;</script>"


@main.app.get("/{path:path}", include_in_schema=False)
def static(path: str):
    p = (SITE / path).resolve()
    if SITE.resolve() not in p.parents and p != SITE.resolve():
        return Response(status_code=404)
    if p.is_dir():
        if path and not path.endswith("/"):
            return Response(status_code=301, headers={"Location": "/" + path + "/"})
        p = p / "index.html"
    if not p.is_file():
        return Response("Not found", status_code=404)
    if p.suffix == ".html":
        html = p.read_text(encoding="utf-8")
        i = html.find("<head>")
        html = html[: i + 6] + INJECT + html[i + 6:] if i >= 0 else INJECT + html
        return HTMLResponse(html, headers={"Cache-Control": "no-store"})
    return FileResponse(p, headers={"Cache-Control": "no-store"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8010
    print(f"Krabsy local preview with API: http://localhost:{port}/")
    uvicorn.run(main.app, host="127.0.0.1", port=port, log_level="warning")
