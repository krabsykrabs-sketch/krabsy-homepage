#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Deploy a game from games/<name>/ to the brocco-dev test server.
#
#   Usage:  bash tools/deploy-to-dev.sh <game-name>
#   Example: bash tools/deploy-to-dev.sh verb-kitchen
#
# What it does (the manual "Hop A" automated):
#   1. Copies games/<name>/ → ../brocco-dev/<name>/, entry file = index.html
#      (a single-file game's *.html is renamed to index.html).
#   2. Keeps ONLY the game payload — excludes .claude/, the game's own
#      .gitignore (it ignores assets/!), CLAUDE.md and other *.md, .git,
#      and Windows Zone.Identifier junk. Assets ARE included.
#   3. Ensures <meta name="robots" content="noindex"> is in the entry <head>.
#   4. Verifies no absolute (/foo) asset paths remain in the copy (warns).
#   5. Commits + pushes the brocco-dev repo.
#
# After it pushes, dev.brocco.run/<name>/ updates automatically IF the
# brocco-dev Coolify app has a webhook/auto-deploy; otherwise click Deploy.
#
# Assumes ../brocco-dev is a clone of the brocco-dev repo (clone it once:
#   git clone https://github.com/krabsykrabs-sketch/brocco-dev.git ../brocco-dev )
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "usage: bash tools/deploy-to-dev.sh <game-name>"; exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$REPO_ROOT/games/$NAME"
DEVREPO="$(cd "$REPO_ROOT/.." && pwd)/brocco-dev"
DST="$DEVREPO/$NAME"

[[ -d "$SRC" ]]     || { echo "✗ no game folder: $SRC"; exit 1; }
[[ -d "$DEVREPO/.git" ]] || { echo "✗ ../brocco-dev is not a git clone. Run once:"; \
   echo "   git clone https://github.com/krabsykrabs-sketch/brocco-dev.git \"$DEVREPO\""; exit 1; }

echo "▸ syncing $NAME → brocco-dev"
rm -rf "$DST"; mkdir -p "$DST"

# rsync the payload, excluding dev/meta files. (assets/ deliberately kept.)
rsync -a \
  --exclude='.git' --exclude='.claude' --exclude='.gitignore' \
  --exclude='CLAUDE.md' --exclude='*.md' --exclude='_shots' \
  --exclude='*Zone.Identifier' --exclude='node_modules' \
  "$SRC"/ "$DST"/

# Ensure an index.html entry (rename a lone single-file game).
if [[ ! -f "$DST/index.html" ]]; then
  html=$(find "$DST" -maxdepth 1 -name '*.html' | head -1 || true)
  [[ -n "$html" ]] && mv "$html" "$DST/index.html" || { echo "✗ no html entry found"; exit 1; }
fi

# Inject noindex once.
if ! grep -q 'name="robots" content="noindex"' "$DST/index.html"; then
  python3 - "$DST/index.html" <<'PY'
import sys, re, pathlib
p = pathlib.Path(sys.argv[1]); t = p.read_text(encoding="utf-8")
t = re.sub(r"(<head[^>]*>)", r'\1\n<meta name="robots" content="noindex">', t, count=1)
p.write_text(t, encoding="utf-8")
PY
fi

# Safety: warn on absolute asset paths that would 404 under /<name>/.
if grep -rnoE "(src|href)=\"/[a-zA-Z]" "$DST" --include='*.html' --include='*.js' \
     | grep -vE 'https?:|//' | head -5 | grep -q .; then
  echo "⚠ ABSOLUTE paths found in the copy (will 404 on the subpath):"
  grep -rnoE "(src|href)=\"/[a-zA-Z]" "$DST" --include='*.html' --include='*.js' \
     | grep -vE 'https?:|//' | head -10
  echo "  (fix the copied files under $DST, then re-run, or fix the source.)"
fi

echo "▸ committing + pushing brocco-dev"
cd "$DEVREPO"
git pull -q --ff-only origin main || true
git add "$NAME"
if git diff --cached --quiet; then
  echo "= no changes to deploy ($NAME already up to date)"; exit 0
fi
files=$(git diff --cached --name-only | wc -l)
git commit -q -m "Deploy $NAME ($(date -u +%Y-%m-%dT%H:%MZ))"
git push -q origin main
echo "✓ pushed $files file(s). Live at https://dev.brocco.run/$NAME/ once Coolify deploys."
