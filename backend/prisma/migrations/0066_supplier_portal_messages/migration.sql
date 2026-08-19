-- Portal 35.17: supplier ↔ procurement messages (own supplier only).
CREATE SCHEMA IF NOT EXISTS procurement;

DO $$ BEGIN
  CREATE TYPE procurement."SupplierMessageAuthor" AS ENUM ('SUPPLIER', 'PROCUREMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS procurement.supplier_messages (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  supplier_id      TEXT NOT NULL REFERENCES procurement.suppliers(id),
  author_type      procurement."SupplierMessageAuthor" NOT NULL,
  body             TEXT NOT NULL,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_messages_org_supplier_created_idx
  ON procurement.supplier_messages (organization_id, supplier_id, created_at);

GRANT USAGE ON SCHEMA procurement TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA procurement TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA procurement TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA procurement
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE procurement.supplier_messages ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON procurement.supplier_messages;
  CREATE POLICY org_isolation ON procurement.supplier_messages
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
