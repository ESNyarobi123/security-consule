-- Module 12-D: visitor ID document refs on VisitorAppointment.
-- Idempotent: safe after prisma db push. Existing rows = null.

CREATE SCHEMA IF NOT EXISTS visitors;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'VisitorIdType'
      AND n.nspname = 'visitors'
  ) THEN
    CREATE TYPE visitors."VisitorIdType" AS ENUM (
      'NIDA',
      'PASSPORT',
      'DRIVERS_LICENSE',
      'OTHER'
    );
  END IF;
END $$;

ALTER TABLE visitors.visitor_appointments
  ADD COLUMN IF NOT EXISTS id_type visitors."VisitorIdType",
  ADD COLUMN IF NOT EXISTS id_number VARCHAR(64);
