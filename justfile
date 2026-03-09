# PostHub Development & Production Task Runner

# Variables
PORTLESS_ALIAS := "autoposter"
PORTLESS_PROXY_PORT := "1355"
COMPOSE_FILE := "docker-compose.yml"
APP_INTERNAL_PORT := "8080"
CADDY_INTERNAL_PORT := "8080"

# Contract helpers
DEV_CADDY_SERVICE := "caddy"
PROD_APP_SERVICE := "app"

# Default recipe when running `just`
default:
    @just --list

# Validate local prerequisites and runtime contract.
doctor:
        #!/usr/bin/env bash
        set -euo pipefail
        command -v docker >/dev/null 2>&1 || { echo "❌ docker is required"; exit 1; }
        docker info >/dev/null 2>&1 || { echo "❌ Docker daemon is not running"; exit 1; }
        command -v node >/dev/null 2>&1 || { echo "❌ node is required"; exit 1; }
        command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }
        command -v just >/dev/null 2>&1 || { echo "❌ just is required"; exit 1; }
        [ -f .env ] || { echo "❌ .env missing. Run: cp .env.example .env"; exit 1; }
        npx portless --help >/dev/null 2>&1 || { echo "❌ Portless not available via npx"; exit 1; }
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose --profile dev config >/dev/null
            docker-compose --profile prod config >/dev/null
        else
            docker compose --profile dev config >/dev/null
            docker compose --profile prod config >/dev/null
        fi
        echo "✅ doctor: environment is ready"

# Validate compose profile contract.
contract:
        #!/usr/bin/env bash
        set -euo pipefail
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose --profile dev config >/dev/null
            docker-compose --profile prod config >/dev/null
        else
            docker compose --profile dev config >/dev/null
            docker compose --profile prod config >/dev/null
        fi
        echo "✅ contract: compose profiles are valid"

# ============================================================================
# DEVELOPMENT RECIPES
# ============================================================================

