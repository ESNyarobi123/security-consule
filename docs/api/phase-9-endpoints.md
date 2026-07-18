# Phase 9 — Customer portal endpoints

Base: `http://localhost:4001/api/v1`  
Auth: `Authorization: Bearer <accessToken>` from `POST /auth/login`

## Login (portal user)

```http
POST /auth/login
{ "email": "portal@demo-mfg.co.tz", "password": "ChangeMe123!" }
```

Response `data.user.customerId` must be set (CUST-DEMO uuid).

## Customer profile

```http
GET /customers/me
```

Staff without `customerId` → `403 CUSTOMER_ID_REQUIRED`.

## Force-scoped lists

| Endpoint | Scope |
|---|---|
| `GET /contracts` | `customerId` from JWT or optional staff filter |
| `GET /finance/invoices` | same |
| `GET /visitors/appointments` | same |
| `GET /access/employees` | JWT required when portal; optional query overridden |
| `GET /parking/vehicles` | same |
| `GET /parking/permits` | filter `vehicle.customerId` |

Cross-customer query param → `403` with `CUSTOMER_SCOPE_DENIED`.

## Negative test

```bash
curl -i "$BASE/contracts?customerId=00000000-0000-0000-0000-000000000099" \
  -H "Authorization: Bearer $PORTAL_TOKEN"
# expect 403
```
