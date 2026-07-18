# PSSMS Frontend

Next.js + TypeScript monorepo (Turborepo).

## Apps

| App | Port | Watumiaji |
|---|---|---|
| `apps/admin-web` | 3000 | Internal portals zote — role-based routes (`/hr`, `/payroll`, `/finance`, `/procurement`, `/compliance`, `/operations`, `/cctv`, `/callcentre`, `/marketing`, `/branch`, `/developer`, `/superadmin`) |
| `apps/executive-web` | 3001 | Executive dashboards (CMD, CEO, GM, Department Heads) |
| `apps/customer-web` | 3002 | Customer Portal + Customer Employee Access |
| `apps/supplier-web` | 3003 | Supplier Portal |
| `apps/recruitment-web` | 3004 | Public careers (browse/apply) — no auth cookies |
| `apps/visitor-web` | 3005 | Visitor Appointment Portal (public) |
| `apps/parking-web` | 3006 | Parking Management Portal |
| `apps/public-web` | 3007 | Company website |

## Packages (shared)

| Package | Kazi |
|---|---|
| `packages/ui` | Design system components |
| `packages/api-client` | Typed API client (generated kutoka OpenAPI) |
| `packages/auth` | Session, token refresh, Keycloak helpers |
| `packages/permissions` | RBAC/ABAC checks upande wa frontend |
| `packages/types` | Shared TypeScript types/DTOs |
| `packages/validation` | Shared zod schemas |
| `packages/config` | ESLint, TSConfig, Tailwind presets |
| `packages/hooks` | Shared React hooks |
| `packages/i18n` | Swahili / English translations |

## Scaffolding

Phase 7b — executive-web:

```bash
cd frontend
npm install
cp apps/executive-web/.env.local.example apps/executive-web/.env.local
npm run dev --workspace=executive-web   # http://localhost:3001
```

Phase 8 — admin-web:

```bash
cp apps/admin-web/.env.local.example apps/admin-web/.env.local
npm run dev --workspace=admin-web       # http://localhost:3000
```

Login (seed): `admin@highlink.co.tz` / `ChangeMe123!`

Phase 9 — customer-web:

```bash
cp apps/customer-web/.env.local.example apps/customer-web/.env.local
npm run dev --workspace=customer-web    # http://localhost:3002
# or: pnpm --filter customer-web dev
```

Talks only to core-api (`NEXT_PUBLIC_CORE_API_URL`, default `http://localhost:4001`).

Login (seed): `portal@demo-mfg.co.tz` / `ChangeMe123!`

Auth cookies (isolated from admin): `pssms_customer_token`, `pssms_customer_user`.

Routes: `/dashboard`, `/contracts`, `/invoices`, `/visitors`, `/access`, `/parking`.

Phase 10 — supplier-web + visitor-web:

```bash
cp apps/supplier-web/.env.local.example apps/supplier-web/.env.local
npm run dev --workspace=supplier-web    # http://localhost:3003

cp apps/visitor-web/.env.local.example apps/visitor-web/.env.local
# Set NEXT_PUBLIC_ORG_ID, NEXT_PUBLIC_CUSTOMER_ID, NEXT_PUBLIC_SITE_ID
# (or rely on GET /api/v1/visitors/public-config when available)
npm run dev --workspace=visitor-web     # http://localhost:3005
```

Supplier talks only to core-api (`:4001`). Cookies: `pssms_supplier_token`, `pssms_supplier_user`.

Login (seed): `portal@uniforms.co.tz` / `ChangeMe123!`

Supplier routes: `/dashboard`, `/profile`, `/orders`.

Visitor-web is public (no auth cookies). Routes: `/` (form), `/success?ref=…` (reference number only — never verification code).

Phase 11 — recruitment-web (public careers):

```bash
cp apps/recruitment-web/.env.local.example apps/recruitment-web/.env.local
npm run dev --workspace=recruitment-web   # http://localhost:3004
```

Talks only to core-api (`NEXT_PUBLIC_CORE_API_URL`, default `http://localhost:4001`). No auth cookies / no middleware login.

Routes: `/` (open jobs), `/jobs/[id]`, `/jobs/[id]/apply`, `/success?ref=APP-…`, `/status` (reference + email).

Demo seed posting: `00000000-0000-4000-8000-000000000101` (`Security Guard — Industrial Sites`).

Phase 12 — parking-web (ops portal):

```bash
cp apps/parking-web/.env.local.example apps/parking-web/.env.local
npm run dev --workspace=parking-web    # http://localhost:3006
```

Talks only to core-api (`NEXT_PUBLIC_CORE_API_URL`, default `http://localhost:4001`).

Login (seed): `parking1@highlink.co.tz` / `ChangeMe123!`

Auth cookies (isolated): `pssms_parking_token`, `pssms_parking_user`.

Routes: `/dashboard`, `/permits`, `/entries`, `/violations`, `/anpr`, `/blacklist`.

ANPR screens show plate metadata results only — no video players.
