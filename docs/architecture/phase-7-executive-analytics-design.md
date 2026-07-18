# Phase 7 — Executive Analytics (Design)

Research synthesis + PSSMS rules (`libs/reporting`, immutable payroll snapshots, modular monolith, `organization_id` separation, audit trail).

## Community / research patterns adopted

| Pattern | Source | PSSMS implementation |
|---|---|---|
| CQRS read models / KPI snapshots | Executive dashboard guides, reporting DBs | `reporting.kpi_snapshots` — frozen aggregates, not live payroll recompute |
| Dashboard APIs in monolith first | Nest modular monolith / strangler | Phase 7a: `libs/reporting` inside **core-api (4001)** |
| Thin AI sidecar | FastAPI analytics stubs | `analytics-ai-service` (8001) — forecast + anomaly stubs only |
| Cross-domain read-only queries | CQRS / reporting warehouse lite | Reporting may **read** other schemas via Prisma; **never writes** domain tables |
| Creator ≠ approver | Governance | Report **exports** / schedule jobs (Phase 7b) use approvals if money-impacting |
| Tenant isolation | Architecture | Every KPI query filters `organization_id`; optional `branch_id` / `site_id` |

## Non-negotiables (Phase 7)

```text
❌ Payroll KPI = SUM(live GuardAttendance hours) × rate on dashboard open
✅ Payroll KPI = SUM(PayslipSnapshot.net_pay / gross_pay) for PAID|APPROVED cycles

❌ Separate Nest microservice for every dashboard widget
✅ libs/reporting in core-api (same as Phases 1–6); reporting-service (4005) deferred

❌ analytics-ai-service owns invoices / payslips business rules
✅ Python returns stub scores/series; Nest stores / presents; domain libs stay source of truth

❌ Cross-module repository writes from reporting
✅ Read-only aggregates + audit on snapshot refresh / export request
```

## Deployment decision: core-api vs reporting-service

| Option | Port | When |
|---|---|---|
| **Phase 7a (THIS SPRINT)** — `libs/reporting` in **core-api** | 4001 | Matches Phases 1–6; one Swagger; E2E against same stack |
| Phase 7b — extract `apps/reporting-service` | 4005 | Heavy materialized refresh, scheduled PDF/Excel, isolation from write path |

**Prefer core-api for Phase 7a** — same pattern as finance/payroll/notifications. Port `4005` stays reserved in `ports-allocation.md`; do **not** add a hollow Nest app yet.

```text
executive-web (3001) ──HTTP──► core-api /api/v1/reporting/* (Bearer)
                                      │
                                      ├─ Prisma READ: attendance, incidents, finance, payroll, …
                                      ├─ Prisma WRITE: reporting.* only
                                      └─ HTTP ──► analytics-ai-service :8001 (stubs)
```

---

## 1. Prisma models (`reporting` schema)

Add schema to `prisma/migrations/0000_schemas/migration.sql`:

```sql
CREATE SCHEMA IF NOT EXISTS reporting;
```

### Models (Phase 7a)

