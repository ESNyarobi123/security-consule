# Phase 5 — API Endpoints Catalog

Base: `http://localhost:4001/api/v1` | Swagger: `/docs`

Design: `docs/architecture/phase-5-finance-procurement-design.md`

## Finance — Invoices (`@pssms/finance`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/finance/invoices` | Bearer | `{ customerId, invoiceNumber, issueDate, dueDate, lines[], taxAmount?, contractId? }` | Invoice |
| GET | `/finance/invoices` | Bearer | `?customerId=` | Invoice[] |
| POST | `/finance/invoices/:id/send` | Bearer | — | Invoice (SENT) |
| POST | `/finance/invoices/:id/payments` | Bearer | `{ amount, paymentReference, paymentMethod? }` | Invoice (PAID/PARTIALLY_PAID) |

## Finance — Petty Cash

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/finance/petty-cash/funds` | Bearer | `{ name, imprestAmount, branchId?, custodianId? }` | PettyCashFund |
| GET | `/finance/petty-cash/funds` | Bearer | — | PettyCashFund[] |
| POST | `/finance/petty-cash/vouchers` | Bearer | `{ fundId, amount, purpose, category, receiptUrl? }` | PettyCashVoucher (starts approval) |
| POST | `/finance/petty-cash/vouchers/:id/approve` | Bearer | — | PettyCashVoucher (APPROVED, balance decremented) |

## Finance — Payment Vouchers (AP)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/finance/payment-vouchers` | Bearer | `{ payeeName, amount, purpose, supplierId?, purchaseOrderId? }` | PaymentVoucher (starts approval) |
| GET | `/finance/payment-vouchers` | Bearer | — | PaymentVoucher[] |
| POST | `/finance/payment-vouchers/:id/approve` | Bearer | — | PaymentVoucher (APPROVED) |
| POST | `/finance/payment-vouchers/:id/pay` | Bearer | `{ paymentReference }` | PaymentVoucher (PAID) |

## Procurement — Suppliers (`@pssms/procurement`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/procurement/suppliers` | Bearer | `{ code, name, email?, phone?, tin?, address? }` | Supplier (PENDING) |
| GET | `/procurement/suppliers` | Bearer | — | Supplier[] |
| POST | `/procurement/suppliers/:id/approve` | Bearer | — | Supplier (APPROVED) |

## Procurement — Purchase Orders

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/procurement/purchase-orders` | Bearer | `{ supplierId, poNumber, lines[], expectedDelivery? }` | PurchaseOrder (DRAFT) |
| GET | `/procurement/purchase-orders` | Bearer | — | PurchaseOrder[] |
| POST | `/procurement/purchase-orders/:id/submit` | Bearer | — | PurchaseOrder (PENDING_APPROVAL) |
| POST | `/procurement/purchase-orders/:id/approve` | Bearer | — | PurchaseOrder (ORDERED) |
| POST | `/procurement/purchase-orders/:id/goods-receipts` | Bearer | `{ lines: [{ purchaseOrderLineId, quantityReceived }], notes? }` | GoodsReceipt (+ stock IN) |
| GET | `/procurement/purchase-orders/:id/three-way-match` | Bearer | — | `{ matched, poTotal, receivedValue, payableAmount, discrepancies[] }` |

## Inventory (`@pssms/inventory`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/inventory/items` | Bearer | `{ sku, name, category?, unit?, reorderLevel? }` | StockItem (onHand=0) |
| GET | `/inventory/items` | Bearer | — | StockItem[] (includes computed onHand) |
| POST | `/inventory/movements` | Bearer | `{ stockItemId, movementType, quantity, siteId?, notes? }` | StockMovement |
| GET | `/inventory/movements` | Bearer | `?stockItemId=` | StockMovement[] |

## Assets (`@pssms/assets`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/assets` | Bearer | `{ assetTag, name, category?, purchaseDate?, purchaseCost?, serialNumber? }` | Asset |
| GET | `/assets` | Bearer | — | Asset[] |
| POST | `/assets/:id/assign` | Bearer | `{ assignedToEmployeeId?, assignedToGuardId?, notes? }` | AssetAssignment |
| POST | `/assets/:id/return` | Bearer | — | AssetAssignment (returnedAt set) |

## Seeded demo (Phase 5)

| Resource | Value |
|---|---|
| Supplier | SUP-UNIFORM — Tanzania Uniform Supplies Ltd (APPROVED) |
| Stock item | UNIFORM-L — Security Uniform Large |
| Petty cash fund | HQ Petty Cash — 500,000 TZS imprest |
| Workflows | `petty-cash-approval`, `payment-voucher-approval`, `purchase-order-approval` |
| Permissions | `finance.manage`, `procurement.manage`, `inventory.manage`, `assets.manage` |

## E2E procure-to-pay flow

```bash
TOKEN=$(curl -s -X POST .../auth/login -d '{"email":"admin@highlink.co.tz","password":"ChangeMe123!"}' | jq -r '.data.tokens.accessToken')
GM=$(curl -s -X POST .../auth/login -d '{"email":"gm@highlink.co.tz","password":"ChangeMe123!"}' | jq -r '.data.tokens.accessToken')

# PO → approve → GRN → 3-way match → payment voucher → pay
# Verified: GRN-00001, onHand=20, 3way matched payable=900000, PV PAID
```

## Research patterns applied

- Procure-to-pay: Supplier → PO → GRN → 3-way match → payment voucher
- Petty cash imprest model with approval before disbursement
- Provider-agnostic payments (`paymentReference` only — no M-Pesa in finance lib)
- Creator ≠ approver via `libs/approvals` for petty cash, vouchers, PO
