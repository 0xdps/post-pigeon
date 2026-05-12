#!/bin/sh
set -e

DB_NAME="${DB_NAME:-postpigeon}"

mesahub-server &
MESAHUB_PID=$!

echo "[mesahub] waiting for server to start..."
until curl -sf "http://localhost:${PORT:-3002}/api/health" > /dev/null 2>&1; do
  sleep 1
done
echo "[mesahub] server ready"

echo "[mesahub] ensuring database '${DB_NAME}' exists..."
curl -sf -X POST "http://localhost:${PORT:-3002}/api/db" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${DB_NAME}\",\"slug\":\"${DB_NAME}\",\"owner\":\"system\"}" \
  > /dev/null 2>&1 || true
echo "[mesahub] database '${DB_NAME}' ready"

wait $MESAHUB_PID
