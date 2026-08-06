-- Module 8-B: thin medical fitness + national ID ref on GuardProfile.
ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS medical_fitness_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS medical_fitness_expiry DATE;

ALTER TABLE workforce.guard_profiles
  ADD COLUMN IF NOT EXISTS national_id_ref TEXT;
