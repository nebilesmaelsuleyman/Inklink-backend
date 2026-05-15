#!/usr/bin/env bash
set -euo pipefail


cd /app


mkdir -p /app/data
mkdir -p /app/model
if [ ! -f /app/data/golden.csv ] && [ -f /seed/data/golden.csv ]; then
 cp /seed/data/golden.csv /app/data/golden.csv
fi

ensure_model() {
  if [ -f /app/model/config.json ]; then
    return 0
  fi

  echo "[moderation-service] model missing; downloading..."
  python /app/download_model.py
}

ensure_embeddings() {
  if [ -f /app/data/golden_embeddings.npy ] && [ -f /app/data/golden_labels.npy ]; then
    return 0
  fi

  if [ ! -f /app/data/golden.csv ]; then
    echo "[moderation-service] golden.csv missing; cannot preprocess embeddings" >&2
    return 1
  fi

  echo "[moderation-service] embeddings missing; preprocessing golden dataset..."
  python /app/preprocess_golden.py
}

setup_all() {
  ensure_model
  ensure_embeddings
}

if [ "${SKIP_MODEL_SETUP:-false}" != "true" ]; then
  setup_mode="$(echo "${MODERATION_SETUP_MODE:-background}" | tr '[:upper:]' '[:lower:]')"

  case "${setup_mode}" in
    blocking)
      setup_all
      ;;
    background)
      if [ ! -f /app/model/config.json ] || [ ! -f /app/data/golden_embeddings.npy ] || [ ! -f /app/data/golden_labels.npy ]; then
        echo "[moderation-service] setup pending; running model/embedding setup in background (MODERATION_SETUP_MODE=background)"
        ( setup_all ) &
      fi
      ;;
    skip)
      echo "[moderation-service] MODERATION_SETUP_MODE=skip; skipping model/embedding setup"
      ;;
    *)
      echo "[moderation-service] Unknown MODERATION_SETUP_MODE='${setup_mode}'; use blocking|background|skip" >&2
      exit 1
      ;;
  esac
else
  echo "[moderation-service] SKIP_MODEL_SETUP=true; skipping model/embedding setup"
fi

exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
