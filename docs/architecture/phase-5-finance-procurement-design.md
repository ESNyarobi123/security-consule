# Phase 5 — Finance & Procurement (Design)

Research synthesis + PSSMS rules (`pssms-people-money`, creator≠approver, provider-agnostic payments).

## Community patterns adopted

| Pattern | Source | PSSMS implementation |
|---|---|---|
| Procure-to-pay lifecycle | Truto AP APIs, Zip AP guide | Supplier → PO → GRN → match → payment voucher |
| 3-way match | Rossum, enterprise AP | PO lines vs received qty vs payable amount |
| Petty cash imprest | Bookkeeping imprest model | `PettyCashFund` fixed balance + voucher + reimburse |
| Approval before payment | Cardinal AP, Stampli | `libs/approvals` for petty cash, vouchers, PO |
| Provider-agnostic payments | integration-standards.md | `paymentReference` only — no M-Pesa SDK in finance lib |
| Invoice from contract | Phase 1 contracts | Invoice optional `contractId` link |
| Payroll-due alert gate | pssms-people-money | Invoice `PAID` status checked before payroll alert (Phase 5b worker) |

## Finance flows

```text
Customer Invoice: DRAFT → SENT → PARTIALLY_PAID → PAID
    → payments recorded with reference (integration-gateway dispatches in Phase 6)

Petty Cash: fund (imprest) → voucher (approval) → reimburse fund

Payment Voucher: DRAFT → approve → PAID (supplier/AP)
```

## Procurement flows

```text
Supplier register → APPROVED
    → Purchase Order (approval) → ORDERED
    → Goods Receipt (GRN) → stock IN movement
    → 3-way match check → Payment Voucher
```

## Inventory & assets

```text
StockItem → movement IN (from GRN) / OUT (issue to guard/site)
Asset → assign to employee/guard → return
```

## Out of scope (Phase 5b / Phase 6)

- integration-gateway payment adapters (M-Pesa, bank)
- supplier-web portal UI
- Full GL/chart of accounts double-entry
- PDF invoice generation
- background-worker invoice reminders
