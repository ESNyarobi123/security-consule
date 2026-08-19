-- Portal 35.9: AccessMethod.PIN + CustomerEmployee.identityVerifiedAt.
CREATE SCHEMA IF NOT EXISTS access;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'access'
      AND t.typname = 'AccessMethod'
      AND e.enumlabel = 'PIN'
  ) THEN
    ALTER TYPE access."AccessMethod" ADD VALUE 'PIN';
  END IF;
END $$;

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;