```prisma
// @@schema("reporting")

enum KpiPeriodGranularity {
  DAY
  WEEK
  MONTH
}

enum KpiSnapshotStatus {
  COMPUTING
  READY
  FAILED
  STALE
}

/// Named KPI keys consumed by executive-web (stable contract).
/// Examples: GUARD_ON_DUTY, ATTENDANCE_RATE, OPEN_INCIDENTS, …
model KpiDefinition {
  id              String   @id @default(uuid())
  organizationId  String?  @map("organization_id") // null = system catalog
  code            String   // unique stable key
  name            String
  description     String?
  category        String   // OPS | SAFETY | FINANCE | PAYROLL | ACCESS | COMMERCIAL
  unit            String   // COUNT | PERCENT | TZS | HOURS
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")

  @@unique([organizationId, code])
  @@map("kpi_definitions")
  @@schema("reporting")
}

/// Point-in-time aggregate. Refresh writes NEW rows or upserts by unique key;
/// never recomputes payroll from attendance — payroll KPIs copy from PayslipSnapshot.
model KpiSnapshot {
  id               String               @id @default(uuid())
  organizationId   String               @map("organization_id")
  kpiCode          String               @map("kpi_code")
  granularity      KpiPeriodGranularity @default(DAY)
  periodStart      DateTime             @map("period_start") @db.Date
  periodEnd        DateTime             @map("period_end") @db.Date
  branchId         String?              @map("branch_id")
  siteId           String?              @map("site_id")
  customerId       String?              @map("customer_id")
  valueNumeric     Decimal              @map("value_numeric") @db.Decimal(18, 4)
  valueJson        Json?                @map("value_json") // breakdown / series
  status           KpiSnapshotStatus    @default(READY)
  sourceHash       String?              @map("source_hash") // idempotent refresh
  computedAt       DateTime             @default(now()) @map("computed_at")
  computedBy       String?              @map("computed_by") // userId | "system"

  @@unique([organizationId, kpiCode, granularity, periodStart, periodEnd, branchId, siteId, customerId])
  @@index([organizationId, kpiCode, periodStart])
  @@map("kpi_snapshots")
  @@schema("reporting")
}

/// Optional AI sidecar results (stubbed in Phase 7a) — metadata only.
model AnalyticsInsight {
  id               String   @id @default(uuid())
  organizationId   String   @map("organization_id")
  insightType      String   @map("insight_type") // FORECAST | ANOMALY
  domain           String   // PAYROLL | ATTENDANCE | INCIDENTS | FINANCE
  title            String
  summary          String
  score            Decimal? @db.Decimal(8, 4) // confidence / severity
  payload          Json     // raw stub response from analytics-ai-service
  periodStart      DateTime? @map("period_start")
  periodEnd        DateTime? @map("period_end")
  createdAt        DateTime @default(now()) @map("created_at")
  createdBy        String?  @map("created_by")

  @@index([organizationId, insightType, createdAt])
  @@map("analytics_insights")
  @@schema("reporting")
}

/// Soft cache of last dashboard assembly (avoids hammering aggregates).
model DashboardCache {
  id               String   @id @default(uuid())
  organizationId   String   @map("organization_id")
  dashboardCode    String   @map("dashboard_code") // EXECUTIVE_HOME
  filtersHash      String   @map("filters_hash")
  payload          Json
  expiresAt        DateTime @map("expires_at")
  createdAt        DateTime @default(now()) @map("created_at")

  @@unique([organizationId, dashboardCode, filtersHash])
  @@map("dashboard_caches")
  @@schema("reporting")
}
```

### Schema ownership note

| Schema | Owner | Phase 7 access |
|---|---|---|
| `reporting.*` | `libs/reporting` | R/W |
| All other domain schemas | Their libs | **READ ONLY** via reporting services (documented CQRS exception — no foreign writes) |

Seed: system `KpiDefinition` rows for the KPI codes in §5 (no org-specific codes required for sprint).

---

## 2. `libs/reporting` API endpoints (core-api)

Layout (match existing libs):

```text
backend/libs/reporting/
├── reporting.module.ts
├── index.ts
├── tsconfig.lib.json
├── application/
│   ├── dashboard.service.ts      # assemble EXECUTIVE_HOME
│   ├── kpi.service.ts            # live aggregate + snapshot refresh
│   └── analytics-bridge.service.ts # HTTP client → analytics-ai-service
├── infrastructure/
│   └── analytics-ai.client.ts
└── presentation/
    ├── reporting.controller.ts
    └── dto/reporting.dto.ts
```

Register `ReportingModule` in `apps/core-api/src/app.module.ts` (same as Notifications, Finance, …).

### HTTP surface (`/api/v1`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/reporting/health` | Bearer | Lib wired + analytics-ai reachability |
| GET | `/reporting/dashboards/executive` | Bearer | Full EXECUTIVE_HOME payload (KPIs + optional insights) |
| GET | `/reporting/kpis` | Bearer | Query: `codes`, `from`, `to`, `granularity`, `siteId?`, `branchId?` |
| GET | `/reporting/kpis/:code` | Bearer | Single KPI + sparkline (`valueJson.series`) |
| POST | `/reporting/kpis/refresh` | Bearer (admin/exec) | Recompute snapshots for range; audit `reporting.kpi.refresh` |
| GET | `/reporting/insights` | Bearer | Stored `AnalyticsInsight` list |
| POST | `/reporting/insights/forecast` | Bearer | Call AI forecast stub → persist insight |
| POST | `/reporting/insights/anomalies` | Bearer | Call AI anomaly stub → persist insight |
| GET | `/reporting/snapshots` | Bearer | List `KpiSnapshot` rows (debug / audit) |

### Response contract (executive dashboard)

```json
{
  "organizationId": "…",
  "generatedAt": "2026-07-14T20:00:00.000Z",
  "period": { "from": "2026-07-01", "to": "2026-07-14", "granularity": "DAY" },
  "kpis": [
    {
      "code": "OPEN_INCIDENTS",
      "category": "SAFETY",
      "unit": "COUNT",
      "value": 3,
      "priorValue": 5,
      "deltaPct": -40.0,
      "asOf": "2026-07-14T20:00:00.000Z",
      "source": "live"
    }
  ],
  "insights": [],
  "cache": { "hit": false, "expiresAt": null }
}
```

