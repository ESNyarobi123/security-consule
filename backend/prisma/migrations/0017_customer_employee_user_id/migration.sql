-- E1 Portal 35.9: link CustomerEmployee to IAM user for self-scoped access.
ALTER TABLE access.customer_employees
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS customer_employees_user_id_key
  ON access.customer_employees (user_id)
  WHERE user_id IS NOT NULL;
