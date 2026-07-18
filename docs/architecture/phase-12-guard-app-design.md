# Phase 12 — Guard App Offline (`mobile/guard-app`)

## Goal

Expo **guard-app** offline-first duty punch: local SQLite outbox → `POST /api/v1/field/sync` on **core-api :4001**.

App ≠ microservice. Production later: api-gateway `:4000`.

## Research applied

- SQLite outbox + unique `clientEventId` / idempotency key ([Expo offline queue patterns](https://dev.to/sathish_daggula/react-native-offline-queue-with-sqlite-expo-4bio))
- NetInfo / manual sync; treat `ACCEPTED` and `DUPLICATE` as done
- Never treat phone `deviceTime` as payroll truth — server stores `serverReceivedTime`; payroll uses snapshots

## Stack

Expo SDK 52 · expo-router · expo-sqlite · expo-secure-store · NetInfo · expo-crypto

## Screens

| Screen | Role |
|---|---|
| Login | `guard1@highlink.co.tz` |
| Home | Online badge, pending count, SITE-WAREHOUSE-A |
| Clock-in | Enqueue CLOCK_IN (demo GPS -6.7924, 39.2083) |
| Outbox | List + Sync Now |

## Sync contract

```http
POST /field/sync
Authorization: Bearer …
{
  "events": [{
    "type": "CLOCK_IN",
    "clientEventId": "<uuid>",
    "deviceTime": "…",
    "payload": {
      "siteId": "<uuid>",
      "method": "MOBILE_GPS",
      "gps": { "latitude": -6.7924, "longitude": 39.2083 }
    }
  }]
}
```

## Deferred

Face/fingerprint, NFC/QR patrol UI, alertness UI, clock-out in batch sync, supervisor/gate apps, local encryption, api-gateway cutover.
