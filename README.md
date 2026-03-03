# Agentj

Agentj is a pnpm monorepo for running a local tunneling platform in Phase 1.
It includes a web dashboard, a tunnel gateway, and a CLI.

## Project Layout

- `apps/web`: Next.js dashboard + API routes
- `apps/tunnel-gateway`: Fastify + WebSocket gateway for tunnel agents
- `packages/cli`: Oclif-based CLI (`agentj`)
- `packages/contracts`: shared DB/auth/API contracts
- `packages/sdk`: client SDK used by CLI
- `infra/docker`: Docker Compose setup for local stack and DB-first workflow

## Prerequisites

- Node.js 24 LTS
- pnpm 10+
- PostgreSQL 16+

## Quick Start

1. Copy environment variables:

```sh
cp .env.example .env
```

2. Install dependencies:

```sh
pnpm install
```

3. Initialize database:

```sh
pnpm db:migrate
pnpm db:seed
```

Default dev PAT token created by seed:

`agentj_pat_dev_local_token`

4. Start services in separate terminals:

```sh
pnpm --filter @agentj/web dev
pnpm --filter @agentj/tunnel-gateway dev
```

## CLI Smoke Test

```sh
pnpm --filter @agentj/cli build
node packages/cli/bin/run.js login --token agentj_pat_dev_local_token
node packages/cli/bin/run.js tunnel http 3001 --project <project-id>
```

## Docker (Database-first)

Start PostgreSQL only:

```sh
pnpm db:docker:up
```

Initialize schema + seed data:

```sh
pnpm db:docker:bootstrap
```

Reset DB (including volumes):

```sh
pnpm db:docker:reset
pnpm db:docker:up
pnpm db:docker:bootstrap
```

## Access URLs (Docker stack)

- Dashboard: `http://app.localhost`
- Control API base: `http://app.localhost/api/v1`
- Gateway WS endpoint: `ws://gateway:4000/agent/v1/connect`

## Documents

- Traditional Chinese Docker guide: `README.zh-TW.md`
- Quickstart (EN): `docs/QUICKSTART.md`
- Quickstart (zh-TW): `docs/QUICKSTART.zh-TW.md`
- Docker details (EN): `infra/docker/README.md`
