#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy the Krabsy World Designer (tools/world-designer/) to the brocco-dev
# test host. Served at https://dev.brocco.run/level-editor/ (URL kept stable;
# the dev folder name is legacy — the app inside is the World Designer).
#
#   Usage:  bash tools/deploy-editor-to-dev.sh
#
# Includes the copied asset packs + generated catalogs so the hosted editor is
# self-contained; excludes the python build scripts + docs. If you changed the
# packs, run build/copy-pack.sh + build-tiles.py + build-catalog.py FIRST so the
# assets/ + catalogs/ are current before syncing.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/tools/world-designer"
DEVREPO="$(cd "$REPO_ROOT/.." && pwd)/brocco-dev"
DST="$DEVREPO/level-editor"            # keep the existing dev URL stable

[[ -d "$SRC" ]]          || { echo "✗ no world-designer at $SRC"; exit 1; }
[[ -d "$DEVREPO/.git" ]] || { echo "✗ ../brocco-dev is not a git clone"; exit 1; }
[[ -d "$SRC/assets" ]]   || { echo "✗ $SRC/assets missing — run build/copy-pack.sh first"; exit 1; }

echo "▸ syncing world-designer → brocco-dev/level-editor"
rm -rf "$DST"; mkdir -p "$DST"
rsync -a \
  --exclude='.git' --exclude='.gitignore' --exclude='build' \
  --exclude='*.md' --exclude='*Zone.Identifier' \
  "$SRC"/ "$DST"/

# Inject noindex once (dev tool — keep it out of search).
if ! grep -q 'name="robots" content="noindex"' "$DST/index.html"; then
  python3 - "$DST/index.html" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
t = re.sub(r"(<head[^>]*>)", r'\1\n<meta name="robots" content="noindex">', t, count=1)
p.write_text(t, encoding="utf-8")
PY
fi

# Safety: warn on absolute asset paths that would 404 under /level-editor/.
if grep -rnoE "(src|href)=\"/[a-zA-Z]" "$DST" --include='*.html' --include='*.js' \
     | grep -vE 'https?:|//' | head -5 | grep -q .; then
  echo "⚠ ABSOLUTE paths found (will 404 on the subpath):"
  grep -rnoE "(src|href)=\"/[a-zA-Z]" "$DST" --include='*.html' --include='*.js' \
     | grep -vE 'https?:|//' | head -10
fi

echo "▸ committing + pushing brocco-dev"
cd "$DEVREPO"
git pull -q --ff-only origin main || true
git add level-editor
if git diff --cached --quiet; then
  echo "= no changes to deploy (already up to date)"; exit 0
fi
files=$(git diff --cached --name-only | wc -l)
git commit -q -m "Deploy world-designer ($(date -u +%Y-%m-%dT%H:%MZ))"
git push -q origin main
echo "✓ pushed $files file(s). Live at https://dev.brocco.run/level-editor/ once Coolify deploys."
