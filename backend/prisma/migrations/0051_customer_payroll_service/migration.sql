-- Module 19-A: Customer employee payroll service — salary assignments, customer payslips, payment refs.

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS bank_account_ref VARCHAR(64);

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120);

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS mobile_money_ref VARCHAR(32);

ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS mobile_money_provider VARCHAR(32);

ALTER TABLE payroll.payslip_snapshots
  ALTER COLUMN employee_id DROP NOT NULL;

ALTER TABLE payroll.payslip_snapshots
  ADD COLUMN IF NOT EXISTS customer_employee_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS payslip_snapshots_cycle_customer_employee_key
  ON payroll.payslip_snapshots (cycle_id, customer_employee_id)
  WHERE customer_employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payroll.customer_salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  customer_employee_id UUID NOT NULL,
  basic_salary DECIMAL(14, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'TZS',
  hourly_rate DECIMAL(14, 2),
  allowances JSONB,
  deductions JSONB,
  effective_from DATE NOT NULL,
  effective_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS customer_salary_assignments_org_customer_idx
  ON payroll.customer_salary_assignments (organization_id, customer_id);

CREATE INDEX IF NOT EXISTS customer_salary_assignments_employee_active_idx
  ON payroll.customer_salary_assignments (customer_employee_id, is_active);

CREATE INDEX IF NOT EXISTS payroll_cycles_customer_id_idx
  ON payroll.payroll_cycles (customer_id)
  WHERE customer_id IS NOT NULL;
