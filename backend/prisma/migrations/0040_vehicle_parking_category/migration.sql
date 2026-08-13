-- Module 13-I: Vehicle parking category + driver details.
-- Idempotent: safe after prisma db push.

DO $$ BEGIN
  CREATE TYPE parking."ParkingCategory" AS ENUM (
    'CUSTOMER',
    'CUSTOMER_EMPLOYEE',
    'VISITOR',
    'COMPANY',
    'PATROL',
    'SUPPLIER',
    'CONTRACTOR',
    'EMERGENCY',
    'TEMPORARY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE parking.vehicles
  ADD COLUMN IF NOT EXISTS parking_category parking."ParkingCategory" NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE parking.vehicles
  ADD COLUMN IF NOT EXISTS driver_name TEXT;

ALTER TABLE parking.vehicles
  ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- Legacy fleet rows (no customer) were defaulted to CUSTOMER; treat as COMPANY.
UPDATE parking.vehicles
SET parking_category = 'COMPANY'
WHERE customer_id IS NULL
  AND parking_category = 'CUSTOMER';

CREATE INDEX IF NOT EXISTS vehicles_org_parking_category_idx
  ON parking.vehicles (organization_id, parking_category);
