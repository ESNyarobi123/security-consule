-- Module 10-B: supervisor remarks on alertness checks (miss / ops note).
ALTER TABLE attendance.alertness_checks
  ADD COLUMN IF NOT EXISTS supervisor_remarks TEXT;
