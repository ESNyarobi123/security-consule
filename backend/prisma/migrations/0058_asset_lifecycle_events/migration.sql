-- Module 26-A: asset lifecycle events (transfer / dispose / maintenance / damage / replacement)
-- + disposal metadata on assets. Categories remain free-text catalog validated in app.

ALTER TABLE assets.assets
  ADD COLUMN IF NOT EXISTS disposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disposed_by TEXT,
  ADD COLUMN IF NOT EXISTS disposal_reason TEXT,
  ADD COLUMN IF NOT EXISTS maintenance_notes TEXT;

DO $$ BEGIN
  CREATE TYPE assets."AssetLifecycleEventType" AS ENUM (
    'TRANSFER',
    'DISPOSE',
    'MAINTENANCE_START',
    'MAINTENANCE_COMPLETE',
    'DAMAGE',
    'REPLACEMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS assets.asset_lifecycle_events (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL,
  asset_id              TEXT NOT NULL REFERENCES assets.assets(id) ON DELETE CASCADE,
  event_type            assets."AssetLifecycleEventType" NOT NULL,
  from_status           TEXT,
  to_status             TEXT,
  notes                 TEXT,
  from_employee_id      TEXT,
  from_guard_id         TEXT,
  to_employee_id        TEXT,
  to_guard_id           TEXT,
  replacement_asset_id  TEXT,
  condition             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS asset_lifecycle_events_org_asset_idx
  ON assets.asset_lifecycle_events (organization_id, asset_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA assets TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA assets
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE assets.asset_lifecycle_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON assets.asset_lifecycle_events;
  CREATE POLICY org_isolation ON assets.asset_lifecycle_events
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
