-- Module 17-A: Loan types, item-loan fields, issue flow (approve ≠ issue), settlement.

DO $$ BEGIN
  CREATE TYPE employee_loans."LoanType" AS ENUM (
    'SECURITY_BOOTS',
    'SMARTPHONE',
    'CASH',
    'UNIFORM',
    'EMERGENCY',
    'SALARY_ADVANCE',
    'EQUIPMENT',
    'TRANSPORT_SUPPORT',
    'MEDICAL_SUPPORT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS loan_type employee_loans."LoanType" NOT NULL DEFAULT 'OTHER';

ALTER TABLE employee_loans.employee_loans
  ALTER COLUMN purpose DROP NOT NULL;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS item_name VARCHAR(200);

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(200);

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS item_cost DECIMAL(14, 2);

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS issued_by UUID;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS employee_acknowledged_at TIMESTAMPTZ;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE employee_loans.employee_loans
  ADD COLUMN IF NOT EXISTS cleared_by UUID;
