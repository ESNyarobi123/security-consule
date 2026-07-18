import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';

/**
 * Request-scoped tenant context carried across async boundaries.
 *
 * - `organizationId` — active tenant; RLS policies filter rows to this org.
 * - `bypass` — trusted system/service path (cross-org internal writes) that
 *   should not be constrained by the org filter.
 * - `tx` — the interactive transaction opened for this request; every Prisma
 *   call in the request runs on it so the `SET LOCAL` GUC applies.
 */
export interface OrgContext {
  organizationId?: string;
  bypass?: boolean;
  tx?: Prisma.TransactionClient;
}

export const orgStorage = new AsyncLocalStorage<OrgContext>();

export function getOrgContext(): OrgContext | undefined {
  return orgStorage.getStore();
}

export function runWithOrgContext<T>(ctx: OrgContext, fn: () => T): T {
  return orgStorage.run(ctx, fn);
}
