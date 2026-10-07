#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT" "$TMP/LinkLingo"
cp "$ROOT"/{manifest.json,background.js,content.js,content.css,popup.html,popup.css,popup.js} "$TMP/LinkLingo/"
cp -R "$ROOT/assets" "$TMP/LinkLingo/assets"
cp "$ROOT/README.zh-CN.md" "$TMP/LinkLingo/README.md"
(
  cd "$TMP"
  zip -qr "$OUT/LinkLingo.zip" LinkLingo
)
echo "Created: $OUT/LinkLingo.zip"
