-- Module 15-B: B2B guard supply billing — partner customer link + request charges/invoice.

ALTER TABLE recruitment.b2b_security_partners
  ADD COLUMN IF NOT EXISTS customer_id UUID;

CREATE INDEX IF NOT EXISTS b2b_security_partners_customer_id_idx
  ON recruitment.b2b_security_partners (customer_id);

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS unit_rate_per_guard DECIMAL(14, 2);

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS service_fee_amount DECIMAL(14, 2);

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS currency VARCHAR(8) DEFAULT 'TZS';

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(14, 2);

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS invoice_id UUID;

ALTER TABLE recruitment.guard_supply_requests
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS guard_supply_requests_invoice_id_idx
  ON recruitment.guard_supply_requests (invoice_id);
