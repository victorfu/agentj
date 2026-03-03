# Docker Compose（單節點）

## 啟動整套服務

```sh
docker compose -f infra/docker/docker-compose.yml up --build
```

## 僅資料庫流程

只啟動 PostgreSQL：

```sh
docker compose -f infra/docker/docker-compose.db.yml up -d postgres
```

初始化 schema 與 seed 資料：

```sh
docker compose -f infra/docker/docker-compose.db.yml run --rm db-bootstrap
```

重建資料並重新啟動：

```sh
docker compose -f infra/docker/docker-compose.db.yml down -v
docker compose -f infra/docker/docker-compose.db.yml up -d postgres
docker compose -f infra/docker/docker-compose.db.yml run --rm db-bootstrap
```

停止 DB 容器：

```sh
docker compose -f infra/docker/docker-compose.db.yml down
```

## 存取位址

- Dashboard: `http://app.localhost`
- Control API base: `http://app.localhost/api/v1`
- Gateway WS endpoint: `ws://gateway:4000/agent/v1/connect`

## 開發用 Seed Token

Seed 腳本預設會建立：

`agentj_pat_dev_local_token`

執行 seed 時可透過 `SEED_PAT_TOKEN` 環境變數覆寫。
