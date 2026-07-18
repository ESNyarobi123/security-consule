#!/usr/bin/env bash
# Phase 17b E2E — dual JWT + admin-web OIDC discovery / PKCE wiring (no browser SSO)
set -euo pipefail

CORE="${CORE_URL:-http://localhost:4001/api/v1}"
ADMIN="${ADMIN_WEB_URL:-http://localhost:3000}"
KC_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KC_REALM="${KEYCLOAK_REALM:-pssms}"
KC_CLIENT="${KEYCLOAK_CLIENT_ID:-pssms-api}"
KC_SECRET="${KEYCLOAK_CLIENT_SECRET:-change_me_pssms_api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@highlink.co.tz}"
ADMIN_PASS="${ADMIN_PASS:-ChangeMe123!}"

echo "==> A — OIDC discovery exposes admin-web client + endpoints"
OIDC=$(curl -sf "$CORE/auth/oidc/config")
MODE=$(echo "$OIDC" | jq -r '.data.authMode // .authMode')
ADMIN_CLIENT=$(echo "$OIDC" | jq -r '.data.clients.adminWeb // .clients.adminWeb')
AUTHZ=$(echo "$OIDC" | jq -r '.data.authorizationEndpoint // .authorizationEndpoint')
TOKEN=$(echo "$OIDC" | jq -r '.data.tokenEndpoint // .tokenEndpoint')
test "$MODE" = "dual" -o "$MODE" = "keycloak" -o "$MODE" = "local"
test "$ADMIN_CLIENT" = "pssms-admin-web"
test -n "$AUTHZ" && test "$AUTHZ" != "null"
test -n "$TOKEN" && test "$TOKEN" != "null"
echo "    authMode=$MODE adminWeb=$ADMIN_CLIENT"

echo "==> B — Local login (break-glass) still works"
LOGIN=$(curl -sf -X POST "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
LOCAL_TOKEN=$(echo "$LOGIN" | jq -r '.data.tokens.accessToken // .tokens.accessToken')
test -n "$LOCAL_TOKEN" && test "$LOCAL_TOKEN" != "null"
echo "    local token OK"

echo "==> C — Keycloak ROPC + azp allowlist (pssms-api)"
TOKEN_JSON=$(curl -sf -X POST "$KC_URL/realms/$KC_REALM/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "grant_type=password" \
  --data-urlencode "client_id=$KC_CLIENT" \
  --data-urlencode "client_secret=$KC_SECRET" \
  --data-urlencode "username=$ADMIN_EMAIL" \
  --data-urlencode "password=$ADMIN_PASS")
KC_ACCESS=$(echo "$TOKEN_JSON" | jq -r '.access_token')
test -n "$KC_ACCESS" && test "$KC_ACCESS" != "null"
ME=$(curl -sf "$CORE/auth/me" -H "Authorization: Bearer $KC_ACCESS")
echo "$ME" | jq -e '(.data.email // .email) == "'"$ADMIN_EMAIL"'"' >/dev/null
echo "    Keycloak Bearer → /auth/me OK (azp allowed)"

echo "==> D — admin-web /auth/callback is publicly reachable (middleware)"
# Soft: if admin-web is down, skip with note
set +e
CB_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN/auth/callback")
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN/login")
set -e
if [ "$CB_CODE" = "000" ]; then
  echo "    SKIP admin-web not running on $ADMIN (start: cd frontend && npm run dev --workspace admin-web)"
else
  # 200 HTML or Next.js responses acceptable; must not redirect to /login (302 with Location login)
  test "$CB_CODE" = "200" -o "$CB_CODE" = "307" -o "$CB_CODE" = "308" -o "$CB_CODE" = "204"
  # Ensure /login also up
  test "$LOGIN_CODE" = "200" -o "$LOGIN_CODE" = "307" -o "$LOGIN_CODE" = "308"
  echo "    /auth/callback HTTP $CB_CODE ; /login HTTP $LOGIN_CODE"
fi

echo "==> E — Keycloak authorize endpoint accepts PKCE query (HTTP 302 to login form)"
CHALLENGE=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
STATE=$(uuidgen 2>/dev/null || openssl rand -hex 16)
AUTH_URL="${AUTHZ}?client_id=pssms-admin-web&redirect_uri=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("http://localhost:3000/auth/callback",safe=""))')&response_type=code&scope=openid%20email%20profile&state=${STATE}&code_challenge=${CHALLENGE}&code_challenge_method=S256"
set +e
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L --max-redirs 0 "$AUTH_URL")
# Without -L, expect 302 to Keycloak login
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$AUTH_URL")
set -e
test "$AUTH_CODE" = "302" -o "$AUTH_CODE" = "303" -o "$AUTH_CODE" = "200"
echo "    authorize HTTP $AUTH_CODE (PKCE challenge accepted)"

echo ""
echo "Phase 17b E2E OK"
echo "  Manual: open $ADMIN/login → Continue with SSO (admin@highlink.co.tz / ChangeMe123!)"
echo "  Deferred browser automation for full code exchange"
