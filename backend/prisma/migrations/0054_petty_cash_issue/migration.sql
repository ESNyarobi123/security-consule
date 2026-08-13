-- Module 22-A: petty cash issue after approval (design: no issue without approval).
-- Branch + department on the request; ISSUED enum (used in 0055 backfill).

DO $$ BEGIN
  ALTER TYPE finance."PettyCashVoucherStatus" ADD VALUE 'ISSUED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE finance.petty_cash_vouchers
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS department VARCHAR(120),
  ADD COLUMN IF NOT EXISTS issued_by UUID,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

CREATE INDEX IF NOT EXISTS petty_cash_vouchers_org_status_idx
  ON finance.petty_cash_vouchers (organization_id, status);

CREATE INDEX IF NOT EXISTS petty_cash_vouchers_branch_idx
  ON finance.petty_cash_vouchers (organization_id, branch_id)
  WHERE branch_id IS NOT NULL;
