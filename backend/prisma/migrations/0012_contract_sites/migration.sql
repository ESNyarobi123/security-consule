-- Contract ↔ Sites binding (B2): sites covered by a commercial agreement.
-- site_id references enterprise.sites.id logically (no cross-schema FK).

CREATE TABLE IF NOT EXISTS contracts.contract_sites (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  contract_id      TEXT NOT NULL REFERENCES contracts.contracts(id) ON DELETE CASCADE,
  site_id          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_sites_contract_id_site_id_key
  ON contracts.contract_sites (contract_id, site_id);

CREATE INDEX IF NOT EXISTS contract_sites_organization_id_site_id_idx
  ON contracts.contract_sites (organization_id, site_id);

GRANT USAGE ON SCHEMA contracts TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA contracts TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA contracts TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA contracts
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
BEGIN
  ALTER TABLE contracts.contract_sites ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS org_isolation ON contracts.contract_sites;
  CREATE POLICY org_isolation ON contracts.contract_sites
    USING (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    )
    WITH CHECK (
      organization_id = current_setting('app.organization_id', true)
      OR current_setting('app.rls_bypass', true) = 'on'
    );
END $$;
