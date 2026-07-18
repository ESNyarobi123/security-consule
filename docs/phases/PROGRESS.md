# PSSMS Build Progress — Phases

> **Muhimu:** Usianze Phase mpya kabla ya ku-mark phase ya sasa `DONE` hapa.

## Batch A — Phases 1–5 (current)

| Phase | Name | Status | Started | Completed | Notes |
|---|---|---|---|---|---|
| **1** | Platform Foundation | `DONE` | 2026-07-14 | 2026-07-14 | IAM, enterprise, audit, approvals, customers, contracts |
| **2** | Core Security Operations | `DONE` | 2026-07-14 | 2026-07-14 | Guards, shifts, deployments, checkpoints, attendance, alertness, patrols, EOB, incidents, offline sync |
| **3** | Access, Visitors & Parking | `DONE` | 2026-07-14 | 2026-07-14 | access-control, visitors, parking, gates |
| **4** | HR & Payroll | `DONE` | 2026-07-14 | 2026-07-14 | workforce HR, recruitment, payroll snapshots, employee loans |
| **5** | Finance & Procurement | `DONE` | 2026-07-14 | 2026-07-14 | finance, procurement, inventory, assets — 88 Swagger paths |

## Batch B — Phases 6–7

| Phase | Name | Status | Started | Completed | Notes |
|---|---|---|---|---|---|
| **6** | Advanced Integrations | `DONE` | 2026-07-14 | 2026-07-14 | notifications, outbox, webhooks, worker, realtime SSE, vision-ai stub — 93 core paths |
| **7** | Executive Analytics | `DONE` | 2026-07-14 | 2026-07-14 | libs/reporting, KPI snapshots, analytics-ai stubs — 102 core paths |
| **7b** | Executive Polish | `DONE` | 2026-07-14 | 2026-07-14 | worker KPI cron, CSV export, executive-web :3001 |
| **7c** | Reporting Extract | `DONE` | 2026-07-14 | 2026-07-14 | reporting-service :4005, xlsx/pdf, RLS reporting.* |
| **8** | Admin Portal | `DONE` | 2026-07-14 | 2026-07-14 | admin-web :3000, 12 routes, 6 wired portals |
| **8b** | Admin Workflows | `DONE` | 2026-07-15 | 2026-07-15 | payroll, procurement, approvals, callcentre, CCTV metadata |
| **9** | Customer Portal | `DONE` | 2026-07-15 | 2026-07-15 | customer-web :3002, JWT customerId scope |
| **10** | Supplier + Visitor Portals | `DONE` | 2026-07-15 | 2026-07-15 | supplier-web :3003, visitor-web :3005 |
| **11** | Recruitment Portal | `DONE` | 2026-07-15 | 2026-07-15 | recruitment-web :3004 public careers |
| **12** | Guard App Offline | `DONE` | 2026-07-15 | 2026-07-15 | Expo guard-app + SQLite outbox → field/sync |
| **13** | Gate Verification App | `DONE` | 2026-07-15 | 2026-07-15 | Expo gate-app + visitor OTP verify (online-first) |
| **13b** | Supervisor App | `DONE` | 2026-07-15 | 2026-07-15 | Expo supervisor-app + FieldAlerts + attendance approve |
| **14** | Guard Duty Depth | `DONE` | 2026-07-15 | 2026-07-15 | Alertness + QR patrol + clock-out via field/sync |
| **15** | Parking Portal | `DONE` | 2026-07-15 | 2026-07-15 | parking-web :3006 + ANPR decide + permit SoD |
| **16** | API Gateway | `DONE` | 2026-07-15 | 2026-07-15 | api-gateway :4000 proxy → core-api :4001 |
| **17** | Keycloak SSO (dual JWT) | `DONE` | 2026-07-15 | 2026-07-15 | AUTH_MODE dual; local HS256 + KC RS256; AuthZ from Prisma |
| **17b** | Admin-web OIDC PKCE | `DONE` | 2026-07-15 | 2026-07-15 | SSO button + /auth/callback; azp allowlist |

---

## Phase 17b checklist — DONE ✓

