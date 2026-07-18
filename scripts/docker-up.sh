#!/usr/bin/env bash
# Start PSSMS full stack in Docker Desktop (infra + backend + frontend portals)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT/infra/docker/docker-compose.yml"

cd "$ROOT"

echo "==> Building and starting Docker stack (infra + backend + frontend)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ROOT/.env" up -d --build

echo ""
echo "==> Waiting for core-api..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:4001/api/v1/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "==> Waiting for admin-web..."
for i in $(seq 1 90); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo ""
echo "==> Stack ready (Docker Desktop)"
echo ""
echo "  Frontend portals"
echo "  admin-web:            http://localhost:3000   (login → Ops Console /operations)"
echo "  executive-web:        http://localhost:3001"
echo "  customer-web:         http://localhost:3002"
echo "  supplier-web:         http://localhost:3003"
echo "  recruitment-web:      http://localhost:3004"
echo "  visitor-web:          http://localhost:3005"
echo "  parking-web:          http://localhost:3006"
echo ""
echo "  Backend APIs"
echo "  core-api:             http://localhost:4001/docs"
echo "  reporting-service:    http://localhost:4005/docs"
echo "  background-worker:    http://localhost:4002/health"
echo "  integration-gateway:  http://localhost:4003/docs"
echo "  realtime-gateway:     http://localhost:4004/api/v1/health"
echo "  vision-ai-service:    http://localhost:8000/health"
echo "  analytics-ai-service: http://localhost:8001/health"
echo ""
echo "  Infra UIs"
echo "  Keycloak:             http://localhost:8080"
echo "  RabbitMQ:             http://localhost:15672"
echo "  MinIO:                http://localhost:9001"
echo "  Grafana:              http://localhost:3300"
echo ""
echo "  Login (seed): admin@highlink.co.tz / ChangeMe123!"
echo ""
echo "Status: docker compose -f infra/docker/docker-compose.yml ps"
echo "Logs:   docker compose -f infra/docker/docker-compose.yml logs -f admin-web"
echo "Stop:   docker compose -f infra/docker/docker-compose.yml down"
