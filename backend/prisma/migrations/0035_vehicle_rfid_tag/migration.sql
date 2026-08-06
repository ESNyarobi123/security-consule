-- Module 13-A: Vehicle RFID / tag refs.
-- Idempotent: safe after prisma db push. Existing rows = null.
-- PG UNIQUE allows multiple NULLs for rfid_tag_ref.

ALTER TABLE parking.vehicles
  ADD COLUMN IF NOT EXISTS rfid_tag_ref TEXT;

-- Prefer unique index (IF NOT EXISTS) so re-runs are safe after db push
-- already created vehicles_organization_id_rfid_tag_ref_key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'vehicles_organization_id_rfid_tag_ref_key'
      AND n.nspname = 'parking'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_organization_id_rfid_tag_ref_key'
  ) THEN
    ALTER TABLE parking.vehicles
      ADD CONSTRAINT vehicles_organization_id_rfid_tag_ref_key
      UNIQUE (organization_id, rfid_tag_ref);
  END IF;
END $$;
