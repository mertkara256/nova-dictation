#!/bin/sh
# Yerel whisper.cpp sunucusunu başlatır. Kurulum için README'deki "Whisper kurulumu" bölümüne bakın.
# Klasörler ortam değişkenleriyle değiştirilebilir.

WHISPER_DIR="${WHISPER_DIR:-$HOME/Developer/whisper.cpp}"
WHISPER_MODELS_DIR="${WHISPER_MODELS_DIR:-$HOME/Developer/whisper-models}"
WHISPER_MODEL="${WHISPER_MODEL:-ggml-large-v3-turbo-q5_0.bin}"
SERVER="$WHISPER_DIR/build/bin/whisper-server"

if [ ! -x "$SERVER" ]; then
  echo "whisper-server bulunamadı: $SERVER" >&2
  echo "README'deki \"Whisper kurulumu\" adımlarını izleyin." >&2
  exit 1
fi

exec "$SERVER" \
  -m "$WHISPER_MODELS_DIR/$WHISPER_MODEL" \
  --vad -vm "$WHISPER_MODELS_DIR/ggml-silero-v5.1.2.bin" \
  -l tr \
  --host 127.0.0.1 --port 8178
