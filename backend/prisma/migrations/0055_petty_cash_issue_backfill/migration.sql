-- Existing APPROVED vouchers already debited the imprest on approve.
-- Promote them to ISSUED so a later Issue click cannot debit twice.

UPDATE finance.petty_cash_vouchers
SET
  status = 'ISSUED',
  issued_at = COALESCE(issued_at, created_at),
  issued_by = COALESCE(issued_by, approved_by)
WHERE status = 'APPROVED';
