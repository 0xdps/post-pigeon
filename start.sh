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

# Debug: Check if frontend files exist
echo "Checking frontend files..."
if [ -d /usr/share/caddy ]; then
  echo "✓ /usr/share/caddy exists"
  ls -la /usr/share/caddy/
else
  echo "✗ /usr/share/caddy does NOT exist"
fi

echo "Configuring Caddy..."

# Debug: Check if static files exist
echo "Checking for static files..."
if [ -f /usr/share/caddy/content/texts/001.md ]; then
  echo "✓ Text files found"
  head -5 /usr/share/caddy/content/texts/001.md
else
  echo "✗ TEXT FILES NOT FOUND at /usr/share/caddy/content/texts/"
  ls -la /usr/share/caddy/ || echo "Caddy directory doesn't exist"
fi

if [ -f /usr/share/caddy/content/media/001.jpg ]; then
  echo "✓ Media files found"
else
  echo "✗ MEDIA FILES NOT FOUND at /usr/share/caddy/content/media/"
fi

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
