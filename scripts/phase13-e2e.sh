#!/usr/bin/env bash
# Phase 13 E2E — gate officer verify + gate-app typecheck
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GATE_APP="$ROOT/mobile/gate-verification-app"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Gate officer login"
GATE=$(login "gate1@highlink.co.tz")
GATE_TOKEN=$(echo "$GATE" | jq -r '.data.tokens.accessToken')
ROLES=$(echo "$GATE" | jq -r '.data.user.roles | join(",")')
test -n "$GATE_TOKEN" && test "$GATE_TOKEN" != "null"
echo "    roles=$ROLES"

echo "==> B — Resolve site + GATE-MAIN"
SITES=$(curl -sf "$BASE/enterprise/sites" -H "Authorization: Bearer $GATE_TOKEN")
SITE_ID=$(echo "$SITES" | jq -r '.data[] | select(.code=="SITE-WAREHOUSE-A") | .id')
GATES=$(curl -sf "$BASE/enterprise/gates?siteId=$SITE_ID" -H "Authorization: Bearer $GATE_TOKEN")
GATE_ID=$(echo "$GATES" | jq -r '.data[] | select(.code=="GATE-MAIN") | .id')
test -n "$SITE_ID" && test "$SITE_ID" != "null"
test -n "$GATE_ID" && test "$GATE_ID" != "null"
echo "    siteId=$SITE_ID gateId=$GATE_ID"

echo "==> C — Public create + admin approve (SoD; one-shot code)"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
CFG=$(curl -sf "$BASE/visitors/public-config")
ORG_ID=$(echo "$CFG" | jq -r '.data.organizationId')
CUST_ID=$(echo "$CFG" | jq -r '.data.customerId')
FROM=$(date -u +%Y-%m-%dT08:00:00.000Z)
UNTIL=$(date -u +%Y-%m-%dT20:00:00.000Z)
APPT=$(curl -sf -X POST "$BASE/visitors/appointments" \
  -H 'Content-Type: application/json' \
  -d "{\"organizationId\":\"$ORG_ID\",\"customerId\":\"$CUST_ID\",\"siteId\":\"$SITE_ID\",\"gateId\":\"$GATE_ID\",\"visitorName\":\"Phase13 Guest\",\"visitorPhone\":\"+255700222333\",\"purpose\":\"Gate E2E\",\"validFrom\":\"$FROM\",\"validUntil\":\"$UNTIL\"}")
APPT_ID=$(echo "$APPT" | jq -r '.data.id')
ISSUE=$(curl -sf -X POST "$BASE/visitors/appointments/$APPT_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
CODE=$(echo "$ISSUE" | jq -r '.data.verificationCode')
test -n "$CODE" && test "$CODE" != "null"
echo "    code issued (ephemeral for E2E only)"

echo "==> D — Gate verify ALLOWED"
CID=$(uuidgen | tr '[:upper:]' '[:lower:]')
OK=$(curl -sf -X POST "$BASE/visitors/gate/verify" \
  -H "Authorization: Bearer $GATE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"siteId\":\"$SITE_ID\",\"gateId\":\"$GATE_ID\",\"clientEventId\":\"$CID\"}")
echo "$OK" | jq -e '.data.allowed == true and .data.result == "ALLOWED"'
# entry must not expose plaintext verificationCode
echo "$OK" | jq -e '(.data.entry | has("verificationCode") | not) or (.data.entry.verificationCode == null)'

echo "==> D2 — Same clientEventId → idempotent ALLOWED"
OK2=$(curl -sf -X POST "$BASE/visitors/gate/verify" \
  -H "Authorization: Bearer $GATE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"siteId\":\"$SITE_ID\",\"gateId\":\"$GATE_ID\",\"clientEventId\":\"$CID\"}")
echo "$OK2" | jq -e '.data.allowed == true and .data.result == "ALLOWED"'

echo "==> E — Same code, new clientEventId → DENIED"
set +e
AGAIN=$(curl -s -X POST "$BASE/visitors/gate/verify" \
  -H "Authorization: Bearer $GATE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"siteId\":\"$SITE_ID\",\"gateId\":\"$GATE_ID\",\"clientEventId\":\"$(uuidgen | tr '[:upper:]' '[:lower:]')\"}")
set -e
echo "$AGAIN" | jq -e '.data.allowed == false and (.data.result | startswith("DENIED"))'

echo "==> F — Gate app must not be confused with attendance (no customerId on user)"
echo "$GATE" | jq -e '.data.user.customerId == null or .data.user.customerId == ""'

echo "==> G — typecheck + packaged e2e"
cd "$GATE_APP"
npm run typecheck
EXPO_PUBLIC_API_BASE="$BASE" npm run e2e:gate-verify

echo ""
echo "Phase 13 E2E OK"
echo "  App: cd mobile/gate-verification-app && npm start"
echo "  Login: gate1@highlink.co.tz / ChangeMe123!"
