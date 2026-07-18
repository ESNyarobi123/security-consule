# Phase 6 — Advanced Integrations (Design)

Research synthesis + PSSMS rules (`pssms-integrations-ai`, adapter pattern, no vendor SDKs in domain libs).

## Community patterns adopted

| Pattern | Source | PSSMS implementation |
|---|---|---|
| Transactional outbox | NestJS outbox/inbox articles, event-driven payment repos | `integrations.integration_outbox` + background-worker poller |
| Webhook inbox | integration-standards.md, Stripe/webhook best practices | Store raw → ACK 200 → async process → idempotency key |
| Adapter registry | Hexagonal ports | `ProviderRegistry` + console stubs for dev |
| Provider-agnostic domain | Phase 5 finance | Webhook → `paymentReference` on invoice — no M-Pesa in finance lib |
| Vision metadata only | system-architecture.md | `vision-ai-service` returns plate/confidence — no video through Nest |

## Integration spine

```text
core-api (domain libs)
    → NotificationsService.enqueue + OutboxWriter (same DB transaction)
    → integrations.integration_outbox

background-worker (4002)
    → OutboxPoller → integration-gateway /internal/v1/dispatch
    → WebhookInboxProcessor → core-api callbacks

integration-gateway (4003)
    → Webhook inbox (payments, ANPR)
    → Console adapters (SMS, payment, email)
    → Adapter registry + request logs

realtime-gateway (4004)
    → SSE stream for field.alert.created, parking.anpr.decided

vision-ai-service (8000)
    → POST /v1/anpr/recognize — stub plate detection
```

## E2E flows (sprint)

1. Visitor approve → SMS notification enqueued → worker dispatches → SENT
2. Payment webhook → invoice PAID (idempotent)
3. ANPR webhook → vision-ai stub → parking anpr_results row

## Out of scope (Phase 6b)

- Real M-Pesa, banks, production SMS/WhatsApp/FCM
- Biometric device MQTT ingest
- analytics-ai-service (8001)
- api-gateway (4000) BFF
- PostgreSQL RLS on integrations/notifications
- Redis circuit breaker, Prometheus per-adapter
