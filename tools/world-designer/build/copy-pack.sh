#!/usr/bin/env bash
# Copy an asset pack from the shared /assets library into the editor (so the
# editor is self-contained and servable). The copied folder is gitignored;
# re-run this after a fresh checkout. Then run build-catalog.py to (re)generate
# the catalog manifest.
#
# Usage:  ./copy-pack.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"                 # tools/world-designer
LIB="$HOME/krabsy-homepage/assets/KayKit"

declare -A PACKS=(
  [restaurant-bits]="$LIB/KayKit_Restaurant_Bits_1.0_EXTRA/Assets/gltf"
  [furniture-bits]="$LIB/KayKit_Furniture_Bits_1.0_SOURCE/Assets/gltf"
  [prototype-bits]="$LIB/KayKit_Prototype_Bits_1.1_EXTRA/Assets/gltf"
)

for id in "${!PACKS[@]}"; do
  src="${PACKS[$id]}"
  dest="$ROOT/assets/$id"
  mkdir -p "$dest"
  echo "copying $id  <-  $src"
  # *.gltf/*.bin/*.png only — skips Windows :Zone.Identifier streams
  cp "$src"/*.gltf "$src"/*.bin "$src"/*.png "$dest"/
  echo "  $(ls "$dest" | grep -vc 'Zone.Identifier') files"
done
echo "done. now run:  python3 build-catalog.py"
