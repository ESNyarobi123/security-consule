# Phase 2 — Core Security Operations (Design)

Research synthesis from industry guides (2025–2026) + PSSMS rules (`pssms-field-ops`, `pssms-architecture`).

## Community best practices we adopt

| Practice | Source consensus | PSSMS implementation |
|---|---|---|
| **Dual verification** | GPS geofence + NFC/QR at checkpoints | Clock-in validates site radius; patrol scans require checkpoint code |
| **Randomized alertness** | Prevents predictability; SLA-driven | `AlertnessSchedule` per shift with interval + randomize flag |
| **Offline-first mobile** | Local DB = source of truth; UUID idempotency | `POST /field/sync` with `clientEventId`; store `deviceTime` + `serverReceivedTime` |
| **Don't trust phone clock** | Use GPS timestamp where available | Persist both timestamps; flag drift > threshold |
| **Missed check escalation** | Supervisor → control room → incident | `MISSED` alertness → `FieldAlert` record → optional incident (Phase 2b worker) |
| **Patrol proof** | NFC preferred over long-range RFID for presence | Checkpoint model with `qrCode` / `nfcTagId` + GPS at scan |
| **Append-only EOB** | Corrections = new version + approver | `OccurrenceEntry` immutable; `OccurrenceCorrection` chain |
| **Separate guard vs customer attendance** | Data separation mandate | Schema `attendance.*` only for guards; `access.*` in Phase 3 |

## Event flow (guard duty lifecycle)

```text
Shift assigned → Guard clocks in (GPS) → Attendance verified
    → Alertness checks scheduled → Confirm / Miss
    → Miss → supervisor alert (FieldAlert)
    → Patrol route scans checkpoints
    → Occurrence book / incident as needed
    → Clock out → attendance.period-closed (event stub for Phase 4 payroll)
```

## APIs (Phase 2 scope)

- **Workforce:** guard profiles
- **Operations:** shifts, assignments, deployments
- **Attendance:** clock-in/out, alertness confirm, patrol scan, offline sync
- **Occurrence book:** create entry, request correction
- **Incidents:** create, list, update status

## Out of scope (Phase 2b / later)

- Background worker for alertness scheduling cron
- realtime-gateway WebSocket push
- Photo upload to MinIO
- Mobile app UI (React Native scaffold only noted)
