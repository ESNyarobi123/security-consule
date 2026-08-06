-- Module 11-B: CustomerEmployee.accessLevel (STANDARD / RESTRICTED / ELEVATED).
-- Idempotent: safe after prisma db push.

CREATE SCHEMA IF NOT EXISTS access;

DO $$ BEGIN
  CREATE TYPE access."AccessLevel" AS ENUM (
    'STANDARD', 'RESTRICTED', 'ELEVATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS access_level access."AccessLevel" NOT NULL DEFAULT 'STANDARD';
