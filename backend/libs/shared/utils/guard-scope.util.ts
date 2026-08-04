import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * Staff roles that override GUARD self-scope when also present on the JWT
 * (e.g. supervisor who is also a registered guard).
 */
export const GUARD_STAFF_OVERRIDE_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'HR_OFFICER',
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTROL_ROOM',
  'DEVELOPER',
  'LEGAL',
  'MARKETING',
  'DEPARTMENT_HEAD',
]);

/**
 * §4 viewing hierarchy — Guard: own records only.
 * True when JWT is GUARD without a staff override role.
 */
export function isGuardSelfScoped(user: AuthUser): boolean {
  if (!user.roles.includes('GUARD')) return false;
  return !user.roles.some((r) => GUARD_STAFF_OVERRIDE_ROLES.has(r));
}

export function assertNotGuardSelfScoped(
  user: AuthUser,
  action = 'this action',
): void {
  if (isGuardSelfScoped(user)) {
    throw new ForbiddenException({
      error: 'GUARD_SCOPE_DENIED',
      message: `Guards cannot perform ${action}`,
    });
  }
}
