# Phase 8b — Admin Workflows (Payroll, Procurement, Approvals, Call Centre, CCTV)

> Extends Phase 8a scaffolds into live workflow UIs against **existing** core-api.
> Defer: Keycloak SSO, OpenAPI codegen, Playwright, GRN/3-way match UI.

## Research applied

- Creator ≠ approver enforced **server-side** (`libs/approvals`); UI hides buttons but does not trust client flags
- Payroll amounts from **immutable PayslipSnapshot** only — never `/attendance`
- CCTV: metadata/events only — video on NVR/MinIO
- Approvals inbox as cross-module queue (domain pages keep their own submit/approve)

## Deliverables

| Route | Capability |
|---|---|
| `/payroll` | Cycles: generate → submit → approve → pay; payslip snapshot table |
| `/procurement` | Suppliers + POs: submit → approve (GM) |
| `/approvals` | Pending queue; mute actions if `createdBy === session.user.id` |
| `/callcentre` | Appointments approve/reject; gate code once; entries |
| `/cctv` | vision-ai health + ANPR metadata list |

## Packages

- `@pssms/api-client` — payroll, procurement, approvals, visitors, ANPR
- `@pssms/permissions` — `/approvals` nav (`approvals.act`)

## E2E

```bash
./scripts/phase8b-e2e.sh
```

Uses `admin@` + `gm@` to prove creator ≠ approver on payroll/PO.

## Deferred (8c / 9)

- Keycloak + httpOnly cookies
- Playwright UI E2E
- OpenAPI → api-client codegen
- PO goods receipt + three-way match screens
- Nest CCTV event list (beyond ANPR)
