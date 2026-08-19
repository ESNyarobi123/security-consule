-- Portal 35.19 — marketing / BD pipeline (campaigns, leads, surveys, quotes, commissions).
CREATE SCHEMA IF NOT EXISTS customers;

DO $$ BEGIN
  CREATE TYPE customers."MarketingCampaignChannel" AS ENUM (
    'EMAIL', 'SMS', 'WHATSAPP', 'EVENT', 'BRANCH', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingLeadSource" AS ENUM (
    'CAMPAIGN', 'REFERRAL', 'WALK_IN', 'BRANCH', 'TENDER', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingLeadStage" AS ENUM (
    'LEAD', 'QUALIFIED', 'SURVEY_SCHEDULED', 'SURVEY_DONE',
    'QUOTED', 'PROPOSAL', 'WON', 'LOST'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingReferrerType" AS ENUM (
    'STAFF', 'CUSTOMER', 'PARTNER', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingSurveyStatus" AS ENUM (
    'SCHEDULED', 'COMPLETED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingQuoteKind" AS ENUM (
    'QUOTATION', 'PROPOSAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingQuoteStatus" AS ENUM (
    'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE customers."MarketingCommissionStatus" AS ENUM (
    'PENDING', 'ACCRUED', 'PAID', 'VOID'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS customers.marketing_campaigns (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  channel          customers."MarketingCampaignChannel" NOT NULL DEFAULT 'OTHER',
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS customers.marketing_leads (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  code             TEXT NOT NULL,
  company_name     TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  contact_email    TEXT,
  contact_phone    TEXT,
  source           customers."MarketingLeadSource" NOT NULL DEFAULT 'OTHER',
  stage            customers."MarketingLeadStage" NOT NULL DEFAULT 'LEAD',
  campaign_id      TEXT REFERENCES customers.marketing_campaigns(id),
  referrer_name    TEXT,
  referrer_type    customers."MarketingReferrerType",
  owner_user_id    TEXT,
  estimated_value  DECIMAL(18, 2),
  currency         TEXT NOT NULL DEFAULT 'TZS',
  notes            TEXT,
  lost_reason      TEXT,
  customer_id      TEXT REFERENCES customers.customers(id),
  customer_code    TEXT,
  contract_id      TEXT,
  contract_number  TEXT,
  won_at           TIMESTAMPTZ,
  lost_at          TIMESTAMPTZ,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS customers.marketing_site_surveys (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  lead_id          TEXT NOT NULL REFERENCES customers.marketing_leads(id),
  site_address     TEXT NOT NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  completed_at     TIMESTAMPTZ,
  status           customers."MarketingSurveyStatus" NOT NULL DEFAULT 'SCHEDULED',
  outcome          TEXT,
  officer_name     TEXT,
  notes            TEXT,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers.marketing_quotes (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  lead_id          TEXT NOT NULL REFERENCES customers.marketing_leads(id),
  quote_number     TEXT NOT NULL,
  kind             customers."MarketingQuoteKind" NOT NULL,
  status           customers."MarketingQuoteStatus" NOT NULL DEFAULT 'DRAFT',
  amount           DECIMAL(18, 2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'TZS',
  valid_until      DATE,
  service_types    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes            TEXT,
  sent_at          TIMESTAMPTZ,
  decided_at       TIMESTAMPTZ,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, quote_number)
);

CREATE TABLE IF NOT EXISTS customers.marketing_commissions (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL,
  lead_id          TEXT NOT NULL REFERENCES customers.marketing_leads(id),
  beneficiary      TEXT NOT NULL,
  referrer_type    customers."MarketingReferrerType",
  amount           DECIMAL(18, 2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'TZS',
  status           customers."MarketingCommissionStatus" NOT NULL DEFAULT 'PENDING',
  notes            TEXT,
  created_by       TEXT NOT NULL,
  accrued_by       TEXT,
  accrued_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_org_active_idx
  ON customers.marketing_campaigns (organization_id, is_active);
CREATE INDEX IF NOT EXISTS marketing_leads_org_stage_idx
  ON customers.marketing_leads (organization_id, stage);
CREATE INDEX IF NOT EXISTS marketing_leads_org_source_idx
  ON customers.marketing_leads (organization_id, source);
CREATE INDEX IF NOT EXISTS marketing_surveys_org_lead_idx
  ON customers.marketing_site_surveys (organization_id, lead_id);
CREATE INDEX IF NOT EXISTS marketing_quotes_org_lead_idx
  ON customers.marketing_quotes (organization_id, lead_id);
CREATE INDEX IF NOT EXISTS marketing_commissions_org_status_idx
  ON customers.marketing_commissions (organization_id, status);
CREATE INDEX IF NOT EXISTS marketing_commissions_org_lead_idx
  ON customers.marketing_commissions (organization_id, lead_id);

GRANT USAGE ON SCHEMA customers TO pssms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA customers TO pssms_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA customers TO pssms_app;
ALTER DEFAULT PRIVILEGES FOR ROLE pssms IN SCHEMA customers
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pssms_app;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'marketing_campaigns',
    'marketing_leads',
    'marketing_site_surveys',
    'marketing_quotes',
    'marketing_commissions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE customers.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON customers.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON customers.%I
        USING (
          organization_id = current_setting(''app.organization_id'', true)
          OR current_setting(''app.rls_bypass'', true) = ''on''
        )
        WITH CHECK (
          organization_id = current_setting(''app.organization_id'', true)
          OR current_setting(''app.rls_bypass'', true) = ''on''
        )',
      t
    );
  END LOOP;
END $$;
