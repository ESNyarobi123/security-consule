-- Sprint 0: Row-Level Security across tenant business schemas (defense-in-depth).
--
-- Model:
--  * A dedicated NON-OWNER app role `pssms_app` is used by core-api at runtime.
--  * RLS is ENABLED (not FORCED) on tenant tables, so it applies to `pssms_app`
--    but the table OWNER (`pssms`, used by migrations / seed / workers /
--    reporting-service) is naturally exempt — those trusted paths keep working.
--  * Policies filter by the transaction-local GUC `app.organization_id`
--    (set per request), with an `app.rls_bypass` escape hatch for trusted
--    service-token / internal writes.
--  * `current_setting(..., true)` => missing GUC returns NULL => zero rows
--    (fail-closed), never an error.

-- 1) Application role (non-owner). Dev password; override in production.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pssms_app') THEN
    CREATE ROLE pssms_app LOGIN PASSWORD 'pssms_app_password';
  END IF;
END $$;

-- 2) Grant runtime privileges across every schema core-api uses.
DO $$
DECLARE
  s text;
  schemas text[] := ARRAY[
    'iam','enterprise','customers','contracts','approvals','audit','workforce',
    'operations','attendance','incidents','occurrence','access','visitors',
    'parking','recruitment','payroll','employee_loans','finance','procurement',
    'inventory','assets','integrations','notifications','reporting','public'
  ];
BEGIN
  FOREACH s IN ARRAY schemas LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO pssms_app', s);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO pssms_app', s);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO pssms_app', s);
    -- Future tables/sequences created by the owner role.
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pssms_app', s);
  END LOOP;
END $$;

-- 3) Enable RLS + org-isolation policy on every tenant table that has an
--    organization_id column, across the tenant business schemas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_schema AS sch, c.table_name AS tbl
    FROM information_schema.columns c
    WHERE c.column_name = 'organization_id'
      AND c.table_schema IN (
        'customers','contracts','approvals','workforce','operations','attendance',
        'incidents','occurrence','access','visitors','parking','recruitment',
        'payroll','employee_loans','finance','procurement','inventory','assets',
        'notifications'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.sch, r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON %I.%I', r.sch, r.tbl);
    EXECUTE format(
      'CREATE POLICY org_isolation ON %I.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      r.sch, r.tbl
    );
  END LOOP;
END $$;
