import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * §4 Harden A6 — executive / IAM ceiling roles.
 * CISO / IT_SUPPORT (users.manage) must not assign or manage these.
 */
export const PRIVILEGED_ASSIGNMENT_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'CISO',
]);

/** Actors who may assign any org role (company / platform admins). */
export const ROLE_ASSIGNMENT_BYPASS_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
]);

/**
 * Permissions that non-bypass actors must not grant on custom roles
 * (blocks minting a shadow admin via POST /roles).
 */
export const PRIVILEGED_GRANT_PERMISSIONS = new Set(['users.manage']);

export function actorBypassesRoleAssignmentCeiling(actor: AuthUser): boolean {
  return actor.roles.some((r) => ROLE_ASSIGNMENT_BYPASS_ROLES.has(r));
}

export function assertActorMayAssignRoles(
  actor: AuthUser,
  requestedRoleCodes: string[],
  options?: {
    targetUserId?: string;
    targetCurrentRoleCodes?: string[];
  },
): void {
  if (actorBypassesRoleAssignmentCeiling(actor)) return;

  const requested = [...new Set(requestedRoleCodes)];
  const privilegedRequested = requested.filter((c) =>
    PRIVILEGED_ASSIGNMENT_ROLES.has(c),
  );
  if (privilegedRequested.length > 0) {
    throw new ForbiddenException({
      error: 'ROLE_ASSIGNMENT_DENIED',
      message: `Cannot assign privileged role(s): ${privilegedRequested.join(', ')}`,
    });
  }

  const current = options?.targetCurrentRoleCodes ?? [];
  const privilegedCurrent = current.filter((c) =>
    PRIVILEGED_ASSIGNMENT_ROLES.has(c),
  );
  if (privilegedCurrent.length > 0) {
    throw new ForbiddenException({
      error: 'ROLE_ASSIGNMENT_DENIED',
      message: 'Cannot modify roles on a privileged account',
    });
  }

  // Self-elevation already covered when requested includes privileged codes.
  void options?.targetUserId;
}

/** Block CISO/IT from suspending / reactivating executive accounts. */
export function assertActorMayManagePrivilegedUser(
  actor: AuthUser,
  targetRoleCodes: string[],
  action = 'manage',
): void {
  if (actorBypassesRoleAssignmentCeiling(actor)) return;
  const privileged = targetRoleCodes.filter((c) =>
    PRIVILEGED_ASSIGNMENT_ROLES.has(c),
  );
  if (privileged.length > 0) {
    throw new ForbiddenException({
      error: 'ROLE_ASSIGNMENT_DENIED',
      message: `Cannot ${action} a privileged account (${privileged.join(', ')})`,
    });
  }
}

/** Block minting users.manage (or other privileged perms) on custom roles. */
export function assertActorMayGrantPermissions(
  actor: AuthUser,
  permissionCodes: string[],
): void {
  if (actorBypassesRoleAssignmentCeiling(actor)) return;
  const denied = [...new Set(permissionCodes)].filter((c) =>
    PRIVILEGED_GRANT_PERMISSIONS.has(c),
  );
  if (denied.length > 0) {
    throw new ForbiddenException({
      error: 'ROLE_ASSIGNMENT_DENIED',
      message: `Cannot grant privileged permission(s): ${denied.join(', ')}`,
    });
  }
}
