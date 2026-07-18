# Phase 14 — Guard duty endpoints

Base: `http://localhost:4001/api/v1`

## Auth

```http
POST /auth/login
{ "email": "guard1@highlink.co.tz", "password": "ChangeMe123!" }
```

## Reads (online / cache)

```http
GET /enterprise/sites
GET /operations/checkpoints?siteId=<SITE-WAREHOUSE-A>
GET /attendance/alertness/pending
```

Guards: if `guardId` omitted, pending is scoped to the caller’s guard profile.

Demo checkpoint QR / code: `CP-GATE-01` (NFC tag seed: `NFC-CP-GATE-01`).

## Batch sync (primary write path)

```http
POST /field/sync
{
  "events": [
    {
      "type": "CLOCK_IN | ALERTNESS_CONFIRM | PATROL_SCAN | CLOCK_OUT",
      "clientEventId": "<uuid>",
      "deviceTime": "<ISO>",
      "payload": { }
    }
  ]
}
```

### Payloads

| type | payload |
|---|---|
| `CLOCK_IN` | `{ siteId, method?, gps }` |
| `ALERTNESS_CONFIRM` | `{ alertnessCheckId, method, gps }` |
| `PATROL_SCAN` | `{ siteId, checkpointId, method: "QR", qrOrNfcCode, gps }` |
| `CLOCK_OUT` | `{ attendanceId, method?, gps }` |

Replay same `clientEventId` → `ACCEPTED` / `DUPLICATE`. Clock-out uses `clockOutClientEventId` (separate from clock-in id).

## Seed helpers

- Checkpoint `CP-GATE-01` + `nfcTagId: NFC-CP-GATE-01`
- Alertness `ALT-DEMO-PENDING` (SCHEDULED) for `guard1` / SITE-WAREHOUSE-A
