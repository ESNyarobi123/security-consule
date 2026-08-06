-- M5-F: suspend justification on IAM change requests
ALTER TABLE iam.iam_change_requests
  ADD COLUMN IF NOT EXISTS reason TEXT;
