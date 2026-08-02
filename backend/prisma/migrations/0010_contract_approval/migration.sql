-- Contract approval instance link (thin contract-approval workflow).
ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS approval_instance_id TEXT;
