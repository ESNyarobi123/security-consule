-- Module 15-A: Extended B2B guard supply request criteria (§15).

DO $$ BEGIN
  CREATE TYPE recruitment."GuardSupplyGenderPreference" AS ENUM (
    'ANY',
    'MALE',
    'FEMALE',
    'UNSPECIFIED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS experience_years_min INTEGER;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS age_min INTEGER;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS age_max INTEGER;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS gender_preference recruitment."GuardSupplyGenderPreference";

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS military_training_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS firearm_training_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS languages TEXT;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS height_min_cm INTEGER;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS health_condition_notes TEXT;
