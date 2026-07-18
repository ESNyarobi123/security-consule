# Approval Workflows na Authority Matrix

Chanzo: design document sections 35A–35D. Hii inaendesha shared **Approval Workflow
Engine** (`backend/libs/approvals`). HAKUNA approval iliyohardcodiwa ndani ya module —
kila module inasajili workflow definitions kwenye engine.

## Kanuni za Governance (35A.2)

1. Kila business process ina business owner mmoja.
2. Kila transaction ina creator.
3. Kila transaction ina independent review.
4. Kila approval inafanywa na authorized officer.
5. **Creator HAWEZI ku-approve transaction aliyotengeneza** (isipokuwa policy exception).
6. Kila hatua inarekodiwa: officer, date, time, action, status, audit trail.

## Standard Lifecycle (35C)

```text
Request → Registration → Verification → Review → Approval
→ Execution → Monitoring → Reporting → Audit → Management Decision
```

## Authorization Matrix (35D — itakamilishwa Phase 0)

| Business Activity | Created By | Verified By | Reviewed By | Approved By | Final Authority |
|---|---|---|---|---|---|
| Recruitment | Applicant | HR Officer | HR Manager | General Manager | CEO |
| Employment | HR Officer | HR Manager | Department Head | General Manager | CEO |
| Leave | Employee | Supervisor | HR Officer | Department Head | GM (where required) |
| Payroll | Payroll Officer | HR Manager | Finance Manager | General Manager | CEO |
| Customer Contract | Marketing Officer | Legal Officer | General Manager | CEO | CMD (strategic) |
| Procurement | Requesting Dept | Procurement Officer | Procurement Manager | Finance Manager | General Manager |
| Payment Voucher | Accountant | Finance Manager | Internal Auditor | General Manager | CEO (above threshold) |
| Petty Cash | Requesting Employee | Supervisor | Finance Officer | Finance Manager | GM (above threshold) |
| Incident Closure | Guard/Supervisor | Field Officer | Branch Ops Manager | General Manager | CEO (major) |
| Policy Change | Department Head | Compliance Officer | General Manager | CEO | CMD |
| System Configuration | System Administrator | ICT Manager | CISO | CEO | CMD (critical) |

## Amount Thresholds (mfano — final values Phase 0)

```text
Petty Cash TZS 100,000
  Creator: Branch Officer → Reviewer: Branch Manager
  → Approver: Accountant → Final: Finance Manager

Petty Cash TZS 10,000,000
  Creator: Branch Officer → Reviewer: Branch Manager
  → Approver: Finance Manager → Final: Managing Director
```

## Viewing Hierarchy (35D)

| User | Own Records | Department | Branch | Company-wide |
|---|---|---|---|---|
| Guard | ✓ | ✗ | ✗ | ✗ |
| Supervisor | ✓ | Assigned sites | ✗ | ✗ |
| Field Officer | ✓ | Assigned sites | Assigned branch | ✗ |
| Branch Operations Manager | ✓ | ✓ | ✓ | ✗ |
| Branch Manager | ✓ | ✓ | ✓ | Limited |
| Department Head | ✓ | ✓ | Department-wide | Limited |
| GM / CEO / CMD | ✓ | ✓ | ✓ | ✓ |
| Customer | Own organization only | ✗ | ✗ | ✗ |
| Supplier | Own transactions only | ✗ | ✗ | ✗ |
| Applicant | Own application only | ✗ | ✗ | ✗ |

Hii inatekelezwa kwa **RBAC + ABAC** (`libs/identity`) + PostgreSQL RLS.

## Engine Data Model (libs/approvals)

```text
WorkflowDefinition   # mfano: "petty-cash", "leave", "purchase-order"
WorkflowVersion      # rules zinaversion-iwa — batch ya zamani inabaki na rules zake
Step                 # order, required role, min approvers
StepCondition        # amount threshold, branch, department, urgency
EscalationRule       # muda wa kusubiri kabla ya escalation
RejectionRule        # nini kinatokea baada ya rejection
ApprovalInstance     # instance ya transaction moja ikipita workflow
ApprovalAction       # kila action: officer, timestamp, decision, remarks (audit)
```

## Workflows Zinazotumia Engine

Leave, employee loans, recruitment, payroll batches, petty cash, payment vouchers,
purchase orders, supplier registration, contracts, incident closure, asset disposal,
payroll exceptions, occurrence book corrections.
