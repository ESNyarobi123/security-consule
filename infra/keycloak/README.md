# PSSMS Keycloak (local bootstrap)

Dev realm export for Keycloak 26. Imports realm `pssms` with seed-aligned users and clients for dual-mode auth (`AUTH_MODE=dual`).

## Start

From the repo root (or `infra/docker`):

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres keycloak
```

Keycloak waits on Postgres health, then runs `start-dev --import-realm` and loads JSON from this directory (`../keycloak` → `/opt/keycloak/data/import`).

## Admin console

| Item | Value |
|------|--------|
| URL | http://localhost:8080 |
| Realm | `pssms` (switch from `master` after login) |
| Admin user | `KEYCLOAK_ADMIN` (default `admin`) |
| Admin password | `KEYCLOAK_ADMIN_PASSWORD` (default `admin_dev_password`) |

OpenID issuer (apps): `http://localhost:8080/realms/pssms`

## Seed users (dev only)

All passwords: `ChangeMe123!` (username = email).

- `admin@highlink.co.tz`
- `gm@highlink.co.tz`
- `guard1@highlink.co.tz`
- `gate1@highlink.co.tz`
- `parking1@highlink.co.tz`
- `supervisor1@highlink.co.tz`
- `portal@demo-mfg.co.tz`
- `portal@uniforms.co.tz`

These mirror Prisma seed emails for local e2e against Keycloak.

Keycloak 26 may attach **Verify Profile** if `firstName`/`lastName` are missing — all seed users include names + empty `requiredActions` so ROPC works.

## Clients

| Client ID | Type | Notes |
|-----------|------|--------|
| `pssms-api` | Confidential | Secret `change_me_pssms_api` → set `KEYCLOAK_CLIENT_SECRET` the same. **Direct access grants (ROPC) enabled for e2e only** — do not use ROPC in production. |
| `pssms-admin-web` | Public | Authorization code + PKCE; redirect `http://localhost:3000/*`, origins `+` / localhost:3000. |

## Re-import behaviour

`--import-realm` **skips** a realm that already exists in the Keycloak DB. Editing `pssms-realm.json` alone will **not** update an existing `pssms` realm.

To force a clean re-import in dev:

1. Remove the realm in the admin console, **or**
2. Wipe Keycloak’s Postgres schema / recreate volumes and start again.

Production should manage realm config via GitOps or the admin API, not repeated JSON import.

## Secrets

- `change_me_pssms_api` and `ChangeMe123!` are **dev placeholders only**.
- Never reuse these in staging/production; rotate client secret and bootstrap admin password via env / secret manager.
- Keep `.env` secrets out of git; `.env.example` documents the expected variable names.
