# DATABUDDY WORKSPACE BRIEFING

## SNAPSHOT

type: monorepo  
langs: TypeScript, React, Bun, Node  
runtimes: Node 20+, Bun 1.3.4  
pkgManager: bun@1.3.4  
deliverables: analytics dashboard, REST/RPC API, tracking SDKs, email services, rate limiting  
rootConfigs: `turbo.json`, `biome.jsonc`, `tsconfig.json`, `package.json`

---

## PACKAGES

| name | path | type | deps | usedBy | role |
|------|------|------|------|--------|------|
| @databuddy/api | apps/api | service | db,auth,rpc,email,notifications,ai,redis,shared,tracker | dashboard,external | REST+RPC endpoints, query execution, webhooks |
| @databuddy/dashboard | apps/dashboard | app | api,auth,rpc,db,redis,env,shared,sdk | - | Next.js admin UI, analytics visualization |
| @databuddy/basket | apps/basket | service | db,redis,rpc,api-keys,shared,validation | - | Event collection, tracking ingestion pipeline |
| @databuddy/links | apps/links | service | db,redis,shared | - | URL shortener/redirect handler |
| @databuddy/uptime | apps/uptime | service | db,email,services | - | Uptime monitoring, health checks, alerts |
| @databuddy/docs | apps/docs | app | sdk,shared,auth | - | Next.js documentation, guides, API refs |
| @databuddy/db | packages/db | lib | cache,clickhouse | api,basket,dashboard,links,uptime,rpc | Drizzle ORM schema, migrations, db client |
| @databuddy/rpc | packages/rpc | lib | db,auth,api-keys,notifications,redis,shared,validation,services | api,dashboard | ORPC procedures, auth context, billing logic |
| @databuddy/auth | packages/auth | lib | db,email,redis,shared,notifications | api,rpc,dashboard | BetterAuth setup, SSO, JWT, auth client |
| @databuddy/shared | packages/shared | lib | db,redis | api,basket,links,dashboard,docs | Types, utils, country codes, constants |
| @databuddy/sdk | packages/sdk | lib | - | docs,dashboard | Analytics tracking SDK (React/Vue/Node) |
| @databuddy/cache | packages/cache | lib | - | db,sdk | Drizzle query caching layer |
| @databuddy/redis | packages/redis | lib | - | db,auth,api-keys,api,basket,links,dashboard | Redis client wrapper, pub/sub |
| @databuddy/email | packages/email | lib | - | auth,uptime | React Email templates |
| @databuddy/notifications | packages/notifications | lib | - | auth,rpc,api | Notification types, providers |
| @databuddy/api-keys | packages/api-keys | lib | db,redis | api,basket,rpc | API key validation, scopes |
| @databuddy/validation | packages/validation | lib | - | rpc | Zod schemas, validation logic |
| @databuddy/ai | packages/ai | lib | - | api | LLM provider wrappers (OpenAI, Anthropic, Groq) |
| @databuddy/services | packages/services | lib | db | uptime | Business logic (websites, scheduling) |
| @databuddy/tracker | packages/tracker | lib | - | - | Tracking script builder, deployment |
| @databuddy/env | packages/env | lib | - | dashboard,api | Zod env validation per-app |
| @databuddy/mapper | packages/mapper | lib | db | - | CSV parsing, data transformation |

---

## DEPENDENCY GRAPH

apps/api → auth, rpc, db, email, notifications, shared, redis, api-keys, ai  
apps/dashboard → rpc, auth, db, redis, env, shared, sdk  
apps/basket → db, redis, rpc, api-keys, shared, validation  
apps/links → db, redis, shared  
apps/uptime → db, email, services  
apps/docs → sdk, shared, auth  
packages/rpc → db, auth, api-keys, notifications, redis, shared, validation, services  
packages/auth → db, email, redis, shared, notifications  
packages/db → cache, clickhouse  
packages/shared → db, redis  

---

## ARCHITECTURE

### @databuddy/api (`apps/api`)

entry: `src/index.ts` → Elysia HTTP server  
routing: `src/routes/` → query, agent, insights, health, mcp, webhooks, public  
state: ORPC procedures in @databuddy/rpc, redis for sessions  
api: ORPC + REST via `@orpc/server`, OpenAPI schema generation  
db: Drizzle ORM via @databuddy/db  
auth: BetterAuth via @databuddy/auth  
build: `bun --hot src/index.ts --port 3001`, NODE_ENV=development  
dirs:
  - `src/routes/` → endpoint routers
  - `src/query/` → SQL query builders, executors
  - `src/lib/` → auth-wide-event, tracing, evlog integration
  - `src/schemas/` → request validation

