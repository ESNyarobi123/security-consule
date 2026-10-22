-- Portal 35.23 / Module 27-A — branch staff management.
-- Employees get a branch posting so Branch Managers / Field Officers / Regional,
-- Technical and Business Development Managers can manage only their own branch staff.

ALTER TABLE workforce.employees
  ADD COLUMN IF NOT EXISTS branch_id TEXT;

DO $$ BEGIN
  ALTER TABLE workforce.employees
    ADD CONSTRAINT employees_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES enterprise.branches(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS employees_org_branch_idx
  ON workforce.employees (organization_id, branch_id);

-- Backfill: guard employees inheriting the branch of their latest ACTIVE deployment.
UPDATE workforce.employees e
SET branch_id = d.branch_id
FROM (
  SELECT DISTINCT ON (gd.guard_id)
         gd.guard_id,
         s.branch_id
  FROM operations.guard_deployments gd
  JOIN enterprise.sites s ON s.id = gd.site_id
  WHERE gd.status = 'ACTIVE'
  ORDER BY gd.guard_id, gd.start_date DESC
) d
WHERE e.guard_profile_id = d.guard_id
  AND e.branch_id IS NULL;

-- Fallback: any remaining employee lands in the first branch of its organization.
UPDATE workforce.employees e
SET branch_id = b.id
FROM (
  SELECT DISTINCT ON (organization_id) id, organization_id
  FROM enterprise.branches
  ORDER BY organization_id, code ASC
) b
WHERE e.organization_id = b.organization_id
  AND e.branch_id IS NULL;
