-- Module 12-B: visitor gate entry/exit direction on VisitorEntry.
-- Idempotent: safe after prisma db push. Existing rows = IN.

CREATE SCHEMA IF NOT EXISTS visitors;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'VisitorEntryDirection'
      AND n.nspname = 'visitors'
  ) THEN
    CREATE TYPE visitors."VisitorEntryDirection" AS ENUM ('IN', 'OUT');
  END IF;
END $$;

ALTER TABLE visitors.visitor_entries
  ADD COLUMN IF NOT EXISTS direction visitors."VisitorEntryDirection" NOT NULL DEFAULT 'IN';

CREATE INDEX IF NOT EXISTS visitor_entries_appointment_id_direction_recorded_at_idx
  ON visitors.visitor_entries (appointment_id, direction, recorded_at);
