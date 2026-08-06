-- Module 11-C: customer employee site grants (empty = unrestricted).
-- Idempotent: safe after prisma db push.

CREATE SCHEMA IF NOT EXISTS access;

CREATE TABLE IF NOT EXISTS access.customer_employee_site_access (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  customer_id      TEXT NOT NULL,
  employee_id      TEXT NOT NULL,
  site_id          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_employee_site_access_employee_id_site_id_key
  ON access.customer_employee_site_access (employee_id, site_id);

CREATE INDEX IF NOT EXISTS customer_employee_site_access_org_cust_emp_idx
  ON access.customer_employee_site_access (organization_id, customer_id, employee_id);

GRANT USAGE ON SCHEMA access TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA access TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA access
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE access.customer_employee_site_access ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON access.customer_employee_site_access;
  CREATE POLICY org_isolation ON access.customer_employee_site_access
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
