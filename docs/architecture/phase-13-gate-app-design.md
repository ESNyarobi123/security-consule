# Phase 13 — Gate Verification App

## Goal

Expo **gate-verification-app** for gate officers: online-first visitor OTP verify via **core-api :4001**.

App ≠ microservice. Gate duties ≠ guard CLOCK_IN / `/field/sync`.

## Research applied

- OTP/QR gate verify is online and one-shot (community VMS OTP patterns) — **do not** offline-queue codes
- Retry only with same `clientEventId` if HTTP unclear; never assume allow after local failure
- Plaintext code shown only once on **approve** (call-centre); gate app never lists codes

## Auth

| Item | Value |
|---|---|
| Role | `GATE_OFFICER` |
| User | `gate1@highlink.co.tz` / `ChangeMe123!` |
| Perms | `visitors.manage`, `access.manage`, `enterprise.manage` (sites/gates) — not parking UI / attendance / payroll |

## Screens

Login → Duty (SITE-WAREHOUSE-A + GATE-MAIN/VEHICLE) → Verify → ALLOWED/DENIED result

## API

```http
POST /visitors/gate/verify
{ "code", "siteId", "gateId?", "clientEventId?", "visitorPhone?" }
→ { allowed, result, entry }
```

## Hardening (Phase 13)

- Creator ≠ approver on appointment approve/reject
- Gate verify: site∈org, HMAC `codeHash` lookup, atomic `useCount`, light rate limit (30/60s)
- App retries unclear HTTP with the **same** `clientEventId` for the same code

## Deferred

Offline OTP queue, NFC/QR camera, ANPR barrier UI, supervisor-app, api-gateway cutover.
