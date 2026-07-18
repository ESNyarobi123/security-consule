# Phase 1 — API Endpoints Catalog

Base URL: `http://localhost:4001/api/v1`  
Swagger UI: `http://localhost:4001/docs`  
OpenAPI JSON: `http://localhost:4001/docs-json`

Auth: `Authorization: Bearer <accessToken>` (except Public endpoints)

Envelope (success):
```json
{ "success": true, "data": {}, "meta": { "requestId": "uuid", "timestamp": "ISO-8601" } }
```

Envelope (error):
```json
{ "success": false, "error": { "code": "CODE", "message": "...", "details": [] }, "meta": { ... } }
```

---

## Health

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/health` | Public | — | `{ status, service, version }` |

---

## Auth

| Method | Path | Auth | Request body | Response `data` |
|---|---|---|---|---|
| POST | `/auth/login` | Public | `{ email, password }` | `{ tokens: { accessToken, refreshToken, tokenType, expiresIn }, user: { id, email, fullName, organizationId, roles[], permissions[], allowedBranchIds[], allowedSiteIds[] } }` |
| POST | `/auth/refresh` | Public | `{ refreshToken }` | `{ accessToken, refreshToken, tokenType, expiresIn }` |
| GET | `/auth/me` | Bearer | — | user profile (same shape as login.user) |

**Callbacks:** none (token-based; no OAuth callback in Phase 1).

---

## Users

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/users` | Bearer | `{ email, password, fullName, phone?, roleCodes[] }` | `{ id, email, fullName, organizationId, isActive, roles[], createdAt }` |
| GET | `/users` | Bearer | — | `User[]` |

---

## Enterprise

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/enterprise/organization` | Bearer | — | `{ id, name, code, tin?, isActive }` |
| POST | `/enterprise/branches` | Bearer | `{ code, name, region?, phone?, address? }` | Branch |
| GET | `/enterprise/branches` | Bearer | — | Branch[] |
| POST | `/enterprise/departments` | Bearer | `{ code, name, branchId? }` | Department |
| GET | `/enterprise/departments` | Bearer | — | Department[] |
| POST | `/enterprise/sites` | Bearer | `{ branchId, code, name, customerId?, address? }` | Site |
| GET | `/enterprise/sites` | Bearer | — | Site[] |

---

## Customers

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/customers` | Bearer | `{ code, name, tin?, email?, phone?, address?, contactPerson? }` | Customer |
| GET | `/customers` | Bearer | — | Customer[] |

---

## Contracts

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/contracts` | Bearer | `{ customerId, contractNumber, title, serviceType, startDate, endDate, monthlyFee, guardCount?, slaTerms? }` | Contract (status=`DRAFT`) |
| GET | `/contracts` | Bearer | — | Contract[] |
| PATCH | `/contracts/:id/status` | Bearer | `{ status }` enum: `DRAFT\|PENDING_APPROVAL\|APPROVED\|ACTIVE\|EXPIRING\|TERMINATED\|CANCELLED` | Contract |

**Internal events (Phase 1 in-process notes; RabbitMQ later):**
- `contract.approved` / `contract.activated` / `contract.terminated` via status change audit actions

---

## Approvals

| Method | Path | Auth | Request | Response `data` / errors |
|---|---|---|---|---|
| POST | `/approvals/instances` | Bearer | `{ workflowCode, resourceType, resourceId, amount? }` | ApprovalInstance |
| POST | `/approvals/instances/:id/actions` | Bearer | `{ decision: APPROVE\|REJECT, remarks? }` | ApprovalInstance; **403** `CREATOR_CANNOT_APPROVE` if actor = creator |
| GET | `/approvals/instances` | Bearer | — | ApprovalInstance[] |

Seeded workflow code: `contract-approval` (step: `GENERAL_MANAGER`).

---

## Audit

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | `/audit/logs?take=50` | Bearer | query `take` | AuditLog[] (append-only) |

---

## Seeded login (after migrate + seed)

| Email | Password | Role |
|---|---|---|
| `admin@highlink.co.tz` | `ChangeMe123!` | SUPER_ADMIN |
| `gm@highlink.co.tz` | `ChangeMe123!` | GENERAL_MANAGER |
