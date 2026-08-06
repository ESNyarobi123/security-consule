-- Module 8-D: ABSENT on workforce.GuardStatus (design §8 roster statuses).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'workforce'
      AND t.typname = 'GuardStatus'
      AND e.enumlabel = 'ABSENT'
  ) THEN
    ALTER TYPE workforce."GuardStatus" ADD VALUE 'ABSENT';
  END IF;
END $$;
