# Phase 16 — API Gateway

Base: `http://localhost:4000/api/v1`  
Upstream: `http://localhost:4001/api/v1` (core-api)

## Health (local)

```http
GET /health
→ { "status": "ok", "service": "api-gateway" }
```

## Proxy examples

```http
POST /auth/login
{ "email": "admin@highlink.co.tz", "password": "ChangeMe123!" }

GET /enterprise/sites
Authorization: Bearer <token>
```

Responses are **verbatim** from core-api (same envelope). Headers: `x-request-id` always present.

## Blocked

```http
POST /internal/v1/parking/anpr-results
→ 404
```

Service/worker traffic must use `CORE_API_INTERNAL_URL` (:4001) directly.

## Rate limit

Default **120 requests / 60 seconds / IP** → HTTP 429 when exceeded.
