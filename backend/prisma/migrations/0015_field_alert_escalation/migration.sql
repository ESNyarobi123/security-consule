-- AL1: FieldAlert miss escalation ladder (SUPERVISOR → FIELD → BOM → CONTROL)
ALTER TABLE attendance.field_alerts
  ADD COLUMN IF NOT EXISTS escalation_stage TEXT NOT NULL DEFAULT 'SUPERVISOR',
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS escalated_by TEXT NULL;
