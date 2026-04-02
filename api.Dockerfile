FROM oven/bun:1.3.9-slim AS builder

WORKDIR /app

COPY package.json bun.lock turbo.json ./

COPY apps/ ./apps/
COPY packages/ ./packages/

RUN bun install --ignore-scripts

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

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun -e "const r = await fetch('http://localhost:3001/health'); if (!r.ok) process.exit(1);"

CMD ["bun", "run", "src/index.ts"]