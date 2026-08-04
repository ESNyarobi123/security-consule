import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';

/**
 * §4 / Phase 7 viewing hierarchy — company-wide viewers ignore site ACL rows.
 * Empty allowedSiteIds on these roles = org-wide (not "no sites").
 */
export const ORG_WIDE_SITE_VIEW_ROLES = new Set([
  'SUPER_ADMIN',
  'GENERAL_MANAGER',
  'CEO',
  'CMD',
  'OPERATIONS_MANAGER',
  'DEPARTMENT_HEAD',
  'CISO',
  'CONTROL_ROOM',
  'HR_OFFICER',
  'ACCOUNTS_OFFICER',
  'PAYROLL_OFFICER',
  'LEGAL',
  'MARKETING',
  'COMPLIANCE_OFFICER',
  'DPO',
  'INTERNAL_AUDITOR',
  'DEVELOPER',
  'IT_SUPPORT',
  'CALL_CENTRE',
  'CCTV_OPERATOR',
]);

/**
 * Field hierarchy roles that must be assigned sites/branches in seed/admin.
 * (Enforcement is default-deny for anyone not in ORG_WIDE_SITE_VIEW_ROLES.)
 */
export const SITE_SCOPED_ROLES = new Set([
  'SUPERVISOR',
  'FIELD_OFFICER',
  'BRANCH_MANAGER',
  'GUARD',
]);

/**
 * @returns `null` = unrestricted org-wide; otherwise allowlist (may be empty = fail-closed).
 * Default-deny: only explicit org-wide roles bypass ACL.
 */
export function resolveSiteIdFilter(user: AuthUser): string[] | null {
  if (user.roles.some((r) => ORG_WIDE_SITE_VIEW_ROLES.has(r))) {
    return null;
  }
  return [...user.allowedSiteIds];
}

export function assertSiteAccess(user: AuthUser, siteId: string): void {
  const filter = resolveSiteIdFilter(user);
  if (filter === null) return;
  if (!filter.includes(siteId)) {
    throw new ForbiddenException({
      error: 'SITE_SCOPE_DENIED',
      message: 'Site is outside your assigned scope',
    });
  }
}

/**
 * Branch create/list gate — uses JWT allowedBranchIds (seed/admin assigned).
 * Site list ACL expands branch→sites at auth profile build (Harden A7).
 */
export function assertBranchAccess(user: AuthUser, branchId: string): void {
  if (user.roles.some((r) => ORG_WIDE_SITE_VIEW_ROLES.has(r))) return;
  if (!user.allowedBranchIds.includes(branchId)) {
    throw new ForbiddenException({
      error: 'BRANCH_SCOPE_DENIED',
      message: 'Branch is outside your assigned scope',
    });
  }
}

export type SiteScopeClause =
  | { unrestricted: true; siteId?: string }
  | { unrestricted: false; siteIds: string[]; siteId?: string };

/**
 * Build list filter for site-scoped queries.
 * Throws if a requested siteId is outside the allowlist.
 */
export function resolveSiteScopeClause(
  user: AuthUser,
  requestedSiteId?: string,
): SiteScopeClause {
  const filter = resolveSiteIdFilter(user);
  if (filter === null) {
    return { unrestricted: true, siteId: requestedSiteId };
  }
  if (requestedSiteId) {
    assertSiteAccess(user, requestedSiteId);
    return {
      unrestricted: false,
      siteIds: filter,
      siteId: requestedSiteId,
    };
  }
  return { unrestricted: false, siteIds: filter };
}

/** Prisma `where` fragment for models with `siteId`. */
export function siteScopeWhere(
  user: AuthUser,
  requestedSiteId?: string,
): { siteId?: string } | { siteId: { in: string[] } } {
  const clause = resolveSiteScopeClause(user, requestedSiteId);
  if (clause.unrestricted) {
    return clause.siteId ? { siteId: clause.siteId } : {};
  }
  if (clause.siteId) {
    return { siteId: clause.siteId };
  }
  return { siteId: { in: clause.siteIds } };
}
