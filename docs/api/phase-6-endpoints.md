# Phase 6 — API Endpoints Catalog

## Core API (`http://localhost:4001`) — Notifications + Internal

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/notifications` | Bearer | Enqueue notification + outbox |
| GET | `/api/v1/notifications` | Bearer | `?status=` |
| GET | `/api/v1/notifications/:id` | Bearer | Detail |
| GET | `/api/v1/notifications/:id/attempts` | Bearer | Delivery attempts |
| POST | `/api/v1/internal/v1/finance/invoices/:id/payments` | Service token | Worker callback |
| POST | `/api/v1/internal/v1/parking/anpr-results` | Service token | Worker callback |

Visitor approve still returns `verificationCode` and now also enqueues `VISITOR_GATE_CODE` SMS.

## Integration Gateway (`http://localhost:4003`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/webhooks/payments/:provider` | Optional HMAC / idempotency key | Inbox + ACK |
| POST | `/api/v1/webhooks/anpr/:provider` | Idempotency key | Inbox + ACK |
| GET | `/api/v1/webhooks/inbox` | — | List inbox |
| POST | `/api/v1/webhooks/inbox/:id/replay` | — | Replay failed |
| POST | `/api/v1/internal/v1/dispatch` | Service token | Outbox → SMS adapter |
| POST | `/api/v1/internal/v1/anpr/recognize` | Service token | Proxy vision-ai |
| GET | `/api/v1/health` | Public | Liveness |
| GET | `/api/v1/providers/health` | — | Adapter registry |

## Background Worker (`http://localhost:4002`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness; polls outbox every 5s, webhooks every 7s |

## Realtime Gateway (`http://localhost:4004`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/events/stream?organizationId=` | SSE stream |
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/dev/publish?organizationId=&type=` | Dev publish |

## Vision AI (`http://localhost:8000`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/v1/anpr/recognize` | Stub plate recognition |
| POST | `/v1/cctv/events` | Accept metadata only |

## Start commands

```bash
cd backend
npm run start:core          # 4001
npm run start:integration   # 4003
npm run start:worker        # 4002
npm run start:realtime      # 4004
cd apps/vision-ai-service && uvicorn app.main:app --port 8000
```

## E2E verified

- Visitor approve → notification SENT (`VISITOR_GATE_CODE`)
- Payment webhook → invoice PAID (idempotent duplicate)
- ANPR webhook → plate `T123ABC` ingested
- Core Swagger paths: 93
