-- Module 6-M — customer contacts directory (multi-person beyond scalar contactPerson).
-- Idempotent: safe after prisma db push.

CREATE SCHEMA IF NOT EXISTS customers;

DO $$ BEGIN
  CREATE TYPE customers."CustomerContactRole" AS ENUM (
    'GENERAL', 'BILLING', 'OPERATIONS', 'SECURITY', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customers.contacts (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  customer_id      TEXT NOT NULL REFERENCES customers.customers(id),
  full_name        TEXT NOT NULL,
  designation      TEXT,
  role             customers."CustomerContactRole" NOT NULL DEFAULT 'GENERAL',
  email            TEXT,
  phone            TEXT,
  alt_phone        TEXT,
  is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contacts_organization_id_customer_id_is_active_idx
  ON customers.contacts (organization_id, customer_id, is_active);
CREATE INDEX IF NOT EXISTS contacts_organization_id_customer_id_is_primary_idx
  ON customers.contacts (organization_id, customer_id, is_primary);

GRANT USAGE ON SCHEMA customers TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA customers TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA customers TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA customers
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE customers.contacts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON customers.contacts;
  CREATE POLICY org_isolation ON customers.contacts
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
