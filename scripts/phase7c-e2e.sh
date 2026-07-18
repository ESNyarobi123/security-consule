#!/usr/bin/env bash
# Phase 7c E2E — reporting-service extraction, xlsx/pdf exports, RLS
set -euo pipefail

CORE="${CORE_URL:-http://localhost:4001/api/v1}"
REPORTING="${REPORTING_URL:-http://localhost:4005/api/v1}"
SERVICE_TOKEN="${INTEGRATION_SERVICE_TOKEN:-dev_integration_token}"

echo "==> Login (core-api)"
LOGIN=$(curl -sf -X POST "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}')
TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken')
ORG_ID=$(echo "$LOGIN" | jq -r '.data.user.organizationId')
test -n "$TOKEN" && test "$TOKEN" != "null"

echo "==> Flow J — Reporting service health"
curl -sf http://localhost:4005/api/v1/health | jq -e '.data.status == "ok"'

echo "==> Flow K — Executive dashboard on reporting-service"
DASH=$(curl -sf "$REPORTING/reporting/dashboards/executive" \
  -H "Authorization: Bearer $TOKEN")
echo "$DASH" | jq -e '.data.kpis | length == 24'

echo "==> Flow L — XLSX export"
XLSX=$(curl -sf "$REPORTING/reporting/exports/executive-dashboard.xlsx" \
  -H "Authorization: Bearer $TOKEN")
echo "$XLSX" | head -c 2 | grep -q 'PK'

echo "==> Flow M — PDF export"
PDF=$(curl -sf "$REPORTING/reporting/exports/executive-dashboard.pdf" \
  -H "Authorization: Bearer $TOKEN")
echo "$PDF" | head -c 4 | grep -q '%PDF'

echo "==> Flow G — CSV export (regression)"
CSV=$(curl -sf "$REPORTING/reporting/exports/executive-dashboard.csv" \
  -H "Authorization: Bearer $TOKEN")
echo "$CSV" | grep -q 'PAYROLL_NET_TOTAL'

echo "==> Flow N — Audit trail (xlsx + pdf)"
AUDIT=$(curl -sf "$CORE/audit/logs?take=100" -H "Authorization: Bearer $TOKEN")
echo "$AUDIT" | jq -e '[.data[] | select(.action == "reporting.export.xlsx")] | length >= 1'
echo "$AUDIT" | jq -e '[.data[] | select(.action == "reporting.export.pdf")] | length >= 1'

echo "==> Flow O — Internal refresh on reporting-service"
REFRESH=$(curl -sf -X POST "$REPORTING/internal/v1/reporting/kpi-refresh" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"organizationId\":\"$ORG_ID\"}")
echo "$REFRESH" | jq -e '.data.refreshed == 24'

echo "==> Flow P — RLS smoke (snapshots require org context)"
SNAP=$(curl -sf "$REPORTING/reporting/snapshots" -H "Authorization: Bearer $TOKEN")
echo "$SNAP" | jq -e '.data | length >= 1'

echo "==> Regression — PAYROLL_NET_TOTAL from snapshot"
PAYROLL=$(echo "$DASH" | jq -r '.data.kpis[] | select(.code=="PAYROLL_NET_TOTAL") | .value')
test "$PAYROLL" = "1196000"

echo "==> Worker health"
curl -sf http://localhost:4002/health | jq -e '.status == "ok"'

echo ""
echo "Phase 7c E2E passed ✓"
