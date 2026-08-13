-- Module 13-P: Parking violation fines → finance invoice + payment track.

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS fine_amount DECIMAL(14, 2);

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'TZS';

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14, 2);

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS invoice_id TEXT;

ALTER TABLE parking.parking_violations
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS parking_violations_invoice_id_idx
  ON parking.parking_violations (invoice_id)
  WHERE invoice_id IS NOT NULL;
