# Phase 14 — Guard App Duty Depth

## Goal

Deepen **guard-app** (offline-first): alertness confirm + QR patrol scan + clock-out via SQLite outbox → `POST /field/sync` on **core-api `:4001`**.

App ≠ microservice. Guard attendance ≠ gate OTP ≠ supervisor review ≠ customer access.

## Research applied

| Pattern | Community | PSSMS MVP |
|---|---|---|
| Offline outbox + idempotency | Expo SQLite queue | Reuse Phase 12 `clientEventId` |
| QR + GPS dual proof | Miratag / Zinc / Novagems | Type/paste `CP-GATE-01` + demo GPS |
| NFC preferred at high security | Industry consensus | Seed `nfcTagId`; camera/NFC reader deferred |
| Never trust phone clock | Phase 12 | `deviceTime` audit-only |
| Randomised / scheduled alertness | Phase 2 design | Confirm pending → outbox |

## Event types (field/sync)

```text
CLOCK_IN | ALERTNESS_CONFIRM | PATROL_SCAN | CLOCK_OUT
```

## Screens

Home → Alertness / Patrol / Outbox · Clock-out when open attendance exists

## Deferred

Camera barcode, real NFC, live GPS, face/fingerprint, push for pending checks, patrol geofence hard-fail, auto-schedule worker.
