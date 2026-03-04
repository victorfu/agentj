# Agentj MVP Deployment (Single GCE VM + One-Click Docker)

這份文件是最短上線路徑：一台 GCE VM 直接跑 `web + gateway + caddy + cloud-sql-proxy`，用一支 script 完成安裝與啟動。

## 1. 拓樸

```text
Internet
  └─ VM:80/443 (Caddy)
      ├─ https://APP_DOMAIN                -> web:3000
      ├─ https://GATEWAY_DOMAIN            -> gateway:4000
      └─ https://*.TUNNEL_BASE_DOMAIN      -> gateway:4000

web/gateway/migrate -> cloud-sql-proxy:5432 -> Cloud SQL (PostgreSQL)
```

## 2. 一鍵部署需要的變數

| 變數 | 說明 |
| --- | --- |
| `GCP_PROJECT_ID` | GCP 專案 ID（給 Caddy DNS challenge 用） |
| `INSTANCE_CONNECTION_NAME` | Cloud SQL 連線名稱（`project:region:instance`） |
| `DATABASE_URL` | 連線字串（host 必須是 `cloud-sql-proxy`） |
| `APP_DOMAIN` | Web 網域（例如 `app.example.com`） |
| `GATEWAY_DOMAIN` | Gateway 網域（例如 `gateway.example.com`） |
| `TUNNEL_BASE_DOMAIN` | Tunnel 基底網域（例如 `tunnel.example.com`） |
| `AGENTJ_CONNECT_TOKEN_SECRET` | Web/Gateway 共用 secret（至少 16 字元） |
| `IMAGE_TAG` | 本地映像 tag（預設 `local`，可選） |

`DATABASE_URL` 範例：

```text
postgresql://agentj:<db-password>@cloud-sql-proxy:5432/agentj?sslmode=disable
```

## 3. 一次性 GCP Bootstrap

### 3.1 啟用 API

```bash
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  dns.googleapis.com
```

### 3.2 建立 Cloud SQL（PostgreSQL）

```bash
gcloud sql instances create agentj-prod-sql \
  --database-version=POSTGRES_16 \
  --cpu=2 \
  --memory=4GiB \
  --region=<your-region>

gcloud sql databases create agentj --instance=agentj-prod-sql
gcloud sql users create agentj --instance=agentj-prod-sql --password="<strong-password>"
```

### 3.3 建立 VM Service Account 權限

```bash
gcloud iam service-accounts create agentj-prod-vm \
  --display-name="Agentj Prod VM SA"

for role in roles/cloudsql.client roles/dns.admin; do
  gcloud projects add-iam-policy-binding <your-project-id> \
    --member="serviceAccount:agentj-prod-vm@<your-project-id>.iam.gserviceaccount.com" \
    --role="$role"
done
```

### 3.4 建立 VM

```bash
gcloud compute instances create <vm-name> \
  --zone=<your-zone> \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --service-account="agentj-prod-vm@<your-project-id>.iam.gserviceaccount.com" \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=agentj-prod
```

開放 `80/443`：

```bash
gcloud compute firewall-rules create agentj-prod-ingress \
  --allow=tcp:80,tcp:443 \
  --direction=INGRESS \
  --target-tags=agentj-prod \
  --source-ranges=0.0.0.0/0
```

### 3.5 DNS 設定

把下列 A record 指向 VM 外網 IP：
- `APP_DOMAIN`
- `GATEWAY_DOMAIN`
- `*.TUNNEL_BASE_DOMAIN`

## 4. VM 一鍵安裝（重點）

在 VM 上執行：

```bash
git clone <your-repo-url> /opt/agentj
cd /opt/agentj

bash scripts/deploy/gce-onevm-install.sh \
  --gcp-project-id "<your-project-id>" \
  --instance-connection-name "<your-project-id>:<your-region>:agentj-prod-sql" \
  --database-url "postgresql://agentj:<db-password>@cloud-sql-proxy:5432/agentj?sslmode=disable" \
  --app-domain "app.example.com" \
  --gateway-domain "gateway.example.com" \
  --tunnel-base-domain "tunnel.example.com" \
  --connect-token-secret "<at-least-16-chars>"
```

這支 script 會做：
1. 安裝 Docker + Compose plugin（可用 `--skip-docker-install` 跳過）
2. 產生 `infra/docker/.env.prod`
3. build image（`infra/docker/docker-compose.onevm.yml`）
4. 執行 migration
5. 啟動 web/gateway/caddy/cloud-sql-proxy

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

在 VM 上更新程式後重跑同一支 script 即可：

```bash
cd /opt/agentj
git pull

bash scripts/deploy/gce-onevm-install.sh \
  --gcp-project-id "<your-project-id>" \
  --instance-connection-name "<your-project-id>:<your-region>:agentj-prod-sql" \
  --database-url "postgresql://agentj:<db-password>@cloud-sql-proxy:5432/agentj?sslmode=disable" \
  --app-domain "app.example.com" \
  --gateway-domain "gateway.example.com" \
  --tunnel-base-domain "tunnel.example.com" \
  --connect-token-secret "<at-least-16-chars>" \
  --skip-docker-install
```

## 7. 常見故障排查

```bash
cd /opt/agentj
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml ps
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs cloud-sql-proxy --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs caddy --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs gateway --tail=200
docker compose --env-file infra/docker/.env.prod -f infra/docker/docker-compose.onevm.yml logs web --tail=200
```

排查重點：
- Cloud SQL 連線：`INSTANCE_CONNECTION_NAME`、VM SA 的 `roles/cloudsql.client`
- Wildcard TLS：`GCP_PROJECT_ID`、VM SA 的 `roles/dns.admin`、DNS record 是否生效
- Gateway WS：`AGENTJ_CONNECT_TOKEN_SECRET`（web/gateway 必須一致）、`GATEWAY_DOMAIN` 是否正確

## 8. MVP 風險（已知）

目前 `/api/v1/pats*` 仍是 MVP 設計，沒有正式登入保護。  
公開上網會有 PAT 被未授權建立/操作的風險。建議至少加網路層限制（公司 IP / VPN）。

## 9. 參考

- Cloud SQL Auth Proxy (PostgreSQL): <https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy>
- Caddy wildcard certificate patterns: <https://caddyserver.com/docs/caddyfile/patterns>
- Caddy custom build with plugins: <https://caddyserver.com/docs/build>
