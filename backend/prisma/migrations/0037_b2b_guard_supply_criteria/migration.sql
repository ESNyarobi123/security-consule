-- §15 / Portal 35.14: partner request criteria — qualifications, training, urgency, service terms.

DO $$ BEGIN
  CREATE TYPE recruitment."GuardSupplyUrgency" AS ENUM ('STANDARD', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS qualifications TEXT;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS training_needs TEXT;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS urgency recruitment."GuardSupplyUrgency" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS service_terms TEXT;
