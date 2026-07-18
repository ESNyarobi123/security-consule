# Phase 15 — Parking ops endpoints

Base: `http://localhost:4001/api/v1`

## Login

```http
POST /auth/login
{ "email": "parking1@highlink.co.tz", "password": "ChangeMe123!" }
```

## Permits (creator ≠ approver)

```http
POST /parking/permits          → status PENDING
POST /parking/permits/:id/approve   # different user than createdBy
POST /parking/permits/:id/reject
GET  /parking/permits?status=ACTIVE|PENDING&siteId=
```

Demo seed: `PRM-DEMO-001` / `T123ABC` remains **ACTIVE**.

## ANPR (results only)

```http
POST /parking/anpr-results
GET  /parking/anpr-results?decision=PENDING&siteId=
PATCH /parking/anpr-results/:id/decide
{ "decision": "ALLOW" | "DENY", "denyReason?": "…" }
```

ALLOW → parking entry; DENY → `NO_PERMIT` violation.

## Entries / violations / blacklist

```http
GET  /parking/entries?siteId=
GET  /parking/violations?siteId=
GET  /parking/blacklist?active=true
POST /parking/blacklist
{ "plateNumber", "reason" }
PATCH /parking/blacklist/:id/deactivate
```
