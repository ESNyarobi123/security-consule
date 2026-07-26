-- Slice E: documents schema — DocumentObject metadata + org RLS.
-- Idempotent: safe after prisma db push which may already create schema/tables.

CREATE SCHEMA IF NOT EXISTS documents;

CREATE TABLE IF NOT EXISTS documents.document_objects (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  bucket          TEXT NOT NULL,
  object_key      TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  uploaded_by     TEXT NOT NULL,
  checksum        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_objects_bucket_object_key_key
  ON documents.document_objects (bucket, object_key);
CREATE INDEX IF NOT EXISTS document_objects_organization_id_resource_type_resource_id_idx
  ON documents.document_objects (organization_id, resource_type, resource_id);

-- Runtime privileges for the non-owner app role used by core-api.
GRANT USAGE ON SCHEMA documents TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA documents TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA documents TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA documents
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA documents
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pssms_app;

-- Org-isolation RLS (fail-closed + rls_bypass escape hatch) — mirror compliance.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['document_objects'] LOOP
    EXECUTE format('ALTER TABLE documents.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON documents.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON documents.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;
