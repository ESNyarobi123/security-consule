# Phase 3 — API Endpoints Catalog

Base: `http://localhost:4001/api/v1` | Swagger: `/docs`

Design: `docs/architecture/phase-3-access-visitors-parking-design.md`

## Enterprise — Gates (`@pssms/enterprise`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/enterprise/gates` | Bearer | `{ siteId, code, name, gateType? }` | Gate |
| GET | `/enterprise/gates?siteId=` | Bearer | — | Gate[] |

## Access Control — customer employees (`@pssms/access-control`)

Separate from guard attendance (`attendance.*`).

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/access/employees` | Bearer | `{ customerId, fullName, email?, phone?, department?, accessCardRef?, biometricRef? }` | CustomerEmployee |
| GET | `/access/employees?customerId=` | Bearer | — | CustomerEmployee[] |
| POST | `/access/entries` | Bearer | `{ customerId, employeeId, siteId, gateId?, entryType, accessMethod?, clientEventId? }` | AccessEntry |
| GET | `/access/entries?customerId=&siteId=` | Bearer | — | AccessEntry[] |

**Isolation:** all queries scoped by `organizationId`; employee lists require `customerId`.

## Visitors (`@pssms/visitors`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/visitors/appointments` | Public or Bearer | `{ organizationId?, customerId, siteId, gateId?, visitorName, purpose, validFrom, validUntil, ... }` | VisitorAppointment |
| GET | `/visitors/appointments?customerId=&siteId=&status=` | Bearer | — | VisitorAppointment[] |
| POST | `/visitors/appointments/:id/approve` | Bearer | — | `{ appointment, verificationCode, validUntil, siteId, gateId }` |
| POST | `/visitors/appointments/:id/reject` | Bearer | `{ reason }` | VisitorAppointment |
| POST | `/visitors/gate/verify` | Bearer (guard) | `{ code, siteId, gateId?, clientEventId? }` | `{ allowed, result, entry }` |
| GET | `/visitors/entries?siteId=` | Bearer | — | VisitorEntry[] |

**Verification code rules:** HMAC-SHA256 hash stored; plain code returned once on approve; one-time use; site/gate bound; expiry enforced; all attempts audited.

## Parking (`@pssms/parking`)

ANPR metadata ingested here — recognition runs in `vision-ai-service` (Phase 6).

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/parking/vehicles` | Bearer | `{ plateNumber, customerId?, vehicleType?, make?, model?, color?, ownerName?, ownerPhone? }` | Vehicle |
| GET | `/parking/vehicles?customerId=` | Bearer | — | Vehicle[] |
| POST | `/parking/permits` | Bearer | `{ vehicleId, siteId, permitNumber, permitType, validFrom, validUntil }` | ParkingPermit |
| GET | `/parking/permits?siteId=` | Bearer | — | ParkingPermit[] |
| POST | `/parking/anpr-results` | Bearer | `{ siteId, gateId?, plateNumber, confidence?, cameraId?, imageUrl?, capturedAt, rawPayload? }` | AnprResult (decision=PENDING) |
| GET | `/parking/anpr-results?siteId=` | Bearer | — | AnprResult[] |
| PATCH | `/parking/anpr-results/:id/decide` | Bearer | `{ decision: ALLOW\|DENY, denyReason? }` | AnprResult + entry/violation |
| POST | `/parking/entries` | Bearer | `{ siteId, gateId?, plateNumber, direction, clientEventId? }` | ParkingEntry |
| GET | `/parking/entries?siteId=` | Bearer | — | ParkingEntry[] |
| POST | `/parking/violations` | Bearer | `{ siteId, plateNumber, violationType, description? }` | ParkingViolation |

## Seeded demo data (Phase 3)

| Resource | Value |
|---|---|
| Customer | `CUST-DEMO` — Demo Manufacturing Ltd |
| Site | `SITE-WAREHOUSE-A` (linked to customer) |
| Gates | `GATE-MAIN`, `GATE-VEHICLE` |
| Employee | Jane Doe — `jane.doe@demo-mfg.co.tz`, card `CARD-EMP-1001` |
| Vehicle | `T123ABC` — permit `PRM-DEMO-001` |

## E2E test flow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:4001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}' | jq -r '.data.accessToken')

# 2. Get customer + site IDs from list endpoints
curl -s "http://localhost:4001/api/v1/customers" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:4001/api/v1/enterprise/sites" -H "Authorization: Bearer $TOKEN"

# 3. Customer employee check-in
# POST /access/entries with customerId, employeeId, siteId

# 4. Visitor flow: create → approve → gate verify (use guard token)
# 5. Parking: ANPR ingest → decide ALLOW for T123ABC
```
