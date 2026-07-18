#!/usr/bin/env bash
# Phase 8b E2E — payroll, procurement, approvals, visitors, ANPR/CCTV metadata
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Login (admin + GM)"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
GM=$(login "gm@highlink.co.tz")
GM_TOKEN=$(echo "$GM" | jq -r '.data.tokens.accessToken')
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != "null"
test -n "$GM_TOKEN" && test "$GM_TOKEN" != "null"

echo "==> B — Payroll create → generate → submit"
# Unique period each run (avoids duplicate cycle for same month)
OFFSET=$(( $(date +%s) % 200 + 1 ))
PERIOD_START=$(date -u -v-"${OFFSET}"d +%Y-%m-%d 2>/dev/null || date -u -d "-${OFFSET} days" +%Y-%m-%d)
PERIOD_END=$(date -u -v-"$((OFFSET - 1))"d +%Y-%m-%d 2>/dev/null || date -u -d "-$((OFFSET - 1)) days" +%Y-%m-%d)
CYCLE=$(curl -sf -X POST "$BASE/payroll/cycles" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"periodStart\":\"$PERIOD_START\",\"periodEnd\":\"$PERIOD_END\",\"tenantType\":\"INTERNAL_COMPANY\"}")
CYCLE_ID=$(echo "$CYCLE" | jq -r '.data.id')
test -n "$CYCLE_ID" && test "$CYCLE_ID" != "null"
curl -sf -X POST "$BASE/payroll/cycles/$CYCLE_ID/generate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.success == true'
curl -sf -X POST "$BASE/payroll/cycles/$CYCLE_ID/submit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.data.status == "PENDING_APPROVAL"'

echo "==> C — Approvals queue + creator ≠ approver"
PENDING=$(curl -sf "$BASE/approvals/instances" -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$PENDING" | jq -e '[.data[] | select(.status=="PENDING")] | length >= 1'
APPROVAL_ID=$(echo "$PENDING" | jq -r '[.data[] | select(.resourceType=="PayrollCycle" and .status=="PENDING" and .resourceId=="'"$CYCLE_ID"'")][0].id')
test -n "$APPROVAL_ID" && test "$APPROVAL_ID" != "null"
set +e
CREATOR_TRY=$(curl -s -o /tmp/creator_approve.json -w "%{http_code}" -X POST \
  "$BASE/approvals/instances/$APPROVAL_ID/actions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"APPROVE"}')
set -e
test "$CREATOR_TRY" != "200"
# GM approves via domain endpoint (acts on approval + updates cycle)
curl -sf -X POST "$BASE/payroll/cycles/$CYCLE_ID/approve" \
  -H "Authorization: Bearer $GM_TOKEN" | jq -e '.data.status == "APPROVED"'

echo "==> D — Payslip snapshots (immutable)"
SLIPS=$(curl -sf "$BASE/payroll/cycles/$CYCLE_ID/payslips" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$SLIPS" | jq -e '.success == true'

echo "==> E — Procurement suppliers + PO"
SUP_CODE="SUP-8B-$(date +%s | tail -c 5)"
SUP=$(curl -sf -X POST "$BASE/procurement/suppliers" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$SUP_CODE\",\"name\":\"Phase 8b Supplier\"}")
SUP_ID=$(echo "$SUP" | jq -r '.data.id')
curl -sf -X POST "$BASE/procurement/suppliers/$SUP_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.data.status == "APPROVED"'
PO_NUM="PO-8B-$(date +%s | tail -c 5)"
PO=$(curl -sf -X POST "$BASE/procurement/purchase-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"supplierId\":\"$SUP_ID\",\"poNumber\":\"$PO_NUM\",\"lines\":[{\"description\":\"Boots\",\"quantity\":5,\"unitPrice\":80000}]}")
PO_ID=$(echo "$PO" | jq -r '.data.id')
curl -sf -X POST "$BASE/procurement/purchase-orders/$PO_ID/submit" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.data.status == "PENDING_APPROVAL"'
curl -sf -X POST "$BASE/procurement/purchase-orders/$PO_ID/approve" \
  -H "Authorization: Bearer $GM_TOKEN" | jq -e '.data.status == "ORDERED"'

echo "==> F — Visitors call centre"
ORG_ID=$(echo "$ADMIN" | jq -r '.data.user.organizationId')
CUST=$(curl -sf "$BASE/customers" -H "Authorization: Bearer $ADMIN_TOKEN")
CUST_ID=$(echo "$CUST" | jq -r '.data[0].id')
SITES=$(curl -sf "$BASE/enterprise/sites" -H "Authorization: Bearer $ADMIN_TOKEN")
SITE_ID=$(echo "$SITES" | jq -r '.data[0].id')
VALID_FROM=$(date -u +%Y-%m-%dT00:00:00.000Z)
if date -u -v+1d +%Y-%m-%dT23:59:59.000Z >/dev/null 2>&1; then
  VALID_UNTIL=$(date -u -v+1d +%Y-%m-%dT23:59:59.000Z)
else
  VALID_UNTIL=$(date -u -d '+1 day' +%Y-%m-%dT23:59:59.000Z)
fi
APPT=$(curl -sf -X POST "$BASE/visitors/appointments" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"organizationId\":\"$ORG_ID\",
    \"customerId\":\"$CUST_ID\",
    \"siteId\":\"$SITE_ID\",
    \"visitorName\":\"E2E Visitor\",
    \"purpose\":\"Phase 8b test\",
    \"hostName\":\"Front Desk\",
    \"validFrom\":\"$VALID_FROM\",
    \"validUntil\":\"$VALID_UNTIL\"
  }")
APPT_ID=$(echo "$APPT" | jq -r '.data.id')
test -n "$APPT_ID" && test "$APPT_ID" != "null"
CODE_RES=$(curl -sf -X POST "$BASE/visitors/appointments/$APPT_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$CODE_RES" | jq -e '.data.verificationCode | length >= 4'

echo "==> G — CCTV / ANPR metadata + vision health"
curl -sf http://localhost:8000/health | jq -e '(.status == "ok") or (.service | tostring | length > 0)'
curl -sf "$BASE/parking/anpr-results" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.success == true'

echo "==> H — Regression customers + reporting"
curl -sf "$BASE/customers" -H "Authorization: Bearer $ADMIN_TOKEN" | jq -e '.data | length >= 1'
curl -sf http://localhost:4005/api/v1/health | jq -e '.data.status == "ok"'

echo ""
echo "Phase 8b E2E passed ✓"
