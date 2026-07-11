#!/usr/bin/env bash
# Stages the bundled Whisper model + ONNX Runtime wasm under resources/whisper/
# so dictation works with no download. Idempotent: skips files already present.
# Runs automatically before `npm run dist` (predist). These files are gitignored.
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL="onnx-community/whisper-base.en"
MODELDIR="resources/whisper/models/$MODEL"
ORTDIR="resources/whisper/ort"
BASE="https://huggingface.co/$MODEL/resolve/main"

mkdir -p "$MODELDIR/onnx" "$ORTDIR"

# ORT wasm runtime (WebGPU jsep build) — copied from the installed dependency.
for f in ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.jsep.mjs; do
  [ -f "$ORTDIR/$f" ] || cp "node_modules/onnxruntime-web/dist/$f" "$ORTDIR/$f"
done

# Config/tokenizer files + the WebGPU dtype variant (encoder fp16 + decoder q4).
files=(
  config.json generation_config.json preprocessor_config.json
  tokenizer.json tokenizer_config.json special_tokens_map.json
  added_tokens.json vocab.json merges.txt normalizer.json
  onnx/encoder_model_fp16.onnx onnx/decoder_model_merged_q4.onnx
)
for f in "${files[@]}"; do
  if [ ! -f "$MODELDIR/$f" ]; then
    echo "fetch  $f"
    curl -sSL --fail --max-time 600 -o "$MODELDIR/$f" "$BASE/$f"
  fi
done

echo "whisper assets ready → resources/whisper ($(du -sh resources/whisper | cut -f1))"
