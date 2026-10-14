#!/bin/sh
# Canlı önizleme için yerel Nemotron sunucusunu (sherpa-onnx) başlatır.
# Kurulum için README'deki "Nemotron kurulumu" bölümüne bakın.
# Klasörler ortam değişkenleriyle değiştirilebilir.

SHERPA_DIR="${SHERPA_DIR:-$HOME/Developer/sherpa-onnx-v1.13.8-osx-arm64-shared-no-tts}"
NEMOTRON_MODEL_DIR="${NEMOTRON_MODEL_DIR:-$HOME/Developer/sherpa-models/sherpa-onnx-nemotron-3.5-asr-streaming-0.6b-560ms-int8-2026-06-11}"
SERVER="$SHERPA_DIR/bin/sherpa-onnx-online-websocket-server"

if [ ! -x "$SERVER" ]; then
  echo "sherpa-onnx sunucusu bulunamadı: $SERVER" >&2
  echo "README'deki \"Nemotron kurulumu\" adımlarını izleyin." >&2
  exit 1
fi

# Her konuşma parçası ayrı bir bağlantı olduğu için sunucunun kendi
# parça bölme özelliği (endpoint) kapalı.
exec "$SERVER" \
  --port=8179 \
  --tokens="$NEMOTRON_MODEL_DIR/tokens.txt" \
  --encoder="$NEMOTRON_MODEL_DIR/encoder.int8.onnx" \
  --decoder="$NEMOTRON_MODEL_DIR/decoder.int8.onnx" \
  --joiner="$NEMOTRON_MODEL_DIR/joiner.int8.onnx" \
  --num-threads=4 \
  --num-work-threads=2 \
  --enable-endpoint=false \
  --log-file="${TMPDIR:-/tmp}/nova-nemotron.log"
