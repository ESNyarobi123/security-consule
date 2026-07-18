# PSSMS — System Architecture Blueprint

## 1. High-Level Architecture

```text
                        NEXT.JS APPLICATIONS (3000–3007)
 ┌─────────────────────────────────────────────────────────────────┐
 │ admin-web | executive-web | customer-web | supplier-web         │
 │ recruitment-web | visitor-web | parking-web | public-web        │
 └─────────────────────────────────────────────────────────────────┘
          │                                        MOBILE APPS
          │                        ┌───────────────────────────────┐
          │                        │ guard-app | supervisor-app    │
          │                        │ gate-verification-app         │
          │                        └───────────────┬───────────────┘
          ▼                                        ▼
                    API GATEWAY / BFF (4000)
                  NestJS + Fastify Adapter
          │                    │                    │
   Synchronous APIs      Business Events      Real-time Events
     REST/HTTP           RabbitMQ (5672)      realtime-gateway (4004)
          │                    │               WebSocket/SSE + MQTT (1883)
          ▼                    ▼                    ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │              CORE-API (4001) — MODULAR MONOLITH                 │
 │  identity | enterprise | customers | contracts | workforce      │
 │  recruitment | operations | attendance | access-control         │
 │  visitors | parking | payroll | employee-loans | finance        │
 │  procurement | inventory | assets | incidents | occurrence-book │
 │  compliance | approvals | notifications | documents | audit     │
 └─────────────────────────────────────────────────────────────────┘
     │                │                  │                 │
     ▼                ▼                  ▼                 ▼
 background-      integration-      reporting-       Python AI
 worker (4002)    gateway (4003)    service (4005)   (8000, 8001)
     │                │
     │                ▼
     │    ┌──────────────────────────────────────────┐
     │    │        INTEGRATION PLATFORM              │
     │    │ Banks | Mobile Money | SMS | WhatsApp    │
     │    │ Email | Biometrics | CCTV | ANPR | RFID  │
     │    │ NFC | Alarm Systems | Push               │
     │    └──────────────────────────────────────────┘
     ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PostgreSQL (5432) | Redis (6379) | MinIO (9000)                 │
 │ RabbitMQ (5672) | EMQX (1883) | Keycloak (8080)                 │
 └─────────────────────────────────────────────────────────────────┘
```

## 2. Domain Module Structure

Kila lib ndani ya `backend/libs/<module>/` ina layers nne:

```text
<module>/
├── domain/           # Entities, value objects, domain events, business rules
├── application/      # Use cases, commands, queries, ports (interfaces)
├── infrastructure/   # Repositories (Prisma), external adapters, event publishers
└── presentation/     # Controllers, DTOs, request validation
```

### Kanuni za Module Isolation

- Module HAIGUSI repository ya module nyingine directly.
- Mawasiliano kati ya modules: **application ports** (sync) au **domain events** (async).

```text
❌ PayrollService -> AttendanceRepository
✅ PayrollService -> AttendanceQueryPort
✅ attendance.period-approved event -> Payroll inahifadhi snapshot
```

## 3. Database Ownership (schema-per-domain)

PostgreSQL moja, schemas tofauti — kila schema inamilikiwa na module moja tu:

```text
iam.*            -> identity
enterprise.*     -> enterprise
customers.*      -> customers
contracts.*      -> contracts
workforce.*      -> workforce, recruitment
operations.*     -> operations
attendance.*     -> attendance (guard attendance PEKE — separate na access.*)
access.*         -> access-control (customer employee attendance)
visitors.*       -> visitors
parking.*        -> parking
payroll.*        -> payroll, employee-loans
reporting.*       -> reporting (KPI snapshots — read-only across domains)
finance.*        -> finance
procurement.*    -> procurement, inventory, assets
incidents.*      -> incidents, occurrence-book
compliance.*     -> compliance
approvals.*      -> approvals engine
audit.*          -> audit (append-only)
integrations.*   -> integration-gateway outbound/inbound
notifications.*  -> notifications + outbox
keycloak.*       -> Keycloak internal
```

Kila table muhimu ina context columns:

```text
organization_id | customer_id | branch_id | site_id
created_by | created_at | updated_by | updated_at | version
```

**Row-Level Security (RLS)** ni lazima kwenye customer-facing data:
customer employees, customer attendance, customer payroll, visitors,
parking records, invoices, incidents.

## 4. Event Flows Muhimu

### Contract Activation

```text
contract.activated
    → customers: create customer site
    → operations: request guard deployment
    → finance: create invoice schedule
    → contracts: create SLA monitoring rules
```

### Guard Duty Lifecycle

```text
guard.clocked-in → attendance verified → shift activated
    → alertness checks scheduled (background-worker)
    → missed confirmation → supervisor + control room alerted
    → unresolved → incident created
    → shift ends → attendance.period-approved → payroll snapshot
```

### Visitor Verification

```text
appointment requested → host approval → verification code (expiry, one-time,
site/gate restriction, signed) → SMS/WhatsApp/Email → gate scan
    → valid: entry recorded → occurrence book
    → invalid/expired/reused: entry denied + alert + incident
```

### ANPR / Parking

```text
Camera/NVR → vision-ai-service (8000) → plate result
    → parking module → permission decision → gate opens/denies
    → violation → incident + billing where applicable
```

### Payroll (immutable snapshots)

```text
Payroll batch inahifadhi: rules version, attendance snapshot, allowance snapshot,
deduction snapshot, calculation result, created_by, reviewed_by, approved_by,
payment reference. Tenant type: INTERNAL_COMPANY | CUSTOMER_MANAGED_PAYROLL.
```

## 5. Approval Workflow Engine (libs/approvals)

Shared engine — HAKUNA hardcoded approvals ndani ya modules. Inatumika kwa:
leave, loans, recruitment, payroll, petty cash, payment vouchers, purchase orders,
supplier registration, contracts, incidents, asset disposal.

```text
WorkflowDefinition → WorkflowVersion → Steps
Step: required role, min approvers, amount threshold, branch/department,
      escalation time, rejection rules
Rule: creator ≠ approver (document 35A.2)
```

## 6. Security Model

- **RBAC + ABAC**: role + organization_id + branch_id + allowed_sites kwenye kila check.
- Keycloak kwa authentication (SSO, MFA); internal permission service kwa authorization.
- Kila action inaandikwa `audit.*` (append-only).
- Occurrence Book: original entry haibadiliki; correction = version mpya + reason + approver.
- Offline events (guard app): device inasign event; server inahifadhi `device_time`,
  `server_received_time`, GPS time, sync status.

## 7. CCTV / Video

Video HAIPITI NestJS API. Inabaki NVR/VMS + MinIO. `vision-ai-service` inachakata
na kutuma metadata tu:

```text
camera_id, site_id, event_type, detected_at, confidence,
snapshot_url, video_clip_url, incident_id
```

## 8. Extraction Path (monolith → microservices)

Load ikiongezeka, module inatolewa kutoka `core-api` bila rewrite kwa sababu
boundaries tayari ni kali:

```text
payroll module     → payroll-service (4006)
attendance module  → attendance-service (4007)
finance module     → finance-service (4008)
notifications      → notification-service (4009)
```

Kila extraction: schema yake tayari iko separate, events tayari zinapita RabbitMQ,
ports/adapters tayari zimefungwa — inahamishwa deployment tu.