### @databuddy/dashboard (`apps/dashboard`)

entry: `app/page.tsx` → Next.js 16 root layout  
routing: App Router, `nuqs` for query state, nested `[...]/page.tsx`  
state: Jotai atoms, React Query (@tanstack/react-query), React Context  
api: ORPC client via `@orpc/tanstack-query`, fetch to @databuddy/api  
db: indirect via api  
auth: BetterAuth client, session cookies  
build: `next build`, outputs `.next/`, NODE_ENV varies  
dirs:
  - `app/` → pages, layouts
  - `components/` → UI components (Radix + Tailwind)
  - `contexts/` → React context providers
  - `hooks/` → custom React hooks
  - `stores/` → Jotai state atoms
  - `lib/` → utilities, helpers

### @databuddy/basket (`apps/basket`)

entry: `src/index.ts` → Elysia HTTP service  
routing: `src/routes/` → basket (event collection), llm, track, webhooks  
state: in-memory + Redis for distributed state  
api: Elysia routes, KafkaJS for event streaming  
db: Drizzle for writes, ClickHouse for analytics  
auth: API key validation via @databuddy/api-keys  
build: `NODE_ENV=development bun --watch run src/index.ts`  
dirs:
  - `src/routes/` → event handlers, webhooks
  - `src/lib/` → evlog, producer, tracing
  - `src/utils/` → IP geo, device parsing

### @databuddy/links (`apps/links`)

entry: `src/index.ts` → Elysia redirect server  
routing: Elysia routes for short links  
db: Drizzle for link lookups  
build: Bun compile to binary  
dirs: `src/`, `dist/` (compiled binary)

### @databuddy/uptime (`apps/uptime`)

entry: `src/index.ts` → Elysia cron/webhook handler  
state: scheduled tasks via @upstash/qstash  
api: Receives webhook from QStash  
db: Drizzle for uptime records  
email: React Email templates  
build: `bun --watch run src/index.ts`

### @databuddy/docs (`apps/docs`)

entry: `app/page.tsx` → Next.js 16 documentation site  
routing: MDX-based routes via Fumadocs  
sdk: Integrated SDK examples  
build: `next build`  
dirs:
  - `app/` → MDX doc pages
  - `components/` → doc UI, code blocks

### @databuddy/db (`packages/db`)

exports: `.` → src/index.ts (db client), `./client` → client.ts, `./clickhouse` → clickhouse/index.ts  
consumedBy: api, basket, dashboard, links, uptime, rpc  
db: Drizzle ORM → PostgreSQL primary, ClickHouse analytics  
scripts: `db:push`, `db:studio`, `db:seed`, `clickhouse:init`  
dirs:
  - `src/drizzle/` → schema, relations
  - `src/clickhouse/` → ClickHouse client setup
  - `src/seed.ts` → seed data

### @databuddy/rpc (`packages/rpc`)

exports: `.` → index.ts (appRouter, context, procedures)  
consumedBy: api, dashboard  
api: ORPC router with procedures for billing, auth, webhooks, integrations  
dirs:
  - `src/orpc.ts` → ORPC context, auth middleware
  - `src/procedures/` → with-workspace, auth guards
  - `src/routers/` → websites, members, analytics, ai
  - `src/services/` → billing, export, invite logic

### @databuddy/auth (`packages/auth`)

exports: `.` → src/index.ts, `./client` → client/auth-client.ts  
consumedBy: api, rpc, dashboard  
auth: BetterAuth instance, SSO (Google, GitHub), email OTP  
database: Uses @databuddy/db schema  
email: React Email via @databuddy/email  
dirs:
  - `src/auth.ts` → BetterAuth instance config
  - `src/client/` → client-side auth utils
  - `src/permissions.ts` → role-based access

### @databuddy/shared (`packages/shared`)

