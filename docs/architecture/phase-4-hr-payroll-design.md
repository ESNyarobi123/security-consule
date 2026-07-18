# Phase 4 — HR & Payroll (Design)

Research synthesis + PSSMS rules (`pssms-people-money`, immutable snapshots).

## Community / research patterns adopted

| Pattern | Source | PSSMS implementation |
|---|---|---|
| Immutable payroll snapshots | IRE journals, event-sourcing guides | `PayslipSnapshot` — never UPDATE after cycle APPROVED |
| Inputs frozen at calculation time | Deterministic payroll engines paper | `inputsSnapshot` JSON captures attendance hours at generate |
| Draft → review → approve → pay | hr-payroll (GitHub), Odoo loans | Cycle status machine + `libs/approvals` |
| Loan installment schedule post-approval | Odoo xf_loan, hr-payroll v2 | Installments generated only after loan APPROVED |
| Leave balance on approval | hr-payroll leave workflow | Balance checked at apply; deducted on approve |
| Creator ≠ approver | PSSMS governance | All loans/leave/payroll use shared approvals engine |
| Tenant separation | Architecture doc | `INTERNAL_COMPANY` vs `CUSTOMER_MANAGED_PAYROLL` |

## Payroll snapshot rule (non-negotiable)

```text
❌ GET /payslips → recompute from guard_attendances live
✅ GET /payslips → read PayslipSnapshot.calculationResult only

Generate draft:
  1. Lock attendance rows for period → copy hours into inputsSnapshot
  2. Bind PayrollRuleVersion active at periodStart
  3. Apply SalaryAssignment effective on periodEnd
  4. Apply loan installments due in period
  5. Persist PayslipSnapshot (immutable after cycle APPROVED)
```

## Employee lifecycle

```text
Recruitment: JobPosting → Application → HIRED
    → Employee record created
    → Guard profile linked (if guard role)
    → SalaryAssignment
    → Deployment eligibility (workforce/operations)
```

## Loan flow

```text
Employee applies → approval workflow → APPROVED
    → installment schedule generated
    → payroll generate picks due installments → deductionsSnapshot
    → on cycle PAID → installments marked PAID
```

## Tanzania statutory (Phase 4 simplified)

Rules stored in `PayrollRuleVersion.rules` JSON (versioned):
- NSSF employee rate (configurable %)
- PAYE simplified brackets (placeholder — full TRA tables Phase 4b)
- SDL/WCF flags for future

## Out of scope (Phase 4b / Phase 6)

- background-worker scheduled payroll runs
- M-Pesa/bank disbursement (integration-gateway)
- Full TRA PAYE tables
- Customer payroll portal UI
- Payslip PDF generation