### Research applied
- [x] Authorization Code + PKCE S256 (public client; sessionStorage verifier)
- [x] Dual-mode login UI from `GET /auth/oidc/config`
- [x] Profile from Nest `/auth/me` only (no Keycloak roles in UI)
- [x] `azp` allowlist (`KEYCLOAK_ALLOWED_AZP`)

### Deliverables
- [x] `@pssms/auth` oidc-pkce + login/callback routes
- [x] Realm redirect `/auth/callback` + PKCE attribute
- [x] `scripts/phase17b-e2e.sh` + docs update

### Deferred
- [ ] Disable ROPC outside local/dev
- [ ] MFA / UMA; other portals OIDC

---

## Phase 17 checklist — DONE ✓

### Research applied
- [x] Dual JWT / JWKS with per-issuer **alg gate** (HS256 local vs RS256 Keycloak — algo-confusion mitigation)
- [x] IdP = identity only; AuthZ from PSSMS DB (roles/permissions/ABAC)
- [x] No auto-provision; `email_verified` required to link; audit `IDENTITY_KEYCLOAK_LINK`
- [x] Realm seed users with first/last name (Keycloak 26 Verify Profile / ROPC)

### Deliverables
- [x] `infra/keycloak/pssms-realm.json` + compose `--import-realm`
- [x] `User.keycloakSub` + dual `JwtStrategy` + `GET /auth/oidc/config`
- [x] `docs/architecture/phase-17-keycloak-sso.md` + `docs/api/phase-17-endpoints.md`
- [x] `scripts/phase17-e2e.sh`

### Deferred (17b+)
- [x] Portal OIDC UI (admin-web code+PKCE) — Phase 17b
- [x] `azp` allowlist — Phase 17b
- [ ] Disable ROPC outside local/dev
- [ ] MFA / UMA

---

## Phase 16 checklist — DONE ✓

### Research applied
- [x] Single public entry (BFF-lite) — not a domain microservice
- [x] Proxy preserves auth + status body; block `/internal/**`
- [x] Edge rate limit + `x-request-id`
- [x] Dual-mode cutover (portals default stay on :4001)

### Deliverables
- [x] `backend/apps/api-gateway` + `npm run start:gateway`
- [x] Block internal routes; throttle 120/min
- [x] `.env.example` + phase-16 docs
- [x] `scripts/phase16-e2e.sh`

### Deferred
- [x] Keycloak (Phase 17) — done
- [ ] Redis throttle store / multi-service routing
- [ ] Force all portals/mobile to :4000

---

## Phase 15 checklist — DONE ✓

### Research applied
- [x] Portal ≠ service — core-api :4001; ANPR results only (no video)
- [x] Ops whitelist / exception feed (community ANPR pattern)
- [x] Creator ≠ approver on permit approve
- [x] Customer-web remains read-only fleet view

### Deliverables
- [x] `frontend/apps/parking-web` :3006
- [x] Seed `PARKING_OFFICER` + `parking1@highlink.co.tz`
- [x] Violations list, blacklist API, permit PENDING→approve
- [x] `scripts/phase15-e2e.sh` + docs

### Deferred
- [ ] Live camera / MQTT barrier / RLS parking.*
- [ ] Vision model training

---

## Phase 14 checklist — DONE ✓

### Research applied
- [x] Offline outbox for confirm / patrol / clock-out (not online-only)
- [x] QR + GPS dual proof (type/paste MVP; camera/NFC deferred)
- [x] App ≠ service — core-api :4001
- [x] Guard attendance only — no visitors / access / payroll

### Deliverables
- [x] field/sync `CLOCK_OUT` + clock-out `clientEventId` idempotency
- [x] Seed pending alertness + NFC tag on CP-GATE-01
- [x] Guard-app: alertness + patrol screens + clock-out
- [x] `scripts/phase14-e2e.sh` + docs

### Deferred
- [ ] Camera barcode / real NFC reader
- [ ] Face / fingerprint / live GPS
- [ ] Auto-schedule alertness worker

---

## Phase 13b checklist — DONE ✓