exports: types/*, lists/*, utils/*, schema/*, flags/, bot-detection/  
consumedBy: api, basket, links, dashboard, docs  
types: analytics, api, billing, sessions, realtime, performance, etc.  
dirs:
  - `src/types/` → multi-export schema types
  - `src/utils/` → date-utils, ids, openrouter, bot detection
  - `src/lists/` → filters, referrers, timezones, country codes
  - `src/flags/` → feature flags

### @databuddy/sdk (`packages/sdk`)

exports: `.` → core index, `./react`, `./vue`, `./node`  
consumedBy: docs, dashboard, external consumers  
build: unbuild → dist/*.mjs, dist/*.d.ts  
published: npm, public  

### @databuddy/cache (`packages/cache`)

exports: `.` → dist/drizzle.mjs (Drizzle query cache layer)  
consumedBy: db  
published: npm, public  

### @databuddy/redis (`packages/redis`)

exports: index.ts (Redis client wrapper)  
consumedBy: db, auth, api-keys, api, basket, links, dashboard  

### @databuddy/email (`packages/email`)

exports: `./*` → src/emails/*.tsx (React components)  
consumedBy: auth, uptime  
dev: `bun run dev` (react-email dev server)

### @databuddy/api-keys (`packages/api-keys`)

exports: `./scopes`, `./resolve`  
consumedBy: api, basket, rpc  

### @databuddy/notifications (`packages/notifications`)

exports: `.`, `./types`, `./client`, `./providers`, `./templates/uptime`  
consumedBy: auth, rpc, api  

### @databuddy/validation (`packages/validation`)

exports: `.` → src/index.ts (Zod schemas)  
consumedBy: rpc  

### @databuddy/ai (`packages/ai`)

exports: `./vercel`, `./openai`, `./anthropic`  
consumedBy: api  
providers: OpenAI SDK, Anthropic SDK, Vercel AI SDK  

### @databuddy/services (`packages/services`)

exports: `./websites`  
consumedBy: uptime, rpc  

---

## DEPENDENCY GRAPH

`apps/api` → auth, rpc, db, email, notifications, shared, redis, api-keys, ai  
`apps/dashboard` → rpc, auth, db, redis, env, shared, sdk  
`apps/basket` → db, redis, rpc, api-keys, shared, validation  
`apps/links` → db, redis, shared  
`apps/uptime` → db, email, services  
`apps/docs` → sdk, shared, auth  
`packages/rpc` → db, auth, api-keys, notifications, redis, shared, validation, services  
`packages/auth` → db, email, redis, shared, notifications  
`packages/db` → cache  
`packages/shared` → db, redis

---

## STACK

`@databuddy/api` → framework: Elysia, routing: Elysia, state: Redis, orm: Drizzle, auth: BetterAuth, build: Bun  
`@databuddy/dashboard` → framework: Next.js 16, routing: App Router, state: Jotai+React Query, orm: Drizzle (via RPC), auth: BetterAuth, build: Next.js, runtime: Node  
`@databuddy/basket` → framework: Elysia, routing: Elysia, state: Redis+Kafka, orm: Drizzle+ClickHouse, auth: API Keys, build: Bun  
`@databuddy/links` → framework: Elysia, orm: Drizzle, build: Bun compile  
`@databuddy/uptime` → framework: Elysia, scheduling: Upstash QStash, orm: Drizzle, email: React Email, build: Bun  
`@databuddy/docs` → framework: Next.js 16, routing: App Router, build: Next.js, runtime: Node  
`@databuddy/db` → orm: Drizzle, databases: PostgreSQL (primary), ClickHouse (analytics), runtime: Node  
`@databuddy/rpc` → rpc: ORPC, auth: BetterAuth  
`@databuddy/auth` → auth: BetterAuth, database: PostgreSQL, email: React Email  
`@databuddy/sdk` → build: unbuild, published: npm  

---

## STYLE

- naming: camelCase functions, PascalCase components, UPPER_SNAKE_CASE constants
- imports: ES modules, workspace: `@databuddy/*`, external: pinned versions in catalog
- typing: TypeScript strict, Zod schemas for validation, inference from Drizzle relations
- errors: ORPC errors for API, evlog for structured logging
- testing: Bun test runner, e2e via Playwright (SDK)
- lint: Biome (extends ultracite/react, ultracite/next)
- formatting: Biome autofix (2-space tabs), lint-staged on commit
- patterns: Elysia for HTTP services, Drizzle for ORM, ORPC for RPC, React Context + Jotai for state

---

## STRUCTURE

`apps/` → 7 deployable services + 1 site  
`packages/` → 19 internal libraries (utilities, db, auth, rpc, shared types)  
`rust/` → (likely unused or archived)  
`admin/` → (archived or unused)  
`infra/` → infrastructure config (k8s, docker-compose, tf?)  
`docs/` → root-level docs  
`.github/` → CI/CD workflows  
`.husky/` → git hooks (pre-commit lint-staged)  

---

## BUILD

workspaceScripts:
  - setup → setup.ts initialization
  - build → turbo run build (parallelized)
  - dev → turbo run dev (persistent, hot reload)
  - start → turbo run start
  - test → bun test ./apps
  - test:watch → bun test --watch ./apps
  - test:coverage → bun test --coverage ./apps
  - lint → ultracite check
  - format → ultracite fix
  - check-types → tsc --noEmit
  - generate-db → turbo run generate --filter=@databuddy/db
  - db:studio → turbo run db:studio
  - db:push → turbo run db:push
  - db:migrate → turbo run db:migrate
  - db:deploy → turbo run db:deploy
  - db:seed → bun run db:seed
  - email:dev → cd packages/email && bun run dev
  - sdk:build → turbo run build --filter @databuddy/sdk --filter @databuddy/cache
  - dev:dashboard → turbo dev --filter @databuddy/dashboard --filter @databuddy/api
  - clickhouse:init → turbo run clickhouse:init
  - git:setup-aliases → git config --local include.path ../gitconfig

envFiles: `.env`, `.env.example`  
envPrefixes: DATABASE_URL, REDIS_URL, CLICKHOUSE_URL, BETTER_AUTH_*, GOOGLE_CLIENT_*, GITHUB_CLIENT_*, RESEND_API_KEY, AUTUMN_SECRET_KEY, UPSTASH_*, LOGTAIL_*, R2_*, NEXT_PUBLIC_API_URL, MARBLE_*, NOTRA_*  
ci: `.github/workflows/` (infer from directory)  
docker: `api.Dockerfile`, `basket.Dockerfile`, `links.Dockerfile`, `uptime.Dockerfile`, `docker-compose.yaml`

---

## LOOKUP

add API endpoint → `apps/api/src/routes/*.ts`, `packages/rpc/src/routers/*.ts`  
add dashboard page → `apps/dashboard/app/**/page.tsx`  
add shared type → `packages/shared/src/types/*.ts`  
add auth provider → `packages/auth/src/auth.ts`  
add tracking event → `apps/basket/src/routes/track.ts`  
add email template → `packages/email/src/emails/*.tsx`  
add RPC procedure → `packages/rpc/src/routers/`, `src/procedures/`  
add database table → `packages/db/src/drizzle/schema.ts`  
add validation schema → `packages/validation/src/index.ts`  
modify env vars → `packages/env/src/*.ts`  
build SDK → `packages/sdk/` + `bun run build`  
publish SDK → npm registry (public)  
add cron/scheduled task → `apps/uptime/src/routes/*`  
add webhook handler → `apps/api/src/routes/webhooks/`, `apps/basket/src/routes/webhooks/`  

---

## KEY FILES

`package.json` → workspaces, scripts, catalog versions, turbo config entry  
`turbo.json` → task definitions, global env, cache config, build outputs  
`biome.jsonc` → lint/format rules, extends ultracite presets  
`tsconfig.json` → root TypeScript config (references workspace packages)  
`.env.example` → all environment variables documented  
`apps/api/src/index.ts` → API server entry, Elysia setup, middleware  
`apps/api/src/routes/query.ts` → main query execution endpoint  
`apps/api/src/routes/agent.ts` → AI agent endpoint  
`apps/dashboard/app/page.tsx` → dashboard root layout  
`apps/basket/src/index.ts` → basket service entry, tracking pipeline  
`packages/rpc/src/index.ts` → RPC exports, procedures, context  
`packages/rpc/src/routers/*.ts` → resource routers (websites, members, analytics)  
`packages/rpc/src/procedures/with-workspace.ts` → auth middleware  
`packages/db/src/index.ts` → DB client exports  
`packages/db/src/drizzle/schema.ts` → Drizzle table definitions  
`packages/auth/src/auth.ts` → BetterAuth instance  
`packages/auth/src/permissions.ts` → permission checks  
`packages/shared/src/types/*.ts` → shared type definitions  
`packages/shared/src/utils/*.ts` → utility functions  
`packages/sdk/src/core/index.ts` → SDK main entry  
`.github/workflows/*.yml` → CI/CD automation  
`docker-compose.yaml` → local dev services (postgres, redis, clickhouse)

---

## NOTES

- **Monorepo**: Turbo for orchestration, workspaces define packages, catalog pins versions
- **Runtime**: Node 20+ required, Bun 1.3.4 for build/runtime (faster than npm)
- **Services**: Elysia for HTTP (api, basket, links, uptime), Next.js for web (dashboard, docs)
- **Database**: Drizzle ORM primary (PostgreSQL), ClickHouse for analytics (separate client)
- **Auth**: BetterAuth with SSO (Google, GitHub), email OTP, session-based + API keys
- **State**: Redis for distributed state, Jotai for dashboard UI, React Query for server state
- **API**: ORPC for type-safe RPC between dashboard/api, REST for public consumption
- **Email**: React Email for templates (auth, notifications)
- **SDKs**: Public (@databuddy/sdk, @databuddy/cache, @databuddy/ai) published to npm
- **Logging**: evlog for structured logging, OpenTelemetry for tracing
- **Events**: KafkaJS for distributed event streaming in basket
- **Linting**: Biome extends ultracite presets, lint-staged enforces on commit
