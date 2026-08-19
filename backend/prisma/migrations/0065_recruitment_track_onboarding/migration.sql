-- Portal 35.13: applicant track on postings + hire onboarding checklist (not IAM roles).
CREATE SCHEMA IF NOT EXISTS recruitment;

ALTER TABLE recruitment.job_postings
  ADD COLUMN IF NOT EXISTS applicant_track VARCHAR(40) NOT NULL DEFAULT 'GENERAL';

ALTER TABLE recruitment.job_applications
  ADD COLUMN IF NOT EXISTS onboarding_progress JSONB;
