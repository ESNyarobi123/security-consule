-- E2 Portal 35.14: B2B other security company + guard supply requests
-- IDs are TEXT to match Prisma / existing recruitment + iam tables.

ALTER TABLE iam.users
  ADD COLUMN IF NOT EXISTS b2b_partner_id TEXT;

-- If a prior UUID attempt left the wrong type, coerce to TEXT.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'iam' AND table_name = 'users'
      AND column_name = 'b2b_partner_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE iam.users
      ALTER COLUMN b2b_partner_id TYPE TEXT USING b2b_partner_id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_organization_id_b2b_partner_id_idx
  ON iam.users (organization_id, b2b_partner_id);

DO $$ BEGIN
  CREATE TYPE recruitment."B2bPartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recruitment."GuardSupplyRequestStatus" AS ENUM (
    'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Recreate if earlier UUID-typed draft tables exist
DROP TABLE IF EXISTS recruitment.guard_supply_requests CASCADE;
DROP TABLE IF EXISTS recruitment.b2b_security_partners CASCADE;

CREATE TABLE recruitment.b2b_security_partners (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status recruitment."B2bPartnerStatus" NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  UNIQUE (organization_id, code)
);

CREATE TABLE recruitment.guard_supply_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  partner_id TEXT NOT NULL REFERENCES recruitment.b2b_security_partners(id),
  reference_number TEXT NOT NULL,
  guard_count INT NOT NULL,
  site_location TEXT,
  start_date DATE,
  end_date DATE,
  criteria_notes TEXT,
  status recruitment."GuardSupplyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  processed_by TEXT,
  processed_at TIMESTAMP(3),
  staff_notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  UNIQUE (organization_id, reference_number)
);

CREATE INDEX guard_supply_requests_org_partner_idx
  ON recruitment.guard_supply_requests (organization_id, partner_id);

CREATE INDEX guard_supply_requests_org_status_idx
  ON recruitment.guard_supply_requests (organization_id, status);

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['b2b_security_partners', 'guard_supply_requests'] LOOP
    EXECUTE format('ALTER TABLE recruitment.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON recruitment.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON recruitment.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pssms_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA recruitment TO pssms_app;
  END IF;
END $$;
