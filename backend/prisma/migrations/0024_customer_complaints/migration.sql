-- Module 6-B — customer complaints register (distinct from service_requests).
-- Idempotent: safe after prisma db push.

CREATE SCHEMA IF NOT EXISTS customers;

DO $$ BEGIN
  CREATE TYPE customers."ComplaintCategory" AS ENUM (
    'SERVICE_QUALITY', 'GUARD_CONDUCT', 'BILLING', 'ATTENDANCE', 'SECURITY', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."ComplaintSeverity" AS ENUM (
    'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."ComplaintStatus" AS ENUM (
    'OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customers.complaints (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  customer_id      TEXT NOT NULL REFERENCES customers.customers(id),
  reference_number TEXT NOT NULL,
  category         customers."ComplaintCategory" NOT NULL,
  severity         customers."ComplaintSeverity" NOT NULL DEFAULT 'MEDIUM',
  status           customers."ComplaintStatus" NOT NULL DEFAULT 'OPEN',
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

CREATE UNIQUE INDEX IF NOT EXISTS complaints_organization_id_reference_number_key
  ON customers.complaints (organization_id, reference_number);
CREATE INDEX IF NOT EXISTS complaints_organization_id_customer_id_status_idx
  ON customers.complaints (organization_id, customer_id, status);
CREATE INDEX IF NOT EXISTS complaints_organization_id_status_created_at_idx
  ON customers.complaints (organization_id, status, created_at);

GRANT USAGE ON SCHEMA customers TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA customers TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA customers TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA customers
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE customers.complaints ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON customers.complaints;
  CREATE POLICY org_isolation ON customers.complaints
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