### Research applied
- [x] Online-first supervisor ops (poll) — not SQLite outbox
- [x] App ≠ service — core-api :4001
- [x] Review queue + missed alertness loud alerts
- [x] Creator ≠ approver on attendance approve
- [x] Separate from gate OTP / customer access

### Deliverables
- [x] `mobile/supervisor-app` Expo scaffold
- [x] Live board + alerts + attendance + incidents + EOB
- [x] Seed `SUPERVISOR` + `supervisor1@highlink.co.tz`
- [x] FieldAlert list/ack + attendance approve APIs
- [x] `scripts/phase13b-e2e.sh` + docs

### Deferred
- [ ] SSE / push to supervisors
- [ ] Offline supervisor ack queue
- [ ] Live map / patrol UI

---

## Phase 13 checklist — DONE ✓

### Research applied
- [x] Online-first OTP/code verify (gate) — not offline outbox for codes
- [x] App ≠ service — core-api :4001
- [x] Never show plaintext codes in lists; verify-only at gate
- [x] Separate from guard attendance
- [x] Creator ≠ approver on appointment approve; HMAC hash lookup; atomic useCount; clientEventId retry

### Deliverables
- [x] `mobile/gate-verification-app` Expo scaffold
- [x] Login + duty + verify + ALLOWED/DENIED result
- [x] Seed `GATE_OFFICER` + `gate1@highlink.co.tz`
- [x] `scripts/phase13-e2e.sh` + docs (+ idempotent clientEventId)

### Deferred
- [ ] Offline OTP queue, NFC, ANPR at gate UI
- [ ] Fine-grained `visitors.verify` perm (vs `visitors.manage`)

---

## Phase 12 checklist — DONE ✓

### Research applied
- [x] Offline-first SQLite outbox + idempotency keys (community Expo pattern)
- [x] `POST /field/sync` with `clientEventId` + `deviceTime` (Phase 2 already)
- [x] Portal/app ≠ service — core-api :4001 (api-gateway later)
- [x] Guard attendance only — no customer access APIs

### Deliverables
- [x] `mobile/guard-app` Expo scaffold (login, home, clock-in, outbox)
- [x] SQLite `sync_outbox` → field/sync; FieldSyncEventDto `@IsObject()` payload fix
- [x] `scripts/phase12-e2e.sh` green (+ `npm run e2e:field-sync`)
- [x] `docs/architecture/phase-12-guard-app-design.md`, `docs/api/phase-12-endpoints.md`

### Deferred
- [ ] Face/fingerprint, local encryption, api-gateway cutover
- [ ] Camera/NFC hardware (Phase 14 adds typed QR MVP)

---

## Phase 11 checklist — DONE ✓

### Research applied
- [x] Public careers browse+apply (visitor-web / ATS public board pattern)
- [x] Portal ≠ service — core-api :4001 only
- [x] Hire + pipeline status stay admin-only (creator ≠ portal hire)
- [x] Application `referenceNumber` for status lookup (no candidate IAM)

### Deliverables
- [x] Public `postings/open`, `public-config`, harden apply, status-by-ref
- [x] `frontend/apps/recruitment-web` :3004
- [x] `scripts/phase11-e2e.sh` green
- [x] `docs/architecture/phase-11-recruitment-web-design.md`, `docs/api/phase-11-endpoints.md`

### Deferred
- [ ] B2B other-security-company portal polish
- [ ] Candidate Keycloak / MinIO CV upload
- [ ] guard-app Expo offline (Phase 12+)

---

## Phase 10 checklist — DONE ✓

### Research applied
- [x] Portal-prefixed cookies (`pssms_supplier_*`) — multi-portal isolation
- [x] JWT `supplierId` force-scope + SupplierPortalGuard
- [x] Portal ≠ service — core-api :4001 only
- [x] visitor-web public pre-register only (no gate code / approve)

### Deliverables
- [x] `User.supplierId` + `SUPPLIER_PORTAL` seed (`portal@uniforms.co.tz` → SUP-UNIFORM)
- [x] `GET /procurement/suppliers/me` + scoped POs + demo PO
- [x] `GET /visitors/public-config` (public)
- [x] `frontend/apps/supplier-web` :3003
- [x] `frontend/apps/visitor-web` :3005
- [x] `scripts/phase10-e2e.sh` green
- [x] `docs/architecture/phase-10-supplier-visitor-design.md`, `docs/api/phase-10-endpoints.md`

