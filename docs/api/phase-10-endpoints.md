# Phase 10 — Supplier & visitor endpoints

Base: `http://localhost:4001/api/v1`

## Supplier portal

```http
POST /auth/login
{ "email": "portal@uniforms.co.tz", "password": "ChangeMe123!" }
```

```http
GET /procurement/suppliers/me
Authorization: Bearer <token>
```

```http
GET /procurement/purchase-orders
Authorization: Bearer <token>
```

Cross-supplier filter → `403 SUPPLIER_SCOPE_DENIED`.

## Visitor public

```http
GET /visitors/public-config
```

```http
POST /visitors/appointments
{
  "organizationId": "...",
  "customerId": "...",
  "siteId": "...",
  "visitorName": "Ada Visitor",
  "purpose": "Meeting",
  "validFrom": "2026-07-16T08:00:00.000Z",
  "validUntil": "2026-07-16T17:00:00.000Z"
}
```

Response includes `referenceNumber` and `status: PENDING`. No verification code.
