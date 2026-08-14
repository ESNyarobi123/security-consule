-- Module 31-A: incident case management depth.
-- Preserve existing rows while adding occurrence/location, response, resolution,
-- and explicit closure-approval metadata.

ALTER TABLE incidents.incidents
  ADD COLUMN IF NOT EXISTS location_description TEXT,
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by TEXT,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closure_approval_note TEXT;

UPDATE incidents.incidents
SET occurred_at = COALESCE(device_reported_at, created_at, NOW())
WHERE occurred_at IS NULL;

ALTER TABLE incidents.incidents
  ALTER COLUMN occurred_at SET DEFAULT NOW(),
  ALTER COLUMN occurred_at SET NOT NULL;
