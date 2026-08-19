-- Guard Mobile / ESS equipment confirmation (Portal 35.6 kit check).
ALTER TABLE assets.asset_assignments
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