### Deferred
- [ ] Supplier PO acknowledge / GRN / punchout
- [ ] Visitor status-by-code lookup
- [ ] Keycloak / Playwright / RLS

---

## Phase 9 checklist — DONE ✓

### Research applied
- [x] Portal-prefixed cookies (`pssms_customer_*`) — avoid multi-portal session bleed
- [x] JWT `customerId` force-scope (frontend filter alone unsafe)
- [x] Portal ≠ service — core-api :4001 only
- [x] v1 visitors/access/parking **read lists** (approve stays admin until mutate asserts)

### Deliverables
- [x] `User.customerId` + `CUSTOMER_PORTAL` seed (`portal@demo-mfg.co.tz`)
- [x] `resolveCustomerScope` / `requireCustomerScope`
- [x] `GET /customers/me` + scoped contracts/invoices/visitors/access/parking
- [x] `frontend/apps/customer-web` :3002
- [x] Portal JWT read-only allowlist (`CustomerPortalGuard`) — deny mutates + org-wide GETs
- [x] `scripts/phase9-e2e.sh` green
- [x] `docs/architecture/phase-9-customer-web-design.md`, `docs/api/phase-9-endpoints.md`

### Deferred
- [ ] Keycloak / httpOnly cookies
- [ ] Visitor approve with customer assert
- [ ] RLS on access/visitors/parking
- [ ] supplier-web / visitor-web / Playwright

---

## Phase 8b checklist — DONE ✓

### Research applied
- [x] Creator ≠ approver — server enforces; UI mutes own requests
- [x] Payroll from PayslipSnapshot only (never live attendance)
- [x] CCTV metadata/ANPR only — no video through Nest
- [x] Cross-module approvals inbox (community workflow queue pattern)

### Deliverables
- [x] `/payroll` — cycles generate/submit/approve/pay + payslips
- [x] `/procurement` — suppliers + POs submit/approve
- [x] `/approvals` — pending queue with creator guard
- [x] `/callcentre` — appointments + gate code once + entries
- [x] `/cctv` — vision-ai health + ANPR events
- [x] `scripts/phase8b-e2e.sh` (admin + GM)
- [x] `docs/architecture/phase-8b-admin-workflows-design.md`

### Still deferred (Phase 8c / 9)
- [ ] Keycloak SSO, httpOnly cookies
- [ ] Playwright UI E2E
- [ ] OpenAPI codegen for api-client
- [ ] GRN + three-way match UI

---

## Phase 8 checklist — DONE ✓

### Research applied
- [x] Role-based internal portal shell (community admin dashboard patterns)
- [x] Cookie session + middleware guard (Next.js App Router)
- [x] Shared packages: auth, permissions, api-client admin module
- [x] Portal ≠ service — all business APIs on core-api :4001

### Deliverables
- [x] `apps/admin-web` (3000) — login, AdminShell, 12 portal routes
- [x] `packages/auth`, `packages/permissions`
- [x] Wired: customers, contracts, guards, invoices, HR, audit, branches
- [x] Scaffold: payroll, procurement, cctv, callcentre (wired in 8b)
- [x] `scripts/phase8-e2e.sh`
- [x] `docs/architecture/phase-8-admin-web-design.md`

---

## Phase 7c checklist — DONE ✓

### Research applied
- [x] Thin service extraction (strangler pattern — logic stays in libs/reporting)
- [x] exceljs + pdfkit sync exports (defer MinIO/async to Phase 8)
- [x] PostgreSQL RLS on reporting.* + withOrgContext helper
- [x] Auth on core-api, reporting on :4005 (portal ≠ service)

### Deliverables
- [x] `apps/reporting-service` (4005)
- [x] `GET /reporting/exports/executive-dashboard.xlsx|pdf`
- [x] RLS migration + `PrismaService.withOrgContext`
- [x] Worker → reporting-service internal refresh
- [x] executive-web Excel/PDF buttons
- [x] `scripts/phase7c-e2e.sh`

