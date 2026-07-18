# Phase 2 — API Endpoints Catalog

Base: `http://localhost:4001/api/v1` | Swagger: `/docs`

Research-backed design: `docs/architecture/phase-2-field-ops-design.md`

## Guards (`@pssms/workforce`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/guards` | Bearer | `{ userId, employeeNumber, phone? }` | GuardProfile |
| GET | `/guards` | Bearer | — | GuardProfile[] |
| PATCH | `/guards/:id/status` | Bearer | `{ status, deploymentEligible? }` | GuardProfile |

## Operations (`@pssms/operations`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/operations/shifts` | Bearer | `{ siteId, name, startAt, endAt, guardIds[], supervisorId?, instructions? }` | Shift |
| GET | `/operations/shifts?siteId=` | Bearer | — | Shift[] |
| POST | `/operations/checkpoints` | Bearer | `{ siteId, code, name, zone?, qrCode?, nfcTagId?, latitude?, longitude? }` | Checkpoint |
| GET | `/operations/checkpoints?siteId=` | Bearer | — | Checkpoint[] |
| POST | `/operations/deployments` | Bearer | `{ guardId, siteId, contractId?, startDate, endDate? }` | Deployment |
| GET | `/operations/deployments` | Bearer | — | Deployment[] |

## Attendance — guard only (`@pssms/attendance`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/attendance/clock-in` | Bearer (guard) | `{ siteId, shiftId?, method, gps: { latitude, longitude, gpsTime? }, deviceTime?, clientEventId? }` | `{ id, guardId, siteId, clockInAt, geofenceVerified, syncStatus }` |
| POST | `/attendance/clock-out` | Bearer | `{ attendanceId, method, gps, deviceTime?, clientEventId? }` | Attendance |
| GET | `/attendance?siteId=` | Bearer | — | Attendance[] |

**Geofence:** validated against site `latitude`/`longitude` (150m default). `deviceTime` + `server_received_at` stored.

## Alertness

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/attendance/alertness/schedule` | Bearer | `{ guardId, siteId, shiftId?, scheduledAt }` | AlertnessCheck |
| POST | `/attendance/alertness/confirm` | Bearer (guard) | `{ alertnessCheckId, method, gps, deviceTime?, clientEventId? }` | AlertnessCheck status=CONFIRMED |
| POST | `/attendance/alertness/:id/missed` | Bearer | — | AlertnessCheck status=MISSED + FieldAlert created |
| GET | `/attendance/alertness/pending?guardId=` | Bearer | — | AlertnessCheck[] |

## Patrols

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/attendance/patrols/scan` | Bearer (guard) | `{ siteId, checkpointId, routeId?, method, gps, qrOrNfcCode?, deviceTime?, clientEventId? }` | PatrolScan |
| GET | `/attendance/patrols?siteId=` | Bearer | — | PatrolScan[] |

## Offline sync (guard mobile)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/field/sync` | Bearer (guard) | `{ events: [{ type, clientEventId, deviceTime, payload }] }` | `[{ clientEventId, status: ACCEPTED\|DUPLICATE\|REJECTED, serverId?, message? }]` |

Event types: `CLOCK_IN`, `ALERTNESS_CONFIRM`, `PATROL_SCAN`

## Occurrence Book (`@pssms/occurrence-book`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/occurrence-book` | Bearer | `{ siteId, category, description, recordedAt }` | OccurrenceEntry (append-only) |
| POST | `/occurrence-book/:id/correct` | Bearer | `{ reason, description, category? }` | New version entry |
| GET | `/occurrence-book?siteId=` | Bearer | — | OccurrenceEntry[] (isCurrent=true) |

## Incidents (`@pssms/incidents`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/incidents` | Bearer | `{ siteId, category, title, description, severity, latitude?, longitude?, deviceReportedAt?, clientEventId? }` | Incident |
| GET | `/incidents?siteId=` | Bearer | — | Incident[] |
| PATCH | `/incidents/:id/status` | Bearer | `{ status, assignedTo? }` | Incident |

## Seeded test accounts (Phase 2)

| Email | Password | Role |
|---|---|---|
| `guard1@highlink.co.tz` | `ChangeMe123!` | GUARD (GRD-0001) |
| `admin@highlink.co.tz` | `ChangeMe123!` | SUPER_ADMIN |

Site: `SITE-WAREHOUSE-A` (lat/lng for geofence). Checkpoint: `CP-GATE-01`.

## Internal events (stubs for Phase 4+)

- `guard.clocked-in` / `guard.clocked-out` → audit
- `attendance.period-closed` → payroll snapshot (Phase 4)
- `alertness.missed` → FieldAlert → incident escalation (worker Phase 2b)
