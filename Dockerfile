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

# Builder stage - compile frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY dashboard/package*.json ./dashboard/
RUN npm ci && npm --prefix dashboard ci
COPY . .
RUN npm run build

# Production stage - Caddy + Node backend
FROM caddy:2-alpine AS prod
RUN apk add --no-cache nodejs npm curl
WORKDIR /app
RUN mkdir -p /usr/share/caddy
COPY --from=builder /app/service ./service
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dashboard/dist /usr/share/caddy
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh
EXPOSE 80 443

CMD ["/app/start.sh"]
