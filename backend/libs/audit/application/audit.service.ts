import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@pssms/shared';

export interface AuditRecordInput {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  requestId?: string;
}

/** One field-level change extracted from `before` / `after`. */
export interface AuditFieldChange {
  field: string;
  label: string;
  from: string | null;
  to: string | null;
}

/**
 * §35.21 — audit entry as the governance desk needs to read it: **who** did
 * **what**, on which record, and the field-level delta. Never leaks secrets.
 */
export interface AuditEntry {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRoles: string[];
  action: string;
  actionLabel: string;
  resourceType: string;
  resourceLabel: string;
  resourceId: string | null;
  /** Human sentence: "Jane Doe (portal@…) acknowledged Visitor appointment …" */
  summary: string;
  ipAddress: string | null;
  requestId: string | null;
  changedFields: AuditFieldChange[];
  before: unknown;
  after: unknown;
  createdAt: Date;
}

export interface AuditListFilters {
  take?: number;
  resourceType?: string;
  action?: string;
  actorId?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

/** Fields that must never surface in the governance UI. */
const REDACTED_KEYS = new Set([
  'passwordHash',
  'mfaSecret',
  'keycloakSub',
  'tokenHash',
  'resetToken',
  'apiKeyHash',
]);

const SKIP_DIFF_KEYS = new Set(['organizationId', 'updatedAt']);

const RESOURCE_LABELS: Record<string, string> = {
  RiskRegisterItem: 'risk register item',
  PolicyDocument: 'policy',
  ConsentRecord: 'consent record',
  DataBreach: 'breach report',
  VisitorAppointment: 'visitor appointment',
  VisitorEntry: 'visitor gate entry',
  OccurrenceEntry: 'occurrence book entry',
  CustomerComplaint: 'customer complaint',
  CustomerServiceRequest: 'support ticket',
  Invoice: 'invoice',
  PaymentVoucher: 'payment voucher',
  PettyCashVoucher: 'petty cash voucher',
  PurchaseOrder: 'purchase order',
  PurchaseRequest: 'purchase request',
  SupplierSubmission: 'supplier submission',
  GuardSupplyRequest: 'B2B guard request',
  PayslipSnapshot: 'payslip snapshot',
  JobApplication: 'job application',
  MarketingLead: 'marketing lead',
  MarketingCommission: 'commission',
  Contract: 'contract',
  Customer: 'customer',
  User: 'user account',
  Role: 'role',
  Device: 'device',
  Asset: 'asset',
  ParkingViolation: 'parking violation',
  ParkingPermit: 'parking permit',
  DocumentObject: 'document',
  Incident: 'incident',
};

function humanise(code: string): string {
  const text = code
    .replace(/[._-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return code;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function resourceLabel(type: string): string {
  return RESOURCE_LABELS[type] ?? humanise(type).toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/** Deep-redact secrets before anything leaves the audit API. */
function redact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => redact(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACTED_KEYS.has(k) ? '[redacted]' : redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((v) => {
        if (isPlainObject(v)) {
          const hint =
            (v.code as string) ??
            (v.name as string) ??
            (v.label as string) ??
            (v.id as string);
          return typeof hint === 'string' ? hint : JSON.stringify(v);
        }
        return String(v);
      })
      .join(', ');
  }
  const json = JSON.stringify(value);
  return json && json.length > 240 ? `${json.slice(0, 237)}…` : json;
}

function diffFields(
  before: unknown,
  after: unknown,
): AuditFieldChange[] {
  const b = isPlainObject(before) ? before : null;
  const a = isPlainObject(after) ? after : null;
  if (!b && !a) return [];

  const keys = new Set<string>([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
  const changes: AuditFieldChange[] = [];
  for (const key of [...keys].sort()) {
    if (REDACTED_KEYS.has(key) || SKIP_DIFF_KEYS.has(key)) continue;
    const from = displayValue(b?.[key]);
    const to = displayValue(a?.[key]);
    if (from === to) continue;
    changes.push({ field: key, label: humanise(key), from, to });
    if (changes.length >= 40) break;
  }
  return changes;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        before: (input.before as Prisma.InputJsonValue) ?? undefined,
        after: (input.after as Prisma.InputJsonValue) ?? undefined,
        ipAddress: input.ipAddress,
        requestId: input.requestId,
      },
    });
  }

  /**
   * Enriched, org-scoped audit trail. Each row answers: who acted, on what,
   * and which fields changed.
   */
  async list(
    organizationId: string,
    filters: AuditListFilters | number = {},
  ): Promise<AuditEntry[]> {
    const opts: AuditListFilters =
      typeof filters === 'number' ? { take: filters } : filters;
    const take = Math.min(Math.max(Number(opts.take) || 50, 1), 200);

    const createdAt: Prisma.DateTimeFilter = {};
    if (opts.from) {
      const from = new Date(opts.from);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (opts.to) {
      const to = new Date(opts.to);
      if (!Number.isNaN(to.getTime())) createdAt.lte = to;
    }

    const where: Prisma.AuditLogWhereInput = { organizationId };
    if (opts.resourceType) where.resourceType = opts.resourceType;
    if (opts.resourceId) where.resourceId = opts.resourceId;
    if (opts.actorId) where.actorId = opts.actorId;
    if (opts.action) where.action = { contains: opts.action, mode: 'insensitive' };
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    return this.enrich(rows, organizationId);
  }

  /** Single entry with full before/after payload (details drawer). */
  async get(id: string, organizationId: string): Promise<AuditEntry> {
    const rows = await this.prisma.auditLog.findMany({
      where: { id, organizationId },
      take: 1,
    });
    const [entry] = await this.enrich(rows, organizationId);
    if (!entry) throw new NotFoundException('Audit entry not found');
    return entry;
  }

  private async enrich(
    rows: Array<{
      id: string;
      organizationId: string | null;
      actorId: string | null;
      action: string;
      resourceType: string;
      resourceId: string | null;
      before: Prisma.JsonValue | null;
      after: Prisma.JsonValue | null;
      ipAddress: string | null;
      requestId: string | null;
      createdAt: Date;
    }>,
    organizationId: string,
  ): Promise<AuditEntry[]> {
    if (rows.length === 0) return [];
    const actorIds = [
      ...new Set(rows.map((r) => r.actorId).filter((id): id is string => !!id)),
    ];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { organizationId, id: { in: actorIds } },
          select: {
            id: true,
            fullName: true,
            email: true,
            roles: { select: { role: { select: { code: true } } } },
          },
        })
      : [];
    const actorById = new Map(actors.map((u) => [u.id, u]));
    return rows.map((row) => {
      const actor = row.actorId ? actorById.get(row.actorId) : undefined;
      const actorName = actor?.fullName ?? (row.actorId ? 'Unknown user' : 'System');
      const actorEmail = actor?.email ?? null;
      const actionLabel = humanise(row.action);
      const resLabel = resourceLabel(row.resourceType);
      const shortRef = row.resourceId ? row.resourceId.slice(0, 8) : null;
      const changes = diffFields(row.before, row.after);
      const changedNames = changes.slice(0, 3).map((c) => c.label).join(', ');
      const changedNote = changes.length
        ? ` · changed ${changedNames}${changes.length > 3 ? ` +${changes.length - 3} more` : ''}`
        : '';
      return {
        id: row.id,
        organizationId: row.organizationId,
        actorId: row.actorId,
        actorName,
        actorEmail,
        actorRoles: actor?.roles.map((r) => r.role.code).filter(Boolean) ?? [],
        action: row.action,
        actionLabel,
        resourceType: row.resourceType,
        resourceLabel: resLabel,
        resourceId: row.resourceId,
        summary: `${actorName}${actorEmail ? ` (${actorEmail})` : ''} — ${actionLabel} on ${resLabel}${shortRef ? ` · ${shortRef}` : ''}${changedNote}`,
        ipAddress: row.ipAddress,
        requestId: row.requestId,
        changedFields: changes,
        before: redact(row.before),
        after: redact(row.after),
        createdAt: row.createdAt,
      };
    });
  }
}
