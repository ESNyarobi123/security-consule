-- Module 25-A: purchase requests + supplier quote comparison + PO link.
-- Inventory alerts use existing stock_items.reorder_level (no new inventory tables).

DO $$ BEGIN
  CREATE TYPE procurement."PurchaseRequestStatus" AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE procurement."PurchaseRequestQuoteStatus" AS ENUM (
    'SUBMITTED', 'AWARDED', 'NOT_SELECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS procurement.purchase_requests (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  request_number       TEXT NOT NULL,
  department           TEXT NOT NULL,
  purpose              TEXT NOT NULL,
  status               procurement."PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
  currency             TEXT NOT NULL DEFAULT 'TZS',
  approval_instance_id TEXT,
  awarded_quote_id     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           TEXT NOT NULL,
  UNIQUE (organization_id, request_number)
);

CREATE INDEX IF NOT EXISTS purchase_requests_org_status_idx
  ON procurement.purchase_requests (organization_id, status);

CREATE TABLE IF NOT EXISTS procurement.purchase_request_lines (
  id                   TEXT PRIMARY KEY,
  purchase_request_id  TEXT NOT NULL REFERENCES procurement.purchase_requests(id) ON DELETE CASCADE,
  stock_item_id        TEXT,
  description          TEXT NOT NULL,
  quantity             DECIMAL(10, 2) NOT NULL,
  unit                 TEXT NOT NULL DEFAULT 'EA'
);

CREATE TABLE IF NOT EXISTS procurement.purchase_request_quotes (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL,
  purchase_request_id  TEXT NOT NULL REFERENCES procurement.purchase_requests(id) ON DELETE CASCADE,
  supplier_id          TEXT NOT NULL,
  status               procurement."PurchaseRequestQuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
  total_amount         DECIMAL(14, 2) NOT NULL,
  currency             TEXT NOT NULL DEFAULT 'TZS',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS purchase_request_quotes_org_pr_status_idx
  ON procurement.purchase_request_quotes (organization_id, purchase_request_id, status);

CREATE TABLE IF NOT EXISTS procurement.purchase_request_quote_lines (
  id                        TEXT PRIMARY KEY,
  quote_id                  TEXT NOT NULL REFERENCES procurement.purchase_request_quotes(id) ON DELETE CASCADE,
  purchase_request_line_id  TEXT NOT NULL REFERENCES procurement.purchase_request_lines(id) ON DELETE CASCADE,
  unit_price                DECIMAL(14, 2) NOT NULL,
  amount                    DECIMAL(14, 2) NOT NULL,
  UNIQUE (quote_id, purchase_request_line_id)
);

ALTER TABLE procurement.purchase_orders
  ADD COLUMN IF NOT EXISTS purchase_request_id TEXT;

CREATE INDEX IF NOT EXISTS purchase_orders_pr_idx
  ON procurement.purchase_orders (purchase_request_id)
  WHERE purchase_request_id IS NOT NULL;

GRANT USAGE ON SCHEMA procurement TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA procurement TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA procurement
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_requests',
    'purchase_request_quotes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE procurement.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON procurement.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON procurement.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      t
    );
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
