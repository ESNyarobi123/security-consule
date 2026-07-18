# HIGHLINK — Private Security Services Management System (PSSMS)

Enterprise platform ya kusimamia operations zote za kampuni ya private security:
guard operations, customers & contracts, attendance & alertness, visitors & access control,
parking, HR & recruitment, payroll & loans, finance & billing, procurement & assets,
CCTV/AI monitoring, incidents, compliance na executive analytics.

Design document: `PRIVATE SECURITY SERVICES MANAGEMENT SYSTEM DESIGN.docx`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript (Turborepo monorepo) |
| Core Backend | NestJS + Fastify Adapter (modular monolith, domain boundaries kali) |
| AI / Vision | Python + FastAPI (ANPR, Facial Recognition, CCTV analytics, OCR) |
| Database | PostgreSQL (schema-per-domain + Row-Level Security) |
| Cache / Sessions / Locks | Redis |
| Business Events | RabbitMQ |
| Device Events | MQTT (EMQX) |
| File Storage | MinIO (S3-compatible) |
| AuthN / IAM | Keycloak + internal RBAC + ABAC |
| Mobile | React Native / Expo (offline-first kwa Guard App) |
| Monitoring | OpenTelemetry, Prometheus, Grafana, Loki |

---

## Repository Structure

```text
Security console/
├── backend/                          # Backend zote (Node + Python)
│   ├── apps/                         # Deployable units (kila moja na port yake)
│   │   ├── api-gateway/              # NestJS — API Gateway / BFF (auth, routing, rate-limit)
│   │   ├── core-api/                 # NestJS — business modules zote (modular monolith)
│   │   ├── background-worker/        # NestJS — payroll jobs, alerts, notifications, documents
│   │   ├── integration-gateway/      # NestJS — banks, mobile money, SMS, WhatsApp, biometrics, webhooks
│   │   ├── realtime-gateway/         # NestJS — WebSocket/SSE + MQTT bridge (devices, guard app events)
│   │   ├── reporting-service/        # NestJS — dashboards, projections, exports, scheduled reports
│   │   ├── vision-ai-service/        # Python FastAPI — ANPR, face recognition, CCTV analytics, OCR
│   │   └── analytics-ai-service/     # Python FastAPI — anomaly/fraud detection, forecasting, risk scoring
│   │
│   ├── libs/                         # Domain modules (kila moja: domain/application/infrastructure/presentation)
│   │   ├── shared/                   # Base classes, events, guards, decorators, utils
│   │   ├── identity/                 # IAM — users, roles, permissions, MFA, sessions (RBAC + ABAC)
│   │   ├── enterprise/               # Master data — company, branches, departments, sites, gates, zones
│   │   ├── customers/                # Customers, locations, contacts, complaints
│   │   ├── contracts/                # Contracts, SLA, renewals, pricing, termination
│   │   ├── workforce/                # Employees, guards, HR records, leave, discipline, training
│   │   ├── recruitment/              # Applicants, screening, interviews + recruitment kwa security companies nyingine
│   │   ├── operations/               # Deployment, shifts, site assignments, control room, field inspections
│   │   ├── attendance/               # Guard clock-in/out, alertness confirmations, patrols, checkpoints
│   │   ├── access-control/           # Customer employee access — cards, biometrics, gates, zones
│   │   ├── visitors/                 # Appointments, host approval, verification codes, gate verification
│   │   ├── parking/                  # Vehicles, permits, allocation, violations, parking billing
│   │   ├── payroll/                  # Company payroll + customer payroll (immutable snapshots)
│   │   ├── employee-loans/           # Boots/smartphone/cash loans, salary advance, repayments
│   │   ├── finance/                  # Invoices, receipts, petty cash, vouchers, reconciliation
│   │   ├── procurement/              # Suppliers, quotations, purchase requests/orders, GRN
│   │   ├── inventory/                # Stock, uniforms, equipment, stock movements
│   │   ├── assets/                   # Asset register, assignment, maintenance, disposal
│   │   ├── incidents/                # Incidents, evidence, escalation, investigation
│   │   ├── occurrence-book/          # Electronic Occurrence Book (append-only + versioned corrections)
│   │   ├── compliance/               # DPO, audit reviews, risk register, breach management
│   │   ├── approvals/                # Shared Approval Workflow Engine (creator ≠ approver)
│   │   ├── notifications/            # SMS, Email, WhatsApp, Push templates & dispatch
│   │   ├── documents/                # File uploads, document store (MinIO), e-signatures
│   │   ├── audit/                    # Immutable audit trail ya kila action
│   │   └── reporting/                # Projections, materialized views, dashboard queries
│   │
│   └── prisma/                       # Database schema, migrations, seeds
│
├── frontend/                         # Next.js monorepo (Turborepo)
│   ├── apps/
│   │   ├── admin-web/                # Internal portals zote (role-based navigation: /hr, /payroll, /finance...)
│   │   ├── executive-web/            # Executive dashboards (CMD, CEO, GM)
│   │   ├── customer-web/             # Customer Portal + Customer Employee Access
│   │   ├── supplier-web/             # Supplier Portal
│   │   ├── recruitment-web/          # Applicant Portal + Other Security Company Portal
│   │   ├── visitor-web/              # Visitor Appointment Portal (public-facing)
│   │   ├── parking-web/              # Parking Management Portal
│   │   └── public-web/               # Company website / marketing
│   │
│   └── packages/
│       ├── ui/                       # Shared design system components
│       ├── api-client/               # Generated typed API client (OpenAPI)
│       ├── auth/                     # Auth helpers, session, token refresh
│       ├── permissions/              # Frontend permission checks (RBAC/ABAC mirrors)
│       ├── types/                    # Shared TypeScript types/DTOs
│       ├── validation/               # Shared zod schemas
│       ├── config/                   # ESLint, TS, Tailwind shared configs
│       ├── hooks/                    # Shared React hooks
│       └── i18n/                     # Swahili / English translations
│
├── mobile/                           # React Native / Expo apps
│   ├── guard-app/                    # Attendance, alertness, patrols, incidents (OFFLINE-FIRST)
│   ├── supervisor-app/               # Verification, approvals, inspections, monitoring
│   └── gate-verification-app/        # Visitor codes, staff cards, parking permits, vehicle entry
│
├── infra/                            # Infrastructure as code
│   ├── docker/                       # docker-compose files (dev environment nzima)
│   ├── k8s/                          # Kubernetes manifests (base + dev/staging/production overlays)
│   ├── nginx/                        # Reverse proxy configs
│   ├── monitoring/                   # Prometheus, Grafana, Loki configs
│   ├── mqtt/                         # EMQX/MQTT broker config
│   ├── rabbitmq/                     # RabbitMQ definitions (exchanges, queues, DLQ)
│   ├── minio/                        # Object storage policies
│   └── keycloak/                     # Realm exports, IAM config
│
├── docs/
│   ├── architecture/                 # System architecture, service map, ports, event flows
│   ├── api/                          # OpenAPI specs
│   ├── database/                     # Schema ownership, RLS policies, ERDs
│   ├── integrations/                 # Banks, mobile money, biometrics, CCTV, ANPR vendor docs
│   └── workflows/                    # Approval matrices, business workflows (35B/35D)
│
├── scripts/                          # Dev/ops helper scripts
└── .github/workflows/                # CI/CD pipelines
```

