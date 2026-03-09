# Development and Production Runtime

This document explains how development and production work in this repository and where they intentionally differ.

## Runtime model

- One compose file: docker-compose.yml
- Two profiles: dev and prod
- Goal: keep behavior close, keep operations simple

## Development profile

Run:

```bash
just dev
```

Services:
- backend
- frontend
- caddy

How it works:
1. backend runs in dev mode with source mounts
2. frontend runs Vite dev server with source mounts
3. caddy starts and generates /tmp/Caddyfile dynamically at container startup
4. caddy proxies /api and /health to backend, and all other traffic to frontend
5. Docker maps caddy internal port to a random host port
6. just dev discovers that mapped port and tails logs in foreground
7. Portless alias autoposter is mapped automatically

Notes:
- Ctrl+C stops dev containers and removes alias

## Production profile

Run (local prod validation):

```bash
just prod
```

Service:
- app

How it works:
1. app image starts via start.sh
2. start.sh launches backend on internal BACKEND_PORT (default 3000)
3. start.sh waits for backend health
4. start.sh generates /tmp/Caddyfile dynamically
5. caddy binds to external PORT and proxies /api and /health to backend
6. caddy serves frontend static assets

In cloud environments, PORT is supplied by the platform.

## Intentional differences

Only these are intentional:
- dev uses random Docker host port mapping and optional Portless alias
- prod uses platform supplied PORT

Everything else aims to stay behaviorally similar.

## Validation commands

```bash
docker-compose --profile dev config --services
docker-compose --profile prod config --services
```

Expected:
- dev: backend, frontend, caddy
- prod: app

## Troubleshooting checklist

1. Verify profile services
2. Verify mapped ports with just show-ports
3. Check logs with just logs or just prod-logs
4. Confirm backend health endpoint is reachable through caddy route

## Validation commands

```bash
just doctor
just contract
just smoke
```
