# Phase 13b — Supervisor endpoints

Base: `http://localhost:4001/api/v1`

## Login

```http
POST /auth/login
{ "email": "supervisor1@highlink.co.tz", "password": "ChangeMe123!" }
```

## Site context

```http
GET /enterprise/sites
GET /guards
GET /operations/shifts?siteId=<SITE-WAREHOUSE-A uuid>
```

## Attendance approve queue

```http
GET /attendance?siteId=<uuid>&supervisorApproved=false

POST /attendance/:id/approve
Authorization: Bearer <supervisor>
→ { id, guardId, siteId, clockInAt, supervisorApproved: true, … }
```

Creator ≠ approver: if the actor’s userId is the guard on the record → `403 CREATOR_CANNOT_APPROVE`.

## Field alerts

```http
GET /attendance/field-alerts?siteId=<uuid>&acknowledged=false

POST /attendance/field-alerts/:id/acknowledge
```

Missed alertness (seed/e2e):

```http
POST /attendance/alertness/schedule
POST /attendance/alertness/:id/missed
```

## Peek

```http
GET /incidents?siteId=<uuid>
GET /occurrence-book?siteId=<uuid>
```
