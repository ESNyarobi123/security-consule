-- Module 13-L: Rich parking entry/exit visit record + soft ENTRY↔EXIT pair.
-- Idempotent: safe after prisma db push.

DO $$ BEGIN
  CREATE TYPE parking."ParkingVerificationMethod" AS ENUM (
    'MANUAL',
    'RFID',
    'ANPR',
    'QR',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS driver_name TEXT;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS driver_id_ref TEXT;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS verification_method parking."ParkingVerificationMethod"
    NOT NULL DEFAULT 'MANUAL';

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS purpose_of_visit TEXT;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS visitor_appointment_id TEXT;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS parking_space_id TEXT;

ALTER TABLE parking.parking_entries
  ADD COLUMN IF NOT EXISTS paired_entry_id TEXT;

CREATE INDEX IF NOT EXISTS parking_entries_org_site_plate_recorded_idx
  ON parking.parking_entries (organization_id, site_id, plate_number, recorded_at);

CREATE INDEX IF NOT EXISTS parking_entries_paired_entry_id_idx
  ON parking.parking_entries (paired_entry_id);

CREATE INDEX IF NOT EXISTS parking_entries_visitor_appointment_id_idx
  ON parking.parking_entries (visitor_appointment_id);

CREATE INDEX IF NOT EXISTS parking_entries_parking_space_id_idx
  ON parking.parking_entries (parking_space_id);

-- One EXIT may close a given ENTRY (soft pair uniqueness).
CREATE UNIQUE INDEX IF NOT EXISTS parking_entries_paired_entry_id_uidx
  ON parking.parking_entries (paired_entry_id)
  WHERE paired_entry_id IS NOT NULL;
