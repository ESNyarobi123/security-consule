-- Module 32-A: DPO consent / lawful-basis records.

DO $$ BEGIN
  CREATE TYPE compliance."ConsentSubjectType" AS ENUM (
    'EMPLOYEE',
    'GUARD',
    'CUSTOMER_EMPLOYEE',
    'VISITOR',
    'APPLICANT',
    'SUPPLIER_CONTACT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."ConsentLawfulBasis" AS ENUM (
    'CONSENT',
    'CONTRACT',
    'LEGAL_OBLIGATION',
    'VITAL_INTERESTS',
    'PUBLIC_TASK',
    'LEGITIMATE_INTERESTS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."ConsentChannel" AS ENUM (
    'WEB_FORM',
    'PAPER',
    'EMAIL',
    'SMS',
    'IN_PERSON',
    'MOBILE_APP',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE compliance."ConsentStatus" AS ENUM (
    'ACTIVE',
    'WITHDRAWN',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS compliance.consent_records (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  reference_code   TEXT NOT NULL,
  subject_type     compliance."ConsentSubjectType" NOT NULL,
  subject_name     TEXT NOT NULL,
  subject_email    TEXT,
  subject_ref      TEXT,
  purpose          TEXT NOT NULL,
  lawful_basis     compliance."ConsentLawfulBasis" NOT NULL,
  channel          compliance."ConsentChannel" NOT NULL,
  status           compliance."ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
  granted_at       TIMESTAMPTZ NOT NULL,
  expires_at       TIMESTAMPTZ,
  withdrawn_at     TIMESTAMPTZ,
  withdrawn_by     TEXT,
  withdraw_reason  TEXT,
  notes            TEXT,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_records_organization_id_reference_code_key
  ON compliance.consent_records (organization_id, reference_code);
CREATE INDEX IF NOT EXISTS consent_records_organization_id_status_idx
  ON compliance.consent_records (organization_id, status);
CREATE INDEX IF NOT EXISTS consent_records_organization_id_subject_type_idx
  ON compliance.consent_records (organization_id, subject_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compliance TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA compliance
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE compliance.consent_records ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON compliance.consent_records;
  CREATE POLICY org_isolation ON compliance.consent_records
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
