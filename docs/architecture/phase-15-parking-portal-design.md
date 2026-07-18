# Phase 15 — Parking Management Portal

## Goal

Next.js **parking-web** on **:3006** for org parking ops / ANPR **results** review via **core-api `:4001`**.

Portal ≠ microservice. Video stays on NVR/vision — Nest gets plate + decision metadata only.

## Research applied

| Pattern | Community | PSSMS |
|---|---|---|
| Whitelist / permits | ANPR Guardian / Vaxtor | Vehicles + permits + approve SoD |
| Exception / decision feed | AutoOCR / Coram | ANPR PENDING → ALLOW/DENY |
| Blacklist enforcement | Ops portals | `VehicleBlacklist` + entry deny |
| Split customer vs ops | Industry | customer-web read-only vs parking-web mutate |
| No video in app server | PSSMS architecture | imageUrl metadata only |

## Auth

| Item | Value |
|---|---|
| Role | `PARKING_OFFICER` |
| User | `parking1@highlink.co.tz` / `ChangeMe123!` |
| Cookies | `pssms_parking_token`, `pssms_parking_user` |
| Perms | `parking.manage`, `enterprise.manage` |

## Screens

Login · Dashboard · Permits · Entries · Violations · ANPR · Blacklist

## Ownership

- **parking-web** — ops: decide ANPR, issue/approve permits, blacklist
- **customer-web `/parking`** — JWT `customerId` read-only fleet (unchanged)

## Deferred

Real camera streams, MQTT barriers, RLS on `parking.*`, overstay billing, vision model training.
