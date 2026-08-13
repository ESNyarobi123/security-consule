-- Module 24-A: supplier registration completeness + portal submissions.
-- REJECTED status; profile (VRN, category, bank/MM, contacts); quotes/invoices/DNs/payment requests.

DO $$ BEGIN
  ALTER TYPE procurement."SupplierStatus" ADD VALUE 'REJECTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement."SupplierCategory" AS ENUM ('GOODS', 'SERVICES', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement."SupplierSubmissionKind" AS ENUM (
    'QUOTATION', 'INVOICE', 'DELIVERY_NOTE', 'PAYMENT_REQUEST'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement."SupplierSubmissionStatus" AS ENUM (
    'SUBMITTED', 'APPROVED', 'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement."SupplierPaymentStatus" AS ENUM (
    'NONE', 'UNPAID', 'PAID'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE procurement.suppliers
  ADD COLUMN IF NOT EXISTS vrn VARCHAR(64),
  ADD COLUMN IF NOT EXISTS category procurement."SupplierCategory" NOT NULL DEFAULT 'GOODS',
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(160),
  ADD COLUMN IF NOT EXISTS bank_account_ref VARCHAR(80),
  ADD COLUMN IF NOT EXISTS mobile_money_provider VARCHAR(40),
  ADD COLUMN IF NOT EXISTS mobile_money_ref VARCHAR(80),
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(160),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(160),
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS suppliers_org_status_idx
  ON procurement.suppliers (organization_id, status);

CREATE TABLE IF NOT EXISTS procurement.supplier_submissions (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL,
  supplier_id       TEXT NOT NULL REFERENCES procurement.suppliers(id),
  purchase_order_id TEXT,
  reference_number  TEXT NOT NULL,
  kind              procurement."SupplierSubmissionKind" NOT NULL,
  status            procurement."SupplierSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  title             TEXT NOT NULL,
  description       TEXT,
  amount            DECIMAL(14, 2),
  currency          TEXT NOT NULL DEFAULT 'TZS',
  payment_status    procurement."SupplierPaymentStatus" NOT NULL DEFAULT 'NONE',
  rejected_reason   TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, reference_number)
);

CREATE INDEX IF NOT EXISTS supplier_submissions_org_supplier_status_idx
  ON procurement.supplier_submissions (organization_id, supplier_id, status);
CREATE INDEX IF NOT EXISTS supplier_submissions_org_kind_status_idx
  ON procurement.supplier_submissions (organization_id, kind, status);

GRANT USAGE ON SCHEMA procurement TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA procurement TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA procurement
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE procurement.supplier_submissions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON procurement.supplier_submissions;
  CREATE POLICY org_isolation ON procurement.supplier_submissions
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
