#!/usr/bin/env bash
# Phase 1 bootstrap: schemas → migrate → seed
set -euo pipefail
cd "$(dirname "$0")/../backend"

echo "==> Creating PostgreSQL schemas"
npx prisma db execute --file prisma/migrations/0000_schemas/migration.sql --schema prisma/schema.prisma

echo "==> Prisma migrate deploy / db push"
npx prisma db push --schema prisma/schema.prisma

echo "==> Seed"
npm run prisma:seed

echo "==> Done. Start API: npm run start:core"
echo "    Swagger: http://localhost:4001/docs"
