-- Phase: compliance schema — policies + DPO data breach register.
-- Idempotent: safe after prisma db push which may already create schema/tables.

CREATE SCHEMA IF NOT EXISTS compliance;

-- Enums (Prisma names match generator defaults)
DO $$ BEGIN
  CREATE TYPE compliance."PolicyStatus" AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."BreachSeverity" AS ENUM (
    'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."BreachStatus" AS ENUM (
    'REPORTED', 'INVESTIGATING', 'CONTAINED', 'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS compliance.policy_documents (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  code                 TEXT NOT NULL,
  title                TEXT NOT NULL,
  category             TEXT NOT NULL,
  summary              TEXT,
  body                 TEXT NOT NULL,
  version              INTEGER NOT NULL DEFAULT 1,
  status               compliance."PolicyStatus" NOT NULL DEFAULT 'DRAFT',
  approval_instance_id TEXT,
  created_by           TEXT NOT NULL,
  published_at         TIMESTAMPTZ,
  published_by         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_documents_organization_id_code_key
  ON compliance.policy_documents (organization_id, code);
CREATE INDEX IF NOT EXISTS policy_documents_organization_id_status_idx
  ON compliance.policy_documents (organization_id, status);

CREATE TABLE IF NOT EXISTS compliance.data_breach_cases (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL,
  reference_code           TEXT NOT NULL,
  title                    TEXT NOT NULL,
  description              TEXT NOT NULL,
  severity                 compliance."BreachSeverity" NOT NULL,
  status                   compliance."BreachStatus" NOT NULL DEFAULT 'REPORTED',
  discovered_at            TIMESTAMPTZ NOT NULL,
  reported_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  affected_data_categories TEXT,
  estimated_records        INTEGER,
  containment_notes        TEXT,
  closed_at                TIMESTAMPTZ,
  closed_by                TEXT,
  created_by               TEXT NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS data_breach_cases_organization_id_reference_code_key
  ON compliance.data_breach_cases (organization_id, reference_code);
CREATE INDEX IF NOT EXISTS data_breach_cases_organization_id_status_idx
  ON compliance.data_breach_cases (organization_id, status);

-- Runtime privileges for the non-owner app role used by core-api.
GRANT USAGE ON SCHEMA compliance TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compliance TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA compliance TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA compliance
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA compliance
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pssms_app;

-- Org-isolation RLS (fail-closed + rls_bypass escape hatch) — mirror devices.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['policy_documents', 'data_breach_cases'] LOOP
    EXECUTE format('ALTER TABLE compliance.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON compliance.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON compliance.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;
