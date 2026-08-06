-- E4: approved contractor/guest binding on visitors.visitor_appointments
ALTER TABLE visitors.visitor_appointments
  ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS visitor_appointments_organization_id_user_id_idx
  ON visitors.visitor_appointments (organization_id, user_id);
