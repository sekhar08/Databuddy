FROM oven/bun:1.3.4-slim AS pruner

WORKDIR /app

COPY . .

RUN bunx turbo prune @databuddy/api --docker

FROM oven/bun:1.3.4-slim AS builder

WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN bun install --ignore-scripts

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
RUN bunx turbo build --filter=@databuddy/api...

FROM oven/bun:1.3.4-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production

EXPOSE 3001

WORKDIR /app/apps/api

COPY healthcheck.ts /app/healthcheck.ts
ENV HEALTHCHECK_PORT=3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["bun", "/app/healthcheck.ts"]

CMD ["bun", "run", "src/index.ts"]
