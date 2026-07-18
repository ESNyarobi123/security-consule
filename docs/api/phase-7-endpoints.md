# Phase 7 — API Endpoints Catalog

Base: `http://localhost:4001/api/v1` | Swagger: `/docs`

Design: `docs/architecture/phase-7-executive-analytics-design.md`

Analytics AI: `http://localhost:8001`

## Reporting (`@pssms/reporting`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/reporting/health` | Bearer | — | `{ status, analyticsAi }` |
| GET | `/reporting/dashboards/executive` | Bearer | `?from=&to=&granularity=&siteId=` | Executive dashboard (24 KPIs) |
| GET | `/reporting/kpis` | Bearer | `?codes=A,B&from=&to=` | KpiItem[] |
| GET | `/reporting/kpis/:code` | Bearer | `?from=&to=` | KpiItem |
| POST | `/reporting/kpis/refresh` | Bearer | `{ from?, to?, codes? }` | Snapshots upserted + audit |
| GET | `/reporting/snapshots` | Bearer | `?kpiCode=` | KpiSnapshot[] |
| GET | `/reporting/insights` | Bearer | — | AnalyticsInsight[] |
| POST | `/reporting/insights/forecast` | Bearer | `{ horizonMonths? }` | FORECAST insight (PayslipSnapshot history) |
| POST | `/reporting/insights/anomalies` | Bearer | `{ domain?, threshold? }` | ANOMALY insight |

## Analytics AI (`analytics-ai-service` :8001)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/v1/forecast/payroll` | Stub linear forecast |
| POST | `/v1/anomalies/detect` | Stub z-score |

## KPI rules (non-negotiable)

```text
PAYROLL_NET_TOTAL / PAYROLL_GROSS_TOTAL
  → SUM(PayslipSnapshot) for APPROVED|PAID cycles only
  → NEVER live GuardAttendance × rate
```

## Docker

```bash
./scripts/docker-up.sh
# analytics-ai on http://localhost:8001/health
```

## E2E verified

- Executive dashboard: 24 KPIs
- `PAYROLL_NET_TOTAL` = 1,196,000 TZS from PayslipSnapshot (`source: snapshot`)
- KPI refresh → READY snapshots + audit
- Forecast + anomaly insights persisted
- Core Swagger paths: 102
