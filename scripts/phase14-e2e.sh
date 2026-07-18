#!/usr/bin/env bash
# Phase 14 E2E — guard duty depth (alertness + patrol + clock-out via field/sync)
set -euo pipefail

BASE="${CORE_URL:-http://localhost:4001/api/v1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/mobile/guard-app"

echo "==> Phase 14 packaged e2e (API)"
cd "$APP"
EXPO_PUBLIC_API_BASE="$BASE" npm run e2e:duty

echo "==> Typecheck"
npm run typecheck

echo ""
echo "Phase 14 E2E OK"
echo "  App: cd mobile/guard-app && npm start"
echo "  Login: guard1@highlink.co.tz / ChangeMe123!"