`source`: `live` | `snapshot` — payroll/finance money KPIs prefer `snapshot` after refresh; ops KPIs may be live for Phase 7a.

### Auth / audit

- Scope: `user.organizationId` on every query (reuse `AuthUser` / guards).
- Roles (seed later): `EXECUTIVE`, `GM`, `CMD` or existing admin roles for sprint.
- Audit: refresh, forecast, anomaly requests → `audit.audit_logs` action codes `reporting.*`.

---

## 3. Hosting: reporting-service vs core-api

**Decision: Phase 7a = core-api only.**

| Concern | Choice |
|---|---|
| Consistency with Phases 1–6 | Domain logic in `libs/*`, controllers on core-api |
| Swagger / E2E | Single base URL `http://localhost:4001` |
| reporting-service (4005) | **Deferred to Phase 7b** — extract when refresh jobs / exports need isolation |
| background-worker | Optional lightweight cron for `kpis/refresh` in 7b; manual refresh OK for 7a |

---

## 4. `analytics-ai-service` (8001) — minimal FastAPI

Mirror `vision-ai-service` layout:

```text
backend/apps/analytics-ai-service/
├── Dockerfile
├── requirements.txt          # fastapi, uvicorn, pydantic
└── app/main.py
```

### Endpoints (stubs — no ML training)

| Method | Path | Body (summary) | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status, service: "analytics-ai-service" }` |
| POST | `/v1/forecast/payroll` | `{ organization_id, history: [{ period, net_pay_total }], horizon_months }` | `{ series: [{ period, predicted_net_pay }], model: "stub-linear", confidence }` |
| POST | `/v1/anomalies/detect` | `{ organization_id, domain, points: [{ t, value }], threshold? }` | `{ anomalies: [{ t, value, score, reason }], model: "stub-zscore" }` |

Rules:

- No DB access from Python in Phase 7a — Nest passes arrays from `PayslipSnapshot` / KPI series.
- No payroll rule calculation in Python.
- Deterministic stub: e.g. forecast = last value × 1.02; anomaly if `|z| > 2` with fake z from mean/stdev of payload.

Env (core-api): `ANALYTICS_AI_URL=http://analytics-ai-service:8001` (compose) / `http://localhost:8001` (local).

---

## 5. KPI list with data sources

All filters: `organization_id = AuthUser.organizationId`. Dates: `[from, to]` inclusive unless noted.

