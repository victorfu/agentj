# Docker Compose (single-node)

## Start stack

```sh
docker compose -f infra/docker/docker-compose.yml up --build
```

## Database-only flow

Start PostgreSQL only:

```sh
docker compose -f infra/docker/docker-compose.db.yml up -d postgres
```

Initialize schema + seed data:

```sh
docker compose -f infra/docker/docker-compose.db.yml run --rm db-bootstrap
```

Reset data and restart:

```sh
docker compose -f infra/docker/docker-compose.db.yml down -v
docker compose -f infra/docker/docker-compose.db.yml up -d postgres
docker compose -f infra/docker/docker-compose.db.yml run --rm db-bootstrap
```

Stop DB container:

```sh
docker compose -f infra/docker/docker-compose.db.yml down
```

## Access

- Dashboard: `http://app.localhost`
- Control API base: `http://app.localhost/api/v1`
- Gateway WS endpoint: `ws://gateway:4000/agent/v1/connect`

## Seed behavior

Seed script currently only ensures the default dev user (`dev@agentj.local`).
Create PATs from the Web Dashboard.
