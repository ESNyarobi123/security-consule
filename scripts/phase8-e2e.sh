#!/usr/bin/env bash
# Phase 8 E2E — admin-web API flows (core-api :4001)
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"

echo "==> A — Login"
LOGIN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken')
ORG_ID=$(echo "$LOGIN" | jq -r '.data.user.organizationId')
PERMS=$(echo "$LOGIN" | jq -r '.data.user.permissions | length')
test -n "$TOKEN" && test "$TOKEN" != "null"
test "$PERMS" -ge 10

echo "==> B — Customers list"
CUST=$(curl -sf "$BASE/customers" -H "Authorization: Bearer $TOKEN")
echo "$CUST" | jq -e '.data | length >= 1'
CUSTOMER_ID=$(echo "$CUST" | jq -r '.data[0].id')

echo "==> C — Create customer"
NEW_CODE="CUST-E2E-$(date +%s | tail -c 6)"
CREATE=$(curl -sf -X POST "$BASE/customers" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$NEW_CODE\",\"name\":\"E2E Test Customer Ltd\"}")
echo "$CREATE" | jq -e ".data.code == \"$NEW_CODE\""

echo "==> D — Contracts"
CTR_NUM="CTR-E2E-$(date +%s | tail -c 6)"
CONTRACT=$(curl -sf -X POST "$BASE/contracts" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"customerId\":\"$CUSTOMER_ID\",
    \"contractNumber\":\"$CTR_NUM\",
    \"title\":\"E2E Guarding Contract\",
    \"serviceType\":\"SECURITY_GUARD\",
    \"startDate\":\"2026-08-01\",
    \"endDate\":\"2027-07-31\",
    \"monthlyFee\": 3000000
  }")
CTR_ID=$(echo "$CONTRACT" | jq -r '.data.id')
echo "$CONTRACT" | jq -e '.data.status == "DRAFT"'
curl -sf -X PATCH "$BASE/contracts/$CTR_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"ACTIVE"}' | jq -e '.data.status == "ACTIVE"'

echo "==> E — Guards"
GUARDS=$(curl -sf "$BASE/guards" -H "Authorization: Bearer $TOKEN")
echo "$GUARDS" | jq -e '[.data[] | select(.employeeNumber=="GRD-0001")] | length >= 1'

echo "==> F — Invoices"
INV_NUM="INV-E2E-$(date +%s | tail -c 6)"
INVOICE=$(curl -sf -X POST "$BASE/finance/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"customerId\":\"$CUSTOMER_ID\",
    \"invoiceNumber\":\"$INV_NUM\",
    \"issueDate\":\"2026-07-01\",
    \"dueDate\":\"2026-07-31\",
    \"lines\":[{\"description\":\"Security services\",\"quantity\":1,\"unitPrice\":500000}]
  }")
INV_ID=$(echo "$INVOICE" | jq -r '.data.id')
curl -sf -X POST "$BASE/finance/invoices/$INV_ID/send" \
  -H "Authorization: Bearer $TOKEN" | jq -e '.data.status == "SENT"'

echo "==> G — HR employees"
curl -sf "$BASE/hr/employees" -H "Authorization: Bearer $TOKEN" | jq -e '.data | length >= 1'

echo "==> H — Audit"
AUDIT=$(curl -sf "$BASE/audit/logs?take=50" -H "Authorization: Bearer $TOKEN")
echo "$AUDIT" | jq -e '[.data[] | select(.action | startswith("contract.") or startswith("customer."))] | length >= 1'

echo "==> I — Regression reporting-service"
curl -sf http://localhost:4005/api/v1/health | jq -e '.data.status == "ok"'

echo ""
echo "Phase 8 E2E passed ✓"
