# Agentj

Agentj 是一個 pnpm monorepo，用來跑本地 tunneling 平台，包含 Web dashboard、tunnel gateway 與 CLI。

## 專案結構

- `apps/web`: Next.js dashboard + API routes
- `apps/tunnel-gateway`: Fastify + WebSocket gateway（給 tunnel agents）
- `packages/cli`: Oclif CLI（`aj`）
- `packages/contracts`: 共用 DB/Auth/API contracts
- `packages/sdk`: CLI 使用的 client SDK
- `infra/docker`: 本地 Docker Compose 與 DB-first 流程設定

## 先決條件

- Node.js 24 LTS
- pnpm 10+
- PostgreSQL 16+

## QUICKSTART

1. 複製環境變數：

```sh
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

`apps/web` 使用 Next.js 慣例的 `apps/web/.env.local`。  
根目錄 `.env` 提供 contracts / tunnel-gateway / CLI。

2. 安裝依賴：

```sh
pnpm install
```

3. 啟動 PostgreSQL（必要）並初始化資料庫：

```sh
pnpm db:docker:up
pnpm db:migrate
pnpm db:seed
```

Seed 預設 dev PAT：

`agentj_pat_dev_local_token`

可用 `AGENTJ_DEV_PAT_TOKEN`（`.env` 或 `apps/web/.env.local`）覆蓋預設值。

4. 分別啟動服務：

```sh
pnpm --filter @agentj/web dev
pnpm --filter @agentj/tunnel-gateway dev
```

5. CLI 快速驗證：

```sh
pnpm --filter @agentj/cli build
pnpm --filter @agentj/cli exec ./bin/run.js authtoken <從 Web 複製的 PAT>
pnpm --filter @agentj/cli exec ./bin/run.js http 8080
```

Web Dashboard (`http://localhost:3000`) 的 **Development PAT** 區塊可查看/產生 PAT。  
`aj http` 會自動準備所需資源，不需要額外資源參數。
本機直接跑 `web + gateway`（未經 Caddy）時，公開網址預設為 `http://<subdomain>.tunnel.localhost:4000`。

## Tunnel 404 troubleshooting

`http://<subdomain>.tunnel.localhost:4000` 在本機直跑模式是有效網址。  
如果遇到 404，先用 CLI logs 判斷 404 來源：

```sh
pnpm --filter @agentj/cli exec ./bin/run.js logs <tunnelId> --follow
```

- Gateway 回 `TUNNEL_NOT_FOUND`（或沒有看到請求）：
  - 檢查 `web` 與 `gateway` 是否連到同一個 `DATABASE_URL`
  - 檢查 `AGENTJ_TUNNEL_BASE_DOMAIN` 是否一致（都應為 `tunnel.localhost`）
  - 檢查 `AGENTJ_CONNECT_TOKEN_SECRET` 與 `AGENTJ_GATEWAY_WS_PUBLIC_URL` 是否一致
- Tunnel logs 顯示請求狀態 `404`：
  - 代表請求已到上游 app，404 來自 `:8080` 的路由本身（不是 tunnel domain 問題）

## Docker（Database-first）

只啟動 PostgreSQL：

```sh
pnpm db:docker:up
```

初始化 schema + seed：

```sh
pnpm db:docker:bootstrap
```

重建 DB（含 volume）：

```sh
pnpm db:docker:reset
pnpm db:docker:up
pnpm db:docker:bootstrap
```

## 存取網址

- Dashboard: `http://app.localhost`
- Control API base: `http://app.localhost/api/v1`
- Gateway WS endpoint: `ws://gateway:4000/agent/v1/connect`

## 其他文件

- Docker 細節：`infra/docker/README.md`
