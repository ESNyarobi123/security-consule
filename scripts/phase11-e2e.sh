#!/usr/bin/env bash
# Phase 11 E2E — public recruitment careers + admin hire path + build
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POSTING_ID="00000000-0000-4000-8000-000000000101"

login() {
  local email="$1"
  curl -sf -X POST "$BASE/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"ChangeMe123!\"}"
}

echo "==> A — Public config + open postings"
CFG=$(curl -sf "$BASE/recruitment/public-config")
echo "$CFG" | jq -e '.data.organizationId != null'
OPEN=$(curl -sf "$BASE/recruitment/postings/open")
echo "$OPEN" | jq -e --arg id "$POSTING_ID" '[.data[] | select(.id==$id)] | length == 1'
curl -sf "$BASE/recruitment/postings/open/$POSTING_ID" | jq -e '.data.title != null'

echo "==> B — Public apply (no auth)"
EMAIL="phase11-$(date +%s)@example.com"
APPT=$(curl -sf -X POST "$BASE/recruitment/applications" \
  -H 'Content-Type: application/json' \
  -d "{\"postingId\":\"$POSTING_ID\",\"applicantName\":\"Phase11 Applicant\",\"email\":\"$EMAIL\",\"phone\":\"+255700111222\",\"coverLetter\":\"Ready to serve.\"}")
REF=$(echo "$APPT" | jq -r '.data.referenceNumber')
APP_ID=$(echo "$APPT" | jq -r '.data.id')
test -n "$REF" && test "$REF" != "null"
echo "    reference=$REF"

echo "==> C — Status by reference + email"
curl -sf "$BASE/recruitment/applications/status?reference=$REF&email=$EMAIL" \
  | jq -e --arg r "$REF" '.data.referenceNumber == $r and .data.status == "SUBMITTED"'

echo "==> D — Unauthenticated list applications / hire denied"
set +e
CODE_LIST=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/recruitment/applications")
CODE_HIRE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/recruitment/applications/$APP_ID/hire" \
  -H 'Content-Type: application/json' \
  -d '{"employeeNumber":"GRD-HACK"}')
set -e
test "$CODE_LIST" = "401"
test "$CODE_HIRE" = "401"

echo "==> E — Admin list → screen → hire"
ADMIN=$(login "admin@highlink.co.tz")
ADMIN_TOKEN=$(echo "$ADMIN" | jq -r '.data.tokens.accessToken')
curl -sf "$BASE/recruitment/applications" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq -e --arg id "$APP_ID" '[.data[] | select(.id==$id)] | length == 1'
curl -sf -X PATCH "$BASE/recruitment/applications/$APP_ID/status" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"SCREENING","notes":"Phase11 E2E"}' \
  | jq -e '.data.status == "SCREENING"'
EMP_NUM="GRD-P11-$(date +%s | tail -c 5)"
curl -sf -X POST "$BASE/recruitment/applications/$APP_ID/hire" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"employeeNumber\":\"$EMP_NUM\",\"department\":\"Operations\"}" \
  | jq -e '.data.status == "HIRED"'

echo "==> F — recruitment-web build"
cd "$ROOT/frontend"
npm run build --workspace=recruitment-web

echo ""
echo "Phase 11 E2E OK"
echo "  Careers: http://localhost:3004"
echo "  Demo job: /jobs/$POSTING_ID"
echo "  Last apply ref: $REF"
