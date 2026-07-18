-- Phase 7c: Row-level security on reporting schema (defense-in-depth)
-- Requires PrismaService.withOrgContext() to set app.organization_id per request.

ALTER TABLE reporting.kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.kpi_snapshots FORCE ROW LEVEL SECURITY;

ALTER TABLE reporting.analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.analytics_insights FORCE ROW LEVEL SECURITY;

ALTER TABLE reporting.dashboard_caches ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.dashboard_caches FORCE ROW LEVEL SECURITY;

ALTER TABLE reporting.kpi_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.kpi_definitions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_snapshots_org ON reporting.kpi_snapshots;
CREATE POLICY kpi_snapshots_org ON reporting.kpi_snapshots
  USING (organization_id = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS analytics_insights_org ON reporting.analytics_insights;
CREATE POLICY analytics_insights_org ON reporting.analytics_insights
  USING (organization_id = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS dashboard_caches_org ON reporting.dashboard_caches;
CREATE POLICY dashboard_caches_org ON reporting.dashboard_caches
  USING (organization_id = current_setting('app.organization_id', true));

DROP POLICY IF EXISTS kpi_definitions_org ON reporting.kpi_definitions;
CREATE POLICY kpi_definitions_org ON reporting.kpi_definitions
  USING (
    organization_id IS NULL
    OR organization_id = current_setting('app.organization_id', true)
  );
