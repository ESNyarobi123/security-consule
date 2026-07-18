# Phase 10 — Supplier Portal + Visitor Pre-register

## Goal

External portals (portal ≠ microservice — all APIs on **core-api :4001**):

| App | Port | Auth |
|---|---|---|
| `supplier-web` | 3003 | JWT `supplierId` + `pssms_supplier_*` cookies |
| `visitor-web` | 3005 | Public only (no IAM cookies) |

## Research applied

- Split Next apps + separate cookie prefixes (multi-portal isolation — same Phase 9 / [Keyson](https://keyson.io/en/blog/two-nextjs-apps-one-api/) pattern)
- Force-scope supplier data from JWT (never trust client `supplierId` alone)
- Visitor pre-reg: confirmation shows **referenceNumber only** — never gate verification codes (codes stay on approve/SMS/admin path)

## Supplier auth

| Item | Value |
|---|---|
| Role | `SUPPLIER_PORTAL` |
| Seed | `portal@uniforms.co.tz` / `ChangeMe123!` → `SUP-UNIFORM` |
| Cookies | `pssms_supplier_token`, `pssms_supplier_user` |
| Guard | `SupplierPortalGuard` — allowlisted GET only |
| Scope | `resolveSupplierScope` / `requireSupplierScope` |

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/procurement/suppliers/me` | Portal profile |
| GET | `/procurement/purchase-orders` | Force-scoped |
| GET | `/visitors/public-config` | Public demo IDs for visitor-web |
| POST | `/visitors/appointments` | Public create (existing) |

Wrong supplierId → `403 SUPPLIER_SCOPE_DENIED`.  
Mutate as supplier → `403 SUPPLIER_PORTAL_READ_ONLY`.

## Deferred

- Supplier PO acknowledge / GRN / punchout
- Visitor status-by-code
- Keycloak / Playwright / RLS
