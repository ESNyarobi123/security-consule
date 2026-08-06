-- Module 13-B: Parking permit fee / billing fields.
-- Idempotent: safe after prisma db push. invoice_id is a soft UUID link (no FK).

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(14, 2);

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS';

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS invoice_id TEXT;

ALTER TABLE parking.parking_permits
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS parking_permits_invoice_id_idx
  ON parking.parking_permits (invoice_id);
