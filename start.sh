#!/bin/sh
set -e

# Backend internal port (configurable)
export BACKEND_PORT=${BACKEND_PORT:-3000}

# External port (for Caddy/Railway)
export PORT=${PORT:-80}

# Start backend in background
echo "Starting backend server on port $BACKEND_PORT..."
PORT=$BACKEND_PORT node /app/service/index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready on localhost:$BACKEND_PORT..."
max_attempts=30
attempt=0
until curl -sf http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "Backend failed to start on port $BACKEND_PORT"
    exit 1
  fi
  sleep 1
done

echo "Backend ready on port $BACKEND_PORT"

# Verify frontend build is present
if [ ! -f /usr/share/caddy/index.html ]; then
  echo "✗ Frontend build missing at /usr/share/caddy — image may be corrupted"
  exit 1
fi

echo "Configuring Caddy..."

# Create a temporary Caddyfile with the correct backend port
# This avoids issues with sed -i on Alpine
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

echo "Formatting Caddyfile..."
caddy fmt --overwrite /tmp/Caddyfile

echo "Starting Caddy..."
# Start Caddy in foreground with the generated config
caddy run --config /tmp/Caddyfile
