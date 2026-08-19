-- Portal 35.20 — support ticket categories (parking/supplier/payroll/incident) + escalation pointer.
CREATE SCHEMA IF NOT EXISTS customers;

DO $$ BEGIN
  ALTER TYPE customers."ServiceRequestCategory" ADD VALUE 'PARKING';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE customers."ServiceRequestCategory" ADD VALUE 'SUPPLIER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE customers."ServiceRequestCategory" ADD VALUE 'PAYROLL';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE customers."ServiceRequestCategory" ADD VALUE 'INCIDENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE customers.service_requests
  ADD COLUMN IF NOT EXISTS incident_id TEXT,
  ADD COLUMN IF NOT EXISTS incident_number TEXT;
