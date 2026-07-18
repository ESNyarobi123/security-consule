# Phase 7b API Endpoints

Base: `http://localhost:4001/api/v1`

## New in Phase 7b

### Internal (Service Token)

| Method | Path | Description |
|---|---|---|
| `POST` | `/internal/v1/reporting/kpi-refresh` | Scheduled KPI snapshot refresh (background-worker) |

**Body:**
```json
{
  "organizationId": "uuid",
  "from": "2026-07-01",
  "to": "2026-07-14",
  "codes": ["PAYROLL_NET_TOTAL"]
}
```

**Auth:** `Authorization: Bearer ${INTEGRATION_SERVICE_TOKEN}`

**Audit action:** `reporting.kpi.refresh.scheduled`

---

### Reporting export

| Method | Path | Description |
|---|---|---|
| `GET` | `/reporting/exports/executive-dashboard.csv` | Download executive KPIs as CSV |

**Query:** `from`, `to`, `siteId`, `branchId`, `granularity` (same as executive dashboard)

**Auth:** Bearer JWT

**Response:** `text/csv; charset=utf-8` with `Content-Disposition: attachment`

**Audit action:** `reporting.export.csv`

**CSV columns:** `code,name,category,unit,value,source,as_of,period_from,period_to`

---

## Background worker

Env vars (see `.env.example`):

- `KPI_REFRESH_ENABLED=true`
- `KPI_REFRESH_UTC_HOUR=21` — daily window (00:00 EAT)
- `KPI_REFRESH_UTC_MINUTE=5`
- `KPI_REFRESH_INTERVAL_MS=0` — set `3600000` for hourly dev testing

---

## Executive web

| App | Port | Env |
|---|---|---|
| `frontend/apps/executive-web` | 3001 | `NEXT_PUBLIC_CORE_API_URL=http://localhost:4001` |

```bash
cd frontend
npm install
cp apps/executive-web/.env.local.example apps/executive-web/.env.local
npm run dev --workspace=executive-web
```

---

## E2E

```bash
chmod +x scripts/phase7b-e2e.sh
./scripts/phase7b-e2e.sh
```
