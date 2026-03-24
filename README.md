# AgentJ

[AgentJ](https://aj.savy.tw) 是一個 tunnel 服務，讓你將本地 HTTP server 暴露到公開網址，並提供 LINE Bot webhook 一鍵託管。

適用情境：

- 本地開發時需要公開 HTTPS 網址（給第三方 webhook 回呼）
- 快速建立 LINE Bot 並自動設定 webhook
- 不想自己管 ngrok / Cloudflare Tunnel 等服務

---

## 安裝

```sh
npm install -g agentj-cli
```

或直接使用 npx：

```sh
npx agentj-cli <command>
```

---

## CLI 使用教學

### 1. 快速建立 LINE Bot

不需要註冊帳號，直接開始：

```sh
agentj line init 8080
```

CLI 會自動建立匿名帳號，並依序詢問 Channel ID、Channel Secret、Channel Access Token，完成後自動建立 tunnel、設定 webhook、開始轉發。

> 第一次使用需要從 LINE Developers Console 取得上述三個值，詳見下方「[LINE Bot 整合](#line-bot-整合)」章節。

**下次啟動：** 不需要重新輸入憑證。先查看已建立的 channels，再重新連線：

```sh
agentj line status                     # 列出所有 channels
agentj line connect                    # 自動選擇（僅一個 channel 時）
agentj line connect my-channel         # 指定 channel name
agentj line connect my-channel 8080    # 覆寫本地 port
```

### 2. 開啟 Tunnel（通用）

如果只需要將本地 port 暴露到公開 HTTPS 網址（不綁定 LINE Bot）：

```sh
agentj http 8080
# Tunnel: tun_xxxx
# Forwarding: https://abc123.tunnel.savy.tw -> http://127.0.0.1:8080
```

打開輸出的網址，即可從外部存取你本地的服務。

### 3. 管理 Tunnel

```sh
agentj tunnel ls           # 列出所有 tunnels
agentj tunnel stop <id>    # 停止 tunnel
agentj logs <id> --follow  # 即時查看請求 logs
```

### 4. 登入（解鎖更多功能）

匿名帳號限制同時 1 條 tunnel 連線。註冊登入後可使用多條 tunnel 及完整功能。

從 [AgentJ Dashboard](https://aj.savy.tw) 註冊登入，進入個人設定頁面取得 **Personal Access Token（PAT）**，然後執行：

```sh
agentj login <your-PAT>
agentj whoami              # 確認登入成功
```

---

## LINE Bot 整合

AgentJ 可以一鍵完成 LINE Bot 的 webhook 設定，省去手動到 LINE Developers Console 貼 webhook URL 的步驟。

### 事前準備：從 LINE Developers Console 取得 Bot 資訊

你需要取得三個值：**Channel ID**、**Channel Secret**、**Channel Access Token**。

#### Step 1：登入 LINE Developers Console

前往 [LINE Developers Console](https://developers.line.biz/console/) 並登入你的 LINE 帳號。

#### Step 2：建立 Provider

如果你還沒有 Provider：

1. 點擊首頁的 **Create** 按鈕
2. 輸入 Provider 名稱（例如你的公司名或專案名）
3. 點擊 **Create**

如果已有 Provider，直接點擊進入。

#### Step 3：建立 Messaging API Channel

1. 在 Provider 頁面點擊 **Create a new channel**
2. 選擇 **Messaging API**
3. 填寫必要資訊：
   - **Channel name**：Bot 的顯示名稱
   - **Channel description**：Bot 的描述
   - **Category** / **Subcategory**：選擇與你的服務最相關的分類
4. 勾選同意條款，點擊 **Create**

#### Step 4：取得 Channel ID 和 Channel Secret

1. 進入剛建立的 Channel 頁面
2. 切換到 **Basic settings** 頁籤
3. 找到並複製以下兩個值：

| 欄位               | 位置                                        |
| ------------------ | ------------------------------------------- |
| **Channel ID**     | Basic settings 頁面上方，一串數字           |
| **Channel Secret** | Basic settings 頁面中段，點擊眼睛圖示可顯示 |

#### Step 5：取得 Channel Access Token

1. 切換到 **Messaging API** 頁籤
2. 捲到最下方找到 **Channel access token (long-lived)**
3. 點擊 **Issue** 按鈕產生 token
4. 複製產生的 token（這串很長，請完整複製）

> 注意：Channel Access Token 產生後請妥善保存。如果遺失可以重新 Issue，但舊的 token 會失效。

### 首次設定

取得上述三個值後，一鍵建立 tunnel + 設定 LINE channel + 同步 webhook + 啟動連線：

```sh
agentj line init 8080
```

CLI 會依序詢問 Channel ID、Channel Secret、Channel Access Token，設定完成後自動開始轉發。

### 重新連線

下次啟動時不需重新輸入憑證，直接連線：

```sh
agentj line connect                    # 自動選擇（僅一個 channel 時）
agentj line connect my-channel         # 指定 channel name
agentj line connect 1653935138         # 指定 LINE Channel ID
agentj line connect my-channel 8080    # 覆寫本地 port
```

### 查看狀態

```sh
agentj line status                     # 列出所有 channels
agentj line status my-channel          # 查看特定 channel 詳情
```

### 同步 Webhook

`line connect` 預設會自動同步 webhook。需要手動同步時：

```sh
agentj line webhook sync               # 自動選擇 channel
agentj line webhook sync my-channel    # 指定 channel
```

### 發送訊息

透過 control plane 發送 LINE 訊息（不需經過 tunnel）：

```sh
agentj line send my-channel push --body '{"to":"USER_ID","messages":[{"type":"text","text":"Hello!"}]}'
agentj line send my-channel broadcast --body '{"messages":[{"type":"text","text":"Hi everyone!"}]}'
```

支援的訊息類型：`reply`、`push`、`multicast`、`broadcast`。

> 所有 LINE 子指令皆接受 channel name、LINE Channel ID、或內部 ID 作為識別。

---

## 範例：LINE Echo Bot

`examples/line-echo-bot` 是一個最小的 LINE Echo Bot，收到文字訊息後原樣回覆。

```sh
cd examples/line-echo-bot
cp .env.example .env
# 填入 LINE_CHANNEL_SECRET 和 LINE_CHANNEL_ACCESS_TOKEN
npm install
npm run dev                # 啟動在 port 8080
```

另開終端機：

```sh
agentj line init 8080     # 首次設定
# 或
agentj line connect       # 之後重新連線
```

---

## 開發

以下為本地開發 AgentJ 平台本身的說明，適用於貢獻者。

### 專案結構

- `apps/web`: Next.js dashboard + API routes
- `apps/tunnel-gateway`: Fastify + WebSocket gateway（給 tunnel agents）
- `packages/cli`: Oclif CLI（npm: `agentj-cli`）
- `packages/contracts`: 共用 DB/Auth/API contracts
- `packages/sdk`: CLI 使用的 client SDK
- `infra/docker`: 本地 Docker Compose 與 DB-first 流程設定

### 先決條件

- Node.js 22 LTS
- pnpm 10+
- PostgreSQL 16+

### 本地環境設定

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

3. 啟動 PostgreSQL 並初始化資料庫：

```sh
pnpm db:docker:up
pnpm db:migrate
pnpm db:seed
```

`db:seed` 建立預設 dev user（`dev@agentj.local`），登入前需先設定密碼：

```sh
pnpm --filter @agentj/contracts db:reset-password -- <email> <new-password>
```

4. 啟動服務：

```sh
pnpm dev:web
pnpm dev:gateway
# 或同時啟動
pnpm dev:app
```

5. 開啟 `http://localhost:3000/login` 登入，從 Dashboard 產生 PAT。

6. Build CLI 並登入：

```sh
pnpm run build:cli
pnpm run cli login --token <your-PAT>
pnpm run cli whoami
pnpm run cli http 8080
```

### Dev vs Production CLI

| 模式       | 指令             | Config 路徑                | 連到           |
| ---------- | ---------------- | -------------------------- | -------------- |
| Dev        | `pnpm run cli`   | `~/.agentj/config-dev.yml` | localhost      |
| Production | `npx agentj-cli` | `~/.agentj/config.yml`     | aj.example.com |

Dev 模式透過 `.env` 中的環境變數覆蓋預設值，與 production 完全隔離。

### 存取網址

- Dashboard: `http://localhost:3000`
- Control API: `http://localhost:3000/api/v1`
- Gateway WS: `ws://localhost:4000/agent/v1/connect`
- Tunnel 公開網址: `http://<subdomain>.tunnel.localhost:4000`

### OpenAPI / Swagger 更新

修改 `packages/contracts/src/api/openapi.json` 後執行：

```sh
pnpm --filter @agentj/contracts build
```

若 dev server 已在跑，重啟並 hard refresh `/docs`。

### Tunnel 404 Troubleshooting

先用 CLI logs 判斷 404 來源：

```sh
pnpm run cli logs <tunnelId> --follow
```

- `TUNNEL_NOT_FOUND`：檢查 `DATABASE_URL`、`AGENTJ_TUNNEL_BASE_DOMAIN`、`AGENTJ_CONNECT_TOKEN_SECRET` 是否一致
- Close `4408`（hello timeout）：agent 沒有及時送出 `agent_hello`，可調整 `AGENTJ_AGENT_HELLO_TIMEOUT_MS`
- Close `4411`（heartbeat timeout）：可調整 `AGENTJ_AGENT_PING_INTERVAL_MS`、`AGENTJ_AGENT_MAX_MISSED_PONGS`
- `TUNNEL_RECONNECTING`（503）：agent 斷線重連中，可調整 `AGENTJ_AGENT_RECONNECT_GRACE_MS`
- `TUNNEL_BUSY`（503）：併發請求過多，可調整 `AGENTJ_MAX_ACTIVE_STREAMS_PER_TUNNEL`
- 請求狀態 `404`：404 來自本地 app 路由，非 tunnel 問題

### Docker（Database-first）

```sh
pnpm db:docker:up           # 啟動 PostgreSQL
pnpm db:docker:bootstrap    # 初始化 schema + seed

# 重建 DB
pnpm db:docker:reset
pnpm db:docker:up
pnpm db:docker:bootstrap
```

### CLI 發佈到 npm

```sh
cd packages/cli
npm version patch
npm publish
```

### Production Deployment (GCP)

- 完整流程：[`docs/deployment-gcp-production.md`](docs/deployment-gcp-production.md)
- 一鍵安裝：`bash scripts/deploy/gce-onevm-install.sh --help`

重新部署：

```sh
git push
ssh <user>@<vm-ip>
cd agentj && git pull
bash scripts/deploy/gce-onevm-install.sh \
  --app-domain aj.example.com \
  --gateway-domain gateway.example.com \
  --tunnel-base-domain tunnel.example.com \
  --connect-token-secret <your-secret> \
  --skip-docker-install
```
