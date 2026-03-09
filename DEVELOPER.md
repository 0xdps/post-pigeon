# Developer Guide (V1)

This file is the source of truth for how dev and prod are run.

## Operating Model

Single compose file with profiles:
- docker-compose.yml
- dev profile for local hot reload stack
- prod profile for production runtime stack

Parity principle:
- keep startup and routing as close as practical
- only necessary difference is host port strategy

Environment difference:
- dev: random Docker host port, optional Portless alias
- prod: platform provided PORT

## Services by Profile

Dev:
- backend
- frontend
- caddy

Prod:
- app

Verify with:

```bash
docker-compose --profile dev config --services
docker-compose --profile prod config --services
```

## Primary Commands

```bash
just dev
just down
just logs
just prod
just prod-down
just prod-logs
just show-ports
just status
```

Behavior notes:
- just dev starts containers detached then tails logs
- Ctrl+C exits log tail only
- containers continue until just down

## Port Model

Dev:
- caddy listens on internal container port
- Docker maps a random host port
- just dev discovers that mapped port
- if Portless exists, alias autoposter is mapped automatically

Prod:
- app reads PORT from runtime platform
- start.sh launches backend internally and caddy externally on PORT

## Entrypoints and Routing

Production entrypoint:
- start.sh

Production flow:
1. start backend
2. wait for backend health
3. generate caddy config bound to PORT
4. run caddy in foreground

Dev proxy config:
- generated dynamically by the caddy service command in docker-compose.yml

## Environment Variables

Required:
- API_KEY
- API_KEY_SECRET
- ACCESS_TOKEN
- ACCESS_TOKEN_SECRET
- SQLITE_HUB_URL
- SQLITE_HUB_SERVICE_SECRET
- SQLITE_HUB_DB
- ADMIN_TOKEN
- SESSION_SECRET

Common runtime settings:
- CRON_ENABLED
- CRON_SCHEDULE
- POST_PROBABILITY
- DAILY_LIMIT
- COOLDOWN_MINUTES
- RANDOM_DELAY_MINUTES
- DRY_RUN
- PORT

Recommendation:
- quote CRON_SCHEDULE in .env when shells may split on spaces.

## Build and Quality

```bash
just build
just lint
just format
just format-check
just test
```

## Deployment

Railway uses Dockerfile via railway.json.

Local production validation:

```bash
just prod
```

If deployment breaks, verify:
1. profile services are correct
2. PORT wiring is correct
3. start.sh health wait succeeds
4. caddy reverse proxy targets backend internal port

## Documentation Update Rule

When runtime behavior changes, update together:
- README.md
- DEVELOPER.md
- docs/DEVELOPMENT_PRODUCTION.md
