# Phase 8 — Admin Portal

App: `frontend/apps/admin-web` on port **3000**

All business APIs via **core-api** `http://localhost:4001/api/v1`

## Wired UI → API

| Portal route | APIs |
|---|---|
| `/superadmin/customers` | `GET/POST /customers` |
| `/superadmin/contracts` | `GET/POST /contracts`, `PATCH /contracts/:id/status` |
| `/operations` | `GET /guards`, `PATCH /guards/:id/status` |
| `/finance` | `GET /finance/invoices`, `POST :id/send`, `POST :id/payments` |
| `/hr` | `GET /hr/employees`, `GET /hr/leave/requests` |
| `/compliance` | `GET /audit/logs` |
| `/branch` | `GET /enterprise/branches` |

## Auth

- Login: `POST /auth/login`
- Session: cookies `pssms_admin_token`, `pssms_admin_user`
- Middleware redirects unauthenticated users to `/login`

## E2E

```bash
./scripts/phase8-e2e.sh
```

## Dev

```bash
cd frontend
cp apps/admin-web/.env.local.example apps/admin-web/.env.local
npm run dev --workspace=admin-web
```
