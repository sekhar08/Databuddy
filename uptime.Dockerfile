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

FROM oven/bun:1.3.4-distroless

WORKDIR /app

COPY --from=build /app/server server
COPY healthcheck.ts healthcheck.ts

ENV NODE_ENV=production
ENV HEALTHCHECK_PORT=4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "/app/healthcheck.ts"]

CMD ["./server"]

EXPOSE 4000