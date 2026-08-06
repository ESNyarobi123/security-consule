-- E3: approved vehicle owner/driver binding on parking.vehicles
ALTER TABLE parking.vehicles
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS vehicles_organization_id_user_id_idx
  ON parking.vehicles (organization_id, user_id);
