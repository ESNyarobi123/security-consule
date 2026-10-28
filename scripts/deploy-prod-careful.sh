#!/usr/bin/env bash
# Careful sequential production deploy for a small VPS (~2 GiB RAM, no swap by default).
#
# Why this exists: `docker compose up --build a b c` hands the work to BuildKit
# bake, which builds every requested image CONCURRENTLY. On a 2 GiB box that
# needs ~3-4 GiB, so the kernel OOM killer fires, the build dies with
# `failed to execute bake: signal: killed`, and unrelated live containers get
# stopped along the way. This script therefore:
#   - refuses to start without swap (override with ALLOW_NO_SWAP=1)
#   - builds exactly one image at a time (COMPOSE_BAKE=false, parallel limit 1)
#   - pauses low-traffic portals and frees RAM before building, restores on exit
#   - restarts every service that shares the core-api image, not just core-api
#   - runs the migration job with seed OFF (live data is never re-seeded)
#
# Usage:  bash scripts/deploy-prod-careful.sh
#         ALLOW_NO_SWAP=1 bash scripts/deploy-prod-careful.sh
set -euo pipefail

ROOT=/home/sky/security-consule
COMPOSE_FILE=infra/docker/docker-compose.prod.yml
ENV_FILE=infra/docker/.env.prod
C="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"
L=/home/sky/deploy-$(date +%Y-%m-%d-%H%M).log

# Never let compose build more than one image concurrently.
export COMPOSE_BAKE=false
export COMPOSE_PARALLEL_LIMIT=1
export DOCKER_BUILDKIT=1

# Containers that are safe to stop while we build (customer-facing portals and
# the reporting worker). They are restored by the EXIT trap, success or failure.
PAUSE_CANDIDATES="pssms-customer-web pssms-supplier-web pssms-visitor-web pssms-recruitment-web pssms-parking-web pssms-executive-web pssms-reporting-service"
PAUSED=""

cd "$ROOT"
exec >"$L" 2>&1

log() { echo "[$(date -u +%H:%M:%S)] $*"; }

pause_low_priority() {
  for c in $PAUSE_CANDIDATES; do
    if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || echo false)" = "true" ]; then
      if docker stop "$c" >/dev/null 2>&1; then
        PAUSED="$PAUSED $c"
        log "paused $c"
      fi
    fi
  done
}

resume_low_priority() {
  for c in $PAUSED; do
    docker start "$c" >/dev/null 2>&1 || log "WARN: could not restart $c"
    log "resumed $c"
  done
  PAUSED=""
}
trap resume_low_priority EXIT

wait_http() {
  # wait_http <url> <expected> <attempts>
  local url=$1 expected=$2 attempts=${3:-30} code=''
  local i=1
  while [ "$i" -le "$attempts" ]; do
    code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || true)
    if [ "$code" = "$expected" ]; then
      log "OK $code $url"
      return 0
    fi
    sleep 3
    i=$((i + 1))
  done
  log "FAIL $code $url (wanted $expected)"
  return 1
}

log "START"
log "LOG $L"
free -m | head -2
df -h / | head -1

echo "==== PREFLIGHT ===="
if [ -z "$(tail -n +2 /proc/swaps)" ]; then
  log "WARN: no active swap (a 2 GiB box will OOM-kill a compose build and take live containers with it)"
  if [ "${ALLOW_NO_SWAP:-0}" != "1" ]; then
    cat <<'EOF'
FATAL: enable swap first, then re-run.

  # if /swapfile already exists (it may, just not enabled):
  sudo swapon /swapfile
  # if it does not exist yet:
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  # make it persistent
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  free -m

Without swap this script still works but must build one image at a time with the
portal containers paused. Force that path with:  ALLOW_NO_SWAP=1 bash $0
EOF
    exit 1
  fi
  pause_low_priority
else
  log "swap: $(tail -n +2 /proc/swaps | awk '{print $1" "$3}' | tr '\n' ' ')"
fi

echo "==== GIT PULL ===="
git fetch origin
git checkout main
git pull --ff-only origin main
log "HEAD $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
if ! git show HEAD:"$COMPOSE_FILE" | grep -q '0074_rbac_branch_hr_approvals'; then
  log "FATAL: compose is missing the 0074 migration in the db-migrate chain"
  exit 1
fi
git status --porcelain || true

echo "==== PRUNE ===="
docker ps --format 'table {{.Names}}\t{{.Status}}' || true
docker image prune -f >/dev/null || true
docker builder prune -f --filter until=24h >/dev/null 2>&1 || true

echo "==== MIGRATE ===="
$C build db-migrate
PSSMS_RUN_SEED=false $C run --rm --no-deps db-migrate
log "MIGRATE_OK"
docker image prune -f >/dev/null || true

echo "==== CORE-API (+ worker / gateway on the same image) ===="
$C build core-api
# integration-gateway and background-worker reuse pssms-core-api:prod, so they
# must be recreated too or they keep executing the previous release.
$C up -d --no-deps --force-recreate core-api integration-gateway background-worker
sleep 15
docker image prune -f >/dev/null || true
free -m | head -2
wait_http https://api.hisgc.co.tz/api/v1/health 200 40

echo "==== REPORTING ===="
$C build reporting-service
$C up -d --no-deps --force-recreate reporting-service
sleep 5
docker image prune -f >/dev/null || true

echo "==== PORTALS (one at a time) ===="
for a in admin-web customer-web supplier-web parking-web recruitment-web executive-web visitor-web; do
  log "build $a"
  $C build "$a"
  $C up -d --no-deps --force-recreate "$a"
  sleep 5
  docker image prune -f >/dev/null || true
  free -m | head -2
done

echo "==== HEALTH ===="
sleep 10
docker ps --format 'table {{.Names}}\t{{.Status}}'
RC=0
wait_http https://api.hisgc.co.tz/api/v1/health 200 20 || RC=1
wait_http https://web.hisgc.co.tz/login 200 20 || RC=1

echo "==== LOG SCAN ===="
for c in pssms-core-api pssms-background-worker pssms-integration-gateway; do
  hits=$(docker logs --since 15m "$c" 2>&1 | grep -icE 'ERROR|unhandled|exception' || true)
  log "$c error-ish log lines in last 15m: $hits"
done

log "HEAD=$(git rev-parse --short HEAD)"
if [ "$RC" -ne 0 ]; then
  log "DONE WITH FAILURES — see $L"
  exit 1
fi
log "DONE"
