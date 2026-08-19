-- Portal 35.21 — thin risk register (governance monitor, not a DPIA engine).

CREATE SCHEMA IF NOT EXISTS compliance;

DO $$ BEGIN
  CREATE TYPE compliance."RiskSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."RiskStatus" AS ENUM (
    'OPEN',
    'MITIGATING',
    'ACCEPTED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS compliance.risk_register_items (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  reference_code   TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category         TEXT NOT NULL,
  severity         compliance."RiskSeverity" NOT NULL,
  status           compliance."RiskStatus" NOT NULL DEFAULT 'OPEN',
  regulatory_ref   TEXT,
  mitigation       TEXT,
  residual_notes   TEXT,
  owner_user_id    TEXT,
  created_by       TEXT NOT NULL,
  closed_by        TEXT,
  closed_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS risk_register_items_organization_id_reference_code_key
  ON compliance.risk_register_items (organization_id, reference_code);
CREATE INDEX IF NOT EXISTS risk_register_items_organization_id_status_idx
  ON compliance.risk_register_items (organization_id, status);
CREATE INDEX IF NOT EXISTS risk_register_items_organization_id_severity_idx
  ON compliance.risk_register_items (organization_id, severity);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compliance TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA compliance
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE compliance.risk_register_items ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON compliance.risk_register_items;
  CREATE POLICY org_isolation ON compliance.risk_register_items
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
