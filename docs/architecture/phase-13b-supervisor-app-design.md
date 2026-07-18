# Phase 13b — Supervisor App

## Goal

Expo **supervisor-app** for site supervisors: live ops review of on-duty guards, FieldAlerts, attendance approval queue, open incidents / EOB peek via **core-api `:4001`**.

App ≠ microservice. Supervisor ≠ guard CLOCK_IN outbox ≠ gate OTP verify.

## Research applied

| Pattern | Source consensus | PSSMS MVP |
|---|---|---|
| Review queue | GuardOps / field ops | Pending `supervisorApproved=false` → Approve |
| Loud missed-alertness | Zinc / VMS | FieldAlerts HIGH first; ack from phone |
| Live visibility | Digital Guard Tour | Online-first poll 20s + pull-to-refresh |
| Creator ≠ approver | PSSMS governance | Guard cannot approve own attendance |
| Offline-first for *guards* | Devsflow | Guard-app only — supervisor stays online-first |

## Auth

| Item | Value |
|---|---|
| Role | `SUPERVISOR` (+ `SUPER_ADMIN` demo fallback) |
| User | `supervisor1@highlink.co.tz` / `ChangeMe123!` |
| Perms | `operations.manage`, `attendance.manage`, `incidents.manage`, `enterprise.manage` |

## Screens

Login → Live board (counts) → Alerts / Attendance / Incidents / EOB

## API (new in 13b)

```http
GET  /attendance?siteId=&supervisorApproved=false
POST /attendance/:id/approve
GET  /attendance/field-alerts?siteId=&acknowledged=false
POST /attendance/field-alerts/:id/acknowledge
```

## Deferred

- SSE / Expo push for FieldAlerts
- Offline supervisor ack queue
- Live GPS map / patrol UI
- Fine-grained `attendance.approve` / `alerts.ack`
- api-gateway `:4000` cutover
