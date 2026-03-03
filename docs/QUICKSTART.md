# Agentj Phase 1 Quickstart

## Prerequisites

- Node.js 24 LTS
- pnpm 10+
- PostgreSQL 16+

## Environment

Copy `.env.example` and set values:

```sh
cp .env.example .env
```

## Install

```sh
pnpm install
```

## Migrate and Seed

```sh
pnpm db:migrate
pnpm db:seed
```

Seed default PAT token:

`agentj_pat_dev_local_token`

## Run Services

In separate terminals:

```sh
pnpm --filter @agentj/web dev
pnpm --filter @agentj/tunnel-gateway dev
```

## Docker Development (Database-first)

### Start PostgreSQL only

```sh
pnpm db:docker:up
```

### Initialize schema and seed data

```sh
pnpm db:docker:bootstrap
```

### Reset database including volumes

```sh
pnpm db:docker:reset
pnpm db:docker:up
pnpm db:docker:bootstrap
```

When running Node services locally, make sure `DATABASE_URL` points to local PostgreSQL:

`postgresql://postgres:postgres@localhost:5432/agentj`

Optional custom seed token:

```sh
SEED_PAT_TOKEN=your_token pnpm db:docker:bootstrap
```

## Run CLI

```sh
pnpm --filter @agentj/cli build
node packages/cli/bin/run.js login --token agentj_pat_dev_local_token
node packages/cli/bin/run.js tunnel http 3001 --project <project-id>
```
