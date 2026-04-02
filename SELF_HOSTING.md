# Self-Hosting Databuddy

This guide walks you through running Databuddy on your own infrastructure.

## Architecture Overview

Databuddy is a monorepo with several independent services:

| Service | Default Port | Purpose |
|---|---|---|
| **dashboard** | 3000 | Next.js frontend |
| **api** | 3001 | Main analytics API (oRPC) |
| **basket** | 4000 | Event ingestion / tracking endpoint |
| **links** | 2500 | Short-link redirector |
| **uptime** | 4000 | Uptime monitoring |

Infrastructure dependencies:

| Dependency | Default Port | Purpose |
|---|---|---|
| PostgreSQL 17 | 5432 | Relational data (users, projects, links) |
| ClickHouse | 8123 | Analytics event storage |
| Redis 7 | 6379 | Caching, rate limiting, queues |

---

## Prerequisites

- [Bun](https://bun.sh) 1.3.4+
- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- Node.js 20+ (optional, for tooling)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/your-org/databuddy.git
cd databuddy
bun install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, ClickHouse, and Redis with default dev credentials.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values (see the full reference below).

### 4. Initialize databases

```bash
bun run db:push          # PostgreSQL schema
bun run clickhouse:init  # ClickHouse tables
```

### 5. Start services

```bash
bun run dev
```

Or start individual services:

```bash
bun run dev:dashboard    # dashboard + api together
```

---

## Environment Variable Reference

### Core (all services)

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgres://databuddy:databuddy_dev_password@localhost:5432/databuddy` | Yes | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Yes | Redis connection string |
| `NODE_ENV` | `development` | No | `development` or `production` |

### API service (`apps/api`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `CLICKHOUSE_URL` | `http://default:@localhost:8123/databuddy_analytics` | Yes | ClickHouse HTTP endpoint |
| `CLICKHOUSE_USER` | `default` | No | ClickHouse username |
| `CLICKHOUSE_PASSWORD` | _(empty)_ | No | ClickHouse password |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Yes | Public URL of the dashboard (used by auth) |
| `BETTER_AUTH_SECRET` | — | Yes | Random secret for session signing (run `openssl rand -base64 32`) |
| `AI_API_KEY` | _(empty)_ | No | OpenRouter API key — required only for the AI assistant feature |
| `PORT` | `3001` | No | Port the API listens on |
| `DASHBOARD_URL` | _(empty)_ | No | Your dashboard's public URL — added to CORS allowed origins for self-hosting |
| `RESEND_API_KEY` | _(empty)_ | No | [Resend](https://resend.com) API key for transactional email |
| `S3_BUCKET` | _(empty)_ | No | S3/R2 bucket name for file uploads |
| `S3_ACCESS_KEY_ID` | _(empty)_ | No | S3/R2 access key |
| `S3_SECRET_ACCESS_KEY` | _(empty)_ | No | S3/R2 secret key |
| `S3_ENDPOINT` | _(empty)_ | No | S3-compatible endpoint (e.g. Cloudflare R2) |
| `GITHUB_CLIENT_ID` | _(empty)_ | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | _(empty)_ | No | GitHub OAuth app secret |
| `GOOGLE_CLIENT_ID` | _(empty)_ | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | _(empty)_ | No | Google OAuth secret |

### Dashboard (`apps/dashboard`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Yes | Public URL of the API service |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Yes | Public URL of the dashboard (must match API) |
| `BETTER_AUTH_SECRET` | — | Yes | Same secret as the API service |
| `AUTUMN_SECRET_KEY` | _(empty)_ | No | Autumn billing integration key |
| `NEXT_PUBLIC_BASKET_URL` | `https://basket.databuddy.cc` | No | Public URL of your basket service — set this so tracking snippets point to your own instance |
| `NEXT_PUBLIC_TRACKER_URL` | `https://cdn.databuddy.cc/databuddy.js` | No | URL where the tracking JS bundle is served — set this if you self-host the tracker script |

### Links service (`apps/links`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `APP_URL` | `https://app.databuddy.cc` | No | Public URL of your dashboard app — used for expired/not-found link redirect pages |
| `LINKS_ROOT_REDIRECT_URL` | `https://databuddy.cc` | No | Where the links service root `/` redirects to |
| `GEOIP_DB_URL` | `https://cdn.databuddy.cc/mmdb/GeoLite2-City.mmdb` | No | URL to fetch the MaxMind GeoLite2-City MMDB file for geolocation |

### Basket service (`apps/basket`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `PORT` | `4000` | No | Port the basket service listens on |
| `CLICKHOUSE_URL` | — | Yes | ClickHouse HTTP endpoint (inherited from root `.env`) |
| `STRIPE_SECRET_KEY` | _(empty)_ | No | Stripe secret key for payment webhooks |
| `STRIPE_WEBHOOK_SECRET` | _(empty)_ | No | Stripe webhook signing secret |
| `GEOIP_DB_URL` | `https://cdn.databuddy.cc/mmdb/GeoLite2-City.mmdb` | No | URL to fetch the GeoLite2-City MMDB file |

### Uptime service (`apps/uptime`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `UPSTASH_QSTASH_TOKEN` | — | Yes | [Upstash QStash](https://upstash.com/docs/qstash) token for scheduling uptime checks |
| `RESEND_API_KEY` | _(empty)_ | No | Resend API key for uptime alert emails |

---

## Example `.env`

```env
# ── Infrastructure ────────────────────────────────────────────────────────────
DATABASE_URL="postgres://databuddy:change_me@localhost:5432/databuddy"
REDIS_URL="redis://localhost:6379"
CLICKHOUSE_URL="http://default:@localhost:8123/databuddy_analytics"

# ── Auth ─────────────────────────────────────────────────────────────────────
BETTER_AUTH_SECRET="<run: openssl rand -base64 32>"
BETTER_AUTH_URL="https://app.example.com"   # public URL of your dashboard

# ── Service URLs (self-hosting) ───────────────────────────────────────────────
NEXT_PUBLIC_API_URL="https://api.example.com"
NEXT_PUBLIC_BASKET_URL="https://basket.example.com"
NEXT_PUBLIC_TRACKER_URL="https://cdn.example.com/databuddy.js"
APP_URL="https://app.example.com"
LINKS_ROOT_REDIRECT_URL="https://example.com"
DASHBOARD_URL="https://app.example.com"

# ── Optional ──────────────────────────────────────────────────────────────────
AI_API_KEY=""
RESEND_API_KEY=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
UPSTASH_QSTASH_TOKEN=""
NODE_ENV=production
```

---

## Docker Compose (full stack)

The following example wires all services together. Adjust image tags and domain names to your setup.

```yaml
services:
  # ── Infrastructure ──────────────────────────────────────────────────────────

  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: databuddy
      POSTGRES_USER: databuddy
      POSTGRES_PASSWORD: ${DB_PASSWORD:-change_me}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U databuddy -d databuddy"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  clickhouse:
    image: clickhouse/clickhouse-server:25.5.1-alpine
    environment:
      CLICKHOUSE_DB: databuddy_analytics
      CLICKHOUSE_USER: default
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    volumes:
      - clickhouse_data:/var/lib/clickhouse
      - ./scripts/clickhouse-init.sql:/docker-entrypoint-initdb.d/clickhouse-init.sql
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8123/ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Application services ────────────────────────────────────────────────────

  api:
    build:
      context: .
      dockerfile: api.Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgres://databuddy:${DB_PASSWORD:-change_me}@postgres:5432/databuddy
      REDIS_URL: redis://redis:6379
      CLICKHOUSE_URL: http://default:@clickhouse:8123/databuddy_analytics
      BETTER_AUTH_URL: ${BETTER_AUTH_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      DASHBOARD_URL: ${DASHBOARD_URL}
      AI_API_KEY: ${AI_API_KEY:-}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    restart: unless-stopped

  basket:
    build:
      context: .
      dockerfile: basket.Dockerfile
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgres://databuddy:${DB_PASSWORD:-change_me}@postgres:5432/databuddy
      REDIS_URL: redis://redis:6379
      CLICKHOUSE_URL: http://default:@clickhouse:8123/databuddy_analytics
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    restart: unless-stopped

  links:
    build:
      context: .
      dockerfile: links.Dockerfile
    ports:
      - "2500:2500"
    environment:
      DATABASE_URL: postgres://databuddy:${DB_PASSWORD:-change_me}@postgres:5432/databuddy
      REDIS_URL: redis://redis:6379
      APP_URL: ${APP_URL}
      LINKS_ROOT_REDIRECT_URL: ${LINKS_ROOT_REDIRECT_URL:-https://databuddy.cc}
      GEOIP_DB_URL: ${GEOIP_DB_URL:-}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://databuddy:${DB_PASSWORD:-change_me}@postgres:5432/databuddy
      REDIS_URL: redis://redis:6379
      BETTER_AUTH_URL: ${BETTER_AUTH_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
      NEXT_PUBLIC_BASKET_URL: ${NEXT_PUBLIC_BASKET_URL}
      NEXT_PUBLIC_TRACKER_URL: ${NEXT_PUBLIC_TRACKER_URL:-}
      AUTUMN_SECRET_KEY: ${AUTUMN_SECRET_KEY:-}
      NODE_ENV: production
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
  clickhouse_data:
  redis_data:
```

---

## Optional Services

### Email (Resend)

Set `RESEND_API_KEY` to enable transactional email (password reset, uptime alerts, etc.). Create a free account at [resend.com](https://resend.com).

### OAuth (GitHub / Google)

Create OAuth apps in the respective developer consoles and set the `GITHUB_CLIENT_*` / `GOOGLE_CLIENT_*` variables. The callback URL should be `{BETTER_AUTH_URL}/api/auth/callback/{provider}`.

### Uptime monitoring

The uptime service uses [Upstash QStash](https://upstash.com/docs/qstash) for scheduling. Set `UPSTASH_QSTASH_TOKEN` to enable it.

### GeoIP

By default, geolocation data is fetched from the Databuddy CDN (`cdn.databuddy.cc/mmdb/GeoLite2-City.mmdb`). To use your own copy of the MaxMind GeoLite2-City database, set `GEOIP_DB_URL` to an HTTP URL pointing to your hosted `.mmdb` file.
