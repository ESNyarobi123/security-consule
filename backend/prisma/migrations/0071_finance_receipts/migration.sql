-- Portal 35.15 — receipt register (details + MinIO scan via documents).
CREATE SCHEMA IF NOT EXISTS finance;

DO $$ BEGIN
  CREATE TYPE finance."ReceiptPayerType" AS ENUM ('CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS finance.finance_receipts (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL,
  receipt_number     TEXT NOT NULL,
  payer_type         finance."ReceiptPayerType" NOT NULL,
  payer_name         TEXT NOT NULL,
  customer_id        TEXT,
  invoice_id         TEXT,
  invoice_payment_id TEXT,
  amount             NUMERIC(14,2) NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'TZS',
  payment_method     finance."PaymentMethod" NOT NULL,
  payment_reference  TEXT,
  received_at        TIMESTAMPTZ NOT NULL,
  notes              TEXT,
  created_by         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_receipts_org_number_key
  ON finance.finance_receipts (organization_id, receipt_number);

CREATE INDEX IF NOT EXISTS finance_receipts_org_received_idx
  ON finance.finance_receipts (organization_id, received_at);

CREATE INDEX IF NOT EXISTS finance_receipts_org_invoice_idx
  ON finance.finance_receipts (organization_id, invoice_id);

GRANT USAGE ON SCHEMA finance TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA finance TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA finance TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA finance
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE finance.finance_receipts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON finance.finance_receipts;
  CREATE POLICY org_isolation ON finance.finance_receipts
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
