#!/usr/bin/env bash
# Careful sequential production deploy for small VPS (~2Gi).
# - No seed
# - One image build at a time + prune
# - Migrate before restarting API
set -euo pipefail

ROOT=/home/sky/security-consule
C="docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod"
L=/home/sky/deploy-$(date +%Y-%m-%d-%H%M).log
EXPECTED_MSG_FRAGMENT='0057'

cd "$ROOT"
exec >"$L" 2>&1

echo "START $(date -u)"
echo "LOG $L"
free -h | head -2
df -h / | head -2

echo "==== GIT PULL $(date -u) ===="
git fetch origin
git checkout main
git pull --ff-only origin main
echo "HEAD $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
if ! git show HEAD:infra/docker/docker-compose.prod.yml | grep -q '0057_purchase_requests_inventory'; then
  echo "FATAL: compose missing 0057 migration list"
  exit 1
fi

echo "==== PREFLIGHT $(date -u) ===="
docker ps --format 'table {{.Names}}\t{{.Status}}' || true
docker image prune -f >/dev/null || true

echo "==== MIGRATE BUILD $(date -u) ===="
$C build db-migrate
echo "==== MIGRATE RUN (NO SEED) $(date -u) ===="
PSSMS_RUN_SEED=false $C run --rm --no-deps db-migrate
echo "MIGRATE_OK $(date -u)"

echo "==== CORE-API $(date -u) ===="
$C build core-api
$C up -d --no-deps core-api
sleep 10
docker image prune -f >/dev/null || true
free -h | head -2

echo "==== REPORTING $(date -u) ===="
$C build reporting-service
$C up -d --no-deps reporting-service
sleep 5
docker image prune -f >/dev/null || true

for a in admin-web customer-web supplier-web parking-web recruitment-web executive-web visitor-web; do
  echo "==== BUILD $a $(date -u) ===="
  $C build "$a"
  $C up -d --no-deps "$a"
  sleep 5
  docker image prune -f >/dev/null || true
  free -h | head -2
done

echo "==== HEALTH $(date -u) ===="
sleep 10
docker ps --format 'table {{.Names}}\t{{.Status}}'
for u in \
  https://api.hisgc.co.tz/api/v1/health \
  https://web.hisgc.co.tz/login \
  https://customer.hisgc.co.tz/login \
  https://supplier.hisgc.co.tz/login \
  https://parking.hisgc.co.tz/login \
  https://recruitment.hisgc.co.tz/ \
  https://executive.hisgc.co.tz/login \
  https://visitor.hisgc.co.tz/
do
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 30 "$u" || echo ERR)
  echo "$code $u"
done

echo "DONE $(date -u)"
echo "LOG $L"
