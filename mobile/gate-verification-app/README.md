# HIGHLINK Gate Verification App (Phase 13)

Online-first Expo Router app for gate officers. Verifies visitor OTP codes via **core-api :4001** `POST /api/v1/visitors/gate/verify`.

**No offline outbox** — codes are never queued or stored; only entered ephemerally on the verify form.

## Run

```bash
cp .env.example .env
npm install
npm start
```

Requires `core-api` on `:4001` with seed data. Default login: `gate1@highlink.co.tz` / `ChangeMe123!` (use `admin@highlink.co.tz` if gate1 is not seeded yet). Demo site: `SITE-WAREHOUSE-A` · gates: `GATE-MAIN` | `GATE-VEHICLE`.

## Scripts

| Command | Purpose |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run e2e:gate-verify` | Approve appointment → verify ALLOWED → replay DENIED_* |

## Scope (v1)

- Login, duty home (online badge + site/gate picker), OTP verify, ALLOWED/DENIED result
- Never calls `/field/sync` or attendance APIs
- Never lists plaintext codes in UI/storage beyond the verify form