---

## Services na Ports

### Frontend (Next.js) — 3000–3007

| Port | App | Watumiaji |
|---|---|---|
| 3000 | `admin-web` | Super Admin, Admin, HR, Payroll, Finance, Procurement, Operations, Compliance, CCTV, Call Centre, Marketing, Branch |
| 3001 | `executive-web` | Chairman/MD, CEO, GM, Department Heads |
| 3002 | `customer-web` | Customers + customer employees |
| 3003 | `supplier-web` | Suppliers, vendors, contractors |
| 3004 | `recruitment-web` | Applicants + other security companies |
| 3005 | `visitor-web` | Visitors/guests (public) |
| 3006 | `parking-web` | Parking administrators, gate officers |
| 3007 | `public-web` | Public company website |

### Backend (NestJS) — 4000–4005

| Port | Service | Kazi |
|---|---|---|
| 4000 | `api-gateway` | Single entry point — auth, routing, rate limiting, BFF |
| 4001 | `core-api` | Business modules zote (modular monolith) |
| 4002 | `background-worker` | Jobs, alerts, payroll runs, notifications (health/metrics endpoint) |
| 4003 | `integration-gateway` | Banks, mobile money, SMS, WhatsApp, biometrics, webhooks inbox |
| 4004 | `realtime-gateway` | WebSocket/SSE, MQTT bridge, live dashboards, device events |
| 4005 | `reporting-service` | Dashboard APIs, projections, exports, scheduled reports |

