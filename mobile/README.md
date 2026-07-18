# PSSMS Mobile Apps

React Native / Expo apps for field operations. **Phase 12–13 talk to `core-api` on port 4001** (`EXPO_PUBLIC_API_BASE=http://localhost:4001/api/v1`). Routing via `api-gateway` (:4000) comes later — portal/app ≠ service.

## Apps

| App | Users | Status | Features |
|---|---|---|---|
| `guard-app` | Security Guards | **Phase 12 v1** | Offline-first CLOCK_IN outbox → `POST /field/sync`. Login, duty home, outbox sync. **No** face/NFC/QR in v1 |
| `supervisor-app` | Site Supervisors, Field Officers | Scaffold only | Attendance verification, alertness, incidents (later) |
| `gate-verification-app` | Gate officers | **Phase 13 v1** | Online-only visitor OTP → `POST /visitors/gate/verify`. Login, site/gate duty, verify, ALLOWED/DENIED. **No** SQLite outbox |

## Guard app (v1)

```bash
cd mobile/guard-app
cp .env.example .env
npm install
npm start                 # Expo
npm run typecheck
npm run e2e:field-sync    # API E2E against core-api :4001 (needs seed + running API)
```

Default login: `guard1@highlink.co.tz` / `ChangeMe123!`  
Demo site: `SITE-WAREHOUSE-A` · Demo GPS: `-6.7924, 39.2083`

### Offline-first outbox

```text
Clock-in → SQLite sync_outbox (PENDING)
         → Sync Now → POST /api/v1/field/sync
         → ACCEPTED | DUPLICATE | REJECTED
```

Local statuses: `PENDING` → `SYNCING` → `ACCEPTED` | `DUPLICATE` | `REJECTED`.

Server stores `deviceTime` + `serverReceivedTime`. **Never treat the phone clock as payroll truth** — payroll uses verified hours via server events/snapshots.

Guard attendance only — this app must not call customers, access-control, or payroll APIs.

## Gate verification app (Phase 13)

```bash
cd mobile/gate-verification-app
cp .env.example .env
npm install
npm start                 # Expo
npm run typecheck
npm run e2e:gate-verify   # API E2E: approve → ALLOWED → DENIED_* (needs seed + core-api :4001)
```

Default login: `gate1@highlink.co.tz` / `ChangeMe123!` (fallback: `admin@highlink.co.tz` if seed has no gate1)  
Demo site: `SITE-WAREHOUSE-A` · Gates: `GATE-MAIN` | `GATE-VEHICLE`

### Online-only verify

```text
Enter OTP → POST /api/v1/visitors/gate/verify (+ clientEventId)
         → ALLOWED | DENIED_*
         → Clear form for next visitor
```

Codes are never queued offline and never listed in UI/storage beyond the ephemeral verify form. Does **not** call `/field/sync` or attendance APIs.
