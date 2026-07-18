# Swagger / OpenAPI Conventions (PSSMS)

All public HTTP APIs in NestJS **must** be documented in Swagger before a phase is marked DONE.

## Where

| App | Port | Swagger URL |
|---|---|---|
| `core-api` | 4001 | `http://localhost:4001/docs` |
| `api-gateway` | 4000 | `http://localhost:4000/docs` (Phase 1b+) |
| `integration-gateway` | 4003 | Webhook/callback docs (Phase 6 / when adapters land) |

OpenAPI JSON: `/docs-json`

## Required on every endpoint

1. `@ApiTags('<Domain>')` — e.g. `Auth`, `Enterprise`, `Customers`
2. `@ApiOperation({ summary, description })`
3. Request body/query/params via DTO classes with `@ApiProperty`
4. `@ApiOkResponse` / `@ApiCreatedResponse` / `@ApiResponse` for error codes
5. `@ApiBearerAuth()` when JWT required
6. Callbacks/webhooks: document payload schema + signature header + idempotency key

## Standard response envelope

Success:
```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable",
    "details": []
  },
  "meta": { "requestId": "uuid", "timestamp": "ISO-8601" }
}
```

## Webhooks / callbacks (integration-gateway)

Document for each:
- URL path
- HTTP method
- Headers (`X-Signature`, `Idempotency-Key`)
- Request body schema
- Response `{ "received": true }` (ACK fast)
- Async processing note + DLQ behavior

Human-readable catalogs also live under `docs/api/phase-N-endpoints.md` per phase.
