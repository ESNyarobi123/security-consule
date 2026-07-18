# Phase 9 — Customer Portal (`customer-web` :3002)

## Goal

External customer portal for HIGHLINK PSSMS. Portal ≠ microservice: all business APIs stay on **core-api :4001**. Isolation is JWT `customerId` + portal-prefixed cookies (community multi-portal pattern).

## Research applied

- Separate cookie names per portal (`pssms_customer_*` vs `pssms_admin_*`) — avoids session bleed on localhost different ports / shared domain ([DEV Community — multi-portal Auth.js pitfalls](https://dev.to/kochan/3-pitfalls-of-multi-portal-authentication-with-keycloak-part-5-4dcj))
- Tenant/customer identity in JWT; server force-scopes lists (frontend filter alone is unsafe)
- v1 portal is **read-focused**: contracts, invoices, visitor appointments, access employees, parking vehicles/permits — no gate verify, ANPR decide, or approve visitor

## Auth model

| Item | Value |
|---|---|
| Role | `CUSTOMER_PORTAL` |
| Seed user | `portal@demo-mfg.co.tz` / `ChangeMe123!` |
| Bound customer | `CUST-DEMO` via `iam.users.customer_id` |
| Cookies | `pssms_customer_token`, `pssms_customer_user` |
| Scope util | `resolveCustomerScope` / `requireCustomerScope` |

## API surface (portal)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | Returns `user.customerId` |
| GET | `/customers/me` | Requires JWT customerId |
| GET | `/contracts?customerId=` | Forced to JWT customer |
| GET | `/finance/invoices` | Forced |
| GET | `/visitors/appointments` | Forced; approve stays on admin |
| GET | `/access/employees` | `requireCustomerScope` |
| GET | `/parking/vehicles` | Forced |
| GET | `/parking/permits` | Via `vehicle.customerId` |

## Security (portal JWT)

- Force-scope lists via `resolveCustomerScope` / `requireCustomerScope`
- **`CustomerPortalGuard`**: if JWT has `customerId`, only allowlisted GETs; all mutates → `403 CUSTOMER_PORTAL_READ_ONLY`
- Unlisted GETs (e.g. payroll, ANPR) → `403 CUSTOMER_PORTAL_PATH_DENIED`

## Frontend

```text
frontend/apps/customer-web  →  http://localhost:3002
```

Pages: login, dashboard, contracts, invoices, visitors, access, parking.

## Deferred

- Keycloak / httpOnly cookies
- Visitor approve/reject with customer assert on mutate
- RLS on access/visitors/parking schemas
- supplier-web, visitor-web, Playwright
