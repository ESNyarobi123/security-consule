-- Module 13-N: Parking violation types, officer remarks, corrective action,
-- closure approval workflow, photographs via DocumentObject (ParkingViolation).

DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'RESTRICTED_AREA';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'EMERGENCY_ROUTE_BLOCKED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'DOUBLE_PARKING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'ABANDONED_VEHICLE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ViolationType" ADD VALUE IF NOT EXISTS 'UNSAFE_PARKING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE parking."ParkingViolationStatus" ADD VALUE IF NOT EXISTS 'CORRECTIVE_ACTION';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ParkingViolationStatus" ADD VALUE IF NOT EXISTS 'PENDING_CLOSURE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE parking."ParkingViolationStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS officer_remarks TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS corrective_action TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS corrective_action_at TIMESTAMPTZ;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS corrective_action_by TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS submitted_for_closure_at TIMESTAMPTZ;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS submitted_for_closure_by TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS approved_by TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS closure_notes TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS closed_by TEXT;
