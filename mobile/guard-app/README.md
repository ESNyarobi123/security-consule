# HIGHLINK Guard App (Phase 12–14)

Expo Router offline-first guard client. Queues field events in SQLite and syncs to **core-api :4001** `POST /api/v1/field/sync`.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Requires `core-api` on `:4001` with seed data (`guard1@highlink.co.tz` / `SITE-WAREHOUSE-A` / `CP-GATE-01`).

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e:field-sync` | Login + field/sync CLOCK_IN + replay |
| `npm run e2e:duty` | Phase 14: clock-in → alertness → patrol → clock-out |

## Screens (Phase 14)

| Route | Role |
|---|---|
| Duty (home) | Clock in/out queue, links to Alertness / Patrol / Outbox |
| Alertness | List pending checks; confirm queues `ALERTNESS_CONFIRM` |
| Patrol | TextInput QR/code (default `CP-GATE-01`); queues `PATROL_SCAN` |
| Outbox | Sync pending events; colored event-type badges |

Open attendance id is stored after synced `CLOCK_IN` (`pssms.guard.openAttendanceId`) and cleared on synced `CLOCK_OUT`.

## Scope (v1)

- Offline-first outbox: `CLOCK_IN`, `ALERTNESS_CONFIRM`, `PATROL_SCAN`, `CLOCK_OUT`
- Demo GPS / typed checkpoint codes — no face, NFC, or camera barcode
- No customers, access-control, supervisor, gate, or payroll APIs
