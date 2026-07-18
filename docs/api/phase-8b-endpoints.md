# Phase 8b — Admin Workflow Endpoints

All via `core-api` `:4001` (portal ≠ service).

| Portal | Methods used |
|---|---|
| Payroll | `POST/GET /payroll/cycles`, `…/generate`, `…/submit`, `…/approve`, `…/pay`, `GET …/payslips` |
| Procurement | `POST/GET /procurement/suppliers`, `…/approve`, `POST/GET /procurement/purchase-orders`, `…/submit`, `…/approve` |
| Approvals | `GET /approvals/instances`, `POST …/actions` `{ decision }` |
| Call centre | `GET/POST /visitors/appointments`, `…/approve`, `…/reject`, `GET /visitors/entries` |
| CCTV | `GET /parking/anpr-results`, vision-ai `GET :8000/health` |

E2E: `./scripts/phase8b-e2e.sh`
