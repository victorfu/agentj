#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/infra/docker/.env.prod"
COMPOSE_FILE="${REPO_ROOT}/infra/docker/docker-compose.onevm.yml"

INSTALL_DOCKER=1
IMAGE_TAG="local"

GCP_PROJECT_ID=""
INSTANCE_CONNECTION_NAME=""
DATABASE_URL=""
APP_DOMAIN=""
GATEWAY_DOMAIN=""
TUNNEL_BASE_DOMAIN=""
AGENTJ_CONNECT_TOKEN_SECRET=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/deploy/gce-onevm-install.sh \
    --gcp-project-id <project-id> \
    --instance-connection-name <project:region:instance> \
    --database-url <postgresql://...> \
    --app-domain <app.example.com> \
    --gateway-domain <gateway.example.com> \
    --tunnel-base-domain <tunnel.example.com> \
    --connect-token-secret <strong-secret> \
    [--image-tag <tag>] \
    [--skip-docker-install]

Description:
  One-command setup for a single GCE VM:
  1) install Docker + Compose plugin (unless --skip-docker-install)
  2) generate infra/docker/.env.prod
  3) docker compose build + migrate + up
EOF
}

log() {
  printf '[gce-onevm] %s\n' "$*"
}

die() {
  printf '[gce-onevm] ERROR: %s\n' "$*" >&2
  exit 1
}

require_arg() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    die "Missing required argument: ${name}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gcp-project-id)
      GCP_PROJECT_ID="${2:-}"
      shift 2
      ;;
    --instance-connection-name)
      INSTANCE_CONNECTION_NAME="${2:-}"
      shift 2
      ;;
    --database-url)
      DATABASE_URL="${2:-}"
      shift 2
      ;;
    --app-domain)
      APP_DOMAIN="${2:-}"
      shift 2
      ;;
    --gateway-domain)
      GATEWAY_DOMAIN="${2:-}"
      shift 2
      ;;
    --tunnel-base-domain)
      TUNNEL_BASE_DOMAIN="${2:-}"
      shift 2
      ;;
    --connect-token-secret)
      AGENTJ_CONNECT_TOKEN_SECRET="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --skip-docker-install)
      INSTALL_DOCKER=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

require_arg "--gcp-project-id" "$GCP_PROJECT_ID"
require_arg "--instance-connection-name" "$INSTANCE_CONNECTION_NAME"
require_arg "--database-url" "$DATABASE_URL"
require_arg "--app-domain" "$APP_DOMAIN"
require_arg "--gateway-domain" "$GATEWAY_DOMAIN"
require_arg "--tunnel-base-domain" "$TUNNEL_BASE_DOMAIN"
require_arg "--connect-token-secret" "$AGENTJ_CONNECT_TOKEN_SECRET"

if [[ ${#AGENTJ_CONNECT_TOKEN_SECRET} -lt 16 ]]; then
  die "--connect-token-secret must be at least 16 characters"
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  die "Compose file not found: $COMPOSE_FILE"
fi

SUDO_CMD=(sudo)
if [[ "${EUID}" -eq 0 ]]; then
  SUDO_CMD=()
elif ! command -v sudo >/dev/null 2>&1; then
  die "sudo is required when running as non-root user"
fi

if [[ "$INSTALL_DOCKER" -eq 1 ]]; then
  log "Installing Docker and Compose plugin (Ubuntu/Debian via apt)"
  if ! command -v apt-get >/dev/null 2>&1; then
    die "apt-get not found. Re-run with --skip-docker-install and install Docker manually."
  fi

  "${SUDO_CMD[@]}" apt-get update
  "${SUDO_CMD[@]}" apt-get install -y docker.io docker-compose-plugin
  "${SUDO_CMD[@]}" systemctl enable docker
  "${SUDO_CMD[@]}" systemctl start docker
fi

DOCKER_CMD=(docker)
if ! docker info >/dev/null 2>&1; then
  DOCKER_CMD=("${SUDO_CMD[@]}" docker)
  if ! "${DOCKER_CMD[@]}" info >/dev/null 2>&1; then
    die "Docker daemon is not reachable."
  fi
fi

log "Writing ${ENV_FILE}"
cat >"$ENV_FILE" <<EOF
GCP_PROJECT_ID=${GCP_PROJECT_ID}
INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME}
DATABASE_URL=${DATABASE_URL}
APP_DOMAIN=${APP_DOMAIN}
GATEWAY_DOMAIN=${GATEWAY_DOMAIN}
TUNNEL_BASE_DOMAIN=${TUNNEL_BASE_DOMAIN}
AGENTJ_CONNECT_TOKEN_SECRET=${AGENTJ_CONNECT_TOKEN_SECRET}
IMAGE_TAG=${IMAGE_TAG}
EOF

log "Building images"
"${DOCKER_CMD[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build

log "Running database migration"
"${DOCKER_CMD[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrate

log "Starting services"
"${DOCKER_CMD[@]}" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

log "Done"
log "Web health: https://${APP_DOMAIN}/api/v1/healthz"
log "Gateway health: https://${GATEWAY_DOMAIN}/healthz"
