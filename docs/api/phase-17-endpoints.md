# Phase 17 — Auth / OIDC endpoints

Base: `http://localhost:4001/api/v1` (or gateway `:4000/api/v1`).

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/auth/oidc/config` | Public | Discovery: `AUTH_MODE`, issuer, JWKS, clients, endpoints |
| POST | `/auth/login` | Public | Local email/password → HS256 access + refresh |
| POST | `/auth/refresh` | Public | Refresh local HS256 pair |
| GET | `/auth/me` | Bearer | Profile from DB; accepts local **or** Keycloak token when `AUTH_MODE` allows |

## Admin-web (Phase 17b)

| Route | Notes |
|-------|-------|
| `/login` | Dual UI: SSO (`Continue with SSO`) + local form from `oidc/config` |
| `/auth/callback` | PKCE code exchange → `/auth/me` → session cookies |

## Keycloak (IdP) — not Nest routes

| Action | Endpoint |
|--------|----------|
| ROPC (dev e2e) | `POST {KEYCLOAK_URL}/realms/pssms/protocol/openid-connect/token` |
| JWKS | `GET {KEYCLOAK_ISSUER}/protocol/openid-connect/certs` |
| Authorize (portals 17b) | `GET {KEYCLOAK_ISSUER}/protocol/openid-connect/auth` |

ROPC body (dev): `grant_type=password&client_id=pssms-api&client_secret=…&username=…&password=…`

Use the returned `access_token` as `Authorization: Bearer` against Nest. AuthZ roles come from `/auth/me`, not the Keycloak JWT claims.
