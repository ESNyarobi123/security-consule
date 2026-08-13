-- Module 13-M: Parking patrol observations (guard inspections).
-- Idempotent: safe after prisma db push.

DO $$ BEGIN
  CREATE TYPE parking."ParkingPatrolObservationType" AS ENUM (
    'IRREGULARITY',
    'SECURITY_OBSERVATION',
    'ACCIDENT',
    'SUSPICIOUS_ACTIVITY',
    'DAMAGE',
    'ILLEGAL_PARKING',
    'ABANDONED_VEHICLE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS parking.parking_patrol_observations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   TEXT NOT NULL,
  site_id           TEXT NOT NULL,
  guard_id          TEXT NOT NULL,
  inspected_at      TIMESTAMPTZ NOT NULL,
  parking_area      TEXT NOT NULL,
  observation_type  parking."ParkingPatrolObservationType" NOT NULL,
  plate_number      TEXT,
  vehicle_id        TEXT,
  parking_space_id  TEXT,
  notes             TEXT,
  severity          TEXT NOT NULL DEFAULT 'MEDIUM',
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  client_event_id   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS parking_patrol_observations_client_event_id_key
  ON parking.parking_patrol_observations (client_event_id)
  WHERE client_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS parking_patrol_obs_org_site_inspected_idx
  ON parking.parking_patrol_observations (organization_id, site_id, inspected_at);

CREATE INDEX IF NOT EXISTS parking_patrol_obs_org_guard_inspected_idx
  ON parking.parking_patrol_observations (organization_id, guard_id, inspected_at);

CREATE INDEX IF NOT EXISTS parking_patrol_obs_org_type_inspected_idx
  ON parking.parking_patrol_observations (organization_id, observation_type, inspected_at);

GRANT USAGE ON SCHEMA parking TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA parking TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA parking
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE parking.parking_patrol_observations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON parking.parking_patrol_observations;
  CREATE POLICY org_isolation ON parking.parking_patrol_observations
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
