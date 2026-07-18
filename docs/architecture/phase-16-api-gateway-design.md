# Phase 16 — API Gateway / BFF-lite

## Goal

NestJS Fastify **api-gateway** on **:4000** — single public entry over modular monolith **core-api :4001**.

Gateway ≠ business microservice. No domain libs. Auth verification stays on core-api; gateway forwards JWT.

## Research applied

| Pattern | Source | PSSMS |
|---|---|---|
| Reverse proxy catch-all | Nest gateway / Axios-proxy articles | `fetch` forward preserve status+body |
| Rate limit @ edge | `@nestjs/throttler` + Fastify trustProxy | 120 / 60s / IP |
| Request ID | Observability community | generate/forward `x-request-id` |
| Do not expose internals | Zero-trust BFF | Block `/api/v1/internal/**` |

## Behavior

```text
Client → :4000 /api/v1/* → (block /internal) → :4001 /api/v1/*
                 ↓
           rate limit + request-id
```

| Route | Action |
|---|---|
| `GET /api/v1/health` | Local `{ status, service: 'api-gateway' }` |
| `* /api/v1/internal/**` | **404** — never forward |
| other `/api/v1/**` | Proxy to `CORE_API_URL` |

## Env

| Var | Default |
|---|---|
| `API_GATEWAY_PORT` | `4000` |
| `CORE_API_URL` | `http://127.0.0.1:4001` |
| `GATEWAY_THROTTLE_LIMIT` | `120` |
| `GATEWAY_THROTTLE_TTL` | `60000` |

## Dual-mode cutover

- Portals / mobile keep **:4001** by default (local E2E stable)
- Document `NEXT_PUBLIC_CORE_API_URL=http://localhost:4000` as recommended production entry
- Workers / integration **must** keep `CORE_API_INTERNAL_URL=:4001` (internal routes blocked on gateway)
- Reporting stays on **:4005** (not routed in MVP)
- Mobile: `EXPO_PUBLIC_API_BASE=http://host:4000/api/v1` when cutting over

## Run

```bash
cd backend
npm run start:core      # :4001
npm run start:gateway   # :4000
```

## Deferred

Keycloak SSO (Phase 17), Redis throttle store, multi-service routing (reporting/realtime), BFF response aggregates, force all portals to 4000.
