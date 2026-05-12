# ── Stage: build-core ────────────────────────────────────────────────────────
# Clones mesahub-core and builds the Go binary from source.
# Override MESAHUB_CORE_VERSION at build time to pin a specific commit/tag:
#   docker build --build-arg MESAHUB_CORE_VERSION=trunk .
FROM golang:1.24-alpine AS build-core
RUN apk add --no-cache gcc musl-dev sqlite-dev git
ARG MESAHUB_CORE_VERSION=trunk
RUN git clone --depth 1 --branch ${MESAHUB_CORE_VERSION} \
    https://github.com/mesahub-db/mesahub-core.git /mesahub-core
WORKDIR /mesahub-core/server
RUN CGO_ENABLED=1 GOOS=linux go build -o /go/bin/mesahub-server ./cmd/server

# ── Stage: dev (backend hot-reload only) ─────────────────────────────────────
# Dev stage - backend with nodemon for hot reload
FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci
COPY service ./service
RUN npm install -g nodemon
EXPOSE 3000
CMD ["nodemon", "--exec", "node", "--", "service/index.js"]

# ── Stage: build-frontend ────────────────────────────────────────────────────
FROM node:22-alpine AS build-frontend
WORKDIR /app
COPY dashboard/package*.json ./dashboard/
RUN npm --prefix dashboard ci
COPY dashboard/ ./dashboard/
RUN npm --prefix dashboard run build

# ── Stage: prod (Caddy + Node + mesahub-server) ───────────────────────────────
FROM caddy:2-alpine AS caddy-bin

FROM node:22-alpine AS prod
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl openssl sqlite-libs
WORKDIR /app

# mesahub-server (for embedded mode — skipped when MESAHUB_URL points externally)
COPY --from=build-core /go/bin/mesahub-server /usr/local/bin/mesahub-server
RUN mkdir -p /data
VOLUME ["/data"]

# Node backend
COPY package*.json ./
RUN npm ci --omit=dev
COPY service ./service

# Frontend static files
RUN mkdir -p /usr/share/caddy
COPY --from=build-frontend /app/dashboard/dist /usr/share/caddy

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80
CMD ["/app/start.sh"]
