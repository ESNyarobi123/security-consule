#!/usr/bin/env bash
# Start PSSMS full stack in Docker Desktop (infra + backend + frontend portals)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"
ENV_FILE="$ROOT/.env"

cd "$ROOT"

# shellcheck disable=SC1090
set -a
# Defaults if .env omits host remaps
ADMIN_WEB_HOST_PORT=3000
CORE_API_HOST_PORT=4001
BACKGROUND_WORKER_HOST_PORT=4002
POSTGRES_HOST_PORT=5433
KEYCLOAK_HOST_PORT=8080
EXECUTIVE_WEB_PORT=3011
REPORTING_SERVICE_PORT=4005
source "$ENV_FILE"
set +a

echo "==> Building and starting Docker stack (infra + backend + frontend)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo ""
echo "==> Waiting for core-api on :${CORE_API_HOST_PORT}..."
for i in $(seq 1 120); do
  if curl -sf "http://localhost:${CORE_API_HOST_PORT}/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "==> Waiting for admin-web on :${ADMIN_WEB_HOST_PORT}..."
for i in $(seq 1 90); do
  if curl -sf "http://localhost:${ADMIN_WEB_HOST_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "==> Stack ready (Docker Desktop)"
echo ""
echo "  Frontend portals"
echo "  admin-web:            http://localhost:${ADMIN_WEB_HOST_PORT}"
echo "  Branch Ops:           http://localhost:${ADMIN_WEB_HOST_PORT}/branch"
echo "  executive-web:        http://localhost:${EXECUTIVE_WEB_PORT:-3011}"
echo "  customer-web:         http://localhost:3002"
echo "  supplier-web:         http://localhost:3003"
echo "  recruitment-web:      http://localhost:3004"
echo "  visitor-web:          http://localhost:3005"
echo "  parking-web:          http://localhost:3006"
echo ""
echo "  Backend APIs"
echo "  core-api:             http://localhost:${CORE_API_HOST_PORT}/docs"
echo "  core-api health:      http://localhost:${CORE_API_HOST_PORT}/api/v1/health"
echo "  reporting-service:    http://localhost:${REPORTING_SERVICE_PORT:-4005}/docs"
echo "  background-worker:    http://localhost:${BACKGROUND_WORKER_HOST_PORT}/health"
echo "  integration-gateway:  http://localhost:4003/docs"
echo "  realtime-gateway:     http://localhost:4004/api/v1/health"
echo "  vision-ai-service:    http://localhost:8000/health"
echo "  analytics-ai-service: http://localhost:8001/health"
echo ""
echo "  Infra UIs"
echo "  Keycloak:             http://localhost:${KEYCLOAK_HOST_PORT}"
echo "  RabbitMQ:             http://localhost:15672  (pssms / from .env)"
echo "  MinIO console:        http://localhost:9011"
echo "  Postgres (host):      localhost:${POSTGRES_HOST_PORT}"
echo "  Redis (host):         localhost:6381"
echo "  Grafana:              http://localhost:3300"
echo ""
echo "  Demo accounts (password: ChangeMe123!)"
echo "  admin@highlink.co.tz       SUPER_ADMIN"
echo "  supervisor1@highlink.co.tz Branch Ops"
echo "  ceo@highlink.co.tz         Executive :${EXECUTIVE_WEB_PORT:-3011}"
echo "  portal@demo-mfg.co.tz      customer-web :3002"
echo ""
echo "Status: docker compose -f infra/docker/docker-compose.yml --env-file .env ps"
echo "Logs:   docker compose -f infra/docker/docker-compose.yml --env-file .env logs -f admin-web"
echo "Stop:   docker compose -f infra/docker/docker-compose.yml --env-file .env down"
