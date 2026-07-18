# HIGHLINK Supervisor App (Phase 13b)

Online-first Expo Router app for site supervisors. Live board over **core-api :4001** — attendance approve, field-alert ack, open incidents, occurrence book (read).

**No SQLite / outbox** — same online-first pattern as gate-verification-app. Not the guard offline sync app, and not the gate OTP verify app.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Requires `core-api` on `:4001` with seed data.

| | |
|---|---|
| Login | `supervisor1@highlink.co.tz` / `ChangeMe123!` |
| Roles | `SUPERVISOR` or `SUPER_ADMIN` |
| Demo site | `SITE-WAREHOUSE-A` |

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e:supervisor` | API E2E: clock-in → approve → alertness miss → ack |

## Scope (v1)

- Live board (poll 20s online), alerts ack, attendance approve, incidents status bump, EOB read-only
- Never queues actions offline; Ack / Approve disabled when offline
