-- Portal invite: force password change after temporary credentials.
ALTER TABLE iam.users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
