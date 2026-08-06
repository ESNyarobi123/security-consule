-- M5-E: IAM role-change requests (approval-gated)

DO $$ BEGIN
  CREATE TYPE iam."IamChangeRequestStatus" AS ENUM (
    'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS iam.iam_change_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'ROLE_ASSIGNMENT',
  proposed_role_codes TEXT[] NOT NULL,
  previous_role_codes TEXT[] NOT NULL,
  status iam."IamChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  approval_instance_id TEXT,
  created_by TEXT NOT NULL,
  decided_by TEXT,
  decided_at TIMESTAMP(3),
  reject_reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS iam_change_requests_org_status_idx
  ON iam.iam_change_requests (organization_id, status);

CREATE INDEX IF NOT EXISTS iam_change_requests_org_target_idx
  ON iam.iam_change_requests (organization_id, target_user_id);

ALTER TABLE iam.iam_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON iam.iam_change_requests;
CREATE POLICY org_isolation ON iam.iam_change_requests
  USING (
    organization_id = current_setting('app.organization_id', true)
    OR current_setting('app.rls_bypass', true) = 'on'
  )
  WITH CHECK (
    organization_id = current_setting('app.organization_id', true)
    OR current_setting('app.rls_bypass', true) = 'on'
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pssms_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON iam.iam_change_requests TO pssms_app;
  END IF;
END $$;
