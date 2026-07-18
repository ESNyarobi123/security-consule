-- Sprint 0: IAM security hardening (MFA + user lifecycle)
-- Adds TOTP MFA secret storage and user suspension metadata.

ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMP(3);
ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP(3);
ALTER TABLE iam.users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