# Start development environment with hot reload (Caddy + Backend + Frontend)
dev:
    #!/usr/bin/env bash
        set -euo pipefail

        [ -f .env ] || { echo "❌ .env missing. Run: cp .env.example .env"; exit 1; }
        if command -v docker-compose >/dev/null 2>&1; then
            COMPOSE="docker-compose"
        else
            COMPOSE="docker compose"
        fi

    echo "🚀 Starting PostHub Development Environment"
    echo ""
        echo "Starting containers (Docker will assign a random port)..."
        $COMPOSE --profile dev up -d --build --force-recreate {{DEV_CADDY_SERVICE}}

        tries=0
        max_tries=90
        PORT=""
        while [ $tries -lt $max_tries ]; do
            PORT=$($COMPOSE --profile dev port {{DEV_CADDY_SERVICE}} {{CADDY_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}')
            if [ -n "$PORT" ]; then
                break
            fi
            tries=$((tries + 1))
            sleep 1
        done
    
    if [ -z "$PORT" ]; then
        echo "❌ Could not detect Caddy port. Check container status:"
        $COMPOSE --profile dev ps
        exit 1
    fi
    
    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "Direct access:"
    echo "  → http://localhost:$PORT"
    echo ""
        npx portless proxy start >/dev/null 2>&1 || true
        npx portless alias {{PORTLESS_ALIAS}} $PORT >/dev/null 2>&1 || true
        echo "✅ Portless alias ready:"
        echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
        echo ""

        health_tries=0
        health_max=120
        while [ $health_tries -lt $health_max ]; do
            if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
                echo "✅ Dev service is healthy"
                break
            fi
            health_tries=$((health_tries + 1))
            sleep 1
        done
        if [ $health_tries -ge $health_max ]; then
            echo "⚠️ Dev service did not become healthy within timeout"
        fi

        cleanup() {
            $COMPOSE --profile dev down --remove-orphans >/dev/null 2>&1 || true
            npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true
        }
        trap cleanup EXIT INT TERM

        echo "Streaming app logs (backend + frontend)."
        echo "Use 'just logs-caddy' if you need proxy logs."
        echo "Ctrl+C stops containers and removes Portless alias."
        $COMPOSE --profile dev logs -f backend frontend

# Start development in background (silent)
dev-bg:
    docker-compose --profile dev up --build -d

# Start development locally without Docker (requires Node.js locally)
dev-local:
    npm run dev

# Start backend locally (direct Node.js)
dev-be-local:
    npm run dev:be

# Start frontend locally (direct Node.js)
dev-fe-local:
    npm run dev:fe

# Stop all development services
down:
        #!/usr/bin/env bash
        set -euo pipefail
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose --profile dev down
        else
            docker compose --profile dev down
        fi
        npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true

# View all logs
logs:
    docker-compose --profile dev logs -f backend frontend

# View backend logs only
logs-backend:
    docker-compose --profile dev logs -f backend

# View frontend logs only
logs-frontend:
    docker-compose --profile dev logs -f frontend

# View Caddy logs only
logs-caddy:
    docker-compose --profile dev logs -f caddy

# Reset development environment (removes volumes and containers)
reset:
    docker-compose --profile dev down -v
    docker-compose --profile dev up --build

# ============================================================================
# PRODUCTION RECIPES
# ============================================================================

# Start production environment
prod:
    #!/usr/bin/env bash
    echo "🚀 Starting PostHub Production"
    echo ""
    echo "Starting containers (Docker will assign a random port)..."
    docker-compose --profile prod up --build -d
    sleep 3
    
    APP_PORT=${APP_INTERNAL_PORT:-8080}
    PORT=$(docker port autoposter $APP_PORT 2>/dev/null | cut -d: -f2)
    
    if [ -z "$PORT" ]; then
        echo "❌ Could not detect production port. Check container status:"
        docker-compose --profile prod ps
        exit 1
    fi
    
    echo ""
    echo "✅ Production started successfully!"
    echo ""
    echo "Direct access:"
    echo "  → http://localhost:$PORT"
    echo ""
    if command -v portless >/dev/null 2>&1; then
        echo "💡 For a prettier URL, run:"
        echo "   just setup-portless-prod"
        echo ""
        echo "Then access via:"
        echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
        echo ""
    fi

# Start production in background
prod-bg:
    docker-compose --profile prod up --build -d

# Stop production services
prod-down:
    docker-compose --profile prod down

# View production logs
prod-logs:
    docker-compose --profile prod logs -f

# Reset production environment (removes volumes)
prod-reset:
    docker-compose --profile prod down -v
    docker-compose --profile prod up --build

# ============================================================================
# BUILD RECIPES
# ============================================================================

# Build frontend dashboard
build-fe:
    npm run build:dashboard

# Build backend (syntax check)
build-be:
    node -c service/index.js

# Build both frontend and backend
build:
    just build-be
    just build-fe

# ============================================================================
# LINTING & FORMATTING
# ============================================================================

# Run ESLint
lint:
    npm run lint

# Format code with Prettier
format:
    npm run format

# Check formatting without changes
format-check:
    npm run format:check

# Run all checks (lint + format check)
check:
    npm run lint
    npm run format:check

# ============================================================================
# TESTING
# ============================================================================

# Run tests
test:
    npm run test

# Run tests in watch mode (if supported)
test-watch:
    npm run test -- --watch

# ============================================================================
# INFRASTRUCTURE
# ============================================================================

# Install dependencies for all packages
install:
    npm ci
    npm --prefix dashboard ci

# Install dependencies and build
setup: install build

# ============================================================================
# PORTLESS INTEGRATION (Pretty URLs)
# ============================================================================

# One-time setup for Portless (starts daemon + creates alias)
setup-portless:
    #!/usr/bin/env bash
    if ! command -v portless >/dev/null 2>&1; then
        echo "❌ Portless is not installed."
        echo ""
        echo "Install via:"
        echo "  npm install -g portless"
        echo ""
        echo "Or visit: https://portless.dev"
        exit 1
    fi
    
    # Detect the dynamic port Docker assigned
    CADDY_PORT=${CADDY_INTERNAL_PORT:-{{CADDY_INTERNAL_PORT}}}
    PORT=$(docker port autoposter-caddy $CADDY_PORT 2>/dev/null | cut -d: -f2)
    
    if [ -z "$PORT" ]; then
        echo "❌ Caddy container not running or port not exposed."
        echo ""
        echo "Start dev environment first:"
        echo "  just dev"
        exit 1
    fi
    
    echo "🔧 Setting up Portless..."
    echo ""
    echo "Detected Caddy on port: $PORT"
    portless proxy start 2>/dev/null || echo "Proxy already running"
    portless alias {{PORTLESS_ALIAS}} $PORT
    echo ""
    echo "✅ Portless configured!"
    echo ""
    echo "Access your app at:"
    echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
    echo ""
    echo "(Bare domain without :{{PORTLESS_PROXY_PORT}} requires privileged proxy on port 80)"
    echo "  Run: just setup-portless-80"
    echo ""
    echo "All requests route through Caddy:"
    echo "  /api/* → backend"
    echo "  /* → frontend"

# Optional: configure Portless on port 80 (requires sudo) for bare autoposter.localhost
setup-portless-80:
    #!/usr/bin/env bash
    if ! command -v portless >/dev/null 2>&1; then
        echo "❌ Portless is not installed."
        exit 1
    fi

    CADDY_PORT=${CADDY_INTERNAL_PORT:-{{CADDY_INTERNAL_PORT}}}
    PORT=$(docker port autoposter-caddy $CADDY_PORT 2>/dev/null | cut -d: -f2)

    if [ -z "$PORT" ]; then
        echo "❌ Caddy container not running or port not exposed."
        echo "Start dev environment first: just dev"
        exit 1
    fi

    echo "🔧 Starting Portless proxy on port 80 (sudo required)..."
    sudo portless proxy stop 2>/dev/null || true
    sudo portless proxy start -p 80
    portless alias {{PORTLESS_ALIAS}} $PORT --force
    echo "✅ Portless configured on :80"
    echo "Access: http://{{PORTLESS_ALIAS}}.localhost"

# Setup Portless for production
setup-portless-prod:
    #!/usr/bin/env bash
    npx portless --help >/dev/null 2>&1 || { echo "❌ Portless not available via npx"; exit 1; }
    
    # Detect production port
    APP_PORT=${APP_INTERNAL_PORT:-8080}
    PORT=$(docker port autoposter $APP_PORT 2>/dev/null | cut -d: -f2)
    
    if [ -z "$PORT" ]; then
        echo "❌ Production container not running."
        echo "Start prod first: just prod"
        exit 1
    fi
    
    npx portless proxy start 2>/dev/null || echo "Proxy already running"
    npx portless alias {{PORTLESS_ALIAS}} $PORT
    echo "✅ Production alias set: http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"

# Remove Portless alias
remove-portless:
    #!/usr/bin/env bash
    npx portless alias --remove {{PORTLESS_ALIAS}} 2>/dev/null || true
    echo "✅ Portless alias removed"

# List all Portless aliases
list-portless:
        npx portless list

# Quick smoke checks against running dev/prod service.
smoke:
        #!/usr/bin/env bash
        set -euo pipefail
        [ -f .env ] || { echo "❌ .env missing. Run: cp .env.example .env"; exit 1; }
        ADMIN_TOKEN=$(grep -E '^ADMIN_TOKEN=' .env | head -n1 | cut -d= -f2-)
        [ -n "$ADMIN_TOKEN" ] || { echo "❌ ADMIN_TOKEN missing in .env"; exit 1; }

        if command -v docker-compose >/dev/null 2>&1; then
            DEV_PORT=$(docker-compose --profile dev port {{DEV_CADDY_SERVICE}} {{CADDY_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}' || true)
            PROD_PORT=$(docker-compose --profile prod port {{PROD_APP_SERVICE}} {{APP_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}' || true)
        else
            DEV_PORT=$(docker compose --profile dev port {{DEV_CADDY_SERVICE}} {{CADDY_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}' || true)
            PROD_PORT=$(docker compose --profile prod port {{PROD_APP_SERVICE}} {{APP_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}' || true)
        fi

        if [ -n "$DEV_PORT" ]; then
            BASE_URL="http://localhost:$DEV_PORT"
        elif [ -n "$PROD_PORT" ]; then
            BASE_URL="http://localhost:$PROD_PORT"
        else
            echo "❌ No running dev/prod service found. Start with just dev or just prod"
            exit 1
        fi

        echo "Running smoke checks against $BASE_URL"
        code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/health")
        [ "$code" = "200" ] || { echo "❌ /health returned $code"; exit 1; }

        code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auth/login" \
            -H 'Content-Type: application/json' \
            -d "{\"token\":\"$ADMIN_TOKEN\"}")
        [ "$code" = "200" ] || { echo "❌ /api/auth/login returned $code"; exit 1; }

        echo "✅ smoke checks passed"

# Show current port assignments
show-ports:
    #!/usr/bin/env bash
    echo "🔌 Current Port Assignments:"
    echo ""
    if docker ps --format "{{{{.Names}}}}" | grep -q "autoposter-caddy"; then
        CADDY_PORT=${CADDY_INTERNAL_PORT:-{{CADDY_INTERNAL_PORT}}}
        PORT=$(docker port autoposter-caddy $CADDY_PORT 2>/dev/null | cut -d: -f2)
        echo "Development (Caddy):"
        echo "  → http://localhost:$PORT"
        if command -v portless >/dev/null 2>&1; then
            if portless list 2>/dev/null | grep -q "{{PORTLESS_ALIAS}}"; then
                echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
            fi
        fi
    else
        echo "Development: (not running)"
    fi
    echo ""
    if docker ps --format "{{{{.Names}}}}" | grep -q "^autoposter$"; then
        APP_PORT=${APP_INTERNAL_PORT:-8080}
        PROD_PORT=$(docker port autoposter $APP_PORT 2>/dev/null | cut -d: -f2)
        echo "Production:"
        echo "  → http://localhost:$PROD_PORT"
    else
        echo "Production: (not running)"
    fi

# Show Docker container status
status:
    #!/usr/bin/env bash
    echo "🐳 Docker Containers:"
    echo ""
    echo "Development (--profile dev):"
    docker-compose --profile dev ps 2>/dev/null || echo "  (not running)"
    echo ""
    echo "Production (--profile prod):"
    docker-compose --profile prod ps 2>/dev/null || echo "  (not running)"
    echo ""
    just show-ports
    echo ""
    if command -v portless >/dev/null 2>&1; then
        echo "🔗 Portless Routes:"
        portless list 2>/dev/null || echo "  (none configured)"
    fi

# Clean up Docker resources (unused images, volumes, networks)
docker-clean:
    docker system prune -f

# ============================================================================
# UTILITY RECIPES
# ============================================================================

# Show environment info
info:
    #!/usr/bin/env bash
    echo "📋 Environment Information:"
    echo ""
    echo "Node.js:"
    node --version
    echo ""
    echo "npm:"
    npm --version
    echo ""
    echo "Docker:"
    docker --version
    echo ""
    echo "Docker Compose:"
    docker-compose --version

# Help - show all available commands
help:
    @just --list

# ============================================================================
# SHORTCUTS
# ============================================================================

# Quick aliases for common operations
b: build
f: format
d: dev
l: logs
s: status
t: test
c: check
sp: setup-portless
rp: remove-portless
lp: list-portless