| KPI code | Name | Unit | Primary tables / columns | Notes |
|---|---|---|---|---|
| `GUARD_HEADCOUNT_ACTIVE` | Active guards | COUNT | `workforce.guard_profiles` WHERE active (+ link `employees.status=ACTIVE` if present) | Ops capacity |
| `GUARD_ON_DUTY` | Guards clocked in (open attendance) | COUNT | `attendance.guard_attendances` WHERE `clock_out_at IS NULL` | Live ops |
| `ATTENDANCE_CLOCK_INS` | Clock-ins in period | COUNT | `attendance.guard_attendances` WHERE `clock_in_at` in range | Ops volume |
| `ATTENDANCE_APPROVAL_RATE` | Supervisor-approved attendances | PERCENT | `guard_attendances.supervisor_approved` | Ops quality |
| `ALERTNESS_CONFIRM_RATE` | Alertness confirmed / scheduled | PERCENT | `attendance.alertness_checks` (`CONFIRMED` vs all in range) | Duty confirmation |
| `FIELD_ALERTS_OPEN` | Unacked field alerts | COUNT | `attendance.field_alerts` WHERE `acknowledged = false` | Ops risk |
| `DEPLOYMENTS_ACTIVE` | Active deployments | COUNT | `operations.guard_deployments` WHERE `status = ACTIVE` | Coverage |
| `OPEN_INCIDENTS` | Open + investigating incidents | COUNT | `incidents.incidents` WHERE `status IN (OPEN, INVESTIGATING)` | Safety |
| `INCIDENTS_BY_SEVERITY` | Severity breakdown | JSON | `incidents.incidents` GROUP BY `severity` in range (`created`/`reported` date) | Safety |
| `INCIDENTS_RESOLVED` | Resolved in period | COUNT | `incidents.incidents` WHERE `status=RESOLVED` + date filter | Safety |
| `VISITOR_APPOINTMENTS` | Appointments in period | COUNT | `visitors.visitor_appointments` | Access |
| `VISITOR_ENTRIES_ALLOWED` | Successful gate entries | COUNT | `visitors.visitor_entries` WHERE allow/success result | Access |
| `PARKING_ENTRIES` | Parking entries | COUNT | `parking.parking_entries` | Parking |
| `PARKING_VIOLATIONS` | Violations | COUNT | `parking.parking_violations` | Parking |
| `CONTRACTS_ACTIVE` | Active contracts | COUNT | `contracts.contracts` WHERE `status=ACTIVE` | Commercial |
| `CONTRACTS_MRR` | Monthly recurring (active) | TZS | `SUM(contracts.monthly_fee)` WHERE `status=ACTIVE` | Commercial |
| `CUSTOMERS_ACTIVE` | Active customers | COUNT | `customers.customers` WHERE `is_active` | Commercial |
| `INVOICE_OUTSTANDING` | Unpaid invoice balance | TZS | `finance.invoices` WHERE status in `SENT, PARTIALLY_PAID` → `total - paid` (via payments) | Finance |
| `INVOICE_COLLECTED` | Payments received in period | TZS | `SUM(finance.invoice_payments.amount)` WHERE paid in range | Finance |
| `PAYROLL_NET_TOTAL` | Net payroll (approved/paid) | TZS | `SUM(payroll.payslip_snapshots.net_pay)` JOIN cycles `status IN (APPROVED, PAID)` AND period overlap | **Snapshot only** |
| `PAYROLL_GROSS_TOTAL` | Gross payroll | TZS | `SUM(payslip_snapshots.gross_pay)` same join | **Snapshot only** |
| `PAYROLL_CYCLES_PAID` | Paid cycles in period | COUNT | `payroll.payroll_cycles` WHERE `status=PAID` | Payroll ops |
| `EMPLOYEES_ACTIVE` | Active employees | COUNT | `workforce.employees` WHERE `status=ACTIVE` | HR |
| `RECRUITMENT_PIPELINE` | Open applications | COUNT | `recruitment.job_applications` WHERE not hired/rejected | HR |

**Payroll rule reminder:** dashboard and AI history series must use `PayslipSnapshot` (+ cycle status). Never derive `PAYROLL_*` money figures from `GuardAttendance`.

### Refresh algorithm (POST `/reporting/kpis/refresh`)

```text
for each KPI code in requested set:
  if code in PAYROLL_*:
    aggregate from PayslipSnapshot + PayrollCycle (immutable)
  else if code in FINANCE_* money:
    aggregate from invoices / invoice_payments
  else:
    aggregate from domain tables (ops/safety/access)
  upsert KpiSnapshot (unique key) + sourceHash
audit reporting.kpi.refresh
invalidate DashboardCache for EXECUTIVE_HOME
```

---

## 6. E2E test flows (sprint exit)

Prereqs: Docker stack up, Phase 1–6 seed data (guards, attendances, incidents, invoices, paid payroll cycle, visitors, parking).

### Flow A — Executive dashboard KPIs

1. Login as org admin / executive user → Bearer token.
2. `GET /api/v1/reporting/dashboards/executive?from=&to=` → `200`, `kpis.length ≥ 10`, every item has `code` + `value`.
3. Assert `PAYROLL_NET_TOTAL` equals `SUM(net_pay)` of seeded PAID cycle snapshots (not attendance hours × rate).
4. Assert `OPEN_INCIDENTS` matches count of OPEN/INVESTIGATING rows for org.
5. `GET /api/v1/reporting/kpis?codes=GUARD_ON_DUTY,INVOICE_OUTSTANDING` → filtered set.

### Flow B — Snapshot refresh + audit

1. `POST /api/v1/reporting/kpis/refresh` with `{ from, to, codes: ["ATTENDANCE_CLOCK_INS", "PAYROLL_NET_TOTAL"] }`.
2. `GET /api/v1/reporting/snapshots?kpiCode=PAYROLL_NET_TOTAL` → `status=READY`, `valueNumeric` set.
3. Audit log contains `reporting.kpi.refresh` for actor.

### Flow C — Analytics AI stubs

1. `GET http://localhost:8001/health` → ok.
2. `POST /api/v1/reporting/insights/forecast` with empty body (Nest builds history from last N `PAYROLL_NET_TOTAL` snapshots / payslip aggregates).
3. Response persists `AnalyticsInsight` (`insightType=FORECAST`); `GET /reporting/insights` returns it.
4. `POST /api/v1/reporting/insights/anomalies` with attendance series → `ANOMALY` insight stored (stub may return empty anomalies — still `200` + stored payload).

