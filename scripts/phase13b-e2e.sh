#!/usr/bin/env bash
# Phase 13b E2E — supervisor approve + field-alert ack + app typecheck
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/mobile/supervisor-app"

echo "==> Phase 13b packaged e2e (API)"
cd "$APP"
EXPO_PUBLIC_API_BASE="$BASE" npm run e2e:supervisor

echo "==> Typecheck"
npm run typecheck

echo ""
echo "Phase 13b E2E OK"
echo "  App: cd mobile/supervisor-app && npm start"
echo "  Login: supervisor1@highlink.co.tz / ChangeMe123!"
