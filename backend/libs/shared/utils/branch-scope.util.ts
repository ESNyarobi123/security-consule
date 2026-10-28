import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { resolveSiteIdFilter } from './site-scope.util';

/**
 * §4 / §35.23 — resolve the branches a caller may read.
 *
 * `null`  = the caller is org-wide (every branch), e.g. HR_OFFICER / GM.
 * `[]`    = fail-closed: they hold no branch or site grant, so they see nothing.
 * `[...]` = their branch allowlist (JWT `allowedBranchIds`, or the branches that
 *           own their granted sites — the Harden A7 expansion).
 *
 * Branch-level HR readers use this instead of `hr.manage` so a Branch Manager
 * sees their own staff register, not the whole company directory.
 */
export async function resolveBranchScopeIds(
  user: AuthUser,
  prisma: PrismaService,
): Promise<string[] | null> {
  const siteFilter = resolveSiteIdFilter(user);
  if (siteFilter === null) return null;
  if (user.allowedBranchIds.length) {
    return [...new Set(user.allowedBranchIds)];
  }
  if (!siteFilter.length) return [];
  const sites = await prisma.site.findMany({
    where: { organizationId: user.organizationId, id: { in: siteFilter } },
    select: { branchId: true },
  });
  return [...new Set(sites.map((s) => s.branchId))];
}

/** Throws `BRANCH_SCOPE_DENIED` when the branch is outside the caller's scope. */
export async function assertBranchInScope(
  user: AuthUser,
  prisma: PrismaService,
  branchId: string,
): Promise<void> {
  const scoped = await resolveBranchScopeIds(user, prisma);
  if (scoped === null) return;
  if (!scoped.includes(branchId)) {
    throw new ForbiddenException({
      error: 'BRANCH_SCOPE_DENIED',
      message: 'Branch is outside your assigned scope',
    });
  }
}
