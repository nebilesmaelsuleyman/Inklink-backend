#!/usr/bin/env bash
set -euo pipefail


cd /app


mkdir -p /app/data
mkdir -p /app/model
if [ ! -f /app/data/golden.csv ] && [ -f /seed/data/golden.csv ]; then
 cp /seed/data/golden.csv /app/data/golden.csv
fi

exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-8000}"
