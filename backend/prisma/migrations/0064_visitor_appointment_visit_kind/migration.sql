-- Portal 35.10: visit audience kind on appointments (not an IAM role).
CREATE SCHEMA IF NOT EXISTS visitors;

ALTER TABLE visitors.visitor_appointments
  ADD COLUMN IF NOT EXISTS visit_kind VARCHAR(40) NOT NULL DEFAULT 'VISITOR';
