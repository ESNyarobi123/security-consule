#!/usr/bin/env bash
# Phase 15 E2E — parking ops (permits SoD + ANPR decide + violations)
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Parking officer login"
PARK=$(login "parking1@highlink.co.tz")
PARK_TOKEN=$(echo "$PARK" | jq -r '.data.tokens.accessToken')
test -n "$PARK_TOKEN" && test "$PARK_TOKEN" != "null"
echo "$PARK" | jq -e '.data.user.customerId == null or .data.user.customerId == ""'
ROLES=$(echo "$PARK" | jq -r '.data.user.roles | join(",")')
echo "    roles=$ROLES"

echo "==> B — Demo permit ACTIVE (PRM-DEMO-001)"
PERMITS=$(curl -sf "$BASE/parking/permits?status=ACTIVE" -H "Authorization: Bearer $PARK_TOKEN")
echo "$PERMITS" | jq -e '[.data[] | select(.permitNumber=="PRM-DEMO-001")] | length >= 1'

echo "==> C — Resolve SITE-WAREHOUSE-A"
SITES=$(curl -sf "$BASE/enterprise/sites" -H "Authorization: Bearer $PARK_TOKEN")
SITE_ID=$(echo "$SITES" | jq -r '.data[] | select(.code=="SITE-WAREHOUSE-A") | .id')
test -n "$SITE_ID" && test "$SITE_ID" != "null"

echo "==> D — Mock ANPR T123ABC → decide ALLOW → entry"
ANPR=$(curl -sf -X POST "$BASE/parking/anpr-results" \
  -H "Authorization: Bearer $PARK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"siteId\":\"$SITE_ID\",\"plateNumber\":\"T123ABC\",\"confidence\":0.97,\"cameraId\":\"CAM-DEMO\",\"imageUrl\":\"https://example.invalid/anpr/t123abc.jpg\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")
ANPR_ID=$(echo "$ANPR" | jq -r '.data.id')
curl -sf -X PATCH "$BASE/parking/anpr-results/$ANPR_ID/decide" \
  -H "Authorization: Bearer $PARK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"ALLOW"}' | jq -e '.data.decision == "ALLOW"'
ENTRIES=$(curl -sf "$BASE/parking/entries?siteId=$SITE_ID" -H "Authorization: Bearer $PARK_TOKEN")
echo "$ENTRIES" | jq -e '[.data[] | select(.plateNumber=="T123ABC" and .decision=="ALLOW")] | length >= 1'

echo "==> E — Unknown plate → DENY → violation"
ANPR2=$(curl -sf -X POST "$BASE/parking/anpr-results" \
  -H "Authorization: Bearer $PARK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"siteId\":\"$SITE_ID\",\"plateNumber\":\"ZZZ999\",\"confidence\":0.91,\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}")
ANPR2_ID=$(echo "$ANPR2" | jq -r '.data.id')
curl -sf -X PATCH "$BASE/parking/anpr-results/$ANPR2_ID/decide" \
  -H "Authorization: Bearer $PARK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"DENY","denyReason":"No permit"}' | jq -e '.data.decision == "DENY"'
VIOL=$(curl -sf "$BASE/parking/violations?siteId=$SITE_ID" -H "Authorization: Bearer $PARK_TOKEN")
echo "$VIOL" | jq -e '[.data[] | select(.plateNumber=="ZZZ999")] | length >= 1'

echo "==> F — Permit SoD: parking1 create PENDING; admin approve"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
VEH=$(curl -sf "$BASE/parking/vehicles" -H "Authorization: Bearer $PARK_TOKEN")
VEH_ID=$(echo "$VEH" | jq -r '.data[] | select(.plateNumber=="T123ABC") | .id')
PN="PRM-E2E-$(date +%s)"
NEW=$(curl -sf -X POST "$BASE/parking/permits" \
  -H "Authorization: Bearer $PARK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"vehicleId\":\"$VEH_ID\",\"siteId\":\"$SITE_ID\",\"permitNumber\":\"$PN\",\"permitType\":\"VISITOR\",\"validFrom\":\"$(date -u +%Y-%m-%dT00:00:00.000Z)\",\"validUntil\":\"$(date -u -v+30d +%Y-%m-%dT00:00:00.000Z 2>/dev/null || date -u -d '+30 days' +%Y-%m-%dT00:00:00.000Z)\"}")
NEW_ID=$(echo "$NEW" | jq -r '.data.id')
echo "$NEW" | jq -e '.data.status == "PENDING"'
# parking1 cannot self-approve
set +e
SELF=$(curl -s -o /tmp/p15-self.json -w "%{http_code}" -X POST "$BASE/parking/permits/$NEW_ID/approve" \
  -H "Authorization: Bearer $PARK_TOKEN")
set -e
test "$SELF" = "403"
curl -sf -X POST "$BASE/parking/permits/$NEW_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.data.status == "ACTIVE"'

echo "==> G — Blacklist list"
curl -sf "$BASE/parking/blacklist?active=true" -H "Authorization: Bearer $PARK_TOKEN" | jq -e '.success == true'

echo "==> H — parking-web typecheck/build (workspace)"
cd "$ROOT/frontend"
npm run build --workspace=parking-web 2>&1 | tail -25

echo ""
echo "Phase 15 E2E OK"
echo "  App: cd frontend && npm run dev --workspace=parking-web  # :3006"
echo "  Login: parking1@highlink.co.tz / ChangeMe123!"
