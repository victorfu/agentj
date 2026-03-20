# Agentj

Agentj 是一個 pnpm monorepo，用來跑本地 tunneling 平台，包含 Web dashboard、tunnel gateway 與 CLI。

## 專案結構

- `apps/web`: Next.js dashboard + API routes
- `apps/tunnel-gateway`: Fastify + WebSocket gateway（給 tunnel agents）
- `packages/cli`: Oclif CLI（npm: `agentj-cli`）
- `packages/contracts`: 共用 DB/Auth/API contracts
- `packages/sdk`: CLI 使用的 client SDK
- `infra/docker`: 本地 Docker Compose 與 DB-first 流程設定

## 先決條件

- Node.js 22 LTS
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

`db:seed` 只會建立預設 dev user（`dev@agentj.local`），不會設定密碼也不會預先建立 PAT。
登入前需要先設定密碼：

```sh
pnpm --filter @agentj/contracts db:reset-password -- <email> <new-password>
```

PAT 請從 Web Dashboard 產生。

4. 分別啟動服務：

```sh
pnpm dev:web
pnpm dev:gateway
# 或同時啟動
pnpm dev:app
```

5. 開啟 Dashboard 並登入或註冊帳號：

`http://localhost:3000/login`

使用 seed user 登入（需先執行上方 `db:reset-password` 設定密碼），或直接在登入頁註冊新帳號。

6. 產生 PAT 並設定 CLI：

   1. 登入 Web Dashboard (`http://localhost:3000`)，進入 **PATs** 區塊，點擊產生新的 Personal Access Token（PAT）。
   2. Build CLI 並儲存 token：

   ```sh
   pnpm run build:cli
   pnpm run cli login --token <your-PAT>   # 或 pnpm run cli login <your-PAT>
   ```

   Token 會存到 `~/.agentj/config-dev.yml`（Dev 模式）。

   3. 驗證身份與開啟 tunnel：

   ```sh
   pnpm run cli whoami                     # 確認 token 有效
   pnpm run cli http 8080                  # 開啟 tunnel
   ```

`pnpm run cli` 會自動載入 `.env`（指向 localhost），與 production 環境隔離。

Web Dashboard 的 **PATs** 區塊可查看/產生/撤銷 PAT。
`http` 命令會自動建立 tunnel，不需要額外資源參數。
本機直接跑 `web + gateway`（未經 Caddy）時，公開網址預設為 `http://<subdomain>.tunnel.localhost:4000`。

## LINE Bot 快速流程

CLI 一鍵初始化 LINE webhook 託管（建立 tunnel + 設定 channel + sync/test webhook + 啟動 agent）：

```sh
pnpm run cli line init 8080
```

## OpenAPI / Swagger 更新

修改 `packages/contracts/src/api/openapi.json` 後，Swagger 不會直接讀 source 檔，而是讀 `@agentj/contracts` build 後的輸出。

請在修改後執行：

```sh
pnpm --filter @agentj/contracts build
```

若 `apps/web` dev server 已在跑，重啟一次並重新整理 `/docs`（建議 hard refresh）。

## Tunnel 404 troubleshooting

`http://<subdomain>.tunnel.localhost:4000` 在本機直跑模式是有效網址。  
如果遇到 404，先用 CLI logs 判斷 404 來源：

```sh
pnpm run cli logs <tunnelId> --follow
```

- Gateway 回 `TUNNEL_NOT_FOUND`（或沒有看到請求）：
  - 檢查 `web` 與 `gateway` 是否連到同一個 `DATABASE_URL`
  - 檢查 `AGENTJ_TUNNEL_BASE_DOMAIN` 是否一致（都應為 `tunnel.localhost`）
  - 檢查 `AGENTJ_CONNECT_TOKEN_SECRET` 與 `AGENTJ_GATEWAY_WS_PUBLIC_URL` 是否一致
- Agent 連線被關閉 `4408`（hello timeout）：
  - 檢查 agent 是否有在連線後立即送出 `agent_hello`
  - 需要時可調整 `AGENTJ_AGENT_HELLO_TIMEOUT_MS`（預設 `10000`）
- Agent 連線被關閉 `4411`（heartbeat timeout）：
  - 檢查網路品質與是否有封包丟失導致 `pong` 回覆中斷
  - 可調整 `AGENTJ_AGENT_PING_INTERVAL_MS`、`AGENTJ_AGENT_MAX_MISSED_PONGS`
  - 高負載時可調整 `AGENTJ_WS_SEND_HIGH_WATERMARK_BYTES`
- Ingress 回 `TUNNEL_RECONNECTING`（HTTP 503）：
  - 代表 agent 剛斷線且仍在重連寬限期
  - 可調整 `AGENTJ_AGENT_RECONNECT_GRACE_MS`（預設 `5000`）
- Ingress 回 `TUNNEL_BUSY`（HTTP 503）或 Public WS close `4429`：
  - 代表 tunnel 正在被過多併發請求打滿，gateway 啟用保護機制
  - 可調整 `AGENTJ_MAX_ACTIVE_STREAMS_PER_TUNNEL`（預設 `128`）
  - 可調整 `AGENTJ_MAX_ACTIVE_STREAMS_GLOBAL`（預設 `4096`）
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

## CLI 發佈到 npm

CLI 以 `agentj-cli` 發佈到 npm，使用 tsup 將 `@agentj/contracts` 和 `@agentj/sdk` 打包成單一 bundle。

```sh
cd packages/cli
npm version patch          # 更新版本號（patch / minor / major）
npm publish                # prepublishOnly 會自動跑 tsup
```

使用者安裝後可直接使用：

```sh
npx agentj-cli login
npx agentj-cli http 8080
```

### Dev vs Production CLI

| 模式       | 指令             | Config 路徑                | 連到            |
| ---------- | ---------------- | -------------------------- | --------------- |
| Dev        | `pnpm run cli`   | `~/.agentj/config-dev.yml` | localhost       |
| Production | `npx agentj-cli` | `~/.agentj/config.yml`     | app.example.com |

Dev 模式透過 `.env` 中的環境變數覆蓋預設值（API URL、gateway URL、config file path），與 production 完全隔離。

## 存取網址

- Dashboard: `http://localhost:3000`
- Control API base: `http://localhost:3000/api/v1`
- Gateway WS endpoint: `ws://localhost:4000/agent/v1/connect`
- Tunnel 公開網址: `http://<subdomain>.tunnel.localhost:4000`

## Production Deployment (GCP)

- 完整流程與範本：[`docs/deployment-gcp-production.md`](docs/deployment-gcp-production.md)
- MVP 一鍵安裝腳本：`bash scripts/deploy/gce-onevm-install.sh --help`

### 重新部署

```sh
# 1. 本地 commit + push
git add -A && git commit -m "your message"
git push

# 2. SSH 到 VM
ssh <user>@<vm-ip>
cd agentj
git pull

# 3. 重新 build + restart（跳過 Docker 安裝）
bash scripts/deploy/gce-onevm-install.sh \
  --app-domain app.example.com \
  --gateway-domain gateway.example.com \
  --tunnel-base-domain tunnel.example.com \
  --connect-token-secret <your-secret> \
  --skip-docker-install
```

## 其他文件

- Docker 細節：`infra/docker/README.md`
