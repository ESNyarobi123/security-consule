-- Module 13-H: Soft-link parking permits to visitor appointments.
-- Idempotent: safe after prisma db push. No cross-schema FK.

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS visitor_appointment_id TEXT;

CREATE INDEX IF NOT EXISTS parking_permits_visitor_appointment_id_idx
  ON parking.parking_permits (visitor_appointment_id);
