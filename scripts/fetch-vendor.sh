#!/usr/bin/env bash
# Mengunduh MediaPipe + model pose ke www/vendor agar APK jalan OFFLINE.
set -euo pipefail
cd "$(dirname "$0")/.."
VER=0.10.14
OUT=www/vendor
TMP=$(mktemp -d)
mkdir -p "$OUT"
( cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VER" --silent && tar xzf mediapipe-tasks-vision-*.tgz )
cp "$TMP/package/vision_bundle.mjs"            "$OUT/vision_bundle.js"
cp "$TMP/package/wasm/vision_wasm_internal.js"   "$OUT/vision_wasm_internal.js"
cp "$TMP/package/wasm/vision_wasm_internal.wasm" "$OUT/vision_wasm_internal.wasm"
# Model Full (lebih akurat, dipakai default) + Lite (cadangan / pilihan "Cepat")
curl -fL --retry 3 -o "$OUT/pose_landmarker_full.task" \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
curl -fL --retry 3 -o "$OUT/pose_landmarker_lite.task" \
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task" \
  || echo "peringatan: model lite gagal diunduh (tidak wajib)"
rm -rf "$TMP"
ls -la "$OUT"
