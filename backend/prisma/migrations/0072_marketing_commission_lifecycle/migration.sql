-- Portal 35.19 — complete the referral commission lifecycle PENDING → ACCRUED → PAID / VOID.
ALTER TABLE customers.marketing_commissions
  ADD COLUMN IF NOT EXISTS paid_by TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS voided_by TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS void_reason TEXT;
