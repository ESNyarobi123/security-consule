-- Thin customer portal service tickets (Portal 35.8 / Call Centre handoff).
-- Idempotent: safe after prisma db push.

CREATE SCHEMA IF NOT EXISTS customers;

DO $$ BEGIN
  CREATE TYPE customers."ServiceRequestCategory" AS ENUM (
    'EXTRA_GUARDS', 'COVERAGE', 'ACCESS', 'VISITOR', 'BILLING', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."ServiceRequestUrgency" AS ENUM (
    'SAME_DAY', 'THIS_WEEK', 'PLANNING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."ServiceRequestStatus" AS ENUM (
    'OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customers.service_requests (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  customer_id      TEXT NOT NULL REFERENCES customers.customers(id),
  reference_number TEXT NOT NULL,
  category         customers."ServiceRequestCategory" NOT NULL,
  urgency          customers."ServiceRequestUrgency" NOT NULL DEFAULT 'THIS_WEEK',
  status           customers."ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  site_id          TEXT,
  callback_phone   TEXT,
  created_by       TEXT NOT NULL,
  acknowledged_by  TEXT,
  acknowledged_at  TIMESTAMPTZ,
  resolved_by      TEXT,
  resolved_at      TIMESTAMPTZ,
  closed_by        TEXT,
  closed_at        TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_requests_organization_id_reference_number_key
  ON customers.service_requests (organization_id, reference_number);
CREATE INDEX IF NOT EXISTS service_requests_organization_id_customer_id_status_idx
  ON customers.service_requests (organization_id, customer_id, status);
CREATE INDEX IF NOT EXISTS service_requests_organization_id_status_created_at_idx
  ON customers.service_requests (organization_id, status, created_at);

GRANT USAGE ON SCHEMA customers TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA customers TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA customers TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA customers
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE customers.service_requests ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON customers.service_requests;
  CREATE POLICY org_isolation ON customers.service_requests
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
