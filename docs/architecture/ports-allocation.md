# PSSMS — Port Allocation

Mgawanyo rasmi wa ports kwa services zote. Usibadilishe bila kuupdate document hii.

## Ranges

| Range | Matumizi |
|---|---|
| 3000–3099 | Frontend apps (Next.js) |
| 3100–3399 | Logging/monitoring UIs (Loki, Grafana) |
| 4000–4099 | Backend services (NestJS) |
| 5000–5999 | Databases na brokers (Postgres, RabbitMQ) |
| 6000–6999 | Cache (Redis) |
| 8000–8099 | Python AI services (FastAPI) |
| 8080–8999 | IAM na MQTT (Keycloak, EMQX WS) |
| 9000–9099 | Object storage na metrics (MinIO, Prometheus) |

## Frontend (Next.js)

| Port | App | Portals za document zinazohudumiwa |
|---|---|---|
| 3000 | `admin-web` | 35.1 Super Admin, 35.3 Administration, 35.4 HR, 35.5 Employee Self-Service, 35.15 Finance, 35.16 Payroll, 35.18 Procurement & Inventory, 35.19 Marketing, 35.20 Call Centre, 35.21 Compliance/DPO, 35.22 CCTV Monitoring, 35.23 Branch Operations, 35.24 Developer & Integration |
| 3001 | `executive-web` | 35.2 Executive Dashboard |
| 3002 | `customer-web` | 35.8 Customer Portal, 35.9 Customer Employee Access |
| 3003 | `supplier-web` | 35.17 Supplier Portal |
| 3004 | `recruitment-web` | 35.13 Recruitment Portal, 35.14 Other Security Company Portal |
| 3005 | `visitor-web` | 35.10 Visitor Appointment Portal |
| 3006 | `parking-web` | 35.12 Parking Management Portal |
| 3007 | `public-web` | Company website |

> Portals za ndani (HR, Payroll, Finance, n.k.) ni routes ndani ya `admin-web`
> (`/hr`, `/payroll`, `/finance`, `/procurement`, `/compliance`, `/operations`, `/cctv`, ...)
> kwa role-based navigation. External portals ni deployments tofauti kwa sababu za
> security na branding.

## Backend (NestJS)

| Port | Service | Kazi | Libs zinazobebwa |
|---|---|---|---|
| 4000 | `api-gateway` | Entry point moja — auth, routing, rate limiting, request logging, BFF per portal | identity (guards), shared |
| 4001 | `core-api` | Modular monolith — business modules zote | libs zote za domain |
| 4002 | `background-worker` | Payroll runs, alertness schedules, invoice alerts, notifications dispatch, document generation | payroll, attendance, finance, notifications |
| 4003 | `integration-gateway` | Provider adapters + webhook inbox — banks, mobile money, SMS, WhatsApp, biometric devices, retries, DLQ, circuit breakers | notifications, finance adapters |
| 4004 | `realtime-gateway` | WebSocket/SSE kwa dashboards + MQTT bridge kwa devices (gates, biometrics, guard app live events) | attendance, access-control, incidents events |
| 4005 | `reporting-service` | Dashboard APIs, projections/materialized views, exports, scheduled reports | reporting |

Mobile apps (guard, supervisor, gate) zinaongea na `api-gateway` (4000) na
`realtime-gateway` (4004) — hazina ports zao za server.

## Python AI Services (FastAPI)

| Port | Service | Kazi |
|---|---|---|
| 8000 | `vision-ai-service` | ANPR (number plates), facial recognition, CCTV analytics, OCR ya documents. Inapokea snapshots/streams kutoka NVR, inarudisha events/metadata kwa `core-api` |
| 8001 | `analytics-ai-service` | Fraud/anomaly detection, payroll forecasting, risk scoring, heavy ETL |

## Infrastructure

| Port | Service | Kazi |
|---|---|---|
| 5433 | PostgreSQL | Primary database (host port — Docker maps 5433→5432; avoids local Postgres clash) |
| 6379 | Redis | Cache, sessions, distributed locks, rate limiting |
| 5672 | RabbitMQ AMQP | Business events (`contract.activated`, `attendance.period-approved`, ...) |
| 15672 | RabbitMQ UI | Management dashboard |
| 1883 | EMQX MQTT | Device events — biometric devices, barrier gates, checkpoints |
| 8083 | EMQX WS | MQTT over WebSocket |
| 18083 | EMQX Dashboard | Broker management |
| 9000 | MinIO S3 | Documents, evidence, CCTV snapshots, payslips |
| 9001 | MinIO Console | Storage management UI |
| 8080 | Keycloak | IAM / SSO |
| 9090 | Prometheus | Metrics |
| 3100 | Loki | Centralized logs |
| 3300 | Grafana | Dashboards za monitoring |

## Kanuni

1. Kila service mpya ipewe port kutoka range yake na iandikwe hapa kabla ya kutumika.
2. Production: ports hizi ni za internal network tu — kila kitu kinapita nginx/ingress (80/443).
3. Module ikitolewa kutoka `core-api` kuwa microservice, inapewa port inayofuata kwenye 40xx
   (mfano: `payroll-service` → 4006, `attendance-service` → 4007, `finance-service` → 4008).