### Still deferred (Phase 8+)
- [ ] Real ML models in analytics-ai
- [ ] Scheduled email PDF reports
- [ ] MinIO async export jobs
- [ ] Platform-wide RLS on other schemas
- [ ] api-gateway BFF (4000)

---

## Phase 7b checklist — DONE ✓

### Research applied
- [x] Scheduled snapshot refresh via worker HTTP → internal API (outbox pattern reuse)
- [x] CSV export for executive board packs (defer PDF/Excel to Phase 7c)
- [x] Minimal Next.js executive portal (shadcn-style cards, category grouping)
- [x] Payroll KPIs still from PayslipSnapshot only

### Deliverables
- [x] `KpiRefreshJob` in background-worker
- [x] `POST /internal/v1/reporting/kpi-refresh`
- [x] `GET /reporting/exports/executive-dashboard.csv`
- [x] `frontend/apps/executive-web` (3001) — login + dashboard + export
- [x] `scripts/phase7b-e2e.sh`
- [x] `docs/architecture/phase-7b-executive-web-design.md`

### Phase 8+ (later)
- [ ] Real ML models
- [ ] Scheduled email reports
- [ ] MinIO async exports

---

## Phase 7 checklist — DONE ✓

### Research applied
- [x] CQRS-style KPI snapshots (community dashboard / TrackTik-style ops KPIs)
- [x] Payroll KPIs from immutable `PayslipSnapshot` only (never live attendance)
- [x] Thin FastAPI analytics sidecar (forecast + anomaly stubs)
- [x] Reporting inside core-api (Phase 7a) — reporting-service 4005 deferred
- [x] Org-scoped aggregates + audit on refresh / insights

### Modules / apps
- [x] `libs/reporting` — executive dashboard, KPI refresh, analytics bridge
- [x] `apps/analytics-ai-service` (8001) — forecast + anomaly stubs
- [x] Docker: analytics-ai-service + `ANALYTICS_AI_URL`

### Prisma schemas
- [x] `reporting.*` — kpi_definitions, kpi_snapshots, analytics_insights, dashboard_caches

### E2E verified
- [x] Executive dashboard returns 24 KPIs
- [x] `PAYROLL_NET_TOTAL` = 1,196,000 from PayslipSnapshot
- [x] KPI refresh writes READY snapshots
- [x] Forecast + anomaly insights via analytics-ai
- [x] Health: reporting + analytics-ai up

### Phase 7c+ (later polish)
- [ ] Extract `reporting-service` (4005)
- [ ] PDF/Excel exports
- [ ] Real ML models
- [ ] PostgreSQL RLS on `reporting.*`

---

## Phase 6 checklist — DONE ✓

### Research applied
- [x] Transactional outbox (NestJS dual-write / outbox-inbox community patterns)
- [x] Webhook inbox: store raw → ACK → async process → idempotency key
- [x] Adapter registry + console stubs (no vendor SDK in domain libs)
- [x] Provider-agnostic payment webhook → `paymentReference` on invoices
- [x] Vision metadata only — no video through Nest

### Modules / apps
- [x] `libs/notifications` — enqueue + outbox writer
- [x] `apps/integration-gateway` (4003) — webhooks, dispatch, console adapters
- [x] `apps/background-worker` (4002) — outbox poller + webhook processor
- [x] `apps/realtime-gateway` (4004) — SSE stream
- [x] `apps/vision-ai-service` (8000) — FastAPI ANPR stub

### Prisma schemas
- [x] `integrations.*` — outbox, webhook_inbox, provider_registry, request_logs
- [x] `notifications.*` — templates, notifications, delivery_attempts

### E2E verified
- [x] Visitor approve → SMS notification SENT
- [x] Payment webhook → invoice PAID + idempotent replay
- [x] ANPR webhook → vision stub → plate T123ABC ingested
- [x] Health: worker, integration-gateway, realtime, vision-ai

### Phase 6b (later polish, not blocking Phase 7)
- [ ] Real M-Pesa / banks / production SMS / WhatsApp / FCM
- [ ] Biometric MQTT ingest + real barrier control
- [ ] analytics-ai-service (8001)
- [ ] api-gateway (4000) BFF
- [ ] Redis circuit breaker + Prometheus per adapter
- [ ] PostgreSQL RLS on integrations/notifications

