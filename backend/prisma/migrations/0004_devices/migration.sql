-- Phase 8: device-integration schema privileges + RLS.
--
-- The registry tables (edge_gateways, devices) are intentionally NOT under RLS:
-- device/gateway authentication looks them up by api_key_hash BEFORE any org
-- context exists (pre-auth), so they must be readable without the org GUC.
-- The high-volume tenant data (device_events, device_commands) IS org-isolated.

CREATE SCHEMA IF NOT EXISTS devices;

-- Runtime privileges for the non-owner app role used by core-api.
GRANT USAGE ON SCHEMA devices TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA devices TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA devices TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA devices
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA devices
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO pssms_app;

-- Org-isolation RLS on event/command tables (fail-closed + rls_bypass escape hatch).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['device_events', 'device_commands'] LOOP
    EXECUTE format('ALTER TABLE devices.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON devices.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON devices.%I '
      || 'USING (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'') '
      || 'WITH CHECK (organization_id = current_setting(''app.organization_id'', true) '
      || 'OR current_setting(''app.rls_bypass'', true) = ''on'')',
      t
    );
  END LOOP;
END $$;
