# Integration Standards — `integration-gateway` (port 4003)

Kila third-party integration (bank, mobile money, SMS, WhatsApp, email, biometric,
CCTV, ANPR, RFID, NFC, alarm) LAZIMA ifuate standards hizi. Hakuna vendor anayeitwa
directly kutoka business module — kila kitu kinapita adapter ndani ya `integration-gateway`.

## Checklist ya Kila Integration

| Kipengele | Maelezo |
|---|---|
| Provider adapter | Interface moja kwa capability, implementation moja kwa vendor |
| Credentials | Zinakaa environment/secrets manager — kamwe si kwenye code |
| Environment | Sandbox na production configs tofauti |
| Webhook inbox | Kila webhook inapokelewa, inahifadhiwa raw, kisha inachakatwa async |
| Retries | Exponential backoff na max attempts |
| Timeouts | Kila outbound call ina timeout ya wazi |
| Circuit breaker | Provider akianguka, system haiangushi modules nyingine |
| Idempotency | Idempotency keys — webhook/request ikirudiwa hailete duplicate transaction |
| Dead-letter queue | Messages zilizoshindikana zinaenda DLQ (RabbitMQ) kwa review |
| Health status | Kila adapter ina health check inayoonekana Developer Portal |
| Request/response logs | Kila call inalogwa (bila siri) kwa audit na debugging |

## Payment Provider Adapter (banks + mobile money)

Kubadilisha bank au mobile-money provider HAKUTAathiri payroll wala invoice modules:

```typescript
interface PaymentProvider {
  initiatePayment(input: PaymentInput): Promise<PaymentResult>;
  verifyPayment(reference: string): Promise<PaymentStatus>;
  processWebhook(payload: unknown): Promise<WebhookResult>;
  refundPayment(reference: string): Promise<RefundResult>;
}
```

Implementations zinazotarajiwa (kutegemea majibu ya Phase 0):

```text
MpesaProvider | TigoPesaProvider | AirtelMoneyProvider | HaloPesaProvider
CrdbBankProvider | NmbBankProvider | NbcBankProvider | ...
```

## Adapter Categories

| Category | Interface | Vendors (mifano) |
|---|---|---|
| Payments | `PaymentProvider` | M-Pesa, TigoPesa, Airtel Money, banks |
| Messaging | `SmsProvider`, `WhatsAppProvider`, `EmailProvider`, `PushProvider` | SMS gateways, Meta WhatsApp API, SMTP, FCM |
| Biometrics | `BiometricDeviceAdapter` | ZKTeco, Suprema, Hikvision |
| CCTV / ANPR | `CctvEventAdapter`, `AnprAdapter` | Hikvision, Dahua, `vision-ai-service` |
| Access hardware | `GateControllerAdapter`, `RfidReaderAdapter`, `NfcAdapter` | Barrier gates, readers |
| Alarms | `AlarmSystemAdapter` | Alarm panels |

## Webhook Inbox Pattern

```text
Vendor webhook → integration-gateway (4003)
    → 1. Verify signature
    → 2. Store raw payload (webhook_inbox table + idempotency key)
    → 3. ACK 200 mara moja
    → 4. Process async (RabbitMQ)
    → 5. Ikishindikana mara N → DLQ + alert
```
