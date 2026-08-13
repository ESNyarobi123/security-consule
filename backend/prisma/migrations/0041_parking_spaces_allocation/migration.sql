-- Module 13-J: Parking spaces + allocation (manual / AUTO-eligible).
-- Idempotent: safe after prisma db push.

DO $$ BEGIN
  CREATE TYPE parking."ParkingSpaceType" AS ENUM (
    'EMPLOYEE',
    'VISITOR',
    'VIP',
    'CONTRACTOR',
    'SUPPLIER',
    'FLEET',
    'RESERVED',
    'DISABLED',
    'TEMPORARY',
    'OVERFLOW'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE parking."ParkingSpaceStatus" AS ENUM (
    'AVAILABLE',
    'OCCUPIED',
    'RESERVED',
    'OUT_OF_SERVICE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE parking."ParkingAllocationMode" AS ENUM (
    'MANUAL',
    'AUTO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS parking.parking_spaces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  TEXT NOT NULL,
  site_id          TEXT NOT NULL,
  customer_id      TEXT,
  code             TEXT NOT NULL,
  label            TEXT,
  space_type       parking."ParkingSpaceType" NOT NULL,
  status           parking."ParkingSpaceStatus" NOT NULL DEFAULT 'AVAILABLE',
  allocation_mode  parking."ParkingAllocationMode" NOT NULL DEFAULT 'MANUAL',
  vehicle_id       TEXT,
  permit_id        TEXT,
  allocated_at     TIMESTAMPTZ,
  allocated_by     TEXT,
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS parking_spaces_org_site_code_key
  ON parking.parking_spaces (organization_id, site_id, code);

CREATE INDEX IF NOT EXISTS parking_spaces_org_site_type_status_idx
  ON parking.parking_spaces (organization_id, site_id, space_type, status);

CREATE INDEX IF NOT EXISTS parking_spaces_org_vehicle_idx
  ON parking.parking_spaces (organization_id, vehicle_id);

CREATE INDEX IF NOT EXISTS parking_spaces_org_customer_idx
  ON parking.parking_spaces (organization_id, customer_id);

GRANT USAGE ON SCHEMA parking TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA parking TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA parking TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA parking
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE parking.parking_spaces ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON parking.parking_spaces;
  CREATE POLICY org_isolation ON parking.parking_spaces
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
