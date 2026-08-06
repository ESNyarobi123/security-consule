-- Module 8-F: CANCELLED on attendance.AlertnessStatus (ABSENT duty cleanup).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'attendance'
      AND t.typname = 'AlertnessStatus'
      AND e.enumlabel = 'CANCELLED'
  ) THEN
    ALTER TYPE attendance."AlertnessStatus" ADD VALUE 'CANCELLED';
  END IF;
END $$;