### AI Services (Python FastAPI) — 8000–8001

| Port | Service | Kazi |
|---|---|---|
| 8000 | `vision-ai-service` | ANPR, facial recognition, CCTV analytics, OCR |
| 8001 | `analytics-ai-service` | Fraud/anomaly detection, forecasting, risk scoring |

### Infrastructure

| Port | Service |
|---|---|
| 5432 | PostgreSQL |
| 6379 | Redis |
| 5672 / 15672 | RabbitMQ (AMQP / Management UI) |
| 1883 / 8083 | MQTT — EMQX (TCP / WebSocket) |
| 9000 / 9001 | MinIO (S3 API / Console) |
| 8080 | Keycloak |
| 9090 | Prometheus |
| 3100 | Loki |
| 3300 | Grafana |

Angalia `docs/architecture/ports-allocation.md` kwa maelezo kamili.

---

## Kuanza (Development)

```bash
# 1. Nakili environment variables
cp .env.example .env

# 2. Washa infrastructure (Postgres, Redis, RabbitMQ, MQTT, MinIO, Keycloak, monitoring)
docker compose -f infra/docker/docker-compose.yml up -d

# 3. Backend (baada ya scaffolding ya NestJS)
cd backend && npm install && npm run start:dev

# 4. Frontend (baada ya scaffolding ya Turborepo)
cd frontend && npm install && npm run dev
```

---

## Implementation Phases

| Phase | Scope |
|---|---|
| 0 | Discovery — authority matrix, viewing hierarchy, vendors, payroll rules, volumes |
| 1 | Platform Foundation — IAM, MFA, org/branches/sites, audit, documents, notifications, approval engine, customers, contracts |
| 2 | Core Security Operations — guards, deployment, shifts, attendance, alertness, patrols, occurrence book, incidents, mobile apps |
| 3 | Access, Visitors & Parking — customer employee access, appointments, gate verification, permits, violations |
| 4 | HR & Payroll — recruitment, HR, leave, training, loans, company + customer payroll |
| 5 | Finance & Procurement — invoices, payments, petty cash, vouchers, suppliers, PO, inventory, assets |
| 6 | Advanced Integrations — biometrics, RFID/NFC, ANPR, CCTV, alarms, banks, mobile money, AI surveillance |
| 7 | Executive Analytics — dashboards, SLA metrics, revenue, payroll costs, incident trends, risk analytics |

---

## Kanuni Muhimu za Architecture

1. **Portal ≠ Microservice** — portals 24 zinatumia business services chache zilizogawanywa ki-domain.
2. **Modular monolith kwanza** — `core-api` ina libs zote; module yenye load kubwa inatolewa baadaye kuwa microservice bila rewrite.
3. **Module isolation** — module haigusi repository ya module nyingine directly; inatumia ports/events (`attendance.period-approved` → payroll snapshot).
4. **Creator ≠ Approver** — approval engine ya shared (`libs/approvals`) inatumika kwa leave, loans, payroll, petty cash, vouchers, PO, contracts, incidents.
5. **Data separation** — `organization_id`/`customer_id` mandatory + PostgreSQL Row-Level Security kwenye customer-facing data.
6. **Payroll snapshots** — payroll haihesabiwi live; kila batch ina immutable snapshot (rules version, inputs, approvals).
7. **CCTV video haipiti Node API** — video inabaki NVR/MinIO; `vision-ai-service` inatuma events/metadata tu.
8. **Occurrence Book ni append-only** — corrections zinaunda version mpya na reason + approver.
9. **Offline-first Guard App** — signed local events, server inarekodi `device_time` + `server_received_time`.
