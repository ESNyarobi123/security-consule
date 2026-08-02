-- Contract commercial/lifecycle fields (C1): kind, renewal, notice, invoicing, VAT, SLA level.
ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS contract_kind TEXT NOT NULL DEFAULT 'NEW';

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS renewal_date DATE;

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS notice_period_days INTEGER NOT NULL DEFAULT 30;

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS invoice_frequency TEXT DEFAULT 'MONTHLY';

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS vat_applicable BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS sla_level TEXT DEFAULT 'STANDARD';
