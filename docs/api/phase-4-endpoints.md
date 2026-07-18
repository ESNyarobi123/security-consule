# Phase 4 — API Endpoints Catalog

Base: `http://localhost:4001/api/v1` | Swagger: `/docs`

Design: `docs/architecture/phase-4-hr-payroll-design.md`

## HR — Employees (`@pssms/workforce`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | `/hr/employees` | Bearer | `{ employeeNumber, fullName, userId?, guardProfileId?, ... }` | Employee |
| GET | `/hr/employees` | Bearer | — | Employee[] |

## HR — Leave

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/hr/leave/types` | Bearer | `{ code, name, annualQuotaDays? }` | LeaveType |
| GET | `/hr/leave/types` | Bearer | — | LeaveType[] |
| POST | `/hr/leave/requests` | Bearer | `{ employeeId, leaveTypeId, startDate, endDate, days, reason }` | LeaveRequest (starts approval) |
| POST | `/hr/leave/requests/:id/approve` | Bearer | — | LeaveRequest |
| GET | `/hr/leave/requests` | Bearer | `?employeeId=` | LeaveRequest[] |

## HR — Salary

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/hr/salary/assignments` | Bearer | `{ employeeId, basicSalary, hourlyRate?, allowances?, effectiveFrom }` | SalaryAssignment |
| GET | `/hr/salary/assignments` | Bearer | `?employeeId=` | SalaryAssignment[] |

## Recruitment (`@pssms/recruitment`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/recruitment/postings` | Bearer | `{ title, description, publish?, ... }` | JobPosting |
| GET | `/recruitment/postings` | Bearer | `?status=` | JobPosting[] |
| POST | `/recruitment/applications` | Public | `{ postingId, organizationId?, applicantName, email, ... }` | JobApplication |
| GET | `/recruitment/applications` | Bearer | `?postingId=` | JobApplication[] |
| PATCH | `/recruitment/applications/:id/status` | Bearer | `{ status, notes? }` | JobApplication |
| POST | `/recruitment/applications/:id/hire` | Bearer | `{ employeeNumber, department? }` | JobApplication (HIRED + Employee created) |

## Employee Loans (`@pssms/employee-loans`)

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/loans` | Bearer | `{ employeeId, principalAmount, termMonths, purpose }` | EmployeeLoan |
| POST | `/loans/:id/approve` | Bearer | — | `{ loan, installments[] }` |
| GET | `/loans` | Bearer | `?employeeId=` | EmployeeLoan[] |
| GET | `/loans/:id/installments` | Bearer | — | LoanInstallment[] |

## Payroll (`@pssms/payroll`) — immutable snapshots

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/payroll/cycles` | Bearer | `{ periodStart, periodEnd, tenantType? }` | PayrollCycle |
| GET | `/payroll/cycles` | Bearer | — | PayrollCycle[] |
| POST | `/payroll/cycles/:id/generate` | Bearer | — | PayslipSnapshot[] (freezes attendance into inputsSnapshot) |
| POST | `/payroll/cycles/:id/submit` | Bearer | — | PayrollCycle (PENDING_APPROVAL) |
| POST | `/payroll/cycles/:id/approve` | Bearer | — | PayrollCycle (APPROVED, immutable) |
| POST | `/payroll/cycles/:id/pay` | Bearer | `{ paymentReference }` | PayrollCycle (PAID) |
| GET | `/payroll/cycles/:id/payslips` | Bearer | — | PayslipSnapshot[] |
| GET | `/payroll/payslips/:id` | Bearer | — | PayslipSnapshot (read-only) |

## Seeded demo (Phase 4)

| Resource | Value |
|---|---|
| Employee | GRD-0001 — John Guard (linked to guard profile) |
| Salary | 850,000 TZS basic + transport/risk allowances |
| Leave type | ANNUAL (21 days) |
| Payroll rules | v1 — NSSF 10%, PAYE 10% (simplified) |
| Job posting | Security Guard — Industrial Sites (OPEN) |
| Attendance | seed-payroll-att-001 — 104h block for snapshot test |

## E2E payroll flow

```bash
TOKEN=$(curl -s -X POST .../auth/login -d '{"email":"admin@highlink.co.tz",...}' | jq -r '.data.tokens.accessToken')
GM=$(curl -s -X POST .../auth/login -d '{"email":"gm@highlink.co.tz",...}' | jq -r '.data.tokens.accessToken')

# Create cycle → generate → submit (admin) → approve (GM) → pay
```
