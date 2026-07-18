#!/usr/bin/env bash
# Phase 9 E2E — customer portal JWT scope + customer-web build
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Portal login (CUSTOMER_PORTAL)"
PORTAL=$(login "portal@demo-mfg.co.tz")
PORTAL_TOKEN=$(echo "$PORTAL" | jq -r '.data.tokens.accessToken')
CUSTOMER_ID=$(echo "$PORTAL" | jq -r '.data.user.customerId')
test -n "$PORTAL_TOKEN" && test "$PORTAL_TOKEN" != "null"
test -n "$CUSTOMER_ID" && test "$CUSTOMER_ID" != "null"
echo "    customerId=$CUSTOMER_ID"

echo "==> B — GET /customers/me"
ME=$(curl -sf "$BASE/customers/me" -H "Authorization: Bearer $PORTAL_TOKEN")
echo "$ME" | jq -e --arg id "$CUSTOMER_ID" '.data.id == $id and .data.code == "CUST-DEMO"'

echo "==> C — Scoped list endpoints (CUST-DEMO only)"
for path in \
  contracts \
  finance/invoices \
  visitors/appointments \
  access/employees \
  parking/vehicles \
  parking/permits
do
  echo "    GET /$path"
  RES=$(curl -sf "$BASE/$path" -H "Authorization: Bearer $PORTAL_TOKEN")
  echo "$RES" | jq -e '.success == true'
  # Every row with customerId must match JWT customer (permits may lack top-level customerId)
  if echo "$RES" | jq -e '[.data[] | select(.customerId != null)] | length > 0' >/dev/null 2>&1; then
    echo "$RES" | jq -e --arg id "$CUSTOMER_ID" \
      'all(.data[] | select(.customerId != null); .customerId == $id)'
  fi
done

echo "==> D — Wrong customerId query → 403"
set +e
DENIED=$(curl -s -o /tmp/p9_deny.json -w "%{http_code}" \
  "$BASE/contracts?customerId=00000000-0000-0000-0000-000000000099" \
  -H "Authorization: Bearer $PORTAL_TOKEN")
set -e
test "$DENIED" = "403"
jq -e '.error.code == "CUSTOMER_SCOPE_DENIED" or .error == "CUSTOMER_SCOPE_DENIED"' /tmp/p9_deny.json >/dev/null

echo "==> E — Access employees wrong customerId → 403"
set +e
DENIED2=$(curl -s -o /tmp/p9_deny2.json -w "%{http_code}" \
  "$BASE/access/employees?customerId=00000000-0000-0000-0000-000000000099" \
  -H "Authorization: Bearer $PORTAL_TOKEN")
set -e
test "$DENIED2" = "403"
jq -e '.error.code == "CUSTOMER_SCOPE_DENIED" or .error == "CUSTOMER_SCOPE_DENIED"' /tmp/p9_deny2.json >/dev/null

echo "==> F — Admin still sees org-wide contracts"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
ADMIN_CID=$(echo "$ADMIN" | jq -r '.data.user.customerId // empty')
test -z "$ADMIN_CID" || test "$ADMIN_CID" = "null"
curl -sf "$BASE/contracts" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.success == true'

echo "==> H — Portal read-only: mutate denied"
set +e
MUTATE=$(curl -s -o /tmp/p9_mutate.json -w "%{http_code}" -X POST \
  "$BASE/contracts" \
  -H "Authorization: Bearer $PORTAL_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}')
set -e
test "$MUTATE" = "403"
jq -e '.error.code == "CUSTOMER_PORTAL_READ_ONLY"' /tmp/p9_mutate.json >/dev/null

echo "==> I — Portal org-wide GET denied (e.g. payroll)"
set +e
PAY=$(curl -s -o /tmp/p9_pay.json -w "%{http_code}" \
  "$BASE/payroll/cycles" \
  -H "Authorization: Bearer $PORTAL_TOKEN")
set -e
test "$PAY" = "403"
jq -e '.error.code == "CUSTOMER_PORTAL_PATH_DENIED"' /tmp/p9_pay.json >/dev/null

echo "==> G — customer-web build"
cd "$ROOT/frontend"
npm run build --workspace=customer-web

echo ""
echo "Phase 9 E2E OK"
echo "  Portal: http://localhost:3002  portal@demo-mfg.co.tz / ChangeMe123!"
echo "  Scope: JWT customerId=$CUSTOMER_ID (CUST-DEMO)"
