-- G3: thin GuardProfile readiness checklist (training / firearm / clearance).
ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS training_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS firearm_authorized BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS firearm_expiry DATE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS clearance_verified BOOLEAN NOT NULL DEFAULT FALSE;
