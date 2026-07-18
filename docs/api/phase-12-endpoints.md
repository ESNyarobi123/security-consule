# Phase 12 — Guard field sync

Base: `http://localhost:4001/api/v1`

## Auth

```http
POST /auth/login
{ "email": "guard1@highlink.co.tz", "password": "ChangeMe123!" }
```

## Resolve site

```http
GET /enterprise/sites
Authorization: Bearer …
```

Use site with `code: SITE-WAREHOUSE-A`.

## Offline batch sync

```http
POST /field/sync
Authorization: Bearer …
Content-Type: application/json

{
  "events": [
    {
      "type": "CLOCK_IN",
      "clientEventId": "550e8400-e29b-41d4-a716-446655440000",
      "deviceTime": "2026-07-15T11:00:00.000Z",
      "payload": {
        "siteId": "<SITE-WAREHOUSE-A uuid>",
        "method": "MOBILE_GPS",
        "gps": { "latitude": -6.7924, "longitude": 39.2083 }
      }
    }
  ]
}
```

Result per event: `ACCEPTED` | `DUPLICATE` | `REJECTED`.

Replay same `clientEventId` must not create a second attendance row.