### Flow D — Org isolation

1. Using token for org A, request dashboard → no KPIs from org B seed (if multi-org seed; else skip with unit test on `organizationId` filter).

### Flow E — Compose health

1. `docker compose … ps` includes `analytics-ai-service` healthy.
2. core-api `/reporting/health` reports analytics dependency `up` or `degraded` (degraded still allows live KPIs).

---

## 7. Phase 7b deferrals

| Item | Why deferred |
|---|---|
| `apps/reporting-service` on **4005** | Extract when refresh load / exports need process isolation |
| Scheduled KPI refresh via `background-worker` | Manual refresh sufficient for 7a |
| PDF / Excel scheduled reports + email | Needs documents + notifications productization |
| Materialized SQL views / ClickHouse / warehouse | Overkill; snapshots enough |
| Real ML models (Prophet, isolation forest, etc.) | Stubs only |
| Full `executive-web` (3001) Next.js UI | Frontend scaffold not built; API-first like Phases 1–6 |
| Grafana business dashboards (vs infra Grafana) | Product KPIs via API |
| RLS policies on `reporting.*` | Follow Phase 3b/6b pattern later |
| Branch/site heatmap geo UI | API supports `siteId` filter; map UI later |
| Cross-org / group consolidations | Single org MVP |
| Compliance module dashboards | `libs/compliance` not in Phase 7a |
| api-gateway (4000) BFF for executive-web | Direct core-api until gateway exists |
| RabbitMQ projection subscribers | Sync refresh OK |

---

## 8. Docker Compose additions

File: `infra/docker/docker-compose.yml`.

### New service

```yaml
  analytics-ai-service:
    build:
      context: ../../backend/apps/analytics-ai-service
      dockerfile: Dockerfile
    container_name: pssms-analytics-ai
    restart: unless-stopped
    ports:
      - "8001:8001"
    environment:
      ANALYTICS_AI_PORT: "8001"
```

### Env wiring

Add to `x-backend-env` (and `.env.example`):

```yaml
ANALYTICS_AI_URL: http://analytics-ai-service:8001
```

Optional for core-api service overrides:

```yaml
ANALYTICS_AI_URL: http://analytics-ai-service:8001
```

### Do **not** add in Phase 7a

- `reporting-service` container on 4005
- `executive-web` container on 3001 (no app yet)

### Schema bootstrap

Extend migrate command schemas list with `reporting` in `0000_schemas/migration.sql` (already part of Prisma push path).

### Local start (docs)

```bash
# existing
npm run start:core
# new
cd backend/apps/analytics-ai-service && uvicorn app.main:app --host 0.0.0.0 --port 8001
```

---

## Implementation checklist (sprint)

### Research / docs

- [x] This design: `docs/architecture/phase-7-executive-analytics-design.md`
- [ ] `docs/api/phase-7-endpoints.md` (write during implement)
- [ ] Update `docs/architecture/system-architecture.md` §3 with `reporting.*`
- [ ] Update `docs/phases/PROGRESS.md` Phase 7 → IN_PROGRESS → DONE after E2E

### Modules / apps

- [ ] `libs/reporting` — dashboard, KPIs, snapshot refresh, analytics bridge
- [ ] Wire into `core-api` `AppModule`
- [ ] `apps/analytics-ai-service` — health + forecast + anomaly stubs
- [ ] Docker: analytics-ai-service + `ANALYTICS_AI_URL`

### Prisma

- [ ] `CREATE SCHEMA reporting`
- [ ] `KpiDefinition`, `KpiSnapshot`, `AnalyticsInsight`, `DashboardCache`
- [ ] Seed KPI definitions

### Exit criteria

1. [ ] `GET /reporting/dashboards/executive` returns scoped KPIs
2. [ ] Payroll KPIs match `PayslipSnapshot` sums (not live attendance)
3. [ ] KPI refresh writes `reporting.kpi_snapshots` + audit
4. [ ] analytics-ai `/health` + forecast/anomaly via Nest bridge
5. [ ] Compose includes analytics-ai on 8001
6. [ ] Swagger tags include Reporting; path count documented in PROGRESS

---

## Out of scope (explicit)

- Building `executive-web` UI pages (API-ready for later)
- Moving modules out of core-api into microservices
- Vendor BI tools (Power BI, Metabase) connectors
- Streaming video / CCTV pixels into dashboards (metadata events only, already Phase 6)
