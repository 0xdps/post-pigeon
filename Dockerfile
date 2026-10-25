# PostPigeon — one Next.js process (UI, API, and cron).
# Railway injects PORT. The server must listen on 0.0.0.0:$PORT.
#
#   docker build -t postpigeon .
#   docker run --rm -p 3000:3000 --env-file .env.local postpigeon

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs jsconfig.json instrumentation.js ./
COPY app ./app
COPY public ./public
COPY service ./service
RUN npm run build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache curl \
	&& addgroup -S pigeon && adduser -S pigeon -G pigeon

COPY --from=build --chown=pigeon:pigeon /app/.next/standalone ./
COPY --from=build --chown=pigeon:pigeon /app/.next/static ./.next/static
COPY --from=build --chown=pigeon:pigeon /app/public ./public
COPY --from=build --chown=pigeon:pigeon /app/service ./service

RUN mkdir -p /app/data/uploads && chown -R pigeon:pigeon /app/data
VOLUME ["/app/data"]

USER pigeon
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["node", "server.js"]
