# Phase 13 — Gate verify endpoints

Base: `http://localhost:4001/api/v1`

## Officer login

```http
POST /auth/login
{ "email": "gate1@highlink.co.tz", "password": "ChangeMe123!" }
```

## Resolve duty context

```http
GET /enterprise/sites
GET /enterprise/gates?siteId=<SITE-WAREHOUSE-A uuid>
```

## Issue code (call-centre / admin — not gate app)

Creator ≠ approver: prefer **public** `POST /visitors/appointments` (no Bearer), then admin approves.

```http
POST /visitors/appointments
(no Authorization — public pre-register)

POST /visitors/appointments/:id/approve
Authorization: Bearer <admin>
→ verificationCode (once)
```

## Gate verify

```http
POST /visitors/gate/verify
Authorization: Bearer <gate token>
{
  "code": "<otp>",
  "siteId": "<uuid>",
  "gateId": "<GATE-MAIN uuid>",
  "clientEventId": "<uuid>"
}
```

Same `clientEventId` → idempotent replay. Used code + new `clientEventId` → `DENIED_*`.
