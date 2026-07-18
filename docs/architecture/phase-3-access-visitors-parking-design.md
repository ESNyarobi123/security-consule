# Phase 3 — Access, Visitors & Parking (Design)

Research synthesis + PSSMS rules (`pssms-access-parking`, data separation).

## Community best practices adopted

| Practice | Source consensus | PSSMS implementation |
|---|---|---|
| Pre-registration + host approval | VMS guides 2025 | Appointment → host approve → code issued |
| Time-bound + zone-bound access | FacilityOS, Nuveq | `validFrom`/`validUntil`, `siteId`, optional `gateId` |
| One-time QR/code | Visitly, industrial VMS | `maxUses=1`, `usedAt` on verify |
| Signed credentials | Security standard | HMAC-SHA256 hash stored; plain code shown once |
| Replay protection | Gate systems | `verificationAttempts` log + idempotency |
| Customer isolation | Document §33 | Mandatory `customerId` + org scope on all queries |
| ANPR ≠ AI in Nest | Architecture rules | `POST /parking/anpr-results` ingests metadata; decision in parking lib |
| Separate from guard attendance | Document §9/11 | `access.*` schema only — never `attendance.*` |

## Visitor flow

```text
Visitor requests appointment (public or portal)
    → Host approves/rejects
    → System generates signed verification code (expiry, site, gate)
    → SMS/WhatsApp stub (Phase 6) — code returned in API for now
    → Gate officer scans/enters code
    → Valid: entry recorded + code marked used
    → Invalid/expired/reused: deny + audit + optional incident
```

## Customer employee access flow

```text
Customer admin registers employee (scoped to customerId)
    → Employee checks in at gate (card/QR/biometric ref)
    → access.entry recorded (separate table from guard attendance)
    → Customer A cannot query Customer B employees
```

## Parking flow

```text
Vehicle registered → Permit issued (employee/visitor/contractor)
    → Entry at gate (manual or ANPR result webhook)
    → vision-ai-service sends plate result → parking ingests
    → Permission decision → allow/deny + violation if unauthorized
```

## Out of scope (Phase 3b / Phase 6)

- SMS/WhatsApp dispatch for visitor codes
- Real barrier MQTT trigger
- Customer portal UI
- Full RLS policies (application-level isolation in Phase 3; RLS SQL in Phase 6)
