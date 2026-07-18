#!/usr/bin/env bash
# Phase 10 E2E — supplier portal JWT scope + visitor public booking + builds
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Supplier portal login"
SUP=$(login "portal@uniforms.co.tz")
SUP_TOKEN=$(echo "$SUP" | jq -r '.data.tokens.accessToken')
SUPPLIER_ID=$(echo "$SUP" | jq -r '.data.user.supplierId')
test -n "$SUP_TOKEN" && test "$SUP_TOKEN" != "null"
test -n "$SUPPLIER_ID" && test "$SUPPLIER_ID" != "null"
echo "    supplierId=$SUPPLIER_ID"

echo "==> B — GET /procurement/suppliers/me"
ME=$(curl -sf "$BASE/procurement/suppliers/me" -H "Authorization: Bearer $SUP_TOKEN")
echo "$ME" | jq -e --arg id "$SUPPLIER_ID" '.data.id == $id and .data.code == "SUP-UNIFORM"'

echo "==> C — Scoped PO list"
POS=$(curl -sf "$BASE/procurement/purchase-orders" -H "Authorization: Bearer $SUP_TOKEN")
echo "$POS" | jq -e '.success == true'
echo "$POS" | jq -e --arg id "$SUPPLIER_ID" 'all(.data[]; .supplierId == $id)'
echo "$POS" | jq -e '[.data[] | select(.poNumber=="PO-DEMO-UNIFORM-001")] | length >= 1'

echo "==> D — Wrong supplierId query → 403"
set +e
DENIED=$(curl -s -o /tmp/p10_deny.json -w "%{http_code}" \
  "$BASE/procurement/purchase-orders?supplierId=00000000-0000-0000-0000-000000000099" \
  -H "Authorization: Bearer $SUP_TOKEN")
set -e
test "$DENIED" = "403"
jq -e '.error.code == "SUPPLIER_SCOPE_DENIED"' /tmp/p10_deny.json >/dev/null

echo "==> E — Supplier mutate denied"
set +e
MUTATE=$(curl -s -o /tmp/p10_mutate.json -w "%{http_code}" -X POST \
  "$BASE/procurement/suppliers" \
  -H "Authorization: Bearer $SUP_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}')
set -e
test "$MUTATE" = "403"
jq -e '.error.code == "SUPPLIER_PORTAL_READ_ONLY"' /tmp/p10_mutate.json >/dev/null

echo "==> F — Supplier org-wide GET denied"
set +e
FIN=$(curl -s -o /tmp/p10_fin.json -w "%{http_code}" \
  "$BASE/finance/invoices" \
  -H "Authorization: Bearer $SUP_TOKEN")
set -e
test "$FIN" = "403"
jq -e '.error.code == "SUPPLIER_PORTAL_PATH_DENIED"' /tmp/p10_fin.json >/dev/null

echo "==> G — Admin still org-wide"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
curl -sf "$BASE/procurement/purchase-orders" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -e '.success == true'

echo "==> H — Visitor public-config + appointment create"
CFG=$(curl -sf "$BASE/visitors/public-config")
ORG_ID=$(echo "$CFG" | jq -r '.data.organizationId')
CUST_ID=$(echo "$CFG" | jq -r '.data.customerId')
SITE_ID=$(echo "$CFG" | jq -r '.data.siteId')
test -n "$ORG_ID" && test "$ORG_ID" != "null"
FROM=$(date -u +%Y-%m-%dT10:00:00.000Z)
UNTIL=$(date -u +%Y-%m-%dT18:00:00.000Z)
APPT=$(curl -sf -X POST "$BASE/visitors/appointments" \
  -H 'Content-Type: application/json' \
  -d "{\"organizationId\":\"$ORG_ID\",\"customerId\":\"$CUST_ID\",\"siteId\":\"$SITE_ID\",\"visitorName\":\"Phase10 Visitor\",\"visitorPhone\":\"+255700999001\",\"purpose\":\"Delivery pickup\",\"validFrom\":\"$FROM\",\"validUntil\":\"$UNTIL\",\"hostName\":\"Jane Host\"}")
echo "$APPT" | jq -e '.data.referenceNumber != null and .data.status == "PENDING"'
# must not leak verification code on create
echo "$APPT" | jq -e '.data.verificationCode == null or .data.verificationCode == ""'

echo "==> I — Frontend builds"
cd "$ROOT/frontend"
npm run build --workspace=supplier-web
npm run build --workspace=visitor-web

echo ""
echo "Phase 10 E2E OK"
echo "  Supplier: http://localhost:3003  portal@uniforms.co.tz / ChangeMe123!"
echo "  Visitor:  http://localhost:3005  (public pre-register)"
echo "  Scope: JWT supplierId=$SUPPLIER_ID (SUP-UNIFORM)"
