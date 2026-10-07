#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/dist"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT" "$TMP/linkedin-cn-translator"
cp "$ROOT"/{manifest.json,background.js,content.js,content.css,popup.html,popup.css,popup.js} "$TMP/linkedin-cn-translator/"
cp -R "$ROOT/assets" "$TMP/linkedin-cn-translator/assets"
cp "$ROOT/README.zh-CN.md" "$TMP/linkedin-cn-translator/README.md"
(
  cd "$TMP"
  zip -qr "$OUT/linkedin-cn-translator.zip" linkedin-cn-translator
)
echo "Created: $OUT/linkedin-cn-translator.zip"
