-- M5-K: org-level password policy (JSON overlay on enterprise defaults).
ALTER TABLE enterprise.organizations
  ADD COLUMN IF NOT EXISTS password_policy JSONB;