-- Module 13-O: Chargeable parking permits — billing period, unit rate,
-- quantity, discount/penalty, SUPPLIER type, payment tracking via invoice.

DO $$ BEGIN
  ALTER TYPE parking."PermitType" ADD VALUE IF NOT EXISTS 'SUPPLIER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parking."ParkingBillingPeriod" AS ENUM (
    'ONE_TIME',
    'DAILY',
    'MONTHLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS billing_period parking."ParkingBillingPeriod"
    NOT NULL DEFAULT 'ONE_TIME';

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS unit_rate DECIMAL(14, 2);

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS quantity DECIMAL(14, 2);

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14, 2);

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS penalty_amount DECIMAL(14, 2);
