# syntax=docker/dockerfile:1

# ---------- Frontend build ----------
FROM node:26-bookworm-slim AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY frontend frontend
RUN npm run build --workspace=frontend

# ---------- Backend build ----------
FROM node:26-bookworm-slim AS backend-build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY backend backend
COPY --from=frontend-build /app/frontend/dist frontend/dist
RUN npm run build --workspace=backend
RUN npm prune --omit=dev \
    # L'override typescript de @nestjs/swagger 12 (peer optionnel, jamais utilise a l'execution :
    # seul son plugin de compilation l'importe) fait compter typescript comme dependance de prod.
    && rm -rf node_modules/typescript node_modules/@typescript node_modules/.bin/tsc node_modules/.bin/tsserver

# ---------- Runtime ----------
FROM node:26-bookworm-slim AS runtime
ARG TARGETARCH
ARG LITESTREAM_VERSION=0.3.13
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/backend/data/qrcode.sqlite
ENV LITESTREAM_CONFIG=/app/backend/litestream.yml
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${TARGETARCH}.tar.gz" \
       | tar -xz -C /usr/local/bin litestream \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /app/node_modules node_modules
# Garde-fou : le compilateur TypeScript ne doit jamais atterrir dans l'image d'execution.
RUN test ! -e node_modules/typescript && test ! -e node_modules/@typescript
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=backend-build /app/backend/package.json backend/package.json
COPY --from=backend-build /app/frontend/dist frontend/dist
COPY backend/litestream.yml backend/litestream.yml
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/backend/data \
    && chown node:node /app/backend /app/backend/data
VOLUME ["/app/backend/data"]
WORKDIR /app/backend
USER node
EXPOSE 3000
# /healthz est interne (bloqué par Caddy). `fetch` de Node : l'image n'a pas besoin de curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
