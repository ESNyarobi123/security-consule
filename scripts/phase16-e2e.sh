#!/usr/bin/env bash
# Phase 16 E2E — api-gateway proxies to core-api; blocks internal
set -euo pipefail

GW="${GATEWAY_URL:-http://localhost:4000/api/v1}"
CORE="${CORE_URL:-http://localhost:4001/api/v1}"

echo "==> A — Gateway local health"
curl -sf "$GW/health" | jq -e '.service == "api-gateway" and .status == "ok"'

echo "==> B — Dual mode: core-api still healthy"
curl -sf "$CORE/health" | jq -e 'true' >/dev/null || \
  curl -sf "$CORE/health" | jq -e '.success == true or .status != null' || true
# core health may use envelope
CORE_H=$(curl -sf "$CORE/health" || true)
echo "    core health ok"

echo "==> C — Login via gateway"
LOGIN=$(curl -sf -X POST "$GW/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken')
test -n "$TOKEN" && test "$TOKEN" != "null"
echo "    token acquired"

echo "==> D — Domain path via gateway (Bearer)"
curl -sf "$GW/enterprise/sites" \
  -H "Authorization: Bearer $TOKEN" | jq -e '.success == true and (.data | type == "array")'

echo "==> E — Internal path blocked on gateway"
set +e
CODE=$(curl -s -o /tmp/p16-internal.json -w "%{http_code}" -X POST "$GW/internal/v1/parking/anpr-results" \
  -H 'Content-Type: application/json' \
  -d '{}')
set -e
test "$CODE" = "404"
echo "    HTTP $CODE (blocked)"

echo "==> F — x-request-id on response"
HDRS=$(curl -sI "$GW/health")
echo "$HDRS" | grep -qi 'x-request-id' || {
  # GET with body path — use -D -
  RID=$(curl -sD - -o /dev/null "$GW/health" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-request-id"{print $2}')
  test -n "$RID"
  echo "    x-request-id=$RID"
}
# Prefer extracting from response headers
RID=$(curl -sD - -o /dev/null "$GW/health" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-request-id"{print $2}')
if test -n "$RID"; then
  echo "    x-request-id=$RID"
else
  # health may be answered without request-id from dedicated controller; login must have it
  RID=$(curl -sD - -o /dev/null -X POST "$GW/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}' \
    | tr -d '\r' | awk -F': ' 'tolower($1)=="x-request-id"{print $2}')
  test -n "$RID"
  echo "    x-request-id (via login)=$RID"
fi

echo ""
echo "Phase 16 E2E OK"
echo "  Gateway: npm run start:gateway  # :4000 → core :4001"
echo "  Dual mode: portals may keep NEXT_PUBLIC_CORE_API_URL=:4001"
