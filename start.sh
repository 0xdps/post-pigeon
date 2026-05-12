#!/bin/sh
set -e

# Node listens on this internal port — must NOT equal $PORT
export BACKEND_PORT=${BACKEND_PORT:-3001}
# Caddy listens on this public port — Railway injects PORT automatically
export PORT=${PORT:-80}

echo "=========================================="
echo "  Post Pigeon — Starting"
echo "=========================================="

# ── [0] Mesahub: embedded or external ─────────────────────────────────────────
# MESAHUB_URL format: mh://[token@]host[:port]/dbname
# Use mh://local/dbname to start a bundled mesahub-server in this container.

MESAHUB_URL="${MESAHUB_URL:-}"
if [ -z "$MESAHUB_URL" ]; then
  echo "✗ MESAHUB_URL is required (e.g. mh://token@host/db or mh://local/postpigeon)"
  exit 1
fi

# Parse scheme-stripped URL to extract host and dbname
_INNER="${MESAHUB_URL#mh://}"
_DBNAME="${_INNER##*/}"
_HOSTPART="${_INNER%%/*}"
if echo "$_HOSTPART" | grep -q "@"; then
  _HOST="${_HOSTPART##*@}"
else
  _HOST="$_HOSTPART"
fi

if [ "$_HOST" = "local" ]; then
  # ── Embedded mode ───────────────────────────────────────────────────────────
  export MESAHUB_CORE_PORT="${MESAHUB_CORE_PORT:-3002}"
  _ADMIN_TOKEN="${ADMIN_TOKEN:-$(openssl rand -hex 32)}"

  echo "[0/3] Starting bundled mesahub-server on :$MESAHUB_CORE_PORT (db: $_DBNAME)..."
  DATA_PATH="${DATA_PATH:-/data}" \
  ADMIN_TOKEN="$_ADMIN_TOKEN" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  FILE_TOKEN_SIGNING_SECRET="$(openssl rand -hex 32)" \
  PORT="$MESAHUB_CORE_PORT" \
    mesahub-server &
  MESAHUB_PID=$!

  max_attempts=30
  attempt=0
  until curl -sf "http://localhost:${MESAHUB_CORE_PORT}/api/health" > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
      echo "✗ mesahub-server failed to start after ${max_attempts}s"
      kill $MESAHUB_PID 2>/dev/null || true
      exit 1
    fi
    sleep 1
  done
  echo "✓ mesahub-server ready on :$MESAHUB_CORE_PORT"

  # Create the application database (idempotent — 409 = already exists)
  curl -sf -X POST "http://localhost:${MESAHUB_CORE_PORT}/api/db" \
    -H "Authorization: Bearer $_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${_DBNAME}\",\"slug\":\"${_DBNAME}\",\"owner\":\"system\"}" \
    > /dev/null 2>&1 || true
  echo "✓ Database '${_DBNAME}' ready"

  # Rewrite MESAHUB_URL with resolved token so Node can connect
  export MESAHUB_URL="mh://${_ADMIN_TOKEN}@localhost:${MESAHUB_CORE_PORT}/${_DBNAME}"
else
  echo "[0/3] External mesahub at $_HOST (db: $_DBNAME) — skipping bundled server"
fi

# ── [1] Backend ────────────────────────────────────────────────────────────────
echo "[1/3] Starting backend on port $BACKEND_PORT..."
PORT=$BACKEND_PORT node /app/service/index.js &
BACKEND_PID=$!

max_attempts=30
attempt=0
until curl -sf http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Backend failed to start after ${max_attempts}s"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
echo "✓ Backend ready on port $BACKEND_PORT"

# ── [2] Caddy ────────────────────────────────────────────────────────────────
if [ ! -f /usr/share/caddy/index.html ]; then
  echo "✗ Frontend build missing at /usr/share/caddy — image may be corrupted"
  exit 1
fi

echo "[2/3] Starting Caddy on port $PORT..."

cat > /tmp/Caddyfile <<EOF
{
  auto_https off
  admin off
}

:$PORT {
  root * /usr/share/caddy

  handle /api/* {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /health {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /assets/* {
    header Cache-Control "public, max-age=31536000"
    file_server
  }

  handle /content/* {
    file_server
  }

  handle {
    try_files {path} /index.html
    file_server
  }
}
EOF

caddy fmt --overwrite /tmp/Caddyfile
echo "✓ Starting Caddy (foreground)..."
exec caddy run --config /tmp/Caddyfile
