# PSSMS Backend

NestJS (Fastify) modular monolith + Python FastAPI AI services.

## Phase 1 quick start

```bash
# 1. Start Postgres (Docker Desktop must be running)
docker compose -f infra/docker/docker-compose.yml up -d postgres

# 2. Migrate + seed
./scripts/phase1-bootstrap.sh

# 3. Run API
cd backend && npm run start:core
```

- API: `http://localhost:4001/api/v1`
- **Swagger:** `http://localhost:4001/docs`
- Seeded users: see `docs/api/phase-1-endpoints.md`

## Apps

| App | Port | Status |
|---|---|---|
| `apps/core-api` | 4001 | **Phase 1 active** |
| `apps/api-gateway` | 4000 | Phase 1b |
| Others | — | Later phases |

Progress tracker: `docs/phases/PROGRESS.md`
