import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { orgStorage, getOrgContext } from '../context/org-context';

/**
 * Prisma service with transparent PostgreSQL Row-Level Security (RLS) support.
 *
 * Strategy (community-standard for Prisma + Nest + RLS):
 *  - Each authenticated request runs inside ONE interactive transaction whose
 *    first statement is `set_config('app.organization_id', <org>, true)`
 *    (transaction-local — no leakage across pooled connections).
 *  - `orgStorage` (AsyncLocalStorage) carries that transaction; the exported
 *    proxy routes every model call + nested `$transaction` onto it so RLS
 *    policies see the org GUC. Nested `$transaction` calls JOIN the request
 *    transaction instead of opening a new (illegal) nested one.
 *  - Requests without a context (public routes, owner-role services) run
 *    directly on the base client.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Open the per-request transaction, apply the RLS GUC(s), and run `work`
   * inside the org context so downstream Prisma calls are transaction-bound.
   */
  async runInRequestContext<T>(
    opts: { organizationId?: string; bypass?: boolean },
    work: () => Promise<T>,
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        if (opts.bypass) {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.rls_bypass', 'on', true)`,
          );
        }
        if (opts.organizationId) {
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.organization_id', $1, true)`,
            opts.organizationId,
          );
        }
        return orgStorage.run(
          { organizationId: opts.organizationId, bypass: opts.bypass, tx },
          work,
        );
      },
      { timeout: 30_000, maxWait: 5_000 },
    );
  }

  /**
   * Explicit org-scoped transaction (used by reporting-service / cron paths).
   * Joins the active request transaction when one exists.
   */
  async withOrgContext<T>(
    organizationId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const ctx = getOrgContext();
    if (ctx?.tx) {
      await ctx.tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );
      return fn(ctx.tx);
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.organization_id', $1, true)`,
        organizationId,
      );
      return fn(tx);
    });
  }
}

const RAW_METHODS = new Set([
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
]);

/**
 * Wrap a PrismaService so that, when a request transaction is active in
 * `orgStorage`, all model operations and raw queries run on that transaction
 * and nested `$transaction` calls join it.
 */
export function createRlsPrismaService(): PrismaService {
  const base = new PrismaService();
  return new Proxy(base, {
    get(target, prop, receiver) {
      const store = orgStorage.getStore();
      const tx = store?.tx as Record<string, unknown> | undefined;

      if (tx && typeof prop === 'string') {
        if (prop === '$transaction') {
          return (arg: unknown, opts?: unknown) => {
            if (typeof arg === 'function') {
              return (arg as (t: unknown) => unknown)(tx);
            }
            if (Array.isArray(arg)) {
              return Promise.all(arg as Promise<unknown>[]);
            }
            return (target.$transaction as (a: unknown, o?: unknown) => unknown)(
              arg,
              opts,
            );
          };
        }
        if (RAW_METHODS.has(prop)) {
          const fn = tx[prop] as (...a: unknown[]) => unknown;
          return fn.bind(tx);
        }
        // Model delegates (e.g. `customer`, `guardProfile`) exist on the tx client.
        if (!prop.startsWith('$') && !prop.startsWith('on') && prop in tx) {
          return tx[prop];
        }
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
