# Phase 17 — Keycloak SSO (dual JWT) + 17b admin-web PKCE

## Goal

Introduce Keycloak as the identity provider while **keeping** local `POST /auth/login` (HS256) for break-glass and E2E. Authorization remains in the PSSMS database (RBAC+ABAC) — **never** from Keycloak realm roles.

## AUTH_MODE

| Mode | Accepts | admin-web UI |
|------|---------|--------------|
| `local` | HS256 local JWTs only | Local form only |
| `dual` (default) | HS256 **and** Keycloak RS256 | SSO + local form |
| `keycloak` | Keycloak RS256 only | SSO only (`POST /auth/login` still issues HS256 the API rejects) |

## Token path (core-api)

1. Bearer token decoded; route by `iss`.
2. Keycloak issuer → JWKS (`…/protocol/openid-connect/certs`), **RS256 only** (alg gate blocks HS/RS confusion).
3. Other / missing iss → `JWT_SECRET`, **HS256 only**.
4. Keycloak `azp` must be in `KEYCLOAK_ALLOWED_AZP` (default `pssms-admin-web,pssms-api`).
5. Keycloak subject mapped via `User.keycloakSub` or email (case-insensitive) + `email_verified === true`; link-on-first-use audited as `IDENTITY_KEYCLOAK_LINK`.
6. Roles / permissions / site scope loaded with `AuthService.loadProfile` from Prisma.

Unprovisioned or inactive users → `401` with `USER_NOT_PROVISIONED`.

## Public discovery

`GET /api/v1/auth/oidc/config` — `authMode`, issuer, JWKS, client ids, authorize/token endpoints. No secrets.

## Phase 17b — admin-web Authorization Code + PKCE

1. Login → **Continue with SSO** → discover config → S256 PKCE + `state` in `sessionStorage`.
2. Keycloak authorize → `/auth/callback` → token exchange (**no client secret**).
3. `GET /auth/me` with Keycloak access token → Prisma profile → `setSession` cookies (same as local).
4. Middleware treats `/auth/callback` as public.

Helpers: `frontend/packages/auth/src/oidc-pkce.ts`. Client: `pssms-admin-web` (public, `pkce.code.challenge.method=S256`).

**Do not** put `KEYCLOAK_CLIENT_SECRET` in the browser. **Do not** use Keycloak realm roles for nav/`can()`.

## Infra

- Realm export: `infra/keycloak/pssms-realm.json`
- Compose: `infra/docker/docker-compose.yml` → `pssms-keycloak` `:8080`, `start-dev --import-realm`
- Client `pssms-api` (confidential, ROPC for **dev e2e only**)
- Client `pssms-admin-web` (public, code+PKCE, redirect `/auth/callback`)

## Env

See `.env.example`: `AUTH_MODE`, `KEYCLOAK_*`, `KEYCLOAK_ALLOWED_AZP`.  
Admin: `NEXT_PUBLIC_CORE_API_URL`, optional `NEXT_PUBLIC_OIDC_REDIRECT_URI`.

## Research applied

- Dual JWT / JWKS with **explicit per-issuer algorithm** (WorkOS JWT algorithm-confusion guidance).
- Public client PKCE S256 + `sessionStorage` verifier (KeycloakPro / RFC 7636); enforce S256 on Keycloak client.
- IdP for identity; app remains source of truth for AuthZ.

## Deferred

- Disable ROPC outside local/dev
- MFA / UMA
- Other portals OIDC (customer/supplier) when needed
- Cookie size / HttpOnly BFF if Keycloak tokens grow too large
