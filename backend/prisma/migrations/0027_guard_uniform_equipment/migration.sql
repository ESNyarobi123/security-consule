-- Module 8-C: thin uniform / equipment issued checklist on GuardProfile.
ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS uniform_issued BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS equipment_issued BOOLEAN NOT NULL DEFAULT FALSE;