---

## Phase 5 checklist — DONE ✓

### Research applied
- [x] Procure-to-pay lifecycle (Supplier → PO → GRN → 3-way match → payment voucher)
- [x] 3-way match: PO lines vs received qty vs payable amount
- [x] Petty cash imprest model with approval before disbursement
- [x] Provider-agnostic payments (`paymentReference` only)
- [x] Creator ≠ approver via `libs/approvals` for petty cash, vouchers, PO

### Modules
- [x] `libs/finance` — invoices, petty cash, payment vouchers
- [x] `libs/procurement` — suppliers, PO, GRN, 3-way match
- [x] `libs/inventory` — stock items, movements (computed onHand)
- [x] `libs/assets` — asset register, assign/return

### Prisma schemas
- [x] `finance.*`, `procurement.*`, `inventory.*`, `assets.*`

### E2E verified
- [x] Invoice create → send → payment (PAID, 2.5M TZS)
- [x] Petty cash voucher approve (balance decremented)
- [x] PO submit → GM approve → GRN → stock IN (onHand=20)
- [x] 3-way match matched, payable=900,000 TZS
- [x] Payment voucher approve → pay
- [x] Asset assign → return

### Phase 5b (later polish, not blocking Phase 6)
- [ ] supplier-web portal UI
- [ ] Full GL/chart of accounts double-entry
- [ ] PDF invoice generation
- [ ] background-worker invoice reminders
- [ ] M-Pesa/bank disbursement via integration-gateway

---

## Phase 4 checklist — DONE ✓

### Research applied
- [x] Immutable payroll snapshots (IRE journals, event-sourcing patterns)
- [x] Inputs frozen at generate time — never live attendance on payslip read
- [x] Draft → calculate → submit → approve → pay workflow
- [x] Loan installments generated post-approval (Odoo/hr-payroll patterns)
- [x] Leave balance check + approval queue
- [x] Creator ≠ approver via `libs/approvals`
- [x] `INTERNAL_COMPANY` tenant (customer payroll tenant scaffolded)

### Modules
- [x] `libs/workforce` extended — employees, leave, salary assignments
- [x] `libs/recruitment` — postings, applications, hire → employee
- [x] `libs/payroll` — cycles, immutable PayslipSnapshot, rule versions
- [x] `libs/employee-loans` — apply, approve, installment schedule

### API docs
- [x] `docs/architecture/phase-4-hr-payroll-design.md`
- [x] `docs/api/phase-4-endpoints.md`
- [x] Swagger: **67 paths**, **25 tags**

### Exit criteria — verified 2026-07-14
1. [x] Employee record linked to guard profile GRD-0001
2. [x] Leave apply → GM approve
3. [x] Loan apply → approve → 3 installments
4. [x] Recruitment public application
5. [x] Payroll: generate (104h snapshot) → approve → PAID
6. [x] Payslip netPay computed from snapshot (not live attendance)
7. [x] All actions audited

### Phase 4b (later polish, not blocking Phase 5)
- [ ] background-worker scheduled payroll runs
- [ ] Full TRA PAYE tables + statutory versioning
- [ ] CUSTOMER_MANAGED_PAYROLL tenant E2E
- [ ] Payslip PDF generation
- [ ] M-Pesa/bank disbursement via integration-gateway

---

## Phase 3 checklist — DONE ✓

### Research applied
- [x] Pre-registration + host approval before code issuance (VMS community patterns)
- [x] Time-bound + site/gate-bound verification codes
- [x] HMAC-signed codes, one-time use, replay/idempotency via `clientEventId`
- [x] Customer employee access in `access.*` (not `attendance.*`)
- [x] ANPR metadata ingest only — no AI in Nest parking module (GateGuardX pattern)
- [x] Customer data isolation via `customerId` + org scope

### Modules
- [x] `libs/access-control` — customer employees + access entries
- [x] `libs/visitors` — appointments, approval, gate verify
- [x] `libs/parking` — vehicles, permits, ANPR results, entries, violations
- [x] `libs/enterprise` — gates (site gates)

