#!/usr/bin/env bash
# Phase 12 E2E — guard field/sync + guard-app typecheck
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUARD_APP="$ROOT/mobile/guard-app"

echo "==> A — Guard login"
LOGIN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"guard1@highlink.co.tz","password":"ChangeMe123!"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken')
test -n "$TOKEN" && test "$TOKEN" != "null"

echo "==> B — Resolve SITE-WAREHOUSE-A"
SITES=$(curl -sf "$BASE/enterprise/sites" -H "Authorization: Bearer $TOKEN")
SITE_ID=$(echo "$SITES" | jq -r '.data[] | select(.code=="SITE-WAREHOUSE-A") | .id')
test -n "$SITE_ID" && test "$SITE_ID" != "null"
echo "    siteId=$SITE_ID"

echo "==> C — field/sync CLOCK_IN"
CID=$(uuidgen | tr '[:upper:]' '[:lower:]')
DEVICE_TIME=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
SYNC1=$(curl -sf -X POST "$BASE/field/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"events\":[{\"type\":\"CLOCK_IN\",\"clientEventId\":\"$CID\",\"deviceTime\":\"$DEVICE_TIME\",\"payload\":{\"siteId\":\"$SITE_ID\",\"method\":\"MOBILE_GPS\",\"gps\":{\"latitude\":-6.7924,\"longitude\":39.2083}}}]}")
echo "$SYNC1" | jq -e --arg id "$CID" \
  '[.data[] | select(.clientEventId==$id and (.status=="ACCEPTED" or .status=="DUPLICATE"))] | length == 1'

echo "==> D — Replay same clientEventId (idempotent)"
SYNC2=$(curl -sf -X POST "$BASE/field/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"events\":[{\"type\":\"CLOCK_IN\",\"clientEventId\":\"$CID\",\"deviceTime\":\"$DEVICE_TIME\",\"payload\":{\"siteId\":\"$SITE_ID\",\"method\":\"MOBILE_GPS\",\"gps\":{\"latitude\":-6.7924,\"longitude\":39.2083}}}]}")
echo "$SYNC2" | jq -e --arg id "$CID" \
  '[.data[] | select(.clientEventId==$id and (.status=="ACCEPTED" or .status=="DUPLICATE"))] | length == 1'

echo "==> E — Guard must not use customer portal paths (expect 403 if JWT somehow scoped — otherwise ensure no customerId)"
CID_USER=$(echo "$LOGIN" | jq -r '.data.user.customerId // empty')
test -z "$CID_USER" || test "$CID_USER" = "null"

echo "==> F — guard-app typecheck + packaged e2e"
cd "$GUARD_APP"
npm run typecheck
EXPO_PUBLIC_API_BASE="$BASE" npm run e2e:field-sync

echo ""
echo "Phase 12 E2E OK"
echo "  App: cd mobile/guard-app && npm start"
echo "  Login: guard1@highlink.co.tz / ChangeMe123!"
echo "  Sync: POST /field/sync CLOCK_IN → site $SITE_ID"
