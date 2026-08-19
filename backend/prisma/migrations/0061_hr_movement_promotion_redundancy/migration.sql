-- Module 16-A / Portal 35.4: PROMOTION and REDUNDANCY on workforce.MovementType.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'workforce'
      AND t.typname = 'MovementType'
      AND e.enumlabel = 'PROMOTION'
  ) THEN
    ALTER TYPE workforce."MovementType" ADD VALUE 'PROMOTION';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'workforce'
      AND t.typname = 'MovementType'
      AND e.enumlabel = 'REDUNDANCY'
  ) THEN
    ALTER TYPE workforce."MovementType" ADD VALUE 'REDUNDANCY';
  END IF;
END $$;
