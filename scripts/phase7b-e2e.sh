#!/usr/bin/env bash
# Phase 7b E2E — scheduled refresh, CSV export, audit
set -euo pipefail

BASE="${BASE_URL:-http://localhost:4001/api/v1}"
SERVICE_TOKEN="${INTEGRATION_SERVICE_TOKEN:-dev_integration_token}"

echo "==> Login"
LOGIN=$(curl -sf -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken')
ORG_ID=$(echo "$LOGIN" | jq -r '.data.user.organizationId')
test -n "$TOKEN" && test "$TOKEN" != "null"

echo "==> Flow F — Internal scheduled KPI refresh"
REFRESH=$(curl -sf -X POST "$BASE/internal/v1/reporting/kpi-refresh" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"organizationId\":\"$ORG_ID\"}")
echo "$REFRESH" | jq -e '.data.refreshed == 24'

echo "==> Flow G — CSV export"
CSV=$(curl -sf "$BASE/reporting/exports/executive-dashboard.csv" \
  -H "Authorization: Bearer $TOKEN")
echo "$CSV" | head -1 | grep -q 'code,name,category'
echo "$CSV" | grep -q 'PAYROLL_NET_TOTAL'
ROW_COUNT=$(echo "$CSV" | tail -n +2 | wc -l | tr -d ' ')
test "$ROW_COUNT" -ge 24

echo "==> Flow H — Audit trail (export)"
AUDIT=$(curl -sf "$BASE/audit/logs?take=100" -H "Authorization: Bearer $TOKEN")
echo "$AUDIT" | jq -e '[.data[] | select(.action == "reporting.export.csv")] | length >= 1'

echo "==> Flow H2 — Audit trail (scheduled refresh)"
echo "$AUDIT" | jq -e '[.data[] | select(.action == "reporting.kpi.refresh.scheduled")] | length >= 1'

echo "==> Flow I — Worker health"
curl -sf http://localhost:4002/health | jq -e '.status == "ok"'

echo "==> Regression — executive dashboard 24 KPIs"
DASH=$(curl -sf "$BASE/reporting/dashboards/executive" -H "Authorization: Bearer $TOKEN")
echo "$DASH" | jq -e '.data.kpis | length == 24'
PAYROLL=$(echo "$DASH" | jq -r '.data.kpis[] | select(.code=="PAYROLL_NET_TOTAL") | .value')
test "$PAYROLL" = "1196000"

echo ""
echo "Phase 7b E2E passed ✓"