### API docs
- [x] `docs/architecture/phase-3-access-visitors-parking-design.md`
- [x] `docs/api/phase-3-endpoints.md`
- [x] Swagger: **48 paths**, **19 tags**

### Exit criteria — verified 2026-07-14
1. [x] Customer employee check-in recorded (`access.entries`)
2. [x] Visitor appointment → approve → gate verify (one-time HMAC code)
3. [x] Parking permit check on entry + ANPR ingest/decide
4. [x] All actions audited
5. [x] Public visitor pre-registration endpoint works

### Phase 3b (later polish, not blocking Phase 4)
- [ ] SMS/WhatsApp visitor code dispatch (`libs/notifications`)
- [ ] Customer portal UI (`customer-web` / `visitor-web`)
- [ ] PostgreSQL RLS policies for `access.*`, `visitors.*`, `parking.*`
- [ ] MQTT barrier trigger on allow decision

---

## Phase 2 checklist — DONE ✓

### Research applied
- [x] Dual verification: GPS geofence + QR/NFC checkpoint codes
- [x] Offline-first sync with `clientEventId` idempotency
- [x] `deviceTime` + `serverReceivedTime` (don't trust phone clock alone)
- [x] Missed alertness → FieldAlert for supervisor
- [x] Occurrence book append-only + versioned corrections
- [x] Guard attendance in `attendance.*` schema only (separate from access.*)

### Modules
- [x] `libs/workforce` — guard profiles
- [x] `libs/operations` — shifts, assignments, deployments, checkpoints
- [x] `libs/attendance` — clock-in/out, alertness, patrols, field sync
- [x] `libs/occurrence-book` — EOB entries + corrections
- [x] `libs/incidents` — incident reporting

### API docs
- [x] `docs/api/phase-2-endpoints.md`
- [x] Swagger: **34 paths**, **16 tags**

### Exit criteria — verified 2026-07-14
1. [x] Guard can clock-in with GPS geofence verification
2. [x] Alertness schedule → confirm / missed (creates field alert)
3. [x] Patrol checkpoint scan with QR code validation
4. [x] Occurrence book entry created (append-only)
5. [x] Incident reported with auto incident number
6. [x] Offline sync endpoint accepts batch events
7. [x] All actions audited

### Phase 2b (later polish, not blocking Phase 3)
- [ ] Background worker: auto-schedule alertness during active shifts
- [ ] realtime-gateway: push alerts to supervisors
- [ ] Mobile app UI (guard-app scaffold)
- [ ] Photo evidence upload to MinIO

---

## Phase 1 — DONE ✓

See change log below.

---

## Dev environment

| Service | URL |
|---|---|
| core-api | http://localhost:4001/api/v1 |
| Swagger | http://localhost:4001/docs |
| Postgres | localhost:**5433** |

```bash
docker compose -f infra/docker/docker-compose.yml up -d
cd backend && npm run start:core
```

---

## Change log

| Date | Phase | What changed |
|---|---|---|
| 2026-07-14 | 7 | Phase 7 DONE — executive KPIs, PayslipSnapshot payroll metrics, analytics-ai stubs, 102 paths, E2E tested |
| 2026-07-14 | 6 | Phase 6 DONE — notifications outbox, integration-gateway, worker, realtime SSE, vision-ai, 93 paths, E2E tested |
| 2026-07-14 | 5 | Phase 5 DONE — finance, procurement, inventory, assets, 88 Swagger paths, E2E tested |
| 2026-07-14 | 4 | Phase 4 DONE — HR, recruitment, payroll snapshots, loans, 67 Swagger paths, E2E tested |
| 2026-07-14 | 3 | Phase 3 DONE — access, visitors, parking APIs, HMAC gate codes, ANPR ingest, 48 Swagger paths |
| 2026-07-14 | 2 | Phase 2 DONE — field ops APIs, research doc, 34 Swagger paths, E2E tested |
| 2026-07-14 | 1 | Phase 1 DONE — Docker, migrate, seed, API tested |
| 2026-07-14 | 1 | Postgres host port → 5433 |
