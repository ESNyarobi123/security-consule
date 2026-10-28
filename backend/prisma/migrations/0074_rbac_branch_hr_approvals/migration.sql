-- Portal 35.3 / 35.4 — Branch Manager HR register + branch approvals.
--
-- Code alone is not enough on an environment that is not re-seeded: the
-- BRANCH_MANAGER role must actually hold `hr.branch` (own-branch staff register
-- and staff files) and `approvals.act` (act on branch-level approval steps).
-- Idempotent so re-running is safe on every deploy.

INSERT INTO iam.permissions (id, code, name, module)
VALUES (
  gen_random_uuid(),
  'hr.branch',
  'Branch staff register + staff files (own branch only)',
  'workforce'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO iam.permissions (id, code, name, module)
VALUES (
  gen_random_uuid(),
  'approvals.act',
  'Act on approval instances',
  'approvals'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO iam.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM iam.roles r
JOIN iam.permissions p ON p.code IN ('hr.branch', 'approvals.act')
WHERE r.code = 'BRANCH_MANAGER'
ON CONFLICT DO NOTHING;
