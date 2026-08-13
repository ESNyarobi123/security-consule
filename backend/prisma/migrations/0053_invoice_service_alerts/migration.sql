-- Module 21-A: invoice service type + CLOSED status (design: draft/issued/partial/paid/overdue/disputed/cancelled/closed).

ALTER TABLE finance.invoices
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(40);

CREATE INDEX IF NOT EXISTS invoices_service_type_idx
  ON finance.invoices (organization_id, service_type)
  WHERE service_type IS NOT NULL;

UPDATE finance.invoices i
SET service_type = c.service_type
FROM contracts.contracts c
WHERE i.contract_id = c.id
  AND i.service_type IS NULL
  AND c.service_type IS NOT NULL;

DO $$ BEGIN
  ALTER TYPE finance."InvoiceStatus" ADD VALUE 'CLOSED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
