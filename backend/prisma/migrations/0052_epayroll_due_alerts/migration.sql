-- Module 20-A: E-payroll due alerts + billing invoice link on customer payroll cycles.

ALTER TABLE payroll.payroll_cycles
  ADD COLUMN IF NOT EXISTS billing_invoice_id UUID;

CREATE INDEX IF NOT EXISTS payroll_cycles_billing_invoice_idx
  ON payroll.payroll_cycles (billing_invoice_id)
  WHERE billing_invoice_id IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE payroll."PayrollDueAlertStatus" AS ENUM ('DUE', 'PROCESSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payroll.payroll_due_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  payroll_cycle_id UUID NOT NULL,
  invoice_id UUID,
  invoice_number VARCHAR(64),
  payroll_month VARCHAR(7) NOT NULL,
  invoice_amount_paid DECIMAL(14, 2) NOT NULL,
  employees_covered INT NOT NULL,
  payroll_portion_due DECIMAL(14, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  due_date DATE NOT NULL,
  invoice_payment_status VARCHAR(32) NOT NULL,
  payroll_approval_status VARCHAR(32) NOT NULL,
  payroll_payment_status VARCHAR(32) NOT NULL,
  responsible_officer_id UUID,
  responsible_officer_name VARCHAR(120),
  status payroll."PayrollDueAlertStatus" NOT NULL DEFAULT 'DUE',
  notified_at TIMESTAMPTZ,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS payroll_due_alerts_org_due_idx
  ON payroll.payroll_due_alerts (organization_id, due_date);

CREATE INDEX IF NOT EXISTS payroll_due_alerts_customer_month_idx
  ON payroll.payroll_due_alerts (customer_id, payroll_month);

DO $$ BEGIN
  ALTER TYPE finance."InvoiceStatus" ADD VALUE 'DISPUTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
