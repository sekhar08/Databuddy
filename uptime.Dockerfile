FROM oven/bun:1.3.4-slim AS build

WORKDIR /app

COPY package.json package.json
COPY apps/uptime/package.json ./apps/uptime/package.json
COPY packages/*/package.json ./packages/

COPY packages/ ./packages/

RUN bun install --ignore-scripts

COPY apps/uptime/src ./apps/uptime/src

ENV NODE_ENV=production

RUN bun build \
    --compile \
    --minify \
    --target bun \
    --outfile server \
    --sourcemap \
    --bytecode \
    ./apps/uptime/src/index.ts

FROM gcr.io/distroless/base:debug

WORKDIR /app

COPY --from=build /app/server server

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/busybox/wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4000/health"]

CMD ["./server"]

EXPOSE 4000