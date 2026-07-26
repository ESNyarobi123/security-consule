-- Thin storekeeper confirm on equipment return (ESS request → confirm).
-- Idempotent: safe after prisma db push which may already add these columns/enum.

ALTER TYPE assets."AssetStatus" ADD VALUE IF NOT EXISTS 'RETURN_PENDING';

ALTER TABLE assets.asset_assignments
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS return_condition TEXT,
  ADD COLUMN IF NOT EXISTS return_receipt_note TEXT,
  ADD COLUMN IF NOT EXISTS return_confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS asset_assignments_organization_id_return_requested_at_idx
  ON assets.asset_assignments (organization_id, return_requested_at);
