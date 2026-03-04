# Agentj One-VM Deployment (All-in-One Docker)

一台 VM 跑 `postgres + web + gateway + caddy`，用一支 script 完成安裝與啟動。
適合快速建置、測試 tunnel 穩定性。

## 1. 拓樸

```text
Internet
  └─ VM:80/443 (Caddy, auto HTTPS via HTTP-01)
      ├─ https://APP_DOMAIN                -> web:3000
      ├─ https://GATEWAY_DOMAIN            -> gateway:4000
      └─ https://*.TUNNEL_BASE_DOMAIN      -> gateway:4000

web/gateway/migrate -> postgres:5432 (Docker container)
```

## 2. 前提條件

- 一台 VM（任何雲平台或實體機），建議至少 2 vCPU / 4 GB RAM
- Ubuntu 22.04+ 或 Debian 12+（deploy script 用 apt 安裝 Docker）
- 三個域名（或子網域）指向 VM 的公網 IP：
  - `APP_DOMAIN`（例如 `app.example.com`）
  - `GATEWAY_DOMAIN`（例如 `gateway.example.com`）
  - `*.TUNNEL_BASE_DOMAIN`（例如 `*.tunnel.example.com`）
- Port 80 和 443 對外開放（Caddy 需要 80 做 HTTP-01 challenge）

## 3. 部署參數

| 參數 | 說明 |
| --- | --- |
| `--app-domain` | Web 網域 |
| `--gateway-domain` | Gateway 網域 |
| `--tunnel-base-domain` | Tunnel 基底網域 |
| `--connect-token-secret` | Web/Gateway 共用 secret（至少 16 字元） |
| `--db-password` | PostgreSQL 密碼（省略則自動生成） |
| `--image-tag` | Docker image tag（預設 `local`） |
| `--skip-docker-install` | 跳過 Docker 安裝（已裝好時使用） |

## 4. 一鍵部署

```bash
git clone <your-repo-url> /opt/agentj
cd /opt/agentj

bash scripts/deploy/gce-onevm-install.sh \
  --app-domain "app.example.com" \
  --gateway-domain "gateway.example.com" \
  --tunnel-base-domain "tunnel.example.com" \
  --connect-token-secret "<at-least-16-chars>"
```

Script 會自動：
1. 安裝 Docker + Compose plugin（可用 `--skip-docker-install` 跳過）
2. 產生 `infra/docker/.env.prod`（含自動生成的 DB 密碼）
3. Build image
4. 啟動 PostgreSQL 並執行 migration
5. 啟動 web / gateway / caddy

## 5. 驗收

```bash
curl -fsS "https://<APP_DOMAIN>/api/v1/healthz"
curl -fsS "https://<GATEWAY_DOMAIN>/healthz"
```

預期都包含 `{"ok":true}`。

端到端檢查：
1. 從 dashboard 建立 PAT
2. CLI 執行 `aj http 8080`
3. 存取 `https://<subdomain>.<TUNNEL_BASE_DOMAIN>`

## 6. 更新與重部署

```bash
cd /opt/agentj
git pull

bash scripts/deploy/gce-onevm-install.sh \
  --app-domain "app.example.com" \
  --gateway-domain "gateway.example.com" \
  --tunnel-base-domain "tunnel.example.com" \
  --connect-token-secret "<same-secret>" \
  --db-password "<same-db-password>" \
  --skip-docker-install
```

> 重部署時請傳入相同的 `--db-password`，否則會產生新密碼導致連線失敗。
> 首次部署若省略密碼，script 會印出自動生成的密碼，請記錄下來。

## 7. 常見故障排查

```bash
cd /opt/agentj
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml ps
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs postgres --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs caddy --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs gateway --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs web --tail=200
```

排查重點：
- DB 連線：確認 postgres container 健康、密碼正確
- TLS 憑證：Caddy 用 HTTP-01 challenge，確保 port 80 對外開放且域名正確指向 VM IP
- Gateway WS：`AGENTJ_CONNECT_TOKEN_SECRET` web/gateway 必須一致

## 8. 注意事項

- 資料庫資料存在 Docker volume `postgres_data`，刪除 volume 會遺失資料
- 目前 `/api/v1/pats*` 仍是 MVP 設計，沒有正式登入保護。建議至少加網路層限制（公司 IP / VPN）
- Wildcard subdomain（`*.TUNNEL_BASE_DOMAIN`）的 TLS 使用 Caddy on-demand TLS，首次存取會有短暫延遲
