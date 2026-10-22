-- Portal 35.13 / Module 14 — formal offer workflow.
-- HR issues offer terms, the applicant accepts/declines from the careers
-- portal, and HIRED is only allowed once the offer is ACCEPTED.

DO $$ BEGIN
  CREATE TYPE recruitment."JobOfferStatus" AS ENUM (
    'PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE recruitment.job_applications
  ADD COLUMN IF NOT EXISTS offer_status recruitment."JobOfferStatus",
  ADD COLUMN IF NOT EXISTS offer_position TEXT,
  ADD COLUMN IF NOT EXISTS offer_department TEXT,
  ADD COLUMN IF NOT EXISTS offer_employment_type workforce."EmploymentType",
  ADD COLUMN IF NOT EXISTS offer_salary_amount DECIMAL(16, 2),
  ADD COLUMN IF NOT EXISTS offer_currency TEXT,
  ADD COLUMN IF NOT EXISTS offer_start_date TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS offer_message TEXT,
  ADD COLUMN IF NOT EXISTS offer_issued_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS offer_issued_by TEXT,
  ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS offer_responded_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS offer_response_reason TEXT;

CREATE INDEX IF NOT EXISTS job_applications_org_offer_status_idx
  ON recruitment.job_applications (organization_id, offer_status);

-- Demo/backfill: applications already sitting in OFFERED get a stand-in offer
-- so the HR inbox is not stuck on a state the applicant can never answer.
UPDATE recruitment.job_applications
SET
  offer_status = 'PENDING',
  offer_position = COALESCE(offer_position, 'Pending role'),
  offer_issued_at = COALESCE(offer_issued_at, CURRENT_TIMESTAMP),
  offer_expires_at = COALESCE(offer_expires_at, CURRENT_TIMESTAMP + INTERVAL '7 days')
WHERE status = 'OFFERED'
  AND offer_status IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pssms_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA recruitment TO pssms_app;
  END IF;
END $$;
