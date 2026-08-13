-- Module 18-A: Employee payment refs for bank/mobile files; unpaid leave flag.

ALTER TABLE workforce.employees
  ADD COLUMN IF NOT EXISTS bank_account_ref VARCHAR(64);

ALTER TABLE workforce.employees
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(120);

ALTER TABLE workforce.employees
  ADD COLUMN IF NOT EXISTS mobile_money_ref VARCHAR(32);

ALTER TABLE workforce.employees
  ADD COLUMN IF NOT EXISTS mobile_money_provider VARCHAR(32);

ALTER TABLE workforce.leave_types
  ADD COLUMN IF NOT EXISTS is_paid_leave BOOLEAN NOT NULL DEFAULT true;
