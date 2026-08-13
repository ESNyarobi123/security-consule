-- Module 13-G: Parking violation resolve lifecycle (OPEN → RESOLVED).
-- Idempotent: safe after prisma db push.

DO $$ BEGIN
  CREATE TYPE parking."ParkingViolationStatus" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS status parking."ParkingViolationStatus" NOT NULL DEFAULT 'OPEN';

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS resolved_by TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

CREATE INDEX IF NOT EXISTS parking_violations_org_status_recorded_idx
  ON parking.parking_violations (organization_id, status, recorded_at);
