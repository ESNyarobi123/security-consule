# Phase 7c API Endpoints

## Service split

| Service | Port | Routes |
|---|---|---|
| `core-api` | 4001 | Auth, enterprise, ops, finance, audit, … |
| `reporting-service` | 4005 | All `/reporting/*`, internal KPI refresh |

## New exports

| Method | Path | Response |
|---|---|---|
| `GET` | `/reporting/exports/executive-dashboard.xlsx` | Excel workbook |
| `GET` | `/reporting/exports/executive-dashboard.pdf` | PDF board pack |

Existing CSV export unchanged on reporting-service.

**Audit actions:** `reporting.export.xlsx`, `reporting.export.pdf`

## Internal (moved from core-api)

```
POST /api/v1/internal/v1/reporting/kpi-refresh
Host: reporting-service :4005
Auth: Bearer ${INTEGRATION_SERVICE_TOKEN}
```

## RLS

Migration `prisma/migrations/0001_reporting_rls/migration.sql` enables FORCE RLS on `reporting.*`.

App sets `app.organization_id` via `PrismaService.withOrgContext()`.

## Env

```bash
REPORTING_SERVICE_PORT=4005
REPORTING_SERVICE_INTERNAL_URL=http://localhost:4005
NEXT_PUBLIC_REPORTING_API_URL=http://localhost:4005
```

## E2E

```bash
chmod +x scripts/phase7c-e2e.sh
./scripts/phase7c-e2e.sh
```
