# Agentj Phase 1 快速開始

## 先決條件

- Node.js 24 LTS
- pnpm 10+
- PostgreSQL 16+

## 環境設定

先複製環境變數樣板：

```sh
cp .env.example .env
```

## 安裝依賴

```sh
pnpm install
```

## 啟動 PostgreSQL（必要）

在執行 migration 與 seed 前，PostgreSQL 必須先啟動。

- 本機 PostgreSQL：請先啟動本機 PostgreSQL 16 服務
- Docker PostgreSQL：

```sh
pnpm db:docker:up
```

## 資料庫初始化

```sh
pnpm db:migrate
pnpm db:seed
```

預設 Seed 會建立 `agentj_pat_dev_local_token`。

## 啟動服務（本機分開啟動）

請在不同終端機執行：

```sh
pnpm --filter @agentj/web dev
pnpm --filter @agentj/tunnel-gateway dev
```

## Docker 開發（推薦資料庫流程）

### 僅啟動 PostgreSQL

```sh
pnpm db:docker:up
```

### 初始化 schema 與 seed

```sh
pnpm db:docker:bootstrap
```

### 重建資料庫（含 volume）

```sh
pnpm db:docker:reset
pnpm db:docker:up
pnpm db:docker:bootstrap
```

如果你用本機直接啟動 Node 服務，請確認 `DATABASE_URL` 指向本機：

`postgresql://postgres:postgres@localhost:5432/agentj`

可指定不同 seed token：

```sh
SEED_PAT_TOKEN=你的token pnpm db:docker:bootstrap
```

## CLI 快速驗證

```sh
pnpm --filter @agentj/cli build
pnpm --filter @agentj/cli exec aj login --token agentj_pat_dev_local_token
pnpm --filter @agentj/cli exec aj tunnel http 3001 --project <project-id>
```
