-- A4a: thin patrol route SLA due window (minutes from local midnight)
ALTER TABLE operations.patrol_routes
  ADD COLUMN IF NOT EXISTS due_minutes_from_midnight INTEGER NOT NULL DEFAULT 1380;
